export const clamp01 = v => Math.max(0, Math.min(1, v));
export const VOC_LABELS = ['Nền', 'Máy bay', 'Xe đạp', 'Chim', 'Thuyền', 'Chai / lọ', 'Xe buýt', 'Ô tô', 'Mèo', 'Ghế', 'Bò', 'Bàn', 'Chó', 'Ngựa', 'Xe máy', 'Người', 'Cây', 'Cừu', 'Sofa', 'Tàu', 'TV / màn hình'];
export function checkMask(mask, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1048576 || mask.length !== width * height) throw Error('Invalid cutout mask size.');
  if (mask.some(v => !Number.isFinite(v))) throw Error('Invalid cutout mask values.');
}
export function sample(data, width, height, x, y, offset = 0) {
  x = Math.max(0, Math.min(width - 1, x)); y = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), dx = x - x0, dy = y - y0;
  return (data[offset + y0 * width + x0] * (1 - dx) + data[offset + y0 * width + x1] * dx) * (1 - dy) + (data[offset + y1 * width + x0] * (1 - dx) + data[offset + y1 * width + x1] * dx) * dy;
}
export function resizeMask(data, sw, sh, width, height) {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = clamp01(sample(data, sw, sh, (x + .5) * sw / width - .5, (y + .5) * sh / height - .5));
  return out;
}
export function samMask(logits, candidate, resizedWidth, resizedHeight, width, height) {
  const out = new Float32Array(width * height), offset = candidate * 256 * 256;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const logit = sample(logits, 256, 256, (x + .5) * resizedWidth / width / 4 - .5, (y + .5) * resizedHeight / height / 4 - .5, offset);
    const alpha = 1 / (1 + Math.exp(-logit));
    out[y * width + x] = alpha < .02 ? 0 : alpha > .98 ? 1 : alpha;
  }
  return out;
}
export function semanticRegions(labels, width, height, { minArea = Math.max(24, Math.round(width * height * .002)), limit = 12 } = {}) {
  const seen = new Uint8Array(labels.length), components = [], queue = new Int32Array(labels.length);
  for (let start = 0; start < labels.length; start++) {
    const category = Number(labels[start]);
    if (seen[start] || category < 1 || category > 20) continue;
    let read = 0, write = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = start; seen[start] = 1;
    while (read < write) {
      const p = queue[read++], x = p % width, y = Math.floor(p / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const n = yy * width + xx;
        if (!seen[n] && Number(labels[n]) === category) { seen[n] = 1; queue[write++] = n; }
      }
    }
    if (write >= minArea) components.push({ category, pixels: queue.slice(0, write), area: write, bounds: { x: left / width, y: top / height, width: (right - left + 1) / width, height: (bottom - top + 1) / height } });
  }
  components.sort((a, b) => b.area - a.area);
  const map = new Uint16Array(labels.length), regions = components.slice(0, limit).map((c, index) => {
    const id = index + 1;
    for (const p of c.pixels) map[p] = id;
    // Use an actual region pixel nearest its centre, not the centre of a hollow box.
    const cx = (c.bounds.x + c.bounds.width / 2) * width, cy = (c.bounds.y + c.bounds.height / 2) * height;
    let best = c.pixels[0], distance = Infinity;
    for (const p of c.pixels) { const d = (p % width - cx) ** 2 + (Math.floor(p / width) - cy) ** 2; if (d < distance) { distance = d; best = p; } }
    return { id, classId: c.category, label: VOC_LABELS[c.category], area: c.area, bounds: c.bounds, point: { x: (best % width + .5) / width, y: (Math.floor(best / width) + .5) / height } };
  });
  return { map, regions, width, height };
}
export function regionMask(detection, id, width, height) {
  const mask = Float32Array.from(detection.map, value => value === id ? 1 : 0);
  return resizeMask(mask, detection.width, detection.height, width, height);
}
export function regionPrompts(detection, region) {
  const { map, width, height } = detection, b = region.bounds, vertical = b.height * height >= b.width * width, points = [], used = new Set();
  for (const t of [.2, .5, .8]) {
    const tx = (b.x + b.width * (vertical ? .5 : t)) * width, ty = (b.y + b.height * (vertical ? t : .5)) * height;
    let best = -1, distance = Infinity;
    for (let p = 0; p < map.length; p++) {
      if (map[p] !== region.id) continue;
      const x = p % width, y = Math.floor(p / width);
      // Avoid putting prompts on the uncertain semantic boundary when possible.
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || [p - 1, p + 1, p - width, p + width].some(n => map[n] !== region.id)) continue;
      const d = (x + .5 - tx) ** 2 + (y + .5 - ty) ** 2;
      if (d < distance) { distance = d; best = p; }
    }
    if (best >= 0 && !used.has(best)) { used.add(best); points.push({ x: (best % width + .5) / width, y: (Math.floor(best / width) + .5) / height, label: 1 }); }
  }
  return points.length ? points : [{ ...region.point, label: 1 }];
}
function boxMean(data, width, height, radius) {
  const temp = new Float32Array(data.length), out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    let sum = 0, count = 0;
    for (let x = -radius; x < width; x++) {
      const next = x + radius, previous = x - radius - 1;
      if (next < width) { sum += data[y * width + next]; count++; }
      if (previous >= 0) { sum -= data[y * width + previous]; count--; }
      if (x >= 0) temp[y * width + x] = sum / count;
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0, count = 0;
    for (let y = -radius; y < height; y++) {
      const next = y + radius, previous = y - radius - 1;
      if (next < height) { sum += temp[next * width + x]; count++; }
      if (previous >= 0) { sum -= temp[previous * width + x]; count--; }
      if (y >= 0) out[y * width + x] = sum / count;
    }
  }
  return out;
}
function morphology(data, width, height, grow) {
  const radius = Math.min(8, Math.abs(Math.round(grow))), fn = grow > 0 ? Math.max : Math.min, initial = grow > 0 ? 0 : 1, temp = new Float32Array(data.length), out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let v = initial;
    for (let dx = -radius; dx <= radius; dx++) v = fn(v, data[y * width + Math.max(0, Math.min(width - 1, x + dx))]);
    temp[y * width + x] = v;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let v = initial;
    for (let dy = -radius; dy <= radius; dy++) v = fn(v, temp[Math.max(0, Math.min(height - 1, y + dy)) * width + x]);
    out[y * width + x] = v;
  }
  return out;
}
export function guidedAlpha(alpha, rgba, width, height, radius = 3) {
  const n = alpha.length, gray = new Float32Array(n), square = new Float32Array(n), product = new Float32Array(n);
  for (let i = 0; i < n; i++) { const g = (rgba[i * 4] * .2126 + rgba[i * 4 + 1] * .7152 + rgba[i * 4 + 2] * .0722) / 255; gray[i] = g; square[i] = g * g; product[i] = g * alpha[i]; }
  const meanI = boxMean(gray, width, height, radius), meanP = boxMean(alpha, width, height, radius), corrI = boxMean(square, width, height, radius), corrIP = boxMean(product, width, height, radius), a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i] = (corrIP[i] - meanI[i] * meanP[i]) / (Math.max(0, corrI[i] - meanI[i] ** 2) + .001); b[i] = meanP[i] - a[i] * meanI[i]; }
  const ma = boxMean(a, width, height, radius), mb = boxMean(b, width, height, radius);
  return Float32Array.from(alpha, (v, i) => meanP[i] < .001 || meanP[i] > .999 ? v : clamp01(ma[i] * gray[i] + mb[i]));
}
export function refineAlpha(input, width, height, { grow = 0, feather = 0, contrast = 0, guided = false, invert = false } = {}, rgba) {
  checkMask(input, width, height);
  let alpha = Float32Array.from(input, clamp01);
  if (guided && rgba?.length === input.length * 4) alpha = guidedAlpha(alpha, rgba, width, height);
  if (grow) alpha = morphology(alpha, width, height, grow);
  const radius = Math.min(8, Math.max(0, Math.round(feather)));
  if (radius) alpha = boxMean(alpha, width, height, radius);
  const c = Math.max(0, Math.min(.9, contrast / 100));
  if (c || invert) for (let i = 0; i < alpha.length; i++) { const v = clamp01((alpha[i] - c / 2) / (1 - c)); alpha[i] = invert ? 1 - v : v; }
  return alpha;
}
