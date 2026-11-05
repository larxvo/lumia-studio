import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { setupDOM, tick } from './ui-harness.mjs';
import { createDocument, createLayer, validateDocument } from '../dist/model.js';
import { Assets } from '../dist/renderer.js';
import { createCutoutStudio } from '../dist/cutout-ui.js';
const { document, window } = await setupDOM();
const click = selector => { const e = document.querySelector(selector); assert.ok(e, selector); e.dispatchEvent(new window.Event('click', { bubbles: true })); };
function fixture(client) {
  const d = createDocument(80, 60, 'Cutout UI'), c = createCanvas(80, 60); c.getContext('2d').fillStyle = '#ba8b75'; c.getContext('2d').fillRect(0, 0, 80, 60);
  const source = c.toDataURL(), l = createLayer('image', { source, width: 80, height: 60, locked: true }); d.layers = [l]; d.activeId = l.id;
  const assets = new Assets(); assets.set(source, c); let commits = 0, closed = false, close;
  const api = { doc: () => d, assets, toast() {}, commit: () => commits++, closeModal: () => { closed = true; close?.(); }, showModal: (_, __, body, buttons, setup, cleanup) => {
    close = cleanup; document.querySelector('#modal-content').innerHTML = body + buttons.map((b, i) => `<button data-modal-button="${i}">${b.label}</button>`).join('');
    for (const e of document.querySelectorAll('[data-modal-button]')) e.onclick = buttons[Number(e.dataset.modalButton)].run;
    setup();
  } };
  const tool = createCutoutStudio(api, { clientFactory: () => client }); tool.open();
  return { d, l, source, tool, commits: () => commits, closed: () => closed };
}
test('cutout modal does not mutate during preview and creates two kept subjects only when applied', async () => {
  const values = new Float32Array(80 * 60); for (let y = 10; y < 50; y++) for (let x = 10; x < 35; x++) values[y * 80 + x] = 1;
  const f = fixture({ stop() {}, run: async () => ({ values, width: 80, height: 60, method: 'test double, not model evidence' }) });
  assert.equal(document.querySelector('#cutout-apply').disabled, true); click('#cutout-run'); await tick();
  assert.equal(f.commits(), 0); assert.equal(f.d.layers.length, 1); assert.equal(f.l.visible, true);
  click('#cutout-keep'); assert.match(document.querySelector('#cutout-kept').textContent, /Đã giữ 1/);
  click('[data-cutout-mode="auto"]'); click('#cutout-run'); await tick();
  assert.equal(document.querySelector('#cutout-apply').textContent, 'Tạo 2 layer đối tượng');
  click('#cutout-apply'); assert.equal(f.commits(), 1); assert.equal(f.closed(), true); assert.equal(f.d.layers.length, 3); assert.equal(f.l.source, f.source); assert.equal(f.l.visible, false); validateDocument(f.d);
});
test('stale async source is rejected and cancel stops client without document changes', async () => {
  let resolve, stops = 0;
  const f = fixture({ stop: () => stops++, run: () => new Promise(r => { resolve = r; }) });
  click('#cutout-run'); f.l.rotation = 20; resolve({ values: new Float32Array(4800).fill(1), width: 80, height: 60 }); await tick();
  assert.match(document.querySelector('#cutout-status').textContent, /đã thay đổi/); assert.equal(document.querySelector('#cutout-apply').disabled, true); assert.equal(f.commits(), 0);
  f.tool.cancel(); assert.ok(stops >= 2); assert.equal(f.d.layers.length, 1);
});
