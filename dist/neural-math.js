function samplePlanar(data, size, channels, x, y, k) {
  x = Math.max(0, Math.min(size - 1, x));
  y = Math.max(0, Math.min(size - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1), tx = x - x0, ty = y - y0, offset = k * size * size;
  return (data[offset + y0 * size + x0] * (1 - tx) + data[offset + y0 * size + x1] * tx) * (1 - ty) + (data[offset + y1 * size + x0] * (1 - tx) + data[offset + y1 * size + x1] * tx) * ty;
}
function inpaintInput(data, width, height, mask) {
  if (data.length !== width * height * 4 || mask.length !== width * height) throw new Error("Invalid inpainting dimensions.");
  let left = width, top = height, right = 0, bottom = 0, count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.01) {
    const x = i % width, y = Math.floor(i / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
    count++;
  }
  if (!count) throw new Error("Tô hoặc chọn vùng cần tái dựng trước.");
  if (count > mask.length * 0.85) throw new Error("Giữ lại ít nhất 15% ảnh làm ngữ cảnh cho AI.");
  const size = 512, side = Math.max(128, Math.ceil(Math.max(right - left, bottom - top) * 1.65)), cx = (left + right) / 2, cy = (top + bottom) / 2;
  const crop = { x: Math.max(Math.min(cx - side / 2, width - side), 0), y: Math.max(Math.min(cy - side / 2, height - side), 0), side };
  const input = new Float32Array(4 * size * size), n = size * size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ox = Math.max(0, Math.min(width - 1, Math.floor(crop.x + (x + 0.5) * side / size))), oy = Math.max(0, Math.min(height - 1, Math.floor(crop.y + (y + 0.5) * side / size))), j = oy * width + ox, i = y * size + x, m = mask[j] > 0.15 ? 1 : 0;
    for (let k = 0; k < 3; k++) input[k * n + i] = m ? 0 : data[j * 4 + k] / 255;
    input[3 * n + i] = m;
  }
  return { input, crop };
}
function composeInpaint(source, width, height, mask, output, crop) {
  if (output.length !== 3 * 512 * 512) throw new Error("Invalid neural output.");
  const result = new Uint8ClampedArray(source);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const j = y * width + x, w = Math.max(0, Math.min(1, mask[j]));
    if (!w) continue;
    const px = (x + 0.5 - crop.x) * 512 / crop.side - 0.5, py = (y + 0.5 - crop.y) * 512 / crop.side - 0.5;
    for (let k = 0; k < 3; k++) {
      const v = samplePlanar(output, 512, 3, px, py, k);
      if (!Number.isFinite(v)) throw new Error("AI trả về pixel không hợp lệ.");
      result[j * 4 + k] = source[j * 4 + k] + (Math.max(0, Math.min(255, v * 255)) - source[j * 4 + k]) * w;
    }
    result[j * 4 + 3] = source[j * 4 + 3] + (255 - source[j * 4 + 3]) * w;
  }
  return result;
}
function blendGenerated(source, generated, mask, amount = 1) {
  if (source.length !== generated.length || source.length % 4 || mask && mask.length !== source.length / 4) throw new Error("Invalid generated image.");
  const out = new Uint8ClampedArray(source);
  amount = Math.max(0, Math.min(1, amount));
  for (let i = 0; i < out.length; i += 4) {
    const a = amount * (mask ? mask[i / 4] : 1);
    for (let k = 0; k < 4; k++) out[i + k] = source[i + k] + a * (generated[i + k] - source[i + k]);
  }
  return out;
}
export {
  blendGenerated,
  composeInpaint,
  inpaintInput,
  samplePlanar
};
