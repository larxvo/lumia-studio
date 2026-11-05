let enginePromise;
const DEFAULT_COLOR = { workingSpace: "sRGB", intent: 1, blackPointCompensation: true, proof: false, profileName: "CMYK mẫu · Amethyst ISOcoated v2 300", profileData: null };
const bytesToBase64 = (bytes) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 16384) out += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(out);
};
const base64ToBytes = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
function validateICC(bytes, requiredSpace = null) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 132 || bytes.length > 6 * 1024 * 1024) throw new Error("ICC phải từ 132 byte đến 6 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = (p) => String.fromCharCode(...bytes.subarray(p, p + 4));
  const size = view.getUint32(0);
  if (size < 132 || size > bytes.length || tag(36) !== "acsp" || !["RGB ", "CMYK", "GRAY"].includes(tag(16))) throw new Error("Không đọc được cấu trúc ICC này.");
  const count = view.getUint32(128);
  if (count > 4096 || 132 + count * 12 > size) throw new Error("Bảng ICC không hợp lệ.");
  for (let i = 0; i < count; i++) {
    const p = 132 + i * 12, at = view.getUint32(p + 4), n = view.getUint32(p + 8);
    if (at > size || n > size - at) throw new Error("Dữ liệu ICC bị cắt.");
  }
  if (requiredSpace && tag(16).trim() !== requiredSpace) throw new Error("Hãy chọn ICC có không gian màu " + requiredSpace + ".");
  return { space: tag(16).trim(), bytes: bytes.slice(0, size) };
}
async function colorEngine(options = {}) {
  if (!enginePromise) enginePromise = import("./vendor/lcms/lcms.js").then((m) => m.instantiate({ locateFile: () => new URL("./vendor/lcms/lcms.wasm", import.meta.url).href, ...options })).catch((e) => {
    enginePromise = null;
    throw e;
  });
  return enginePromise;
}
async function getProfileBytes(settings = DEFAULT_COLOR, fetcher = fetch) {
  if (settings.profileData) return validateICC(base64ToBytes(settings.profileData), "CMYK").bytes;
  const response = await fetcher(new URL("./color/cmyk-demo.icc", import.meta.url));
  if (!response.ok) throw new Error("Không tải được ICC.");
  return validateICC(new Uint8Array(await response.arrayBuffer()), "CMYK").bytes;
}
async function profileInfo(bytes, options) {
  validateICC(bytes);
  const m = await colorEngine(options), p = m.cmsOpenProfileFromMem(bytes, bytes.length);
  if (!p) throw new Error("LittleCMS không mở được ICC.");
  try {
    return { name: m.cmsGetProfileInfoASCII(p, 0, "en", "US"), space: m.cmsGetColorSpaceASCII(p) };
  } finally {
    m.cmsCloseProfile(p);
  }
}
async function separateCMYK(rgba, profile, settings = DEFAULT_COLOR, options) {
  validateICC(profile, "CMYK");
  if (rgba.length % 4) throw new Error("Invalid RGB pixel buffer.");
  const m = await colorEngine(options), input = m.cmsCreate_sRGBProfile(), output = m.cmsOpenProfileFromMem(profile, profile.length);
  let t = 0;
  try {
    t = m.cmsCreateTransform(input, 262169, output, 393249, settings.intent ?? 1, settings.blackPointCompensation ? 8192 : 0);
    if (!t) throw new Error("ICC này không có phép chuyển sRGB sang CMYK.");
    const result = new Uint8Array(rgba.length), chunkSize = 65536;
    for (let start = 0; start < rgba.length / 4; start += chunkSize) {
      const count = Math.min(chunkSize, rgba.length / 4 - start), rgb = new Uint8Array(count * 3);
      for (let i = 0; i < count; i++) {
        const j = (start + i) * 4, a = rgba[j + 3] / 255;
        for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.round(rgba[j + k] * a + 255 * (1 - a));
      }
      result.set(m.cmsDoTransform(t, rgb, count), start * 4);
    }
    return result;
  } finally {
    if (t) m.cmsDeleteTransform(t);
    m.cmsCloseProfile(input);
    if (output) m.cmsCloseProfile(output);
  }
}
async function proofCMYK(rgba, profile, settings = DEFAULT_COLOR, options) {
  const cmyk = await separateCMYK(rgba, profile, settings, options), m = await colorEngine(options), input = m.cmsOpenProfileFromMem(profile, profile.length), output = m.cmsCreate_sRGBProfile();
  let t = 0;
  try {
    t = m.cmsCreateTransform(input, 393249, output, 262169, settings.intent ?? 1, settings.blackPointCompensation ? 8192 : 0);
    if (!t) throw new Error("ICC này không hỗ trợ xem thử CMYK.");
    const result = new Uint8ClampedArray(rgba.length);
    for (let start = 0; start < cmyk.length / 4; start += 65536) {
      const n = Math.min(65536, cmyk.length / 4 - start), rgb = m.cmsDoTransform(t, cmyk.subarray(start * 4, (start + n) * 4), n);
      for (let i = 0; i < n; i++) {
        result[(start + i) * 4] = rgb[i * 3];
        result[(start + i) * 4 + 1] = rgb[i * 3 + 1];
        result[(start + i) * 4 + 2] = rgb[i * 3 + 2];
        result[(start + i) * 4 + 3] = 255;
      }
    }
    return result;
  } finally {
    if (t) m.cmsDeleteTransform(t);
    m.cmsCloseProfile(input);
    m.cmsCloseProfile(output);
  }
}
function encodeCMYKTiff(width, height, cmyk, profile, dpi = 300) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || cmyk.length !== width * height * 4) throw new Error("Kích thước TIFF không hợp lệ.");
  validateICC(profile, "CMYK");
  dpi = Math.max(1, Math.min(2400, Math.round(dpi) || 300));
  const n = 16, ifdEnd = 8 + 2 + n * 12 + 4, bits = ifdEnd, rx = bits + 8, ry = rx + 8, icc = ry + 8, software=icc+profile.length, softwareBytes=new TextEncoder().encode("Luma Studio - Larx Vo - vovinhlac.com\0"), offset = Math.ceil((software+softwareBytes.length)/4)*4;
  if(offset+cmyk.length>0xffffffff)throw Error('TIFF cổ điển vượt4GB; cần chia ảnh hoặc dùng định dạng hỗ trợ BigTIFF.');
  const out = new Uint8Array(offset + cmyk.length), v = new DataView(out.buffer);
  out.set([73, 73, 42, 0]);
  v.setUint32(4, 8, true);
  v.setUint16(8, n, true);
  const tags = [[256, 4, 1, width], [257, 4, 1, height], [258, 3, 4, bits], [259, 3, 1, 1], [262, 3, 1, 5], [273, 4, 1, offset], [277, 3, 1, 4], [278, 4, 1, height], [279, 4, 1, cmyk.length], [282, 5, 1, rx], [283, 5, 1, ry], [284, 3, 1, 1], [296, 3, 1, 2], [332, 3, 1, 1], [34675, 7, profile.length, icc],[305,2,softwareBytes.length,software]];
  tags.sort((a,b)=>a[0]-b[0]).forEach(([tag, type, count, value], i) => {
    const p = 10 + i * 12;
    v.setUint16(p, tag, true);
    v.setUint16(p + 2, type, true);
    v.setUint32(p + 4, count, true);
    v.setUint32(p + 8, value, true);
  });
  for (let i = 0; i < 4; i++) v.setUint16(bits + i * 2, 8, true);
  for (const p of [rx, ry]) {
    v.setUint32(p, dpi, true);
    v.setUint32(p + 4, 1, true);
  }
  out.set(profile, icc);
  out.set(softwareBytes,software);
  out.set(cmyk, offset);
  return out;
}
export {
  DEFAULT_COLOR,
  base64ToBytes,
  bytesToBase64,
  colorEngine,
  encodeCMYKTiff,
  getProfileBytes,
  profileInfo,
  proofCMYK,
  separateCMYK,
  validateICC
};
