import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{CanvaClient,canvaURL}=require('../desktop/app/canva.cjs');
const ok=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function fixture(fetchImpl){const c=new CanvaClient({fetchImpl});c.configure({clientId:'fixture-client',clientSecret:'fixture-secret'});return c;}
const tokens={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600};
test('OAuth uses independent S256 PKCE and expiring one-use CSRF state, exchanges secrets only at token endpoint',async()=>{
 const calls=[],c=fixture(async(url,o)=>{calls.push({url,o});return ok(tokens);});
 const u=new URL(c.authorize()),p=c.pending;
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('code_challenge'),createHash('sha256').update(p.verifier).digest('base64url'));
 assert.ok(p.verifier.length>=43);assert.ok(!u.href.includes('fixture-secret'));assert.ok(!u.href.includes(p.verifier));
 await assert.rejects(c.exchange({code:'code',state:'wrong'}),/state/);assert.equal(calls.length,0);
 await c.exchange({code:'fixture-code',state:p.state});assert.equal(c.status().connected,true);
 assert.equal(new URLSearchParams(calls[0].o.body).get('code_verifier'),p.verifier);
 assert.equal(calls[0].url,'https://api.canva.com/rest/v1/oauth/token');assert.equal(calls[0].o.redirect,'error');
 assert.equal(c.status().access_token,undefined);assert.equal(c.status().clientSecret,undefined);
 await assert.rejects(c.exchange({code:'code',state:p.state}),/state/);
});
test('OAuth rejects expired callbacks and unexpected redirects / URL schemes',async()=>{
 const c=fixture(()=>{throw Error('Must not request');});c.authorize();c.pending.until=0;await assert.rejects(c.exchange({code:'x',state:c.pending.state}),/hết hạn/);
 for(const s of ['javascript:alert(1)','https://canva.com.evil.test/design','http://www.canva.com/design','https://a:b@canva.com/'])assert.throws(()=>canvaURL(s));
 assert.equal(canvaURL('https://www.canva.com/api/design/signed/edit'),'https://www.canva.com/api/design/signed/edit');
 assert.throws(()=>c.configure({clientId:'aaa',clientSecret:'secret',redirectURI:'http://evil.test/callback'}));
});
test('concurrent requests serialize single-use refresh rotation and never leak tokens to result data',async()=>{
 let refreshes=0,requests=0;const c=fixture(async(url,o)=>{if(url.endsWith('/oauth/token')){refreshes++;await new Promise(r=>setTimeout(r,10));assert.equal(new URLSearchParams(o.body).get('grant_type'),'refresh_token');return ok(tokens);}requests++;assert.equal(o.headers.Authorization,'Bearer fixture-access');return ok({items:[],continuation:'page-2'});});
 c.tokens={access_token:'expired',refresh_token:'single-use',expiresAt:0};const r=await Promise.all([c.list(),c.list()]);assert.equal(refreshes,1);assert.equal(requests,2);assert.equal(r[0].continuation,'page-2');assert.ok(!JSON.stringify(r).includes('fixture-access'));
});
test('native editing uses actual fresh API edit URL, export validates PNG and preserves page request',async()=>{
 const requests=[],png=Uint8Array.of(137,80,78,71,13,10,26,10,0);const c=fixture(async(url,o)=>{
  requests.push({url,o});if(url.includes('document-export.canva.com'))return new Response(png);
  if(url.endsWith('/designs/design-1'))return ok({design:{id:'design-1',title:'My design',urls:{edit_url:'https://www.canva.com/api/design/fresh/edit'}}});
  if(url.endsWith('/exports')&&o.method==='POST')return ok({job:{id:'export-1'}});
  if(url.endsWith('/exports/export-1'))return ok({job:{status:'success',urls:['https://document-export.canva.com/fixture.png']}});
  throw Error('Unexpected request');
 });c.tokens={...tokens,expiresAt:Date.now()+3600000};
 assert.match(await c.open('design-1'),/fresh\/edit$/);const r=await c.exportPage('design-1',3);
 assert.deepEqual(r.bytes,png);assert.equal(r.page,3);assert.equal(r.designId,'design-1');const req=requests.find(r=>r.url.endsWith('/exports'));
 assert.deepEqual(JSON.parse(req.o.body).format,{type:'png',lossless:true,pages:[3]});
 await assert.rejects(c.exportPage('x',-1),/trang/);await assert.rejects(c.open('../escape'),/ID/);
});
test('sending retouched PNG uploads actual bytes and creates a separate flattened asset design',async()=>{
 const calls=[],c=fixture(async(url,o)=>{calls.push({url,o});if(url.endsWith('/asset-uploads'))return ok({job:{id:'upload-1'}});if(url.endsWith('/asset-uploads/upload-1'))return ok({job:{status:'success',asset:{id:'asset-1'}}});if(url.endsWith('/designs'))return ok({design:{id:'new-design',urls:{edit_url:'https://www.canva.com/api/design/new/edit'}}});throw Error('Unexpected');});
 c.tokens={...tokens,expiresAt:Date.now()+3600000};const bytes=Uint8Array.of(137,80,78,71,13,10,26,10,0);await c.sendImage({bytes,name:'Ảnh Luma',width:1000,height:800});
 assert.deepEqual([...calls[0].o.body],[...bytes]);assert.equal(calls[0].o.headers['Content-Type'],'application/octet-stream');
 assert.equal(Buffer.from(JSON.parse(calls[0].o.headers['Asset-Upload-Metadata']).name_base64,'base64').toString(),'Ảnh Luma');
 const body=JSON.parse(calls.at(-1).o.body);assert.equal(body.asset_id,'asset-1');assert.equal(body.type,'type_and_asset');assert.deepEqual(body.design_type,{type:'custom',width:1000,height:800});
 await assert.rejects(c.sendImage({bytes,name:'large',width:8000,height:8000}),/25 MP/);
});
test('failed export jobs and HTTP errors do not produce fake successes',async()=>{
 const c=fixture(async()=>ok({job:{status:'failed'}}));c.tokens={...tokens,expiresAt:Date.now()+3600000};await assert.rejects(c.poll('/exports/job'),/không xử lý/);
 c.fetch=async()=>ok({},403);await assert.rejects(c.list(),/403/);
 c.fetch=async()=>ok({});await c.disconnect();assert.equal(c.tokens,null);assert.equal(c.clientSecret,null);
});
