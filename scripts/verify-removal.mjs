// Local-only real-model evaluation. Input photos and generated images are
// never copied into dist/, source releases, reports in qa/, or a public Site.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/wasm';
import { createCutoutEngine } from '../dist/cutout-inference.js';
import { loadCutoutModel } from '../dist/cutout-models.js';
import { loadNeuralModel } from '../dist/neural-models.js';
import { selectRemovalTarget } from '../dist/removal-selection.js';
import { prepareRemovalMask } from '../dist/removal-math.js';
import { runRemoval } from '../dist/removal-engine.js';
const inputFile = process.argv[2], folder = process.argv[3];
if (!inputFile || !folder) throw Error('Usage: node scripts/verify-removal.mjs INPUT_IMAGE OUTPUT_DIRECTORY [normalized_x normalized_y]');
ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = path.resolve('node_modules/onnxruntime-web/dist') + '/'; ort.env.logLevel = 'error';
const fetcher = async url => { const u = new URL(url); u.search = ''; const bytes = await readFile(u); return { ok: true, json: async () => JSON.parse(bytes), arrayBuffer: async () => Uint8Array.from(bytes).buffer }; };
const engine = createCutoutEngine(ort, { createCanvas, loadModel: name => ['objects', 'skin'].includes(name) ? readFile('dist/ai/' + name + '.onnx') : loadCutoutModel(name, () => {}, fetcher) });
let model;
try {
  await mkdir(folder, { recursive: true });
  const photo = await loadImage(inputFile), w = photo.width, h = photo.height, source = createCanvas(w, h), x = source.getContext('2d'); x.drawImage(photo, 0, 0);
  const data = x.getImageData(0, 0, w, h).data, factor = Math.min(1, 1024 / Math.max(w, h)), preview = createCanvas(Math.round(w * factor), Math.round(h * factor)); preview.getContext('2d').drawImage(photo, 0, 0, preview.width, preview.height);
  const detection = await engine.run(preview, { mode: 'detect' }), point = { x: Number(process.argv[4] ?? .5), y: Number(process.argv[5] ?? .5) }, start = performance.now();
  const regions = await selectRemovalTarget(source, preview, { run: (image, options, progress) => engine.run(image, { ...options, onProgress: progress }) }, { point, detection, imageKey: 'local-verification', createCanvas, progress: console.log });
  const selectionMs = performance.now() - start;
  await engine.dispose();
  for (let i = 0; i < regions.length; i++) await writeFile(path.join(folder, 'region-' + i + '.bin'), new Uint8Array(regions[i].values.buffer));
  await writeFile(path.join(folder, 'regions.json'), JSON.stringify(regions.map(({ values, masks, ...r }) => r), null, 2));
  const prepared = prepareRemovalMask(data, w, h, regions), maskView = createCanvas(w, h), mx = maskView.getContext('2d'), mp = mx.createImageData(w, h); mp.data.set(data);
  for (let i = 0; i < prepared.mask.length; i++) {
    const a = prepared.mask[i] * .65;
    mp.data[i * 4] = prepared.protection[i] ? 40 : data[i * 4] * (1 - a) + 250 * a;
    mp.data[i * 4 + 1] = prepared.protection[i] ? 255 : data[i * 4 + 1] * (1 - a);
  }
  mx.putImageData(mp, 0, 0); await writeFile(path.join(folder, 'mask-review.png'), maskView.toBuffer('image/png'));
  const bytes = await loadNeuralModel('inpaint', () => {}, async u => new Response(await readFile(new URL(u))));
  model = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
  const t = performance.now(), result = await runRemoval({ data, width: w, height: h, ...prepared }, async input => {
    const tensor = new ort.Tensor('float32', input, [1, 4, 512, 512]); let outputs;
    try { outputs = await model.run({ input: tensor }); return new Float32Array(outputs.output.data); } finally { tensor.dispose?.(); if (outputs) for (const t of Object.values(outputs)) t.dispose?.(); }
  }, console.log);
  const out = createCanvas(w, h), ox = out.getContext('2d'), p = ox.createImageData(w, h); p.data.set(result.data); ox.putImageData(p, 0, 0);
  await writeFile(path.join(folder, 'removed.png'), out.toBuffer('image/png'));
  let protectedPixels = 0, protectedChanged = 0, outsideChanged = 0;
  for (let i = 0; i < prepared.mask.length; i++) {
    const changed = [0, 1, 2, 3].some(c => data[i * 4 + c] !== result.data[i * 4 + c]);
    if (prepared.protection[i] > .99) { protectedPixels++; if (changed) protectedChanged++; }
    if (!prepared.mask[i] && changed) outsideChanged++;
  }
  if (outsideChanged || protectedChanged) throw Error('Exact exterior/foreground preservation failed.');
  const report = { runtime: 'real CPU/WASM DeepLab + SlimSAM global/local + LaMa', dimensions: [w, h], selectedRegions: regions.length, labels: regions.map(r => r.label), selectionMs: Math.round(selectionMs), fillMs: Math.round(performance.now() - t), outsideChangedPixels: outsideChanged, protectedPixels, protectedChangedPixels: protectedChanged, ...result.stats, limitation: 'No ground truth exists for the occluded scene. Exterior equality is verified; realism needs visual review. Automatic nearby and vegetation hints are conservative heuristics, not guaranteed instance/occlusion classification.' };
  await writeFile(path.join(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { await engine.dispose(); await model?.release(); }
