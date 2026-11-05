import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/wasm';
import { createCutoutEngine } from '../dist/cutout-inference.js';
import { loadCutoutModel } from '../dist/cutout-models.js';
import { regionPrompts } from '../dist/cutout-math.js';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = path.resolve('node_modules/onnxruntime-web/dist') + '/';
ort.env.logLevel = 'error';
const localFetch = async url => {
  const file = new URL(url); file.search = '';
  const bytes = await readFile(file);
  return { ok: true, json: async () => JSON.parse(bytes), arrayBuffer: async () => Uint8Array.from(bytes).buffer };
};
test('real CPU cutout models run auto foreground, portrait alpha, hair, semantic regions and cached point prompts', { timeout: 240000 }, async () => {
  const engine = createCutoutEngine(ort, { createCanvas, loadModel: name => ['objects', 'skin'].includes(name) ? readFile(new URL('../dist/ai/' + name + '.onnx', import.meta.url)) : loadCutoutModel(name, () => {}, localFetch) });
  try {
    const photo = await loadImage(new URL('../dist/assets/portrait-demo.jpg', import.meta.url).pathname), image = createCanvas(512, Math.round(photo.height * 512 / photo.width));
    image.getContext('2d').drawImage(photo, 0, 0, image.width, image.height);
    for (const mode of ['auto', 'portrait', 'hair']) {
      const result = await engine.run(image, { mode });
      assert.equal(result.values.length, image.width * image.height);
      assert.ok(result.values.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
      const coverage = result.values.reduce((a, b) => a + b, 0) / result.values.length;
      console.log(mode, 'fixture alpha coverage', coverage.toFixed(4));
      assert.ok(coverage > .005 && coverage < .95, mode + ' must return a nontrivial actual mask');
    }
    const detection = await engine.run(image, { mode: 'detect' });
    assert.ok(detection.regions.some(r => r.classId === 15));assert.ok(detection.classMap.some(v=>v===15));assert.equal(detection.classMap.length,detection.width*detection.height);
    const person = detection.regions.find(r => r.classId === 15), points = regionPrompts(detection, person), point = points[1] || points[0];
    assert.equal(points.length,3,'large detected person gets distributed prompts rather than only a tie-centre prompt');
    const first = await engine.run(image, { mode: 'point', points, imageKey: 'portrait' });
    assert.equal(first.masks.length, 3);
    assert.ok(first.scores.every(Number.isFinite));
    const inside = Math.floor(point.y * first.height) * first.width + Math.floor(point.x * first.width);
    assert.ok(first.values[inside] > .5, 'prompted foreground pixel must be in the real selected mask');
    for(const p of points)assert.ok(first.values[Math.floor(p.y*first.height)*first.width+Math.floor(p.x*first.width)]>.5);
    assert.ok(first.values.reduce((a,b)=>a+b,0)/first.values.length>.25,'person suggestion should not shrink into the tie');
    const revised = await engine.run(image, { mode: 'point', points: [...points, { x: .02, y: .02, label: 0 }], imageKey: 'portrait' });
    assert.ok(revised.values[inside] > .5);
    assert.ok(revised.values.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
    console.log('SAM real scores', first.scores.map(v => v.toFixed(3)), 'semantic regions', detection.regions.map(r => r.label));
  } finally { await engine.dispose(); }
});
