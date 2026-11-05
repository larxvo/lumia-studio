export const PRODUCT_FIELDS = {
  amount: [0, 100, 1, 'Mức retouch', '%'], clean: [0, 100, 1, 'Giảm ám ố', '%'], neutral: [0, 100, 1, 'Trung hòa màu bạc', '%'], objectExposure: [-1.5, 1.5, .05, 'Độ sáng sản phẩm', ' EV'], contrast: [-50, 100, 1, 'Nổi khối kim loại', '%'], detail: [0, 100, 1, 'Chi tiết gốc', '%'], relight: [0, 100, 1, 'Tạo khối theo hướng sáng', '%'], angle: [-180, 180, 5, 'Hướng sáng', '°'], exposure: [-2, 2, .05, 'Phơi sáng toàn ảnh', ' EV'], shadows: [-100, 100, 1, 'Vùng tối', '%'], highlights: [-100, 100, 1, 'Vùng sáng', '%'], depth: [0, 100, 1, 'Độ sâu tương phản', '%'], temperature: [-100, 100, 1, 'Ấm / lạnh', '%'], contact: [0, 100, 1, 'Bóng tiếp xúc hiện có', '%'], background: [-100, 100, 1, 'Độ sáng hậu cảnh', '%'], vignette: [0, 100, 1, 'Tối góc nhẹ', '%'], grow: [-5, 5, 1, 'Nới / thu vùng chọn', ' px'], feather: [0, 5, 1, 'Mềm viền vào trong', ' px']
};
export const PRODUCT_DEFAULTS = { amount: 100, clean: 68, neutral: 90, objectExposure: .2, contrast: 24, detail: 20, relight: 18, angle: -45, scene: true, exposure: .2, shadows: 14, highlights: -22, depth: 18, temperature: -3, contact: 12, background: 0, vignette: 5, grow: 0, feather: 1 };
export const PRODUCT_PRESETS = [
  { id: 'silver', name: 'Bạc sáng sạch', note: 'Giảm ám ố · giữ vân và phản quang', params: { clean: 68, neutral: 90, objectExposure: .2, contrast: 24, detail: 20, relight: 18, angle: -45 } },
  { id: 'natural', name: 'Studio tự nhiên', note: 'Sáng hơn · giữ màu sản phẩm', params: { clean: 0, neutral: 0, objectExposure: .12, contrast: 12, detail: 16, relight: 10, angle: -45 } },
  { id: 'window', name: 'Ánh sáng cửa sổ', note: 'Sáng mềm · bóng có chiều sâu', params: { clean: 0, neutral: 0, objectExposure: .18, contrast: 18, detail: 12, relight: 32, angle: -45 } },
  { id: 'dramatic', name: 'Bạc tương phản', note: 'Phản quang rõ · giữ vùng tối', params: { clean: 48, neutral: 86, objectExposure: .12, contrast: 52, detail: 26, relight: 35, angle: -70 } }
];
export function productParams(input = {}) {
  const p = { ...PRODUCT_DEFAULTS, ...input };
  if (typeof p.scene !== 'boolean' || Object.keys(p).some(k => k !== 'scene' && !PRODUCT_FIELDS[k])) throw Error('Thông số retouch sản phẩm không hợp lệ.');
  for (const [k, [min, max]] of Object.entries(PRODUCT_FIELDS)) if (!Number.isFinite(p[k]) || p[k] < min || p[k] > max) throw Error('Thông số retouch sản phẩm không hợp lệ: ' + k);
  return p;
}
