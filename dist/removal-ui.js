import { selectKeeper, semanticPersonRegion } from './person-selection.js';
import { canvas } from './renderer.js';
import { clone, uid } from './model.js';
import { downloadBlob } from './storage.js';
import { createCutoutClient } from './cutout-client.js';
import { createNeuralClient } from './neural-client.js';
import { selectRemovalTarget } from './removal-selection.js';
import { REMOVAL_DEFAULTS, prepareRemovalMask, maskBounds } from './removal-math.js';
import { captureRemoval, removalSelection, applyRemoval } from './removal-workflow.js';
import { assertCutoutSource } from './cutout-workflow.js';
import { createEditHistory, bindEditorHistory } from './edit-history.js';
import { remainingPeople } from './subject-math.js';
import { regionPrompts } from './cutout-math.js';
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function encodeRegion(r) {
  const c = canvas(r.width, r.height), x = c.getContext('2d'), p = x.createImageData(r.width, r.height);
  for (let i = 0; i < r.values.length; i++) { p.data[i * 4] = p.data[i * 4 + 1] = p.data[i * 4 + 2] = 255; p.data[i * 4 + 3] = Math.round(r.values[i] * 255); }
  x.putImageData(p, 0, 0);
  return { source: c.toDataURL(), width: r.width, height: r.height, rect: clone(r.rect), points: clone(r.points || []), label: r.label || 'Đối tượng', groupId: r.groupId, nearby: !!r.nearby, person: !!r.person, semantic: !!r.semantic };
}
export function createRemovalStudio(api, { clientFactory = createCutoutClient, processorFactory = createNeuralClient, selector = selectRemovalTarget, keeperSelector = null } = {}) {
  let active = null;
  function cancel() { if (active) { active.close(); api.closeModal(true); } }
  async function open() {
    cancel();
    const doc = api.doc(), target = ['image', 'paint'].includes(api.layer?.()?.type) ? api.layer() : doc?.layers.filter(l => ['image', 'paint'].includes(l.type) && l.visible).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!target) {
      api.showModal('Xóa người & vật thể', 'Mở ảnh để bắt đầu', '<div class="remove-empty"><h3>Bấm vào vật muốn xóa.<br>Giữ lại khung cảnh.</h3><p>Tự chọn đối tượng, bảo vệ cây lá còn nhìn thấy và tái dựng nền tại vùng cần sửa. Bạn có thể chỉnh lại vùng xóa trước khi áp dụng.</p></div>', [{ label: 'Đóng', run: () => api.closeModal() }, { label: 'Mở ảnh', primary: true, run: () => { api.closeModal(); api.runAction('open'); } }]); return;
    }
    const snapshot = captureRemoval(doc, target), saved = target.removalRecipe, source = saved?.source || target.source, image = api.assets.get(source) || await api.assets.load(source), w = image.width, h = image.height;
    const cachedOutput = saved && target.source !== source ? api.assets.get(target.source) || await api.assets.load(target.source) : null;
    if(!w||!h) throw Error('Không đọc được kích thước ảnh gốc.');
    const original = canvas(w, h), ox = original.getContext('2d', { willReadFrequently: true }); ox.drawImage(image, 0, 0);
    const raw = ox.getImageData(0, 0, w, h).data, factor = Math.min(1, 1024 / Math.max(w, h)), preview = canvas(Math.round(w * factor), Math.round(h * factor)); preview.getContext('2d').drawImage(image, 0, 0, preview.width, preview.height);
    let selection = removalSelection(doc, target, api.assets, w, h);
    if (saved?.selectionSource) { const m = await api.assets.load(saved.selectionSource), c = canvas(w, h), x = c.getContext('2d'); x.drawImage(m, 0, 0, w, h); const p = x.getImageData(0, 0, w, h).data; selection = Float32Array.from({ length: w * h }, (_, i) => p[i * 4 + 3] / 255); }
    let regions = [], keepers = [], strokes = clone(saved?.strokes || []), settings = { ...REMOVAL_DEFAULTS, ...saved?.settings }, mounted = true, busy = false, sequence = 0, prepared = null, overlay = null, result = null, rendered = null, variants = [], detection = null, tool = 'point', autoErase = true, showMask = false, split = 50, zoom = 'fit', offset = { x: 0, y: 0 }, drawing = null, pan = null, brushSize = .018, chosen = -1, variant = saved?.variant || 0;
    for (const r of saved?.regions || []) {
      const m = await api.assets.load(r.source); if (m.width !== r.width || m.height !== r.height) throw Error('Mask đã lưu không khớp kích thước.');
      const c = canvas(r.width, r.height), x = c.getContext('2d'); x.drawImage(m, 0, 0); const p = x.getImageData(0, 0, c.width, c.height).data;
      regions.push({ ...clone(r), values: Float32Array.from({ length: c.width * c.height }, (_, i) => p[i * 4 + 3] / 255), groupId: r.groupId || uid(), masks: [] });
    }
    for (const r of saved?.keepers || []) { const im = await api.assets.load(r.source); if (im.width !== r.width || im.height !== r.height) throw Error('Mask người giữ không khớp.'); const c = canvas(r.width, r.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); const p = x.getImageData(0, 0, c.width, c.height).data; keepers.push({ ...clone(r), values: Float32Array.from({ length: c.width * c.height }, (_, i) => p[i * 4 + 3] / 255), masks: [] }); }
    const journal = createEditHistory({ strip: s => ({ ...s, result: null }) }); let unbindHistory = () => {};
    const client = clientFactory(), processor = processorFactory(), key = doc.id + ':' + target.id + ':' + uid();
    const state = { close() { mounted = false; sequence++; client.stop(); processor.stop(); unbindHistory(); journal.clear(); if (active === state) active = null; }, getState: () => ({ busy, regions, keepers, strokes, prepared, result, settings: clone(settings), detection, variant, history: journal.stats() }) }; active = state;
    const valid = token => mounted && token === sequence;
    function note(text, error = false) { if (mounted) { $('#remove-status').textContent = text; $('#remove-status').classList.toggle('is-error', error); } }
    function invalidate() { result = rendered = null; variants = []; }
    const snapshotEdit = () => ({ regions: regions.map(r => ({ ...r })), keepers: keepers.map(r => ({ ...r })), strokes: clone(strokes), settings: clone(settings), chosen, variant, result });
    function record(label, key = null) { journal.record(snapshotEdit(), label, key); sync(); }
    function moveHistory(forward = false) {
      if (!mounted) return; if (drawing) { strokes.push(drawing); drawing = null; record('Nét cọ'); }
      sequence++; client.stop(); processor.stop(); busy = false;
      const s = forward ? journal.redo() : journal.undo(); if (!s) { sync(); return; }
      regions = s.regions.map(r => ({ ...r })); keepers = s.keepers.map(r => ({ ...r })); strokes = clone(s.strokes); settings = clone(s.settings); chosen = s.chosen; variant = s.variant; invalidate();
      for (const k of ['foliage', 'branches', 'nearby', 'solid', 'audit']) $('#remove-' + k).checked = settings[k];
      $('#remove-quality').value = settings.quality;
      for (const el of document.querySelectorAll('[data-remove-param]')) { const k = el.dataset.removeParam; el.value = settings[k]; $('#remove-value-' + k).textContent = settings[k] + (k === 'detail' ? '%' : 'px'); }
      recalc(); if (s.result) { setResult(s.result); variants = [result]; } sync(); draw(); note(forward ? 'Đã làm lại vùng / thông số.' : 'Đã hoàn tác vùng / thông số. Ctrl+Shift+Z để làm lại.');
    }
    function sync() {
      if (!mounted) return;
      $('#remove-fields').inert = busy;
      $('#remove-people').disabled = busy; $('#remove-run').disabled = busy || !prepared?.bounds; $('#remove-alternative').disabled = busy || !result;
      $('#remove-clear').disabled = busy || !(regions.length || strokes.length || keepers.length); $('#remove-undo').disabled = !journal.canUndo(); $('#remove-redo').disabled = !journal.canRedo();
      $('#remove-people').textContent = keepers.length ? 'Xóa người còn lại' : 'Tự tìm & xóa người';
      $('#remove-keepers').innerHTML = keepers.length ? keepers.map((_, i) => `<span>✓ Giữ người ${i + 1}<button data-remove-unkeep='${i}' aria-label='Bỏ giữ người ${i + 1}' ${busy ? 'disabled' : ''}>×</button></span>`).join('') : '<p>Bấm Giữ người chính, rồi bấm vào người muốn giữ.</p>';
      for (const el of document.querySelectorAll('[data-remove-unkeep]')) el.onclick = () => { if (busy) return; keepers.splice(Number(el.dataset.removeUnkeep), 1); invalidate(); recalc(); record('Bỏ người giữ'); };
      $('#remove-stop').hidden = !busy; $('#remove-apply').disabled = busy || !result; $('#remove-export').disabled = busy || !result;
      $('#remove-run').textContent = busy ? 'Đang xử lý…' : 'Cập nhật nền';
      $('#remove-preview').setAttribute('aria-busy', String(busy));
      $('#remove-preview').style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
      $('#remove-summary').textContent = `${w.toLocaleString('vi-VN')} × ${h.toLocaleString('vi-VN')} px · giữ nguyên độ phân giải${selection ? ' · giới hạn theo vùng chọn' : ''}`;
      $('#remove-regions').innerHTML = regions.length ? regions.map((r, i) => `<div class="remove-region ${i === chosen ? 'active' : ''}"><button data-remove-region="${i}" ${busy ? 'disabled' : ''}><span>${i + 1}</span>${esc(r.label || 'Đối tượng')}</button><button data-remove-delete="${i}" aria-label="Bỏ vùng ${i + 1}" ${busy ? 'disabled' : ''}>×</button></div>`).join('') : '<p class="remove-no-region">Chưa chọn đối tượng. Bấm trực tiếp lên ảnh.</p>';
      const current = tool.startsWith('keeper') ? keepers.at(-1) : regions[chosen];
      $('#remove-boundaries').innerHTML = current?.masks?.length > 1 ? `<span>Chọn lại viền</span>${current.masks.map((_, i) => `<button data-remove-boundary="${i}" class="${current.best === i ? 'active' : ''}" ${busy ? 'disabled' : ''}>${i + 1}</button>`).join('')}` : '';
      $('#remove-variants').innerHTML = variants.length > 1 ? `<span>Phương án nền</span>${variants.map((v, i) => `<button data-remove-result="${i}" class="${v === result ? 'active' : ''}" ${busy ? 'disabled' : ''}>${v.variant + 1}</button>`).join('')}` : '';
      for (const b of document.querySelectorAll('[data-remove-tool]')) { b.classList.toggle('active', b.dataset.removeTool === tool); b.disabled = busy; }
      for (const b of document.querySelectorAll('[data-remove-region]')) b.onclick = () => { if (busy) return; chosen = Number(b.dataset.removeRegion); zoom = 'area'; offset = { x: 0, y: 0 }; sync(); draw(); };
      for (const b of document.querySelectorAll('[data-remove-delete]')) b.onclick = () => { if (busy) return; regions.splice(Number(b.dataset.removeDelete), 1); chosen = regions.length - 1; invalidate(); recalc(); record('Bỏ vùng xóa'); note('Đã bỏ vùng. Bấm Cập nhật nền để tạo lại.'); };
      for (const b of document.querySelectorAll('[data-remove-boundary]')) b.onclick = () => { if (busy || !current) return; current.best = Number(b.dataset.removeBoundary); current.values = current.masks[current.best]; invalidate(); recalc(); record('Đổi viền'); note('Đã đổi viền. Có thể sửa thêm bằng cọ rồi cập nhật nền.'); };
      for (const b of document.querySelectorAll('[data-remove-result]')) b.onclick = () => { if (busy) return; setResult(variants[Number(b.dataset.removeResult)]); record('Chọn phương án nền'); sync(); draw(); };
    }
    function recalc() {
      prepared = prepareRemovalMask(raw, w, h, regions, strokes, settings, keepers);
      if (selection) { for (let i = 0; i < prepared.mask.length; i++) prepared.mask[i] *= selection[i]; prepared.bounds = maskBounds(prepared.mask, w, h); }
      overlay = canvas(w, h); const x = overlay.getContext('2d'), p = x.createImageData(w, h);
      for (let i = 0; i < prepared.mask.length; i++) { const keep = prepared.protection[i] > .5; p.data[i * 4] = keep ? 100 : 255; p.data[i * 4 + 1] = keep ? 240 : 112; p.data[i * 4 + 2] = keep ? 185 : 107; p.data[i * 4 + 3] = keep ? 140 : prepared.mask[i] * 130; }
      x.putImageData(p, 0, 0); sync(); draw();
    }
    function viewRect() {
      let width = w, height = h, cx = w / 2, cy = h / 2;
      const r = tool.startsWith('keeper') ? keepers.at(-1) : regions[chosen], local = r ? maskBounds(r.values, r.width, r.height) : null;
      const b = local ? { x: (r.rect.x + local.x / r.width * r.rect.width) * w, y: (r.rect.y + local.y / r.height * r.rect.height) * h, width: local.width / r.width * r.rect.width * w, height: local.height / r.height * r.rect.height * h } : prepared?.bounds;
      if (zoom !== 'fit') { if (b) { cx = b.x + b.width / 2; cy = b.y + b.height / 2; } if (zoom === 'area' && b) { width = Math.min(w, Math.max(160, b.width * 2.1)); height = Math.min(h, Math.max(180, b.height * 1.8)); } else { width = w / (Number(zoom) || 2); height = h / (Number(zoom) || 2); } }
      return { x: Math.max(0, Math.min(w - width, cx - width / 2 + offset.x * w)), y: Math.max(0, Math.min(h - height, cy - height / 2 + offset.y * h)), width, height };
    }
    function draw() {
      if (!mounted) return;
      const c = $('#remove-preview'), v = viewRect(), s = Math.min(4, 1500 / Math.max(v.width, v.height)); c.width = Math.max(1, Math.round(v.width * s)); c.height = Math.max(1, Math.round(v.height * s)); const x = c.getContext('2d');
      x.drawImage(original, v.x, v.y, v.width, v.height, 0, 0, c.width, c.height);
      if (rendered) { x.save(); x.beginPath(); x.rect(c.width * split / 100, 0, c.width * (1 - split / 100), c.height); x.clip(); x.drawImage(rendered, v.x, v.y, v.width, v.height, 0, 0, c.width, c.height); x.restore(); }
      if (showMask && overlay) x.drawImage(overlay, v.x, v.y, v.width, v.height, 0, 0, c.width, c.height);
      if (drawing) { x.strokeStyle = drawing.mode === 'protect' ? '#9ae8bf' : '#ff9a85'; x.lineWidth = drawing.radius * Math.min(w, h) * 2 * s; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); drawing.points.forEach(([px, py], i) => i ? x.lineTo((px * w - v.x) * s, (py * h - v.y) * s) : x.moveTo((px * w - v.x) * s, (py * h - v.y) * s)); const p = drawing.points[0]; if (drawing.points.length === 1) x.lineTo((p[0] * w - v.x) * s + .1, (p[1] * h - v.y) * s); x.stroke(); }
      if (rendered && split > 0 && split < 100) { x.strokeStyle = '#f3fff8'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(c.width * split / 100, 0); x.lineTo(c.width * split / 100, c.height); x.stroke(); }
      $('#remove-zoom').value = zoom;
    }
    function setResult(value) { result = value; variant = value.variant; rendered = canvas(w, h); const x = rendered.getContext('2d'), p = x.createImageData(w, h); p.data.set(value.data); x.putImageData(p, 0, 0); }
    async function detect(token) {
      if (!detection) detection = await client.run(preview, { mode: 'detect', imageKey: key }, text => { if (valid(token)) note(text); });
      if (!valid(token)) throw new DOMException('Cancelled', 'AbortError'); return detection;
    }
    async function generateInternal(token, nextVariant = 0) {
      assertCutoutSource(api.doc(), snapshot); recalc(); if (!prepared.bounds) throw Error('Vùng xóa đang trống hoặc nằm ngoài vùng chọn.');
      showMask = true; $('#remove-mask').checked = true; draw();
      const value = await processor.run({ kind: 'remove', data: raw, width: w, height: h, mask: prepared.mask, excluded: prepared.excluded, settings: clone(settings), variant: nextVariant }, text => { if (valid(token)) note(text); });
      if (!valid(token)) return;
      assertCutoutSource(api.doc(), snapshot);
      const unchanged = result && result.data.length === value.data.length && result.data.every((v, i) => v === value.data[i]);
      let residual = null;
      if (settings.audit && regions.some(r => r.person || r.label === 'Người')) {
        try {
          const audit = canvas(preview.width, preview.height), ax = audit.getContext('2d'), full = canvas(w, h), fx = full.getContext('2d'), pixels = fx.createImageData(w, h); pixels.data.set(value.data); fx.putImageData(pixels, 0, 0); ax.drawImage(full, 0, 0, audit.width, audit.height);
          const d = await client.run(audit, { mode: 'detect', imageKey: key + ':audit' }, () => {}); if (!valid(token)) return;
          const ids = new Set((d.regions || []).filter(r => r.classId === 15).map(r => r.id)); let count = 0, human = 0;
          for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) { const i = Math.min(h - 1, Math.floor((y + .5) * h / d.height)) * w + Math.min(w - 1, Math.floor((x + .5) * w / d.width)); if (prepared.mask[i] > .1) { count++; if (ids.has(d.map[y * d.width + x])) human++; } }
          residual = human / (count || 1);
        } catch (e) { if (!valid(token)) return; }
      }
      const largeFill = prepared.bounds.count / (w * h) > .28;
      const item = { ...value, variant: nextVariant, stats: { ...value.stats, personResidualFraction: residual } }; variants = [...variants.filter(v => v.variant !== nextVariant), item].slice(w * h > 4194304 ? -1 : -3); setResult(item); journal.replace(snapshotEdit());
      showMask = false; $('#remove-mask').checked = false; draw();
      note(largeFill ? 'Vùng xóa chiếm phần lớn ảnh; nền thử có thể sai cấu trúc hoặc còn hình người. Soi kỹ và cân nhắc tư liệu tham chiếu trước khi áp dụng.' : residual > .06 ? 'Còn vùng được nhận như người trong phần vá. Thử nền khác hoặc sửa rộng vùng xóa trước khi áp dụng.' : unchanged ? 'Ngữ cảnh này cho kết quả giống phương án trước. Thử sửa vùng xóa hoặc độ nới viền.' : 'Đã tạo nền. Kiểm tra cấu trúc nền, viền và vùng người được giữ trước khi áp dụng.');
    }
    async function generate(next = 0) {
      if (busy || !mounted) return;
      busy = true; const token = ++sequence; sync();
      try { await generateInternal(token, next); } catch (e) { if (valid(token) && e.name !== 'AbortError') note(e.message, true); } finally { if (valid(token)) { busy = false; sync(); } }
    }
    async function choose(point, all = false) {
      if (busy || !mounted) return;
      busy = true; const token = ++sequence; sync(); note(all ? 'Đang tìm người trong ảnh…' : 'Đang chọn đối tượng bạn vừa bấm…');
      try {
        assertCutoutSource(api.doc(), snapshot);
        let d;
        try { d = await detect(token); } catch (e) { if (!valid(token) || e.name === 'AbortError' || all) throw e; }
        const proposals = all && keepers.length ? remainingPeople(d, keepers) : d;
        const people = all ? proposals.regions.filter(r => r.classId === 15) : null;
        if (all && !people.length) throw Error('Chưa nhận ra người đủ rõ. Bấm trực tiếp vào người hoặc vật thể cần xóa.');
        const points = all ? people.map(r => r.point) : [point], groupId = uid(), next = [];
        for (const p of points) {
          const proposal = all ? people[points.indexOf(p)] : null;
          const seeds = keepers.length ? [...(proposal ? regionPrompts(proposals, proposal) : [{ ...p, label: 1 }]), ...keepers.flatMap(r => (r.points || []).filter(q => q.label === 1).slice(0, 2).map(q => ({ ...q, label: 0 })))].slice(0, 24) : null;
          const found = all && proposal ? [semanticPersonRegion(proposals, proposal)] : await selector(original, preview, client, { point: p, points: seeds, detection: proposals, nearby: settings.nearby, imageKey: key, createCanvas: canvas, progress: text => { if (valid(token)) note(text); }, alive: () => valid(token) });
          if (!valid(token)) return;
          next.push(...found.map(r => ({ ...r, person: all || r.person || r.label === 'Người', groupId })));
          if (regions.length + next.length > 8) throw Error('Tối đa 8 vùng mỗi lượt. Bỏ bớt vùng hoặc áp lượt này trước.');
        }
        assertCutoutSource(api.doc(), snapshot);
        regions.push(...next); chosen = regions.length - next.length; invalidate(); recalc(); showMask = true; $('#remove-mask').checked = true; draw();
        record('Chọn vùng xóa');
        if (autoErase) await generateInternal(token, 0); else note('Đã chọn vùng. Kiểm tra vùng xóa / giữ rồi bấm Cập nhật nền.');
      } catch (e) { if (valid(token) && e.name !== 'AbortError') note(e.message, true); }
      finally { if (valid(token)) { busy = false; sync(); } }
    }
    async function chooseKeeper(point, negative = false, add = false) {
      if (busy || !mounted) return;
      const previous = negative || add ? keepers.at(-1) : null;
      if ((negative || add) && !previous) { note('Chọn người cần giữ trước.'); return; }
      if (!negative && !add && keepers.length >= 8) { note('Tối đa 8 vùng cần giữ.'); return; }
      busy = true; const token = ++sequence; sync(); note('Đang chọn riêng người cần giữ…');
      try {
        const seeds = previous ? [...previous.points, { ...point, label: negative ? 0 : 1 }].slice(-24) : [{ ...point, label: 1 }];
        const positive = seeds.find(p => p.label === 1); if (!positive) throw Error('Giữ ít nhất một điểm trên người chính.');
        const [r] = await (previous ? selector : keeperSelector || (selector === selectRemovalTarget ? selectKeeper : selector))(original, preview, client, { point: positive, points: previous ? seeds : undefined, nearby: false, detection: null, imageKey: key, createCanvas: canvas, progress: text => { if (valid(token)) note(text); }, alive: () => valid(token) });
        if (!valid(token)) return; assertCutoutSource(api.doc(), snapshot);
        const next = { ...r, points: r.points || seeds, label: 'Người giữ', person: true, groupId: previous?.groupId || uid() };
        if (previous) keepers[keepers.length - 1] = next; else keepers.push(next);
        invalidate(); recalc(); showMask = true; $('#remove-mask').checked = true; record('Giữ người chính'); draw(); note('Đã đánh dấu xanh vùng giữ. Kiểm tra cả đầu và tay. Dùng Thêm vào người giữ nếu thiếu hoặc Bỏ khỏi người giữ nếu chọn dính, rồi Xóa người còn lại.');
      } catch (e) { if (valid(token) && e.name !== 'AbortError') note(e.message, true); }
      finally { if (valid(token)) { busy = false; sync(); } }
    }
    function recipe() {
      const value = { version: 1, engine: 'lama-texture-v2', source, variant, settings: clone(settings), regions: regions.map(encodeRegion), keepers: keepers.map(encodeRegion), strokes: clone(strokes) };
      if (selection) { const c = canvas(w, h), x = c.getContext('2d'), p = x.createImageData(w, h); for (let i = 0; i < selection.length; i++) { p.data[i * 4] = p.data[i * 4 + 1] = p.data[i * 4 + 2] = 255; p.data[i * 4 + 3] = selection[i] * 255; } x.putImageData(p, 0, 0); value.selectionSource = c.toDataURL(); }
      return value;
    }
    function apply() {
      if (busy || !result) return;
      try { applyRemoval(api.doc(), snapshot, rendered, recipe(), api.assets); state.close(); api.closeModal(); api.commit(saved ? 'Sửa lại Xóa vật thể' : 'Xóa người & vật thể'); api.toast('Đã lưu layer riêng. Ảnh nguồn và thông số vẫn giữ để sửa lại.'); } catch (e) { note(e.message, true); }
    }
    api.showModal('Xóa người & vật thể', 'Bấm để xóa · giữ cảnh vật còn nhìn thấy · sửa lại bất cứ lúc nào', `<div class="remove-studio"><section class="remove-image-side"><div class="remove-image-heading"><span>${esc(target.name)}</span><select id="remove-zoom" aria-label="Thu phóng xóa vật thể"><option value="fit">Toàn ảnh</option><option value="area">Vùng đang sửa</option><option value="2">200%</option><option value="4">400%</option></select><span class="remove-local">TRÊN THIẾT BỊ</span></div><div class="remove-canvas-wrap"><canvas id="remove-preview" aria-label="Bấm vào người hoặc vật thể để xóa"></canvas></div><div class="lab-compare"><span>Gốc</span><input id="remove-split" type="range" min="0" max="100" value="50" aria-label="So sánh xóa vật thể"><span>Đã xóa</span></div><div class="remove-tools"><button data-remove-tool='keeper'>Giữ người chính</button><button data-remove-tool='keeper-add'>Thêm vào người giữ</button><button data-remove-tool='keeper-negative'>Bỏ khỏi người giữ</button><button data-remove-tool='point'>Bấm xóa</button><button data-remove-tool="erase">Tô thêm vùng xóa</button><button data-remove-tool="protect">Giữ chi tiết</button><button data-remove-tool="pan">Kéo ảnh</button><label>Cọ <input id="remove-brush-size" type="range" min=".3" max="12" value="1.8" step=".1" aria-label="Cỡ cọ xóa vật thể"></label></div><div class="remove-review-row"><label class="check-row"><input type="checkbox" id="remove-mask"> Hiện vùng xóa / giữ</label><span><i></i> Xóa <i class="keep"></i> Giữ</span><button id='remove-undo'>Hoàn tác · Ctrl Z</button><button id='remove-redo'>Làm lại</button><button id="remove-clear">Đặt lại</button></div><div id="remove-variants" class="remove-variants"></div><p id="remove-status" class="lab-status" role="status">Bấm vào người cần xóa. Nền sẽ được tạo sau khi chọn.</p><p id="remove-summary" class="remove-summary"></p><p class="remove-fine">Phần ngoài vùng xóa giữ nguyên pixel gốc. Cảnh bị che là phần AI dự đoán; kiểm tra viền, vật còn sót và cấu trúc nền.</p></section><aside class="remove-controls"><div class="remove-intro"><span>SMART REMOVE</span><h3>Giữ cảnh.<br>Xóa phần thừa.</h3><p>Một lần bấm để chọn và tạo nền. Có thể sửa vùng và thử phương án khác.</p></div><div class='remove-keeper-panel'><strong>GIỮ NGƯỜI CHÍNH</strong><div id='remove-keepers'></div></div><div id='remove-fields'><label class='modal-field'>Chất lượng nền<select id='remove-quality' aria-label='Chất lượng xóa người'><option value='deep'>Sâu · so sánh hai ngữ cảnh</option><option value='fast'>Nhanh · một ngữ cảnh</option></select></label><label class='check-row'><input type='checkbox' id='remove-audit' checked> Kiểm tra vùng còn giống người</label><label class="check-row remove-auto"><input id="remove-auto" type="checkbox" checked> Tự tạo nền sau khi bấm chọn</label><button id="remove-people" class="button">Tự tìm & xóa người</button><div class="remove-section-heading">VÙNG ĐANG XÓA <span>Tối đa 8</span></div><div id="remove-regions"></div><div id="remove-boundaries" class="remove-variants"></div><div class="remove-section-heading">GIỮ CHI TIẾT</div><label class="check-row"><input id="remove-foliage" type="checkbox" ${settings.foliage ? 'checked' : ''}> Giữ cây / lá xanh phía trước</label><label class="check-row"><input id="remove-branches" type="checkbox" ${settings.branches ? 'checked' : ''}> Giữ dây / cành sáng mảnh</label><p class="remove-fine">Với áo xanh hoặc chi tiết giữ sai, tắt mục này hay dùng cọ Tô thêm vùng xóa để ghi đè.</p><label class="check-row"><input id="remove-nearby" type="checkbox" ${settings.nearby ? 'checked' : ''}> Xóa kèm vật nhỏ sát đối tượng</label><label class="check-row"><input id="remove-solid" type="checkbox" ${settings.solid ? 'checked' : ''}> Xóa kín khoảng hở trong viền</label><p class="remove-fine">Kiểm tra lại đồ cầm, túi, bóng và hình phản chiếu. Vật sát nhau có thể cần bấm thêm.</p>${[['keepMargin', 'Bảo vệ thêm quanh người giữ', 12, 'px'], ['grow', 'Nới viền xóa', 12, 'px'], ['feather', 'Mềm mép vào trong', 4, 'px'], ['detail', 'Khớp kết cấu nền', 100, '%']].map(([k, name, max, unit]) => `<label class="lab-slider"><span>${name}</span><output id="remove-value-${k}">${settings[k]}${unit}</output><input type="range" data-remove-param="${k}" min="0" max="${max}" value="${settings[k]}" step="1" aria-label="${name}"></label>`).join('')}</div><button id="remove-run" class="button primary remove-generate">Cập nhật nền</button><button id="remove-alternative" class="button">Thử nền khác</button><button id="remove-stop" class="button" hidden>Dừng xử lý</button><p class="remove-fine">Xử lý AI có thể mất vài chục giây mỗi vùng. Chỉ vùng cần sửa đi qua mô hình; ảnh không gửi tới dịch vụ AI ngoài.</p></aside></div>`, [{ label: 'Hủy', run: () => api.closeModal(true) }, { label: saved ? 'Cập nhật layer' : 'Áp thành layer riêng', primary: true, run: apply }, { label: 'Xuất PNG nguyên độ phân giải', run: async () => { if (!result || busy) return; const blob = await new Promise(resolve => rendered.toBlob(resolve, 'image/png')); if (blob) downloadBlob(blob, 'luma-removed.png'); } }], () => {
      $('[data-modal-button="1"]').id = 'remove-apply'; $('[data-modal-button="2"]').id = 'remove-export';
      recalc();
      $('#remove-quality').value = settings.quality; $('#remove-audit').checked = settings.audit; $('#remove-run').onclick = () => generate(0); $('#remove-alternative').onclick = () => { record('Thử nền khác'); generate((variant + 1) % 3); }; $('#remove-people').onclick = () => choose(null, true);
      $('#remove-stop').onclick = () => { if (!busy) return; sequence++; client.stop(); processor.stop(); busy = false; note('Đã dừng. Ảnh nguồn chưa thay đổi; có thể chọn hoặc tạo lại.'); sync(); };
      $('#remove-mask').onchange = e => { showMask = e.target.checked; draw(); }; $('#remove-split').oninput = e => { split = Number(e.target.value); draw(); };
      $('#remove-zoom').onchange = e => { zoom = e.target.value; offset = { x: 0, y: 0 }; draw(); }; $('#remove-auto').onchange = e => { if (!busy) autoErase = e.target.checked; };
      for (const k of ['foliage', 'branches', 'nearby', 'solid', 'audit']) $('#remove-' + k).onchange = e => { if (busy) return; settings[k] = e.target.checked; if (k === 'nearby' && !settings.nearby) { regions = regions.filter(r => !r.nearby); chosen = regions.length - 1; } invalidate(); recalc(); record('Tùy chọn vùng'); note('Đã cập nhật vùng. Bấm Cập nhật nền để tạo lại.'); };
      for (const input of document.querySelectorAll('[data-remove-param]')) { const update = () => { if (busy) return; const k = input.dataset.removeParam; settings[k] = Number(input.value); $('#remove-value-' + k).textContent = input.value + (k === 'detail' ? '%' : 'px'); invalidate(); recalc(); record('Thông số xóa', k); note('Đã đổi thông số. Bấm Cập nhật nền để tạo lại.'); }; input.oninput = update; input.onchange = () => { if (Number(input.value) !== settings[input.dataset.removeParam]) update(); journal.endGroup(); }; } $('#remove-quality').onchange = e => { if (busy) return; settings.quality = e.target.value; invalidate(); record('Chất lượng nền'); };
      for (const b of document.querySelectorAll('[data-remove-tool]')) b.onclick = () => { if (busy) return; tool = b.dataset.removeTool; if (['erase', 'protect'].includes(tool)) { showMask = true; $('#remove-mask').checked = true; } sync(); draw(); };
      $('#remove-brush-size').oninput = e => brushSize = Number(e.target.value) / 100;
      $('#remove-clear').onclick = () => { if (busy) return; regions = []; keepers = []; strokes = []; chosen = -1; invalidate(); recalc(); record('Đặt lại'); note('Đã đặt lại. Bấm vào đối tượng để bắt đầu.'); };
      $('#remove-undo').onclick = () => moveHistory(); $('#remove-redo').onclick = () => moveHistory(true); unbindHistory = bindEditorHistory(() => moveHistory(), () => moveHistory(true));
      const c = $('#remove-preview'), point = e => { const r = c.getBoundingClientRect(), v = viewRect(); return { x: Math.max(0, Math.min(1, (v.x + (e.clientX - r.left) / r.width * v.width) / w)), y: Math.max(0, Math.min(1, (v.y + (e.clientY - r.top) / r.height * v.height) / h)) }; };
      c.onpointerdown = e => {
        if (busy || e.button && e.button !== 0) return;
        const p = point(e);
        if (tool === 'point') { choose(p); return; } if (tool.startsWith('keeper')) { chooseKeeper(p, tool === 'keeper-negative', tool === 'keeper-add'); return; }
        c.setPointerCapture(e.pointerId); e.preventDefault();
        if (tool === 'pan') { pan = { x: e.clientX, y: e.clientY, offset: { ...offset }, view: viewRect() }; return; }
        if (strokes.length >= 80 || strokes.reduce((n, s) => n + s.points.length, 0) >= 20000) { note('Tối đa 80 nét hoặc 20.000 điểm; bỏ bớt nét trước.', true); return; }
        drawing = { mode: tool, radius: brushSize, points: [[p.x, p.y]] }; draw();
      };
      c.onpointermove = e => {
        if (pan) { const r = c.getBoundingClientRect(); offset = { x: pan.offset.x - (e.clientX - pan.x) / r.width * pan.view.width / w, y: pan.offset.y - (e.clientY - pan.y) / r.height * pan.view.height / h }; draw(); return; }
        if (!drawing) return; const p = point(e), last = drawing.points.at(-1);
        if (Math.hypot(p.x - last[0], p.y - last[1]) > .002 && drawing.points.length < 2000 && drawing.points.length + strokes.reduce((n, s) => n + s.points.length, 0) < 20000) drawing.points.push([p.x, p.y]); draw();
      };
      c.onpointerup = () => { if (pan) { pan = null; return; } if (!drawing) return; strokes.push(drawing); drawing = null; invalidate(); recalc(); record('Nét cọ xóa / giữ'); if (autoErase) generate(0); else note('Đã sửa vùng. Bấm Cập nhật nền.'); };
      c.onpointercancel = () => { drawing = pan = null; draw(); };
      if (cachedOutput?.width === w && cachedOutput.height === h) {
        const c = canvas(w, h), x = c.getContext('2d'); x.drawImage(cachedOutput, 0, 0);
        setResult({ data: x.getImageData(0, 0, w, h).data, width: w, height: h, variant, stats: null }); variants = [result]; sync(); draw();
        note('Đã mở kết quả đã lưu. Đổi vùng / thông số rồi bấm Cập nhật nền để tạo lại.');
      } else if (regions.length || strokes.length) note('Đã mở lại vùng và thông số từ ảnh gốc. Bấm Cập nhật nền để dựng lại.');
      journal.reset(snapshotEdit()); sync();
    }, () => state.close());
    return state;
  }
  return { open, cancel, current: () => active };
}
