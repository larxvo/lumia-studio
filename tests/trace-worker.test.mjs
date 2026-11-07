import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
function worker(){const target=new URL('../dist/trace-worker.js',import.meta.url).href,source=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(target)});parentPort.on('message',data=>self.onmessage({data}));`;return new Worker(new URL('data:text/javascript,'+encodeURIComponent(source)),{type:'module'});}
test('tracing worker returns geometry and request IDs from transferred pixels',{timeout:10000},async()=>{
 const w=worker();try{const data=new Uint8ClampedArray(16*16*4);for(let y=2;y<14;y++)for(let x=2;x<14;x++)data.set([255,186,19,255],(y*16+x)*4);
 const reply=new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);});w.postMessage({id:7,input:{data,width:16,height:16}},[data.buffer]);assert.equal(data.byteLength,0);const message=await reply;assert.equal(message.id,7);assert.equal(message.result.paths.length,1);assert.ok(message.result.paths[0].commands.length>=5);
 }finally{await w.terminate();}
});
test('invalid worker input returns an error rather than geometry',{timeout:10000},async()=>{
 const w=worker();try{const reply=new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);});w.postMessage({id:8,input:{width:0,height:0,data:[]}});const message=await reply;assert.equal(message.id,8);assert.equal(typeof message.error,'string');assert.equal(message.result,undefined);}finally{await w.terminate();}
});
