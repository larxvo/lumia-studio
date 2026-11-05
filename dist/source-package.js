import { unzipSync, zipSync } from './vendor/zip.js';
const safePath = name => typeof name === 'string' && name.startsWith('luma-studio/') && !name.includes('\\') && !name.includes('\0') && !name.split('/').some(p => p === '.' || p === '..');
export async function assembleSharedSource(manifest, code, fetcher = fetch, progress = () => {}) {
  if (manifest.layout !== 'shared-assets-v1' || !Array.isArray(manifest.assets) || manifest.assets.length > 64 || code.byteLength > 33554432) throw Error('Invalid shared source package.');
  let total = 0, entries = 0;
  const files = unzipSync(code, { filter: file => {
    if (!safePath(file.name) || ++entries > 4096 || file.originalSize > 16777216 || (total += file.originalSize) > 67108864) throw Error('Invalid source ZIP entry.');
    return true;
  } });
  const seen = new Set();
  for (let i = 0; i < manifest.assets.length; i++) {
    const asset = manifest.assets[i];
    if (!asset || !/^(ai|vendor)\/[a-zA-Z0-9._/-]+$/.test(asset.asset) || asset.asset.split('/').some(p => !p || p === '.' || p === '..') || asset.path !== 'luma-studio/dist/' + asset.asset || !safePath(asset.path) || seen.has(asset.path) || Object.hasOwn(files, asset.path) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 16777216 || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw Error('Invalid shared source asset.');
    total += asset.bytes;
    if (total > 268435456) throw Error('Source package exceeds its size limit.');
    seen.add(asset.path);
    progress(`Đang chuẩn bị mã nguồn · ${Math.round(i / Math.max(1, manifest.assets.length) * 90)}%`);
    const response = await fetcher(asset.asset + '?v=' + asset.sha256.slice(0, 16));
    if (!response.ok) throw Error('Source asset could not load. Please try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== asset.bytes) throw Error('Incomplete shared source asset.');
    if (globalThis.crypto?.subtle) {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
      if (hash !== asset.sha256) throw Error('Source asset integrity check failed.');
    }
    files[asset.path] = bytes;
  }
  progress('Đang đóng gói mã nguồn đầy đủ · 95%');
  return zipSync(files, { level: 6 });
}
