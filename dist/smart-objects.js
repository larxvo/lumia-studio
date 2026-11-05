import {assertCanEdit} from './layer-policy.js';
import { createDocument, createLayer, clone, uid, assertDimensions, moveLayer } from "./model.js";
import { subtree, bounds, effectiveLocked } from "./pro-model.js";
import { canvas, renderDocument } from "./renderer.js";
function smartAsset(doc, layer) {
  return doc.smartObjects?.find((a) => a.id === layer?.smartObjectId) || null;
}
function convertSmartObject(doc, layer, assets) {
  if (!layer || layer.type === "adjustment" || effectiveLocked(doc, layer)) throw new Error("Chọn một layer hoặc nhóm đã mở khóa.");
  assertCanEdit(doc,[layer],"destructive",{descendants:true});
  if (layer.smartObjectId) return smartAsset(doc, layer);
  if ((doc.smartObjects?.length || 0) >= 30) throw new Error("Mỗi tài liệu hỗ trợ tối đa 30 nội dung Smart Object.");
  if (layer.clipToBelow || layer.blend === "pass-through") throw new Error("Bỏ clipping và dùng Normal trước khi chuyển thành Smart Object.");
  const members = subtree(doc, layer.id), ids = new Set(members.map((l) => l.id));
  let content, outer, source;
  if (["image", "paint"].includes(layer.type) && !layer.mask) {
    const image = assets.get(layer.source);
    if (!image) throw new Error("Nguồn ảnh chưa tải xong.");
    content = createDocument(image.width, image.height, layer.name);
    const raw = createLayer("image", { name: layer.name, source: layer.source, width: image.width, height: image.height });
    for (const key of ['photoRecipe', 'removalRecipe', 'productRecipe', 'cutoutRecipe', 'paperRecipe', 'colorRecipe', 'landscapeRecipe', 'sceneRecipe','artRecipe']) if (layer[key]) raw[key] = clone(layer[key]);
    content.layers = [raw];
    content.activeId = raw.id;
    source = layer.source;
    outer = clone(layer);
    for (const key of ['photoRecipe', 'removalRecipe', 'productRecipe', 'cutoutRecipe', 'paperRecipe', 'colorRecipe', 'landscapeRecipe', 'sceneRecipe','artRecipe']) delete outer[key];
  } else {
    const b = bounds([layer]), pad = Math.min(200, Math.ceil(Math.max(...members.map((l) => l.effects?.shadow ? (l.effects.shadowBlur || 20) * 2 + Math.abs(l.effects.shadowX || 0) + Math.abs(l.effects.shadowY || 0) : l.effects?.glow ? (l.effects.glowSize || 24) * 2 : 0))));
    const x = Math.floor(b.x - pad), y = Math.floor(b.y - pad), w = Math.ceil(b.width + pad * 2), h = Math.ceil(b.height + pad * 2);
    assertDimensions(w, h);
    content = createDocument(w, h, layer.name);
    content.layers = clone(members);
    for (const l of content.layers) {
      moveLayer(l, -x, -y,{forceMask:true});
      if (l.id === layer.id) {
        l.parentId = null;
        l.opacity = 1;
        l.blend = "normal";
        l.visible = true;
      }
    }
    content.activeId = layer.id;
    if (doc.fonts) content.fonts = clone(doc.fonts);
    const used = new Set(content.layers.map((l) => l.smartObjectId).filter(Boolean));
    if (used.size) content.smartObjects = clone(doc.smartObjects.filter((a) => used.has(a.id)));
    const c = renderDocument(content, assets);
    source = c.toDataURL();
    assets.set(source, c);
    outer = createLayer("image", { id: layer.id, name: layer.name, x, y, width: w, height: h, parentId: layer.parentId || null, opacity: layer.opacity, blend: layer.blend, visible: layer.visible });
  }
  const asset = { id: uid(), name: layer.name, width: content.width, height: content.height, source, document: content };
  outer.type = "image";
  outer.source = source;
  outer.smartObjectId = asset.id;
  outer.locked = false;
  doc.smartObjects ||= [];
  doc.smartObjects.push(asset);
  const index = doc.layers.indexOf(layer);
  doc.layers = doc.layers.filter((l) => !ids.has(l.id));
  doc.layers.splice(index, 0, outer);
  doc.activeId = outer.id;
  doc.selectedIds = [outer.id];
  return asset;
}
function replaceSmartContent(doc, assetId, image, assets, name = null, content = null) {
  const asset = doc.smartObjects?.find((a) => a.id === assetId);
  if (!asset) throw new Error("Nội dung Smart Object đã bị xóa.");
  assertCanEdit(doc,doc.layers.filter(l=>l.smartObjectId===assetId),"replacepixels");
  assertDimensions(image.width, image.height);
  const source = typeof image.source === "string" ? image.source : image.toDataURL();
  if (!assets.get(source) && typeof image.toDataURL === "function") assets.set(source, image);
  let nested = content;
  if (!nested) {
    nested = createDocument(image.width, image.height, name || asset.name);
    const l = createLayer("image", { name: name || asset.name, source, width: image.width, height: image.height });
    nested.layers = [l];
    nested.activeId = l.id;
  }
  Object.assign(asset, { source, width: image.width, height: image.height, document: clone(nested), name: name || asset.name });
  for (const l of doc.layers) if (l.smartObjectId === assetId) {
    l.source = source;
    for (const key of ['photoRecipe', 'removalRecipe', 'productRecipe', 'cutoutRecipe', 'paperRecipe', 'colorRecipe', 'landscapeRecipe', 'sceneRecipe','artRecipe']) delete l[key];
  }
  return asset;
}
function makeIndependent(doc, layer) {
  const original = smartAsset(doc, layer);
  if (!original) throw new Error("Chọn một Smart Object.");
  if (doc.smartObjects.length >= 30) throw new Error("Đã đạt giới hạn 30 Smart Object.");
  const asset = clone(original);
  asset.id = uid();
  asset.name += " · riêng";
  doc.smartObjects.push(asset);
  layer.smartObjectId = asset.id;
  return asset;
}
function smartContentDocument(doc, layer) {
  const asset = smartAsset(doc, layer);
  if (!asset) throw new Error("Chọn một Smart Object.");
  const nested = clone(asset.document || createDocument(asset.width, asset.height, asset.name));
  if (!nested.layers.length) {
    const l = createLayer("image", { source: asset.source, width: asset.width, height: asset.height });
    nested.layers = [l];
    nested.activeId = l.id;
  }
  nested.id = uid();
  nested.name = asset.name + " · nội dung";
  return nested;
}
export {
  convertSmartObject,
  makeIndependent,
  replaceSmartContent,
  smartAsset,
  smartContentDocument
};
