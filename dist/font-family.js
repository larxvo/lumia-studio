// Family names are Unicode metadata, never CSS declarations or file paths.
export function validFontFamily(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160 && !/[\u0000-\u001f\u007f"'\\;<>{}]/u.test(value);
}
export const fontFamily = value => validFontFamily(value) ? value : 'Arial';
