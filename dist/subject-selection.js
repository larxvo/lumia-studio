import { regionMask } from './cutout-math.js';
import { selectRemovalTarget } from './removal-selection.js';
import { fusePersonAlpha, regionAlpha } from './subject-math.js';
export async function selectPortrait(source, preview, client, { imageKey = '', progress = () => {}, alive = () => true, createCanvas = (w, h) => { const c = source.ownerDocument?.createElement('canvas'); if (c) { c.width = w; c.height = h; return c; } return new OffscreenCanvas(w, h); } } = {}) {
  const detection = await client.run(preview, { mode: 'detect', imageKey }, progress);
  if (!alive()) throw new DOMException('Cancelled', 'AbortError');
  const people = detection.regions?.filter(r => r.classId === 15) || [];
  if (!people.length) return client.run(preview, { mode: 'auto', imageKey }, progress);
  const matte = await client.run(preview, { mode: 'portrait', imageKey }, progress), body = new Float32Array(preview.width * preview.height);
  for (const person of people.slice(0, 8)) {
    const [region] = await selectRemovalTarget(source, preview, client, { point: person.point, detection, nearby: false, imageKey, progress, alive, createCanvas });
    if (!alive()) throw new DOMException('Cancelled', 'AbortError');
    const a = regionAlpha(region, preview.width, preview.height), semantic = regionMask(detection, person.id, preview.width, preview.height); for (let i = 0; i < a.length; i++) if (semantic[i] > .8 && matte.values[i] > .92) a[i] = Math.max(a[i], matte.values[i]); for (let i = 0; i < body.length; i++) body[i] = Math.max(body[i], a[i]);
  }
  return { values: fusePersonAlpha(matte.values, body, preview.width, preview.height), width: preview.width, height: preview.height, method: 'SAM toàn thân + crop nguồn × MODNet viền mềm' };
}
