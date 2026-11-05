import { loadNeuralModel } from "./neural-models.js";
import { colorizationInput, composeColorizedRGBA } from "./colorization-math.js";
import { inpaintInput, composeInpaint } from "./neural-math.js";
import { runRemoval } from './removal-engine.js';
let runtime, sessions = /* @__PURE__ */ new Map();
self.onmessage = async ({ data: job }) => {
  const progress = (message) => self.postMessage({ id: job.id, progress: message });
  try {
    runtime ||= await import("./vendor/ort/ort.wasm.min.mjs");
    runtime.env.wasm.wasmPaths = new URL("./vendor/ort/", import.meta.url).href;
    runtime.env.wasm.numThreads = 1;
    runtime.env.wasm.proxy = false;
    runtime.env.logLevel = "error";
    const { kind, data, width, height, mask } = job.input;
    if (data.length !== width * height * 4) throw new Error('Kích thước dữ liệu ảnh AI không hợp lệ.');
    const modelKind = kind === 'remove' ? 'inpaint' : kind;
    let session = sessions.get(modelKind);
    if (!session) {
      const bytes = await loadNeuralModel(modelKind, progress);
      progress("Đang mở mô hình trên CPU…");
      session = await runtime.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      sessions.set(modelKind, session);
    }
    let result;
    if (kind === 'remove') {
      const result = await runRemoval(job.input, async input => {
        const tensor = new runtime.Tensor('float32', input, [1, 4, 512, 512]);
        let output;
        try { output = await session.run({ input: tensor }); return new Float32Array(output.output.data); }
        finally { tensor.dispose?.(); if (output) for (const t of Object.values(output)) t.dispose?.(); }
      }, progress);
      self.postMessage({ id: job.id, result }, [result.data.buffer]); return;
    } else if (kind === "colorization") {
      const small = new OffscreenCanvas(256, 256), original = new OffscreenCanvas(width, height);
      original.getContext("2d").putImageData(new ImageData(data, width, height), 0, 0);
      small.getContext("2d").drawImage(original, 0, 0, 256, 256);
      const input = colorizationInput(small.getContext("2d").getImageData(0, 0, 256, 256).data);
      progress("AI đang dự đoán màu sắc…");
      const output = await session.run({ input: new runtime.Tensor("float32", input, [1, 1, 256, 256]) });
      result = composeColorizedRGBA(data, width, height, output.output.data);
    } else if (kind === "inpaint") {
      const { input, crop } = inpaintInput(data, width, height, mask);
      progress("LaMa đang tái dựng vùng được chọn · có thể mất 20–60 giây…");
      const output = await session.run({ input: new runtime.Tensor("float32", input, [1, 4, 512, 512]) });
      result = composeInpaint(data, width, height, mask, output.output.data, crop);
    } else throw new Error("Unknown AI operation.");
    self.postMessage({ id: job.id, result: { data: result, width, height } }, [result.buffer]);
  } catch (error) {
    self.postMessage({ id: job.id, error: error.message || "AI không xử lý được ảnh này." });
  }
};
