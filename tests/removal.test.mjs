import test from 'node:test';
import assert from 'node:assert/strict';
import { expandMask, prepareRemovalMask, foregroundProtection, transferRemovalDetail, acceptNearby, maskBounds } from '../dist/removal-math.js';
import { removalGroups, removalInput, runRemoval } from '../dist/removal-engine.js';
import { validateRemovalRecipe } from '../dist/removal-recipe.js';
const W = 96, H = 80;
function pixels(w = W, h = H) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([140 + x % 7, 110 + y % 5, 82, 217], (y * w + x) * 4); return d; }
function rectangle(w = W, h = H, x = 30, y = 25, ww = 30, hh = 30) { const m = new Float32Array(w * h); for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) m[yy * w + xx] = 1; return m; }
const region = values => ({ values, width: W, height: H, rect: { x: 0, y: 0, width: 1, height: 1 }, label: 'Object', points: [] });
function exteriorExact(a, b, mask) { for (let i = 0; i < mask.length; i++) { assert.equal(a[i * 4 + 3], b[i * 4 + 3]); if (!mask[i]) assert.deepEqual(a.slice(i * 4, i * 4 + 4), b.slice(i * 4, i * 4 + 4)); } }
test('mask dilation expands only the object, never the photograph border, and empty masks stay empty', () => {
  const mask = rectangle(), expanded = expandMask(mask, W, H, 4);
  assert.equal(expanded[25 * W + 26], 1); assert.equal(expanded[0], 0); assert.equal(expanded.at(-1), 0); assert.equal(expandMask(new Float32Array(W * H), W, H, 4).reduce((a, b) => a + b, 0), 0);
});
test('connected visible leaves are protected while blue plastic and isolated green clothing are not', () => {
  const d = pixels(), m = rectangle();
  for (let y = 39; y < 43; y++) for (let x = 10; x < 85; x++) d.set([38, 120, 46, 217], (y * W + x) * 4);
  for (let y = 47; y < 51; y++) for (let x = 42; x < 47; x++) d.set([30, 130, 42, 217], (y * W + x) * 4);
  for (let y = 29; y < 34; y++) for (let x = 30; x < 65; x++) d.set([160, 190, 200, 217], (y * W + x) * 4);
  const p = foregroundProtection(d, W, H, m, { branches: false });
  assert.equal(p[40 * W + 45], 1); assert.equal(p[49 * W + 44], 0); assert.equal(p[31 * W + 45], 0);
  const prepared = prepareRemovalMask(d, W, H, [region(m)], [], { grow: 0, feather: 0, branches: false });
  assert.equal(prepared.mask[40 * W + 45], 0); assert.equal(prepared.mask[49 * W + 44], 1); assert.equal(prepared.mask[31 * W + 45], 1);
});
test('manual erase overrides leaf protection and manual keep remains exact after expansion and inward feather', () => {
  const d = pixels(), m = rectangle(); for (let x = 0; x < W; x++) d.set([25, 135, 45, 217], (40 * W + x) * 4);
  const s = [{ mode: 'erase', radius: .04, points: [[45 / W, 40 / H]] }, { mode: 'protect', radius: .035, points: [[45 / W, 30 / H]] }];
  const p = prepareRemovalMask(d, W, H, [region(m)], s, { grow: 3, feather: 1, branches: false });
  assert.ok(p.mask[40 * W + 45] > .9); assert.equal(p.mask[30 * W + 45], 0); assert.ok(p.excluded[40 * W + 45]); assert.equal(p.mask[0], 0);
});
test('crop-coordinate regions map into full-resolution source coordinates instead of stretching the whole mask', () => {
  const d = pixels(), values = new Float32Array(16).fill(1), p = prepareRemovalMask(d, W, H, [{ values, width: 4, height: 4, rect: { x: .5, y: .5, width: .25, height: .25 } }], [], { grow: 0, feather: 0, foliage: false });
  assert.equal(p.mask[45 * W + 55], 1); assert.equal(p.mask[20 * W + 20], 0); assert.equal(p.bounds.width, 24);
});
test('separated people get independent local repair groups rather than a downscaled full-frame crop', () => {
  const w = 1800, h = 1200, mask = new Float32Array(w * h); for (const x of [60, 1500]) for (let y = 500; y < 700; y++) for (let xx = x; xx < x + 100; xx++) mask[y * w + xx] = 1;
  const groups = removalGroups(mask, w, h); assert.equal(groups.length, 2); assert.ok(groups.every(g => g.right - g.x < 150 && g.bottom - g.y < 230));
});
test('alternative backgrounds actually change the context crop even for small objects in a large image', () => {
  const w = 1000, h = 800, d = pixels(w, h), m = rectangle(w, h, 460, 360, 40, 70), group = { x: 460, y: 360, right: 500, bottom: 430 };
  const variants = [0, 1, 2].map(n => removalInput(d, w, h, m, group, n)); assert.deepEqual(variants.map(r => r.crop.side), [512, 640, 768]); assert.notDeepEqual(variants[0].input, variants[1].input);
});
test('the removal processor preserves source dimensions, exterior bytes and alpha, and refuses empty or invalid predictions', async () => {
  const data = pixels(), original = new Uint8ClampedArray(data), mask = rectangle(), prediction = new Float32Array(3 * 512 * 512).fill(.3), calls = [];
  const out = await runRemoval({ data, width: W, height: H, mask, settings: { detail: 0 } }, async input => { calls.push(input); return prediction; });
  assert.equal(out.width, W); assert.equal(out.height, H); assert.equal(calls.length, 1); assert.ok(out.stats.changedPixels > 500); assert.equal(out.stats.outsideChangedBytes, 0); exteriorExact(data, out.data, mask); assert.deepEqual(data, original);
  await assert.rejects(runRemoval({ data, width: W, height: H, mask: new Float32Array(W * H) }, async () => prediction), /Bấm/);
  await assert.rejects(runRemoval({ data, width: W, height: H, mask }, async () => new Float32Array(8)), /không hợp lệ/);
});
test('detail transfer uses original unmasked texture while leaving protected/exterior pixels untouched', () => {
  const source = pixels(), mask = rectangle(), generated = new Uint8ClampedArray(source), excluded = expandMask(mask, W, H, 8);
  for (let i = 3; i < source.length; i += 4) source[i] = generated[i] = 255;
  for (let i = 0; i < mask.length; i++) if (mask[i]) generated.set([142, 112, 82, 255], i * 4);
  const out = transferRemovalDetail(source, generated, W, H, mask, excluded, .8);
  assert.ok(out.samples > 0); assert.notDeepEqual(out.data, generated); exteriorExact(generated, out.data, mask);
  const zero = transferRemovalDetail(source, generated, W, H, mask, excluded, 0); assert.deepEqual(zero.data, generated);
});
test('nearby suggestions reject large background, vegetation and already-selected body regions', () => {
  const d = pixels(), base = rectangle(), prop = rectangle(W, H, 22, 43, 12, 12);
  assert.equal(acceptNearby(prop, base, d, W, H), true); assert.equal(acceptNearby(base, base, d, W, H), false); assert.equal(acceptNearby(new Float32Array(W * H).fill(1), base, d, W, H), false);
  for (let i = 0; i < prop.length; i++) if (prop[i]) d.set([20, 120, 30, 217], i * 4); assert.equal(acceptNearby(prop, base, d, W, H), false);
});
test('optional nearby cleanup covers disconnected fragments but preserves green foreground islands and can be disabled', () => {
  const d = pixels(), m = rectangle(W, H, 35, 30, 16, 16); for (let y = 48; y < 52; y++) for (let x = 42; x < 46; x++) d.set([20, 140, 45, 217], (y * W + x) * 4);
  const r = { ...region(m), nearby: true }, p = prepareRemovalMask(d, W, H, [r], [], { grow: 0, feather: 0, branches: false });
  assert.ok(p.mask[52 * W + 52] > .9); assert.equal(p.mask[50 * W + 44], 0); assert.equal(p.protection[50 * W + 44], 1);
  const off = prepareRemovalMask(d, W, H, [r], [], { grow: 0, feather: 0, nearby: false }); assert.equal(off.mask[52 * W + 52], 0);
});
test('saved removal recipes validate bounded masks/settings and reject unsafe sources, coordinates or strokes', () => {
  const source = 'data:image/png;base64,AAAA', r = { version: 1, engine: 'lama-texture-v1', variant: 0, source, settings: { grow: 3, feather: 1, detail: 55, foliage: true, branches: true, nearby: true, solid: true }, regions: [{ source, width: 96, height: 80, rect: { x: 0, y: 0, width: 1, height: 1 }, points: [], label: 'Person' }], strokes: [] }, check = s => { if (!s.startsWith('data:image/')) throw Error('unsafe'); };
  validateRemovalRecipe(r, check);
  for (const patch of [{ source: 'https://evil/image' }, { variant: 9 }, { settings: { ...r.settings, detail: Infinity } }, { regions: [{ ...r.regions[0], rect: { x: .9, y: 0, width: .8, height: 1 } }] }, { strokes: [{ mode: 'erase', radius: 10, points: [[.5, .5]] }] }]) assert.throws(() => validateRemovalRecipe({ ...r, ...patch }, check));
  assert.throws(() => prepareRemovalMask(pixels(), W, H, [region(new Float32Array(W * H).fill(1))]), /quá lớn/);
});
