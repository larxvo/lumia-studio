import { limit, polygon, regionBounds, insidePolygon } from './face-geometry.js';
import { fillPolygon, sampleMask, paintMask } from './portrait-masks.js';
import { guidedColor, featherMask } from './restoration-math.js';
import { boxBlur } from './filters.js';

const luminance = (a, k) => .2126 * a[k] + .7152 * a[k + 1] + .0722 * a[k + 2];
const color = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const smoothstep = (a, b, v) => { const t = limit((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Iris geometry is clipped by the eyelids. The 10 iris landmarks are part of
// the bundled 478-point FaceMesh; no larger model or network call is needed.
export function irisRegions(face, w, h, side = 'both') {
  if (!face?.points?.length) return [];
  const result = [];
  for (const [name, center, ring, label] of [['leftEye', 468, [469, 470, 471, 472], 'left'], ['rightEye', 473, [474, 475, 476, 477], 'right']]) {
    if (side !== 'both' && side !== label) continue;
    const eyelid = polygon(face, name, w, h), b = regionBounds(eyelid), q = face.points[center];
    const points = ring.map(i => face.points[i]);
    let cx = q?.x * w, cy = q?.y * h;
    let r = points.reduce((n, p) => n + Math.hypot(p.x * w - cx, p.y * h - cy), 0) / 4;
    if (!Number.isFinite(r) || r < b.width * .06 || r > b.width * .52 || !insidePolygon(cx, cy, eyelid)) {
      cx = b.cx; cy = b.cy; r = b.width * .235;
    }
    if (b.width < 2 || b.height < 1) continue;
    result.push({ cx, cy, radius: Math.max(1, r), eyelid, label });
  }
  return result;
}

function eachIris(regions, w, h, visit) {
  for (const r of regions) {
    const radius = r.radius;
    for (let y = Math.max(0, Math.floor(r.cy - radius)); y < Math.min(h, Math.ceil(r.cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(r.cx - radius)); x < Math.min(w, Math.ceil(r.cx + radius)); x++) {
        const distance = Math.hypot(x + .5 - r.cx, y + .5 - r.cy) / radius;
        if (distance >= 1 || r.eyelid && !insidePolygon(x + .5, y + .5, r.eyelid)) continue;
        visit(y * w + x, distance, r);
      }
    }
  }
}

export function eyeRegions(analysis, p, w, h, manual = []) {
  const faces = analysis?.faces || [], face = faces[p.faceIndex] || faces[0];
  const regions = (p.redEyeAll ? faces : face ? [face] : []).flatMap(f => irisRegions(f, w, h));
  regions.push(...manual.map(q => ({ cx: q.x * w, cy: q.y * h, radius: q.radius * Math.min(w, h) })));
  return { red: regions, tint: face ? irisRegions(face, w, h, p.irisSide) : [] };
}

export function fixRedEye(source, w, h, regions, amount = 1, sensitivity = 50) {
  const out = new Uint8ClampedArray(source), mask = new Float32Array(w * h);
  if (!amount) return { data: out, mask, count: 0 };
  let count = 0;
  const threshold = 60 - limit(sensitivity, 0, 100) * .25;
  eachIris(regions, w, h, (i, distance) => {
    const k = i * 4, R = source[k], G = source[k + 1], B = source[k + 2];
    // Gate on strong red excess as well as absolute red. White catchlights and
    // ordinary dark brown irises are deliberately left alone.
    if (!source[k + 3] || R < 120 || R - G < threshold || R - B < threshold * .65 || R < G * 1.5 || R < B * 1.3 || R < (G + B) * (1.6 - limit(sensitivity, 0, 100) * .003)) return;
    const a = smoothstep(threshold, threshold + 28, R - G) * (1 - smoothstep(.72, 1, distance)) * limit(amount, 0, 1);
    if (a <= .01 || a <= mask[i]) return;
    const neutral = Math.min(95, (G + B) * .46), target = [neutral * .91, neutral * .97, neutral];
    for (let c = 0; c < 3; c++) out[k + c] = source[k + c] + (target[c] - source[k + c]) * a;
    if (!mask[i]) count++;
    mask[i] = a;
  });
  return { data: out, mask, count };
}

export function tintIris(source, w, h, regions, hex, amount) {
  const mask = new Float32Array(w * h);
  eachIris(regions, w, h, (i, distance) => {
    const k = i * 4, L = luminance(source, k);
    mask[i] = Math.max(mask[i], smoothstep(.2, .42, distance) * (1 - smoothstep(.83, 1, distance)) * smoothstep(7, 30, L) * (1 - smoothstep(190, 235, L)) * (source[k + 3] > 0 ? 1 : 0));
  });
  return { data: amount ? guidedColor(source, w, h, mask, hex, amount) : new Uint8ClampedArray(source), mask };
}

export function hairMask(w, h, analysis, p, strokes = []) {
  const out = new Float32Array(w * h), s = analysis?.skin, faces = analysis?.faces || [], face = faces[p.faceIndex] || faces[0];
  if (s?.hair) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = smoothstep(.24, .83, sampleMask(s.hair, s.width, s.height, x, y, w, h));
    if (!p.hairAll && face) {
      const distance = f => ((x / w - f.box.x - f.box.width / 2) / f.box.width) ** 2 + ((y / h - f.box.y - f.box.height * .15) / f.box.height) ** 2;
      const d = distance(face);
      if (d > 2.6 || faces.some(f => f !== face && distance(f) < d)) a = 0;
    }
    out[y * w + x] = a;
  }
  paintMask(out, w, h, strokes, 'hair');
  const protect = new Float32Array(w * h);
  for (const f of faces) for (const name of ['leftEye', 'rightEye', 'lips', 'leftBrow', 'rightBrow']) fillPolygon(protect, w, h, polygon(f, name, w, h), 1, 1.12);
  for (let i = 0; i < out.length; i++) if (protect[i]) out[i] = 0;
  return out;
}

export function tintHair(source, w, h, mask, p) {
  if (!p.hairAmount) return new Uint8ClampedArray(source);
  const visible = Float32Array.from(mask, (a, i) => source[i * 4 + 3] ? a : 0);
  const out = guidedColor(source, w, h, visible, p.hairColor, p.hairAmount / 100);
  // Additive lift retains every strand's light/dark variation; clipping is
  // bounded and controllable rather than replacing hair with a flat swatch.
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i] * p.hairAmount / 100, k = i * 4;
    if (!a || !source[k + 3]) continue;
    for (let c = 0; c < 3; c++) out[k + c] += p.hairLight * .85 * a;
  }
  return out;
}

