let sequence = 0;
function createPhotoWorker(kind) {
  let worker = null, pending = null;
  const stop = () => {
    worker?.terminate();
    worker = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new DOMException("Cancelled", "AbortError"));
      pending = null;
    }
  };
  const run = async (input, onProgress) => {
    if (kind === "process" && typeof Worker === "undefined") {
      const { processPhoto } = await import("./portrait-engine.js");
      return processPhoto(input);
    }
    if (typeof Worker === "undefined") throw new Error("Nhận diện AI cần trình duyệt có Web Workers, như Chrome hoặc Edge mới.");
    if (pending) stop();
    worker ||= new Worker(new URL("./portrait-worker.js", import.meta.url), { type: "module" });
    const id = ++sequence, w = worker;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending?.id !== id) return;
        pending = null;
        w.terminate();
        if (worker === w) worker = null;
        reject(new Error("Xử lý quá lâu. Thử ảnh nhỏ hơn hoặc chạy lại."));
      }, 12e4);
      pending = { id, reject, timer };
      worker.onmessage = ({ data }) => {
        if (!pending || data.id !== pending.id) return;
        if (data.progress) {
          onProgress?.(data.progress);
          return;
        }
        clearTimeout(timer);
        pending = null;
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      };
      worker.onerror = () => {
        if (pending?.id !== id || worker !== w) return;
        clearTimeout(timer);
        pending = null;
        worker?.terminate();
        worker = null;
        reject(new Error("Không khởi chạy được bộ xử lý ảnh. Thử Chrome hoặc Edge mới."));
      };
      if (kind === "analyze") worker.postMessage({ id, kind, bitmap: input }, [input]);
      else worker.postMessage({ id, kind, input }, [input.data.buffer]);
    });
  };
  return { run, stop };
}
export {
  createPhotoWorker
};
