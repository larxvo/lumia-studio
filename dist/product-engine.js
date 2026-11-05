import { PRODUCT_DEFAULTS, PRODUCT_PRESETS, productParams } from './product-settings.js';
import { placeRegion, maskBounds, expandMask } from './removal-math.js';
import { paintMask } from './portrait-masks.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const luminance = (d, k) => (.2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2]) / 255;
const linear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const srgb = v => v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055;
function exposed(v, ev) {
  if (!ev) return v;
  let x = linear(clamp(v)) * 2 ** ev;
  if (ev > 0 && x > .82) x = .82 + .18 * (1 - Math.exp(-(x - .82) / .18));
  return clamp(srgb(x));
}
function meanBox(a, w, h, r) {
  r = Math.max(1, Math.round(r));
  const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = -r; x < w; x++) { const next = x + r, prev = x - r - 1; if (next < w) { sum += a[y * w + next]; count++; } if (prev >= 0) { sum -= a[y * w + prev]; count--; } if (x >= 0) tmp[y * w + x] = sum / count; }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let y = -r; y < h; y++) { const next = y + r, prev = y - r - 1; if (next < h) { sum += tmp[next * w + x]; count++; } if (prev >= 0) { sum -= tmp[prev * w + x]; count--; } if (y >= 0) out[y * w + x] = sum / count; }
  }
  return out;
}
export function checkProductPixels(data, width, height, mask) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data?.length !== width * height * 4 || mask?.length !== width * height || mask.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw Error('Dữ liệu ảnh hoặc mask sản phẩm không hợp lệ.');
}
export function productMask(w, h, region, strokes = [], p = PRODUCT_DEFAULTS, selection = null) {
  let out = new Float32Array(w * h);
  if (region) placeRegion(out, w, h, region);
  // Threshold away SAM uncertainty, then edit the native-resolution mask.
  for (let i = 0; i < out.length; i++) out[i] = out[i] >= .5 ? 1 : 0;
  paintMask(out, w, h, strokes, 'product');
  const grow = Math.round(p.grow || 0);
  if (grow > 0) out = expandMask(out, w, h, grow);
  if (grow < 0) { const inverse = Float32Array.from(out, a => 1 - a), expanded = expandMask(inverse, w, h, -grow); out = Float32Array.from(out, (a, i) => a * (1 - expanded[i])); }
  if (p.feather) {
    const soft = meanBox(out, w, h, p.feather);
    for (let i = 0; i < out.length; i++) out[i] *= soft[i];
  }
  if (selection) { if (selection.length !== out.length) throw Error('Vùng chọn không khớp ảnh.'); for (let i = 0; i < out.length; i++) out[i] *= selection[i]; }
  return out;
}
function quantile(hist, q) { let sum = 0, total = hist.reduce((a, b) => a + b, 0); if (!total) return 0; for (let i = 0; i < hist.length; i++) { sum += hist[i]; if (sum >= total * q) return i / 255; } return 1; }
export function prepareProduct({ data, width: w, height: h, mask, selection = null }) {
  checkProductPixels(data, w, h, mask);
  if (selection && (selection.length !== mask.length || selection.some(v => !Number.isFinite(v) || v < 0 || v > 1))) throw Error('Vùng chọn không hợp lệ.');
  const b = maskBounds(mask, w, h, .0001); if (!b || b.count < 3) throw Error('Chọn một vùng sản phẩm trước.');
  const pad = Math.max(8, Math.ceil(Math.max(b.width, b.height) * .16)), x0 = Math.max(0, b.x - pad), y0 = Math.max(0, b.y - pad), rw = Math.min(w, b.right + pad) - x0, rh = Math.min(h, b.bottom + pad) - y0, n = rw * rh;
  const weights = new Float32Array(n), weighted = new Float32Array(n), localL = new Float32Array(n), objectHist = new Float64Array(256), sceneHist = new Float64Array(256);
  let warmth = 0, objectCount = 0, detail = 0, detailCount = 0;
  for (let i = 0; i < mask.length; i++) { if (data[i * 4 + 3] && (!selection || selection[i] > 0)) sceneHist[Math.round(luminance(data, i * 4) * 255)] += data[i * 4 + 3] / 255 * (selection ? selection[i] : 1); }
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = (y + y0) * w + x + x0, j = y * rw + x, a = mask[i] * data[i * 4 + 3] / 255, L = luminance(data, i * 4);
    weights[j] = a; weighted[j] = L * a; localL[j] = L;
    if (a > .0001) { objectHist[Math.round(L * 255)] += a; objectCount += a; warmth += Math.max(0, data[i * 4] - data[i * 4 + 2]) / 255 * a; if (x && y && weights[j - 1] > .0001 && weights[j - rw] > .0001) { detail += Math.abs(L - localL[j - 1]) + Math.abs(L - localL[j - rw]); detailCount += 2; } }
  }
  if (objectCount < 3) throw Error('Vùng chọn chưa có đủ pixel sản phẩm nhìn thấy.');
  const radius = Math.max(2, Math.round(Math.min(b.width, b.height) * .025));
  function normalized(r) { const a = meanBox(weighted, rw, rh, r), d = meanBox(weights, rw, rh, r); for (let i = 0; i < n; i++) a[i] = d[i] > .0001 ? a[i] / d[i] : localL[i]; return a; }
  const fine = normalized(Math.max(1, Math.round(radius / 3))), base = normalized(radius * 3), halo = meanBox(weights, rw, rh, Math.max(3, Math.round(Math.min(b.width, b.height) * .09)));
  const analysis = { bounds: b, selectedPixels: Math.round(objectCount), median: quantile(objectHist, .5), low: quantile(objectHist, .1), high: quantile(objectHist, .95), warmth: warmth / objectCount, detail: detail / Math.max(1, detailCount), sceneMedian: quantile(sceneHist, .5), sceneHigh: quantile(sceneHist, .97), blurred: detail / Math.max(1, detailCount) < .016 };
  return { data, width: w, height: h, mask, selection, roi: { x: x0, y: y0, width: rw, height: rh }, fine, base, halo, analysis };
}
export function autoProductParams(analysis, preset = 'silver', previous = {}) {
  const s = PRODUCT_PRESETS.find(p => p.id === preset) || PRODUCT_PRESETS[0], p = { ...PRODUCT_DEFAULTS, ...s.params };
  for (const k of ['amount', 'scene', 'grow', 'feather']) if (previous[k] !== undefined) p[k] = previous[k];
  p.exposure = Math.round(clamp((.56 - analysis.sceneMedian) * 2.2, -.12, .45) * 20) / 20;
  p.objectExposure = Math.round(clamp((.72 - analysis.median) * 1.6, -.1, .5) * 20) / 20;
  p.highlights = analysis.sceneHigh > .88 ? -22 : -12;
  p.detail = analysis.blurred ? 12 : s.params.detail;
  if (preset === 'silver' || preset === 'dramatic') p.clean = Math.round(clamp(45 + analysis.warmth * 180, 45, 80));
  if (preset === 'window') { p.temperature = 4; p.contact = 18; p.depth = 22; }
  if (preset === 'dramatic') { p.depth = 30; p.shadows = -6; p.contact = 22; }
  return productParams(p);
}
export function renderProduct(context, input = {}) {
  const p = productParams(input), { data: src, width: w, height: h, mask, selection, roi: r, fine, base, halo, analysis } = context, output = new Uint8ClampedArray(src), amount = p.amount / 100, exposureLUT = Float32Array.from({ length: 4097 }, (_, i) => exposed(i / 4096, p.exposure)), objectLUT = Float32Array.from({ length: 4097 }, (_, i) => exposed(i / 4096, p.objectExposure)), angle = p.angle * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle), b = analysis.bounds;
  let changed = 0, outsideChanged = 0, clippedBefore = 0, clippedAfter = 0;
  if (!amount) return { data: output, width: w, height: h, stats: { changedPixels: 0, outsideChangedPixels: 0, originalResolution: true } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = i * 4, a = mask[i], select = selection ? selection[i] : 1;
    if (!src[k + 3] || !select || !p.scene && !a) continue;
    const L = luminance(src, k), j = x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height ? (y - r.y) * r.width + x - r.x : -1;
    let R = src[k] / 255, G = src[k + 1] / 255, B = src[k + 2] / 255;
    if (a && j >= 0) {
      const localA = p.scene && selection ? clamp(a / select) : a;
      const low = base[j], chroma = clamp((R - B) / .15), lift = p.clean / 100 * .15 * (.4 + .6 * (1 - low)) * (.45 + chroma * .55), micro = clamp((L - fine[j]) * p.detail / 100 * .85, -.045, .045), relief = clamp((fine[j] - low) * p.contrast / 100 * .8, -.09, .09);
      const nx = clamp((x - b.x - b.width / 2) / Math.max(1, b.width / 2), -1, 1), ny = clamp((y - b.y - b.height / 2) / Math.max(1, b.height / 2), -1, 1), light = -(nx * ca + ny * sa) * p.relight / 100 * .075;
      const value = clamp(L + lift + relief + micro + light), target = objectLUT[Math.round(value * 4096)], neutral = p.neutral / 100;
      R += (clamp(target + (R - L) * (1 - neutral)) - R) * localA;
      G += (clamp(target + (G - L) * (1 - neutral)) - G) * localA;
      B += (clamp(target + (B - L) * (1 - neutral)) - B) * localA;
    }
    if (p.scene) {
      const oldL = .2126 * R + .7152 * G + .0722 * B;
      let value = exposureLUT[Math.round(clamp(oldL) * 4096)];
      value += p.shadows / 100 * .35 * 4 * value * (1 - value) ** 3;
      value += p.highlights / 100 * .24 * 4 * value ** 3 * (1 - value);
      value += p.depth / 100 * .32 * 4 * value * (1 - value) * (2 * value - 1);
      value += p.background / 100 * .12 * (1 - a) * 4 * value * (1 - value);
      const distance = Math.min(1, ((x / Math.max(1, w - 1) - .5) ** 2 + (y / Math.max(1, h - 1) - .5) ** 2) * 2);
      value -= p.vignette / 100 * .2 * distance * value;
      if (j >= 0 && !a) value -= halo[j] * p.contact / 100 * .13 * clamp((.78 - L) / .4);
      const shift = clamp(value) - oldL, t = p.temperature / 100 * .06 * 4 * oldL * (1 - oldL);
      R += shift + t; G += shift; B += shift - t;
    }
    // Native selection and master amount apply last, so no setting can write
    // into the selection exterior. Alpha and fully transparent source stay exact.
    const mix = amount * (p.scene ? select : 1);
    output[k] = src[k] + (clamp(R) * 255 - src[k]) * mix;
    output[k + 1] = src[k + 1] + (clamp(G) * 255 - src[k + 1]) * mix;
    output[k + 2] = src[k + 2] + (clamp(B) * 255 - src[k + 2]) * mix;
    if (src[k] >= 254 && src[k + 1] >= 254 && src[k + 2] >= 254) clippedBefore++;
    if (output[k] >= 254 && output[k + 1] >= 254 && output[k + 2] >= 254) clippedAfter++;
    if (output[k] !== src[k] || output[k + 1] !== src[k + 1] || output[k + 2] !== src[k + 2]) { changed++; if (!a) outsideChanged++; }
  }
  return { data: output, width: w, height: h, stats: { changedPixels: changed, outsideChangedPixels: outsideChanged, clippedBefore, clippedAfter, originalResolution: true } };
}
