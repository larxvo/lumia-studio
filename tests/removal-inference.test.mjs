import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/wasm';
import { loadNeuralModel } from '../dist/neural-models.js';
import { runRemoval } from '../dist/removal-engine.js';
import { prepareRemovalMask } from '../dist/removal-math.js';
ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = path.resolve('node_modules/onnxruntime-web/dist') + '/'; ort.env.logLevel = 'error';
test('real CPU LaMa repairs a known synthetic intrusion while the new full-resolution pipeline preserves exact exterior bytes', { timeout: 180000 }, async () => {
  const image = await loadImage('dist/assets/wave.jpg'), w = 640, h = 440, c = createCanvas(w, h), x = c.getContext('2d'); x.drawImage(image, 0, 0, w, h);
  const truth = x.getImageData(0, 0, w, h).data, damaged = new Uint8ClampedArray(truth), mask = new Float32Array(w * h);
  for (let y = 185; y < 245; y++) for (let x = 270; x < 320; x++) { const i = y * w + x; mask[i] = 1; damaged.set([255, 0, 220, 255], i * 4); }
  const prepared = prepareRemovalMask(damaged, w, h, [{ values: mask, width: w, height: h }], [], { grow: 2, feather: 1, foliage: false, branches: false });
  const fetcher = async u => new Response(await readFile(new URL(u))), bytes = await loadNeuralModel('inpaint', () => {}, fetcher), session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
  try {
    const result = await runRemoval({ data: damaged, width: w, height: h, ...prepared }, async input => { const tensor = new ort.Tensor('float32', input, [1, 4, 512, 512]); let output; try { output = await session.run({ input: tensor }); return new Float32Array(output.output.data); } finally { tensor.dispose?.(); if (output) for (const t of Object.values(output)) t.dispose?.(); } });
    let before = 0, after = 0;
    for (let i = 0; i < mask.length; i++) for (let k = 0; k < 4; k++) { if (mask[i] && k < 3) { before += Math.abs(damaged[i * 4 + k] - truth[i * 4 + k]); after += Math.abs(result.data[i * 4 + k] - truth[i * 4 + k]); } if (!prepared.mask[i]) assert.equal(result.data[i * 4 + k], damaged[i * 4 + k]); }
    assert.ok(after < before * .6, 'actual neural reconstruction must improve the known synthetic corruption'); assert.equal(result.width, w); assert.equal(result.height, h); assert.equal(result.stats.outsideChangedBytes, 0); assert.ok(result.stats.detailSamples > 0);
  } finally { await session.release(); }
});
