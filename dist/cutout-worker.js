import * as ort from './vendor/ort/ort.wasm.min.mjs';
import { createCutoutEngine } from './cutout-inference.js';
ort.env.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.logLevel = 'error';
const engine = createCutoutEngine(ort);
self.onmessage = async ({ data: job }) => {
  try {
    const result = await engine.run(job.bitmap, { ...job.options, onProgress: progress => self.postMessage({ id: job.id, progress }) });
    const buffers = new Set([result.values?.buffer, result.map?.buffer, result.classMap?.buffer, ...(result.masks || []).map(m => m.buffer)].filter(Boolean));
    self.postMessage({ id: job.id, result }, [...buffers]);
  } catch (error) {
    self.postMessage({ id: job.id, error: error.message || 'Không tách được vùng ảnh này.' });
  } finally { job.bitmap?.close(); }
};
