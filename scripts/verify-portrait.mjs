// Reproducible CPU/WASM fixture check, with optional contact sheet for human QA.
// This checks isolation and deterministic behavior, not professional quality on
// a diverse portrait dataset and not GPU/ComfyUI model quality.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/wasm';
import { createFaceAnalyzer } from '../dist/face-inference.js';
import { processPhoto, presetParams } from '../dist/portrait-engine.js';
import { irisRegions } from '../dist/portrait-features.js';
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = path.resolve('node_modules/onnxruntime-web/dist') + '/';
ort.env.logLevel = 'error';
const analyzer = createFaceAnalyzer(ort, { createCanvas, loadModel: name => readFile('dist/ai/' + name + '.onnx') });
try {
  const image = await loadImage('dist/assets/portrait-demo.jpg'), w = image.width, h = image.height, c = createCanvas(w, h), x = c.getContext('2d');
  x.drawImage(image, 0, 0);
  const source = x.getImageData(0, 0, w, h).data, start = performance.now(), analysis = await analyzer.analyze(image), analysisMs = performance.now() - start;
  if (!analysis.faces.length || !analysis.skin?.hair) throw Error('Face / hair recognition failed.');
  const results = [], report = { runtime: 'onnxruntime-web WASM, CPU, single thread', fixture: 'assets/portrait-demo.jpg (Pete Souza / public domain)', dimensions: [w, h], faces: analysis.faces.length, landmarks: analysis.faces[0].points.length, analysisMs: Math.round(analysisMs), checks: [] };
  for (const [name, mode, params] of [['Goc', 'skin', {}], ['Da studio', 'skin', presetParams('skin', 'studio')], ['Mau toc: dong', 'hair', presetParams('hair', 'copper')], ['Mau mat: xanh', 'eyes', presetParams('eyes', 'green')], ['Rau quai non mo phong', 'beard', presetParams('beard', 'boxed')], ['Cuoi: cung moi', 'face', presetParams('face', 'broad-smile')]]) {
    const t = performance.now(), result = processPhoto({ data: source, width: w, height: h, analysis, mode, params });
    let changed = 0, outsideChanged = 0, alphaChanged = 0;
    for (let i = 0; i < w * h; i++) {
      const diff = [0, 1, 2, 3].some(k => source[i * 4 + k] !== result.data[i * 4 + k]);
      if (diff) changed++;
      if (diff && !result.mask[i] && mode !== 'face') outsideChanged++;
      if (source[i * 4 + 3] !== result.data[i * 4 + 3]) alphaChanged++;
    }
    if (outsideChanged || alphaChanged || name !== 'Goc' && !changed) throw Error('Isolation/no-effect check failed: ' + name);
    results.push({ name, data: result.data });
    report.checks.push({ name, mode, elapsedMs: Math.round(performance.now() - t), changedPixels: changed, outsideMaskChangedPixels: mode === 'face' ? null : outsideChanged, alphaChangedPixels: alphaChanged, ...result.stats });
  }
  const regions = irisRegions(analysis.faces[0], w, h), damaged = new Uint8ClampedArray(source), injected = [];
  for (const r of regions) for (let y = Math.max(0, Math.floor(r.cy - r.radius * .45)); y < Math.min(h, r.cy + r.radius * .45); y++) for (let x = Math.max(0, Math.floor(r.cx - r.radius * .45)); x < Math.min(w, r.cx + r.radius * .45); x++) {
    if (Math.hypot(x + .5 - r.cx, y + .5 - r.cy) > r.radius * .45) continue;
    const i = y * w + x; injected.push(i); damaged.set([235, 28, 30, source[i * 4 + 3]], i * 4);
  }
  const fixed = processPhoto({ data: damaged, width: w, height: h, analysis, mode: 'eyes', params: { redEye: 100 } });
  const recovered = injected.filter(i => fixed.data[i * 4] < 80).length;
  if (recovered < injected.length * .85) throw Error('Injected red-eye regression failed.');
  report.redEye = { injectedPixels: injected.length, correctedPixelsBelowRed80: recovered, detectedPixels: fixed.stats.redEyePixels, naturalPortraitDetectedPixels: processPhoto({ data: source, width: w, height: h, analysis, mode: 'eyes', params: { redEye: 100 } }).stats.redEyePixels };
  const folder = process.argv[2];
  if (folder) {
    await mkdir(folder, { recursive: true });
    const sheet = createCanvas(1200, 1020), sx = sheet.getContext('2d'), b = analysis.faces[0].box, crop = { x: Math.max(0, (b.x - b.width * .3) * w), y: Math.max(0, (b.y - b.height * .4) * h), width: b.width * 1.6 * w, height: b.height * 1.65 * h };
    sx.fillStyle = '#17211e'; sx.fillRect(0, 0, sheet.width, sheet.height);
    results.forEach((r, n) => {
      const cc = createCanvas(w, h), xx = cc.getContext('2d'), pixels = xx.createImageData(w, h); pixels.data.set(r.data); xx.putImageData(pixels, 0, 0);
      const x = n % 3 * 400, y = Math.floor(n / 3) * 510;
      sx.drawImage(cc, crop.x, crop.y, crop.width, crop.height, x + 8, y + 36, 384, 462);
      sx.fillStyle = '#c1e3d2'; sx.font = '16px sans-serif'; sx.fillText(r.name, x + 12, y + 25);
    });
    await writeFile(path.join(folder, 'portrait-contact.jpg'), sheet.toBuffer('image/jpeg', 90));
    await writeFile(path.join(folder, 'portrait-analysis.json'), JSON.stringify(analysis, (_, v) => v instanceof Float32Array ? [...v] : v));
    await writeFile(path.join(folder, 'portrait-verification.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await analyzer.dispose(); }
