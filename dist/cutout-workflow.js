import {canEdit} from './layer-policy.js';
import { canvas, maskCanvas } from './renderer.js';
import { clone, uid } from './model.js';
import { ancestors } from './pro-model.js';
import { checkMask } from './cutout-math.js';

export function alphaCanvas(alpha, width, height) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height*4)||alpha.length!==width*height||alpha.some(v=>!Number.isFinite(v)))throw Error('Invalid native mask size.');
  const c = canvas(width, height), x = c.getContext('2d'), p = x.createImageData(width, height);
  for (let i = 0; i < alpha.length; i++) { p.data[i * 4] = p.data[i * 4 + 1] = p.data[i * 4 + 2] = 255; p.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, alpha[i])) * 255); }
  x.putImageData(p, 0, 0); return c;
}
export function captureCutout(doc, layer) {
  if (!doc || !layer || !['image', 'paint'].includes(layer.type) || !layer.source) throw Error('Mở ảnh hoặc chọn một layer ảnh trước.');
  if (ancestors(doc, layer).some(g => g.locked)) throw Error('Mở khóa nhóm cha trước khi tách ảnh.');
  return { docId: doc.id, width: doc.width, height: doc.height, layerId: layer.id, layer: clone(layer), signature: JSON.stringify(layer) };
}
export function assertCutoutSource(doc, snapshot) {
  const layer = doc?.layers.find(l => l.id === snapshot.layerId);
  if (doc?.id !== snapshot.docId || doc.width !== snapshot.width || doc.height !== snapshot.height || !layer || JSON.stringify(layer) !== snapshot.signature || ancestors(doc, layer).some(g => g.locked)) throw Error('Layer nguồn đã thay đổi. Mở lại công cụ để tránh áp dụng nhầm.');
  return layer;
}
export function documentCutoutMask(doc, layer, mask, assets, combine = true) {
  const result = canvas(doc.width, doc.height), x = result.getContext('2d');
  x.save(); x.translate(layer.x + layer.width / 2, layer.y + layer.height / 2); x.rotate((layer.rotation || 0) * Math.PI / 180); x.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
  x.drawImage(mask, -layer.width / 2, -layer.height / 2, layer.width, layer.height); x.restore();
  if (combine && layer.mask) { x.globalCompositeOperation = 'destination-in'; x.drawImage(maskCanvas(doc, layer.mask, 1, assets), 0, 0); x.globalCompositeOperation = 'source-over'; }
  return result;
}
export function localExistingMask(doc, layer, assets, width, height) {
  if (!layer.mask) return null;
  const c = canvas(width, height), x = c.getContext('2d');
  x.scale(width / layer.width, height / layer.height); x.translate(layer.width / 2, layer.height / 2); x.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1); x.rotate(-(layer.rotation || 0) * Math.PI / 180); x.translate(-layer.x - layer.width / 2, -layer.y - layer.height / 2);
  x.drawImage(maskCanvas(doc, layer.mask, 1, assets), 0, 0);
  return c;
}
export function applyCutouts(doc, snapshot, cuts, assets, { output = 'copy', combine = true } = {}) {
  const layer = assertCutoutSource(doc, snapshot);
  if (!Array.isArray(cuts) || !cuts.length || cuts.length > 8) throw Error('Giữ từ 1 đến 8 đối tượng mỗi lần.');
  if (!['copy', 'selection', 'mask'].includes(output)) throw Error('Invalid cutout output.');
  if (output !== 'copy' && cuts.length !== 1) throw Error('Chọn tạo layer riêng khi giữ nhiều đối tượng.');
  if (output === 'copy' && doc.layers.length + cuts.length > 150) throw Error('Tạo các đối tượng này sẽ vượt giới hạn 150 layer.');
  if(output==='mask'&&cuts[0].source&&!canEdit(doc,layer,'replacepixels'))throw Error('Mở khóa pixel/độ trong trước khi đổi màu viền.');
  if (output === 'mask' && layer.locked) throw Error('Mở khóa layer hoặc chọn Tạo layer riêng.');
  for (const cut of cuts) if (cut.source && !/^data:image\/png;base64,/.test(cut.source)) throw Error('Invalid corrected foreground.');
  if (output === 'mask' && layer.smartObjectId && cuts[0].source) throw Error('Chọn Layer riêng hoặc mở nội dung Smart Object để chỉnh màu viền.');
  // Prepare every mask before mutating any layer or the document.
  const masks = cuts.map(cut => {
    const c = documentCutoutMask(doc, layer, alphaCanvas(cut.values, cut.width, cut.height), assets, combine), source = c.toDataURL();
    return { c, source, mask: { type: 'paint', source, x: 0, y: 0, width: doc.width, height: doc.height, feather: 0, invert: false } };
  });
  for (const m of masks) assets.set(m.source, m.c);
  if (output === 'selection') { doc.selection = masks[0].mask; return []; }
  if (output === 'mask') { layer.mask = masks[0].mask; if (cuts[0].source) { layer.cutoutRecipe = { version: 1, source: layer.cutoutRecipe?.source || layer.source, decontaminate: cuts[0].decontaminate || 0 }; layer.source = cuts[0].source; for (const k of ['photoRecipe', 'removalRecipe', 'productRecipe', 'paperRecipe', 'colorRecipe', 'landscapeRecipe', 'sceneRecipe','artRecipe']) delete layer[k]; } return [layer]; }
  const copies = masks.map((m, i) => {
    const copy = { ...clone(layer), id: uid(), name: `${layer.name.slice(0, 150)} · ${String(cuts[i].name || 'Tách nền').slice(0, 40)}`, locked: false, locks: {}, visible: true, clipToBelow: false, mask: m.mask };
    if (cuts[i].source) { copy.source = cuts[i].source; delete copy.smartObjectId; copy.cutoutRecipe = { version: 1, source: layer.cutoutRecipe?.source || layer.source, decontaminate: cuts[i].decontaminate || 0 }; for (const k of ['photoRecipe', 'removalRecipe', 'productRecipe', 'paperRecipe', 'colorRecipe', 'landscapeRecipe', 'sceneRecipe','artRecipe']) delete copy[k]; }
    return copy;
  });
  doc.layers.splice(doc.layers.indexOf(layer) + 1, 0, ...copies);
  layer.visible = false; doc.activeId = copies.at(-1).id; doc.selectedIds = copies.map(l => l.id);
  return copies;
}
