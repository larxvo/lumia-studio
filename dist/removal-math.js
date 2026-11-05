import { sample } from './cutout-math.js';
import { paintMask, fillPolygon } from './portrait-masks.js';
import { boxBlur } from './filters.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const REMOVAL_DEFAULTS = { grow: 8, feather: 1, foliage: true, branches: true, detail: 40, nearby: true, solid: true, quality: 'deep', keepMargin: 3, audit: true };
export function solidRegion(region) {
  const { values, width: w, height: h } = region, points = [];
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 1024 || h > 1024 || w * h > 1048576 || values?.length !== w * h || values.some(v => !Number.isFinite(v))) throw Error('Vùng đối tượng không hợp lệ.');
  for (let y = 0; y < h; y++) { let left = w, right = -1; for (let x = 0; x < w; x++) if (values[y * w + x] > .42) { left = Math.min(left, x); right = x; } if (right >= 0) points.push({ x: left, y }, { x: right + 1, y: y + 1 }); }
  if (points.length < 3) return region;
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lower = [], upper = [];
  for (const p of points) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of points.slice().reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop(); const hull = [...lower, ...upper], out = new Float32Array(values);
  if (hull.length >= 3) fillPolygon(out, w, h, hull);
  return { ...region, values: out };
}
export function checkRemovalPixels(data, w, h, mask) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || data.length !== w * h * 4 || mask && (mask.length !== w * h || mask.some(v => !Number.isFinite(v) || v < 0 || v > 1))) throw Error('Kích thước ảnh hoặc mask xóa vật thể không hợp lệ.');
}
export function maskBounds(mask, w, h, threshold = .1) {
  let x = w, y = h, right = 0, bottom = 0, count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > threshold) {
    const xx = i % w, yy = Math.floor(i / w); x = Math.min(x, xx); y = Math.min(y, yy); right = Math.max(right, xx + 1); bottom = Math.max(bottom, yy + 1); count++;
  }
  return count ? { x, y, width: right - x, height: bottom - y, right, bottom, count } : null;
}
export function placeRegion(target, w, h, region) {
  const { values, width: rw, height: rh, rect = { x: 0, y: 0, width: 1, height: 1 } } = region;
  if (!Number.isInteger(rw) || !Number.isInteger(rh) || rw < 1 || rh < 1 || rw * rh > 1048576 || values.length !== rw * rh || values.some(v => !Number.isFinite(v)) || [rect.x, rect.y, rect.width, rect.height].some(v => !Number.isFinite(v)) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1.000001 || rect.y + rect.height > 1.000001) throw Error('Vùng đối tượng không hợp lệ.');
  const left = rect.x * w, top = rect.y * h, ww = rect.width * w, hh = rect.height * h;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, Math.ceil(top + hh)); y++) for (let x = Math.max(0, Math.floor(left)); x < Math.min(w, Math.ceil(left + ww)); x++) {
    const a = clamp(sample(values, rw, rh, (x + .5 - left) * rw / ww - .5, (y + .5 - top) * rh / hh - .5));
    target[y * w + x] = Math.max(target[y * w + x], a);
  }
  return target;
}
function distanceToZero(mask, w, h, edgeIsZero = true) {
  const d = new Float32Array(mask.length), max = w + h;
  const border = edgeIsZero ? 1 : max;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; d[i] = !mask[i] ? 0 : Math.min(x ? d[i - 1] + 1 : border, y ? d[i - w] + 1 : border, x && y ? d[i - w - 1] + 1.4142 : max, x + 1 < w && y ? d[i - w + 1] + 1.4142 : max); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], x + 1 < w ? d[i + 1] + 1 : border, y + 1 < h ? d[i + w] + 1 : border, x + 1 < w && y + 1 < h ? d[i + w + 1] + 1.4142 : max, x && y + 1 < h ? d[i + w - 1] + 1.4142 : max); }
  return d;
}
export function expandMask(input, w, h, radius) {
  const binary = Uint8Array.from(input, a => a > .42 ? 1 : 0);
  if (!radius) return Float32Array.from(binary);
  const inverse = Uint8Array.from(binary, a => 1 - a), d = distanceToZero(inverse, w, h, false);
  return Float32Array.from(binary, (a, i) => a || d[i] <= radius ? 1 : 0);
}
function green(a, k) {
  const r = a[k], g = a[k + 1], b = a[k + 2], max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max > 22 && g > r * 1.035 && g > b * 1.10 && g - (r + b) / 2 > 10 && (max - min) / max > .14;
}
// Conservative foreground hints, not semantic truth. A green component must
// connect to visible context outside the object; isolated green clothing is
// not protected. Users can disable this or override it with a brush.
export function foregroundProtection(data, w, h, erase, { foliage = true, branches = true } = {}) {
  const out = new Float32Array(w * h), b = maskBounds(erase, w, h);
  if (!b || !foliage) return out;
  const pad = Math.max(16, Math.round(Math.min(w, h) * .02)), x0 = Math.max(0, b.x - pad), y0 = Math.max(0, b.y - pad), x1 = Math.min(w, b.right + pad), y1 = Math.min(h, b.bottom + pad), rw = x1 - x0, rh = y1 - y0, n = rw * rh;
  const candidates = new Uint8Array(n), bright = new Uint8Array(n), seen = new Uint8Array(n), queue = new Int32Array(n);
  const L = (x, y) => { const k = (clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4; return .2126 * data[k] + .7152 * data[k + 1] + .0722 * data[k + 2]; };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y - y0) * rw + x - x0, k = (y * w + x) * 4;
    if (green(data, k)) candidates[i] = 1;
    if (branches && x > 3 && y > 3 && x < w - 4 && y < h - 4 && L(x, y) > 65) {
      const center = L(x, y);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const a = L(x - dy * 3, y + dx * 3), z = L(x + dy * 3, y - dx * 3);
        if (center - Math.max(a, z) < 9) continue;
        let coherent = 0;
        for (const t of [-3, -2, 2, 3]) if (Math.abs(L(x + dx * t, y + dy * t) - center) < 24) coherent++;
        if (coherent >= 3) { bright[i] = 1; break; }
      }
    }
  }
  function connected(field, thin = false) {
    seen.fill(0);
    for (let start = 0; start < n; start++) {
      if (!field[start] || seen[start]) continue;
      let head = 0, tail = 1, outside = 0, inside = 0, minX = rw, minY = rh, maxX = 0, maxY = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      queue[0] = start; seen[start] = 1;
      while (head < tail) {
        const p = queue[head++], x = p % rw, y = Math.floor(p / rw), i = (y + y0) * w + x + x0;
        if (erase[i] < .01) outside++; else inside++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        if (thin) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy, j = yy * rw + xx; if (xx >= 0 && yy >= 0 && xx < rw && yy < rh && !seen[j] && field[j]) { seen[j] = 1; queue[tail++] = j; } }
      }
      const span = Math.max(maxX - minX + 1, maxY - minY + 1);
      const vx = sxx / tail - (sx / tail) ** 2, vy = syy / tail - (sy / tail) ** 2, covariance = sxy / tail - sx * sy / tail ** 2, disc = Math.sqrt((vx - vy) ** 2 + 4 * covariance ** 2), major = (vx + vy + disc) / 2, minor = Math.max(.01, (vx + vy - disc) / 2);
      if (outside < (thin ? 5 : 3) || inside < 1 || tail < (thin ? 20 : 4) || thin && (span < 25 || tail / span > 4.5 || major / minor < 16)) continue;
      for (let k = 0; k < tail; k++) { const p = queue[k], i = (Math.floor(p / rw) + y0) * w + p % rw + x0; if (erase[i]) out[i] = 1; }
    }
  }
  connected(candidates); if (branches) connected(bright, true);
  return out;
}
export function prepareRemovalMask(data, w, h, regions, strokes = [], settings = {}, keepers = []) {
  checkRemovalPixels(data, w, h);
  if (!Array.isArray(regions) || regions.length > 8) throw Error('Tối đa 8 vùng đối tượng.');
  const p = { ...REMOVAL_DEFAULTS, ...settings }, union = new Float32Array(w * h);
  for (const [k, max] of [['grow', 12], ['feather', 4], ['detail', 100]]) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > max) throw Error('Thiết lập xóa vật thể không hợp lệ.');
  for (const k of ['foliage', 'branches', 'nearby', 'solid']) if (typeof p[k] !== 'boolean') throw Error('Thiết lập xóa vật thể không hợp lệ.');
  if (!['deep', 'fast'].includes(p.quality) || !Number.isFinite(p.keepMargin) || p.keepMargin < 0 || p.keepMargin > 12 || typeof p.audit !== 'boolean') throw Error('Thiết lập xóa vật thể không hợp lệ.');
  for (const r of regions) placeRegion(union, w, h, p.solid && !r.semantic ? solidRegion(r) : r);
  const nearbyGreens = new Uint8Array(w * h);
  // A carried container can have disconnected visible fragments behind leaves.
  // In the optional nearby-object mode, clean a bounded area around that small
  // proposal while keeping strongly green visible foreground pixel-for-pixel.
  // This is explicitly a reviewable cleanup region, not amodal segmentation.
  if (p.nearby && p.solid) for (const r of regions.filter(r => r.nearby)) {
    const bb = maskBounds(r.values, r.width, r.height, .45); if (!bb) continue;
    const rect = r.rect || { x: 0, y: 0, width: 1, height: 1 }, rw = bb.width / r.width * rect.width * w, rh = bb.height / r.height * rect.height * h, x = (rect.x + bb.x / r.width * rect.width) * w, y = (rect.y + bb.y / r.height * rect.height) * h;
    for (let yy = Math.max(0, Math.floor(y - rh * .08)); yy < Math.min(h, Math.ceil(y + rh * 1.58)); yy++) for (let xx = Math.max(0, Math.floor(x - rw * .22)); xx < Math.min(w, Math.ceil(x + rw * 1.48)); xx++) {
      const i = yy * w + xx; union[i] = 1; if (p.foliage && green(data, i * 4)) nearbyGreens[i] = 1;
    }
  }
  // Drop tiny isolated green reflections/noise on plastic or metal. Real leaf
  // islands must contain a small connected patch; thin strands have their own
  // separate protection pass.
  const greenCount = nearbyGreens.reduce((n, v) => n + (v ? 1 : 0), 0), greenQueue = new Int32Array(greenCount);
  for (let start = 0; start < nearbyGreens.length; start++) if (nearbyGreens[start] === 1) {
    let head = 0, tail = 1; greenQueue[0] = start; nearbyGreens[start] = 2;
    while (head < tail) { const i = greenQueue[head++], x = i % w, y = Math.floor(i / w); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const xx = x + dx, yy = y + dy, j = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && nearbyGreens[j] === 1) { nearbyGreens[j] = 2; greenQueue[tail++] = j; } } }
    if (tail < 12) for (let k = 0; k < tail; k++) nearbyGreens[greenQueue[k]] = 0;
  }
  const mask = expandMask(union, w, h, clamp(p.grow, 0, 12)), protection = foregroundProtection(data, w, h, mask, p);
  for (let i = 0; i < mask.length; i++) if (nearbyGreens[i]) protection[i] = 1;
  // Automatic green/strand hints must not preserve a person's green clothing,
  // skin highlights or shirt folds. Explicit keep brushes remain available.
  if (regions.some(r => r.person || r.label === 'Người')) {
    const person = new Float32Array(w * h);
    for (const r of regions.filter(r => r.person || r.label === 'Người')) placeRegion(person, w, h, p.solid && !r.semantic ? solidRegion(r) : r);
    for (let i = 0; i < person.length; i++) if (person[i] > .01) protection[i] = 0;
  }
  for (let i = 0; i < mask.length; i++) mask[i] *= 1 - protection[i];
  // Explicit strokes override automatic hints, including green clothes.
  for (const s of strokes) {
    paintMask(mask, w, h, [{ ...s, type: 'remove', add: s.mode === 'erase' }], 'remove');
    if (s.mode === 'erase') paintMask(protection, w, h, [{ ...s, type: 'remove', add: false }], 'remove');
    else paintMask(protection, w, h, [{ ...s, type: 'remove', add: true }], 'remove');
  }
  // A named keeper wins over every automatic mask and every erase stroke.
  if (keepers.length) {
    if (keepers.length > 8) throw Error('Tối đa 8 người / vùng cần giữ.');
    let keep = new Float32Array(w * h); for (const r of keepers) placeRegion(keep, w, h, r);
    keep = expandMask(keep, w, h, clamp(p.keepMargin ?? 3, 0, 12));
    for (let i = 0; i < keep.length; i++) if (keep[i]) { mask[i] = 0; protection[i] = 1; union[i] = 1; }
  }
  const feather = clamp(p.feather, 0, 4);
  if (feather) { const d = distanceToZero(mask, w, h); for (let i = 0; i < mask.length; i++) if (mask[i]) mask[i] *= clamp(d[i] / (feather + .5)); }
  // Protected leaves/strands and every exterior pixel are exact, not a blur.
  for (let i = 0; i < mask.length; i++) { if (protection[i] > .99 || mask[i] < .02) mask[i] = 0; union[i] = Math.max(union[i], mask[i]); }
  const bounds = maskBounds(mask, w, h);
  if (bounds && bounds.count > w * h * .7) throw Error('Vùng xóa quá lớn. Giữ ít nhất 30% ảnh để AI đọc nền.');
  return { mask, protection, excluded: Uint8Array.from(expandMask(union, w, h, Math.max(10, p.grow + 6))), bounds };
}
export function nearbyProbePoints(mask, w, h) {
  const b = maskBounds(mask, w, h, .5);
  if (!b) return [];
  const result = []; let sumX = 0, count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > .5) { sumX += i % w; count++; }
  const center = ((sumX / (count || 1)) - b.x) / b.width;
  for (const y of [.62, .82, 1.04, 1.18, 1.26, 1.34]) for (const x of (y > 1.1 ? [center - .12, center, center + .12] : [-.16, .16, .84, 1.16])) {
    const px = clamp((b.x + b.width * x) / w), py = clamp((b.y + b.height * y) / h);
    if (mask[Math.min(h - 1, Math.floor(py * h)) * w + Math.min(w - 1, Math.floor(px * w))] < .1) result.push({ x: px, y: py, label: 1 });
  }
  return result;
}
export function acceptNearby(candidate, base, data, w, h) {
  const b = maskBounds(base, w, h, .5), c = maskBounds(candidate, w, h, .5);
  if (!b || !c || c.count < b.count * .015 || c.count > b.count * .65 || c.width > b.width * 1.3 || c.height > b.height * .7 || Math.max(c.width / c.height, c.height / c.width) > 3.8) return false;
  if (c.x < b.x - b.width * .6 || c.right > b.right + b.width * .6 || c.y < b.y + b.height * .35 || c.bottom > b.bottom + b.height * .65) return false;
  const near = expandMask(base, w, h, Math.max(3, Math.round(Math.min(b.width, b.height) * .35)));
  let overlap = 0, touching = 0, vegetation = 0;
  for (let i = 0; i < candidate.length; i++) if (candidate[i] > .5) { if (base[i] > .5) overlap++; if (near[i]) touching++; if (green(data, i * 4)) vegetation++; }
  return overlap / c.count < .4 && touching / c.count > .015 && vegetation / c.count < .22;
}

