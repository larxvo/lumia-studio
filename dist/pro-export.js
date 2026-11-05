import {advancedText} from './text-engine.js';
import {hasLayerEffects} from './layer-effects.js';
import { children } from "./pro-model.js";
import { renderDocument, renderLayer, maskCanvas, textLines } from "./renderer.js";
const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
function exportSvg(doc, assets) {
  const defs = [], notes = [], hasAdjustments = doc.layers.some((l) => l.visible && l.type === "adjustment");
  const raster = (l) => {
    const c = l ? renderLayer(doc, l, assets) : renderDocument(doc, assets);
    if (l?.clipToBelow) {
      const list = children(doc, l.parentId || null), i = list.indexOf(l), base = list.slice(0, i).reverse().find((x) => !x.clipToBelow && x.type !== "adjustment"), ctx = c.getContext("2d");
      if (base?.visible) {
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(renderLayer(doc, base, assets), 0, 0);
      } else ctx.clearRect(0, 0, c.width, c.height);
    }
    return `<image width="${doc.width}" height="${doc.height}" href="${c.toDataURL("image/png")}"/>`;
  };
  if (hasAdjustments) notes.push("SVG contains an embedded composite because this document has live adjustment layers.");
  function nodes(parent = null) {
    return children(doc, parent).filter((l) => l.visible).map((l) => {
      const isolate = l.type === "group" && (l.blend !== "pass-through" || l.opacity !== 1 || l.mask);
      const style = `opacity="${l.opacity}" style="mix-blend-mode:${l.blend === "pass-through" ? "normal" : xml(l.blend)}${isolate ? ";isolation:isolate" : ""}"`;
      if (l.type==="text"&&advancedText(l) || l.filters?.some((f) => f.visible !== false) || hasLayerEffects(l) || l.patternFill || (l.fillOpacity??1)!==1 || l.clipToBelow) {
        notes.push("Layer effects, filters and clipping use embedded raster layers.");
        return `<g ${style}>${raster(l)}</g>`;
      }
      let content2;
      if (l.type === "group") content2 = nodes(l.id);
      else {
        const transform = `translate(${l.x + l.width / 2} ${l.y + l.height / 2}) rotate(${l.rotation || 0}) scale(${l.flipX ? -1 : 1} ${l.flipY ? -1 : 1}) translate(${-l.width / 2} ${-l.height / 2})`;
        let fill = xml(l.color || "#ffffff");
        if (l.gradient) {
          const id = "gradient" + defs.length, a = (l.gradientAngle ?? 45) * Math.PI / 180, cx = l.width / 2, cy = l.height / 2, len = Math.abs(l.width * Math.cos(a)) + Math.abs(l.height * Math.sin(a)), stops = `<stop stop-color="${fill}"/><stop offset="1" stop-color="${xml(l.color2 || "#235b66")}"/>`;
          defs.push(l.gradientType === "radial" ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${Math.max(l.width, l.height) / 2}">${stops}</radialGradient>` : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${cx - Math.cos(a) * len / 2}" y1="${cy - Math.sin(a) * len / 2}" x2="${cx + Math.cos(a) * len / 2}" y2="${cy + Math.sin(a) * len / 2}">${stops}</linearGradient>`);
          fill = `url(#${id})`;
        }
        if (l.type === "text") {
          const anchor = l.align === "center" ? "middle" : l.align === "right" ? "end" : "start", x = l.align === "center" ? l.width / 2 : l.align === "right" ? l.width : 0;
          content2 = `<text x="${x}" y="0" dominant-baseline="text-before-edge" fill="${fill}" font-family="${xml(l.font)}" font-size="${l.fontSize}" font-weight="${l.fontWeight || 400}" font-style="${l.italic ? "italic" : "normal"}" letter-spacing="${l.tracking || 0}" text-anchor="${anchor}" text-decoration="${l.underline ? "underline" : "none"}">${(() => {
            const c = document.createElement("canvas"), x2 = c.getContext("2d");
            x2.font = `${l.italic ? "italic " : ""}${l.fontWeight || 400} ${l.fontSize}px "${l.font}"`;
            return textLines(x2, l);
          })().map((line, i) => `<tspan x="${x}" dy="${i ? l.fontSize * (l.lineHeight || 1.2) : 0}">${xml(line)}</tspan>`).join("")}</text>`;
        } else if (["image", "paint"].includes(l.type)) {
          const img = assets.get(l.source);
          let uri = l.source;
          if (!uri.startsWith("data:")) {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            c.getContext("2d").drawImage(img, 0, 0);
            uri = c.toDataURL();
          }
          content2 = `<image width="${l.width}" height="${l.height}" href="${xml(uri)}"/>`;
        } else if (l.shape === "ellipse") content2 = `<ellipse cx="${l.width / 2}" cy="${l.height / 2}" rx="${l.width / 2}" ry="${l.height / 2}" fill="${fill}"/>`;
        else if (l.shape === "triangle") content2 = `<polygon points="${l.width / 2},0 ${l.width},${l.height} 0,${l.height}" fill="${fill}"/>`;
        else if (l.shape === "star") {
          const points = Array.from({ length: 10 }, (_, i) => {
            const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.22 : 0.5;
            return `${l.width / 2 + Math.cos(a) * l.width * r},${l.height / 2 + Math.sin(a) * l.height * r}`;
          }).join(" ");
          content2 = `<polygon points="${points}" fill="${fill}"/>`;
        } else if (l.shape === "line") content2 = `<line x1="0" y1="${l.height / 2}" x2="${l.width}" y2="${l.height / 2}" stroke="${fill}" stroke-width="${l.lineWidth || Math.max(2, l.height)}"/>`;
        else if (l.shape === "path") content2 = `<path d="${l.path.map((c) => c.join(" ")).join(" ")}" transform="scale(${l.width / (l.pathWidth || l.width)} ${l.height / (l.pathHeight || l.height)})" fill="${l.fillEnabled === false ? "none" : fill}"/>`;
        else content2 = `<rect width="${l.width}" height="${l.height}" rx="${l.radius || 0}" fill="${fill}"/>`;
        content2 = `<g transform="${transform}">${content2}</g>`;
      }
      if (l.mask && !l.mask.disabled) {
        const id = "mask" + defs.length;
        defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${doc.width}" height="${doc.height}" style="mask-type:alpha"><image width="${doc.width}" height="${doc.height}" href="${maskCanvas(doc, l.mask, 1, assets).toDataURL()}"/></mask>`);
        content2 = `<g mask="url(#${id})">${content2}</g>`;
      }
      return `<g ${style} data-name="${xml(l.name)}">${content2}</g>`;
    }).join("");
  }
  const content = hasAdjustments ? raster(null) : nodes();
  const fonts = (doc.fonts || []).map((f) => `@font-face{font-family:'${f.family}';src:url('${f.source}');}`).join("");
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><title>${xml(doc.name)}</title><defs>${defs.join("")}${fonts ? `<style>${fonts}</style>` : ""}</defs>${content}</svg>`, notes: [...new Set(notes)] };
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 4294967295;
  for (const n of data) c = crcTable[(c ^ n) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
async function zipFiles(files) {
  const parts = [], entries = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const file of files) {
    const name = enc.encode(file.name), data = file.data instanceof Blob ? new Uint8Array(await file.data.arrayBuffer()) : new Uint8Array(file.data), crc = crc32(data), header = new Uint8Array(30 + name.length), v2 = new DataView(header.buffer);
    v2.setUint32(0, 67324752, true);
    v2.setUint16(4, 20, true);
    v2.setUint16(6, 2048, true);
    v2.setUint32(14, crc, true);
    v2.setUint32(18, data.length, true);
    v2.setUint32(22, data.length, true);
    v2.setUint16(26, name.length, true);
    header.set(name, 30);
    parts.push(header, data);
    entries.push({ name, data, crc, offset });
    offset += header.length + data.length;
  }
  const centralOffset = offset;
  for (const e of entries) {
    const h = new Uint8Array(46 + e.name.length), v2 = new DataView(h.buffer);
    v2.setUint32(0, 33639248, true);
    v2.setUint16(4, 20, true);
    v2.setUint16(6, 20, true);
    v2.setUint16(8, 2048, true);
    v2.setUint32(16, e.crc, true);
    v2.setUint32(20, e.data.length, true);
    v2.setUint32(24, e.data.length, true);
    v2.setUint16(28, e.name.length, true);
    v2.setUint32(42, e.offset, true);
    h.set(e.name, 46);
    parts.push(h);
    offset += h.length;
  }
  const end = new Uint8Array(22), v = new DataView(end.buffer);
  v.setUint32(0, 101010256, true);
  v.setUint16(8, files.length, true);
  v.setUint16(10, files.length, true);
  v.setUint32(12, offset - centralOffset, true);
  v.setUint32(16, centralOffset, true);
  parts.push(end);
  return new Blob(parts, { type: "application/zip" });
}
export {
  exportSvg,
  zipFiles
};
