import { processPhoto } from "./portrait-engine.js";
let analyzer = null;
self.onmessage = async ({ data: job }) => {
  try {
    if (job.kind === "analyze") {
      if (!analyzer) {
        const ort = await import("./vendor/ort/ort.wasm.min.mjs");
        ort.env.wasm.wasmPaths = new URL("./vendor/ort/", import.meta.url).href;
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
        ort.env.logLevel = "error";
        const { createFaceAnalyzer } = await import("./face-inference.js");
        analyzer = createFaceAnalyzer(ort);
      }
      const result = await analyzer.analyze(job.bitmap, { onProgress: (progress) => self.postMessage({ id: job.id, progress }) });
      self.postMessage({ id: job.id, result }, result.skin ? [result.skin.values.buffer, result.skin.face.buffer, result.skin.hair.buffer] : []);
    } else {
      const result = processPhoto(job.input);
      self.postMessage({ id: job.id, result }, [result.data.buffer, result.mask.buffer]);
    }
  } catch (error) {
    self.postMessage({ id: job.id, error: error.message || "Photo processing failed." });
  } finally {
    job.bitmap?.close();
  }
};
