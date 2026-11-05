import {assertCanEdit,canEdit} from './layer-policy.js';
import {scaleText} from './text-engine.js';
import {hasLayerEffects} from './layer-effects.js';
import { createLayer, clone, uid, moveLayer, clamp, MAX_PIXELS } from "./model.js";
function ancestors(d, l) {
  const out = [], seen = /* @__PURE__ */ new Set([l.id]);
  while (l.parentId) {
    l = d.layers.find((x) => x.id === l.parentId);
    if (!l || seen.has(l.id)) break;
    seen.add(l.id);
    out.push(l);
  }
  return out;
}
const effectiveVisible = (d, l) => l.visible && ancestors(d, l).every((x) => x.visible);
const effectiveLocked = (d, l) => l.locked || ancestors(d, l).some((x) => x.locked);
function children(d, id = null) {
  return d.layers.filter((l) => (l.parentId || null) === id);
}
function subtree(d, id) {
  return d.layers.filter((l) => l.id === id || ancestors(d, l).some((a) => a.id === id));
}
function selected(d) {
  const ids = d.selectedIds?.includes(d.activeId) ? d.selectedIds : [d.activeId];
  return d.layers.filter((l) => ids.includes(l.id));
}
function roots(d, list = selected(d)) {
  const ids = new Set(list.map((x) => x.id));
  return list.filter((l) => !ancestors(d, l).some((a) => ids.has(a.id)));
}
function selectLayer(d, id, { toggle = false, range = false } = {}) {
  const l = d.layers.find((x) => x.id === id);
  if (!l) return;
  let ids = selected(d).map((x) => x.id);
  if (range) {
    const a = d.layers.findIndex((x) => x.id === d.activeId), b = d.layers.indexOf(l);
    ids = d.layers.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id);
  } else if (toggle) {
    ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  } else ids = [id];
  d.selectedIds = ids;
  d.activeId = ids.includes(id) ? id : ids.at(-1) || null;
}
function bounds(list) {
  const rects = list.filter((l) => l.type !== "adjustment").map((l) => {
    const a = (l.rotation || 0) * Math.PI / 180, w = Math.abs(l.width * Math.cos(a)) + Math.abs(l.height * Math.sin(a)), h = Math.abs(l.width * Math.sin(a)) + Math.abs(l.height * Math.cos(a));
    return { x: l.x + (l.width - w) / 2, y: l.y + (l.height - h) / 2, width: w, height: h };
  });
  if (!rects.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...rects.map((l) => l.x)), y = Math.min(...rects.map((l) => l.y)), right = Math.max(...rects.map((l) => l.x + l.width)), bottom = Math.max(...rects.map((l) => l.y + l.height));
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}
function refreshGroups(d) {
  for (const g of d.layers.filter((l) => l.type === "group").sort((a, b) => ancestors(d, b).length - ancestors(d, a).length)) {
    const list = children(d, g.id).filter((l) => l.type !== "adjustment");
    if (list.length) Object.assign(g, bounds(list), { rotation: 0 });
  }
}
function moveObjects(d, list, dx, dy) {
  assertCanEdit(d,list,"geometry",{descendants:true});
  const ids = new Set(roots(d, list).flatMap((l) => subtree(d, l.id).map((x) => x.id)));
  for (const l of d.layers) if (ids.has(l.id)) moveLayer(l, dx, dy);
  refreshGroups(d);
}
function groupSelection(d) {
  const list = roots(d).filter((l) => !effectiveLocked(d, l));
  if (!list.length) throw new Error("Select unlocked layers to group.");
  if (d.layers.length >= 150) throw new Error("The project has reached 150 layers.");
  const parent = list[0].parentId || null;
  if (list.some((l) => (l.parentId || null) !== parent)) throw new Error("Group layers from the same parent first.");
  const ids = new Set(list.flatMap((l) => subtree(d, l.id).map((x) => x.id))), block = d.layers.filter((l) => ids.has(l.id)), at = Math.max(...list.map((l) => d.layers.indexOf(l)));
  const before = d.layers.slice(0, at + 1).filter((l) => !ids.has(l.id)).length;
  d.layers = d.layers.filter((l) => !ids.has(l.id));
  const g = createLayer("group", { name: "Group", parentId: parent, collapsed: false, ...bounds(list) });
  list.forEach((l) => l.parentId = g.id);
  d.layers.splice(before, 0, g, ...block);
  d.activeId = g.id;
  d.selectedIds = [g.id];
  refreshGroups(d);
  return g;
}
function ungroup(d) {
  const g = d.layers.find((l) => l.id === d.activeId);
  if (g?.type !== "group") throw new Error("Select a group to ungroup.");
  if (effectiveLocked(d, g)) throw new Error("Unlock the group before ungrouping.");
  if (g.mask || g.opacity !== 1 || g.filters?.length || hasLayerEffects(g) || (g.fillOpacity??1)!==1 || !["normal", "pass-through"].includes(g.blend) || g.clipToBelow) throw new Error("Remove the group mask, filters, styles and clipping; restore Normal or Pass-through blending at 100% before ungrouping.");
  const list = children(d, g.id);
  list.forEach((l) => l.parentId = g.parentId || null);
  d.layers = d.layers.filter((l) => l !== g);
  d.activeId = list.at(-1)?.id || d.layers.at(-1)?.id || null;
  d.selectedIds = list.map((l) => l.id);
}
function duplicateObjects(d) {
  const list = roots(d);
  const source = list.flatMap((l) => subtree(d, l.id));
  if (d.layers.length + source.length > 150) throw new Error("Duplication would exceed 150 layers.");
  const map = new Map(source.map((l) => [l.id, uid()])), copies = source.map((l) => {
    const c = clone(l);
    c.id = map.get(l.id);
    c.parentId = map.get(l.parentId) || l.parentId || null;
    c.name = l.name + " copy";c.locks={position:false,pixels:false,transparency:false};
    c.locked = false;
    moveLayer(c, 22, 22,{forceMask:true});
    return c;
  });
  const at = Math.max(...source.map((l) => d.layers.indexOf(l))) + 1;
  d.layers.splice(at, 0, ...copies);
  d.selectedIds = list.map((l) => map.get(l.id));
  d.activeId = d.selectedIds.at(-1);
  refreshGroups(d);
  return copies;
}
function deleteObjects(d) {
  const list = roots(d);
  if (list.some((l) => subtree(d, l.id).some((x) => effectiveLocked(d, x)))) throw new Error("Unlock selected layers and their contents before deleting.");
  const ids = new Set(list.flatMap((l) => subtree(d, l.id).map((x) => x.id)));
  d.layers = d.layers.filter((l) => !ids.has(l.id));
  d.activeId = d.layers.at(-1)?.id || null;
  d.selectedIds = d.activeId ? [d.activeId] : [];
  refreshGroups(d);
}
function reorderObject(d, id, targetId, { above = true, inside = false } = {}) {
  const l = d.layers.find((l2) => l2.id === id), target = d.layers.find((l2) => l2.id === targetId);
  if (!l || !target || l === target || subtree(d, id).some((x) => x === target)) return false;
  if (effectiveLocked(d, l) || effectiveLocked(d, target)) throw new Error("Unlock layers before reordering.");
  const block = subtree(d, id), ids = new Set(block.map((l2) => l2.id));
  d.layers = d.layers.filter((l2) => !ids.has(l2.id));
  if (inside && target.type === "group") {
    l.parentId = target.id;
    const end = Math.max(...subtree(d, target.id).map((x) => d.layers.indexOf(x)));
    d.layers.splice(end + 1, 0, ...block);
    target.collapsed = false;
  } else {
    l.parentId = target.parentId || null;
    const ts = subtree(d, target.id), at = above ? Math.max(...ts.map((x) => d.layers.indexOf(x))) + 1 : d.layers.indexOf(target);
    d.layers.splice(at, 0, ...block);
  }
  refreshGroups(d);
  return true;
}
function alignObjects(d, mode) {
  const list = roots(d).filter((l) => l.type !== "adjustment" && !effectiveLocked(d, l));
  if (!list.length) throw new Error("Select unlocked layers first.");
  assertCanEdit(d,list,"geometry",{descendants:true});
  const ref = list.length > 1 ? bounds(list) : { x: 0, y: 0, width: d.width, height: d.height };
  for (const l of list) {
    const r = bounds([l]);
    let dx = 0, dy = 0;
    if (mode === "left") dx = ref.x - r.x;
    if (mode === "right") dx = ref.x + ref.width - r.x - r.width;
    if (mode === "center-x") dx = ref.x + ref.width / 2 - r.x - r.width / 2;
    if (mode === "top") dy = ref.y - r.y;
    if (mode === "bottom") dy = ref.y + ref.height - r.y - r.height;
    if (mode === "center-y") dy = ref.y + ref.height / 2 - r.y - r.height / 2;
    moveObjects(d, [l], dx, dy);
  }
  refreshGroups(d);
}
function distribute(d, axis) {
  const list = roots(d).filter((l) => l.type !== "adjustment" && !effectiveLocked(d, l));
  if (list.length < 3) throw new Error("Select at least three unlocked layers to distribute.");
  assertCanEdit(d,list,"geometry",{descendants:true});
  const key = axis === "x" ? "x" : "y", dim = axis === "x" ? "width" : "height", sorted = list.map((l) => ({ l, r: bounds([l]) })).sort((a, b) => a.r[key] - b.r[key]), span = sorted.at(-1).r[key] + sorted.at(-1).r[dim] - sorted[0].r[key], gap = (span - sorted.reduce((n, x) => n + x.r[dim], 0)) / (sorted.length - 1);
  let pos = sorted[0].r[key];
  for (const { l, r } of sorted) {
    moveObjects(d, [l], axis === "x" ? pos - r.x : 0, axis === "y" ? pos - r.y : 0);
    pos += r[dim] + gap;
  }
}
function affineGeometry(d, list, { cx = 0, cy = 0, sx = 1, sy = sx, angle = 0, dx = 0, dy = 0 } = {}) {
  if (sx <= 0 || sy <= 0 || !Number.isFinite(sx + sy + angle + dx + dy)) throw new Error("Use positive, finite transform values.");
  assertCanEdit(d,list,"geometry",{descendants:true});
  const objects = roots(d, list).flatMap((l) => subtree(d, l.id));
  const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  for (const l of objects) {
    if (l.type === "group") continue;
    const w = l.width * sx, h = l.height * sy;
    if (w < 1 || h < 1 || w * h > MAX_PIXELS) throw new Error("The transformed layer exceeds supported dimensions.");
  }
  for (const l of objects) {
    const x = (l.x + l.width / 2 - cx) * sx, y = (l.y + l.height / 2 - cy) * sy, w = l.width * sx, h = l.height * sy;
    l.x = cx + x * c - y * s + dx - w / 2;
    l.y = cy + x * s + y * c + dy - h / 2;
    l.width = w;
    l.height = h;
    l.rotation = (l.rotation || 0) + angle;
    if (l.type === "text") scaleText(l,sx,sy);
  }
  refreshGroups(d);
  return objects;
}
function snapDelta(d, list, dx, dy, tolerance = 8) {
  const b = bounds(list), ids = new Set(list.flatMap((l) => subtree(d, l.id).map((x) => x.id))), other = d.layers.filter((l) => !ids.has(l.id) && l.type !== "adjustment" && l.type !== "group" && effectiveVisible(d, l)), xs = [0, d.width / 2, d.width, ...(d.guides || []).filter((g) => g.axis === "x").map((g) => g.position)], ys = [0, d.height / 2, d.height, ...(d.guides || []).filter((g) => g.axis === "y").map((g) => g.position)];
  for (const l of other) {
    const r = bounds([l]);
    xs.push(r.x, r.x + r.width / 2, r.x + r.width);
    ys.push(r.y, r.y + r.height / 2, r.y + r.height);
  }
  let bestX = tolerance, bestY = tolerance, gx = null, gy = null, ox = 0, oy = 0;
  for (const v of [b.x + dx, b.x + b.width / 2 + dx, b.x + b.width + dx]) for (const q of xs) {
    if (Math.abs(q - v) < bestX) {
      bestX = Math.abs(q - v);
      ox = q - v;
      gx = q;
    }
  }
  for (const v of [b.y + dy, b.y + b.height / 2 + dy, b.y + b.height + dy]) for (const q of ys) {
    if (Math.abs(q - v) < bestY) {
      bestY = Math.abs(q - v);
      oy = q - v;
      gy = q;
    }
  }
  return { dx: dx + ox, dy: dy + oy, guides: [...gx === null ? [] : [{ axis: "x", position: gx }], ...gy === null ? [] : [{ axis: "y", position: gy }]] };
}
export {
  affineGeometry,
  alignObjects,
  ancestors,
  bounds,
  children,
  deleteObjects,
  distribute,
  duplicateObjects,
  effectiveLocked,
  effectiveVisible,
  groupSelection,
  moveObjects,
  refreshGroups,
  reorderObject,
  roots,
  selectLayer,
  selected,
  snapDelta,
  subtree,
  ungroup
};
