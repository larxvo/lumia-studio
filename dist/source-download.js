// The public host caps each asset at 25 MB; source parts are assembled only on request.
export async function assembleSource(manifest,fetcher=fetch,progress=()=>{}){
 if(!manifest||!Array.isArray(manifest.parts)||!manifest.parts.length||manifest.parts.length>16||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<1||manifest.bytes>256*1024*1024||!/^[a-z0-9._-]+\.zip$/i.test(manifest.filename))throw new Error('Invalid source archive manifest.');
 const chunks=await Promise.all(manifest.parts.map(async part=>{if(!/^luma-source\.part\d+$/.test(part.file)||!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>16*1024*1024||!/^[a-f0-9]{64}$/.test(part.sha256))throw new Error('Invalid source archive part.');const response=await fetcher('assets/'+part.file+'?v='+part.sha256.slice(0,16),{cache:'no-cache'});if(!response.ok)throw new Error('Source archive could not load. Please try again.');const bytes=await response.arrayBuffer();if(bytes.byteLength!==part.bytes)throw new Error('Incomplete source archive. Please try again.');if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==part.sha256)throw new Error('Source archive integrity check failed. Please try again.');}return bytes;}));
 let blob=new Blob(chunks,{type:'application/zip'});if(blob.size!==manifest.bytes)throw new Error('Incomplete source archive. Please try again.');
 if(manifest.layout){if(manifest.layout!=='shared-assets-v1')throw Error('Unsupported source package layout.');const {assembleSharedSource}=await import('./source-package.js');const bytes=await assembleSharedSource(manifest,new Uint8Array(await blob.arrayBuffer()),fetcher,progress);blob=new Blob([bytes],{type:'application/zip'});}
 return {blob,filename:manifest.filename};
}
let running=null;
export function loadSourceArchive(progress=()=>{}){
 return running ||= (async()=>{try{
  const response=await fetch('assets/source-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('Source archive is unavailable. Run scripts/package-source.py when self-hosting.');const manifest=await response.json();
  if(manifest.layout!=='shared-assets-v1'||typeof Worker==='undefined')return assembleSource(manifest,fetch,progress);
  const worker=new Worker(new URL('./source-worker.js',import.meta.url),{type:'module'});
  return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(Error('Preparing source took too long. Please try again.'));},300000);worker.onmessage=({data})=>{if(data.progress){progress(data.progress);return;}clearTimeout(timer);worker.terminate();if(data.error)reject(Error(data.error));else resolve(data.result);};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Could not start the source packager.'));};worker.postMessage(manifest);});
 }finally{running=null;}})();
}
