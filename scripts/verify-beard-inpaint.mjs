import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as ort from '../dist/vendor/ort/ort.wasm.min.mjs';
import { createFaceAnalyzer } from '../dist/face-inference.js';
import { loadNeuralModel } from '../dist/neural-models.js';
import { inpaintInput, composeInpaint } from '../dist/neural-math.js';
import { beardMask } from '../dist/portrait-features.js';
import { processPhoto, presetParams } from '../dist/portrait-engine.js';
import { reconstructionMetrics } from '../dist/restoration-math.js';
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL('../dist/vendor/ort/', import.meta.url).href;
ort.env.logLevel = 'error';
const fetcher = async url => { try { return new Response(await readFile(new URL(url).pathname)); } catch { return new Response(null, { status: 404 }); } };
const analyzer = createFaceAnalyzer(ort, { createCanvas, loadModel: name => readFile('dist/ai/' + name + '.onnx') });
let session;
try {
  const image = await loadImage('dist/assets/portrait-demo.jpg'), w = 410, h = 512, c = createCanvas(w, h), x = c.getContext('2d');
  x.drawImage(image, 0, 0, w, h);
  const source = x.getImageData(0, 0, w, h).data, analysis = await analyzer.analyze(c), mask = beardMask(w, h, analysis.faces[0]);
  const simulated = processPhoto({ data: source, width: w, height: h, analysis, mode: 'beard', params: presetParams('beard', 'full') }).data;
  const model = await loadNeuralModel('inpaint', () => {}, fetcher);
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  const { input, crop } = inpaintInput(simulated, w, h, mask), start = performance.now();
  const generated = await session.run({ input: new ort.Tensor('float32', input, [1, 4, 512, 512]) });
  const result = composeInpaint(simulated, w, h, mask, generated.output.data, crop), before = reconstructionMetrics(source, simulated, mask), after = reconstructionMetrics(source, result, mask);
  let outsideChanged = 0, lipChanged = 0;
  for (let i = 0; i < mask.length; i++) if (!mask[i] && [0, 1, 2, 3].some(k => simulated[i * 4 + k] !== result[i * 4 + k])) outsideChanged++;
  for (const index of [0, 13, 14, 17]) { const p = analysis.faces[0].points[index], i = Math.floor(p.y * h) * w + Math.floor(p.x * w); if ([0, 1, 2, 3].some(k => source[i * 4 + k] !== result[i * 4 + k])) lipChanged++; }
  if (outsideChanged || lipChanged || !generated.output.data.every(Number.isFinite)) throw Error('Beard inpaint isolation failed.');
  const report = { runtime: 'real LaMa ONNX inference, CPU/WASM, single thread', fixture: 'Pete Souza public-domain portrait with a PROCEDURALLY SIMULATED beard; not a real-beard quality dataset', dimensions: [w, h], inferenceMs: Math.round(performance.now() - start), maskPixels: after.maskedPixels, outsideChangedPixels: outsideChanged, lipAnchorChangedPixels: lipChanged, simulatedInputMaskedMAE: before.maskedMAE, inpaintedMaskedMAE: after.maskedMAE, improvementPercent: 100 * (1 - after.maskedMAE / before.maskedMAE), limitation: 'Mask isolation and inference are verified. Hidden skin is predicted. This fixture does not validate dense real-beard removal, diverse skin tones, or ComfyUI/GPU quality.' };
  const folder = process.argv[2];
  if (folder) {
    await mkdir(folder, { recursive: true });
    const sheet = createCanvas(w * 3, h + 32), sx = sheet.getContext('2d'); sx.fillStyle = '#17211e'; sx.fillRect(0, 0, sheet.width, sheet.height);
    for (const [n, [label, pixels]] of [['Goc (da biet)', source], ['Rau mo phong', simulated], ['LaMa xoa vung rau', result]].entries()) {
      const cc = createCanvas(w, h), cx = cc.getContext('2d'), p = cx.createImageData(w, h); p.data.set(pixels); cx.putImageData(p, 0, 0); sx.drawImage(cc, n * w, 32); sx.fillStyle = '#c1e3d2'; sx.font = '14px sans-serif'; sx.fillText(label, n * w + 8, 22);
    }
    await writeFile(folder + '/beard-inpaint-contact.jpg', sheet.toBuffer('image/jpeg', 90));
    await writeFile(folder + '/beard-inpaint-verification.json', JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await analyzer.dispose(); await session?.release(); }
