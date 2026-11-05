const linear = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
function rgbToLightness(r, g, b) {
  const y = 0.2126729 * linear(r) + 0.7151522 * linear(g) + 0.072175 * linear(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : 24389 / 27 * y;
}
function colorizationInput(rgba) {
  const input = new Float32Array(rgba.length / 4);
  for (let i = 0; i < input.length; i++) input[i] = rgbToLightness(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]);
  return input;
}
const invf = (t) => t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29);
const srgb = (t) => 255 * Math.min(1, Math.max(0, t <= 31308e-7 ? 12.92 * t : 1.055 * Math.max(0, t) ** (1 / 2.4) - 0.055));
function labToRgb(L, a, b) {
  const fy = (L + 16) / 116, x = invf(fy + a / 500) * 0.95047, y = invf(fy), z = invf(fy - b / 200) * 1.08883;
  return [srgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z), srgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z), srgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z)];
}
function composeColorizedRGBA(source, width, height, ab, amount = 1) {
  if (source.length !== width * height * 4 || ab.length !== 2 * 256 * 256) throw Error("Invalid colorization dimensions");
  const out = new Uint8ClampedArray(source), n = 65536;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const fx = Math.max(0, Math.min(255, (x + 0.5) * 256 / width - 0.5)), fy = Math.max(0, Math.min(255, (y + 0.5) * 256 / height - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1), tx = fx - x0, ty = fy - y0;
    const sample = (k) => (ab[k * n + y0 * 256 + x0] * (1 - tx) + ab[k * n + y0 * 256 + x1] * tx) * (1 - ty) + (ab[k * n + y1 * 256 + x0] * (1 - tx) + ab[k * n + y1 * 256 + x1] * tx) * ty;
    const i = (y * width + x) * 4, L = rgbToLightness(source[i], source[i + 1], source[i + 2]), rgb = labToRgb(L, sample(0), sample(1));
    for (let k = 0; k < 3; k++) out[i + k] = source[i + k] + amount * (rgb[k] - source[i + k]);
  }
  return out;
}
export {
  colorizationInput,
  composeColorizedRGBA,
  labToRgb,
  rgbToLightness
};
