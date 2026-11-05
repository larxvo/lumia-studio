import { assembleSource } from './source-download.js';
self.onmessage = async ({ data: manifest }) => {
  try { self.postMessage({ result: await assembleSource(manifest, fetch, progress => self.postMessage({ progress })) }); }
  catch (error) { self.postMessage({ error: error.message || 'Source archive could not be assembled.' }); }
};
