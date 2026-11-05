export function validateRemovalRecipe(r, assertSource) {
  if (!r || r.version !== 1 || !['lama-texture-v1', 'lama-texture-v2'].includes(r.engine) || !Number.isInteger(r.variant) || r.variant < 0 || r.variant > 2) throw Error('Invalid removal recipe.');
  assertSource(r.source);
  if (r.selectionSource) assertSource(r.selectionSource);
  if (!r.settings || Object.keys(r.settings).some(k => !['grow', 'feather', 'foliage', 'branches', 'detail', 'nearby', 'solid', 'quality', 'keepMargin', 'audit'].includes(k))) throw Error('Invalid removal settings.');
  for (const [k, max] of [['grow', 12], ['feather', 4], ['detail', 100]]) if (!Number.isFinite(r.settings[k]) || r.settings[k] < 0 || r.settings[k] > max) throw Error('Invalid removal settings.');
  for (const k of ['foliage', 'branches', 'nearby', 'solid']) if (typeof r.settings[k] !== 'boolean') throw Error('Invalid removal settings.');
  if (r.settings.quality !== undefined && !['fast', 'deep'].includes(r.settings.quality) || r.settings.keepMargin !== undefined && (!Number.isFinite(r.settings.keepMargin) || r.settings.keepMargin < 0 || r.settings.keepMargin > 12) || r.settings.audit !== undefined && typeof r.settings.audit !== 'boolean') throw Error('Invalid removal quality settings.');
  if (r.keepers !== undefined && (!Array.isArray(r.keepers) || r.keepers.length > 8)) throw Error('Invalid protected people.');
  if (!Array.isArray(r.regions) || r.regions.length > 8) throw Error('Invalid removal regions.');
  for (const region of [...r.regions, ...(r.keepers || [])]) {
    if (region.semantic !== undefined && typeof region.semantic !== 'boolean') throw Error('Invalid semantic mask flag.');
    if (region.person !== undefined && typeof region.person !== 'boolean') throw Error('Invalid person marker.');
    if (region.nearby !== undefined && typeof region.nearby !== 'boolean' || region.groupId !== undefined && (typeof region.groupId !== 'string' || region.groupId.length > 80)) throw Error('Invalid removal region metadata.');
    assertSource(region.source);
    if (!Number.isInteger(region.width) || !Number.isInteger(region.height) || region.width < 1 || region.height < 1 || region.width > 1024 || region.height > 1024 || region.width * region.height > 1048576 || typeof region.label !== 'string' || region.label.length > 80) throw Error('Invalid removal region image.');
    const b = region.rect;
    if (!b || [b.x, b.y, b.width, b.height].some(n => !Number.isFinite(n)) || b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0 || b.x + b.width > 1.000001 || b.y + b.height > 1.000001) throw Error('Invalid removal region coordinates.');
    if (!Array.isArray(region.points) || region.points.length > 24 || region.points.some(p => !p || ![0, 1].includes(p.label) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw Error('Invalid removal points.');
  }
  if (!Array.isArray(r.strokes) || r.strokes.length > 80 || r.strokes.reduce((n, s) => n + (s.points?.length || 0), 0) > 20000 || r.strokes.some(s => !s || !['erase', 'protect'].includes(s.mode) || !Number.isFinite(s.radius) || s.radius < .001 || s.radius > .3 || !Array.isArray(s.points) || !s.points.length || s.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1)))) throw Error('Invalid removal strokes.');
  return r;
}
