import { refineAlpha, resizeMask, semanticRegions } from './cutout-math.js';
import { placeRegion, expandMask } from './removal-math.js';
const clamp = v => Math.max(0, Math.min(1, v));
export function regionAlpha(region, w, h) { return placeRegion(new Float32Array(w * h), w, h, region); }
export function keeperMask(regions, w, h, margin = 3) { const out = new Float32Array(w * h); for (const r of regions) placeRegion(out, w, h, r); return expandMask(out, w, h, margin); }
export function remainingPeople(detection, keepers) {
  const { width: w, height: h, map, regions } = detection, keep = keeperMask(keepers, w, h, 1), labels = new Uint8Array(w * h), ids = new Set(regions.filter(r => r.classId === 15).map(r => r.id));
  for (let i = 0; i < labels.length; i++) if (ids.has(map[i]) && !keep[i]) labels[i] = 15;
  return semanticRegions(labels, w, h, { minArea: Math.max(12, Math.round(w * h * .0008)), limit: 12 });
}
export function fusePersonAlpha(matte, body, w, h) {
  if (matte.length !== w * h || body.length !== matte.length) throw Error('Invalid person alpha.');
  const hard = Float32Array.from(body, v => v > .55 ? 1 : 0), support = expandMask(hard, w, h, 3), inner = Float32Array.from(expandMask(Float32Array.from(hard, v => 1 - v), w, h, 2), v => 1 - v);
  return Float32Array.from(matte, (v, i) => inner[i] ? 1 : hard[i] ? Math.max(clamp(v), clamp((body[i] - .2) / .6)) : clamp(v) * support[i]);
}
// Color-connected restoration within a bounded brush. It only recovers pixels
// present in the source; hard restore is available where colors are ambiguous.
export function smartRestore(mask, rgba, w, h, stroke, tolerance = 42) {
  const r = Math.max(1, stroke.radius * Math.max(w, h)), seen = new Uint32Array(w * h), queue = new Int32Array(Math.min(w * h, Math.ceil((r * 2 + 3) ** 2))); let mark = 0;
  for (const p of stroke.points) {
    const cx = Math.max(0, Math.min(w - 1, Math.floor(p.x * w))), cy = Math.max(0, Math.min(h - 1, Math.floor(p.y * h))), seed = (cy * w + cx) * 4; mark++; let head = 0, tail = 1; queue[0] = cy * w + cx; seen[queue[0]] = mark;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = Math.floor(i / w), d = Math.hypot(x - cx, y - cy) / r, k = i * 4;
      if (d > 1 || Math.hypot(rgba[k] - rgba[seed], rgba[k + 1] - rgba[seed + 1], rgba[k + 2] - rgba[seed + 2]) > tolerance * 1.73 || !rgba[k + 3]) continue;
      mask[i] = Math.max(mask[i], clamp((1 - d) * 6));
      for (const j of [x ? i - 1 : -1, x + 1 < w ? i + 1 : -1, y ? i - w : -1, y + 1 < h ? i + w : -1]) if (j >= 0 && seen[j] !== mark) { seen[j] = mark; if (tail < queue.length) queue[tail++] = j; }
    }
  }
  return mask;
}
// Remove colored background contamination at partial-alpha edges using nearby
// opaque foreground, with bounded corrections. It never changes coverage.
export function decontaminate(source, alpha, w, h, amount = 0) {
  const out = new Uint8ClampedArray(source); if (!amount) return out;
  const radius = Math.min(8, Math.max(2, Math.round(Math.max(w, h) / 350)));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = alpha[i]; if (a <= .02 || a >= .98) continue;
    const sums = [0, 0, 0]; let total = 0;
    for (let dy = -radius; dy <= radius; dy += 2) for (let dx = -radius; dx <= radius; dx += 2) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (alpha[j] < .98) continue; const wt = 1 / (1 + dx * dx + dy * dy); total += wt; for (let c = 0; c < 3; c++) sums[c] += source[j * 4 + c] * wt; }
    if (total) for (let c = 0; c < 3; c++) out[i * 4 + c] += Math.max(-45, Math.min(45, sums[c] / total - source[i * 4 + c])) * (1 - a) * amount;
  }
  return out;
}
export function nativeCutoutAlpha(alpha, sw, sh, w, h, rgba, guided = true) {
  let out = resizeMask(alpha, sw, sh, w, h);
  // Work in narrow source tiles to bound guided-filter temporary memory.
  if (guided) {
    const input = out, refined = new Float32Array(out), tile = 384, overlap = 8;
    for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) {
      const x0 = Math.max(0, x - overlap), y0 = Math.max(0, y - overlap), x1 = Math.min(w, x + tile + overlap), y1 = Math.min(h, y + tile + overlap), tw = x1 - x0, th = y1 - y0, a = new Float32Array(tw * th), colors = new Uint8ClampedArray(tw * th * 4);
      let uncertain = false;
      for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) { const i = (yy + y0) * w + xx + x0, j = yy * tw + xx; a[j] = input[i]; if (a[j] > .001 && a[j] < .999) uncertain = true; colors.set(rgba.subarray(i * 4, i * 4 + 4), j * 4); }
      if (!uncertain) continue;
      const b = refineAlpha(a, tw, th, { guided: true }, colors);
      for (let yy = y; yy < Math.min(h, y + tile); yy++) for (let xx = x; xx < Math.min(w, x + tile); xx++) refined[yy * w + xx] = input[yy * w + xx] === 0 ? 0 : input[yy * w + xx] === 1 ? 1 : b[(yy - y0) * tw + xx - x0];
    }
    out = refined;
  }
  return out;
}