function beardFrame(face, w, h) {
  const a = face.points[33], b = face.points[263], angle = Math.atan2((b.y - a.y) * h, (b.x - a.x) * w), c = Math.cos(angle), s = Math.sin(angle), lips = regionBounds(polygon(face, 'lips', w, h)), size = Math.max(10, face.box.width * w);
  const local = q => ({ u: ((q.x * w - lips.cx) * c + (q.y * h - lips.cy) * s) / size, v: (-(q.x * w - lips.cx) * s + (q.y * h - lips.cy) * c) / size });
  const chin = local(face.points[152]), nose = local(face.points[2]);
  return { c, s, angle, cx: lips.cx, cy: lips.cy, size, chin: Math.max(.15, chin.v), nose: Math.min(-.04, nose.v), half: Math.max(.1, lips.width / size / 2), lipTop: -Math.max(.018, lips.height / size / 2), lipBottom: Math.max(.02, lips.height / size / 2) };
}

// Shared by the strand renderer and neural beard-removal workflow. The mask
// follows the face oval while excluding lips/nose; it can be refined by brush.
export function beardMask(w, h, face, style = 'full', strokes = []) {
  const out = new Float32Array(w * h);
  if (!face) return out;
  const f = beardFrame(face, w, h), oval = new Float32Array(w * h), protect = new Float32Array(w * h);
  fillPolygon(oval, w, h, polygon(face, 'oval', w, h));
  fillPolygon(protect, w, h, polygon(face, 'lips', w, h), 1, 1.12);
  const b = face.box, x0 = Math.max(0, Math.floor(b.x * w)), x1 = Math.min(w, Math.ceil((b.x + b.width) * w)), y0 = Math.max(0, Math.floor((b.y + b.height * .36) * h)), y1 = Math.min(h, Math.ceil((b.y + b.height * 1.08) * h));
  const band = (v, lo, hi, fade = .024) => smoothstep(lo, lo + fade, v) * (1 - smoothstep(hi - fade, hi, v));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x;
    if (!oval[i] || protect[i]) continue;
    const dx = x + .5 - f.cx, dy = y + .5 - f.cy, u = (dx * f.c + dy * f.s) / f.size, v = (-dx * f.s + dy * f.c) / f.size, U = Math.abs(u);
    const moustache = (1 - smoothstep(f.half * .92, f.half * 1.18, U)) * band(v, f.nose + .015, f.lipTop + .025, .018);
    const chin = (1 - smoothstep(f.half * .7, f.half * 1.3, U)) * band(v, f.lipBottom + .045, f.chin + .015, .035);
    const goatee = Math.max(chin, moustache, band(U, f.half * .72, f.half * 1.22, .025) * band(v, f.lipTop, f.chin * .8, .025));
    const cheekTop = .045 - Math.min(.17, U * .45), lower = band(v, cheekTop, f.chin + .02, .035);
    let value = style === 'moustache' ? moustache : style === 'chin' ? chin : style === 'goatee' ? goatee : Math.max(moustache, lower);
    if (style === 'boxed') value *= 1 - smoothstep(.36, .46, U);
    out[i] = value;
  }
  paintMask(out, w, h, strokes, 'beard');
  for (let i = 0; i < out.length; i++) out[i] *= oval[i] * (1 - protect[i]);
  return featherMask(out, w, h, Math.max(1, Math.min(5, Math.round(f.size * .004))));
}

