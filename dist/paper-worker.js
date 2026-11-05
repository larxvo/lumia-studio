import { preparePaper, renderPaper } from './paper-engine.js';
let context = null;
self.onmessage = ({ data: job }) => { try { if (job.input.kind === 'prepare') { context = preparePaper(job.input); self.postMessage({ id: job.id, result: { analysis: context.analysis } }); } else if (job.input.kind === 'render' && context) { const result = renderPaper(context, job.input.params); self.postMessage({ id: job.id, result }, [result.data.buffer]); } else throw Error('Mở lại ảnh tài liệu.'); } catch (e) { self.postMessage({ id: job.id, error: e.message || 'Không xử lý được tài liệu.' }); } };
