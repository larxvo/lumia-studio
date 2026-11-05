import { fillPolygon, sampleMask, paintMask } from "./portrait-masks.js";
import { eyeRegions, fixRedEye, tintIris, hairMask, tintHair, beardMask, reduceStubble, renderBeard } from "./portrait-features.js";
import { boxBlur } from "./filters.js";
import { limit, polygon, regionBounds } from "./face-geometry.js";
import { PHOTO_DEFAULTS, PHOTO_FIELDS } from "./photo-settings.js";
import { PHOTO_DEFAULTS as PHOTO_DEFAULTS2, PHOTO_FIELDS as PHOTO_FIELDS2, PHOTO_PRESETS, presetParams } from "./photo-settings.js";
import {portraitShine,adjustBrows} from './portrait-finish.js';
const fields = PHOTO_FIELDS;
const luma = (a, i) => a[i] * 0.2126 + a[i + 1] * 0.7152 + a[i + 2] * 0.0722;
function skinMask(w, h, analysis, params = {}, strokes = [], selection = null) {
  const p = { ...PHOTO_DEFAULTS, ...params }, out = new Float32Array(w * h), skin = analysis?.skin, faces = analysis?.faces || [], face = faces[p.faceIndex] || faces[0];
  if (p.scope !== "manual" && skin) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let value = sampleMask(p.scope === "face" ? skin.face : skin.values, skin.width, skin.height, x, y, w, h);
    if (p.scope === "body") value = Math.max(0, value - sampleMask(skin.face, skin.width, skin.height, x, y, w, h));
    out[y * w + x] = limit((value - 0.2) / 0.55, 0, 1);
  }
  if (p.scope === "face" && face) {
    const region = new Float32Array(w * h);
    fillPolygon(region, w, h, polygon(face, "oval", w, h));
    for (let i = 0; i < out.length; i++) out[i] *= region[i];
  }
  paintMask(out, w, h, strokes, "skin");
  if (p.protect && faces.length) {
    const protectedMask = new Float32Array(w * h);
    for (const f of faces) for (const name of ["leftEye", "rightEye", "lips", "leftBrow", "rightBrow"]) fillPolygon(protectedMask, w, h, polygon(f, name, w, h), 1, 1.18);
    for (let i = 0; i < out.length; i++) if (protectedMask[i]) out[i] = 0;
  }
  if (selection) for (let i = 0; i < out.length; i++) out[i] *= selection[i];
  return out;
}
function cleanComponents(mask, w, h, maxArea) {
  const visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0, tail = 1, minX = w, minY = h, maxX = 0, maxY = 0;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = Math.floor(i / w);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && mask[j] && !visited[j]) {
        visited[j] = 1;
        queue[tail++] = j;
      }
    }
    if (tail > maxArea || Math.max(maxX - minX + 1, maxY - minY + 1) > Math.sqrt(maxArea) * 2.4) for (let k = 0; k < tail; k++) mask[queue[k]] = 0;
  }
  return mask;
}
function inpaintPixels(source, w, h, mask, amount = 1) {
  const data = new Uint8ClampedArray(source), known = new Uint8Array(w * h), queued = new Uint8Array(w * h), queue = new Int32Array(w * h), affected = [];
  let head = 0, tail = 0;
  const neighbors = (i) => {
    const x = i % w, y = Math.floor(i / w), out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) out.push(i + dy * w + dx);
    return out;
  };
  for (let i = 0; i < known.length; i++) known[i] = mask[i] > 0.1 ? 0 : 1;
  for (let i = 0; i < known.length; i++) if (!known[i] && neighbors(i).some((j) => known[j])) {
    queue[tail++] = i;
    queued[i] = 1;
  }
  while (head < tail) {
    const i = queue[head++], ns = neighbors(i), valid = ns.filter((j) => known[j] && source[j * 4 + 3] > 0);
    if (!valid.length) continue;
    for (let c = 0; c < 3; c++) data[i * 4 + c] = valid.reduce((sum, j) => sum + data[j * 4 + c], 0) / valid.length;
    known[i] = 1;
    affected.push(i);
    for (const j of ns) if (!known[j] && !queued[j]) {
      queued[j] = 1;
      queue[tail++] = j;
    }
  }
  for (let pass = 0; pass < 6; pass++) for (const i of affected) {
    const valid = neighbors(i).filter((j) => known[j]);
    for (let c = 0; c < 3; c++) data[i * 4 + c] = valid.reduce((sum, j) => sum + data[j * 4 + c], 0) / valid.length;
  }
  for (let i = 0; i < mask.length; i++) {
    const a = limit(mask[i] * amount, 0, 1);
    for (let c = 0; c < 3; c++) data[i * 4 + c] = source[i * 4 + c] + (data[i * 4 + c] - source[i * 4 + c]) * a;
    data[i * 4 + 3] = source[i * 4 + 3];
  }
  return { data, count: affected.length };
}
function retouchSkin(source, w, h, mask, p, analysis) {
  const face = analysis?.faces?.[p.faceIndex] || analysis?.faces?.[0], faceWidth = face ? face.box.width * w : Math.min(w, h) * 0.35, r = Math.max(2, Math.round(faceWidth * 0.018)), small = boxBlur(source, w, h, r), large = boxBlur(source, w, h, Math.max(3, r * 3)), spots = new Float32Array(w * h), strength = p.blemish / 100, threshold = 29 - p.sensitivity * 0.23;
  if (strength) for (let i = 0; i < spots.length; i++) {
    if (mask[i] < 0.4) continue;
    const k = i * 4, dark = luma(small, k) - luma(source, k), red = source[k] - small[k] - (source[k + 1] - small[k + 1]);
    if (!p.keepFreckles && dark > threshold || red > threshold * 1.1 && dark > -8) spots[i] = mask[i];
  }
  cleanComponents(spots, w, h, Math.max(9, Math.round(Math.PI * (faceWidth * 0.035) ** 2)));
  const healed = strength ? inpaintPixels(source, w, h, spots, strength) : { data: new Uint8ClampedArray(source), count: 0 }, out = healed.data, texture = p.texture / 100;
  const fine = p.studio ? boxBlur(source, w, h, Math.max(1, Math.round(faceWidth * .004))) : null;
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i];
    if (!a) continue;
    const k = i * 4, L = luma(source, k), S = luma(small, k), B = luma(large, k), edge = Math.exp(-Math.abs(L - S) / (12 + p.smooth * 0.15));
    for (let c = 0; c < 3; c++) {
      const v = out[k + c], smooth = (small[k + c] - source[k + c]) * p.smooth / 100 * edge * (1 - texture * 0.65), pigment = Math.max(0, B - L - 3) * p.pigment / 100 * 0.7, wrinkle = Math.max(0, S - L - 2) * p.wrinkles / 100 * 0.65, flake = -Math.max(0, L - S - 3) * p.flakes / 100 * 0.75;
      let value = v + smooth + pigment + wrinkle + flake;
      if (fine) {
        // Frequency separation: soften uneven mid/low-frequency tone while
        // keeping the original high-frequency pore detail. Strong edges are
        // protected instead of being averaged across eyes, lips or jaw edges.
        const mid = fine[k + c] - large[k + c], pore = source[k + c] - fine[k + c];
        const guard = Math.exp(-Math.abs(luma(fine, k) - B) / 26);
        value += (-limit(mid, -22, 22) * .72 + pore * (texture - 1) * .35) * p.studio / 100 * guard;
      }
      if (p.grain) {
        const x = i % w / w, y = Math.floor(i / w) / h, hash = Math.sin(Math.floor(x * 4096) * 127.1 + Math.floor(y * 4096) * 311.7) * 43758.5453;
        value += ((hash - Math.floor(hash)) - .5) * p.grain / 100 * 5 * Math.sqrt(Math.max(.1, L / 128));
      }
      if (c === 0) value -= Math.max(0, source[k] - source[k + 1] - 25) * p.redness / 100 * 0.45;
      if (c === 1) value += Math.max(0, source[k] - source[k + 1] - 25) * p.redness / 100 * 0.13;
      out[k + c] = v + (value - v) * a;
    }
  }
  return { data: out, spots: healed.count };
}
function bilinear(data, w, h, x, y, out, i) {
  x = limit(x, 0, w - 1);
  y = limit(y, 0, h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0, indices = [(y0 * w + x0) * 4, (y0 * w + x1) * 4, (y1 * w + x0) * 4, (y1 * w + x1) * 4], weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  let alpha = 0;
  for (let n = 0; n < 4; n++) alpha += data[indices[n] + 3] / 255 * weights[n];
  for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let n = 0; n < 4; n++) v += data[indices[n] + c] * data[indices[n] + 3] / 255 * weights[n];
    out[i + c] = alpha ? v / alpha : 0;
  }
  out[i + 3] = alpha * 255;
}
function faceOperations(face, w, h, params) {
  const p = { ...PHOTO_DEFAULTS, ...params }, left = face.points[33], right = face.points[263], angle = Math.atan2((right.y - left.y) * h, (right.x - left.x) * w), c = Math.cos(angle), s = Math.sin(angle), ops = [];
  const region = (name, padX, padY) => {
    const ps = polygon(face, name, w, h), center = regionBounds(ps), local = ps.map((q) => ({ x: (q.x - center.cx) * c + (q.y - center.cy) * s, y: -(q.x - center.cx) * s + (q.y - center.cy) * c })), b = regionBounds(local);
    return { cx: center.cx, cy: center.cy, rx: Math.max(3, b.width * padX / 2), ry: Math.max(3, b.height * padY / 2), angle };
  };
  const scale = (r, sx, sy) => {
    if (sx !== 1 || sy !== 1) ops.push({ ...r, sx, sy });
  };
  // Finite roll-aware contour handles protect central facial features.
  const oval=region('oval',1,1),sizeX=oval.rx*2,sizeY=oval.ry*2;
  const protectedRegions=['leftEye','rightEye','lips'].map(name=>region(name,1.5,1.8));
  protectedRegions.push({cx:face.points[1].x*w,cy:face.points[1].y*h,rx:sizeX*.10,ry:sizeY*.15});
  const handle=(u,v,rx,ry,dx)=>{if(dx)ops.push({cx:oval.cx+u*sizeX*c-v*sizeY*s,cy:oval.cy+u*sizeX*s+v*sizeY*c,rx:sizeX*rx,ry:sizeY*ry,angle,dx,dy:0,protectedRegions});};
  for(const side of [-1,1]){handle(side*.44,.02,.24,.30,-side*sizeX*limit(p.faceSlim,0,100)*.0006);handle(side*.35,.30,.27,.25,-side*sizeX*limit(p.jawSlim,0,100)*.00065);handle(side*.18,.43,.22,.16,-side*sizeX*limit(p.chinSlim,0,100)*.00045);}
  for (const name of ["leftEye", "rightEye"]) scale(region(name, 2.2, 3.2), 1 + p.eyeSize * 3e-3 + p.eyeWidth * 2e-3, 1 + p.eyeSize * 3e-3);
  const lips = region("lips", 1.9, 2.6);
  scale(lips, 1 + p.mouthWidth * 25e-4, 1 + p.mouthOpen * 25e-4);
  if (p.lipThickness) {
    for (const [inner, outer, side] of [[13, 0, -1], [14, 17, 1]]) {
      const a = face.points[inner], b = face.points[outer], ax = a.x * w, ay = a.y * h, band = Math.abs(-(b.x * w - ax) * s + (b.y * h - ay) * c);
      ops.push({ cx: ax, cy: ay, rx: lips.rx, ry: Math.max(4, band * 3), angle, sy: 1 + p.lipThickness * 4e-3, clipSide: side });
    }
  }
  for (const name of ["leftBrow", "rightBrow"]) scale(region(name, 1.65, 3), 1, 1 + p.browThickness * 4e-3);
  const corners = [face.points[61], face.points[291]], mouth = { x: (face.points[13].x + face.points[14].x) * w / 2, y: (face.points[13].y + face.points[14].y) * h / 2 }, size = face.box.width * w;
  if (p.smileShape || p.smileAsymmetry) ops.push({ ...lips, curve: p.smileShape * size * .00045, asymmetry: p.smileAsymmetry * size * .0004 });
  for (const q of corners) {
    const x = q.x * w, y = q.y * h, relativeY = -(x - mouth.x) * s + (y - mouth.y) * c, dy = -size * p.smile * 5e-4 - relativeY * p.neutral / 100;
    if (dy) ops.push({ cx: x, cy: y, rx: size * 0.19, ry: size * 0.18, angle, dx: 0, dy });
  }
  return ops;
}
function warpFace(source, w, h, face, params, selection = null) {
  const ops = faceOperations(face, w, h, params), out = new Uint8ClampedArray(source);
  if (!ops.length) return out;
  const ranges = ops.map((o) => ({ x: o.cx - Math.max(o.rx, o.ry), y: o.cy - Math.max(o.rx, o.ry), right: o.cx + Math.max(o.rx, o.ry), bottom: o.cy + Math.max(o.rx, o.ry) })), x0 = Math.max(0, Math.floor(Math.min(...ranges.map((o) => o.x)))), x1 = Math.min(w, Math.ceil(Math.max(...ranges.map((o) => o.right)))), y0 = Math.max(0, Math.floor(Math.min(...ranges.map((o) => o.y)))), y1 = Math.min(h, Math.ceil(Math.max(...ranges.map((o) => o.bottom))));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let sx = x, sy = y;
    for (let k = ops.length - 1; k >= 0; k--) {
      const o = ops[k], c = Math.cos(o.angle), s = Math.sin(o.angle), dx = sx - o.cx, dy = sy - o.cy, u = dx * c + dy * s, v = -dx * s + dy * c, r = (u / o.rx) ** 2 + (v / o.ry) ** 2;
      if (r >= 1 || o.clipSide && v * o.clipSide < 0) continue;
      let guard=1;
      if(o.protectedRegions)for(const q of o.protectedRegions){const px=(sx-q.cx)*c+(sy-q.cy)*s,py=-(sx-q.cx)*s+(sy-q.cy)*c,d=(px/q.rx)**2+(py/q.ry)**2;guard=Math.min(guard,limit((d-1)/.6,0,1));}
      const f = (1 - r) ** 2*guard, curve = (o.curve || 0) * (.3 - (u / (o.rx * .55)) ** 2) + (o.asymmetry || 0) * u / o.rx;
      const uu = u / (1 + ((o.sx || 1) - 1) * f) - (o.dx || 0) * f, vv = v / (1 + ((o.sy || 1) - 1) * f) - ((o.dy || 0) + curve) * f;
      sx = o.cx + uu * c - vv * s;
      sy = o.cy + uu * s + vv * c;
    }
    if(Math.abs(sx-x)+Math.abs(sy-y)<1e-7)continue;
    bilinear(source, w, h, sx, sy, out, (y * w + x) * 4);
    if (selection) {
      const a = selection[y * w + x];
      for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = source[(y * w + x) * 4 + k] + (out[(y * w + x) * 4 + k] - source[(y * w + x) * 4 + k]) * a;
    }
  }
  return out;
}
function detectScratches(source, w, h, amount) {
  const out = new Float32Array(w * h);
  if (!amount) return out;
  const r = Math.max(2, Math.round(Math.min(w, h) * 4e-3)), threshold = 75 - amount * 0.4;
  let count = 0;
  for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) {
    const i = y * w + x, k = i * 4, L = luma(source, k);
    let found = false;
    for (const delta of [r, r * w]) {
      const a = luma(source, (i - delta) * 4), b = luma(source, (i + delta) * 4);
      if (Math.abs(a - b) < 22 && Math.abs(L - (a + b) / 2) > threshold) found = true;
    }
    if (found && source[k + 3] > 0) {
      out[i] = 1;
      count++;
    }
  }
  if (count > out.length * 0.08) out.fill(0);
  return out;
}
function restorePhoto(source, w, h, p, strokes, selection) {
  let data = new Uint8ClampedArray(source), damage = detectScratches(source, w, h, p.scratches);
  paintMask(damage, w, h, strokes, "damage");
  if (selection) for (let i = 0; i < damage.length; i++) damage[i] *= selection[i];
  const fixed = inpaintPixels(data, w, h, damage, p.repair / 100);
  data = fixed.data;
  const smooth = p.denoise ? boxBlur(data, w, h, Math.max(1, Math.round(Math.min(w, h) / 700))) : null, light = p.stain ? boxBlur(data, w, h, Math.max(12, Math.round(Math.min(w, h) * 0.07))) : null, hist = Array.from({ length: 3 }, () => new Uint32Array(256));
  let total = 0, mean = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3]) {
    for (let c = 0; c < 3; c++) hist[c][data[i + c]]++;
    total++;
    mean += luma(data, i);
  }
  mean /= total || 1;
  const ranges = hist.map((values) => {
    let sum = 0, lo = 0, hi = 255;
    for (let n = 0; n < 256; n++) {
      sum += values[n];
      if (sum > total * 0.012) {
        lo = n;
        break;
      }
    }
    sum = 0;
    for (let n = 255; n >= 0; n--) {
      sum += values[n];
      if (sum > total * 0.012) {
        hi = n;
        break;
      }
    }
    return [lo, Math.max(lo + 24, hi)];
  }), grayLo = (ranges[0][0] + ranges[1][0] + ranges[2][0]) / 3, grayHi = (ranges[0][1] + ranges[1][1] + ranges[2][1]) / 3;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let value = data[i + c];
      if (smooth) {
        const edge = Math.exp(-Math.abs(value - smooth[i + c]) / 18);
        value += (smooth[i + c] - value) * p.denoise / 100 * 0.8 * edge;
      }
      if (light) value += (mean - luma(light, i)) * p.stain / 100 * 0.6;
      const stretch = (value - grayLo) * 255 / (grayHi - grayLo), channelStretch = (value - ranges[c][0]) * 255 / (ranges[c][1] - ranges[c][0]);
      value += (stretch - value) * p.levels / 100;
      value += (channelStretch - stretch) * p.decast / 100;
      data[i + c] = value;
    }
    const gray = luma(data, i);
    for (let c = 0; c < 3; c++) {
      data[i + c] += (gray - data[i + c]) * p.blackwhite / 100;
      if (c === 0) data[i + c] += p.warmth * 0.16;
      if (c === 2) data[i + c] -= p.warmth * 0.19;
    }
  }
  if (p.sharp) {
    const blur = boxBlur(data, w, h, 1);
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] += (data[i + c] - blur[i + c]) * p.sharp / 100 * 0.9;
  }
  return { data, damage, repairs: fixed.count };
}
function processPhoto({ data, width: w, height: h, params = {}, analysis = null, strokes = [], eyePoints = [], selection = null, mode = "skin" }) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || data.length !== w * h * 4) throw new Error("Kích thước hoặc dữ liệu Retouch không hợp lệ.");
  const p = { ...PHOTO_DEFAULTS, ...params }, source = new Uint8ClampedArray(data);
  let mask = skinMask(w, h, analysis, p, strokes), output = source, stats = { spots: 0, repairs: 0, skinCoverage: mask.reduce((n, v) => n + v, 0) / (w * h) };
  if (fields.skin.some((k) => !["sensitivity", "texture", "shine", "shineSensitivity"].includes(k) && p[k] > 0)) {
    const result = retouchSkin(output, w, h, mask, p, analysis);
    output = result.data;
    stats.spots = result.spots;
  }
  const face = analysis?.faces?.[p.faceIndex] || analysis?.faces?.[0];
  if(p.shine){const reduced=portraitShine(output,w,h,mask,face,p.shine,p.shineSensitivity);output=reduced.data;stats.shinePixels=reduced.count;stats.shineReduction=reduced.meanReduction;}
  if (p.redEye || p.irisAmount || mode === "eyes") {
    const regions = eyeRegions(analysis, p, w, h, eyePoints), fixed = fixRedEye(output, w, h, regions.red, p.redEye / 100, p.redEyeSensitivity);
    output = fixed.data; stats.redEyePixels = fixed.count;
    const tinted = tintIris(output, w, h, regions.tint, p.irisColor, p.irisAmount / 100);
    if (p.irisAmount) output = tinted.data;
    if (mode === "eyes") {
      mask = tinted.mask;
      for (let i = 0; i < mask.length; i++) mask[i] = Math.max(mask[i], fixed.mask[i]);
    }
  }
  if (p.hairAmount || mode === "hair") {
    const hair = hairMask(w, h, analysis, p, strokes);
    output = tintHair(output, w, h, hair, p);
    stats.hairCoverage = hair.reduce((n, a) => n + a, 0) / (w * h);
    if (mode === "hair") mask = hair;
  }
  if (face && (p.stubble || p.beardAmount || mode === "beard")) {
    const beard = beardMask(w, h, face, p.beardStyle === "none" ? "full" : p.beardStyle, strokes), reduced = reduceStubble(output, w, h, beard, p.stubble / 100, face);
    output = renderBeard(reduced.data, w, h, face, beard, p);
    stats.stubblePixels = reduced.count;
    if (mode === "beard") mask = beard;
  }
  if (face) {
    output = adjustBrows(output, w, h, face, p.browDensity);
    output = warpFace(output, w, h, face, p);
  }
  if (fields.restore.some((k) => !["repair"].includes(k) && p[k] !== 0) || strokes.some((s) => s.type === "damage" && s.add)) {
    const restored = restorePhoto(output, w, h, p, strokes, null);
    output = restored.data;
    stats.repairs = restored.repairs;
    if (mode === "restore") mask = restored.damage;
  }
  if (mode === "restore" && !stats.repairs && !p.scratches && !strokes.some((s) => s.type === "damage")) mask = new Float32Array(w * h);
  const strength = limit(p.strength / 100, 0, 1);
  for (let i = 0; i < output.length; i++) {
    const a = strength * (selection ? selection[Math.floor(i / 4)] : 1);
    output[i] = source[i] + (output[i] - source[i]) * a;
  }
  if(selection)for(let i=0;i<mask.length;i++)mask[i]*=selection[i];
  return { data: output, mask, stats };
}
export {
  PHOTO_DEFAULTS2 as PHOTO_DEFAULTS,
  PHOTO_FIELDS2 as PHOTO_FIELDS,
  PHOTO_PRESETS,
  detectScratches,
  faceOperations,
  inpaintPixels,
  paintMask,
  presetParams,
  processPhoto,
  sampleMask,
  skinMask,
  warpFace
};
