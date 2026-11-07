const STORAGE_KEY = 'luma.cursor.v1';
export const CURSOR_DEFAULTS = Object.freeze({enabled: true, glow: 65, size: 100});
const bounded = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
  ? Math.round(Math.max(min, Math.min(max, value))) : fallback;

export function cursorPreferences(value) {
  const p = value && typeof value === 'object' ? value : {};
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : CURSOR_DEFAULTS.enabled,
    glow: bounded(p.glow, CURSOR_DEFAULTS.glow, 0, 100),
    size: bounded(p.size, CURSOR_DEFAULTS.size, 75, 150)
  };
}

// A real CSS cursor image: its hotspot is the arrow tip, not a following overlay.
export function cursorArtwork(settings = CURSOR_DEFAULTS, hover = false) {
  const p = cursorPreferences(settings), width = Math.round(56 * p.size / 100);
  const alpha = Math.min(1, p.glow / 100 * (hover ? 1.15 : 1)).toFixed(3);
  const shape = 'M13 11 L13 35 L19 29 L24 40 L29 38 L24 28 L33 28 Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 56 56"><defs><filter id="glow" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.4"/></filter></defs><path d="${shape}" fill="none" stroke="#83efd2" stroke-width="4.2" stroke-linejoin="round" opacity="${alpha}" filter="url(#glow)"/><path d="${shape}" fill="#081510" stroke="#e3fff5" stroke-width="1.15" stroke-linejoin="round"/></svg>`;
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  const x = Math.round(13 * width / 56), y = Math.round(11 * width / 56);
  return {uri, width, x, y, css: `url("${uri}") ${x} ${y}, ${hover ? 'pointer' : 'default'}`};
}

export function createCursorTheme(api) {
  let preferences = {...CURSOR_DEFAULTS}, displayed;
  try { preferences = cursorPreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch {}
  const contrast = window.matchMedia?.('(forced-colors: active)');
  const root = document.documentElement;
  function apply(value) {
    displayed = cursorPreferences(value);
    const enabled = displayed.enabled && !contrast?.matches;
    root.dataset.lumaCursor = enabled ? 'mint' : 'system';
    if (enabled) {
      root.style.setProperty('--luma-cursor-default', cursorArtwork(displayed).css);
      root.style.setProperty('--luma-cursor-pointer', cursorArtwork(displayed, true).css);
    } else {
      root.style.removeProperty('--luma-cursor-default');
      root.style.removeProperty('--luma-cursor-pointer');
    }
  }
  contrast?.addEventListener?.('change', () => apply(displayed));
  apply(preferences);

  function open() {
    let draft = {...preferences};
    const $ = s => document.querySelector(s);
    function refresh() {
      const image = cursorArtwork(draft);
      $('#cursor-enabled').checked = draft.enabled;
      $('#cursor-glow').value = draft.glow;
      $('#cursor-size').value = draft.size;
      $('#cursor-glow').disabled = $('#cursor-size').disabled = !draft.enabled;
      $('#cursor-glow-value').textContent = draft.glow + '%';
      $('#cursor-size-value').textContent = draft.size + '%';
      for (const preview of document.querySelectorAll('[data-cursor-preview]')) {
        preview.src = image.uri;
        preview.style.width = image.width + 'px';
        preview.hidden = !draft.enabled;
      }
      for (const label of document.querySelectorAll('[data-system-cursor-label]')) label.hidden = draft.enabled;
      $('#cursor-state').textContent = contrast?.matches
        ? 'Đang dùng con trỏ hệ thống theo chế độ tương phản cao của máy.'
        : draft.enabled ? 'Con trỏ Luma · đang xem trước' : 'Con trỏ hệ thống';
      apply(draft);
    }
    api.showModal('Giao diện & con trỏ', 'Con trỏ Luma', `<section class="cursor-settings"><div class="cursor-preview-pair"><div class="cursor-preview-surface cursor-preview-dark"><span>NỀN TỐI</span><img data-cursor-preview alt="Con trỏ Luma trên nền tối"><small data-system-cursor-label hidden>Con trỏ hệ thống</small></div><div class="cursor-preview-surface cursor-preview-light"><span>NỀN SÁNG</span><img data-cursor-preview alt="Con trỏ Luma trên nền sáng"><small data-system-cursor-label hidden>Con trỏ hệ thống</small></div></div><label class="cursor-toggle"><span><strong>Dùng con trỏ Luma</strong><small>Mũi tên tối · viền sáng mint</small></span><input type="checkbox" id="cursor-enabled" aria-label="Dùng con trỏ Luma"></label><label class="cursor-setting-row" for="cursor-glow"><span>Độ sáng <output id="cursor-glow-value"></output></span><input id="cursor-glow" type="range" min="0" max="100" step="1" aria-label="Độ sáng con trỏ"></label><label class="cursor-setting-row" for="cursor-size"><span>Kích thước <output id="cursor-size-value"></output></span><input id="cursor-size" type="range" min="75" max="150" step="5" aria-label="Kích thước con trỏ"></label><p id="cursor-state" class="cursor-state" aria-live="polite"></p><p class="cursor-hint">Cọ vẽ, nhập chữ và kéo đổi kích thước giữ con trỏ riêng. Áp dụng trong giao diện biên tập Luma.</p></section>`, [
      {label: 'Mặc định', run: () => { draft = {...CURSOR_DEFAULTS}; refresh(); }},
      {label: 'Hủy', run: () => api.closeModal(true)},
      {label: 'Lưu', primary: true, run: () => {
        preferences = cursorPreferences(draft);
        apply(preferences);
        let saved = true;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { saved = false; }
        api.closeModal();
        api.toast(saved ? 'Đã lưu con trỏ Luma.' : 'Đã áp dụng cho phiên này. Bộ nhớ tùy chọn hiện không ghi được.', !saved);
      }}
    ], () => {
      $('#cursor-enabled').onchange = e => { draft.enabled = e.target.checked; refresh(); };
      $('#cursor-glow').oninput = e => { draft = cursorPreferences({...draft, glow: Number(e.target.value)}); refresh(); };
      $('#cursor-size').oninput = e => { draft = cursorPreferences({...draft, size: Number(e.target.value)}); refresh(); };
      refresh();
    }, () => apply(preferences));
  }
  return {
    actions: {'cursor-preferences': open},
    actionItems: [['cursor-preferences', 'Giao diện & con trỏ Luma', 'sliders', '']],
    open
  };
}
