import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas, loadImage} from '@napi-rs/canvas';
import {cursorArtwork, cursorPreferences, CURSOR_DEFAULTS} from '../dist/cursor-theme.js';
import {setupDOM, tick} from './ui-harness.mjs';

const saved = new Map();
Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, String(value))
}});
const {document, window} = await setupDOM();
// A media-query test double verifies preference precedence, not OS rendering.
const contrast = {matches: false, listeners: [], addEventListener(_name, handler) {this.listeners.push(handler);}};
window.matchMedia = () => contrast;
const {studio} = await import('../dist/app.js');
for (let i = 0; i < 50 && !studio.ready(); i++) await tick();
const $ = s => document.querySelector(s);
const click = selector => {const element = $(selector); assert.ok(element); element.dispatchEvent(new window.Event('click', {bubbles: true}));};
const set = (selector, value) => {const element = $(selector); if (element.type === 'checkbox') element.checked = value; else element.value = String(value); element.dispatchEvent(new window.Event(element.type === 'checkbox' ? 'change' : 'input', {bubbles: true}));};

test('cursor images remain bounded, transparent and share the arrow-tip hotspot at every size', async () => {
  assert.deepEqual(cursorPreferences({enabled: 'false', glow: '<svg>', size: Infinity}), CURSOR_DEFAULTS);
  assert.deepEqual(cursorPreferences({enabled: false, glow: -10, size: 999}), {enabled: false, glow: 0, size: 150});
  for (const size of [75, 100, 150]) {
    const image = cursorArtwork({enabled: true, size, glow: 100});
    const bitmap = await loadImage(Buffer.from(decodeURIComponent(image.uri.split(',')[1])));
    assert.equal(bitmap.width, image.width);
    assert.ok(image.width <= 84 && image.x > 0 && image.y > 0);
    assert.ok(image.x < image.width && image.y < image.width);
    const c = createCanvas(bitmap.width, bitmap.height), x = c.getContext('2d');
    x.drawImage(bitmap, 0, 0);
    assert.equal(x.getImageData(bitmap.width - 1, 0, 1, 1).data[3], 0);
    assert.ok(x.getImageData(image.x + 1, image.y + 2, 1, 1).data[3] > 0);
  }
});

test('live cursor preview cancels without changing document history or saved preferences', async () => {
  const original = document.documentElement.style.getPropertyValue('--luma-cursor-default');
  const before = studio.getHistory();
  await studio.runAction('cursor-preferences');
  set('#cursor-glow', 95); set('#cursor-size', 135);
  assert.notEqual(document.documentElement.style.getPropertyValue('--luma-cursor-default'), original);
  assert.equal($('#cursor-glow-value').textContent, '95%');
  click('[data-modal-close]');
  assert.equal(document.documentElement.style.getPropertyValue('--luma-cursor-default'), original);
  assert.equal(saved.has('luma.cursor.v1'), false);
  assert.deepEqual(studio.getHistory(), before);
});

test('saving, disabling and resetting cursor preferences persist only the applied choice', async () => {
  await studio.runAction('cursor-preferences');
  set('#cursor-glow', 88); set('#cursor-size', 120);
  click('[data-modal-button="2"]');
  assert.deepEqual(JSON.parse(saved.get('luma.cursor.v1')), {enabled: true, glow: 88, size: 120});
  await studio.runAction('cursor-preferences');
  assert.equal(Number($('#cursor-size').value), 120);
  set('#cursor-enabled', false);
  assert.equal(document.documentElement.dataset.lumaCursor, 'system');
  assert.equal($('#cursor-glow').disabled, true);
  click('[data-modal-button="2"]');
  assert.equal(JSON.parse(saved.get('luma.cursor.v1')).enabled, false);
  await studio.runAction('cursor-preferences');
  click('[data-modal-button="0"]');
  assert.equal(document.documentElement.dataset.lumaCursor, 'mint');
  click('[data-modal-button="1"]');
  assert.equal(document.documentElement.dataset.lumaCursor, 'system');
  await studio.runAction('cursor-preferences');
  click('[data-modal-button="0"]'); click('[data-modal-button="2"]');
  assert.deepEqual(JSON.parse(saved.get('luma.cursor.v1')), CURSOR_DEFAULTS);
});

test('high-contrast mode restores system cursors while retaining the user preference', () => {
  contrast.matches = true; contrast.listeners.forEach(handler => handler());
  assert.equal(document.documentElement.dataset.lumaCursor, 'system');
  assert.equal(document.documentElement.style.getPropertyValue('--luma-cursor-default'), '');
  assert.equal(JSON.parse(saved.get('luma.cursor.v1')).enabled, true);
  contrast.matches = false; contrast.listeners.forEach(handler => handler());
  assert.equal(document.documentElement.dataset.lumaCursor, 'mint');
});

test('cursor preferences are discoverable through Edit and command search', async () => {
  click('[data-menu="Edit"]');
  assert.ok($('#menu-popover [data-action="cursor-preferences"]'));
  await studio.runAction('commands');
  $('#command-search').value = 'con tro';
  $('#command-search').dispatchEvent(new window.Event('input', {bubbles: true}));
  assert.ok($('#command-list [data-command-action="cursor-preferences"]'));
  click('[data-modal-close]');
});
