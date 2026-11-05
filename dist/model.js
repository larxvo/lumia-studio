import {validateDocumentData,transformDocumentData} from './document-data.js';
import {validateText} from './text-engine.js';
import {levelLuts,hslRgb} from './tone-controls.js';
import {STYLE_DEFS,EFFECT_KEYS} from './layer-effects.js';
import { validatePhotoRecipe } from "./photo-recipe.js";
import { validateRemovalRecipe } from './removal-recipe.js';
import { validatePaperRecipe } from './paper-recipe.js';
import { validateProductRecipe } from './product-recipe.js';
import {validateColorRecipe} from './color-workflow.js';
import {validateLandscapeRecipe} from './landscape-recipe.js';
import {validateSceneRecipe} from './scene-recipe.js';
import {validateArtRecipe} from './art-recipe.js';
const VERSION = 1;
import {MAX_PIXELS,assertImageDimensions} from './capacity.js';
const BLENDS = ["pass-through", "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
const uid = () => globalThis.crypto?.randomUUID?.() || `l${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const defaults = (type) => ({ curves: { channel: "rgb", points: [[0, 0], [255, 255]] }, levels: { channel: "rgb", black: 0, white: 255, gamma: 1, outputBlack: 0, outputWhite: 255 }, brightness: { brightness: 0, contrast: 0 }, exposure: { exposure: 0 }, vibrance: { vibrance: 0, saturation: 0 }, hue: { hue: 0, saturation: 0, lightness: 0, colorize: false }, monochrome: { amount: 100 }, temperature: { temperature: 0, tint: 0 }, invert: { amount: 100 }, grain: { amount: 15 }, blur: { radius: 4 }, colorbalance: { red: 0, green: 0, blue: 0 }, shadows: { shadows: 0, highlights: 0 }, posterize: { levels: 6 }, threshold: { level: 128 }, channelmixer: { rr: 100, rg: 0, rb: 0, gr: 0, gg: 100, gb: 0, br: 0, bg: 0, bb: 100 } })[type] || {};
function createLayer(type, values = {}) {
  return { id: uid(), type, name: type === "adjustment" ? "Adjustment" : type[0].toUpperCase() + type.slice(1), visible: true, locked: false, opacity: 1, fillOpacity: 1, blend: "normal", x: 0, y: 0, width: 600, height: 300, rotation: 0, mask: null, effects: { shadow: false, shadowColor: "#000000", shadowBlur: 20, shadowX: 0, shadowY: 12, glow: false, glowColor: "#7de4d4", glowSize: 24, stroke: false, strokeColor: "#ffffff", strokeWidth: 2 }, ...values };
}
function createDocument(width = 1800, height = 1200, name = "Untitled") {
  assertDimensions(width, height);
  return { format: "luma-studio", version: VERSION, id: uid(), name, width, height, layers: [], activeId: null, selection: null };
}
function assertDimensions(width, height) {
  assertImageDimensions(width,height);
}
function validateDocument(value, depth = 0) {
  if (depth > 3) throw new Error('Smart Objects support at most three embedded document levels.');
  if (!value || value.format !== "luma-studio" || value.version !== VERSION) throw new Error("This is not a supported Luma project (version 1).");
  assertDimensions(value.width, value.height);
  if (typeof value.name !== "string" || value.name.length > 200 || typeof value.id !== "string") throw new Error("Invalid project identity.");
  if (!Array.isArray(value.layers) || value.layers.length > 150) throw new Error("Projects support up to 150 layers.");
  const seen = /* @__PURE__ */ new Set();
  const objectIds = new Set();
  if (value.smartObjects !== undefined) {
    if (!Array.isArray(value.smartObjects) || value.smartObjects.length > 30) throw new Error('Invalid Smart Object collection.');
    for (const a of value.smartObjects) {
      if (!a || typeof a.id !== 'string' || objectIds.has(a.id) || typeof a.name !== 'string' || a.name.length > 200) throw new Error('Invalid embedded Smart Object.');
      objectIds.add(a.id); assertDimensions(a.width,a.height); assertSource(a.source);
      if (a.document) validateDocument(a.document, depth+1);
    }
  }
  if (value.colorManagement !== undefined) {
    const c=value.colorManagement;
    if (!c || c.workingSpace !== 'sRGB' || !Number.isInteger(c.intent) || c.intent<0 || c.intent>3 || typeof c.blackPointCompensation!=='boolean' || typeof c.proof!=='boolean' || typeof c.profileName!=='string' || c.profileName.length>200 || c.profileData!==null && (typeof c.profileData!=='string' || c.profileData.length>8e6 || !/^[A-Za-z0-9+/]+={0,2}$/.test(c.profileData))) throw new Error('Invalid ICC color settings.');
  }
  validateDocumentData(value,assertSource);
  for (const l of value.layers) {
    if (!["image", "paint", "text", "shape", "adjustment", "group"].includes(l.type) || typeof l.id !== "string" || seen.has(l.id)) throw new Error("Invalid layer in project.");
    seen.add(l.id);
    if(l.locks&&Object.entries(l.locks).some(([k,v])=>!["position","pixels","transparency"].includes(k)||typeof v!=="boolean"))throw Error("Invalid layer locks.");
    if(l.type==="text")validateText(l);
    if (typeof l.name !== "string" || l.name.length > 200) throw new Error("Invalid layer name.");
    if (!Number.isFinite(l.opacity) || l.opacity < 0 || l.opacity > 1 || !BLENDS.includes(l.blend)) throw new Error("Invalid layer blending.");
    if(l.fillOpacity!==undefined&&(!Number.isFinite(l.fillOpacity)||l.fillOpacity<0||l.fillOpacity>1))throw Error("Invalid layer fill.");
    if(l.aspectLocked!==undefined&&typeof l.aspectLocked!=="boolean")throw Error("Invalid aspect lock.");
    if(l.patternFill&&(!["dots","cross","checker","lines","grid","diagonal"].includes(l.patternFill.kind)||!Number.isFinite(l.patternFill.size)||l.patternFill.size<4||l.patternFill.size>256||!/^#[0-9a-f]{6}$/i.test(l.patternFill.color)||l.patternFill.background&&!/^#[0-9a-f]{6}$/i.test(l.patternFill.background)))throw Error("Invalid pattern fill.");
    for (const k of ["x", "y", "width", "height", "rotation"]) if (!Number.isFinite(l[k]) || Math.abs(l[k]) > 1e5) throw new Error("Invalid layer geometry.");
    if (l.width < 1 || l.height < 1 || l.type !== "group" && l.width * l.height > MAX_PIXELS) throw new Error("Layer size exceeds the supported limits.");
    for (const key of ["flipX", "flipY"]) if (l[key] !== void 0 && typeof l[key] !== "boolean") throw new Error("Invalid flip state.");
    if (l.type === "image" || l.type === "paint") assertSource(l.source);
    if (l.smartObjectId !== undefined && (l.type!=='image' || !objectIds.has(l.smartObjectId))) throw new Error('Missing Smart Object content.');
    if (l.generation !== undefined) {
      const g=l.generation;
      if(!g||g.version!==1||!['lama','eccv16','comfyui'].includes(g.engine)||!['repair','expression','colorization','skin','beard','art'].includes(g.operation)||typeof g.prompt!=='string'||g.prompt.length>4000||!Number.isSafeInteger(g.seed)||g.seed<0||g.seed>2147483647||!Number.isFinite(g.strength)||g.strength<0||g.strength>100) throw new Error('Invalid AI result metadata.');
      if(g.maskSource!==null) assertSource(g.maskSource);
    }
    if (l.assistance !== undefined) {
      const a=l.assistance;
      if(!a||a.version!==1||!['reference-patch','guided-color'].includes(a.operation)||!Number.isFinite(a.strength)||a.strength<1||a.strength>100||!Array.isArray(a.processingSize)||a.processingSize.length!==2)throw Error('Invalid restoration provenance.');
      assertDimensions(...a.processingSize);
      if(a.feather!==undefined&&(!Number.isFinite(a.feather)||a.feather<0||a.feather>100))throw Error('Invalid restoration feather.');
      if(a.operation==='guided-color'&&!/^#[0-9a-f]{6}$/i.test(a.color))throw Error('Invalid guided color.');
      if(a.operation==='reference-patch'&&(typeof a.sourceName!=='string'||a.sourceName.length>200||!Array.isArray(a.matrix)||a.matrix.length!==6||a.matrix.some(v=>!Number.isFinite(v))||!a.points||['source','target'].some(k=>!Array.isArray(a.points[k])||a.points[k].length!==3||a.points[k].some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))))throw Error('Invalid reference alignment.');
    }
    if(l.artRecipe){if(!['image','paint'].includes(l.type))throw Error('Art recipes require a pixel layer.');validateArtRecipe(l.artRecipe,assertSource);}
    if(l.sceneRecipe){if(!['image','paint'].includes(l.type))throw Error('Scene recipes require a pixel layer.');validateSceneRecipe(l.sceneRecipe,assertSource);}
    if(l.landscapeRecipe){if(!['image','paint'].includes(l.type))throw Error('Landscape recipes require a pixel layer.');validateLandscapeRecipe(l.landscapeRecipe,assertSource);}
    if(l.colorRecipe){if(!['image','paint'].includes(l.type))throw Error('Color recipes require a pixel layer.');validateColorRecipe(l.colorRecipe,assertSource);}
    if (l.paperRecipe) { if (!['image', 'paint'].includes(l.type)) throw Error('Paper recipes require a pixel layer.'); validatePaperRecipe(l.paperRecipe, assertSource); }
    if (l.productRecipe) {
      if (!['image', 'paint'].includes(l.type)) throw Error('Product recipes require a pixel layer.');
      validateProductRecipe(l.productRecipe, assertSource);
    }
    if (l.cutoutRecipe) { const r = l.cutoutRecipe; if (!['image', 'paint'].includes(l.type) || r.version !== 1 || !Number.isFinite(r.decontaminate) || r.decontaminate < 0 || r.decontaminate > 100) throw Error('Invalid cutout provenance.'); assertSource(r.source); }
    if (l.removalRecipe) {
      if (!['image', 'paint'].includes(l.type)) throw Error('Removal recipes require a pixel layer.');
      validateRemovalRecipe(l.removalRecipe, assertSource);
    }
    if (l.photoRecipe) {
      if (!["image", "paint"].includes(l.type)) throw new Error("Photo recipes require a pixel layer.");
      validatePhotoRecipe(l.photoRecipe, assertSource);
    }
    if (l.type === "text" && (typeof l.text !== "string" || l.text.length > 1e4 || !Number.isFinite(l.fontSize) || l.fontSize < 1 || l.fontSize > 2048)) throw new Error("Invalid text layer.");
    if (l.parentId !== void 0 && l.parentId !== null && typeof l.parentId !== "string") throw new Error("Invalid parent group.");
    if (l.blend === "pass-through" && l.type !== "group") throw new Error("Pass through applies only to groups.");
    for (const k of ["lineHeight", "fontWeight", "radius", "tracking", "gradientAngle", "pathWidth", "pathHeight", "lineWidth"]) if (l[k] !== void 0 && !Number.isFinite(l[k])) throw new Error("Invalid layer property.");
    for (const k of ["color", "color2"]) if (l[k] !== void 0 && (typeof l[k] !== "string" || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(l[k]))) throw new Error("Invalid layer color.");
    if (l.filters) {
      if (!Array.isArray(l.filters) || l.filters.length > 12) throw new Error("Use at most 12 live filters per layer.");
      for (const f of l.filters) {
        if (!["sharpen", "unsharp", "gaussian", "pixelate", "median", "emboss", "highpass", "vignette", "sepia", "invert"].includes(f.type) || !f.params || typeof f.params !== "object" || Object.values(f.params).some((v) => !Number.isFinite(v) || Math.abs(v) > 1e3)) throw new Error("Invalid live filter.");
      }
    }
    if (l.path) {
      if (!Array.isArray(l.path) || l.path.length > 2000 || l.path.some((cmd) => !Array.isArray(cmd) || !["M", "L", "C", "Z"].includes(cmd[0]) || cmd.length !== { M: 3, L: 3, C: 7, Z: 1 }[cmd[0]] || cmd.slice(1).some((v) => !Number.isFinite(v) || Math.abs(v) > 1e5))) throw new Error("Invalid vector path.");
    }
    if (l.effects) {
      if(l.effects.stack!==undefined&&(!Array.isArray(l.effects.stack)||l.effects.stack.length>9||l.effects.stack.some(k=>!EFFECT_KEYS.includes(k))))throw Error("Invalid effect stack.");
      for(const key of EFFECT_KEYS) {if(l.effects[key]!==undefined&&typeof l.effects[key]!=="boolean")throw Error("Invalid effect toggle.");const blend=l.effects[key+"Blend"];if(blend!==undefined&&!BLENDS.includes(blend))throw Error("Invalid effect blend.");for(const ck of [key+"Color",key+"Color2"])if(l.effects[ck]!==undefined&&!/^#[0-9a-f]{6}$/i.test(l.effects[ck]))throw Error("Invalid effect color.");}
      for(const def of STYLE_DEFS)for(const [key,,min,max] of def[3])if(l.effects[key]!==undefined&&(!Number.isFinite(l.effects[key])||l.effects[key]<min||l.effects[key]>max))throw Error("Invalid effect setting.");
      for (const k of ["shadowBlur", "shadowX", "shadowY", "glowSize", "strokeWidth"]) if (l.effects[k] !== void 0 && (!Number.isFinite(l.effects[k]) || Math.abs(l.effects[k]) > 1e3)) throw new Error("Invalid layer effect.");
      for (const k of ["shadowColor", "glowColor", "strokeColor"]) if (l.effects[k] !== void 0 && !/^#[0-9a-f]{6}$/i.test(l.effects[k])) throw new Error("Invalid effect color.");
    }
    if (l.type === "adjustment") {
      if (!Object.keys(defaults(l.adjustment)).length || !l.params || typeof l.params !== "object") throw new Error("Unsupported adjustment.");
      for (const [key, value2] of Object.entries(l.params)) if (!["points", "channel", "channels", "colorize"].includes(key) && !Number.isFinite(value2)) throw new Error("Invalid adjustment value.");
      if(l.adjustment==="hue"&&l.params.colorize!==undefined&&typeof l.params.colorize!=="boolean")throw Error("Invalid Colorize setting.");
      if(l.adjustment==="levels"){if(l.params.channel!==undefined&&!["rgb","red","green","blue"].includes(l.params.channel))throw Error("Invalid Levels channel.");for(const [key,bank]of Object.entries(l.params.channels||{})){if(!["rgb","red","green","blue"].includes(key)||!bank||Object.values(bank).some(v=>!Number.isFinite(v)))throw Error("Invalid Levels channel bank.");}}
      if (l.adjustment === "curves") {
        const p = l.params.points;
        if (!Array.isArray(p) || p.length < 2 || p.length > 12 || p.some((q, i) => !Array.isArray(q) || q.length !== 2 || q.some((v) => !Number.isFinite(v) || v < 0 || v > 255) || i > 0 && q[0] <= p[i - 1][0])) throw new Error("Invalid curve points.");
        if (!["rgb", "red", "green", "blue"].includes(l.params.channel)) throw new Error("Invalid curve channel.");
        if (l.params.channels) for (const [channel, points] of Object.entries(l.params.channels)) {
          if (!["rgb", "red", "green", "blue"].includes(channel) || !Array.isArray(points) || points.length < 2 || points.length > 12 || points.some((q, i) => !Array.isArray(q) || q.length !== 2 || q.some((v) => !Number.isFinite(v) || v < 0 || v > 255) || i > 0 && q[0] <= points[i - 1][0])) throw new Error("Invalid stored curve channel.");
        }
      }
    }
    if (l.mask) {
      if(l.mask.linked!==undefined&&typeof l.mask.linked!=="boolean")throw Error("Invalid mask link state.");
      if(l.mask.antiAlias!==undefined&&typeof l.mask.antiAlias!=="boolean")throw Error("Invalid mask anti-alias.");
      if(l.mask.disabled!==undefined&&typeof l.mask.disabled!=="boolean")throw Error("Invalid mask visibility.");
      if(l.mask.density!==undefined&&(!Number.isFinite(l.mask.density)||l.mask.density<0||l.mask.density>100))throw Error("Invalid mask density.");
      if (!["rect", "ellipse", "polygon", "paint"].includes(l.mask.type)) throw new Error("Unsupported mask.");
      if (l.mask.type === "paint") assertSource(l.mask.source);
      for (const k of ["x", "y", "width", "height", "feather"]) if (l.mask[k] !== void 0 && (!Number.isFinite(l.mask[k]) || Math.abs(l.mask[k]) > 1e5)) throw new Error("Invalid mask.");
      if (l.mask.type === "polygon" && (!Array.isArray(l.mask.points) || l.mask.points.length > 1e4 || l.mask.points.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((v) => !Number.isFinite(v))))) throw new Error("Invalid selection polygon.");
    }
  }
  validateDocumentData(value,assertSource);
  for (const l of value.layers) {
    let current = l, chain = /* @__PURE__ */ new Set([l.id]);
    while (current.parentId) {
      const parent = value.layers.find((g) => g.id === current.parentId);
      if (!parent || parent.type !== "group" || chain.has(parent.id)) throw new Error("Invalid or cyclic group hierarchy.");
      chain.add(parent.id);
      current = parent;
    }
  }
  if (value.selectedIds && (!Array.isArray(value.selectedIds) || value.selectedIds.length > 150 || value.selectedIds.some((id) => !seen.has(id)))) throw new Error("Invalid selected layers.");
  if (value.guides && (!Array.isArray(value.guides) || value.guides.length > 50 || value.guides.some((g) => !["x", "y"].includes(g.axis) || !Number.isFinite(g.position) || Math.abs(g.position) > Math.max(value.width,value.height)))) throw new Error("Invalid guides.");
  if (value.fonts) {
    if (!Array.isArray(value.fonts) || value.fonts.length > 8 || value.fonts.some((f) => !/^LumaFont_[a-z0-9-]+$/i.test(f.family) || typeof f.source !== "string" || f.source.length > 4e6 || !/^data:(font\/(woff2?|ttf|otf)|application\/(font-woff|x-font-ttf|octet-stream));base64,[A-Za-z0-9+/=]+$/.test(f.source))) throw new Error("Invalid embedded font.");
  }
  if (value.selection) {
    const s = value.selection;
    if (!["rect", "ellipse", "polygon", "paint"].includes(s.type)) throw new Error("Invalid selection.");
    if (s.type === "paint") assertSource(s.source);
    for (const k of ["x", "y", "width", "height", "feather"]) if (s[k] !== void 0 && (!Number.isFinite(s[k]) || Math.abs(s[k]) > 1e5)) throw new Error("Invalid selection geometry.");
    if (s.type === "polygon" && (!Array.isArray(s.points) || s.points.length < 3 || s.points.length > 1e4 || s.points.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((v) => !Number.isFinite(v))))) throw new Error("Invalid selection polygon.");
  }
  if (!seen.has(value.activeId)) value.activeId = value.layers.at(-1)?.id || null;
  return value;
}
function assertSource(s) {
  if (typeof s !== "string" || !(s.startsWith("data:image/png;base64,") || s.startsWith("data:image/jpeg;base64,") || s.startsWith("data:image/webp;base64,") || s === "assets/wave.jpg")) throw new Error("Projects only accept embedded PNG, JPEG or WebP images.");
}
class History {
  constructor(doc, label = "Document opened", limit = 40) {
    this.limit = limit;
    this.entries = [];
    this.index = -1;
    this.push(doc, label);
  }
  push(doc, label) {
    const snapshot = JSON.stringify(doc);
    if (this.entries[this.index]?.snapshot === snapshot) return false;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ label, snapshot, time: Date.now() });
    this.index = this.entries.length - 1;
    let bytes = this.entries.reduce((n, e) => n + e.snapshot.length * 2, 0);
    while (this.entries.length > this.limit || bytes > 100 * 1024 * 1024 && this.entries.length > 2) {
      bytes -= this.entries.shift().snapshot.length * 2;
      this.index--;
    }
    return true;
  }
  go(index) {
    this.index = clamp(index, 0, this.entries.length - 1);
    return JSON.parse(this.entries[this.index].snapshot);
  }
  undo() {
    return this.index > 0 ? this.go(this.index - 1) : null;
  }
  redo() {
    return this.index < this.entries.length - 1 ? this.go(this.index + 1) : null;
  }
}
function localPoint(layer, x, y) {
  const a = -layer.rotation * Math.PI / 180, dx = x - layer.x - layer.width / 2, dy = y - layer.y - layer.height / 2;
  return { x: dx * Math.cos(a) - dy * Math.sin(a) + layer.width / 2, y: dx * Math.sin(a) + dy * Math.cos(a) + layer.height / 2 };
}
function hitLayer(doc, x, y) {
  return [...doc.layers].reverse().find((l) => {
    if (!l.visible || l.locked || ["adjustment", "group"].includes(l.type)) return false;
    let parent = l;
    for (let n = 0; parent.parentId && n < 150; n++) {
      parent = doc.layers.find((x2) => x2.id === parent.parentId);
      if (!parent || !parent.visible || parent.locked) return false;
    }
    const p = localPoint(l, x, y);
    return p.x >= 0 && p.y >= 0 && p.x <= l.width && p.y <= l.height;
  });
}
function moveLayer(layer, dx, dy, {forceMask=false}={}) {
  layer.x += dx;
  layer.y += dy;
  if (layer.mask && (forceMask || layer.mask.linked!==false)) {
    layer.mask.x = (layer.mask.x || 0) + dx;
    layer.mask.y = (layer.mask.y || 0) + dy;
    if (layer.mask.points) layer.mask.points = layer.mask.points.map((p) => [p[0] + dx, p[1] + dy]);
  }
}
function cropDocument(doc, rect) {
  const x = clamp(Math.floor(rect.x), 0, doc.width - 1), y = clamp(Math.floor(rect.y), 0, doc.height - 1);
  const width = clamp(Math.round(rect.width), 1, doc.width - x), height = clamp(Math.round(rect.height), 1, doc.height - y);
  doc.layers.forEach((l) => moveLayer(l, -x, -y,{forceMask:true}));
  for(const c of doc.alphaChannels||[])moveLayer({x:0,y:0,mask:c.mask},-x,-y,{forceMask:true});
  transformDocumentData(doc,[1,0,0,1,-x,-y]);
  doc.width = width;
  doc.height = height;
  doc.selection = null;
  return { x, y, width, height };
}
function curveLut(points) {
  const p = points.map((p2) => [clamp(p2[0]), clamp(p2[1])]).sort((a, b) => a[0] - b[0]);
  if (!p.length) return Uint8Array.from({ length: 256 }, (_, i) => i);
  const lut = new Uint8Array(256);
  for (let i = 0, j = 0; i < 256; i++) {
    while (j < p.length - 2 && i > p[j + 1][0]) j++;
    const a = p[j], b = p[Math.min(j + 1, p.length - 1)], t = clamp((i - a[0]) / (b[0] - a[0] || 1), 0, 1);
    lut[i] = Math.round(a[1] + t * (b[1] - a[1]));
  }
  return lut;
}
function applyPixels(data, type, params = {}, mask = null, opacity = 1) {
  const p = { ...defaults(type), ...params }, luts = type === "curves" ? Object.fromEntries(["rgb", "red", "green", "blue"].map((c2) => [c2, curveLut(c2 === p.channel ? p.points : p.channels?.[c2] || [[0, 0], [255, 255]])])) : null;
  const levels=type==="levels"?levelLuts(p):null;
  const gamma = clamp(Number(p.gamma) || 1, 0.1, 4), black = clamp(p.black || 0, 0, 254), white = clamp(p.white ?? 255, black + 1, 255);
  const c = clamp(p.contrast || 0, -100, 100) * 2.55, cf = 259 * (c + 255) / (255 * (259 - c));
  const hue = (p.hue || 0) * Math.PI / 180, ch = Math.cos(hue), sh = Math.sin(hue);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let R = r, G = g, B = b;
    if (type === "curves") {
      R = luts.red[luts.rgb[r]];
      G = luts.green[luts.rgb[g]];
      B = luts.blue[luts.rgb[b]];
    } else if (type === "levels") {
      R = levels.red[Math.round(levels.rgb[r])];
      G = levels.green[Math.round(levels.rgb[g])];
      B = levels.blue[Math.round(levels.rgb[b])];
    } else if (type === "brightness") {
      const a = (p.brightness || 0) * 2.55;
      R = cf * (r - 128) + 128 + a;
      G = cf * (g - 128) + 128 + a;
      B = cf * (b - 128) + 128 + a;
    } else if (type === "exposure") {
      const e = 2 ** clamp(p.exposure || 0, -5, 5);
      R = r * e;
      G = g * e;
      B = b * e;
    } else if(type==="hue"&&p.colorize){const light=(Math.max(r,g,b)+Math.min(r,g,b))/510;[R,G,B]=hslRgb(p.hue||0,clamp(p.saturation||0,0,100)/100,clamp(light+(p.lightness||0)/100,0,1));
    } else if (type === "hue" || type === "vibrance") {
      const Y = 0.299 * r + 0.587 * g + 0.114 * b, U = -0.14713 * r - 0.28886 * g + 0.436 * b, V = 0.615 * r - 0.51499 * g - 0.10001 * b;
      const s = clamp(1 + (p.saturation || 0) / 100 + (type === "vibrance" ? (p.vibrance || 0) / 100 * (1 - (Math.max(r, g, b) - Math.min(r, g, b)) / 255) : 0), 0, 3);
      const u = (U * ch - V * sh) * s, v = (U * sh + V * ch) * s, light = (p.lightness || 0) * 2.55;
      R = Y + 1.13983 * v + light;
      G = Y - 0.39465 * u - 0.5806 * v + light;
      B = Y + 2.03211 * u + light;
    } else if (type === "monochrome") {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b, a = clamp(p.amount, 0, 100) / 100;
      R = r + (l - r) * a;
      G = g + (l - g) * a;
      B = b + (l - b) * a;
    } else if (type === "temperature") {
      R = r + (p.temperature || 0) * 0.65;
      B = b - (p.temperature || 0) * 0.65;
      G = g + (p.tint || 0) * 0.4;
    } else if (type === "invert") {
      const a = clamp(p.amount, 0, 100) / 100;
      R = r + (255 - 2 * r) * a;
      G = g + (255 - 2 * g) * a;
      B = b + (255 - 2 * b) * a;
    } else if (type === "colorbalance") {
      R = r + (p.red || 0) * 1.2;
      G = g + (p.green || 0) * 1.2;
      B = b + (p.blue || 0) * 1.2;
    } else if (type === "shadows") {
      const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255, delta = (p.shadows || 0) * 1.4 * (1 - lum) ** 2 - (p.highlights || 0) * 1.4 * lum ** 2;
      R = r + delta;
      G = g + delta;
      B = b + delta;
    } else if (type === "posterize") {
      const n = clamp(Math.round(p.levels || 6), 2, 32) - 1;
      R = Math.round(r / 255 * n) * 255 / n;
      G = Math.round(g / 255 * n) * 255 / n;
      B = Math.round(b / 255 * n) * 255 / n;
    } else if (type === "threshold") {
      R = G = B = r * 0.2126 + g * 0.7152 + b * 0.0722 >= (p.level ?? 128) ? 255 : 0;
    } else if (type === "channelmixer") {
      R = (r * p.rr + g * p.rg + b * p.rb) / 100;
      G = (r * p.gr + g * p.gg + b * p.gb) / 100;
      B = (r * p.br + g * p.bg + b * p.bb) / 100;
    } else if (type === "grain") {
      let n = Math.imul(i / 4 + 1, 1597334677) >>> 0;
      n = (n ^ n >>> 15) >>> 0;
      const amount = (n % 1e3 / 1e3 - 0.5) * (p.amount || 0) * 2;
      R = r + amount;
      G = g + amount;
      B = b + amount;
    }
    const weight = clamp(opacity, 0, 1) * (mask ? mask[i + 3] / 255 : 1);
    data[i] = r + (clamp(R) - r) * weight;
    data[i + 1] = g + (clamp(G) - g) * weight;
    data[i + 2] = b + (clamp(B) - b) * weight;
  }
  return data;
}
function histogram(data, channel="luminance") {
  const bins = new Uint32Array(256);
  let count = 0, sum = 0, square = 0;
  const ci={red:0,green:1,blue:2,alpha:3}[channel];
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const v=ci===undefined?Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]):data[i+ci];
    bins[v]++;
    count++;
    sum += v;
    square += v * v;
  }
  const mean = count ? sum / count : 0;
  let median=0,n=0;for(let i=0;i<256;i++){n+=bins[i];if(n>=count/2){median=i;break;}}
  return { bins, count, mean, median, stdDev: count ? Math.sqrt(Math.max(0, square / count - mean * mean)) : 0 };
}
function floodSelection(data, width, height, x, y, tolerance = 32) {
  x = clamp(Math.floor(x), 0, width - 1);
  y = clamp(Math.floor(y), 0, height - 1);
  const seed = (y * width + x) * 4, visited = new Uint8Array(width * height), stack = new Int32Array(width * height), out = new Uint8ClampedArray(data.length);
  let top = 0;
  stack[top++] = y * width + x;
  visited[y * width + x] = 1;
  const matches = (i) => Math.max(Math.abs(data[i] - data[seed]), Math.abs(data[i + 1] - data[seed + 1]), Math.abs(data[i + 2] - data[seed + 2]), Math.abs(data[i + 3] - data[seed + 3])) <= tolerance;
  while (top) {
    const n = stack[--top], i = n * 4;
    if (!matches(i)) continue;
    out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 255;
    const px = n % width, py = Math.floor(n / width);
    for (const q of [px > 0 ? n - 1 : -1, px < width - 1 ? n + 1 : -1, py > 0 ? n - width : -1, py < height - 1 ? n + width : -1]) if (q >= 0 && !visited[q]) {
      visited[q] = 1;
      stack[top++] = q;
    }
  }
  return out;
}
export {
  BLENDS,
  History,
  MAX_PIXELS,
  VERSION,
  applyPixels,
  assertDimensions,
  clamp,
  clone,
  createDocument,
  createLayer,
  cropDocument,
  curveLut,
  defaults,
  floodSelection,
  histogram,
  hitLayer,
  localPoint,
  moveLayer,
  uid,
  validateDocument
};
