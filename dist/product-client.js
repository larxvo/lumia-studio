export function createProductClient(module = './product-worker.js', title = 'retouch sản phẩm') {
  let worker = null, pending = null, sequence = 0;
  function stop() {
    sequence++; worker?.terminate(); worker = null;
    if (pending) { clearTimeout(pending.timer); pending.reject(new DOMException('Cancelled', 'AbortError')); pending = null; }
  }
  function run(input) {
    if (typeof Worker === 'undefined') throw Error('Retouch sản phẩm cần trình duyệt hỗ trợ Web Workers.');
    if (pending) throw Error('Đang xử lý bản xem trước.');
    worker ||= new Worker(new URL(module, import.meta.url), { type: 'module' });
    const id = ++sequence, current = worker;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (pending?.id === id) { pending = null; sequence++; worker?.terminate(); worker = null; reject(Error('Xử lý quá lâu. Thử ảnh nhỏ hơn.')); } }, 120000);
      pending = { id, reject, timer };
      worker.onmessage = ({ data }) => { if (pending?.id !== data.id || worker !== current) return; clearTimeout(timer); pending = null; if (data.error) reject(Error(data.error)); else resolve(data.result); };
      worker.onerror = () => { if (worker !== current) return; const job = pending; pending = null; worker?.terminate(); worker = null; if (job) { clearTimeout(job.timer); job.reject(Error('Không mở được trình xử lý ' + title + '.')); } };
      worker.postMessage({ id, input });
    });
  }
  return { run, stop };
}
