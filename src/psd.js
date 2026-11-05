import {readTypography,writeTypography} from './psd-typography.js';
import {readDocumentExtras,writeDocumentExtras} from './psd-document-data.js';
import {supportedSmartStack,importSmartFilters,exportSmartFilters} from './psd-smart-filters.js';
import {hasLayerEffects} from '../dist/layer-effects.js';
import {levelSettings} from '../dist/tone-controls.js';
import { children, refreshGroups } from "../dist/pro-model.js";
import { readPsd, writePsd, initializeCanvas } from "ag-psd";
import { createDocument, createLayer, assertDimensions, BLENDS, defaults, clamp, uid } from "../dist/model.js";
import { canvas, renderDocument, renderLayer, maskCanvas } from "../dist/renderer.js";
initializeCanvas((w, h) => canvas(w, h));
const fromBlend = (s) => s?.replaceAll(" ", "-") || "normal";
const toBlend = (s) => s.replaceAll("-", " ");
const effectOn = (l) => l.effects && Object.values(l.effects).some((v) => v === true || (Array.isArray(v) ? v.some((e) => e?.enabled !== false) : v && typeof v === "object" && v.enabled !== false));
function fromAdjustment(a) {
  if (!a) return null;
  let type, params;
  if (a.type === "brightness/contrast") {
    type = "brightness";
    params = { brightness: a.brightness || 0, contrast: a.contrast || 0 };
  }
  if (a.type === "exposure" && !(a.offset || 0) && (a.gamma === void 0 || a.gamma === 1)) {
    type = "exposure";
    params = { exposure: a.exposure || 0 };
  }
  if (a.type === "vibrance") {
    type = "vibrance";
    params = { vibrance: a.vibrance || 0, saturation: a.saturation || 0 };
  }
  if (a.type === "posterize") {
    type = "posterize";
    params = { levels: a.levels || 6 };
  }
  if (a.type === "threshold") {
    type = "threshold";
    params = { level: a.level ?? 128 };
  }
  if (a.type === "invert") {
    type = "invert";
    params = { amount: 100 };
  }
  if(a.type==="levels") {type="levels";const channels={};for(const k of ['rgb','red','green','blue'])if(a[k]){const c=a[k];channels[k]={black:c.shadowInput??0,white:c.highlightInput??255,gamma:c.midtoneInput??1,outputBlack:c.shadowOutput??0,outputWhite:c.highlightOutput??255};}params={...levelSettings(channels.rgb),channel:'rgb',channels};}
  if (a.type === "curves") {
    const channels = {};
    for (const key of ["rgb", "red", "green", "blue"]) if (a[key]) channels[key] = a[key].map((p) => [p.input, p.output]).sort((a2, b) => a2[0] - b[0]);
    if (Object.values(channels).some((ps) => ps.length < 2 || ps.length > 12 || ps.some((p, i) => p.some((n) => !Number.isFinite(n) || n < 0 || n > 255) || i > 0 && p[0] <= ps[i - 1][0]))) return null;
    type = "curves";
    params = { channel: "rgb", points: channels.rgb || [[0, 0], [255, 255]], channels };
  }
  if (a.type === "hue/saturation" && a.master && !a.colorize && !["reds", "yellows", "greens", "cyans", "blues", "magentas"].some((k) => a[k] && (a[k].hue || a[k].saturation || a[k].lightness))) {
    type = "hue";
    params = { hue: a.master.hue || 0, saturation: a.master.saturation || 0, lightness: a.master.lightness || 0 };
  }
  return type ? { adjustment: type, params: { ...defaults(type), ...params } } : null;
}
function toAdjustment(l) {
  const p = l.params;
  if (l.adjustment === "posterize") return { type: "posterize", levels: p.levels };
  if (l.adjustment === "threshold") return { type: "threshold", level: p.level };
  if (l.adjustment === "brightness") return { type: "brightness/contrast", brightness: p.brightness, contrast: p.contrast, useLegacy: true };
  if (l.adjustment === "exposure") return { type: "exposure", exposure: p.exposure, offset: 0, gamma: 1 };
  if (l.adjustment === "vibrance") return { type: "vibrance", vibrance: p.vibrance, saturation: p.saturation };
  if (l.adjustment === "invert" && p.amount === 100) return { type: "invert" };
  if(l.adjustment==="levels"){const bank={...p.channels,[p.channel||'rgb']:levelSettings(p)};return {type:'levels',...Object.fromEntries(Object.entries(bank).map(([k,v])=>{const q=levelSettings(v);// ag-psd 30.1 writes its green/blue Levels records in reversed order.
const writerKey=k==='green'?'blue':k==='blue'?'green':k;return [writerKey,{shadowInput:q.black,highlightInput:q.white,midtoneInput:q.gamma,shadowOutput:q.outputBlack,highlightOutput:q.outputWhite}];}))};}
  if (l.adjustment === "curves") {
    const channels = { ...p.channels, [p.channel]: p.points };
    return { type: "curves", ...Object.fromEntries(Object.entries(channels).map(([k, ps]) => [k, ps.map(([input, output]) => ({ input, output }))])) };
  }
  if (l.adjustment === "hue" && !p.colorize) return { type: "hue/saturation", master: { a: 0, b: 0, c: 0, d: 0, hue: p.hue, saturation: p.saturation, lightness: p.lightness } };
  return null;
}
function hex(c) {
  if (!c) return "#ffffff";
  const channels = "r" in c ? [c.r, c.g, c.b] : "fr" in c ? [c.fr * 255, c.fg * 255, c.fb * 255] : null;
  return channels ? "#" + channels.map((n) => Math.round(clamp(n)).toString(16).padStart(2, "0")).join("") : null;
}
function rgb(c) {
  const n = parseInt(c.slice(1), 16);
  return { r: n >> 16, g: n >> 8 & 255, b: n & 255 };
}
const hasEffects = l=>hasLayerEffects(l)||l.patternFill||(l.fillOpacity??1)!==1;
function importMask(p, d, assets) {
  if (!p.mask?.canvas) return null;
  const original = p.mask.canvas, c = canvas(d.width, d.height), ctx = c.getContext("2d"), local = canvas(original.width, original.height), x = local.getContext("2d"), pixels = original.getContext("2d").getImageData(0, 0, original.width, original.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i + 3] = pixels.data[i];
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
  }
  x.putImageData(pixels, 0, 0);
  if (p.mask.defaultColor) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  const mx = p.mask.left || 0, my = p.mask.top || 0;
  ctx.clearRect(mx, my, local.width, local.height);
  ctx.drawImage(local, mx, my);
  const source = c.toDataURL();
  assets.set(source, c);
  return { type: "paint", source, x: 0, y: 0, width: d.width, height: d.height, feather: p.mask.userMaskFeather || 0, invert: false,disabled:!!p.mask.disabled,density:(p.mask.userMaskDensity??1)*100 };
}
function liveText(p,warnings){return readTypography(p,warnings);}
function nativeProtection(l){const all=!!l.locked;return {transparencyProtected:all||!!l.locks?.transparency,protected:{transparency:all||!!l.locks?.transparency,composite:all||!!l.locks?.pixels,position:all||!!l.locks?.position,artboards:all}};}
function importedProtection(p){const all=!!(p.protected?.transparency&&p.protected?.composite&&p.protected?.position&&p.protected?.artboards);return {locked:all,locks:{transparency:!all&&!!(p.transparencyProtected||p.protected?.transparency),pixels:!all&&!!p.protected?.composite,position:!all&&!!p.protected?.position}};}
function placedGeometry(p) {
  const placed = p.placedLayer, t = placed?.transform;
  if (!t || t.length !== 8 || t.some((v) => !Number.isFinite(v))) return null;
  const warp = placed.warp, mesh = warp?.customEnvelopeWarp?.meshPoints;
  const identityMesh = warp?.style === "custom" && warp.uOrder === 4 && warp.vOrder === 4 && mesh?.length === 16 && mesh.every((p2, i) => Math.abs(p2.x - i % 4 * (placed.width || 0) / 3) < 0.01 && Math.abs(p2.y - Math.floor(i / 4) * (placed.height || 0) / 3) < 0.01);
  if (!supportedSmartStack(p) || warp && warp.style !== "none" && !identityMesh || placed.nonAffineTransform?.some((v, i) => Math.abs(v - t[i]) > 0.01)) return null;
  const vx = t[2] - t[0], vy = t[3] - t[1], ux = t[6] - t[0], uy = t[7] - t[1], w = Math.hypot(vx, vy), h = Math.hypot(ux, uy);
  if (w < 1 || h < 1 || Math.abs(vx * ux + vy * uy) > w * h * 1e-3 || Math.abs(t[4] - (t[2] + t[6] - t[0])) > 0.1 || Math.abs(t[5] - (t[3] + t[7] - t[1])) > 0.1) return null;
  return { x: (t[0] + t[4]) / 2 - w / 2, y: (t[1] + t[5]) / 2 - h / 2, width: w, height: h, rotation: Math.atan2(vy, vx) * 180 / Math.PI, flipY: vx * uy - vy * ux < 0 };
}
async function importPsd(buffer, name, assets, { mergedOnly = false, depth = 0 } = {}) {
  if (depth > 3) throw new Error("Nested PSD Smart Objects exceed three levels.");
  const view = new DataView(buffer);
  if (buffer.byteLength < 26 || view.getUint32(0) !== 943870035 || ![1, 2].includes(view.getUint16(4))) throw new Error("This is not a supported PSD or PSB document.");
  if (view.getUint16(22) !== 8 || view.getUint16(24) !== 3) throw new Error("PSD import supports RGB, 8-bit documents. Convert the file to RGB/8 first.");
  assertDimensions(view.getUint32(18), view.getUint32(14));
  const extras=readDocumentExtras(buffer);
  const psd = readPsd(extras.buffer, { skipThumbnail: true }), d = createDocument(psd.width, psd.height, name.replace(/\.ps[db]$/i, "")), warnings = /* @__PURE__ */ new Set(), stats = { pixels: 0, text: 0, adjustments: 0, groups: 0, masks: 0 };
  if(extras.channels.length){d.alphaChannels=extras.channels.map(c=>{const out=canvas(d.width,d.height),x=out.getContext('2d'),p=x.createImageData(d.width,d.height);for(let i=0;i<c.values.length;i++){p.data[i*4]=p.data[i*4+1]=p.data[i*4+2]=255;p.data[i*4+3]=c.values[i];}x.putImageData(p,0,0);const source=out.toDataURL();assets.set(source,out);return{id:uid(),name:c.name.slice(0,200),mask:{type:'paint',source,x:0,y:0,width:d.width,height:d.height,feather:0}};});warnings.add('Named alpha channels preserve independent 8-bit pixels.');}
  if(extras.paths.length){d.paths=extras.paths.slice(0,64).map(p=>({...p,id:uid()}));warnings.add('Work Path and saved paths imported independently. Legacy path labels may differ for non-ASCII names.');}
  let strictSmartFilters=true;const hasFilters=nodes=>(nodes||[]).some(p=>p.placedLayer?.filter||hasFilters(p.children));if(hasFilters(psd.children)){try{readPsd(extras.buffer,{skipThumbnail:true,skipLayerImageData:true,skipCompositeImageData:true,skipLinkedFilesData:true,throwForMissingFeatures:true});}catch{strictSmartFilters=false;}}
  const placedAssets = /* @__PURE__ */ new Map();
  async function loadPlaced(nodes) {
    for (const p of nodes || []) {
      if (p.children) await loadPlaced(p.children);
      if (!p.placedLayer || !placedGeometry(p)) continue;
      const linked = psd.linkedFiles?.find((f) => f.id === p.placedLayer.id);
      if (!linked?.data || !Number.isSafeInteger(linked.data.length)) continue;
      if (placedAssets.has(linked.id)) continue;
      try {
        const bytes = linked.data;
        let nested;
        if (bytes[0] === 56 && bytes[1] === 66 && bytes[2] === 80 && bytes[3] === 83) {
          const view2 = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          nested = (await importPsd(view2, linked.name || p.name, assets, { depth: depth + 1 })).doc;
        } else if (bytes[0] === 137 && bytes[1] === 80 || bytes[0] === 255 && bytes[1] === 216) {
          let base = "";
          for (let i = 0; i < bytes.length; i += 16384) base += String.fromCharCode(...bytes.subarray(i, i + 16384));
          const source2 = "data:image/" + (bytes[0] === 137 ? "png" : "jpeg") + ";base64," + btoa(base), image = await assets.load(source2);
          assertDimensions(image.width, image.height);
          nested = createDocument(image.width, image.height, linked.name || p.name || "Embedded");
          const l = createLayer("image", { source: source2, width: image.width, height: image.height });
          nested.layers = [l];
          nested.activeId = l.id;
        }
        if (!nested) continue;
        const preview = renderDocument(nested, assets), source = preview.toDataURL();
        assets.set(source, preview);
        placedAssets.set(linked.id, { id: uid(), name: (linked.name || p.name || "Smart Object").slice(0, 200), source, width: nested.width, height: nested.height, document: nested });
      } catch {
      }
    }
  }
  if (!mergedOnly) await loadPlaced(psd.children);
  const nodeFilters=p=>{if(!p.placedLayer)return[];const a=placedAssets.get(p.placedLayer.id);if(!a)return null;try{return importSmartFilters(p,a,placedGeometry(p),strictSmartFilters);}catch{return null;}};
  const unsupported = (p) => p.children ? effectOn(p) || p.vectorMask || !BLENDS.includes(fromBlend(p.blendMode)) || p.children.some(unsupported) : p.vectorMask || p.placedLayer && (!placedAssets.has(p.placedLayer.id)||nodeFilters(p)===null) || effectOn(p) || !BLENDS.includes(fromBlend(p.blendMode)) || p.adjustment && !fromAdjustment(p.adjustment);
  const complex = (psd.children || []).some(unsupported);
  const raster = (c, label, values = {}) => {
    const source = c.toDataURL("image/png");
    assets.set(source, c);
    return createLayer("image", { name: label, source, width: c.width, height: c.height, ...values });
  };
  if (complex || mergedOnly) {
    if (!psd.canvas) throw new Error("This complex PSD has no merged preview. Simplify it or export an image first.");
    d.layers = [raster(psd.canvas, "PSD merged preview")];
    stats.pixels = 1;
    warnings.add(complex ? "Complex PSD opened as its merged image to preserve appearance. Photoshop effects, smart objects, vector masks or unsupported Photoshop features require the saved composite." : "Opened the Photoshop merged preview. Layers are flattened.");
  } else {
    let visit = function(nodes, parentId = null) {
      for (const p of nodes || []) {
        const name2 = p.name || "PSD layer", visible = !p.hidden;
        if (p.children) {
          const g = createLayer("group", { name: name2, ...importedProtection(p), parentId, visible, clipToBelow: !!p.clipping, opacity: p.opacity ?? 1, fillOpacity:p.fillOpacity??1, blend: fromBlend(p.blendMode), width: d.width, height: d.height, collapsed: false });
          g.mask = importMask(p, d, assets);
          d.layers.push(g);
          stats.groups++;
          visit(p.children, g.id);
          continue;
        }
        const base = { name: name2, parentId, clipToBelow: !!p.clipping, x: p.left || 0, y: p.top || 0, opacity: p.opacity ?? 1, fillOpacity:p.fillOpacity??1, blend: fromBlend(p.blendMode), visible, ...importedProtection(p) };
        let l;
        if (p.placedLayer && placedAssets.has(p.placedLayer.id)) {
          const asset = placedAssets.get(p.placedLayer.id);
          d.smartObjects ||= [];
          if (!d.smartObjects.some((a) => a.id === asset.id)) d.smartObjects.push(asset);
          l = createLayer("image", { ...base, ...placedGeometry(p), source: asset.source, smartObjectId: asset.id, filters:nodeFilters(p)||[] });
          stats.pixels++;
          warnings.add("Supported embedded raster/PSD Smart Objects remain editable. Perspective warps, smart filters, missing linked files and unsupported embedded formats use the saved merged preview.");
        } else if (p.adjustment) {
          l = createLayer("adjustment", { ...base, ...fromAdjustment(p.adjustment), width: d.width, height: d.height, x: 0, y: 0 });
          stats.adjustments++;
        } else if (p.text) {
          const live = liveText(p, warnings);
          if (live) {
            l = createLayer("text", { ...base, ...live });
            stats.text++;
            warnings.add("Simple text remains editable. Font metrics and line wrapping may differ from Photoshop.");
          } else if (p.canvas) {
            l = raster(p.canvas, name2, base);
            stats.pixels++;
            warnings.add("Mixed-format, rotated or complex text imported as pixels.");
          }
        } else if (p.canvas) {
          l = raster(p.canvas, name2, base);
          stats.pixels++;
        }
        if (!l) continue;
        l.mask = importMask(p, d, assets);
        if (l.mask) stats.masks++;
        d.layers.push(l);
        if (d.layers.length > 150) throw new Error("This PSD has more than 150 layers.");
      }
    };
    visit(psd.children);
    if (stats.groups) warnings.add("Layer groups, group opacity and pixel masks remain editable. Pass-through groups with opacity or masks use isolated compositing.");
    refreshGroups(d);
    if (stats.adjustments) warnings.add("Supported adjustment settings remain editable. Color rendering is approximate.");
    if (!d.layers.length && psd.canvas) {
      d.layers = [raster(psd.canvas, "PSD image")];
      stats.pixels++;
    }
  }
  if (!d.layers.length) throw new Error("This PSD contains no supported image layers.");
  if (d.layers.length > 150) throw new Error("This document exceeds 150 layers.");
  d.activeId = d.layers.at(-1).id;
  return { doc: d, warnings: [...warnings], stats, mode: complex || mergedOnly ? "merged" : "editable" };
}
function nativeText(l){return writeTypography(l,hasEffects);}
function exportPsd(doc, assets, { editable = false, psb = false, depth = 0, dpi = 300 } = {}) {
  if(!Number.isInteger(dpi)||dpi<1||dpi>2400)throw Error('DPI phải từ 1 đến 2400.');
  if(!psb&&(doc.width>30000||doc.height>30000))throw Error('Kích thước này cần xuất PSB thay vì PSD.');
  const adjustmentLayers = doc.layers.filter((l) => l.type === "adjustment" && l.visible), nativeAdjustments = editable && adjustmentLayers.every((l) => toAdjustment(l) && !l.mask), bake = adjustmentLayers.length && !nativeAdjustments, children2 = [], linkedFiles = [];
  function visit(nodes) {
    const output = [];
    for (const l of nodes) {
      if (l.type === "group" && (l.filters?.some((f) => f.visible !== false) || hasEffects(l))) {
        output.push({ name: l.name + " · effects rendered", canvas: renderLayer(doc, l, assets), left: 0, top: 0, opacity: l.opacity, blendMode: toBlend(l.blend === "pass-through" ? "normal" : l.blend), clipping: !!l.clipToBelow, hidden: !!bake || !l.visible });
        continue;
      }
      if (l.type === "group") {
        const group = { name: l.name, ...nativeProtection(l), children: visit(doc.layers.filter((x) => x.parentId === l.id)), opacity: l.opacity, blendMode: toBlend(l.blend), clipping: !!l.clipToBelow, hidden: !!bake || !l.visible };
        if (l.mask && !bake) group.mask = nativeMask(l);
        output.push(group);
        continue;
      }
      if (l.type === "adjustment") {
        if (nativeAdjustments && toAdjustment(l)) output.push({ name: l.name, ...nativeProtection(l), adjustment: toAdjustment(l), opacity: l.opacity*(l.fillOpacity??1), blendMode: toBlend(l.blend), hidden: !l.visible, clipping: !!l.clipToBelow });
        continue;
      }
      const child = { name: l.name, left: 0, top: 0, right: doc.width, bottom: doc.height, canvas: renderLayer(doc, l, assets), opacity: l.opacity, blendMode: toBlend(l.blend), hidden: !!bake || !l.visible, ...nativeProtection(l), clipping: !!l.clipToBelow };
      if (editable && !bake) {
        const text = nativeText(l);
        if (text) child.text = text;
        const asset = doc.smartObjects?.find((a) => a.id === l.smartObjectId);
        if (asset && !hasEffects(l) && (!l.filters?.length||exportSmartFilters(l,asset)) && depth < 3) {
          if (!linkedFiles.some((f) => f.id === asset.id)) {
            let data, type, name;
            try {
              if (!asset.document) throw new Error("raster");
              data = new Uint8Array(exportPsd(asset.document, assets, { editable: true, depth: depth + 1 }));
              type = "8BPS";
              name = asset.name.replace(/\.[^.]+$/, "") + ".psd";
            } catch {
              const image = assets.get(asset.source), c2 = canvas(asset.width, asset.height);
              c2.getContext("2d").drawImage(image, 0, 0, c2.width, c2.height);
              data = Uint8Array.from(atob(c2.toDataURL().split(",")[1]), (c3) => c3.charCodeAt(0));
              type = "png ";
              name = asset.name + ".png";
            }
            linkedFiles.push({ id: asset.id, name, type, data });
          }
          const a = (l.rotation || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), cx = l.x + l.width / 2, cy = l.y + l.height / 2;
          const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].flatMap(([x, y]) => {
            x *= l.width * (l.flipX ? -1 : 1);
            y *= l.height * (l.flipY ? -1 : 1);
            return [cx + x * c - y * s, cy + x * s + y * c];
          });
          child.placedLayer = { ...(l.filters?.length?{filter:exportSmartFilters(l,asset)}:{}),id: asset.id, type: "raster", transform: corners, width: asset.width, height: asset.height, resolution: { value: 72, units: "Density" } };
        }
      }
      if (editable && !bake && l.mask) {
        child.canvas = renderLayer(doc, l, assets, 1, { mask: false });
        child.mask = nativeMask(l);
      }
      output.push(child);
    }
    return output;
  }
  function nativeMask(l) {
    const m = maskCanvas(doc, l.mask, 1, assets), x = m.getContext("2d"), pixels = x.getImageData(0, 0, m.width, m.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = pixels.data[i + 3];
      pixels.data[i + 3] = 255;
    }
    x.putImageData(pixels, 0, 0);
    return { canvas: m, top: 0, left: 0, defaultColor: 0,disabled:!!l.mask?.disabled };
  }
  children2.push(...visit(doc.layers.filter((l) => !l.parentId)));
  const merged = renderDocument(doc, assets);
  if (bake) children2.push({ name: "Finished composite — adjustments baked", left: 0, top: 0, right: doc.width, bottom: doc.height, canvas: merged, opacity: 1, blendMode: "normal" });
  const result=writePsd({ width: doc.width, height: doc.height, canvas: merged, children: children2, linkedFiles, imageResources:{resolutionInfo:{horizontalResolution:dpi,horizontalResolutionUnit:'PPI',widthUnit:'Inches',verticalResolution:dpi,verticalResolutionUnit:'PPI',heightUnit:'Inches'}} }, { generateThumbnail: false, psb });
  return writeDocumentExtras(result,{paths:doc.paths||[],channels:(doc.alphaChannels||[]).map(c=>{const m=maskCanvas(doc,c.mask,1,assets),p=m.getContext('2d').getImageData(0,0,m.width,m.height).data,values=new Uint8Array(doc.width*doc.height);for(let i=0;i<values.length;i++)values[i]=p[i*4+3];return{name:c.name,values};})});
}
export {
  exportPsd,
  importPsd
};
