import { clone, uid } from './model.js';
import { captureCutout, assertCutoutSource, localExistingMask } from './cutout-workflow.js';
import { validateRemovalRecipe } from './removal-recipe.js';
export function captureRemoval(doc, layer) {
  if (layer?.smartObjectId) throw Error('Mở Sửa nội dung Smart Object rồi xóa vật thể trong ảnh nguồn.');
  if (layer?.clipToBelow) throw Error('Tạo bản raster độc lập trước khi xóa trên layer clipping.');
  return captureCutout(doc, layer);
}
export function removalSelection(doc, layer, assets, w, h) {
  if (!doc.selection) return null;
  const image = localExistingMask(doc, { ...layer, mask: doc.selection }, assets, w, h);
  const rgba = image.getContext('2d').getImageData(0, 0, w, h).data;
  return Float32Array.from({ length: w * h }, (_, i) => rgba[i * 4 + 3] / 255);
}
export function applyRemoval(doc, snapshot, canvas, recipe, assets) {
  const current = assertCutoutSource(doc, snapshot), reopening = !!current.removalRecipe;
  if (current.smartObjectId || current.clipToBelow) throw Error('Ảnh nguồn không còn phù hợp để áp dụng.');
  if (!reopening && doc.layers.length >= 150) throw Error('Đã đạt giới hạn 150 layer.');
  if (!canvas?.width) throw Error('Invalid removal output.');
  validateRemovalRecipe(recipe, s => { if (typeof s !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(s) && s !== 'assets/wave.jpg') throw Error('Invalid embedded removal source.'); });
  const source = canvas.toDataURL(), result = { ...clone(current), source, removalRecipe: clone(recipe) };
  delete result.photoRecipe; delete result.productRecipe; delete result.cutoutRecipe; delete result.paperRecipe; delete result.colorRecipe; delete result.landscapeRecipe; delete result.sceneRecipe; delete result.artRecipe; delete result.generation; delete result.assistance;
  if (!reopening) { result.id = uid(); result.locked = false; result.visible = true; result.name = current.name.slice(0, 140) + ' · Xóa vật thể'; }
  assets.set(source, canvas);
  if (reopening) Object.assign(current, result);
  else { doc.layers.splice(doc.layers.indexOf(current) + 1, 0, result); current.visible = false; }
  doc.activeId = result.id; doc.selectedIds = [result.id];
  return result;
}
