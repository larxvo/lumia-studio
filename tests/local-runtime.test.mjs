import test from 'node:test';import assert from 'node:assert/strict';
test('public site never initializes a local GPU session or probes loopback',async()=>{
 const previous={location:globalThis.location,history:globalThis.history};globalThis.location={protocol:'https:',hostname:'luma.example',hash:'#luma-local-token='+'a'.repeat(43)};let changed=false;globalThis.history={replaceState(){changed=true;}};
 try{const mod=await import('../dist/local-runtime.js?public');assert.equal(mod.localRuntime(),null);await assert.rejects(()=>mod.localRequest('/api/local-info'),/Start-Luma/);assert.equal(changed,false);}finally{Object.assign(globalThis,previous);}
});
test('loopback session strips token from URL and sends it only to allowlisted local operations',async()=>{
 const old={location:globalThis.location,history:globalThis.history,fetch:globalThis.fetch};let nextURL='',calls=[];globalThis.location={protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:8788',pathname:'/',search:'',hash:'#luma-local-token='+'a'.repeat(43)};globalThis.history={replaceState(_,__,url){nextURL=url;}};globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({schema:'luma-local-v1'}),{status:200});};
 try{const mod=await import('../dist/local-runtime.js?local');assert.equal(mod.localRuntime().token,'a'.repeat(43));assert.equal(nextURL,'/');await mod.localRequest('/api/cuda-proof',{method:'POST',body:{}});assert.equal(calls[0].url,'http://127.0.0.1:8788/api/cuda-proof');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.headers.Authorization,'Bearer '+'a'.repeat(43));await assert.rejects(()=>mod.localRequest('https://evil.invalid/'),/Unknown/);assert.equal(calls.length,1);}finally{Object.assign(globalThis,old);}
});
