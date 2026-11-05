import { limit, regionBounds } from "./face-geometry.js";
function fillPolygon(mask, w, h, points, value = 1, expansion = 1) {
  const b = regionBounds(points), ps = points.map((p) => ({ x: b.cx + (p.x - b.cx) * expansion, y: b.cy + (p.y - b.cy) * expansion })), min = Math.max(0, Math.floor(Math.min(...ps.map((p) => p.y)))), max = Math.min(h - 1, Math.ceil(Math.max(...ps.map((p) => p.y))));
  for (let y = min; y <= max; y++) {
    const crossings = [];
    for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
      const a = ps[i], b2 = ps[j];
      if (a.y > y + 0.5 !== b2.y > y + 0.5) crossings.push(a.x + (y + 0.5 - a.y) * (b2.x - a.x) / (b2.y - a.y));
    }
    crossings.sort((a, b2) => a - b2);
    for (let k = 0; k < crossings.length; k += 2) for (let x = Math.max(0, Math.floor(crossings[k])); x < Math.min(w, Math.ceil(crossings[k + 1])); x++) mask[y * w + x] = value;
  }
}
function sampleMask(values, mw, mh, x, y, w, h) {
  if (!values) return 0;
  const sx = limit((x + 0.5) * mw / w - 0.5, 0, mw - 1), sy = limit((y + 0.5) * mh / h - 0.5, 0, mh - 1), x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(mw - 1, x0 + 1), y1 = Math.min(mh - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
  return (values[y0 * mw + x0] * (1 - fx) + values[y0 * mw + x1] * fx) * (1 - fy) + (values[y1 * mw + x0] * (1 - fx) + values[y1 * mw + x1] * fx) * fy;
}
function paintMask(mask, w, h, strokes = [], type = "skin") {
  for (const stroke of strokes) {
    if (stroke.type !== type) continue;
    const radius = Math.max(1, stroke.radius * Math.min(w, h)), points = stroke.points.map(([x, y]) => [x * w, y * h]);
    const stamp = (cx, cy) => {
      for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(h, Math.ceil(cy + radius)); y++) for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(w, Math.ceil(cx + radius)); x++) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (distance > 1) continue;
        const weight = limit((1 - distance) * 4, 0, 1), i = y * w + x;
        mask[i] = stroke.add ? mask[i] + (1 - mask[i]) * weight : mask[i] * (1 - weight);
      }
    };
    for (let k = 0; k < points.length; k++) {
      const a = points[Math.max(0, k - 1)], b = points[k], n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, radius * 0.35)));
      for (let step = 1; step <= n; step++) stamp(a[0] + (b[0] - a[0]) * step / n, a[1] + (b[1] - a[1]) * step / n);
    }
  }
  return mask;
}
export { fillPolygon, sampleMask, paintMask };
