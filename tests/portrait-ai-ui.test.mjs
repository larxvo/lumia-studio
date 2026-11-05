import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, tick } from './ui-harness.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { createDocument, createLayer, validateDocument } from '../dist/model.js';
import { Assets } from '../dist/renderer.js';
import { createGenerativeStudio } from '../dist/generative-ui.js';
import { CONTOURS } from '../dist/face-geometry.js';
const { window, document } = await setupDOM();
globalThis.createImageBitmap = async image => image;
let commits, current, closeHandler, seen;
const assets = new Assets();
function fixture() {
  const c = createCanvas(96, 96), x = c.getContext('2d'); x.fillStyle = '#bd906c'; x.fillRect(0, 0, 96, 96);
  const source = c.toDataURL(); assets.set(source, c);
  current = createDocument(96, 96); current.layers = [createLayer('image', { source, width: 96, height: 96 })]; current.activeId = current.layers[0].id; commits = []; seen = [];
}
const points = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
for (const [name, ids] of Object.entries(CONTOURS)) {
  const regions = { oval: [.5, .5, .4, .45], leftEye: [.35, .35, .08, .03], rightEye: [.65, .35, .08, .03], lips: [.5, .65, .13, .05], leftBrow: [.35, .25, .1, .02], rightBrow: [.65, .25, .1, .02] }, [cx, cy, rx, ry] = regions[name];
  ids.forEach((id, n) => { const t = n / ids.length * Math.PI * 2; points[id] = { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry, z: 0 }; });
}
points[2] = { x: .5, y: .53, z: 0 }; points[152] = { x: .5, y: .94, z: 0 };
const api = { doc: () => current, assets, commit: label => commits.push(label), toast() {}, closeModal() { closeHandler?.(); document.querySelector('#modal').close(); }, showModal(title, subtitle, body, buttons, mount, close) {
  const modal = document.querySelector('#modal'); modal.innerHTML = `<h2>${title}</h2>${body}<footer>${buttons.map((b, i) => `<button data-modal-button="${i}">${b.label}</button>`).join('')}</footer>`;
  buttons.forEach((b, i) => modal.querySelector(`[data-modal-button="${i}"]`).onclick = b.run); closeHandler = close; modal.showModal(); mount();
} };
const studio = createGenerativeStudio(api, {
  analyzerFactory: () => ({ run: async () => ({ faces: [{ points, box: { x: .1, y: .05, width: .8, height: .9 }, score: .99 }], skin: null }), stop() {} }),
  clientFactory: () => ({ run: async input => { seen.push(input); const data = new Uint8ClampedArray(input.data); for (let i = 0; i < input.mask.length; i++) if (input.mask[i]) data[i * 4] -= Math.round(15 * input.mask[i]); return { data, width: input.width, height: input.height }; }, stop() {} })
});
const click = selector => { const e = document.querySelector(selector); assert.ok(e, selector); e.dispatchEvent(new window.Event('click', { bubbles: true })); };
async function ready(predicate) { for (let i = 0; i < 80; i++) { if (predicate()) return; await tick(); } assert.fail(document.querySelector('#gen-status')?.textContent); }
// Workflow tests use injected model output. The actual local model has a
// separate real CPU/WASM test in neural.test.mjs; no GPU claim is made here.
test('beard removal automatically builds an editable lip-protected mask and routes to local inpainting', async () => {
  fixture(); await studio.open('beard'); await ready(() => studio.current()?.getState().faces.length > 0);
  const state = studio.current().getState(), m = state.mask.getContext('2d').getImageData(0, 0, 96, 96).data;
  assert.ok([...m].some((v, i) => i % 4 === 3 && v > 0)); assert.equal(m[(62 * 96 + 48) * 4 + 3], 0);
  assert.equal(state.engine, 'local'); assert.equal(document.querySelector('#gen-generate').disabled, false);
  click('#gen-generate'); await ready(() => !!studio.current()?.getState().result); assert.equal(seen[0].kind, 'inpaint');
  click('#gen-apply'); assert.equal(current.layers.length, 2); assert.equal(current.layers[0].visible, false); assert.equal(current.layers[1].generation.operation, 'beard'); assert.equal(current.layers[1].generation.engine, 'lama'); assert.equal(commits.length, 1); validateDocument(current);
});
test('photorealistic beard presets require ComfyUI and cannot silently fall back to unprompted local fill', async () => {
  fixture(); await studio.open('beard'); await ready(() => studio.current()?.getState().faces.length > 0); click('[data-gen-preset="moustache"]');
  assert.equal(studio.current().getState().engine, 'comfy'); assert.match(document.querySelector('#gen-prompt').value, /moustache/); assert.equal(document.querySelector('#gen-generate').disabled, true); assert.equal(document.querySelector('#gen-engine').disabled, true); assert.equal(seen.length, 0);
  click('[data-gen-preset="remove"]'); assert.equal(studio.current().getState().engine, 'local'); assert.equal(document.querySelector('#gen-generate').disabled, false); studio.cancel();
});
test('expression choices include closed, broad and asymmetric smiles and keep generation blocked without a connection', async () => {
  fixture(); await studio.open('expression');
  for (const id of ['closed', 'broad', 'asymmetric']) { click(`[data-gen-preset="${id}"]`); assert.equal(studio.current().getState().engine, 'comfy'); assert.equal(document.querySelector('#gen-generate').disabled, true); }
  assert.match(document.querySelector('#gen-prompt').value, /asymmetric/); studio.cancel();
});
