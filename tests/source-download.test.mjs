import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assembleSource} from '../dist/source-download.js';
import {zipSync,unzipSync} from '../dist/vendor/zip.js';
const chunks=[new Uint8Array([80,75,3,4,0,1]),new Uint8Array([2,3,4,5])],hash=b=>createHash('sha256').update(b).digest('hex');
const manifest={filename:'luma-studio-4.0.0-source.zip',bytes:10,parts:chunks.map((b,i)=>({file:'luma-source.part'+(i+1),bytes:b.length,sha256:hash(b)}))};
const fetcher=async path=>({ok:true,arrayBuffer:async()=>chunks[Number(path.match(/part(\d+)/)[1])-1].slice().buffer});
test('source archive chunks reassemble byte-for-byte into a single downloadable ZIP',async()=>{const result=await assembleSource(manifest,fetcher);assert.equal(result.filename,manifest.filename);assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer())],[...chunks[0],...chunks[1]]);});
test('source download rejects missing/truncated parts rather than saving a broken archive',async()=>{await assert.rejects(assembleSource(manifest,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)})),/Incomplete/);});
test('source download checks content integrity and rejects unexpected fetch paths',async()=>{const wrong=structuredClone(manifest);wrong.parts[0].sha256='0'.repeat(64);await assert.rejects(assembleSource(wrong,fetcher),/integrity/);const unsafe=structuredClone(manifest);unsafe.parts[0].file='https://example.com/file';await assert.rejects(assembleSource(unsafe,fetcher),/Invalid/);});
test('shared source packages reconstruct a standalone ZIP with code and exact model bytes',async()=>{
 const code=zipSync({'luma-studio/package.json':new TextEncoder().encode('{"version":"6.2.0"}')}),model=new Uint8Array([7,8,9,10]),m={layout:'shared-assets-v1',filename:'luma-studio-source.zip',bytes:code.length,parts:[{file:'luma-source.part1',bytes:code.length,sha256:hash(code)}],assets:[{asset:'ai/test.part1',path:'luma-studio/dist/ai/test.part1',bytes:model.length,sha256:hash(model)}]};
 const get=async url=>({ok:true,arrayBuffer:async()=>Uint8Array.from(url.startsWith('assets/')?code:model).buffer});const result=await assembleSource(m,get),files=unzipSync(new Uint8Array(await result.blob.arrayBuffer()));assert.equal(new TextDecoder().decode(files['luma-studio/package.json']),'{"version":"6.2.0"}');assert.deepEqual(files['luma-studio/dist/ai/test.part1'],model);
});
test('shared source reconstruction rejects traversal, duplicate namespaces and altered model bytes',async()=>{
 const {assembleSharedSource}=await import('../dist/source-package.js'),code=zipSync({'luma-studio/README.md':new Uint8Array([1])}),model=new Uint8Array([7,8]),entry={asset:'ai/test.part1',path:'luma-studio/dist/ai/test.part1',bytes:2,sha256:hash(model)},get=async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([1,2]).buffer});
 await assert.rejects(assembleSharedSource({layout:'shared-assets-v1',assets:[entry]},code,get),/integrity/);
 await assert.rejects(assembleSharedSource({layout:'shared-assets-v1',assets:[{...entry,asset:'ai/../../escape',path:'luma-studio/dist/ai/../../escape'}]},code,get),/Invalid/);
 await assert.rejects(assembleSharedSource({layout:'shared-assets-v1',assets:[]},zipSync({'../escape':model}),get),/Invalid/);
 const matching=async()=>({ok:true,arrayBuffer:async()=>model.slice().buffer});await assert.rejects(assembleSharedSource({layout:'shared-assets-v1',assets:[entry,entry]},code,matching),/Invalid/);
});
