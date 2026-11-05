import { checkRemovalPixels, maskBounds, transferRemovalDetail } from './removal-math.js';
import { samplePlanar } from './neural-math.js';

// Find separated local repair regions on a small grid. Distant people do not
// force the whole photograph through one 512-pixel model input.
export function removalGroups(mask, w, h) {
  const scale = Math.min(1, 320 / Math.max(w, h)), sw = Math.max(1, Math.ceil(w * scale)), sh = Math.max(1, Math.ceil(h * scale)), map = new Uint8Array(sw * sh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] > .01) map[Math.min(sh - 1, Math.floor(y * scale)) * sw + Math.min(sw - 1, Math.floor(x * scale))] = 1;
  const queue = new Int32Array(map.length), groups = [];
  for (let start = 0; start < map.length; start++) if (map[start] === 1) {
    let head = 0, tail = 1, left = sw, top = sh, right = 0, bottom = 0; queue[0] = start; map[start] = 2;
    while (head < tail) {
      const i = queue[head++], x = i % sw, y = Math.floor(i / sw); left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const xx = x + dx, yy = y + dy, j = yy * sw + xx; if (xx >= 0 && yy >= 0 && xx < sw && yy < sh && map[j] === 1) { map[j] = 2; queue[tail++] = j; } }
    }
    groups.push({ x: Math.max(0, Math.floor(left / scale)), y: Math.max(0, Math.floor(top / scale)), right: Math.min(w, Math.ceil(right / scale)), bottom: Math.min(h, Math.ceil(bottom / scale)) });
  }
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j], gap = Math.max(24, Math.min(a.right - a.x, a.bottom - a.y, b.right - b.x, b.bottom - b.y) * .25);
      if (a.x <= b.right + gap && a.right + gap >= b.x && a.y <= b.bottom + gap && a.bottom + gap >= b.y) {
        groups[i] = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }; groups.splice(j, 1); changed = true; break outer;
      }
    }
  }
  if (groups.length > 8) throw Error('Vùng xóa quá phân tán. Chọn tối đa 8 nhóm hoặc sửa bớt các chấm rời.');
  return groups;
}
function reflect(x, n) { if (n < 2) return 0; const k = 2 * (n - 1); x = ((x % k) + k) % k; return x < n ? x : k - x; }
export function removalInput(source, w, h, mask, group, variant = 0, settings = {}) {
  const width = group.right - group.x, height = group.bottom - group.y, index = Math.max(0, Math.min(2, Math.round(variant))), deep = settings.quality === 'deep', factor = (deep ? [2.1, 2.5, 3] : [1.45, 1.9, 2.25])[index], side = Math.max(Math.min((deep ? [768, 1024, 1280] : [512, 640, 768])[index], Math.max(w, h)), Math.ceil(Math.max(width, height) * factor)), cw = Math.min(w, side), ch = Math.min(h, side), cx = (group.x + group.right) / 2, cy = (group.y + group.bottom) / 2;
  const x0 = Math.max(0, Math.min(w - cw, cx - cw / 2)), y0 = Math.max(0, Math.min(h - ch, cy - ch / 2)), scale = Math.min(512 / cw, 512 / ch), rw = Math.max(1, Math.round(cw * scale)), rh = Math.max(1, Math.round(ch * scale)), padX = Math.floor((512 - rw) / 2), padY = Math.floor((512 - rh) / 2), crop = { x: x0, y: y0, side, width: cw, height: ch, scale, padX, padY }, n = 512 * 512, input = new Float32Array(n * 4);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const rx = reflect(x - padX, rw), ry = reflect(y - padY, rh), px = Math.max(0, Math.min(w - 1, Math.floor(x0 + (rx + .5) / scale))), py = Math.max(0, Math.min(h - 1, Math.floor(y0 + (ry + .5) / scale))), j = py * w + px, i = y * 512 + x;
    // Conservative footprint max-pooling prevents thin clothing/skin edges
    // from leaking into known pixels during model downsampling.
    const lx = Math.max(0, Math.floor(x0 + rx / scale)), ly = Math.max(0, Math.floor(y0 + ry / scale)), hx = Math.min(w, Math.ceil(x0 + (rx + 1) / scale)), hy = Math.min(h, Math.ceil(y0 + (ry + 1) / scale)); let m = 0;
    scan: for (let yy = ly; yy < hy; yy++) for (let xx = lx; xx < hx; xx++) if (mask[yy * w + xx] > .01) { m = 1; break scan; }
    for (let c = 0; c < 3; c++) input[c * n + i] = m ? 0 : source[j * 4 + c] / 255;
    input[3 * n + i] = m;
  }
  return { input, crop };
}
function boundaryFit(prediction, source, w, h, mask, group, crop) {
  let loss = 0, count = 0; const sums = [0, 0, 0];
  const pad = 10;
  for (let y = Math.max(1, group.y - pad); y < Math.min(h - 1, group.bottom + pad); y += 2) for (let x = Math.max(1, group.x - pad); x < Math.min(w - 1, group.right + pad); x += 2) {
    const i = y * w + x; if (mask[i] || ![i - 2, i + 2, i - w * 2, i + w * 2].some(j => mask[j] > .01)) continue;
    const px = (x + .5 - crop.x) * crop.scale + crop.padX - .5, py = (y + .5 - crop.y) * crop.scale + crop.padY - .5;
    for (let c = 0; c < 3; c++) { const delta = source[i * 4 + c] - samplePlanar(prediction, 512, 3, px, py, c) * 255; sums[c] += delta; loss += Math.min(3600, delta * delta); } count++;
  }
  return { score: count ? loss / (count * 3) : Infinity, offset: sums.map(v => Math.max(-12, Math.min(12, v / (count || 1)))) };
}
export async function runRemoval({ data, width: w, height: h, mask, excluded = mask, settings = {}, variant = 0, singleRegion = false }, infer, progress = () => {}) {
  checkRemovalPixels(data, w, h, mask);
  if (typeof infer !== 'function' || !Number.isInteger(variant) || variant < 0 || variant > 2 || excluded.length !== mask.length || typeof singleRegion !== 'boolean') throw Error('Thiết lập xóa vật thể không hợp lệ.');
  const bounds = maskBounds(mask, w, h);
  if (!bounds) throw Error('Bấm vào người / vật thể hoặc tô vùng cần xóa.');
  if (bounds.count > w * h * .7) throw Error('Giữ lại ít nhất 30% ảnh làm ngữ cảnh.');
  const output = new Uint8ClampedArray(data), groups = singleRegion ? [{x:bounds.x,y:bounds.y,right:bounds.right,bottom:bounds.bottom}] : removalGroups(mask, w, h), crops = [];
  for (let n = 0; n < groups.length; n++) {
    const group = groups[n], choices = [], indices = settings.quality === 'deep' ? [variant, (variant + 1) % 3] : [variant];
    for (const index of indices) {
      const { input, crop } = removalInput(output, w, h, mask, group, index, settings);
      if (choices.some(c => c.crop.x === crop.x && c.crop.y === crop.y && c.crop.width === crop.width && c.crop.height === crop.height)) continue;
      progress('Đang tái dựng nền ' + (n + 1) + '/' + groups.length + ' · ngữ cảnh ' + (choices.length + 1) + '…');
      const prediction = await infer(input);
      if (prediction.length !== 3 * 512 * 512 || prediction.some(v => !Number.isFinite(v))) throw Error('AI trả về nền không hợp lệ.');
      choices.push({ prediction, crop, ...boundaryFit(prediction, data, w, h, mask, group, crop) });
    }
    choices.sort((a, b) => a.score - b.score); const { prediction, crop, offset } = choices[0];
    for (let y = group.y; y < group.bottom; y++) for (let x = group.x; x < group.right; x++) {
      const i = y * w + x, a = mask[i]; if (!a) continue;
      const px = (x + .5 - crop.x) * crop.scale + crop.padX - .5, py = (y + .5 - crop.y) * crop.scale + crop.padY - .5;
      for (let c = 0; c < 3; c++) output[i * 4 + c] = data[i * 4 + c] + (Math.max(0, Math.min(255, samplePlanar(prediction, 512, 3, px, py, c) * 255 + (settings.quality === 'deep' ? offset[c] * .5 : 0))) - data[i * 4 + c]) * a;
    }
    crops.push({ ...crop, candidates: choices.length, boundaryScore: choices[0].score });
  }
  progress('Đang khớp kết cấu từ các mảng nền còn nguyên…');
  const detail = transferRemovalDetail(data, output, w, h, mask, excluded, Math.max(0, Math.min(100, settings.detail ?? 55)) / 100, variant);
  let changed = 0, outsideChanged = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) { for (let c = 0; c < 4; c++) { if (detail.data[i * 4 + c] !== data[i * 4 + c]) outsideChanged++; detail.data[i * 4 + c] = data[i * 4 + c]; } }
    detail.data[i * 4 + 3] = data[i * 4 + 3];
    if ([0, 1, 2].some(c => detail.data[i * 4 + c] !== data[i * 4 + c])) changed++;
  }
  return { data: detail.data, width: w, height: h, stats: { changedPixels: changed, outsideChangedBytes: outsideChanged, detailSamples: detail.samples, crops, model: 'LaMa + local texture residuals', originalResolution: true } };
}
