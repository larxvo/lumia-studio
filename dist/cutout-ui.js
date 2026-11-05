import { canvas } from './renderer.js';
import { downloadBlob } from './storage.js';
import { createCutoutClient } from './cutout-client.js';
import { refineAlpha, regionMask, regionPrompts } from './cutout-math.js';
import { alphaCanvas, applyCutouts, captureCutout, assertCutoutSource, localExistingMask } from './cutout-workflow.js';
import { createEditHistory, bindEditorHistory } from './edit-history.js';
import { smartRestore, decontaminate, nativeCutoutAlpha } from './subject-math.js';
import { selectPortrait } from './subject-selection.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MODES = { auto: ['Tách nền', 'Tự tìm chủ thể nổi bật', 'Tự tách nền'], portrait: ['Người & tóc', 'Alpha mềm cho chân dung', 'Tách chân dung & viền tóc'], hair: ['Chỉ vùng tóc', 'Tạo mask tóc riêng để sửa tiếp', 'Nhận diện & tách tóc'], point: ['Bấm vật thể', 'Bấm giữ, bấm bỏ vùng thừa', 'Cập nhật theo điểm'] };

export function createCutoutStudio(api, { clientFactory = createCutoutClient, portraitSelector = selectPortrait } = {}) {
  let active = null;
  const targets = () => api.doc()?.layers.filter(l => ['image', 'paint'].includes(l.type) && l.source) || [];
  function cancel() { if (active) { active.cancel(); api.closeModal(true); } active = null; }
  function open(initial = 'auto') {
    cancel();
    const list = targets();
    if (!list.length) {
      api.showModal('Tách nền & vật thể', 'Mở một ảnh để bắt đầu', '<div class="cutout-empty"><h3>Giữ chủ thể. Tự do đổi nền.</h3><p>Tách nền tự động, chọn vật thể bằng điểm bấm, giữ viền tóc và sửa mask bằng cọ. Mở ảnh của bạn hoặc thử ảnh mẫu.</p></div>', [{ label: 'Mở ảnh', run: () => { api.closeModal(); api.runAction('open'); } }, { label: 'Thử chân dung mẫu', primary: true, run: () => { api.closeModal(); api.runAction('cutout-sample'); } }]);
      return;
    }
    const client = clientFactory(), journal = createEditHistory(), session = { cancel: cleanup, getState: () => ({ base, points, strokes, busy, kept, options: options(), history: journal.stats() }) };
    let unbindHistory = () => {};
    active = session;
    let mounted = true, busy = false, version = 0, imageKey = '', mode = MODES[initial] ? initial : 'auto', image = null, sourceImage = null, snapshot = null, raw = null, base = null, matte = null, existingMask = null, method = '', name = '', points = [], variants = [], best = 0, strokes = [], drawing = null, detection = null, selectedRegion = null, kept = [], tool = 'point-add', zoom = 1, background = 'checker', view = 'cutout', boxes = true, refineTimer = null;
    function cleanup() { mounted = false; version++; clearTimeout(refineTimer); client.stop(); unbindHistory(); journal.clear(); if (active === session) active = null; }
    function note(text) { if (mounted) $('#cutout-status').textContent = text; }
    function count() { return kept.length + (matte ? 1 : 0); }
    function stateSnapshot() { return { mode, base, variants: [...variants], best, strokes: JSON.parse(JSON.stringify(strokes)), points: points.map(p => ({ ...p })), kept: [...kept], selectedRegion, name, method, options: options(), decontaminate: Number($('#cutout-decontaminate').value), native: $('#cutout-native').checked, hybrid: $('#cutout-hybrid').checked, combine: $('#cutout-combine').checked }; }
    function record(label, group = null) { if (mounted && image) { journal.record(stateSnapshot(), label, group); sync(); } }
    function moveHistory(forward = false) {
      if (!mounted || !image) return;
      if (drawing) { drawing = null; record('Nét cọ'); }
      version++; client.stop(); busy = false; clearTimeout(refineTimer);
      const s = forward ? journal.redo() : journal.undo(); if (!s) { sync(); return; }
      ({ mode, base, variants, best, selectedRegion, name, method } = s); strokes = JSON.parse(JSON.stringify(s.strokes)); points = s.points.map(p => ({ ...p })); kept = [...s.kept];
      for (const [k, id] of Object.entries({ grow: 'cutout-grow', feather: 'cutout-feather', contrast: 'cutout-contrast', guided: 'cutout-guided', invert: 'cutout-invert' })) { const el = $('#' + id); if (typeof s.options[k] === 'boolean') el.checked = s.options[k]; else el.value = s.options[k]; }
      $('#cutout-decontaminate').value = s.decontaminate; $('#cutout-native').checked = s.native; $('#cutout-hybrid').checked = s.hybrid; $('#cutout-combine').checked = s.combine; recalc(); renderRegions(); note(forward ? 'Đã làm lại thao tác trong mask.' : 'Đã hoàn tác trong mask. Ảnh gốc vẫn giữ.');
    }
    function sync() {
      if (!mounted) return;
      const n = count(), output = $('#cutout-output');
      $('#cutout-run').disabled = busy || !image || (mode === 'point' && !points.some(p => p.label === 1));
      $('#cutout-run').textContent = busy ? 'Đang xử lý trên thiết bị…' : MODES[mode][2];
      $('#cutout-detect').disabled = busy || !image;
      $('#cutout-cancel').hidden = !busy;
      $('#cutout-keep').disabled = busy || !matte || kept.length >= 8;
      $('#cutout-export').disabled = busy || !matte;
      $('#cutout-clear').disabled = busy || !image;
      $('#cutout-undo').disabled = !journal.canUndo(); $('#cutout-redo').disabled = !journal.canRedo();
      if (n > 1) output.value = 'copy';
      for (const option of output.querySelectorAll('option')) option.disabled = n > 1 && option.value !== 'copy';
      const apply = $('#cutout-apply');
      apply.disabled = busy || n < 1 || n > 8;
      apply.textContent = output.value === 'selection' ? 'Đặt làm vùng chọn' : output.value === 'mask' ? 'Áp mask vào layer' : n > 1 ? `Tạo ${n} layer đối tượng` : 'Tạo layer tách nền';
      $('#cutout-summary').textContent = image ? `${image.width} × ${image.height} px phân tích · nguồn ${sourceImage.width} × ${sourceImage.height} px` : 'Đang nạp ảnh…';
      $('#cutout-mode-hint').textContent = mode === 'point' ? 'Bấm lên vật thể cần giữ. Chọn Bỏ vùng rồi bấm phần nền còn thừa. Mỗi lần bấm sẽ cập nhật mask.' : mode === 'hair' ? 'Mask riêng cho tóc; vùng tóc được nhận diện rồi giới hạn bằng alpha chân dung. Kiểm tra phần tóc sáng, tóc mảnh và nền gần màu.' : mode === 'portrait' ? 'Dành cho người trong ảnh. Giữ alpha chuyển tiếp ở viền tóc; dùng cọ để sửa phần model bỏ sót.' : 'Tự chọn phần nổi bật trong ảnh. Với ảnh nhiều vật thể hoặc nền phức tạp, dùng Bấm vật thể để chọn đúng vùng.';
      document.querySelectorAll('[data-cutout-mode]').forEach(b => { b.classList.toggle('active', b.dataset.cutoutMode === mode); b.disabled = busy; b.setAttribute('aria-pressed', String(b.dataset.cutoutMode === mode)); });
      document.querySelectorAll('[data-cutout-tool]').forEach(b => { b.classList.toggle('active', b.dataset.cutoutTool === tool); b.disabled = busy; });
      document.querySelectorAll('.cutout-controls input[type="range"],.cutout-refine input').forEach(input => input.disabled = busy);
      $('#cutout-preview').classList.toggle('is-busy', busy);
      renderVariants(); renderKept();
    }
    function renderVariants() {
      const root = $('#cutout-variants');
      root.innerHTML = variants.length ? `<span>Phương án biên</span>${variants.map((_, i) => `<button class="${i === best ? 'active' : ''}" data-cutout-variant="${i}" ${busy ? 'disabled' : ''}>${i + 1}</button>`).join('')}` : '';
      root.querySelectorAll('[data-cutout-variant]').forEach(b => b.onclick = () => { if (busy) return; best = Number(b.dataset.cutoutVariant); base = variants[best].slice(); strokes = []; recalc(); record('Đổi viền'); });
    }
    function renderKept() {
      $('#cutout-kept').innerHTML = kept.length ? `<span>Đã giữ ${kept.length} / 8</span>${kept.map((cut, i) => `<button data-cutout-remove="${i}" aria-label="Bỏ đối tượng ${i + 1}">${esc(cut.name)} <b>×</b></button>`).join('')}` : '';
      document.querySelectorAll('[data-cutout-remove]').forEach(b => b.onclick = () => { if (busy) return; kept.splice(Number(b.dataset.cutoutRemove), 1); record('Bỏ đối tượng giữ'); sync(); });
    }
    function renderRegions() {
      $('#cutout-regions').innerHTML = detection?.regions.length ? `<div class="cutout-section-label">VÙNG ĐƯỢC NHẬN DIỆN <span>${detection.regions.length}</span></div><div class="cutout-region-grid">${detection.regions.map(r => `<button data-cutout-region="${r.id}" class="${r.id === selectedRegion ? 'active' : ''}"><span>${r.id}</span>${esc(r.label)}</button>`).join('')}</div><p class="cutout-fine">Các vật thể chạm nhau có thể gộp thành một vùng. Dùng điểm giữ / bỏ để tách tiếp.</p>` : '';
      document.querySelectorAll('[data-cutout-region]').forEach(b => b.onclick = () => chooseRegion(Number(b.dataset.cutoutRegion)));
    }
    function chooseRegion(id) {
      if (busy || !detection) return;
      const r = detection.regions.find(r => r.id === id);
      if (!r) return;
      selectedRegion = id; mode = 'point'; tool = 'point-add'; points = regionPrompts(detection, r);
      base = regionMask(detection, id, image.width, image.height); variants = []; strokes = []; name = r.label; method = detection.method;
      recalc(); renderRegions(); sync();
      record('Chọn vùng nhận diện');
      note(`Đã chọn vùng ${r.label}. Bấm Cập nhật theo điểm để tinh chọn bằng AI, hoặc sửa bằng cọ.`);
    }
    function alphaOf(c) {
      const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return Float32Array.from({ length: c.width * c.height }, (_, i) => p[i * 4 + 3] / 255);
    }
    function options() { return { grow: Number($('#cutout-grow').value), feather: Number($('#cutout-feather').value), contrast: Number($('#cutout-contrast').value), guided: $('#cutout-guided').checked, invert: $('#cutout-invert').checked }; }
    function paintStroke(c, stroke) {
      if (stroke.mode === 'smart') { const values = alphaOf(c); smartRestore(values, raw, image.width, image.height, stroke, 42); c.getContext('2d').putImageData(alphaCanvas(values, image.width, image.height).getContext('2d').getImageData(0, 0, image.width, image.height), 0, 0); return; }
      const x = c.getContext('2d'), radius = stroke.radius * Math.max(c.width, c.height);
      function stamp(p) {
        const px = p.x * c.width, py = p.y * c.height, gradient = x.createRadialGradient(px, py, radius * .65, px, py, radius);
        gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#ffffff00');
        x.fillStyle = gradient; x.fillRect(px - radius, py - radius, radius * 2, radius * 2);
      }
      x.save(); x.globalCompositeOperation = stroke.mode === 'subtract' ? 'destination-out' : 'source-over';
      let previous = null;
      for (const p of stroke.points) {
        if (previous) { const distance = Math.hypot((p.x - previous.x) * c.width, (p.y - previous.y) * c.height), steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * .3))); for (let i = 1; i <= steps; i++) stamp({ x: previous.x + (p.x - previous.x) * i / steps, y: previous.y + (p.y - previous.y) * i / steps }); }
        else stamp(p);
        previous = p;
      }
      x.restore();
    }
    function recalc() {
      if (!mounted || !image) return;
      if (!base) { matte = null; draw(); sync(); return; }
      matte = alphaCanvas(refineAlpha(base, image.width, image.height, options(), raw), image.width, image.height);
      for (const stroke of strokes) paintStroke(matte, stroke);
      $('#cutout-grow-value').textContent = $('#cutout-grow').value;
      $('#cutout-feather-value').textContent = $('#cutout-feather').value;
      $('#cutout-contrast-value').textContent = $('#cutout-contrast').value + '%';
      draw(); sync();
    }
    function draw() {
      if (!mounted || !image) return;
      const c = $('#cutout-preview'), w = image.width, h = image.height;
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      if (background === 'checker') {
        const size = Math.max(8, Math.round(Math.max(w, h) / 45));
        for (let y = 0; y < h; y += size) for (let px = 0; px < w; px += size) { x.fillStyle = (Math.floor(px / size) + Math.floor(y / size)) % 2 ? '#343d3b' : '#25302d'; x.fillRect(px, y, size, size); }
      } else { x.fillStyle = { white: '#fff', dark: '#101418', pink: '#d5a4b6' }[background]; x.fillRect(0, 0, w, h); }
      if ($('#cutout-ghost').checked && view === 'cutout' && matte) { x.globalAlpha = .22; x.drawImage(image, 0, 0); x.globalAlpha = 1; }
      if (view === 'mask' && matte) { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.drawImage(matte, 0, 0); }
      else if (!matte || view === 'original') x.drawImage(image, 0, 0);
      else {
        const cut = canvas(w, h), cx = cut.getContext('2d'), pixels = cx.createImageData(w, h); pixels.data.set(decontaminate(raw, alphaOf(matte), w, h, Number($('#cutout-decontaminate').value) / 100)); cx.putImageData(pixels, 0, 0); cx.globalCompositeOperation = 'destination-in'; cx.drawImage(matte, 0, 0);
        if ($('#cutout-combine').checked && existingMask) cx.drawImage(existingMask, 0, 0);
        if (view === 'overlay') { x.drawImage(image, 0, 0); cx.globalCompositeOperation = 'source-in'; cx.fillStyle = '#94f4bd'; cx.fillRect(0, 0, w, h); x.globalAlpha = .5; x.drawImage(cut, 0, 0); x.globalAlpha = 1; }
        else x.drawImage(cut, 0, 0);
      }
      if (boxes && detection && view !== 'mask') for (const region of detection.regions) {
        const b = region.bounds; x.strokeStyle = region.id === selectedRegion ? '#f6cc77' : '#c5efd9'; x.lineWidth = Math.max(1, w / 500); x.strokeRect(b.x * w, b.y * h, b.width * w, b.height * h); x.fillStyle = '#162b24e8'; x.fillRect(b.x * w, b.y * h, 22, 22); x.fillStyle = '#d7f4e3'; x.font = '13px sans-serif'; x.fillText(String(region.id), b.x * w + 6, b.y * h + 16);
      }
      if (mode === 'point' && !tool.startsWith('brush')) for (const p of points) { const r = Math.max(4, w / 100); x.fillStyle = p.label ? '#a8f0c7' : '#f09898'; x.strokeStyle = '#13211c'; x.lineWidth = Math.max(1, w / 600); x.beginPath(); x.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); x.fill(); x.stroke(); x.strokeStyle = '#14251d'; x.beginPath(); x.moveTo(p.x * w - r / 2, p.y * h); x.lineTo(p.x * w + r / 2, p.y * h); if (p.label) { x.moveTo(p.x * w, p.y * h - r / 2); x.lineTo(p.x * w, p.y * h + r / 2); } x.stroke(); }
      const wrap = $('#cutout-scroll'), fitted = Math.min(w, Math.max(180, wrap.clientWidth - 32), Math.max(180, wrap.clientHeight - 32) * w / h);
      c.style.width = Math.round(fitted * zoom) + 'px'; c.style.height = 'auto';
    }
    async function chooseSource(id) {
      client.stop(); busy = false; const v = ++version;
      image = sourceImage = snapshot = base = matte = detection = null; variants = []; points = []; strokes = []; kept = []; selectedRegion = null;
      renderRegions(); sync(); note('Đang mở layer ảnh…');
      try {
        const doc = api.doc(), layer = doc.layers.find(l => l.id === id); snapshot = captureCutout(doc, layer);
        const source = layer.cutoutRecipe?.source || layer.source, loaded = api.assets.get(source) || await api.assets.load(source);
        if (!mounted || v !== version) return;
        sourceImage = loaded; imageKey = `${snapshot.docId}:${snapshot.layerId}:${v}`;
        const scale = Math.min(1, 1024 / Math.max(loaded.width, loaded.height)); image = canvas(Math.round(loaded.width * scale), Math.round(loaded.height * scale)); image.getContext('2d').drawImage(loaded, 0, 0, image.width, image.height);
        raw = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
        existingMask = localExistingMask(doc, layer, api.assets, image.width, image.height);
        $('#cutout-combine-wrap').hidden = !layer.mask;
        $('#cutout-combine').checked = !layer.mask;
        $('#cutout-decontaminate').value = layer.cutoutRecipe?.decontaminate ?? 40;
        if (existingMask) { base = alphaOf(existingMask); for (const id of ['cutout-grow', 'cutout-feather', 'cutout-contrast']) $('#' + id).value = 0; $('#cutout-invert').checked = false; $('#cutout-guided').checked = false; recalc(); }
        journal.reset(stateSnapshot());
        note(existingMask ? 'Đang sửa mask hiện có từ ảnh gốc. Dùng Cọ khôi phục để lấy lại tay / vai bị lẹm; mask cũ không cắt lại vùng vừa phục hồi.' : 'Chọn cách tách rồi chạy AI. Có cọ khôi phục và Ctrl+Z / Ctrl+Shift+Z trong công cụ.');
        if (raw.some((v, i) => i % 4 === 3 && !v)) note('Ảnh nguồn có pixel trong suốt. Chỉ phục hồi được phần còn trong ảnh nguồn; mở ảnh gốc nếu phần đó đã bị xóa khỏi tệp.');
        draw(); sync();
      } catch (error) { if (mounted && v === version) note(error.message); }
    }
    async function infer(requested = mode) {
      if (!image || busy) return;
      try { assertCutoutSource(api.doc(), snapshot); } catch (e) { note(e.message); return; }
      busy = true; const v = ++version; sync(); note('Đang chuẩn bị AI…');
      if (requested !== 'detect') journal.record(stateSnapshot(), 'AI tách nền');
      try {
        const progress = text => { if (mounted && v === version) note(text); };
        const result = requested === 'portrait' || requested === 'auto' && $('#cutout-hybrid').checked ? await portraitSelector(sourceImage, image, client, { imageKey, progress, alive: () => { if (!mounted || v !== version) return false; assertCutoutSource(api.doc(), snapshot); return true; }, createCanvas: canvas }) : await client.run(image, { mode: requested, points, imageKey }, progress);
        if (!mounted || v !== version) return;
        assertCutoutSource(api.doc(), snapshot);
        if (requested === 'detect') {
          detection = result; selectedRegion = null;
          renderRegions();
          note(result.regions.length ? `Tìm thấy ${result.regions.length} vùng. Chọn một vùng trong danh sách để tách.` : 'Chưa nhận ra nhóm vật thể hỗ trợ. Chuyển sang Bấm vật thể để tự chỉ chủ thể.');
        } else {
          base = result.values; method = result.method; variants = result.masks || []; best = result.best || 0; strokes = []; name = requested === 'hair' ? 'Tóc' : requested === 'portrait' ? 'Chân dung' : requested === 'point' ? 'Vật thể' : 'Tách nền';
          if (!base?.some(v => v > .05)) { base = null; note('Chưa có vùng đủ rõ. Bấm vật thể hoặc tô bằng cọ để chọn đúng phần cần giữ.'); }
          else note('Đã tạo mask. Kiểm tra viền trên nền sáng / tối, sửa bằng cọ hoặc giữ đối tượng để tách tiếp.');
          recalc();
          journal.replace(stateSnapshot());
        }
        draw();
      } catch (error) { if (mounted && v === version && error.name !== 'AbortError') note(error.message); }
      finally { if (mounted && v === version) { busy = false; sync(); } }
    }
    function currentCut() { return matte ? { values: alphaOf(matte), width: image.width, height: image.height, name: name || 'Mask thủ công' } : null; }
    function cuts() { return [...kept, ...(matte ? [currentCut()] : [])]; }
    function nativeCut(cut) {
      const w = sourceImage.width, h = sourceImage.height, source = canvas(w, h), x = source.getContext('2d', { willReadFrequently: true }); x.drawImage(sourceImage, 0, 0);
      const data = x.getImageData(0, 0, w, h), values = nativeCutoutAlpha(cut.values, cut.width, cut.height, w, h, data.data, $('#cutout-native').checked), amount = Number($('#cutout-decontaminate').value);
      if (amount) { data.data.set(decontaminate(data.data, values, w, h, amount / 100)); x.putImageData(data, 0, 0); }
      const url = source.toDataURL(); api.assets.set(url, source); return { ...cut, width: w, height: h, values, source: url, decontaminate: amount };
    }
    function apply() {
      if (busy) return;
      try {
        clearTimeout(refineTimer); recalc();
        const all = cuts().map(nativeCut);
        if (all.some(c => !c.values.some(v => v > .01))) throw Error('Có mask trống. Tô thêm vùng hoặc bỏ đối tượng trống trước khi áp dụng.');
        applyCutouts(api.doc(), snapshot, all, api.assets, { output: $('#cutout-output').value, combine: $('#cutout-combine').checked });
        const label = $('#cutout-output').value === 'selection' ? 'Vùng chọn AI · chủ thể' : `Tách nền & vật thể · ${all.length} vùng`;
        cleanup(); api.closeModal(); api.commit(label); api.toast('Đã áp dụng. Ảnh nguồn được giữ; mask có thể sửa bằng Brush / Eraser.');
      } catch (error) { note(error.message); }
    }
    async function exportPNG() {
      if (!matte || busy) return;
      try {
        clearTimeout(refineTimer); recalc();
        assertCutoutSource(api.doc(), snapshot);
        const factor = 1, w = Math.round(sourceImage.width * factor), h = Math.round(sourceImage.height * factor), c = canvas(w, h), x = c.getContext('2d');
        const cut = nativeCut(currentCut()); x.drawImage(api.assets.get(cut.source), 0, 0, w, h); x.globalCompositeOperation = 'destination-in'; x.drawImage(alphaCanvas(cut.values, cut.width, cut.height), 0, 0, w, h);
        if ($('#cutout-combine').checked && snapshot.layer.mask) x.drawImage(localExistingMask(api.doc(), snapshot.layer, api.assets, w, h), 0, 0);
        const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
        if (blob) downloadBlob(blob, 'luma-cutout.png');
      } catch (error) { note(error.message); }
    }
    api.showModal('Tách nền & vật thể', 'Chọn nhanh. Giữ tóc mềm. Sửa tiếp bằng mask.', `<div class="cutout-studio"><section class="cutout-image-column"><div class="cutout-viewbar"><div><span class="live-pill">ON DEVICE · FREE</span><span id="cutout-summary"></span></div><select id="cutout-view" aria-label="Kiểu xem tách nền"><option value="cutout">Kết quả</option><option value="overlay">Vùng giữ</option><option value="mask">Mask đen / trắng</option><option value="original">Ảnh gốc</option></select></div><div class="cutout-scroll" id="cutout-scroll"><canvas id="cutout-preview" aria-label="Ảnh chọn vật thể và sửa mask tóc"></canvas></div><div class="cutout-preview-tools"><div class="cutout-backgrounds" aria-label="Nền kiểm tra viền"><button data-cutout-bg="checker" class="active" aria-label="Nền trong suốt">▦</button><button data-cutout-bg="white" aria-label="Nền trắng"></button><button data-cutout-bg="dark" aria-label="Nền tối"></button><button data-cutout-bg="pink" aria-label="Nền hồng"></button></div><label>Zoom <select id="cutout-zoom" aria-label="Phóng to viền"><option value="1">Vừa khung</option><option value="2">200%</option><option value="4">400%</option></select></label><label class="check-row"><input type="checkbox" id="cutout-boxes" checked> Khung vật thể</label></div><p id="cutout-status" class="cutout-status" role="status"></p><div id="cutout-variants" class="cutout-variants"></div><div id="cutout-regions"></div><div id="cutout-kept" class="cutout-kept"></div><div class="cutout-source-note">Xem riêng layer ảnh · mô hình ước lượng vùng, bạn duyệt và sửa trước khi áp dụng.</div></section><aside class="cutout-controls"><label class="modal-field">Layer nguồn<select id="cutout-source" aria-label="Layer ảnh cần tách">${list.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label><div class="cutout-mode-grid">${Object.entries(MODES).map(([id, text]) => `<button data-cutout-mode="${id}"><strong>${text[0]}</strong><small>${text[1]}</small></button>`).join('')}</div><p id="cutout-mode-hint" class="cutout-fine"></p><button class="button primary" id="cutout-run">Tự tách nền</button><div class="cutout-row"><button class="button" id="cutout-detect">Nhận diện vật thể</button><button class="button" id="cutout-cancel" hidden>Dừng AI</button></div><div class="cutout-section-label">SỬA VÙNG GIỮ</div><div class="cutout-tool-grid"><button data-cutout-tool="point-add">+ Điểm giữ</button><button data-cutout-tool="point-subtract">− Điểm bỏ</button><button data-cutout-tool="brush-add">Cọ khôi phục</button><button data-cutout-tool='brush-smart'>Khôi phục bám viền</button><button data-cutout-tool="brush-subtract">Cọ xóa</button></div><label class="lab-slider">Cỡ cọ<input id="cutout-brush-size" type="range" min=".5" max="8" step=".5" value="2" aria-label="Cỡ cọ mask"></label><div class="cutout-row"><button class="button" id="cutout-undo">Hoàn tác · Ctrl Z</button><button class='button' id='cutout-redo'>Làm lại · Ctrl Shift Z</button><button class="button" id="cutout-clear">Chọn lại</button></div><details class="cutout-refine" open><summary>Tinh chỉnh viền</summary><label class="lab-slider">Co / nới mép<output id="cutout-grow-value">0</output><input id="cutout-grow" type="range" min="-8" max="8" value="0" aria-label="Co hoặc nới mép mask"></label><label class="lab-slider">Mềm mép<output id="cutout-feather-value">0</output><input id="cutout-feather" type="range" min="0" max="8" value="0" aria-label="Độ mềm mép mask"></label><label class="lab-slider">Độ chắc mask<output id="cutout-contrast-value">0%</output><input id="cutout-contrast" type="range" min="0" max="90" value="0" aria-label="Độ chắc mask"></label><label class="check-row"><input type="checkbox" id="cutout-guided"> Bám theo viền ảnh</label><label class="check-row"><input type="checkbox" id="cutout-invert"> Đảo vùng giữ / bỏ</label></details><label class='check-row'><input id='cutout-hybrid' type='checkbox' checked> SAM toàn thân + viền tóc mềm</label><label class='check-row'><input id='cutout-native' type='checkbox' checked> Tinh viền theo pixel ảnh nguồn</label><label class='check-row'><input id='cutout-ghost' type='checkbox'> Hiện ảnh gốc dưới vùng khuyết</label><label class='lab-slider'>Giảm viền ám màu<input id='cutout-decontaminate' aria-label='Giảm viền ám màu' type='range' min='0' max='100' value='40'></label><button class="button" id="cutout-keep">Giữ đối tượng & chọn tiếp</button><label class="modal-field">Áp dụng thành<select id="cutout-output"><option value="copy">Layer riêng + mask sửa được</option><option value="mask">Mask trên layer hiện tại</option><option value="selection">Vùng chọn</option></select></label><label class="check-row" id="cutout-combine-wrap"><input type="checkbox" id="cutout-combine" checked> Kết hợp mask hiện có</label><button class="button" id="cutout-export">Tải PNG trong suốt</button><p class="cutout-fine">Không cần tài khoản, API key hay GPU riêng. Mô hình tải khi dùng; AI có thể bỏ sót tóc mảnh, vật trong suốt hoặc nền gần màu. Mask AI phân tích tối đa 1024 px, tinh viền trên ảnh nguồn khi áp dụng. Cọ khôi phục lấy pixel gốc; Ctrl+Z lùi cả nét, điểm, viền và thanh chỉnh.</p></aside></div>`, [{ label: 'Hủy', run: () => api.closeModal(true) }, { label: 'Tạo layer tách nền', primary: true, run: apply }], () => {
      $('[data-modal-button="1"]').id = 'cutout-apply';
      const selected = list.find(l => l.id === api.doc().activeId) || list.at(-1); $('#cutout-source').value = selected.id;
      $('#cutout-source').onchange = e => chooseSource(e.target.value);
      document.querySelectorAll('[data-cutout-mode]').forEach(b => b.onclick = () => { if (busy) return; if (mode !== b.dataset.cutoutMode) { base = matte = null; strokes = []; } mode = b.dataset.cutoutMode; points = []; variants = []; if (mode === 'point') tool = 'point-add'; record('Đổi chế độ'); sync(); draw(); });
      $('#cutout-run').onclick = () => infer(); $('#cutout-detect').onclick = () => infer('detect');
      $('#cutout-cancel').onclick = () => { version++; client.stop(); busy = false; note('Đã dừng AI. Kết quả chưa áp dụng vào tài liệu.'); sync(); };
      document.querySelectorAll('[data-cutout-tool]').forEach(b => b.onclick = () => { if (busy) return; tool = b.dataset.cutoutTool; if (tool.startsWith('point')) mode = 'point'; if (tool === 'brush-add' || tool === 'brush-smart') $('#cutout-ghost').checked = true; sync(); draw(); });
      document.querySelectorAll('[data-cutout-bg]').forEach(b => b.onclick = () => { background = b.dataset.cutoutBg; document.querySelectorAll('[data-cutout-bg]').forEach(a => a.classList.toggle('active', a === b)); draw(); });
      $('#cutout-view').onchange = e => { view = e.target.value; draw(); }; $('#cutout-zoom').onchange = e => { zoom = Number(e.target.value); draw(); }; $('#cutout-boxes').onchange = e => { boxes = e.target.checked; draw(); }; $('#cutout-combine').onchange = () => { draw(); record('Phạm vi mask'); }; $('#cutout-ghost').onchange = draw;
      for (const id of ['cutout-grow', 'cutout-feather', 'cutout-contrast', 'cutout-guided', 'cutout-invert', 'cutout-decontaminate', 'cutout-native', 'cutout-hybrid']) { $('#' + id).oninput = () => { if (busy) return; clearTimeout(refineTimer); recalc(); record('Thông số viền', id); }; $('#' + id).onchange = () => journal.endGroup(); }
      $('#cutout-output').onchange = sync;
      $('#cutout-clear').onclick = () => { if (busy) return; base = matte = null; points = []; strokes = []; variants = []; selectedRegion = null; renderRegions(); record('Chọn lại'); sync(); draw(); note('Chọn vùng mới; các đối tượng đã giữ vẫn còn.'); };
      $('#cutout-undo').onclick = () => moveHistory(); $('#cutout-redo').onclick = () => moveHistory(true); unbindHistory = bindEditorHistory(() => moveHistory(), () => moveHistory(true));
      $('#cutout-keep').onclick = () => { if (!matte || busy || kept.length >= 8) return; clearTimeout(refineTimer); recalc(); const cut = currentCut(); if (!cut.values.some(v => v > .01)) { note('Mask đang trống. Tô thêm vùng trước.'); return; } kept.push(cut); base = matte = null; points = []; strokes = []; variants = []; selectedRegion = null; mode = 'point'; tool = 'point-add'; renderRegions(); record('Giữ đối tượng'); sync(); draw(); note('Đã giữ đối tượng. Bấm chọn vật thể tiếp theo hoặc áp dụng các layer.'); };
      $('#cutout-export').onclick = exportPNG;
      const preview = $('#cutout-preview'), pos = e => { const r = preview.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
      preview.oncontextmenu = e => e.preventDefault();
      preview.onpointerdown = e => {
        if (!image || busy || ![0, 2].includes(e.button)) return; e.preventDefault();
        const p = pos(e);
        if (tool.startsWith('point')) {
          if (points.length >= 24) { note('Đã có 24 điểm. Lùi điểm hoặc Chọn lại để bắt đầu vùng mới.'); return; }
          mode = 'point'; points.push({ ...p, label: e.button === 2 || tool === 'point-subtract' ? 0 : 1 });
          sync(); draw(); if (points.some(p => p.label === 1)) infer('point'); else note('Thêm một Điểm giữ trên vật thể trước.');
        } else {
          if (!base) { base = new Float32Array(image.width * image.height); name = 'Mask thủ công'; }
          if (strokes.length >= 50) { note('Đã đạt 50 nét. Áp dụng mask để sửa tiếp trên canvas.'); return; }
          drawing = { mode: tool === 'brush-smart' ? 'smart' : tool === 'brush-subtract' ? 'subtract' : 'add', radius: Number($('#cutout-brush-size').value) / 100, points: [p] }; strokes.push(drawing); preview.setPointerCapture(e.pointerId); recalc();
        }
      };
      preview.onpointermove = e => { if (!drawing) return; if (drawing.points.length < (drawing.mode === 'smart' ? 96 : 1000)) { drawing.points.push(pos(e)); recalc(); } };
      preview.onpointerup = () => { if (drawing) { drawing = null; record('Nét cọ mask'); } }; preview.onpointercancel = () => { if (drawing) { strokes.pop(); drawing = null; recalc(); } };
      chooseSource(selected.id); sync();
    }, cleanup);
  }
  return { open, cancel, current: () => !!active, state: () => active?.getState() };
}
