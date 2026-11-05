import { clone, uid } from './model.js';
import { captureCutout, assertCutoutSource } from './cutout-workflow.js';
import { validateProductRecipe } from './product-recipe.js';
export function captureProduct(doc, layer) {
  if (layer?.smartObjectId) throw Error('Mở Sửa nội dung Smart Object rồi retouch ảnh nguồn.');
  if (layer?.clipToBelow) throw Error('Tạo bản raster độc lập trước khi retouch layer clipping.');
  if (layer?.productRecipe && layer.locked) throw Error('Mở khóa layer trước khi sửa lại retouch sản phẩm.');
  return { ...captureCutout(doc, layer), selectionSignature: JSON.stringify(doc.selection) };
}
export function assertProductSource(doc, snapshot) {
  const layer = assertCutoutSource(doc, snapshot);
  if (JSON.stringify(doc.selection) !== snapshot.selectionSignature) throw Error('Vùng chọn đã thay đổi. Mở lại công cụ trước khi áp dụng.');
  return layer;
}
export function applyProduct(doc, snapshot, output, recipe, assets) {
  const current = assertProductSource(doc, snapshot), reopening = !!current.productRecipe;
  if (current.smartObjectId || current.clipToBelow || reopening && current.locked) throw Error('Layer hiện tại không cho phép retouch.');
  if (!reopening && doc.layers.length >= 150) throw Error('Đã đạt giới hạn 150 layer.');
  if(!Number.isSafeInteger(output?.width)||!Number.isSafeInteger(output.height)||output.width<1||output.height<1||!Number.isSafeInteger(output.width*output.height*4))throw Error('Invalid product retouch output.');
  validateProductRecipe(recipe, s => { if (typeof s !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(s) && s !== 'assets/wave.jpg') throw Error('Invalid product retouch source.'); });
  const source = output.toDataURL(), result = { ...clone(current), source, productRecipe: clone(recipe) };
  for (const k of ['photoRecipe', 'removalRecipe', 'cutoutRecipe', 'paperRecipe', 'colorRecipe', 'landscapeRecipe','sceneRecipe','artRecipe', 'generation', 'assistance']) delete result[k];
  if (!reopening) { result.id = uid(); result.visible = true; result.locked = false; result.name = current.name.slice(0, 140) + ' · Retouch sản phẩm'; }
  assets.set(source, output);
  if (reopening) Object.assign(current, result);
  else { doc.layers.splice(doc.layers.indexOf(current) + 1, 0, result); current.visible = false; }
  doc.activeId = result.id; doc.selectedIds = [result.id]; return result;
}
