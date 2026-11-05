function createNeuralClient() {
  let worker, pending, sequence = 0;
  function stop() {
    worker?.terminate();
    worker = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new DOMException("Cancelled", "AbortError"));
      pending = null;
    }
  }
  function run(input, onProgress) {
    if (typeof Worker === "undefined") throw new Error("AI cần trình duyệt có Web Workers.");
    if (pending) stop();
    worker ||= new Worker(new URL("./neural-worker.js", import.meta.url), { type: "module" });
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending = null;
        worker?.terminate();
        worker = null;
        reject(new Error("AI xử lý quá lâu. Thử ảnh hoặc vùng chọn nhỏ hơn."));
      }, 3e5);
      pending = { id, reject, timer };
      worker.onmessage = ({ data }) => {
        if (pending?.id !== data.id) return;
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
        const error = new Error("Không khởi chạy được AI. Thử Chrome/Edge hoặc ảnh nhỏ hơn.");
        clearTimeout(timer);
        pending = null;
        worker?.terminate();
        worker = null;
        reject(error);
      };
      worker.postMessage({ id, input });
    });
  }
  return { run, stop };
}
export {
  createNeuralClient
};
