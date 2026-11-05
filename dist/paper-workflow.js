import { clone, uid } from './model.js';
import { captureRemoval } from './removal-workflow.js';
import { assertCutoutSource } from './cutout-workflow.js';
import { validatePaperRecipe } from './paper-recipe.js';
export function capturePaper(doc, layer) { if (layer?.paperRecipe && layer.locked) throw Error('Mở khóa layer tài liệu để sửa tiếp.'); return captureRemoval(doc, layer); }
export function applyPaper(doc, snapshot, output, recipe, assets) {
  const layer = assertCutoutSource(doc, snapshot), reopening = !!layer.paperRecipe;
  if (layer.smartObjectId || layer.clipToBelow || reopening && layer.locked) throw Error('Layer tài liệu không còn phù hợp.');
  if (!reopening && doc.layers.length >= 150) throw Error('Đã đạt giới hạn layer.');
  if (!output?.width || !output.height) throw Error('Invalid document output.');
  validatePaperRecipe(recipe, s => { if (typeof s !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(s) && s !== 'assets/wave.jpg') throw Error('Invalid paper source.'); });
  const source = output.toDataURL(), next = { ...clone(layer), source, paperRecipe: clone(recipe) }; for (const k of ['photoRecipe', 'removalRecipe', 'productRecipe', 'cutoutRecipe', 'colorRecipe', 'landscapeRecipe','sceneRecipe','artRecipe', 'generation', 'assistance']) delete next[k];
  if (!reopening) { next.id = uid(); next.name = layer.name.slice(0, 140) + ' · Làm sạch tài liệu'; next.visible = true; next.locked = false; }
  assets.set(source, output); if (reopening) Object.assign(layer, next); else { doc.layers.splice(doc.layers.indexOf(layer) + 1, 0, next); layer.visible = false; } doc.activeId = next.id; doc.selectedIds = [next.id]; return next;
}
