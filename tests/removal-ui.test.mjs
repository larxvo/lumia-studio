import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { setupDOM, tick } from './ui-harness.mjs';
import { createDocument, createLayer, clone, History, validateDocument } from '../dist/model.js';
import { Assets } from '../dist/renderer.js';
import { createRemovalStudio } from '../dist/removal-ui.js';
const { window, document } = await setupDOM();
let doc, history, modalCleanup, commits = [], calls = [], chosenPoints = [], pendingResolve;
const assets = new Assets();
function fixture() {
  const c = createCanvas(120, 100), x = c.getContext('2d'); x.fillStyle = '#907f65'; x.fillRect(0, 0, 120, 100); x.fillStyle = '#b13f2c'; x.fillRect(40, 30, 30, 40);
  const source = c.toDataURL(); assets.set(source, c); doc = createDocument(120, 100); doc.layers = [createLayer('image', { source, width: 120, height: 100, name: 'Local fixture', x: 3, y: -2, rotation: 12, flipX: true, opacity: .7, locked: true })]; doc.activeId = doc.layers[0].id; history = new History(doc); commits = []; calls = []; chosenPoints = []; pendingResolve = null; return { c, source, original: clone(doc) };
}
const api = { doc: () => doc, layer: () => doc.layers.find(l => l.id === doc.activeId), assets, commit: label => { commits.push(label); history.push(doc, label); }, toast() {}, closeModal() { modalCleanup?.(); document.querySelector('#modal').close(); }, showModal(title, subtitle, body, buttons, mount, close) {
  const m = document.querySelector('#modal'); m.innerHTML = `<h2>${title}</h2>${body}<footer>${buttons.map((b, i) => `<button data-modal-button="${i}">${b.label}</button>`).join('')}</footer>`; buttons.forEach((b, i) => m.querySelector(`[data-modal-button="${i}"]`).onclick = b.run); modalCleanup = close; m.showModal(); mount();
} };
function selected() { const values = new Float32Array(120 * 100); for (let y = 30; y < 70; y++) for (let x = 40; x < 70; x++) values[y * 120 + x] = 1; return { values, width: 120, height: 100, rect: { x: 0, y: 0, width: 1, height: 1 }, label: 'Người', points: [{ x: .5, y: .5, label: 1 }], masks: [] }; }
let deferProcessor = false;
const studio = createRemovalStudio(api, {
  clientFactory: () => ({ run: async () => ({ width: 120, height: 100, map: Uint16Array.from(selected().values), regions: [{ id: 1, classId: 15, point: { x: .5, y: .5 } }] }), stop() {} }),
  selector: async (source, preview, client, options) => { chosenPoints.push(options.point); return [selected()]; },
  processorFactory: () => ({ run: async input => { calls.push(input); const result = { data: new Uint8ClampedArray(input.data), width: input.width, height: input.height, stats: { outsideChangedBytes: 0 } }; for (let i = 0; i < input.mask.length; i++) if (input.mask[i]) result.data[i * 4] = 110; if (deferProcessor) return new Promise(resolve => pendingResolve = () => resolve(result)); return result; }, stop() {} })
});
function click(selector) { const el = document.querySelector(selector); assert.ok(el, selector); el.dispatchEvent(new window.Event('click', { bubbles: true })); }
function set(selector, value) { const el = document.querySelector(selector); assert.ok(el, selector); if (typeof value === 'boolean') el.checked = value; else el.value = String(value); el.dispatchEvent(new window.Event('change', { bubbles: true })); }
async function wait(condition) { for (let i = 0; i < 100; i++) { if (condition()) return; await tick(); } assert.fail(document.querySelector('#remove-status')?.textContent); }
async function tap() { const e = new window.Event('pointerdown', { bubbles: true }); Object.assign(e, { pointerId: 1, button: 0, clientX: 120, clientY: 15 }); document.querySelector('#remove-preview').dispatchEvent(e); await wait(() => !!studio.current()?.getState().result && !studio.current().getState().busy); }
test('one canvas click selects and generates automatically without changing the source before Apply', async () => {
  const f = fixture(); await studio.open(); await tap(); assert.equal(chosenPoints.length, 1); assert.equal(chosenPoints[0].x, .5); assert.equal(chosenPoints[0].y, .5); assert.equal(calls.length, 1); assert.equal(calls[0].kind, 'remove'); assert.equal(calls[0].width, 120); assert.equal(calls[0].height, 100); assert.deepEqual(doc, f.original); assert.equal(commits.length, 0); assert.equal(document.querySelector('#remove-apply').disabled, false); studio.cancel(); assert.deepEqual(doc, f.original);
});
test('Apply keeps original pixels and geometry, saves editable regions/settings, and Undo restores original visibility', async () => {
  const f = fixture(); await studio.open(); await tap(); click('#remove-apply'); assert.equal(doc.layers.length, 2); assert.equal(doc.layers[0].source, f.source); assert.equal(doc.layers[0].visible, false); const output = doc.layers[1]; assert.equal(output.removalRecipe.source, f.source); assert.ok(output.removalRecipe.regions[0].source.startsWith('data:image/png')); assert.equal(output.rotation, 12); assert.equal(output.flipX, true); assert.equal(output.opacity, .7); assert.equal(output.locked, false); validateDocument(doc); doc = history.undo(); assert.deepEqual(doc, f.original);
});
test('reopening edits the existing result from the original source and setting changes invalidate old output', async () => {
  const f = fixture(); await studio.open(); await tap(); click('#remove-apply'); const id = doc.activeId; await studio.open(); assert.equal(studio.current().getState().regions.length, 1); assert.ok(studio.current().getState().result); assert.equal(calls.length, 1, 'reopen displays the saved result without a second model run'); set('[data-remove-param="detail"]', 20); assert.equal(document.querySelector('#remove-apply').disabled, true); click('#remove-run'); await wait(() => !!studio.current()?.getState().result && !studio.current().getState().busy); assert.deepEqual([...calls.at(-1).data], [...f.c.getContext('2d').getImageData(0, 0, 120, 100).data]); click('#remove-apply'); assert.equal(doc.layers.length, 2); assert.equal(doc.activeId, id); assert.equal(doc.layers[1].removalRecipe.settings.detail, 20); validateDocument(doc);
});
test('a changed source is rejected, and cancellation ignores late model output', async () => {
  fixture(); await studio.open(); await tap(); doc.layers[0].x++; click('#remove-apply'); assert.equal(doc.layers.length, 1); assert.match(document.querySelector('#remove-status').textContent, /nguồn đã thay đổi/); studio.cancel();
  fixture(); deferProcessor = true; await studio.open(); click('#remove-people'); await wait(() => !!pendingResolve); click('#remove-stop'); assert.equal(studio.current().getState().busy, false); pendingResolve(); await tick(); assert.equal(studio.current().getState().result, null); assert.equal(document.querySelector('#remove-apply').disabled, true); studio.cancel(); deferProcessor = false;
});
test('manual review mode does not generate until requested and brush refinement can add a protected region', async () => {
  fixture(); await studio.open(); set('#remove-auto', false); const e = new window.Event('pointerdown', { bubbles: true }); Object.assign(e, { pointerId: 1, button: 0, clientX: 120, clientY: 15 }); document.querySelector('#remove-preview').dispatchEvent(e); await wait(() => !!studio.current()?.getState().regions.length && !studio.current().getState().busy); assert.equal(calls.length, 0);
  click('[data-remove-tool="protect"]'); document.querySelector('#remove-preview').dispatchEvent(e); document.querySelector('#remove-preview').dispatchEvent(new window.Event('pointerup', { bubbles: true })); assert.equal(studio.current().getState().strokes.length, 1); assert.equal(studio.current().getState().strokes[0].mode, 'protect'); click('#remove-undo'); assert.equal(studio.current().getState().strokes.length, 0); click('#remove-run'); await wait(() => !!studio.current()?.getState().result); studio.cancel();
});
