import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { setupDOM } from './ui-harness.mjs';
import { createDocument, createLayer, validateDocument, clone, History } from '../dist/model.js';
import { Assets, renderDocument } from '../dist/renderer.js';
import { semanticRegions, regionMask, samMask, refineAlpha } from '../dist/cutout-math.js';
import { applyCutouts, captureCutout, localExistingMask } from '../dist/cutout-workflow.js';
import { loadCutoutModel } from '../dist/cutout-models.js';

await setupDOM();
test('semantic regions split disconnected same-class subjects, discard tiny noise, and choose an in-region prompt', () => {
  const labels = new Uint8Array(100);
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) labels[y * 10 + x] = 15;
  for (let y = 6; y < 9; y++) for (let x = 6; x < 9; x++) labels[y * 10 + x] = 15;
  labels[9] = 8;
  const result = semanticRegions(labels, 10, 10, { minArea: 4 });
  assert.equal(result.regions.length, 2); assert.equal(result.regions[0].label, 'Người');
  for (const r of result.regions) { const at = Math.floor(r.point.y * 10) * 10 + Math.floor(r.point.x * 10); assert.equal(result.map[at], r.id); }
  assert.equal(regionMask(result, 1, 10, 10).reduce((a, b) => a + b), 9);
});
test('SAM mask removes right/bottom padding before mapping landscape and portrait coordinates', () => {
  const logits = new Float32Array(3 * 256 * 256).fill(-10);
  for (let y = 0; y < 128; y++) logits.fill(10, y * 256, (y + 1) * 256);
  const landscape = samMask(logits, 0, 1024, 512, 200, 100);
  assert.ok(landscape[90 * 200 + 100] > .99, 'lower source image must not inherit padded lower half');
  assert.ok(samMask(logits, 0, 1024, 1024, 200, 200)[180 * 200 + 100] < .01);
  logits.fill(-10); for (let y = 0; y < 256; y++) logits.fill(10, y * 256, y * 256 + 128);
  assert.ok(samMask(logits, 0, 512, 1024, 100, 200)[100 * 100 + 90] > .99);
});
test('default refinement keeps fractional hair alpha; grow, erode and inversion change mask predictably', () => {
  const input = new Float32Array([0, .1, .3, .7, .9, 1]);
  assert.deepEqual(refineAlpha(input, 6, 1), input);
  const binary = new Float32Array(7 * 7); for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) binary[y * 7 + x] = 1;
  assert.equal(refineAlpha(binary, 7, 7, { grow: 1 }).reduce((a, b) => a + b), 25);
  assert.equal(refineAlpha(binary, 7, 7, { grow: -1 }).reduce((a, b) => a + b), 1);
  assert.deepEqual([...refineAlpha(new Float32Array([0, 1]), 2, 1, { invert: true })], [1, 0]);
  assert.throws(() => refineAlpha(new Float32Array([NaN]), 1, 1), /Invalid/);
});
function fixture() {
  const d = createDocument(12, 12, 'Cutout transform'), c = createCanvas(4, 2); c.getContext('2d').fillStyle = '#f00000'; c.getContext('2d').fillRect(0, 0, 4, 2);
  const source = c.toDataURL(), assets = new Assets(); assets.set(source, c);
  const l = createLayer('image', { name: 'Original', source, x: 4, y: 4, width: 4, height: 2, rotation: 90, flipX: true, locked: true, mask: { type: 'rect', x: 5, y: 5, width: 1, height: 2, feather: 0, invert: false } });
  d.layers = [l]; d.activeId = l.id;
  return { d, l, c, source, assets, cut: { name: 'Part', values: new Float32Array([1, 1, 0, 0, 1, 1, 0, 0]), width: 4, height: 2 } };
}
test('cutout copies preserve source pixels and align mask through rotation/flip, intersect existing mask, survive save and Undo', () => {
  const { d, l, c, source, assets, cut } = fixture(), before = clone(d), history = new History(d), original = c.toBuffer('image/png');
  const [copy] = applyCutouts(d, captureCutout(d, l), [cut], assets);
  assert.equal(l.source, source); assert.equal(copy.source, source); assert.equal(l.visible, false); assert.equal(copy.locked, false);
  assert.deepEqual(c.toBuffer('image/png'), original); assert.deepEqual(l.mask, before.layers[0].mask);
  validateDocument(JSON.parse(JSON.stringify(d)));
  const rendered = renderDocument(d, assets), pixels = rendered.getContext('2d').getImageData(0, 0, 12, 12).data;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) assert.equal(pixels[(y * 12 + x) * 4 + 3], x === 5 && (y === 5 || y === 6) ? 255 : 0, `document pixel ${x},${y}`);
  const oldLocal = localExistingMask(before, before.layers[0], assets, 4, 2).getContext('2d').getImageData(0, 0, 4, 2).data;
  assert.equal(oldLocal[(1 * 4 + 0) * 4 + 3], 255); assert.equal(oldLocal[(1 * 4 + 2) * 4 + 3], 0);
  history.push(d, 'Cutout'); assert.deepEqual(history.go(0), before);
});
test('selection preserves layer visibility and locked image; stale geometry, locked parent and full layer cap reject atomically', () => {
  const { d, l, assets, cut } = fixture();
  applyCutouts(d, captureCutout(d, l), [cut], assets, { output: 'selection' });
  assert.equal(d.selection.type, 'paint'); assert.equal(l.visible, true); assert.equal(l.locked, true); assert.equal(d.layers.length, 1);
  assert.throws(() => applyCutouts(d, captureCutout(d, l), [cut], assets, { output: 'mask' }), /Mở khóa/);
  const snapshot = captureCutout(d, l); l.x++;
  assert.throws(() => applyCutouts(d, snapshot, [cut], assets), /đã thay đổi/);
  const g = createLayer('group', { locked: true }); d.layers.push(g); l.parentId = g.id;
  assert.throws(() => captureCutout(d, l), /nhóm cha/);
  delete l.parentId; d.layers = [l, ...Array.from({ length: 149 }, () => createLayer('shape'))];
  const before = JSON.stringify(d);
  assert.throws(() => applyCutouts(d, captureCutout(d, l), [cut], assets), /150/); assert.equal(JSON.stringify(d), before);
});
test('multiple kept subjects become independent editable masks on separate copies', () => {
  const { d, l, assets, cut } = fixture(), all = [cut, { ...cut, name: 'Other', values: Float32Array.from(cut.values, v => 1 - v) }];
  const copies = applyCutouts(d, captureCutout(d, l), all, assets, { combine: false });
  assert.equal(copies.length, 2); assert.notEqual(copies[0].mask.source, copies[1].mask.source); assert.notEqual(copies[0].id, copies[1].id); assert.equal(d.layers.length, 3); assert.equal(l.visible, false); validateDocument(d);
});
test('cutout loader rejects unsafe part names and truncated assets before inference', async () => {
  const m = { version: 1, models: { matting: { bytes: 10, sha256: 'a'.repeat(64), parts: [{ file: '../other', bytes: 10, sha256: 'a'.repeat(64) }] } } };
  const fetcher = async () => ({ ok: true, json: async () => m, arrayBuffer: async () => new ArrayBuffer(5) });
  await assert.rejects(loadCutoutModel('matting', () => {}, fetcher), /Invalid/);
  m.models.matting.parts[0].file = 'matting.part1'; await assert.rejects(loadCutoutModel('matting', () => {}, fetcher), /Incomplete/);
});
