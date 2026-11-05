const KINDS = ['sam-encoder', 'sam-decoder', 'matting', 'saliency'];
export async function loadCutoutModel(kind, progress = () => {}, fetcher = fetch) {
  if (!KINDS.includes(kind)) throw Error('Unknown cutout model.');
  const base = new URL('./ai/', import.meta.url), response = await fetcher(new URL('cutout-manifest.json', base));
  if (!response.ok) throw Error('Không tải được thông tin mô hình tách nền.');
  const manifest = await response.json(), m = manifest?.version === 1 && manifest.models?.[kind];
  if (!m || !Number.isSafeInteger(m.bytes) || m.bytes < 1 || m.bytes > 32 * 1024 * 1024 || !Array.isArray(m.parts) || m.parts.length < 1 || m.parts.length > 2 || !/^[a-f0-9]{64}$/.test(m.sha256)) throw Error('Invalid cutout model manifest.');
  const result = new Uint8Array(m.bytes);
  let offset = 0;
  for (let i = 0; i < m.parts.length; i++) {
    const part = m.parts[i];
    if (part.file !== `${kind}.part${i + 1}` || !Number.isSafeInteger(part.bytes) || part.bytes < 1 || part.bytes > 16777216 || offset + part.bytes > m.bytes || !/^[a-f0-9]{64}$/.test(part.sha256)) throw Error('Invalid cutout model part.');
    progress(`Đang tải mô hình · ${Math.round(offset / m.bytes * 100)}%`);
    const r = await fetcher(new URL(part.file + '?v=' + part.sha256.slice(0, 16), base));
    if (!r.ok) throw Error('Tải mô hình bị gián đoạn. Thử lại.');
    const data = new Uint8Array(await r.arrayBuffer());
    if (data.length !== part.bytes) throw Error('Incomplete cutout model.');
    if (globalThis.crypto?.subtle) {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join('');
      if (hash !== part.sha256) throw Error('Cutout model integrity check failed.');
    }
    result.set(data, offset); offset += data.length;
  }
  if (offset !== m.bytes) throw Error('Incomplete cutout model.');
  return result;
}
