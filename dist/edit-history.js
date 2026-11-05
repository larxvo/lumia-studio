// Snapshots use immutable image/mask buffers shared between entries. Callers
// replace buffers rather than modifying a buffer already put into history.
export function createEditHistory({ limit = 40, bytes = 64 * 1024 * 1024, strip = s => s } = {}) {
  let entries = [], index = -1, group = null;
  function size() { const seen = new Set(); let total = 0; function visit(v) { if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v); if (ArrayBuffer.isView(v)) { if (!seen.has(v.buffer)) { seen.add(v.buffer); total += v.buffer.byteLength; } } else if (v instanceof ArrayBuffer) total += v.byteLength; else for (const x of Object.values(v)) visit(x); } for (const e of entries) visit(e.state); return total; }
  function trim() { if (size() > bytes) for (let i = 0; i < entries.length; i++) if (i !== index) entries[i].state = strip(entries[i].state); while (entries.length > 2 && (entries.length > limit || size() > bytes)) { if (index > 0) { entries.shift(); index--; } else entries.pop(); } }
  return {
    reset(state) { entries = [{ state, label: 'Bắt đầu' }]; index = 0; group = null; },
    record(state, label = 'Chỉnh sửa', key = null) { entries.splice(index + 1); if (key && key === group && index > 0) entries[index] = { state, label }; else { entries.push({ state, label }); index++; } group = key; trim(); },
    replace(state) { if (index >= 0) entries[index].state = state; trim(); },
    endGroup() { group = null; },
    undo() { group = null; return index > 0 ? entries[--index].state : null; },
    redo() { group = null; return index + 1 < entries.length ? entries[++index].state : null; },
    canUndo: () => index > 0, canRedo: () => index + 1 < entries.length,
    clear() { entries = []; index = -1; group = null; },
    stats: () => ({ entries: entries.length, index, bytes: size() })
  };
}
export function bindEditorHistory(undo, redo, root = document) {
  const key = e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const name = String(e.key || '').toLowerCase(), target = e.target;
    if (target?.isContentEditable || target?.matches?.('textarea,input:not([type=range]):not([type=checkbox]):not([type=button])')) return;
    if (name !== 'z' && name !== 'y') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (name === 'y' || e.shiftKey) redo(); else undo();
  };
  root.addEventListener('keydown', key, true);
  return () => root.removeEventListener('keydown', key, true);
}
