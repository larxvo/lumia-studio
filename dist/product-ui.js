import { canvas } from './renderer.js';
import { clone, uid } from './model.js';
import { downloadBlob } from './storage.js';
import { alphaCanvas } from './cutout-workflow.js';
import { removalSelection } from './removal-workflow.js';
import { selectRemovalTarget } from './removal-selection.js';
import { createCutoutClient } from './cutout-client.js';
import { createProductClient } from './product-client.js';
import { productMask, autoProductParams } from './product-engine.js';
import { PRODUCT_DEFAULTS, PRODUCT_FIELDS, PRODUCT_PRESETS } from './product-settings.js';
import { captureProduct, assertProductSource, applyProduct } from './product-workflow.js';
import { maskBounds } from './removal-math.js';
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const SCENE_KEYS = ['exposure', 'shadows', 'highlights', 'depth', 'temperature', 'contact', 'background', 'vignette'];
const labelValue = (k, v) => (PRODUCT_FIELDS[k][2] < 1 ? Number(v).toFixed(2) : Math.round(v)) + PRODUCT_FIELDS[k][4];
function slider(k, p) { const [min, max, step, label] = PRODUCT_FIELDS[k]; return `<label class='product-slider'><span>${label}</span><output id='product-value-${k}'>${labelValue(k, p[k])}</output><input type='range' data-product-param='${k}' aria-label='${label}' min='${min}' max='${max}' step='${step}' value='${p[k]}'></label>`; }
function encodeRegion(r) { return { source: alphaCanvas(r.values, r.width, r.height).toDataURL(), width: r.width, height: r.height, rect: clone(r.rect), ...(r.point ? { point: clone(r.point) } : {}) }; }
export function createProductStudio(api, { clientFactory = createCutoutClient, processorFactory = createProductClient, selector = selectRemovalTarget } = {}) {
  let active = null;
  function cancel() { if (active) { active.close(); api.closeModal(true); } }
  async function open() {
    cancel();
    const doc = api.doc(), target = ['image', 'paint'].includes(api.layer?.()?.type) ? api.layer() : doc?.layers.filter(l => ['image', 'paint'].includes(l.type) && l.visible).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!target) { api.showModal('Retouch sản phẩm', 'Bạc sáng sạch · ánh sáng có chiều sâu', `<div class='product-empty'><span>PRODUCT STUDIO</span><h3>Cho chất liệu<br>được tỏa sáng.</h3><p>Mở ảnh, chọn kiểu retouch rồi bấm vào sản phẩm. Điều chỉnh lại màu bạc, phản quang và ánh sáng theo ý.</p></div>`, [{ label: 'Đóng', run: () => api.closeModal() }, { label: 'Mở ảnh', primary: true, run: () => { api.closeModal(); api.runAction('open'); } }]); return; }
    const snapshot = captureProduct(doc, target), saved = target.productRecipe, source = saved?.source || target.source, image = api.assets.get(source) || await api.assets.load(source), w = image.width, h = image.height;
    const cachedOutput = saved ? api.assets.get(target.source) || await api.assets.load(target.source) : null;
    if(!w||!h) throw Error('Kích thước ảnh sản phẩm không hợp lệ.');
    const original = canvas(w, h), ox = original.getContext('2d', { willReadFrequently: true }); ox.drawImage(image, 0, 0);
    const raw = ox.getImageData(0, 0, w, h).data, scale = Math.min(1, 1024 / Math.max(w, h)), preview = canvas(Math.round(w * scale), Math.round(h * scale)); preview.getContext('2d').drawImage(image, 0, 0, preview.width, preview.height);
    let selection = removalSelection(doc, target, api.assets, w, h);
    if (saved?.selectionSource) { const m = await api.assets.load(saved.selectionSource), c = canvas(w, h), x = c.getContext('2d'); x.drawImage(m, 0, 0, w, h); const data = x.getImageData(0, 0, w, h).data; selection = Float32Array.from({ length: w * h }, (_, i) => data[i * 4 + 3] / 255); }
    let region = null, strokes = clone(saved?.strokes || []), params = { ...PRODUCT_DEFAULTS, ...saved?.params }, preset = saved?.preset || 'silver', mask = new Float32Array(w * h), overlay = null, result = null, rendered = null, analysis = null, lowDetail = !!saved?.lowDetailWarning, mounted = true, selecting = false, rendering = false, ready = false, revision = 0, renderedRevision = -1, life = 0, timer = null, tool = 'point', split = 50, zoom = 'fit', offset = { x: 0, y: 0 }, brush = .018, showMask = false, drawing = null, pan = null, autoPending = false;
    if (saved?.region) { const r = saved.region, image = await api.assets.load(r.source); if (image.width !== r.width || image.height !== r.height) throw Error('Mask sản phẩm đã lưu không khớp kích thước.'); const c = canvas(r.width, r.height), x = c.getContext('2d'); x.drawImage(image, 0, 0); const p = x.getImageData(0, 0, c.width, c.height).data; region = { ...clone(r), values: Float32Array.from({ length: c.width * c.height }, (_, i) => p[i * 4 + 3] / 255), masks: [] }; }
    const client = clientFactory(), processor = processorFactory(), imageKey = doc.id + ':' + target.id + ':' + uid();
    const state = { close() { mounted = false; life++; revision++; clearTimeout(timer); client.stop(); processor.stop(); if (active === state) active = null; }, getState: () => ({ selecting, rendering, result, mask, region, strokes, params: clone(params), preset, analysis }) }; active = state;
    function note(text, error = false) { if (mounted) { $('#product-status').textContent = text; $('#product-status').classList.toggle('is-error', error); } }
    function invalidate() { revision++; result = null; renderedRevision = -1; sync(); }
    function sync() {
      if (!mounted) return;
      $('#product-fields').inert = selecting;
      $('#product-apply').disabled = selecting || rendering || !result || renderedRevision !== revision;
      $('#product-export').disabled = $('#product-apply').disabled;
      $('#product-auto').disabled = selecting || rendering || !region;
      $('#product-undo').disabled = selecting || rendering || !strokes.length;
      $('#product-clear').disabled = selecting || rendering || !region;
      $('#product-stop').hidden = !(selecting || rendering);
      $('#product-preview').setAttribute('aria-busy', String(selecting || rendering));
      $('#product-preview').style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
      $('#product-target').textContent = region ? '01 · Sản phẩm đã chọn' : 'Bấm vào đồng xu hoặc sản phẩm';
      $('#product-dimensions').textContent = w.toLocaleString('vi-VN') + ' × ' + h.toLocaleString('vi-VN') + ' px · nguyên độ phân giải' + (selection ? ' · theo vùng chọn' : '');
      $('#product-scope-note').textContent = params.scene ? 'Ánh sáng toàn ảnh đang bật. Màu bạc chỉ tác động trong vùng sản phẩm.' : 'Chỉ retouch sản phẩm. Pixel ngoài mask giữ nguyên từ ảnh nguồn.';
      $('#product-blur-note').hidden = !lowDetail;
      for (const k of SCENE_KEYS) $('[data-product-param=' + k + ']').disabled = !params.scene;
      for (const k of ['grow', 'feather']) $('[data-product-param=' + k + ']').disabled = selecting || rendering;
      for (const el of document.querySelectorAll('[data-product-tool]')) { el.classList.toggle('active', el.dataset.productTool === tool); el.disabled = selecting || rendering; }
      for (const el of document.querySelectorAll('[data-product-preset]')) el.classList.toggle('active', el.dataset.productPreset === preset);
      $('#product-boundaries').innerHTML = region?.masks?.length > 1 ? `<span>Viền sản phẩm</span>${region.masks.map((_, i) => `<button data-product-boundary='${i}' class='${region.best === i ? 'active' : ''}' ${selecting || rendering ? 'disabled' : ''}>${i + 1}</button>`).join('')}` : '';
      for (const el of document.querySelectorAll('[data-product-boundary]')) el.onclick = () => { if (selecting || rendering) return; region.best = Number(el.dataset.productBoundary); region.values = region.masks[region.best]; recalc(); schedule(); };
    }
    function syncParams() {
      if (!mounted) return;
      for (const k of Object.keys(PRODUCT_FIELDS)) { $('[data-product-param=' + k + ']').value = params[k]; $('#product-value-' + k).textContent = labelValue(k, params[k]); }
      $('#product-scene').checked = params.scene; sync();
    }
    function recalc() {
      mask = productMask(w, h, region, strokes, params, selection); ready = false; invalidate();
      overlay = canvas(w, h); const x = overlay.getContext('2d'), p = x.createImageData(w, h);
      for (let i = 0; i < mask.length; i++) { p.data[i * 4] = 135; p.data[i * 4 + 1] = 205; p.data[i * 4 + 2] = 255; p.data[i * 4 + 3] = mask[i] * 135; }
      x.putImageData(p, 0, 0); draw();
    }
    function viewRect() {
      const b = maskBounds(mask, w, h), z = $('#product-preview'), wrap = z?.parentElement;
      let width = w, height = h, cx = w / 2, cy = h / 2;
      if (zoom !== 'fit') {
        if (b) { cx = b.x + b.width / 2; cy = b.y + b.height / 2; }
        if (zoom === 'area' && b) { width = Math.min(w, Math.max(150, b.width * 2.4)); height = Math.min(h, Math.max(140, b.height * 2.4)); }
        else { width = w / (Number(zoom) || 2); height = h / (Number(zoom) || 2); }
        const aspect = wrap?.clientWidth && wrap?.clientHeight ? wrap.clientWidth / wrap.clientHeight : 1.35;
        if (width / height < aspect) width = Math.min(w, height * aspect); else height = Math.min(h, width / aspect);
      }
      return { x: clamp(cx - width / 2 + offset.x * w, 0, w - width), y: clamp(cy - height / 2 + offset.y * h, 0, h - height), width, height };
    }
    function draw() {
      if (!mounted) return;
      const c = $('#product-preview'), v = viewRect(), scale = Math.min(4, 1500 / Math.max(v.width, v.height)); c.width = Math.max(1, Math.round(v.width * scale)); c.height = Math.max(1, Math.round(v.height * scale)); const x = c.getContext('2d');
      x.drawImage(original, v.x, v.y, v.width, v.height, 0, 0, c.width, c.height);
      if (rendered) { x.save(); x.beginPath(); x.rect(c.width * split / 100, 0, c.width, c.height); x.clip(); x.drawImage(rendered, v.x, v.y, v.width, v.height, 0, 0, c.width, c.height); x.restore(); }
      if (showMask && overlay) x.drawImage(overlay, v.x, v.y, v.width, v.height, 0, 0, c.width, c.height);
      if (drawing?.points) { x.strokeStyle = drawing.add ? '#9ddcff' : '#ffb28c'; x.lineWidth = drawing.radius * Math.min(w, h) * 2 * scale; x.lineJoin = x.lineCap = 'round'; x.beginPath(); drawing.points.forEach(([px, py], i) => i ? x.lineTo((px * w - v.x) * scale, (py * h - v.y) * scale) : x.moveTo((px * w - v.x) * scale, (py * h - v.y) * scale)); const p = drawing.points[0]; if (drawing.points.length === 1) x.lineTo((p[0] * w - v.x) * scale + .1, (p[1] * h - v.y) * scale); x.stroke(); }
      if (drawing?.ellipse) { const [a, b] = drawing.ellipse; x.strokeStyle = '#a4dbff'; x.lineWidth = 2; x.beginPath(); x.ellipse(((a.x + b.x) * w / 2 - v.x) * scale, ((a.y + b.y) * h / 2 - v.y) * scale, Math.abs(b.x - a.x) * w / 2 * scale, Math.abs(b.y - a.y) * h / 2 * scale, 0, 0, Math.PI * 2); x.stroke(); }
      if (rendered && split > 0 && split < 100) { x.strokeStyle = '#eaf7ff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(c.width * split / 100, 0); x.lineTo(c.width * split / 100, c.height); x.stroke(); }
      $('#product-zoom').value = zoom;
    }
    function setResult(value) { if (value.width !== w || value.height !== h || value.data?.length !== w * h * 4) throw Error('Kết quả retouch không khớp ảnh nguồn.'); result = value; rendered = canvas(w, h); const x = rendered.getContext('2d'), p = x.createImageData(w, h); p.data.set(value.data); x.putImageData(p, 0, 0); }
    async function render() {
      clearTimeout(timer); timer = null;
      if (!mounted || selecting || rendering || !region) return;
      const token = life; rendering = true; sync(); note('Đang cân sắc độ, phản quang và ánh sáng…');
      try {
        assertProductSource(api.doc(), snapshot);
        if (!ready) { const out = await processor.run({ kind: 'prepare', data: raw, width: w, height: h, mask, selection }); if (!mounted || token !== life) return; analysis = out.analysis; lowDetail = !!analysis.blurred; ready = true; }
        if (autoPending) { params = autoProductParams(analysis, preset, params); autoPending = false; syncParams(); }
        const expected = revision, value = await processor.run({ kind: 'render', params: clone(params) });
        if (!mounted || token !== life || expected !== revision) return;
        assertProductSource(api.doc(), snapshot); setResult(value); renderedRevision = expected; draw();
        note('Đã retouch. Kéo so sánh, chỉnh lại thanh trượt rồi áp thành layer riêng.');
      } catch (e) { if (mounted && token === life && e.name !== 'AbortError') { note(e.message, true); ready = false; } }
      finally { if (mounted && token === life) { rendering = false; sync(); if (region && renderedRevision !== revision && !result && timer === null && !$('#product-status').classList.contains('is-error')) timer = setTimeout(render, 60); } }
    }
    function schedule(delay = 120) { invalidate(); clearTimeout(timer); timer = setTimeout(render, delay); }
    async function choose(point) {
      if (!mounted || selecting || rendering) return;
      selecting = true; const token = ++life; sync(); note('Đang chọn sản phẩm · lần đầu có thể mất 20–40 giây…');
      try {
        assertProductSource(api.doc(), snapshot);
        const [found] = await selector(original, preview, client, { point, nearby: false, imageKey, createCanvas: canvas, progress: text => { if (mounted && token === life) note(text); }, alive: () => mounted && token === life });
        if (!mounted || token !== life) return;
        region = { ...found, point }; strokes = []; autoPending = true; recalc(); showMask = false; $('#product-mask').checked = false;
      } catch (e) { if (mounted && token === life && e.name !== 'AbortError') note(e.message + ' Có thể dùng khoanh elip hoặc cọ để chọn vùng.', true); }
      finally { if (mounted && token === life) { selecting = false; sync(); if (autoPending) schedule(0); } }
    }
    function recipe() { const value = { version: 1, engine: 'product-tone-v1', source, preset, lowDetailWarning: lowDetail, params: clone(params), region: encodeRegion(region), strokes: clone(strokes) }; if (selection) value.selectionSource = alphaCanvasPortable(selection, w, h); return value; }
    function apply() { if (!result || selecting || rendering || renderedRevision !== revision) return; try { applyProduct(api.doc(), snapshot, rendered, recipe(), api.assets); state.close(); api.closeModal(); api.commit(saved ? 'Sửa lại Retouch sản phẩm' : 'Retouch sản phẩm'); api.toast('Đã lưu layer riêng cùng ảnh nguồn và thanh điều chỉnh.'); } catch (e) { note(e.message, true); } }
    api.showModal('Retouch sản phẩm', 'Bấm chọn · ánh bạc tự nhiên · chỉnh lại theo ý', `<div class='product-studio'><section class='product-image-side'><div class='product-image-heading'><span id='product-target'></span><select id='product-zoom' aria-label='Thu phóng retouch sản phẩm'><option value='fit'>Toàn ảnh</option><option value='area'>Soi sản phẩm</option><option value='2'>200%</option><option value='4'>400%</option></select><span class='product-local'>LOCAL · 6.5</span></div><div class='product-canvas-wrap'><canvas id='product-preview' aria-label='Bấm chọn sản phẩm cần retouch'></canvas><span class='product-view-label'>GỐC / RETOUCH</span></div><div class='lab-compare'><span>Gốc</span><input id='product-split' type='range' min='0' max='100' value='50' aria-label='So sánh retouch sản phẩm'><span>Retouch</span></div><div class='product-tools'><button data-product-tool='point'>Bấm chọn AI</button><button data-product-tool='ellipse'>Khoanh elip</button><button data-product-tool='add'>Tô thêm</button><button data-product-tool='subtract'>Bỏ vùng</button><button data-product-tool='pan'>Kéo ảnh</button></div><div class='product-review'><label class='check-row'><input id='product-mask' type='checkbox'> Xem vùng retouch</label><label>Cỡ cọ <input id='product-brush' type='range' min='.3' max='10' step='.1' value='1.8' aria-label='Cỡ cọ sản phẩm'></label><button id='product-undo'>Lùi nét</button><button id='product-clear'>Chọn lại</button></div><div id='product-boundaries' class='product-boundaries'></div><p id='product-status' class='product-status' role='status'>Chọn Bạc sáng sạch rồi bấm vào đồng xu. Luma tự chọn vùng và retouch.</p><p id='product-blur-note' class='product-blur-note' hidden>Vùng này ít chi tiết hoặc có thể mất nét. Làm sáng không khôi phục chữ hay hoa văn đã mờ.</p><p id='product-dimensions' class='product-fine'></p><p id='product-scope-note' class='product-fine'></p></section><aside class='product-controls'><div class='product-intro'><span>PRODUCT STUDIO</span><h3>Ánh bạc.<br>Giữ chất liệu.</h3><p>Chọn vật cần chỉnh. Ánh sáng, sắc độ và phản quang được cân lại từ ảnh gốc.</p></div><div id='product-fields'><div class='product-presets'>${PRODUCT_PRESETS.map(p => `<button data-product-preset='${p.id}'><strong>${p.name}</strong><small>${p.note}</small></button>`).join('')}</div>${slider('amount', params)}<div class='product-section-title'><span>01</span> SẢN PHẨM ĐƯỢC CHỌN</div>${['clean', 'neutral', 'objectExposure', 'contrast'].map(k => slider(k, params)).join('')}<details class='product-detail-settings'><summary>Chi tiết & hướng sáng</summary>${['detail', 'relight', 'angle'].map(k => slider(k, params)).join('')}<p class='product-fine'>Điều chỉnh sáng tối hai chiều từ pixel gốc; không tái dựng hình học, chữ hoặc hoa văn.</p></details><div class='product-section-title'><span>02</span> ÁNH SÁNG BỨC ẢNH</div><label class='check-row product-scene-check'><input id='product-scene' type='checkbox' ${params.scene ? 'checked' : ''}> Ánh sáng toàn ảnh</label>${['exposure', 'shadows', 'highlights', 'depth'].map(k => slider(k, params)).join('')}<details class='product-detail-settings'><summary>Màu, hậu cảnh & bóng</summary>${['temperature', 'contact', 'background', 'vignette'].map(k => slider(k, params)).join('')}<p class='product-fine'>Bóng tiếp xúc tăng phần tối đã có sát sản phẩm. Không vẽ thêm bóng đổ mới.</p></details><details class='product-detail-settings'><summary>Tinh chỉnh vùng chọn</summary>${['grow', 'feather'].map(k => slider(k, params)).join('')}<p class='product-fine'>Mỗi lượt chọn một sản phẩm. Bấm vật khác để thay vùng; cọ giúp sửa phần chọn thừa hoặc thiếu.</p></details><div class='product-actions'><button id='product-auto' class='button'>Tự cân lại</button><button id='product-reset' class='button'>Về ảnh gốc</button></div></div><button id='product-stop' class='button' hidden>Dừng xử lý</button><p class='product-fine product-bottom-note'>AI chọn vùng; màu và ánh sáng được xử lý trên thiết bị. Giảm ám ố không phân biệt chắc chắn lớp ten, bụi và hoa văn. Kiểm tra trước khi áp dụng.</p></aside></div>`, [{ label: 'Hủy', run: () => api.closeModal(true) }, { label: saved ? 'Cập nhật layer' : 'Áp thành layer riêng', primary: true, run: apply }, { label: 'Xuất PNG nguyên độ phân giải', run: async () => { if (!result || selecting || rendering || renderedRevision !== revision) return; const blob = await new Promise(resolve => rendered.toBlob(resolve, 'image/png')); if (blob) downloadBlob(blob, 'luma-product-retouch.png'); } }], () => {
      $('[data-modal-button="1"]').id = 'product-apply'; $('[data-modal-button="2"]').id = 'product-export';
      recalc(); syncParams();
      $('#product-split').oninput = e => { split = Number(e.target.value); draw(); };
      $('#product-zoom').onchange = e => { zoom = e.target.value; offset = { x: 0, y: 0 }; draw(); };
      $('#product-mask').onchange = e => { showMask = e.target.checked; draw(); };
      $('#product-brush').oninput = e => { brush = Number(e.target.value) / 100; };
      $('#product-scene').onchange = e => { if (selecting) return; params.scene = e.target.checked; sync(); schedule(); };
      for (const el of document.querySelectorAll('[data-product-param]')) el.oninput = () => { const k = el.dataset.productParam; if (selecting || rendering && (k === 'grow' || k === 'feather')) return; autoPending = false; params[k] = Number(el.value); $('#product-value-' + k).textContent = labelValue(k, params[k]); if (k === 'grow' || k === 'feather') recalc(); schedule(); };
      for (const el of document.querySelectorAll('[data-product-preset]')) el.onclick = () => { if (selecting) return; preset = el.dataset.productPreset; const value = PRODUCT_PRESETS.find(p => p.id === preset); params = analysis ? autoProductParams(analysis, preset, params) : { ...params, ...value.params }; syncParams(); if (region) schedule(); else note('Đã chọn ' + value.name + '. Bấm vào sản phẩm trên ảnh.'); };
      for (const el of document.querySelectorAll('[data-product-tool]')) el.onclick = () => { if (selecting || rendering) return; tool = el.dataset.productTool; if (tool === 'add' || tool === 'subtract') { showMask = true; $('#product-mask').checked = true; } sync(); draw(); };
      $('#product-auto').onclick = () => { if (selecting || rendering || !region) return; autoPending = true; schedule(0); };
      $('#product-reset').onclick = () => { if (selecting || rendering) return; params = { ...PRODUCT_DEFAULTS, scene: false }; for (const k of Object.keys(PRODUCT_FIELDS)) if (!['amount', 'angle', 'grow', 'feather'].includes(k)) params[k] = 0; syncParams(); schedule(0); };
      $('#product-clear').onclick = () => { if (selecting || rendering) return; region = null; strokes = []; result = rendered = analysis = null; clearTimeout(timer); recalc(); note('Bấm chọn sản phẩm khác hoặc khoanh vùng elip.'); };
      $('#product-undo').onclick = () => { if (selecting || rendering) return; strokes.pop(); recalc(); schedule(); };
      $('#product-stop').onclick = () => { life++; revision++; clearTimeout(timer); timer = null; client.stop(); processor.stop(); selecting = rendering = ready = autoPending = false; result = null; note('Đã dừng. Ảnh nguồn chưa thay đổi; có thể chỉnh thông số hoặc chọn lại.'); sync(); };
      const c = $('#product-preview'), point = e => { const b = c.getBoundingClientRect(), v = viewRect(); return { x: clamp((v.x + (e.clientX - b.left) / b.width * v.width) / w), y: clamp((v.y + (e.clientY - b.top) / b.height * v.height) / h) }; };
      c.onpointerdown = e => {
        if (selecting || rendering || e.button && e.button !== 0) return;
        const p = point(e); if (tool === 'point') { choose(p); return; }
        c.setPointerCapture(e.pointerId); e.preventDefault();
        if (tool === 'pan') { pan = { x: e.clientX, y: e.clientY, offset: { ...offset }, view: viewRect() }; return; }
        if (tool === 'ellipse') { drawing = { ellipse: [p, p] }; draw(); return; }
        if (!region) { note('Bấm chọn AI hoặc khoanh elip trước, rồi dùng cọ sửa vùng.', true); return; }
        if (strokes.length >= 80 || strokes.reduce((n, s) => n + s.points.length, 0) >= 20000) { note('Đã đạt giới hạn nét cọ. Lùi hoặc chọn lại vùng.', true); return; }
        drawing = { type: 'product', add: tool === 'add', radius: brush, points: [[p.x, p.y]] }; draw();
      };
      c.onpointermove = e => {
        if (pan) { const b = c.getBoundingClientRect(); offset = { x: pan.offset.x - (e.clientX - pan.x) / b.width * pan.view.width / w, y: pan.offset.y - (e.clientY - pan.y) / b.height * pan.view.height / h }; draw(); return; }
        if (!drawing) return; const p = point(e);
        if (drawing.ellipse) drawing.ellipse[1] = p;
        else if (drawing.points.length < 2000 && drawing.points.length + strokes.reduce((n, s) => n + s.points.length, 0) < 20000) { const last = drawing.points.at(-1); if (Math.hypot(p.x - last[0], p.y - last[1]) > .001) drawing.points.push([p.x, p.y]); } draw();
      };
      c.onpointerup = () => {
        if (pan) { pan = null; return; } if (!drawing) return;
        if (drawing.ellipse) {
          const [a, b] = drawing.ellipse, rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
          if (rect.width * w < 5 || rect.height * h < 5) { drawing = null; draw(); note('Kéo elip bao quanh đồng xu hoặc sản phẩm.', true); return; }
          const scale = Math.min(1, 1024 / Math.max(rect.width * w, rect.height * h)), rw = Math.max(1, Math.round(rect.width * w * scale)), rh = Math.max(1, Math.round(rect.height * h * scale)), values = Float32Array.from({ length: rw * rh }, (_, i) => ((i % rw + .5) / rw * 2 - 1) ** 2 + ((Math.floor(i / rw) + .5) / rh * 2 - 1) ** 2 <= 1 ? 1 : 0);
          region = { width: rw, height: rh, rect, values, masks: [] }; strokes = []; autoPending = true;
        } else strokes.push(drawing);
        drawing = null; recalc(); schedule();
      };
      c.onpointercancel = () => { drawing = pan = null; draw(); };
      if (saved && region) {
        const cached = cachedOutput;
        if (cached?.width === w && cached.height === h) { const c = canvas(w, h), x = c.getContext('2d'); x.drawImage(cached, 0, 0); setResult({ data: x.getImageData(0, 0, w, h).data, width: w, height: h }); renderedRevision = revision; sync(); draw(); note('Đã mở kết quả đã lưu. Kéo thanh trượt để chỉnh lại từ ảnh nguồn.'); }
        else schedule(0);
      }
    }, () => state.close());
    return state;
  }
  return { open, cancel, current: () => active };
}
function alphaCanvasPortable(alpha, w, h) { const c = canvas(w, h), x = c.getContext('2d'), p = x.createImageData(w, h); for (let i = 0; i < alpha.length; i++) { p.data[i * 4] = p.data[i * 4 + 1] = p.data[i * 4 + 2] = 255; p.data[i * 4 + 3] = alpha[i] * 255; } x.putImageData(p, 0, 0); return c.toDataURL(); }