// Transfer only bounded high-frequency residuals from real unmasked patches.
// Coarse neural structure stays in place. No donor is allowed to overlap the
// erased object, including leaf-protection holes inside its silhouette.
export function transferRemovalDetail(source, generated, w, h, mask, excluded, amount = .55, variant = 0) {
  const out = new Uint8ClampedArray(generated), b = maskBounds(mask, w, h);
  if (!b || !amount) return { data: out, samples: 0 };
  const pad = 100, x0 = Math.max(0, b.x - pad), y0 = Math.max(0, b.y - pad), rw = Math.min(w, b.right + pad) - x0, rh = Math.min(h, b.bottom + pad) - y0, raw = new Uint8ClampedArray(rw * rh * 4), gen = new Uint8ClampedArray(raw.length), invalid = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) { const i = y * rw + x, j = (y + y0) * w + x + x0; raw.set(source.subarray(j * 4, j * 4 + 4), i * 4); gen.set(generated.subarray(j * 4, j * 4 + 4), i * 4); invalid[i] = excluded[j] > .01 || source[j * 4 + 3] < 250 ? 1 : 0; }
  const low = boxBlur(raw, rw, rh, 2), guide = boxBlur(gen, rw, rh, 3), step = Math.max(10, Math.ceil(Math.sqrt(b.width * b.height / 1800))), cols = Math.ceil(b.width / step) + 1, rows = Math.ceil(b.height / step) + 1, field = new Array(cols * rows);
  let seed = 9176 + variant * 1459, samples = 0;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const valid = (x, y) => x >= 5 && y >= 5 && x < rw - 5 && y < rh - 5 && [[0, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]].every(([dx, dy]) => !invalid[(y + dy) * rw + x + dx]);
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const tx = Math.min(rw - 1, b.x - x0 + gx * step), ty = Math.min(rh - 1, b.y - y0 + gy * step), index = gy * cols + gx;
    if (!mask[(ty + y0) * w + tx + x0]) continue;
    let best = null, score = Infinity;
    const consider = (sx, sy) => {
      sx = Math.round(sx); sy = Math.round(sy); if (!valid(sx, sy)) return;
      let loss = 0;
      for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) for (let c = 0; c < 3; c++) { const a = low[((sy + dy) * rw + sx + dx) * 4 + c], z = guide[(clamp(ty + dy, 0, rh - 1) * rw + clamp(tx + dx, 0, rw - 1)) * 4 + c]; loss += (a - z) ** 2; }
      loss = loss / 15 + .002 * ((sx - tx) ** 2 + (sy - ty) ** 2);
      if (loss < score) { score = loss; best = { dx: sx - tx, dy: sy - ty }; }
    };
    for (const prev of [gx ? field[index - 1] : null, gy ? field[index - cols] : null]) if (prev) consider(tx + prev.dx, ty + prev.dy);
    for (let r = 12; r <= Math.max(rw, rh); r *= 1.65) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) consider(tx + dx * r, ty + dy * r);
    for (let k = 0; k < 48; k++) consider(5 + random() * (rw - 11), 5 + random() * (rh - 11));
    if (score < 2100) field[index] = best;
  }
  for (let y = b.y; y < b.bottom; y++) for (let x = b.x; x < b.right; x++) {
    const i = y * w + x, a = mask[i] * clamp(amount); if (!a) continue;
    const fx = (x - b.x) / step, fy = (y - b.y) / step, gx = Math.floor(fx), gy = Math.floor(fy), tx = fx - gx, ty = fy - gy, residual = [0, 0, 0]; let weights = 0;
    for (const [xx, yy, weight] of [[gx, gy, (1 - tx) * (1 - ty)], [gx + 1, gy, tx * (1 - ty)], [gx, gy + 1, (1 - tx) * ty], [gx + 1, gy + 1, tx * ty]]) {
      const v = field[yy * cols + xx]; if (!v || !weight) continue;
      const sx = x - x0 + v.dx, sy = y - y0 + v.dy;
      if (sx < 0 || sy < 0 || sx >= rw || sy >= rh || invalid[sy * rw + sx]) continue;
      const j = (sy * rw + sx) * 4; for (let c = 0; c < 3; c++) residual[c] += clamp(raw[j + c] - low[j + c], -24, 24) * weight;
      weights += weight;
    }
    if (weights > .01) { for (let c = 0; c < 3; c++) out[i * 4 + c] += residual[c] / weights * a; samples++; }
  }
  return { data: out, samples };
}
