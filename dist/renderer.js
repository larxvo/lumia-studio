import {advancedText,paintText} from './text-engine.js';
import {styleLayer,hasLayerEffects} from './layer-effects.js';
import {patternTile} from './pattern-fill.js';
import { children } from "./pro-model.js";
import { filterPixels } from "./filters.js";
import { applyPixels, clamp } from "./model.js";
import {checkedCanvas} from './capacity.js';
const canvas=(w,h)=>checkedCanvas(w,h);

class Assets {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
    this.loading = /* @__PURE__ */ new Map();
    this.fonts = /* @__PURE__ */ new Map();
  }
  async load(source) {
    if (this.map.has(source)) return this.map.get(source);
    if (this.loading.has(source)) return this.loading.get(source);
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.map.set(source, img);
        this.loading.delete(source);
        resolve(img);
      };
      img.onerror = () => {
        this.loading.delete(source);
        reject(new Error("Unable to decode this image. Try PNG, JPEG or WebP."));
      };
      img.src = source;
    });
    this.loading.set(source, promise);
    return promise;
  }
  async loadFont(font) {
    if (this.fonts.has(font.family)) return this.fonts.get(font.family);
    if (typeof FontFace === "undefined") return;
    const face = new FontFace(font.family, `url(${font.source})`), promise = face.load().then((loaded) => {
      document.fonts.add(loaded);
      return loaded;
    }).catch((error) => {
      this.fonts.delete(font.family);
      throw error;
    });
    this.fonts.set(font.family, promise);
    return promise;
  }
  async hydrate(doc) {
    await Promise.all((doc.fonts || []).map((f) => this.loadFont(f)));
    await Promise.all([...doc.layers.flatMap((l) => [l.source, l.mask?.source]),...(doc.alphaChannels||[]).map(c=>c.mask.source), doc.selection?.source].filter(Boolean).map((s) => this.load(s)));
    for (const a of doc.smartObjects || []) {await this.load(a.source);if(a.document)await this.hydrate(a.document);}
  }
  get(source) {
    return this.map.get(source);
  }
  set(source, value) {
    this.map.set(source, value);
  }
  prune(docs) {
    const used = new Set(docs.flatMap((d) => [...d.layers.flatMap((l) => [l.source, l.mask?.source]),...(d.alphaChannels||[]).map(c=>c.mask.source), d.selection?.source]).filter(Boolean));
    for (const k of this.map.keys()) if (k.startsWith("data:") && !used.has(k)) this.map.delete(k);
  }
}
function maskCanvas(doc, mask, scale, assets) {
  const c = canvas(doc.width * scale, doc.height * scale), ctx = c.getContext("2d");
  if (!mask) return c;
  ctx.save();
  ctx.filter = mask.feather ? `blur(${Math.min(150, mask.feather) * scale}px)` : "none";
  ctx.fillStyle = "#fff";
  if (mask.type === "paint") {
    const image = assets.get(mask.source);
    if (image) ctx.drawImage(image, (mask.x || 0) * scale, (mask.y || 0) * scale, (mask.width || doc.width) * scale, (mask.height || doc.height) * scale);
  } else if (mask.type === "polygon") {
    ctx.beginPath();
    mask.points.forEach((p, i) => i ? ctx.lineTo(p[0] * scale, p[1] * scale) : ctx.moveTo(p[0] * scale, p[1] * scale));
    ctx.closePath();
    ctx.fill();
  } else if (mask.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse((mask.x + mask.width / 2) * scale, (mask.y + mask.height / 2) * scale, Math.abs(mask.width / 2 * scale), Math.abs(mask.height / 2 * scale), 0, 0, Math.PI * 2);
    ctx.fill();
  } else ctx.fillRect(mask.x * scale, mask.y * scale, mask.width * scale, mask.height * scale);
  ctx.restore();
  if(mask.antiAlias===false&&mask.type!=="paint"&&!mask.feather){const p=ctx.getImageData(0,0,c.width,c.height);for(let i=3;i<p.data.length;i+=4)p.data[i]=p.data[i]>=128?255:0;ctx.putImageData(p,0,0);}
  if (mask.invert) {
    ctx.globalCompositeOperation = "source-out";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "source-over";
  }
  if(mask.density!==undefined&&mask.density<100){const p=ctx.getImageData(0,0,c.width,c.height),d=Math.max(0,mask.density)/100;for(let i=3;i<p.data.length;i+=4)p.data[i]=255*(1-d)+p.data[i]*d;ctx.putImageData(p,0,0);}
  return c;
}
const graphemes = (text) => typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter(void 0, { granularity: "grapheme" }).segment(text)].map((x) => x.segment) : Array.from(text);
function textWidth(ctx, text, tracking = 0) {
  return ctx.measureText(text).width + Math.max(0, graphemes(text).length - 1) * tracking;
}
function textLines(ctx, layer) {
  const lines = [], tracking = layer.tracking || 0;
  for (const para of layer.text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (line && textWidth(ctx, candidate, tracking) > layer.width) {
        lines.push(line);
        line = "";
      }
      if (textWidth(ctx, word, tracking) > layer.width) {
        for (const glyph of graphemes(word)) {
          if (line && textWidth(ctx, line + glyph, tracking) > layer.width) {
            lines.push(line);
            line = "";
          }
          line += glyph;
        }
      } else line = line ? line + " " + word : word;
    }
    lines.push(line);
  }
  return lines;
}
function applyFilters(c, filters, scale) {
  if (!filters?.some((f) => f.visible !== false)) return;
  const x = c.getContext("2d", { willReadFrequently: true }), pixels = x.getImageData(0, 0, c.width, c.height);
  for (const f of filters) if (f.visible !== false) filterPixels(pixels.data, c.width, c.height, f.type, f.params, scale);
  x.putImageData(pixels, 0, 0);
}
function applyLayerMask(c, doc, layer, assets, scale) {
  if (!layer.mask || layer.mask.disabled) return;
  const x = c.getContext("2d"), m = maskCanvas(doc, layer.mask, scale, assets);
  x.globalCompositeOperation = "destination-in";
  x.drawImage(m, 0, 0);
  x.globalCompositeOperation = "source-over";
  m.width = m.height = 1;
}
function drawContent(ctx, layer, assets) {
  const { width: w, height: h } = layer, e = layer.effects || {};
  if (layer.type === "image" || layer.type === "paint") {
    const image = assets.get(layer.source);
    if (image) ctx.drawImage(image, 0, 0, w, h);
    return;
  }
  const color = layer.color || "#ffffff";
  ctx.fillStyle = color;
  ctx.strokeStyle = e.strokeColor || "#fff";
  ctx.lineWidth = e.strokeWidth || 2;
  if(layer.type==="text"&&advancedText(layer)){paintText(ctx,layer);}
  else if (layer.type === "text") {
    const family = /^[a-z0-9 _-]{1,80}$/i.test(layer.font || "") ? layer.font : "Arial";
    ctx.font = `${layer.italic ? "italic " : ""}${layer.fontWeight || 600} ${layer.fontSize || 48}px "${family}"`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = textLines(ctx, layer), tracking = layer.tracking || 0;
    lines.forEach((line, i) => {
      const y = i * layer.fontSize * (layer.lineHeight || 1.2), width = textWidth(ctx, line, tracking), start = layer.align === "center" ? (w - width) / 2 : layer.align === "right" ? w - width : 0;
      if (!tracking) {
        if (e.stroke) ctx.strokeText(line, start, y);
        ctx.fillText(line, start, y);
      } else {
        let pos = start;
        for (const glyph of graphemes(line)) {
          if (e.stroke) ctx.strokeText(glyph, pos, y);
          ctx.fillText(glyph, pos, y);
          pos += ctx.measureText(glyph).width + tracking;
        }
      }
      if (layer.underline) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, layer.fontSize / 20);
        ctx.beginPath();
        ctx.moveTo(start, y + layer.fontSize * 0.98);
        ctx.lineTo(start + width, y + layer.fontSize * 0.98);
        ctx.stroke();
        ctx.restore();
      }
    });
  } else if (layer.type === "shape") {
    if (layer.gradient) {
      const a = (layer.gradientAngle ?? 45) * Math.PI / 180, cx = w / 2, cy = h / 2, len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
      const g = layer.gradientType === "radial" ? ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2) : ctx.createLinearGradient(cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2, cx + Math.cos(a) * len / 2, cy + Math.sin(a) * len / 2);
      g.addColorStop(0, color);
      g.addColorStop(1, layer.color2 || "#235b66");
      ctx.fillStyle = g;
    }
    if(layer.patternFill){const tile=patternTile(canvas,layer.patternFill);ctx.fillStyle=ctx.createPattern(tile,"repeat");}
    ctx.beginPath();
    if (layer.shape === "path" && layer.path) {
      ctx.save();
      ctx.scale(w / (layer.pathWidth || w), h / (layer.pathHeight || h));
      for (const cmd of layer.path) {
        if (cmd[0] === "M") ctx.moveTo(cmd[1], cmd[2]);
        else if (cmd[0] === "L") ctx.lineTo(cmd[1], cmd[2]);
        else if (cmd[0] === "C") ctx.bezierCurveTo(...cmd.slice(1));
        else ctx.closePath();
      }
      ctx.restore();
    } else if (layer.shape === "line") {
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = layer.lineWidth || Math.max(2, h);
      ctx.stroke();
      return;
    } else if (layer.shape === "ellipse") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (layer.shape === "triangle") {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
    } else if (layer.shape === "star") {
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.22 : 0.5;
        const x = w / 2 + Math.cos(a) * w * r, y = h / 2 + Math.sin(a) * h * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    } else ctx.roundRect(0, 0, w, h, Math.min(layer.radius || 0, w / 2, h / 2));
    if (layer.fillEnabled !== false) ctx.fill();
    if (e.stroke) ctx.stroke();
  }
}
function renderLayer(doc, layer, assets, scale = 1, { effects = true, mask = true } = {}) {
  const raw = canvas(doc.width * scale, doc.height * scale), ctx = raw.getContext("2d"), e = layer.effects || {};
  if (layer.type === "group") paintStack(raw, doc, children(doc, layer.id), assets, scale);
  else {
    const local = canvas(layer.width * scale, layer.height * scale), lc = local.getContext("2d");
    lc.scale(scale, scale);
    // Open/unfilled paths need their intrinsic stroke to create a silhouette.
    const intrinsicStroke=layer.type==="shape"&&layer.fillEnabled===false&&layer.effects?.stroke;
    drawContent(lc, { ...layer, effects: intrinsicStroke ? layer.effects : {} }, assets);
    applyFilters(local, layer.filters, scale);
    ctx.save();
    ctx.translate((layer.x + layer.width / 2) * scale, (layer.y + layer.height / 2) * scale);
    ctx.rotate((layer.rotation || 0) * Math.PI / 180);
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    ctx.drawImage(local, -layer.width / 2 * scale, -layer.height / 2 * scale, layer.width * scale, layer.height * scale);
    ctx.restore();
    local.width = local.height = 1;
  }
  if (layer.type === "group") applyFilters(raw, layer.filters, scale);
  const styleInput=layer.type==="shape"&&layer.fillEnabled===false?{...layer,effects:{...layer.effects,stroke:false}}:layer;
  const result = styleLayer(raw, styleInput, scale, effects);
  if (mask) applyLayerMask(result, doc, layer, assets, scale);
  return result;
}
function paintStack(c, doc, layers, assets, scale, solo = null) {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  let base = null;
  for (let index = 0; index < layers.length; index++) {
    const l = layers[index];
    if (!l.visible || solo && l.id !== solo) {
      if (!l.clipToBelow && l.type !== "adjustment") {
        if (base) base.width = base.height = 1;
        base = null;
      }
      continue;
    }
    if (l.type === "adjustment") {
      if (l.clipToBelow && !base) continue;
      const image = ctx.getImageData(0, 0, c.width, c.height), original = new Uint8ClampedArray(image.data);
      let mask = l.mask && !l.mask.disabled ? maskCanvas(doc, l.mask, scale, assets) : null;
      if (l.clipToBelow && base) {
        if (!mask) {
          mask = canvas(c.width, c.height);
          mask.getContext("2d").drawImage(base, 0, 0);
        } else {
          const mx = mask.getContext("2d");
          mx.globalCompositeOperation = "destination-in";
          mx.drawImage(base, 0, 0);
        }
      }
      const m = mask ? mask.getContext("2d").getImageData(0, 0, c.width, c.height).data : null;
      if (l.adjustment === "blur") {
        const copy = canvas(c.width, c.height), cx = copy.getContext("2d");
        cx.filter = `blur(${clamp(l.params.radius || 0, 0, 100) * scale}px)`;
        cx.drawImage(c, 0, 0);
        const processed = cx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < image.data.length; i += 4) {
          const w = l.opacity * (l.fillOpacity??1) * (m ? m[i + 3] / 255 : 1);
          for (let k = 0; k < 3; k++) image.data[i + k] = original[i + k] + (processed[i + k] - original[i + k]) * w;
        }
        copy.width = copy.height = 1;
      } else applyPixels(image.data, l.adjustment, l.params, m, l.opacity*(l.fillOpacity??1));
      ctx.putImageData(image, 0, 0);
      if (mask) mask.width = mask.height = 1;
    } else {
      if (l.clipToBelow && !base) continue;
      const pass = l.type === "group" && l.blend === "pass-through" && l.opacity === 1 && (l.fillOpacity??1)===1 && (!l.mask||l.mask.disabled) && !l.clipToBelow && !l.filters?.some((f) => f.visible !== false) && !hasLayerEffects(l);
      if (pass) {
        paintStack(c, doc, children(doc, l.id), assets, scale);
        if (base) base.width = base.height = 1;
        base = null;
        let needed = false;
        for (let n = index + 1; n < layers.length; n++) {
          if (layers[n].clipToBelow) {
            needed = true;
            break;
          }
          if (layers[n].type !== "adjustment") break;
        }
        if (needed) base = renderLayer(doc, l, assets, scale);
        continue;
      }
      const rendered = renderLayer(doc, l, assets, scale);
      if (l.clipToBelow) {
        const rx = rendered.getContext("2d");
        rx.globalCompositeOperation = "destination-in";
        rx.drawImage(base, 0, 0);
        rx.globalCompositeOperation = "source-over";
      }
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = ["normal", "pass-through"].includes(l.blend) ? "source-over" : l.blend;
      ctx.drawImage(rendered, 0, 0);
      ctx.restore();
      if (!l.clipToBelow) {
        if (base) base.width = base.height = 1;
        base = rendered;
      } else rendered.width = rendered.height = 1;
    }
  }
  if (base) base.width = base.height = 1;
}
function renderDocument(doc, assets, { scale = 1, solo = null, background = null } = {}) {
  const c = canvas(doc.width * scale, doc.height * scale), ctx = c.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  paintStack(c, doc, solo ? doc.layers.filter((l) => l.id === solo) : children(doc), assets, scale, solo);
  return c;
}
function thumbnail(doc, layer, assets, width = 48, height = 36) {
  const c = canvas(width, height), ctx = c.getContext("2d");
  if (layer.type === "adjustment" || layer.type === "group") return c;
  const s = Math.min(width / layer.width, height / layer.height), local = canvas(layer.width * s, layer.height * s), lc = local.getContext("2d");
  lc.scale(s, s);
  drawContent(lc, layer, assets);
  ctx.drawImage(local, (width - local.width) / 2, (height - local.height) / 2);
  return c;
}
async function embeddedDocument(doc, assets) {
  const copy = JSON.parse(JSON.stringify(doc));
  const embed = async (source) => {
    if (!source || source.startsWith("data:")) return source;
    const image = await assets.load(source), c = canvas(image.width, image.height);
    c.getContext("2d").drawImage(image, 0, 0);
    return c.toDataURL("image/png");
  };
  for (const l of copy.layers) {
    if (l.source) l.source = await embed(l.source);
    for (const r of [l.photoRecipe, l.removalRecipe, l.productRecipe, l.cutoutRecipe, l.paperRecipe, l.colorRecipe, l.landscapeRecipe, l.sceneRecipe, l.artRecipe].filter(Boolean)) {
      r.source = await embed(r.source);
      if(r.regionsSource)r.regionsSource=await embed(r.regionsSource);if(r.peopleSource)r.peopleSource=await embed(r.peopleSource);
      for(const key of ['maskSource','inkSource','cleanSource','backgroundSource','skySource'])if(r[key])r[key]=await embed(r[key]);
      if (r.selectionSource) r.selectionSource = await embed(r.selectionSource);
      if (r.region?.source) r.region.source = await embed(r.region.source);
      for (const region of r.regions || []) region.source = await embed(region.source);
    }
  }
  for(const a of copy.smartObjects||[]) {a.source=await embed(a.source);if(a.document)a.document=await embeddedDocument(a.document,assets);}
  return copy;
}
export {
  Assets,
  canvas,
  drawContent,
  embeddedDocument,
  maskCanvas,
  renderDocument,
  renderLayer,
  textLines,
  thumbnail
};
