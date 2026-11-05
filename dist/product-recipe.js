import { PRODUCT_PRESETS, PRODUCT_FIELDS, productParams } from './product-settings.js';
export function validateProductRecipe(r, assertSource) {
  if (!r || r.version !== 1 || r.engine !== 'product-tone-v1' || !PRODUCT_PRESETS.some(p => p.id === r.preset)) throw Error('Invalid product retouch recipe.');
  assertSource(r.source);
  if (r.lowDetailWarning !== undefined && typeof r.lowDetailWarning !== 'boolean') throw Error('Invalid product detail warning.');
  if (r.selectionSource) assertSource(r.selectionSource);
  if (!r.params || Object.keys(r.params).length !== Object.keys(PRODUCT_FIELDS).length + 1) throw Error('Invalid product retouch parameters.');
  productParams(r.params);
  const region = r.region;
  if (!region || !Number.isInteger(region.width) || !Number.isInteger(region.height) || region.width < 1 || region.height < 1 || region.width > 1024 || region.height > 1024 || region.width * region.height > 1048576) throw Error('Invalid product retouch mask.');
  assertSource(region.source);
  const b = region.rect;
  if (!b || [b.x, b.y, b.width, b.height].some(n => !Number.isFinite(n)) || b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0 || b.x + b.width > 1.000001 || b.y + b.height > 1.000001) throw Error('Invalid product retouch coordinates.');
  if (region.point && (!Number.isFinite(region.point.x) || !Number.isFinite(region.point.y) || region.point.x < 0 || region.point.y < 0 || region.point.x > 1 || region.point.y > 1)) throw Error('Invalid product retouch point.');
  if (!Array.isArray(r.strokes) || r.strokes.length > 80 || r.strokes.reduce((n, s) => n + (s.points?.length || 0), 0) > 20000 || r.strokes.some(s => !s || s.type !== 'product' || typeof s.add !== 'boolean' || !Number.isFinite(s.radius) || s.radius < .001 || s.radius > .3 || !Array.isArray(s.points) || !s.points.length || s.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1)))) throw Error('Invalid product retouch strokes.');
  return r;
}
