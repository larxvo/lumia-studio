// Keep the layer stack usable independently of the inspectors above it.
export function createDockLayout(dock, {getRatio, saveRatio}) {
  const upper = document.createElement('div');
  upper.className = 'dock-inspectors';
  upper.setAttribute('aria-label', 'Thuộc tính và điều hướng');
  upper.tabIndex = 0;
  const parts = ['#color-section', '.properties-tabs', '#properties', '.navigator-section'].map(s => dock.querySelector(s));
  dock.insertBefore(upper, parts[0]);
  parts.forEach(part => upper.append(part));

  const layers = dock.querySelector('.layers-section');
  layers.id = 'layer-dock';
  const divider = document.createElement('div');
  divider.className = 'dock-height-resizer';
  divider.tabIndex = 0;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'horizontal');
  divider.setAttribute('aria-label', 'Chiều cao bảng Lớp');
  divider.setAttribute('aria-controls', layers.id);
  divider.title = 'Kéo lên/xuống để đổi chiều cao bảng lớp · Nhấp đôi để đặt lại';
  dock.insertBefore(divider, layers);
  let height = 0, dragging = null;

  function bounds() {
    const available = Math.max(0, dock.clientHeight - divider.offsetHeight - dock.querySelector('.dock-footnote').offsetHeight);
    const max = Math.max(0, available - 72);
    return {available, min: Math.min(340, max), max};
  }
  function apply(value) {
    const b = bounds();
    if (!b.available) return;
    height = Math.max(b.min, Math.min(b.max, value));
    dock.style.setProperty('--layers-height', height + 'px');
    divider.setAttribute('aria-valuemin', String(Math.round(b.min)));
    divider.setAttribute('aria-valuemax', String(Math.round(b.max)));
    divider.setAttribute('aria-valuenow', String(Math.round(height)));
    divider.setAttribute('aria-valuetext', 'Bảng lớp cao ' + Math.round(height) + ' pixel');
  }
  function refresh() {
    if (dragging) return;
    const b = bounds(), ratio = getRatio();
    apply(typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 && ratio < 1
      ? b.available * ratio : Math.max(340, b.available * .54));
  }
  function persist() {
    const b = bounds();
    if (b.available) saveRatio(height / b.available);
  }
  function finish(cancelled = false) {
    if (!dragging) return;
    const id = dragging.id;
    dragging = null;
    dock.classList.remove('is-resizing-height');
    if (!cancelled) persist();
    if (divider.hasPointerCapture?.(id)) divider.releasePointerCapture(id);
    refresh();
  }
  divider.onpointerdown = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    divider.focus();
    dragging = {id: e.pointerId, y: e.clientY, height};
    divider.setPointerCapture(e.pointerId);
    dock.classList.add('is-resizing-height');
  };
  divider.onpointermove = e => {
    if (dragging && dragging.id === e.pointerId) apply(dragging.height + dragging.y - e.clientY);
  };
  divider.onpointerup = e => { if (dragging?.id === e.pointerId) finish(); };
  divider.onpointercancel = () => finish(true);
  divider.onlostpointercapture = () => finish(true);
  const reset = () => { saveRatio(null); refresh(); };
  divider.ondblclick = reset;
  divider.onkeydown = e => {
    const delta = {ArrowUp: 24, ArrowDown: -24, PageUp: 80, PageDown: -80}[e.key];
    if (delta === undefined && !['Home', 'End', 'Enter'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Enter') { reset(); return; }
    const b = bounds();
    apply(e.key === 'Home' ? b.min : e.key === 'End' ? b.max : height + delta);
    persist();
  };

  // Native scroll keys must scroll the focused panel rather than nudge artwork.
  for (const panel of [upper, ...dock.querySelectorAll('#layer-list, #history-list, #channels-panel, #paths-panel')]) {
    panel.tabIndex = 0;
    panel.setAttribute('role', 'region');
    if (!panel.hasAttribute('aria-label')) panel.setAttribute('aria-label', {
      'history-list': 'Lịch sử chỉnh sửa', 'channels-panel': 'Danh sách kênh', 'paths-panel': 'Danh sách đường'
    }[panel.id]);
    panel.addEventListener('keydown', e => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)
          && !e.target.closest('input, select, textarea, [contenteditable=true]')) e.stopPropagation();
    });
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(dock);
  refresh();
  return {refresh};
}
