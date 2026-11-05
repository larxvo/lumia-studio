export function createCutoutClient() {
  let worker = null, pending = null, sequence = 0;
  function stop() {
    sequence++;
    worker?.terminate(); worker = null;
    if (pending) { clearTimeout(pending.timer); pending.reject(new DOMException('Cancelled', 'AbortError')); pending = null; }
  }
  async function run(image, options, onProgress) {
    if (pending) throw Error('Đang xử lý một vùng ảnh.');
    if (typeof Worker === 'undefined') throw Error('Tách vật thể cần trình duyệt hỗ trợ Web Workers.');
    const id = ++sequence, bitmap = await createImageBitmap(image);
    if (id !== sequence) { bitmap.close?.(); throw new DOMException('Cancelled', 'AbortError'); }
    worker ||= new Worker(new URL('./cutout-worker.js', import.meta.url), { type: 'module' });
    const currentWorker = worker;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending?.id === id) { pending = null; worker?.terminate(); worker = null; reject(Error('Xử lý quá lâu. Thử ảnh nhỏ hơn hoặc khởi động lại công cụ.')); } }, 180000);
      pending = { id, reject, timer };
      worker.onmessage = ({ data }) => {
        if (pending?.id !== data.id || worker !== currentWorker) return;
        if (data.progress) { onProgress?.(data.progress); return; }
        clearTimeout(timer); pending = null;
        if (data.error) reject(Error(data.error)); else resolve(data.result);
      };
      worker.onerror = () => { if (worker !== currentWorker) return; const job = pending; pending = null; worker?.terminate(); worker = null; if (job) { clearTimeout(job.timer); job.reject(Error('Không khởi chạy được AI tách nền. Thử Chrome hoặc Edge mới.')); } };
      worker.postMessage({ id, bitmap, options }, [bitmap]);
    });
  }
  return { run, stop };
}