export function reduceStubble(source, w, h, mask, amount, face) {
  const out = new Uint8ClampedArray(source);
  if (!amount || !face) return { data: out, count: 0 };
  const radius = Math.max(2, Math.round(face.box.width * w * .018)), local = boxBlur(source, w, h, radius), candidates = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] > .02 && source[i * 4 + 3]) {
    const dark = luminance(local, i * 4) - luminance(source, i * 4);
    if (dark > 7) candidates.push([i, smoothstep(7, 32, dark) * mask[i] * amount]);
  }
  // Pick the brightest plausible *local skin sample*, never a flat average.
  // Dense, broad beard regions are intentionally left to neural inpainting.
  for (const [i, a] of candidates) {
    const x = i % w, y = Math.floor(i / w), k = i * 4; let best = i, bestL = luminance(source, k);
    for (const [dx, dy] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius, radius], [-radius, -radius], [radius, -radius], [-radius, radius]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx, L = luminance(source, j * 4);
      if (mask[j] > .1 && source[j * 4] > source[j * 4 + 2] && L > bestL && L < 238) { best = j; bestL = L; }
    }
    for (let c = 0; c < 3; c++) out[k + c] += (source[best * 4 + c] - source[k + c]) * a * .9;
  }
  return { data: out, count: candidates.length };
}

export function renderBeard(source, w, h, face, mask, p) {
  const out = new Uint8ClampedArray(source);
  if (!face || p.beardStyle === 'none' || !p.beardAmount || !p.beardDensity) return out;
  const f = beardFrame(face, w, h), rgb = color(p.beardColor), b = face.box;
  let seed = (Math.round(p.beardSeed) + 1) * 2654435761 >>> 0;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  // Stable normalized roots mean preview and full-resolution render agree.
  const trials = Math.round(24000 * p.beardDensity / 100), short = p.beardStyle === 'stubble';
  for (let n = 0; n < trials; n++) {
    const rx = random(), ry = random(), accept = random(), lengthRandom = random(), opacityRandom = random(), varianceRandom = random();
    const x = (b.x + rx * b.width) * w, y = (b.y + (.36 + ry * .72) * b.height) * h, ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
    const weight = mask[iy * w + ix];
    if (accept > weight || weight < .05) continue;
    const u = ((x - f.cx) * f.c + (y - f.cy) * f.s) / f.size, v = (-(x - f.cx) * f.s + (y - f.cy) * f.c) / f.size;
    const moustache = v < f.lipTop + .025, length = f.size * (short ? .002 + p.beardLength * .00006 : .004 + p.beardLength * .00032) * (.55 + lengthRandom * .75);
    const tilt = moustache ? (u < 0 ? -.75 : .75) : -u * .65, dx = (f.c * tilt - f.s) * length, dy = (f.s * tilt + f.c) * length, steps = Math.max(2, Math.ceil(length * 1.8));
    const opacity = p.beardAmount / 100 * (.22 + opacityRandom * .28), variance = (varianceRandom - .5) * 28, width = Math.max(.45, f.size * .0015), light = limit(luminance(source, (iy * w + ix) * 4) / 150, .45, 1.4);
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, xx = x + dx * t, yy = y + dy * t;
      for (let py = Math.floor(yy - width); py <= Math.ceil(yy + width); py++) for (let px = Math.floor(xx - width); px <= Math.ceil(xx + width); px++) {
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const i = py * w + px, k = i * 4, a = limit(width + .5 - Math.hypot(px + .5 - xx, py + .5 - yy), 0, 1) * opacity * (1 - t * .65) * mask[i];
        if (!a || !source[k + 3]) continue;
        for (let c = 0; c < 3; c++) out[k + c] += (limit(rgb[c] * light + variance, 0, 255) - out[k + c]) * a;
      }
    }
  }
  return out;
}
