import test from 'node:test';
import assert from 'node:assert/strict';
import { irisRegions, fixRedEye, tintIris, hairMask, tintHair, beardMask, reduceStubble, renderBeard } from '../dist/portrait-features.js';
import { processPhoto, PHOTO_DEFAULTS, presetParams } from '../dist/portrait-engine.js';
import { CONTOURS, softmaxSkin } from '../dist/face-geometry.js';
import { rgbToLightness } from '../dist/colorization-math.js';
import { validatePhotoRecipe } from '../dist/photo-recipe.js';

const w = 160, h = 180;
function pixels(W = w, H = h) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.set([170 + x % 7, 128 + x % 7, 102 + x % 7, 213], (y * W + x) * 4);
  return data;
}
function face() {
  const points = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
  const regions = { oval: [.5, .5, .4, .45], leftEye: [.34, .37, .09, .035], rightEye: [.66, .37, .09, .035], lips: [.5, .65, .14, .05], leftBrow: [.34, .28, .11, .025], rightBrow: [.66, .28, .11, .025] };
  for (const [name, indices] of Object.entries(CONTOURS)) {
    const [cx, cy, rx, ry] = regions[name];
    indices.forEach((index, n) => { const a = n / indices.length * Math.PI * 2; points[index] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, z: 0 }; });
  }
  for (const [center, cx, ring] of [[468, .34, [469, 470, 471, 472]], [473, .66, [474, 475, 476, 477]]]) {
    points[center] = { x: cx, y: .37, z: 0 };
    ring.forEach((index, n) => { const a = n * Math.PI / 2; points[index] = { x: cx + Math.cos(a) * .03, y: .37 + Math.sin(a) * .027, z: 0 }; });
  }
  points[2] = { x: .5, y: .55, z: 0 }; points[13] = { x: .5, y: .64, z: 0 }; points[14] = { x: .5, y: .67, z: 0 }; points[152] = { x: .5, y: .94, z: 0 };
  return { points, box: { x: .1, y: .05, width: .8, height: .9 }, score: .99 };
}
function outsideExact(original, output, mask) {
  for (let i = 0; i < mask.length; i++) {
    assert.equal(output[i * 4 + 3], original[i * 4 + 3]);
    if (!mask[i]) assert.deepEqual(output.slice(i * 4, i * 4 + 4), original.slice(i * 4, i * 4 + 4));
  }
}
test('red-eye correction fixes strong pupil red while preserving natural brown, catchlight, outside pixels and alpha', () => {
  const source = pixels(), regions = irisRegions(face(), w, h), r = regions[0], index = (Math.floor(r.cy) * w + Math.floor(r.cx)) * 4;
  source.set([238, 34, 28, 213], index); source.set([250, 250, 250, 213], index + 4);
  const natural = (Math.floor(regions[1].cy) * w + Math.floor(regions[1].cx)) * 4;
  source.set([84, 49, 31, 213], natural);
  const original = new Uint8ClampedArray(source), fixed = fixRedEye(source, w, h, regions, 1, 50);
  assert.ok(fixed.count >= 1); assert.ok(fixed.data[index] < 60);
  assert.deepEqual(fixed.data.slice(index + 4, index + 8), source.slice(index + 4, index + 8));
  assert.deepEqual(fixed.data.slice(natural, natural + 4), source.slice(natural, natural + 4));
  outsideExact(source, fixed.data, fixed.mask); assert.deepEqual(source, original);
  assert.equal(fixRedEye(pixels(), w, h, regions, 1).count, 0);
  const amber = pixels(); amber.set([150, 80, 50, 213], index);
  assert.equal(fixRedEye(amber, w, h, regions, 1).count, 0, 'warm natural iris is not red flash');
  const duplicate = fixRedEye(source, w, h, [...regions, ...regions], 1, 50);
  assert.equal(duplicate.count, fixed.count); assert.deepEqual(duplicate.data, fixed.data);
});
test('manual red-eye points work without face detection and selection blocks all changes outside the selection', () => {
  const source = pixels(), k = (90 * w + 80) * 4; source.set([255, 20, 25, 213], k);
  const selection = new Float32Array(w * h), input = { data: source, width: w, height: h, mode: 'eyes', params: { redEye: 100 }, eyePoints: [{ x: .5, y: .5, radius: .03 }] };
  assert.ok(processPhoto(input).data[k] < 70);
  assert.deepEqual(processPhoto({ ...input, selection }).data, source);
  assert.deepEqual(processPhoto({ ...input, params: { redEye: 100, strength: 0 } }).data, source);
});
test('iris tint stays inside the eyelid and excludes pupil and white catchlights', () => {
  const source = pixels(), regions = irisRegions(face(), w, h, 'left'), r = regions[0], center = (Math.floor(r.cy) * w + Math.floor(r.cx)) * 4;
  source.set([9, 8, 8, 213], center);
  const out = tintIris(source, w, h, regions, '#46816a', .8);
  assert.deepEqual(out.data.slice(center, center + 4), source.slice(center, center + 4));
  assert.ok(out.mask.some(a => a > .3)); assert.notDeepEqual(out.data, source);
  outsideExact(source, out.data, out.mask);
  const right = irisRegions(face(), w, h, 'right')[0];
  assert.deepEqual(out.data.slice((Math.floor(right.cy) * w + Math.floor(right.cx)) * 4, (Math.floor(right.cy) * w + Math.floor(right.cx)) * 4 + 4), source.slice((Math.floor(right.cy) * w + Math.floor(right.cx)) * 4, (Math.floor(right.cy) * w + Math.floor(right.cx)) * 4 + 4));
});
test('skin model class 1 is retained separately as hair rather than relabeled skin', () => {
  const logits = new Float32Array([0, 12, 0, 0, 0, 0]), s = softmaxSkin(logits);
  assert.ok(s.hair[0] > .99); assert.ok(s.skin[0] < .01); assert.ok(s.face[0] < .01);
});
test('hair recoloring respects AI probability, refinement, protected features, texture and exact zero', () => {
  const f = face(), a = { faces: [f], skin: { width: 1, height: 2, hair: new Float32Array([1, 0]) } }, p = { ...PHOTO_DEFAULTS, hairAmount: 80, hairColor: '#795335' };
  const mask = hairMask(w, h, a, p, [{ type: 'hair', add: false, radius: .1, points: [[.5, .05]] }]), source = pixels(), out = tintHair(source, w, h, mask, p);
  assert.equal(mask[10 * w + 80], 0); assert.equal(mask[67 * w + 54], 0); assert.equal(mask[170 * w + 80], 0);
  assert.notDeepEqual(out, source); outsideExact(source, out, mask);
  assert.deepEqual(tintHair(source, w, h, mask, { ...p, hairAmount: 0 }), source);
  const i = 10 * w + 10, k = i * 4;
  assert.ok(Math.abs(rgbToLightness(...out.slice(k, k + 3)) - rgbToLightness(...source.slice(k, k + 3))) < 1.5);
});
test('each beard style has a distinct local mask, excludes the lips and leaves distant pixels exact', () => {
  const f = face(), source = pixels(), masks = ['moustache', 'chin', 'goatee', 'boxed', 'full'].map(style => beardMask(w, h, f, style));
  for (let n = 0; n < masks.length; n++) {
    const mask = masks[n]; assert.ok(mask.some(a => a > .5)); assert.equal(mask[117 * w + 80], 0); assert.equal(mask[10 * w + 10], 0);
    const p = { ...PHOTO_DEFAULTS, beardStyle: ['moustache', 'chin', 'goatee', 'boxed', 'full'][n], beardAmount: 90, beardDensity: 70 };
    const out = renderBeard(source, w, h, f, mask, p);
    assert.notDeepEqual(out, source); outsideExact(source, out, mask); assert.deepEqual(renderBeard(source, w, h, f, mask, p), out);
    assert.deepEqual(renderBeard(source, w, h, f, mask, { ...p, beardAmount: 0 }), source);
  }
  assert.notDeepEqual(masks[0], masks[1]); assert.notDeepEqual(masks[2], masks[4]);
});
test('stubble reduction lightens an isolated dark hair using nearby skin but preserves lips and outside region', () => {
  const f = face(), source = pixels(), mask = beardMask(w, h, f), i = 145 * w + 75, k = i * 4;
  assert.ok(mask[i] > .5); source.set([35, 25, 20, 213], k);
  const out = reduceStubble(source, w, h, mask, 1, f);
  assert.ok(out.count > 0); assert.ok(out.data[k] > 110); outsideExact(source, out.data, mask);
});
test('studio frequency separation retains original pore detail, smooths a broad tone patch and keeps no-op exact', () => {
  const source = pixels(), a = { faces: [face()], skin: { width: 1, height: 1, values: new Float32Array([1]), face: new Float32Array([1]) } };
  for (let y = 80; y < 100; y++) for (let x = 65; x < 90; x++) { const k = (y * w + x) * 4; for (let c = 0; c < 3; c++) source[k + c] -= 15 + ((x + y) % 2 ? 3 : -3); }
  const result = processPhoto({ data: source, width: w, height: h, analysis: a, params: { studio: 70, texture: 100, scope: 'face' } });
  const k = (84 * w + 66) * 4;
  assert.ok(result.data[k] > source[k]);
  const poreContrast = Math.abs(result.data[k] - result.data[k + w * 4]);
  assert.ok(poreContrast >= 3, 'original high-frequency texture must survive');
  assert.deepEqual(processPhoto({ data: source, width: w, height: h, analysis: a }).data, source);
  outsideExact(source, result.data, result.mask);
});
test('portrait recipes validate bounded colors, styles, eye points and masks, and still accept old recipes', () => {
  const source = 'data:image/png;base64,AAAA', check = s => assert.ok(s.startsWith('data:image/'));
  const old = { version: 1, mode: 'skin', params: { ...PHOTO_DEFAULTS }, source, strokes: [], analysis: { faces: [] } };
  validatePhotoRecipe(old, check);
  const r = { ...old, mode: 'hair', params: presetParams('hair', 'copper'), eyePoints: [{ x: .5, y: .4, radius: .012 }], analysis: { faces: [face()], partsVersion: 1, skinSource: source }, strokes: [{ type: 'hair', add: true, radius: .03, points: [[.2, .2]] }] };
  validatePhotoRecipe(r, check);
  for (const patch of [{ params: { ...r.params, hairColor: 'url(https://evil)' } }, { params: { ...r.params, redEyeAll: 'yes' } }, { params: { ...r.params, beardStyle: 'other' } }, { eyePoints: [{ x: 2, y: .4, radius: .01 }] }, { analysis: { partsVersion: 2 } }]) assert.throws(() => validatePhotoRecipe({ ...r, ...patch }, check));
  const eyes = presetParams('eyes', 'red-eye', { hairAmount: 40, irisAmount: 99, irisColor: '#123456' });
  assert.equal(eyes.redEye, 100); assert.equal(eyes.irisAmount, 0); assert.equal(eyes.irisColor, PHOTO_DEFAULTS.irisColor); assert.equal(eyes.hairAmount, 40);
});
