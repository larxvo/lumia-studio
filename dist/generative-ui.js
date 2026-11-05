import {ART_AI_PRESETS} from './art-settings.js';
import { canvas, renderDocument, maskCanvas } from "./renderer.js";
import { clone, createLayer, uid } from "./model.js";
import { createNeuralClient } from "./neural-client.js";
import { createPhotoWorker } from "./photo-client.js";
import { blendGenerated } from "./neural-math.js";
import { createComfyClient } from "./comfy-client.js";
import {createAIVerification} from './ai-verification-ui.js';
import {localRuntime} from './local-runtime.js';
import { polygon, regionBounds } from "./face-geometry.js";
import { beardMask } from './portrait-features.js';
const $ = (s) => document.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const PRESETS = {
  repair: [["repair", "Vá rách & mất ảnh", "Restore the damaged area of this old photograph, reconstruct coherent photographic details and textures, match original lighting, grain, era and perspective. Preserve identity and composition."], ["water", "Giảm vùng hỏng do nước", "Restore a water-damaged old photograph, reconstruct the selected missing details, remove stains, match the surrounding texture, lighting and photographic grain."], ["remove", "Xóa vật thể", "Remove the selected object and reconstruct a natural coherent background, matching the surrounding photograph."]],
  expression: [["smile", "Cười tự nhiên", "Same person, natural gentle smile, anatomically plausible lips and teeth, preserve facial identity, age, skin texture, lighting and head pose."], ["neutral", "Miệng khép tự nhiên", "Same person with a relaxed neutral expression, closed lips, anatomically natural mouth, preserve facial identity, age, skin texture, lighting and head pose."], ["relaxed", "Thư giãn nét mặt", "Same person, relaxed natural lips and surrounding expression, preserve identity, age, head pose and lighting."]],
  skin: [["spots", "Dấu mụn nhỏ", "Same person, gently reduce small visible acne-like spots in the selected skin region. Retain pores, natural texture, identity and lighting."], ["pigment", "Tàn nhang & đốm sậm", "Same person, gently reduce visible dark spots and freckles inside the selected skin region, preserve natural skin texture and identity."], ["flakes", "Mảng đỏ & bong tróc", "Same person, gently reduce visible redness and flaky skin texture inside the selected region, preserve pores, identity, age and lighting."], ["wrinkles", "Nếp nhăn nhỏ", "Same person, gently soften fine skin wrinkles inside the selected region, retain natural age, texture, pores and identity."]],
  colorization: [["color", "Màu tự nhiên", ""]],
  beard: [["remove", "Xóa râu dày", "Same person clean shaven, remove all facial hair from the masked area, natural skin with visible pores, preserve lips, nose, jaw anatomy, identity, age, lighting and skin tone. No beard, no moustache."], ["moustache", "Ria mép", "Same person with a realistic neatly groomed moustache, individual natural hair strands, matching head hair color and lighting. Preserve lips, nose, face identity and expression."], ["chin", "Râu cằm", "Same person with a realistic small chin beard, clean cheeks and upper lip, natural individual strands, preserve identity and lighting."], ["goatee", "Râu dê", "Same person with a realistic neatly groomed goatee beard and moustache, natural strands, matching lighting, preserve facial identity."], ["boxed", "Quai nón gọn", "Same person with a photorealistic short boxed beard and moustache, natural strands and skin texture, matching hair color and lighting, preserve identity and expression."], ["full", "Quai nón đầy", "Same person with a full natural realistic beard and moustache, individual photographic hair strands, match hair color and lighting, preserve face identity and expression."]]
};
PRESETS.art=ART_AI_PRESETS.map(p=>[p.id,p.name,p.prompt]);
PRESETS.expression.push(["broad", "Cười tươi có răng", "Same person with a broad natural happy smile showing anatomically plausible teeth, preserve facial identity, age, realistic skin pores, head pose and original lighting."], ["closed", "Mỉm cười khép môi", "Same person with a gentle closed-lip smile, relaxed natural lips, preserve identity, age, skin texture, head pose and lighting."], ["asymmetric", "Cười lệch nhẹ", "Same person with a subtle asymmetric half smile, anatomically natural lips, preserve facial identity, age, head pose, realistic texture and lighting."]);
function createGenerativeStudio(api, { clientFactory = createNeuralClient, analyzerFactory = () => createPhotoWorker("analyze"), comfyFactory=createComfyClient } = {}) {
  let active = null, connection = { endpoint: "http://127.0.0.1:8188", checkpoint: "", token: "", checked: false, names: [] };
  const verification=createAIVerification(api,()=>({...connection}));
  try {
    const c = JSON.parse(localStorage.getItem("luma-comfy-settings") || "null");
    if (c?.endpoint) connection = { ...connection, endpoint: c.endpoint, checkpoint: c.checkpoint || "" };
  } catch {
  }
  const local=localRuntime();
  if(local)connection={...connection,endpoint:local.origin+'/comfy',token:local.token,checked:false};
  function configure() {
    api.showModal("Kết nối máy AI", "ComfyUI của bạn · ảnh chỉ gửi khi bạn bấm Tạo phương án", `<div class="advanced-intro"><span class="live-pill">GENERATIVE FILL THEO MÔ TẢ</span><p>LaMa và tô màu vẫn dùng được ngay trên máy. Để tạo nội dung theo câu lệnh hoặc thay biểu cảm, kết nối ComfyUI có checkpoint Stable Diffusion / SDXL tương thích.</p></div><label class="modal-field">Địa chỉ ComfyUI<input id="comfy-endpoint" value="${esc(connection.endpoint)}" placeholder="https://ai.example.com"></label><label class="modal-field">Bearer token của máy AI (nếu có)<input id="comfy-token" type="password" autocomplete="off" placeholder="Chỉ giữ trong phiên này"></label><button class="button" id="comfy-check">Kiểm tra kết nối & lấy mô hình</button><label class="modal-field">Checkpoint<select id="comfy-checkpoint">${connection.names.map((n) => `<option ${n === connection.checkpoint ? "selected" : ""}>${esc(n)}</option>`).join("") || '<option value="">Chưa kiểm tra kết nối</option>'}</select></label><p id="comfy-status" class="advanced-status" role="status">Chưa kiểm tra máy AI trong phiên này.</p><details class="advanced-details"><summary>Hướng dẫn kết nối</summary><p>Cài ComfyUI, thêm checkpoint SD / SDXL và bật CORS cho địa chỉ Luma của bạn. Ví dụ khi tự host: <code>python main.py --enable-cors-header http://localhost:4173</code>. Với trang HTTPS, dùng endpoint HTTPS hoặc quyền truy cập mạng cục bộ của trình duyệt. Máy chủ có thể lưu ảnh đầu vào và ảnh sinh ra.</p><p>Luma dùng các node có sẵn: CheckpointLoaderSimple, LoadImage, CLIPTextEncode, VAEEncodeForInpaint, KSampler, VAEDecode và SaveImage. Checkpoint Flux hoặc workflow cần custom node chưa được hỗ trợ ở luồng này. Phần mềm miễn phí; tài nguyên máy AI do bạn cung cấp.</p><a href="https://docs.comfy.org/installation" target="_blank" rel="noopener">Hướng dẫn cài ComfyUI ↗</a></details>`, [{ label: "Đóng", run: () => api.closeModal() }, { label: "Lưu kết nối", primary: true, run: () => {
      const select = $("#comfy-checkpoint");
      if (!connection.checked || !select.value) {
        $("#comfy-status").textContent = "Kiểm tra kết nối thành công trước khi lưu.";
        return;
      }
      connection.checkpoint = select.value;
      try {
        localStorage.setItem("luma-comfy-settings", JSON.stringify({ endpoint: connection.endpoint, checkpoint: connection.checkpoint }));
      } catch {
      }
      api.closeModal();
      api.toast("Đã lưu máy AI. Chọn Generative Studio để tạo phương án.");
    } }], () => {
      $("#comfy-token").value = connection.token;
      $("#comfy-check").onclick = async () => {
        const b = $("#comfy-check");
        b.disabled = true;
        try {
          const endpoint = $("#comfy-endpoint").value.trim(), token = $("#comfy-token").value, client = comfyFactory(endpoint, { token });
          $("#comfy-status").textContent = "Đang kiểm tra…";
          const names = await client.check(AbortSignal.timeout(12e3));
          connection = { endpoint: client.endpoint, checkpoint: connection.checkpoint, token, checked: true, names };
          $("#comfy-checkpoint").innerHTML = names.map((n) => `<option ${n === connection.checkpoint ? "selected" : ""}>${esc(n)}</option>`).join("");
          $("#comfy-status").textContent = "Đã kết nối · " + names.length + " checkpoint.";
        } catch (error) {
          connection.checked = false;
          $("#comfy-status").textContent = error.message;
        } finally {
          if (b.isConnected) b.disabled = false;
        }
      };
      $("#comfy-endpoint").oninput = () => connection.checked = false;
      $("#comfy-token").oninput = () => connection.checked = false;
    });
  }
  function cancel() {
    active?.close();
  }
  async function open(initial = "repair", options = {}) {
    cancel();
    const doc=api.doc(),signature=JSON.stringify(doc),id=doc.id,scale=1,artTarget=options.artTarget?doc.layers.find(l=>l.id===options.artTarget.layerId):null;
    if(options.artTarget&&!artTarget)throw Error('Layer Art nguồn đã thay đổi.');
    let original;
    if(artTarget){const image=api.assets.get(options.artTarget.source)||await api.assets.load(options.artTarget.source);original=canvas(image.width,image.height);original.getContext('2d').drawImage(image,0,0);}else original=renderDocument(doc,api.assets,{scale});
    const w=original.width,h=original.height,raw=original.getContext('2d').getImageData(0,0,w,h).data;
    let mode = initial, engine = options.scenePrompt || ["expression", "skin", "art"].includes(initial) ? "comfy" : "local", mask = canvas(w, h), mx = mask.getContext("2d"), maskUndo = [], brush = "add", brushSize = 0.035, drawing = null, split = 50, showMask = true, amount = 100, busy = false, mounted = true, result = null, resultMeta = null, abort = null, comfy = null, analyzing = false, faces = [], faceIndex = 0;
    let selectedPreset = mode==='art'&&PRESETS.art.some(p=>p[0]===options.artTarget?.preset)?options.artTarget.preset:PRESETS[mode][0][0];
    if(options.scenePrompt||mode==='art'){mx.fillStyle="#fff";mx.fillRect(0,0,w,h);}
    const client = clientFactory(), analyzer = analyzerFactory();
    if (doc.selection&&mode!=='art') mx.drawImage(maskCanvas(doc, doc.selection, scale, api.assets), 0, 0, w, h);
    const state = { close() {
      mounted = false;
      client.stop();
      analyzer.stop();
      abort?.abort();
      comfy?.cancel();
      if (active === state) active = null;
    }, getState: () => ({ mode, engine, busy, result, mask, faces }) };
    active = state;
    function note(message, error = false) {
      if (!mounted) return;
      const el = $("#gen-status");
      if (el) {
        el.textContent = message;
        el.classList.toggle("is-error", error);
      }
    }
    function masked() {
      const rgba = mx.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
      for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4 + 3] / 255;
      return out;
    }
    function hasMask() {
      return masked().some((a) => a > 0.01);
    }
    function invalidate() {
      result = null;
      $("#gen-apply").disabled = true;
      draw();
    }
    function draw() {
      if (!mounted) return;
      const c = $("#gen-preview");
      if (!c) return;
      const s = Math.min(1, 1400 / Math.max(w, h));
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      const x = c.getContext("2d");
      x.drawImage(original, 0, 0, c.width, c.height);
      if (result) {
        const pixels = blendGenerated(raw, result.data, null, amount / 100), out = canvas(w, h), context = out.getContext("2d"), image = context.createImageData(w, h);
        image.data.set(pixels);
        context.putImageData(image, 0, 0);
        x.save();
        x.beginPath();
        x.rect(c.width * split / 100, 0, c.width * (1 - split / 100), c.height);
        x.clip();
        x.drawImage(out, 0, 0, c.width, c.height);
        x.restore();
      }
      if (showMask) {
        const overlay = canvas(w, h), ox = overlay.getContext("2d");
        ox.drawImage(mask, 0, 0);
        ox.globalCompositeOperation = "source-in";
        ox.fillStyle = "rgba(157,223,201,.45)";
        ox.fillRect(0, 0, w, h);
        x.drawImage(overlay, 0, 0, c.width, c.height);
      }
    }
    function snapshotMask() {
      maskUndo.push(mask.toDataURL());
      if (maskUndo.length > 12) maskUndo.shift();
    }
    function stamp(a, b) {
      mx.save();
      mx.globalCompositeOperation = brush === "subtract" ? "destination-out" : "source-over";
      mx.strokeStyle = "#fff";
      mx.fillStyle = "#fff";
      mx.lineWidth = brushSize * Math.max(w, h);
      mx.lineCap = "round";
      mx.lineJoin = "round";
      mx.beginPath();
      mx.moveTo(a.x, a.y);
      mx.lineTo(b.x, b.y);
      mx.stroke();
      mx.beginPath();
      mx.arc(b.x, b.y, mx.lineWidth / 2, 0, Math.PI * 2);
      mx.fill();
      mx.restore();
    }
    async function detect() {
      if (analyzing || busy) return;
      analyzing = true;
      $("#gen-face-mask").disabled = true;
      try {
        note("Đang nhận diện khuôn mặt…");
        const bitmap = await createImageBitmap(original);
        const data = await analyzer.run(bitmap, (message) => note(message));
        if (!mounted) return;
        faces = data.faces;
        if (mode === "skin") {
          makeSkinMask(data);
          note("Đã chọn vùng da. Kiểm tra và tô thêm / trừ bớt nếu cần.");
          return;
        }
        $("#gen-face-select").innerHTML = faces.map((_, i) => `<option value="${i}">Khuôn mặt ${i + 1}</option>`).join("");
        if (!faces.length) throw new Error("Chưa tìm thấy khuôn mặt. Bạn vẫn có thể tô vùng bằng tay.");
        faceIndex = 0;
        makeFaceMask();
        note(`Đã nhận diện ${faces.length} khuôn mặt. Kiểm tra vùng tô trước khi tạo.`);
      } catch (error) {
        if (error.name !== "AbortError") note(error.message, true);
      } finally {
        analyzing = false;
        if (mounted) $("#gen-face-mask").disabled = false;
      }
    }
    function makeSkinMask(data) {
      if (!data.skin) throw new Error("Chưa nhận diện được vùng da.");
      snapshotMask();
      mx.clearRect(0, 0, w, h);
      const small = canvas(data.skin.width, data.skin.height), x = small.getContext("2d"), image = x.createImageData(small.width, small.height);
      let coverage = 0;
      for (let i = 0; i < data.skin.values.length; i++) {
        const a = Math.max(0, Math.min(1, (data.skin.values[i] - 0.35) / 0.4));
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
        image.data[i * 4 + 3] = a * 255;
        coverage += a;
      }
      if (coverage < 4) throw new Error("Không đủ vùng da rõ. Hãy tô vùng bằng tay.");
      x.putImageData(image, 0, 0);
      mx.drawImage(small, 0, 0, w, h);
      mx.save();
      mx.globalCompositeOperation = "destination-out";
      for (const face of data.faces) for (const region of ["lips", "leftEye", "rightEye", "leftBrow", "rightBrow"]) {
        const points = polygon(face, region, w, h);
        mx.beginPath();
        points.forEach((p, i) => i ? mx.lineTo(p.x, p.y) : mx.moveTo(p.x, p.y));
        mx.closePath();
        mx.fill();
      }
      mx.restore();
      showMask = true;
      $("#gen-show-mask").checked = true;
      invalidate();
    }
    function makeFaceMask() {
      const face = faces[faceIndex];
      if (!face) return;
      snapshotMask();
      mx.clearRect(0, 0, w, h);
      if (mode === 'beard') {
        const values = beardMask(w, h, face, selectedPreset === 'remove' ? 'full' : selectedPreset), pixels = mx.createImageData(w, h);
        for (let i = 0; i < values.length; i++) {
          pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255;
          pixels.data[i * 4 + 3] = Math.round(values[i] * 255);
        }
        mx.putImageData(pixels, 0, 0);
        showMask = true; $("#gen-show-mask").checked = true; invalidate(); return;
      }
      const b = regionBounds(polygon(face, "lips", w, h)), rw = Math.max(b.width * 1.8, face.box.width * w * 0.42), rh = Math.max(b.height * 2.6, face.box.height * h * 0.22);
      mx.fillStyle = "#fff";
      mx.beginPath();
      mx.ellipse(b.cx, b.cy, rw / 2, rh / 2, 0, 0, Math.PI * 2);
      mx.fill();
      showMask = true;
      $("#gen-show-mask").checked = true;
      invalidate();
    }
    function controls() {
      $("#gen-tabs").innerHTML = (artTarget?[["art","Art & 3D AI"]]:[["repair", "Vá & tái dựng"], ["colorization", "Tô màu AI"], ["expression", "Biểu cảm"], ["skin", "Da & dấu vết"], ["beard", "Râu AI"], ["art","Art & 3D AI"]]).map(([key, name]) => `<button data-gen-mode="${key}" class="${mode === key ? "active" : ""}">${name}</button>`).join("");
      $("#gen-presets").innerHTML = PRESETS[mode].map(([key, name]) => `<button data-gen-preset="${key}" class="${selectedPreset === key ? 'active' : ''}"><strong>${name}</strong></button>`).join("");
      $("#gen-engine").value = engine;
      $("#gen-engine").disabled = !["repair", "beard"].includes(mode) || mode === 'beard' && selectedPreset !== 'remove';
      $("#gen-prompt-field").hidden = engine !== "comfy";
      $("#gen-comfy-settings").hidden = engine !== "comfy";
      $("#gen-face-controls").hidden = !["expression", "skin", "beard"].includes(mode);
      $("#gen-face-mask").textContent = mode === "skin" ? "Tự chọn da bằng AI" : mode === 'beard' ? 'Chọn vùng râu theo mốc mặt' : "Tự chọn vùng miệng bằng AI";
      $("#gen-face-select").parentElement.hidden = !['expression', 'beard'].includes(mode);
      $("#gen-description").textContent = mode === "colorization" ? "AI dự đoán màu từ nội dung ảnh, giữ độ sáng và chi tiết ảnh gốc. Màu lịch sử không thể xác minh từ ảnh đen trắng." : mode === "skin" ? "Chọn vùng da bằng AI rồi tinh chỉnh bằng cọ. Preset xử lý dấu vết nhìn thấy; không phân loại bệnh da." : mode === "expression" ? "AI tái sinh vùng miệng, có thể thay đổi môi và răng. Kiểm tra danh tính, giải phẫu và vùng nối trước khi áp dụng." : "Tô vùng rách, mất hoặc hỏng. LaMa tái dựng theo ngữ cảnh ảnh; vùng ngoài mask được giữ nguyên. Chi tiết mới là dự đoán.";
      if (mode === 'beard') $("#gen-description").textContent = selectedPreset === 'remove' ? 'LaMa có thể xóa vùng râu ngay trên thiết bị; kiểm tra và sửa mask trước khi tạo. Da bị che là phần tái dựng dự đoán. Có thể chuyển sang ComfyUI để tạo theo mô tả.' : 'Tạo râu ảnh thật theo mô tả qua ComfyUI của bạn. Vùng môi được bảo vệ trong mask tự chọn; kiểm tra từng phương án trước khi áp.';
      $('#gen-art-options').hidden=mode!=='art';
      if(mode==='art')$('#gen-description').textContent=(artTarget?'Chuyển layer ảnh đang chọn':'Chuyển toàn canvas')+' từ ảnh gốc làm tham chiếu; chỉnh mức tái sinh để giữ cấu trúc hoặc đổi phong cách. Đây là ảnh minh họa 2D có hình thức 3D; không tạo mesh. Chất lượng phụ thuộc checkpoint; danh tính / hình dáng có thể đổi, cần kiểm tra.';
      $("#gen-size-note").textContent = `Đầu ra ${w} × ${h} px · ${engine === "local" ? mode === "colorization" ? "Tải AI tô màu ~31 MB khi dùng lần đầu." : "Tải LaMa ~60 MB khi dùng lần đầu." : "Ảnh và mask sẽ gửi tới " + connection.endpoint + "."}`;
      if(mode==='art')$('#gen-size-note').textContent+=' AI xử lý cạnh dài đến 1024 px rồi nội suy về kích thước gốc; không phải sinh chi tiết native độ phân giải lớn.';
      $("#gen-seed-wrap").hidden = engine !== "comfy";
      $("#gen-connection-note").textContent = engine === "comfy" ? connection.checked ? "Máy AI đã kết nối · " + connection.checkpoint : "Cần kết nối máy AI của bạn trước khi tạo." : "Xử lý trên thiết bị · không cần tài khoản hoặc API key.";
      $("#gen-prompt").disabled = busy;
      $("#gen-seed").disabled = busy;
      $("#gen-denoise").disabled = busy;
      $("#gen-engine").disabled = busy || !["repair", "beard"].includes(mode) || mode === 'beard' && selectedPreset !== 'remove';
      $("#gen-generate").disabled = busy || analyzing || engine === "comfy" && !connection.checked;
      document.querySelectorAll("[data-gen-mode]").forEach((b) => b.onclick = () => {
        if (busy || analyzing) return;
        mode = b.dataset.genMode;
        selectedPreset = PRESETS[mode][0][0];
        if(mode==='art'){mx.fillStyle='#fff';mx.fillRect(0,0,w,h);$('#gen-denoise').value='60';}
        engine = ["expression", "skin", "art"].includes(mode) ? "comfy" : "local";
        $("#gen-prompt").value = options.scenePrompt || PRESETS[mode].find(p=>p[0]===selectedPreset)[2];
        invalidate();
        controls();
        if (faces.length && ['expression', 'beard'].includes(mode)) makeFaceMask();
      });
      document.querySelectorAll("[data-gen-preset]").forEach((b) => b.onclick = () => {
        if (busy) return;
        invalidate();
        selectedPreset = b.dataset.genPreset;
        if (mode === 'beard') engine = selectedPreset === 'remove' ? 'local' : 'comfy';
        $("#gen-prompt").value = PRESETS[mode].find((p) => p[0] === b.dataset.genPreset)[2];
        document.querySelectorAll("[data-gen-preset]").forEach((el) => el.classList.toggle("active", el === b));
        if (["expression", "beard"].includes(mode) && faces.length) makeFaceMask();
        controls();
      });
    }
    async function generate() {
      if (busy || analyzing) return;
      const useMask = hasMask();
      if (mode !== "colorization" && !useMask) {
        note("Tô vùng cần thay đổi hoặc dùng vùng chọn từ canvas.", true);
        return;
      }
      let generatedSeed = 0;
      const generatedPrompt = engine === "comfy" ? $("#gen-prompt").value : "";
      busy = true;
      $("#gen-engine").disabled = true;
      $("#gen-prompt").disabled = true;
      $("#gen-seed").disabled = true;
      $("#gen-denoise").disabled = true;
      $("#gen-generate").disabled = true;
      $("#gen-apply").disabled = true;
      abort = new AbortController();
      const m = masked();
      try {
        let output;
        if (engine === "local") {
          output = await client.run({ kind: mode === "colorization" ? "colorization" : "inpaint", data: new Uint8ClampedArray(raw), width: w, height: h, mask: m }, (message) => note(message));
          if (mode === "colorization" && useMask) output.data = blendGenerated(raw, output.data, m);
        } else {
          if (!connection.checked) throw new Error("Kết nối máy AI trước.");
          const s = Math.min(1, 1024 / Math.max(w, h)), cw = Math.max(64, Math.round(w * s / 8) * 8), ch = Math.max(64, Math.round(h * s / 8) * 8), upload = canvas(w, h), ux = upload.getContext("2d"), pixels = ux.createImageData(w, h);
          pixels.data.set(raw);
          for(let i=0;i<m.length;i++){
            if(mode==='art'){const a=raw[i*4+3]/255;for(let k=0;k<3;k++)pixels.data[i*4+k]=raw[i*4+k]*a+255*(1-a);pixels.data[i*4+3]=255;}
            else pixels.data[i*4+3]=Math.round(255*(1-m[i]));
          }
          ux.putImageData(pixels, 0, 0);
          const small = canvas(cw, ch);
          small.getContext("2d").drawImage(upload, 0, 0, cw, ch);
          const blob = await new Promise((resolve) => small.toBlob(resolve, "image/png"));
          comfy = comfyFactory(connection.endpoint, { token: connection.token });
          const seed = Math.max(0, Math.min(2147483647, Number($("#gen-seed").value) || Math.floor(Math.random() * 2147483647)));
          $("#gen-seed").value = seed;
          generatedSeed = seed;
          const returned = await comfy.run({ workflow:mode==='art'?'img2img':'inpaint', blob, prompt: generatedPrompt, checkpoint: connection.checkpoint, seed, steps: 24, cfg: 6, denoise: Number($("#gen-denoise").value) / 100, signal: abort.signal, onProgress: (message) => note(message) });
          const uri = URL.createObjectURL(returned.blob);
          let image;
          try {
            image = await api.assets.load(uri);
          } finally {
            URL.revokeObjectURL(uri);
          }
          const out = canvas(w, h);
          out.getContext("2d").drawImage(image, 0, 0, w, h);
          const generated=out.getContext('2d').getImageData(0,0,w,h).data;
          if(mode==='art'&&$('#gen-art-alpha').checked)for(let i=0;i<m.length;i++)generated[i*4+3]=raw[i*4+3];
          output={width:w,height:h,data:blendGenerated(raw,generated,useMask?m:null)};
        }
        if (!mounted) return;
        result = output;
        resultMeta = { mode, engine, prompt: generatedPrompt, seed: generatedSeed };
        showMask = false;
        $("#gen-show-mask").checked = false;
        $("#gen-apply").disabled = false;
        draw();
        note("Đã tạo phương án. So sánh trước/sau và chỉnh cường độ trước khi áp dụng.");
      } catch (error) {
        if (error.name !== "AbortError") note(error.message, true);
      } finally {
        busy = false;
        if (mounted) {
          controls();
          $("#gen-apply").disabled = !result;
        }
      }
    }
    function apply() {
      if (!result || busy) return;
      if (api.doc().id !== id || JSON.stringify(api.doc()) !== signature) {
        note("Tài liệu nguồn đã thay đổi. Đóng và mở lại để tránh áp dụng nhầm kết quả.", true);
        return;
      }
      if (doc.layers.length >= 150) {
        note("Đã đạt giới hạn 150 layer.", true);
        return;
      }
      const pixels = blendGenerated(raw, result.data, null, amount / 100), c = canvas(w, h), x = c.getContext("2d"), data = x.createImageData(w, h);
      data.data.set(pixels);
      x.putImageData(data, 0, 0);
      const source = c.toDataURL();
      api.assets.set(source, c);
      const resultLayer = createLayer("image", { name: mode === "colorization" ? "AI · Tô màu" : mode === "expression" ? "AI · Biểu cảm" : mode === "skin" ? "AI · Da & dấu vết" : mode === 'beard' ? 'AI · Râu' : mode==='art'?'AI · Art & 3D':"AI · Tái dựng", source, width: doc.width, height: doc.height });
      resultLayer.generation = { workflow:mode==='art'?'img2img':'inpaint',denoise:Number($("#gen-denoise").value)/100, version: 1, engine: engine === "local" ? mode === "colorization" ? "eccv16" : "lama" : "comfyui", operation: mode, prompt: resultMeta.prompt.slice(0, 4e3), seed: resultMeta.seed, strength: amount, maskSource: hasMask() ? mask.toDataURL() : null };
      if(artTarget){Object.assign(resultLayer,{x:artTarget.x,y:artTarget.y,width:artTarget.width,height:artTarget.height,rotation:artTarget.rotation,flipX:artTarget.flipX,flipY:artTarget.flipY,parentId:artTarget.parentId||null,opacity:artTarget.opacity,blend:artTarget.blend,mask:options.artTarget.bakedMask?null:clone(artTarget.mask)});artTarget.visible=false;doc.layers.splice(doc.layers.indexOf(artTarget)+1,0,resultLayer);}else{for (const l of doc.layers) if (!l.parentId) l.visible = false;doc.layers.push(resultLayer);}
      doc.activeId = resultLayer.id;
      doc.selectedIds = [resultLayer.id];
      state.close();
      api.closeModal();
      api.commit(resultLayer.name);
      api.toast("Đã áp dụng layer riêng. Nguồn ảnh vẫn có trong các layer bên dưới.");
    }
    api.showModal("Generative Studio", "Chọn vùng · tạo phương án · tinh chỉnh sau", `<div class="generative-studio"><div class="gen-image-side"><div class="gen-preview-wrap"><canvas id="gen-preview" aria-label="So sánh ảnh AI, tô vùng cần thay đổi"></canvas></div><div class="lab-compare"><span>Gốc</span><input id="gen-split" type="range" min="0" max="100" value="50" aria-label="So sánh trước sau AI"><span>Phương án AI</span></div><div class="gen-brushes"><button class="button active" data-gen-brush="add">Tô vùng</button><button class="button" data-gen-brush="subtract">Trừ vùng</button><button class="button" id="gen-mask-undo">Lùi nét</button><button class="button" id="gen-clear-mask">Xóa vùng tô</button><label>Cỡ cọ<input id="gen-brush-size" type="range" min="1" max="15" value="3.5" step=".5" aria-label="Cỡ cọ AI"></label><label class="check-row"><input type="checkbox" id="gen-show-mask" checked> Hiện vùng tô</label></div><p id="gen-status" class="advanced-status" role="status">Chọn preset, tô vùng cần thay đổi rồi bấm Tạo phương án.</p><p class="gen-size-note" id="gen-size-note"></p></div><div class="gen-controls"><div class="lab-tabs" id="gen-tabs"></div><div class="gen-preset-grid" id="gen-presets"></div><p class="lab-explanation" id="gen-description"></p><label class="modal-field">Bộ xử lý<select id="gen-engine"><option value="local">Trên thiết bị · neural AI</option><option value="comfy">Máy AI của tôi · ComfyUI</option></select></label><p id="gen-connection-note" class="gen-size-note"></p><button class="button" id="gen-comfy-settings">Kết nối / đổi máy AI</button><div id="gen-face-controls"><button class="button" id="gen-face-mask">Tự chọn vùng miệng bằng AI</button><label class="modal-field">Khuôn mặt<select id="gen-face-select"><option>Chưa nhận diện</option></select></label></div><label class="modal-field" id="gen-prompt-field">Mô tả kết quả<textarea id="gen-prompt" rows="5">${esc(options.scenePrompt || PRESETS[mode].find(p=>p[0]===selectedPreset)[2])}</textarea></label><div id="gen-seed-wrap"><div class="modal-grid"><label class="modal-field">Seed (0 = ngẫu nhiên)<input type="number" id="gen-seed" min="0" max="2147483647" value="0"></label><label class="modal-field">Mức tái sinh<select id="gen-denoise"><option value="35">35% · giữ cấu trúc nhiều</option><option value="45">45% · chuyển nhẹ</option><option value="60">60% · giữ nhiều chi tiết</option><option value="85" selected>85% · cân bằng</option><option value="100">100% · tái dựng mạnh</option></select></label></div></div><div id="gen-art-options" hidden><label class="check-row"><input id="gen-art-alpha" type="checkbox" checked> Giữ nền trong suốt gốc (chủ thể cần khớp viền)</label></div><label class="lab-slider">Cường độ kết quả<output id="gen-amount-output">100%</output><input id="gen-amount" type="range" min="0" max="100" value="100" aria-label="Cường độ AI"></label><button class="button primary gen-generate" id="gen-generate">Tạo phương án</button><button class="button" id="gen-stop">Dừng xử lý</button></div></div>`, [{ label: "Hủy", run: () => api.closeModal(true) }, { label: "Áp dụng layer riêng", primary: true, run: apply }], () => {
      $('[data-modal-button="1"]').id = "gen-apply";
      $("#gen-apply").disabled = true;
      if(mode==='art')$('#gen-denoise').value='60';
      $('#gen-art-alpha').onchange=invalidate;
      controls();
      draw();
      $("#gen-generate").onclick = generate;
      $("#gen-split").oninput = (e) => {
        split = Number(e.target.value);
        draw();
      };
      $("#gen-amount").oninput = (e) => {
        amount = Number(e.target.value);
        $("#gen-amount-output").textContent = amount + "%";
        draw();
      };
      $("#gen-show-mask").onchange = (e) => {
        showMask = e.target.checked;
        draw();
      };
      $("#gen-brush-size").oninput = (e) => brushSize = Number(e.target.value) / 100;
      $("#gen-engine").onchange = (e) => {
        if (busy) return;
        engine = e.target.value;
        invalidate();
        controls();
      };
      $("#gen-comfy-settings").onclick = () => {
        state.close();
        configure();
      };
      $("#gen-face-mask").onclick = detect;
      $("#gen-face-select").onchange = (e) => {
        if (busy || analyzing) return;
        faceIndex = Number(e.target.value);
        makeFaceMask();
      };
      document.querySelectorAll("[data-gen-brush]").forEach((b) => b.onclick = () => {
        brush = b.dataset.genBrush;
        document.querySelectorAll("[data-gen-brush]").forEach((el) => el.classList.toggle("active", el === b));
      });
      $("#gen-clear-mask").onclick = () => {
        if (busy) return;
        snapshotMask();
        mx.clearRect(0, 0, w, h);
        invalidate();
      };
      $("#gen-mask-undo").onclick = async () => {
        if (busy || !maskUndo.length) return;
        const image = await api.assets.load(maskUndo.pop());
        if (!mounted) return;
        mx.clearRect(0, 0, w, h);
        mx.drawImage(image, 0, 0);
        invalidate();
      };
      $("#gen-stop").onclick = () => {
        client.stop();
        analyzer.stop();
        abort?.abort();
        comfy?.cancel();
        busy = false;
        analyzing = false;
        note("Đã dừng nhận kết quả. Tác vụ đang chạy trên máy AI có thể vẫn tiếp tục.");
        controls();
      };
      const c = $("#gen-preview"), point = (e) => {
        const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h };
      };
      c.onpointerdown = (e) => {
        if (busy || analyzing || e.button !== 0) return;
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        snapshotMask();
        drawing = point(e);
        stamp(drawing, drawing);
        result = null;
        $("#gen-apply").disabled = true;
        showMask = true;
        $("#gen-show-mask").checked = true;
        draw();
      };
      c.onpointermove = (e) => {
        if (!drawing) return;
        const next = point(e);
        stamp(drawing, next);
        drawing = next;
        draw();
      };
      c.onpointerup = c.onpointercancel = () => drawing = null;
      if (mode === 'beard') detect();
    }, state.close);
  }
  return { open, cancel, configure, verify:()=>verification.open(),verification,current: () => active, connection: () => ({ ...connection, token: void 0 }) };
}
export {
  createGenerativeStudio
};
