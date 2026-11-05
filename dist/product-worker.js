import { prepareProduct, renderProduct } from './product-engine.js';
let context = null;
self.onmessage = ({ data: job }) => {
  try {
    if (job.input.kind === 'prepare') { context = prepareProduct(job.input); self.postMessage({ id: job.id, result: { analysis: context.analysis } }); }
    else if (job.input.kind === 'render' && context) { const result = renderProduct(context, job.input.params); self.postMessage({ id: job.id, result }, [result.data.buffer]); }
    else throw Error('Chọn lại vùng sản phẩm để bắt đầu.');
  } catch (e) { self.postMessage({ id: job.id, error: e.message || 'Không xử lý được retouch sản phẩm.' }); }
};
