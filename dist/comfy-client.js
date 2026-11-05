function normalizeComfyEndpoint(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Nhập địa chỉ ComfyUI đầy đủ, gồm http:// hoặc https://.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Địa chỉ ComfyUI không hợp lệ.");
  return url.href.replace(/\/+$/, "");
}
function inpaintWorkflow({ checkpoint, image, prompt, negative = "", seed = 1, steps = 24, cfg = 6, denoise = 0.85 }) {
  if (typeof checkpoint !== "string" || !checkpoint || checkpoint.length > 500 || typeof image !== "string" || !image || typeof prompt !== "string" || !prompt.trim() || prompt.length > 4e3) throw new Error("Thiếu checkpoint, ảnh hoặc mô tả.");
  if (!Number.isSafeInteger(seed) || seed < 0 || !Number.isFinite(denoise) || denoise < 0.05 || denoise > 1 || !Number.isInteger(steps) || steps < 4 || steps > 60 || !Number.isFinite(cfg) || cfg < 1 || cfg > 20) throw new Error("Thông số Generative Fill không hợp lệ.");
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    "2": { class_type: "LoadImage", inputs: { image } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "4": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "5": { class_type: "VAEEncodeForInpaint", inputs: { pixels: ["2", 0], vae: ["1", 2], mask: ["2", 1], grow_mask_by: 6 } },
    "6": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["3", 0], negative: ["4", 0], latent_image: ["5", 0], seed, steps, cfg, sampler_name: "euler", scheduler: "normal", denoise } },
    "7": { class_type: "VAEDecode", inputs: { samples: ["6", 0], vae: ["1", 2] } },
    "8": { class_type: "SaveImage", inputs: { images: ["7", 0], filename_prefix: "LumaStudio" } }
  };
}
// Style transfer starts with the real image latent. A fully masked inpaint
// latent would discard the photograph and turn this into text-to-image.
function imageToImageWorkflow(parameters) {
  const workflow=inpaintWorkflow(parameters);
  workflow['5']={class_type:'VAEEncode',inputs:{pixels:['2',0],vae:['1',2]}};
  return workflow;
}
function createComfyClient(endpoint, { fetcher = fetch, token = "", sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const base = normalizeComfyEndpoint(endpoint), headers = token ? { Authorization: "Bearer " + token } : {};
  const request = async (path, options = {}) => {
    let res;
    try {
      res = await fetcher(base + path, { ...options, headers: { ...headers, ...options.headers }, credentials: "omit" });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error("Không kết nối được ComfyUI. Kiểm tra địa chỉ, CORS và quyền truy cập mạng của trình duyệt.");
    }
    if (!res.ok) {
      let message = "";
      try {
        message = (await res.text()).slice(0, 300);
      } catch {
      }
      throw new Error(`ComfyUI ${res.status}: ${message || "Yêu cầu thất bại."}`);
    }
    return res;
  };
  let queuedId = null;
  async function check(signal) {
    const r = await request("/object_info/CheckpointLoaderSimple", { signal }), info = await r.json(), names = info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    if (!Array.isArray(names) || !names.length) throw new Error("ComfyUI chưa có checkpoint SD / SDXL.");
    return names;
  }
  async function inspect(signal){
    const[stats,info]=await Promise.all([request('/system_stats',{signal}).then(r=>r.json()),request('/object_info',{signal}).then(r=>r.json())]);
    const required=['CheckpointLoaderSimple','LoadImage','CLIPTextEncode','VAEEncodeForInpaint','KSampler','VAEDecode','SaveImage'],missing=required.filter(k=>!info[k]),names=info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    if(!Array.isArray(names)||!names.length)throw Error('ComfyUI chưa có checkpoint SD / SDXL.');
    const devices=Array.isArray(stats.devices)?stats.devices.slice(0,8).map(d=>({name:String(d.name||'Unknown').slice(0,200),type:String(d.type||'unknown').slice(0,40),vramTotal:Number.isFinite(d.vram_total)?d.vram_total:null,vramFree:Number.isFinite(d.vram_free)?d.vram_free:null})):[];
    return{version:String(stats.system?.comfyui_version||'unknown').slice(0,80),devices,missing,checkpoints:names.filter(n=>typeof n==='string').slice(0,1000),gpuReported:devices.some(d=>['cuda','mps','xpu','privateuseone','directml'].includes(d.type)),observedAt:new Date().toISOString()};
  }
  async function run({ blob, signal, onProgress = () => {
  }, ...parameters }) {
    const data = new FormData();
    data.append("image", blob, "luma-" + crypto.randomUUID() + ".png");
    data.append("overwrite", "false");
    onProgress("Đang gửi ảnh và mask tới máy AI đã chọn…");
    const upload = await (await request("/upload/image", { method: "POST", body: data, signal })).json();
    if (typeof upload.name !== "string") throw new Error("ComfyUI không trả về tên ảnh.");
    const image = (upload.subfolder ? upload.subfolder + "/" : "") + upload.name, workflow = (parameters.workflow==='img2img'?imageToImageWorkflow:inpaintWorkflow)({ ...parameters, image });
    const queued = await (await request("/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }), signal })).json();
    if (!queued.prompt_id) throw new Error("ComfyUI từ chối workflow: " + JSON.stringify(queued.node_errors || queued.error || {}).slice(0, 500));
    const id = queuedId = String(queued.prompt_id);
    onProgress("AI đang tạo phương án · " + id.slice(0, 8) + "…");
    for (let attempt = 0; attempt < 450; attempt++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const history = await (await request("/history/" + encodeURIComponent(id), { signal })).json(), job = history[id];
      if (job?.status?.status_str === "error") throw new Error("ComfyUI xử lý thất bại. Xem log trên máy AI.");
      const images = job?.outputs?.["8"]?.images;
      if (images?.length) {
        const image2 = images[0], query = new URLSearchParams({ filename: image2.filename, subfolder: image2.subfolder || "", type: image2.type || "output" }), res = await request("/view?" + query, { signal });
        const result = await res.blob();
        if (result.size > 32 * 1024 * 1024) throw new Error("Ảnh AI vượt quá 32 MB.");
        queuedId = null;
        return { blob: result, seed: parameters.seed, promptId: id };
      }
      await sleep(2e3);
    }
    throw new Error("Máy AI chưa hoàn thành sau 15 phút.");
  }
  async function cancel() {
    const id = queuedId;
    queuedId = null;
    if (id) try {
      await request("/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delete: [id] }) });
    } catch {
    }
  }
  return { check, inspect, run, cancel, endpoint: base };
}
export {
  createComfyClient,
  imageToImageWorkflow,
  inpaintWorkflow,
  normalizeComfyEndpoint
};
