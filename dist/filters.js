import { clamp } from "./model.js";
const FILTERS = { invert: {name:"Invert",params:{}}, sharpen: { name: "Sharpen", params: { amount: 50 } }, unsharp: { name: "Unsharp mask", params: { amount: 80, radius: 2, threshold: 3 } }, gaussian: { name: "Gaussian blur", params: { radius: 4 } }, pixelate: { name: "Pixelate", params: { size: 12 } }, median: { name: "Median noise reduction", params: { amount: 100 } }, emboss: { name: "Emboss", params: { amount: 70 } }, highpass: { name: "High pass", params: { radius: 4 } }, vignette: { name: "Vignette", params: { amount: 35 } }, sepia: { name: "Sepia", params: { amount: 60 } } };
function boxBlur(source, w, h, radius) {
  const r = Math.max(0, Math.min(100, Math.round(radius))), out = new Uint8ClampedArray(source.length);
  if (!r) return new Uint8ClampedArray(source);
  const tmp = new Float32Array(source.length), window = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    const sums = [0, 0, 0, 0];
    for (let k = -r; k <= r; k++) {
      const i = (y * w + clamp(k, 0, w - 1)) * 4;
      for (let c = 0; c < 4; c++) sums[c] += source[i + c];
    }
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) tmp[i + c] = sums[c] / window;
      const left = (y * w + clamp(x - r, 0, w - 1)) * 4, right = (y * w + clamp(x + r + 1, 0, w - 1)) * 4;
      for (let c = 0; c < 4; c++) sums[c] += source[right + c] - source[left + c];
    }
  }
  for (let x = 0; x < w; x++) {
    const sums = [0, 0, 0, 0];
    for (let k = -r; k <= r; k++) {
      const i = (clamp(k, 0, h - 1) * w + x) * 4;
      for (let c = 0; c < 4; c++) sums[c] += tmp[i + c];
    }
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[i + c] = sums[c] / window;
      const top = (clamp(y - r, 0, h - 1) * w + x) * 4, bottom = (clamp(y + r + 1, 0, h - 1) * w + x) * 4;
      for (let c = 0; c < 4; c++) sums[c] += tmp[bottom + c] - tmp[top + c];
    }
  }
  return out;
}
function filterPixels(data, w, h, type, params = {}, scale = 1) {
  const p = { ...FILTERS[type]?.params, ...params }, src = new Uint8ClampedArray(data);
  if (!FILTERS[type]) throw new Error("Unknown filter.");
  if(type==='invert'){for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)data[i+k]=255-src[i+k];return data;}
  const amount = clamp(p.amount ?? 100, 0, 300) / 100;
  if (["gaussian", "unsharp", "highpass"].includes(type)) {
    let blurred = src;
    const r = Math.max(1, Math.round((p.radius || 1) * scale));
    for (let pass = 0; pass < 3; pass++) blurred = boxBlur(blurred, w, h, Math.max(1, r / 2));
    for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) {
      const delta = src[i + k] - blurred[i + k];
      data[i + k] = type === "gaussian" ? blurred[i + k] : type === "highpass" ? 128 + delta : src[i + k] + (Math.abs(delta) >= (p.threshold || 0) ? delta * amount : 0);
    }
    return data;
  }
  if (type === "pixelate") {
    const size = Math.max(2, Math.round((p.size || 12) * scale));
    for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
      const sum = [0, 0, 0], x1 = Math.min(w, x + size), y1 = Math.min(h, y + size);
      let count = 0;
      for (let yy = y; yy < y1; yy++) for (let xx = x; xx < x1; xx++) {
        const i = (yy * w + xx) * 4;
        if (src[i + 3]) {
          for (let k = 0; k < 3; k++) sum[k] += src[i + k];
          count++;
        }
      }
      if (!count) continue;
      for (let yy = y; yy < y1; yy++) for (let xx = x; xx < x1; xx++) {
        const i = (yy * w + xx) * 4;
        for (let k = 0; k < 3; k++) data[i + k] = sum[k] / count;
      }
    }
    return data;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (type === "vignette") {
      const d = Math.hypot((x - w / 2) / (w * 0.7071), (y - h / 2) / (h * 0.7071)), a = Math.max(0, 1 - Math.max(0, d - 0.25) ** 2 * amount);
      for (let k = 0; k < 3; k++) data[i + k] = src[i + k] * a;
    } else if (type === "sepia") {
      const r = src[i], g = src[i + 1], b = src[i + 2], values = [r * 0.393 + g * 0.769 + b * 0.189, r * 0.349 + g * 0.686 + b * 0.168, r * 0.272 + g * 0.534 + b * 0.131];
      for (let k = 0; k < 3; k++) data[i + k] = src[i + k] + (clamp(values[k]) - src[i + k]) * Math.min(1, amount);
    } else for (let k = 0; k < 3; k++) {
      if (type === "median") {
        const values = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values.push(src[(clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4 + k]);
        values.sort((a, b) => a - b);
        data[i + k] = src[i + k] + (values[4] - src[i + k]) * Math.min(1, amount);
      } else {
        const kernel = type === "sharpen" ? [0, -1, 0, -1, 5, -1, 0, -1, 0] : [-2, -1, 0, -1, 1, 1, 0, 1, 2];
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[(clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4 + k] * kernel[n++];
        const value = type === "emboss" ? 128 + sum - src[i + k] : sum;
        data[i + k] = src[i + k] + (value - src[i + k]) * Math.min(2, amount);
      }
    }
  }
  return data;
}
function morphAlpha(source, w, h, amount) {
  const r = Math.max(0, Math.min(50, Math.round(Math.abs(amount)))), dilate = amount > 0;
  if (!r) return new Uint8ClampedArray(source);
  const input = new Uint8Array(w * h), temp = new Uint8Array(w * h), result = new Uint8Array(w * h);
  for (let i = 0; i < input.length; i++) input[i] = source[i * 4 + 3];
  const queue = new Int32Array(Math.max(w, h) + r * 2 + 2), values = new Uint8Array(queue.length);
  function pass(src, out, length, lines, stride, lineStride) {
    for (let line = 0; line < lines; line++) {
      let head = 0, tail = 0;
      for (let i = -r; i < length + r; i++) {
        const value = i < 0 || i >= length ? 0 : src[line * lineStride + i * stride];
        while (tail > head && (dilate ? values[tail - 1] <= value : values[tail - 1] >= value)) tail--;
        queue[tail] = i;
        values[tail] = value;
        tail++;
        while (tail > head && queue[head] < i - r * 2) head++;
        const pos = i - r;
        if (pos >= 0 && pos < length) out[line * lineStride + pos * stride] = values[head];
      }
    }
  }
  pass(input, temp, w, h, 1, w);
  pass(temp, result, h, w, w, 1);
  const rgba = new Uint8ClampedArray(source.length);
  for (let i = 0; i < result.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = result[i];
  }
  return rgba;
}
export {
  FILTERS,
  boxBlur,
  filterPixels,
  morphAlpha
};
