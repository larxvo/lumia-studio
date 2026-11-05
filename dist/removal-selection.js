import { maskBounds, nearbyProbePoints, acceptNearby } from './removal-math.js';
import { sample, regionPrompts } from './cutout-math.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function overlap(a, b) { let same = 0, union = 0; for (let i = 0; i < a.length; i++) { if (a[i] > .5 || b[i] > .5) union++; if (a[i] > .5 && b[i] > .5) same++; } return same / (union || 1); }
export function clickedRegion(detection, point) {
  if (!detection) return null;
  const x = Math.min(detection.width - 1, Math.floor(point.x * detection.width)), y = Math.min(detection.height - 1, Math.floor(point.y * detection.height)), id = detection.map[y * detection.width + x];
  return detection.regions.find(r => r.id === id) || null;
}
export async function selectRemovalTarget(source, preview, client, { point, points: seeds = null, detection = null, nearby = true, imageKey = '', createCanvas = (w, h) => new OffscreenCanvas(w, h), progress = () => {}, alive = () => true } = {}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) throw Error('Bấm vào đối tượng nằm trong ảnh.');
  const guard = () => { if (!alive()) throw new DOMException('Cancelled', 'AbortError'); };
  const suggested = clickedRegion(detection, point), points = seeds || (suggested?.classId === 15 ? [...regionPrompts(detection, suggested), { ...point, label: 1 }] : [{ ...point, label: 1 }]);
  let global = await client.run(preview, { mode: 'point', points, imageKey }, progress); guard();
  const b = maskBounds(global.values, global.width, global.height, .5);
  if (!b || b.count < 3 || b.count > global.width * global.height * .65) throw Error('Vùng được chọn chưa rõ hoặc quá rộng. Thử bấm vào giữa đối tượng.');
  const selections = [{ result: global, points, label: suggested?.classId === 15 ? 'Người' : 'Đối tượng' }];
  if (nearby && (!suggested || suggested.classId === 15)) {
    progress('Đang kiểm tra vật nhỏ sát đối tượng…');
    const raw = preview.getContext('2d').getImageData(0, 0, preview.width, preview.height).data;
    for (const p of nearbyProbePoints(global.values, global.width, global.height)) {
      guard();
      const k = (Math.min(preview.height - 1, Math.floor(p.y * preview.height)) * preview.width + Math.min(preview.width - 1, Math.floor(p.x * preview.width))) * 4;
      if (raw[k + 1] > raw[k] * 1.03 && raw[k + 1] - (raw[k] + raw[k + 2]) / 2 > 8) continue;
      const result = await client.run(preview, { mode: 'point', points: [p], imageKey }, () => {}); guard();
      for (const i of result.scores.map((_, i) => i).sort((a, b) => result.scores[b] - result.scores[a])) {
        const value = result.masks[i], cb = maskBounds(value, global.width, global.height, .5), smallLowerFragment = cb && cb.count < b.count * .12 && cb.y > b.y + b.height * .6;
        if ((result.scores[i] >= .72 || result.scores[i] >= .4 && smallLowerFragment) && acceptNearby(value, global.values, raw, global.width, global.height) && !selections.some(s => overlap(s.result.values, value) > .4)) { selections.push({ result: { ...result, values: value, best: i }, points: [p], label: 'Vật nhỏ kèm theo' }); break; }
      }
      if (selections.length >= 3) break;
    }
  }
  const output = [];
  for (let n = 0; n < selections.length; n++) {
    guard(); progress(`Đang tinh chọn viền ở vùng phóng gần ${n + 1}/${selections.length}…`);
    const original = selections[n], result = original.result, bb = maskBounds(result.values, result.width, result.height, .3), padX = Math.max(bb.width * .65, 18), padY = Math.max(bb.height * .45, 18);
    const left = Math.max(0, Math.floor((bb.x - padX) / result.width * source.width)), top = Math.max(0, Math.floor((bb.y - padY) / result.height * source.height)), right = Math.min(source.width, Math.ceil((bb.right + padX) / result.width * source.width)), bottom = Math.min(source.height, Math.ceil((bb.bottom + padY) / result.height * source.height));
    const rect = { x: left / source.width, y: top / source.height, width: (right - left) / source.width, height: (bottom - top) / source.height }, scale = Math.min(1, 1024 / Math.max(right - left, bottom - top)), crop = createCanvas(Math.max(1, Math.round((right - left) * scale)), Math.max(1, Math.round((bottom - top) * scale)));
    crop.getContext('2d').drawImage(source, left, top, right - left, bottom - top, 0, 0, crop.width, crop.height);
    const localPoints = original.points.map(p => ({ x: clamp((p.x - rect.x) / rect.width), y: clamp((p.y - rect.y) / rect.height), label: p.label }));
    const refined = await client.run(crop, { mode: 'point', points: localPoints, imageKey: imageKey + ':roi:' + [left, top, right, bottom].join(',') }, progress); guard();
    let best = refined.best, bestValue = -Infinity, bestOverlap = 0;
    for (let i = 0; i < refined.masks.length; i++) {
      const mask = refined.masks[i]; let intersection = 0, union = 0;
      for (let y = 0; y < refined.height; y += 2) for (let x = 0; x < refined.width; x += 2) {
        const a = mask[y * refined.width + x] > .5, b = sample(result.values, result.width, result.height, (rect.x + (x + .5) / refined.width * rect.width) * result.width - .5, (rect.y + (y + .5) / refined.height * rect.height) * result.height - .5) > .5;
        if (a || b) union++; if (a && b) intersection++;
      }
      const iou = intersection / (union || 1), allPoints = localPoints.every(p => p.label ? mask[Math.min(refined.height - 1, Math.floor(p.y * refined.height)) * refined.width + Math.min(refined.width - 1, Math.floor(p.x * refined.width))] > .3 : mask[Math.min(refined.height - 1, Math.floor(p.y * refined.height)) * refined.width + Math.min(refined.width - 1, Math.floor(p.x * refined.width))] < .5), rank = (refined.scores[i] || 0) + iou * .6 - (allPoints ? 0 : .8);
      if (rank > bestValue) { bestValue = rank; best = i; bestOverlap = iou; }
    }
    if (bestOverlap < .25) output.push({ ...result, rect: { x: 0, y: 0, width: 1, height: 1 }, points: original.points, label: original.label, person: suggested?.classId === 15, nearby: n > 0 });
    else output.push({ ...refined, values: refined.masks[best], best, rect, points: original.points, label: original.label, person: suggested?.classId === 15, nearby: n > 0 });
  }
  return output;
}
