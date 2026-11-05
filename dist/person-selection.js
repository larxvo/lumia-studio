// Anonymous face boxes are prompts only; no identity recognition or storage.
import { selectRemovalTarget } from './removal-selection.js';
import { regionMask } from './cutout-math.js';
export function personPrompts(point, faces = [], detection = null) {
  const score = b => { const cx = b.x + b.width / 2, cy = b.y + b.height / 2, dx = (point.x - cx) / Math.max(.04, b.width), dy = (point.y - cy) / Math.max(.04, b.height); return dx * dx * 3 + (dy < -1 ? dy * dy * 4 : dy * dy * .12); }, ranked = [...faces].sort((a, b) => score(a) - score(b)), main = ranked[0];
  if (!main || score(main) > 30) return [{ ...point, label: 1 }];
  const cx = main.x + main.width / 2, cy = main.y + main.height / 2, seeds = [{ ...point, label: 1 }, { x: cx, y: cy, label: 1 }];
  // Add a torso point only when semantics also sees person at that position.
  const torso = { x: cx, y: Math.min(.995, main.y + main.height * 2.5), label: 1 };
  if (detection) { const x = Math.min(detection.width - 1, Math.floor(torso.x * detection.width)), y = Math.min(detection.height - 1, Math.floor(torso.y * detection.height)), id = detection.map[y * detection.width + x]; if (detection.regions.some(r => r.id === id && r.classId === 15)) seeds.push(torso); }
  for (const b of ranked.slice(1, 10)) seeds.push({ x: b.x + b.width / 2, y: b.y + b.height / 2, label: 0 }); return seeds.slice(0, 24);
}
export async function selectKeeper(source, preview, client, options) {
  const { point, progress = () => {}, alive = () => true } = options; let faces = [], detection = null;
  try { faces = (await client.run(preview, { mode: 'faces', imageKey: options.imageKey }, progress)).faces || []; if (!alive()) throw new DOMException('Cancelled', 'AbortError'); detection = await client.run(preview, { mode: 'detect', imageKey: options.imageKey }, progress); } catch (e) { if (!alive() || e.name === 'AbortError') throw e; }
  const points = personPrompts(point, faces, detection), selected = await selectRemovalTarget(source, preview, client, { ...options, points, detection: null, nearby: false }); return selected.map(r => ({ ...r, points, person: true, label: 'Người giữ' }));
}
export function semanticPersonRegion(detection, proposal) { const values = regionMask(detection, proposal.id, detection.width, detection.height); return { width: detection.width, height: detection.height, values, rect: { x: 0, y: 0, width: 1, height: 1 }, masks: [], points: [{ ...proposal.point, label: 1 }], label: 'Người', person: true, semantic: true }; }
