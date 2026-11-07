import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './ui-harness.mjs';
import {createRequire} from 'node:module';
import {validFontFamily} from '../dist/font-family.js';
import {cropRect,cropRatio,exactCrop,moveCrop} from '../dist/crop-geometry.js';
import {retouchPatch} from '../dist/retouch-brush.js';
import {tracePixels,traceSVG} from '../dist/trace-core.js';
import {previewCacheStats} from '../dist/preview-cache.js';
import {toolCursor} from '../dist/tool-cursors.js';
import {createDocument,createLayer} from '../dist/model.js';
import {Assets,renderDocument,canvas} from '../dist/renderer.js';
await setupDOM();
const require=createRequire(import.meta.url),{resolveLanguage}=require('../desktop/app/locale.cjs');
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
test('installed font metadata supports Unicode and rejects CSS declarations',()=>{
 for(const name of ['思源黑体','SVN-Gilroy','Yu Gothic UI','Noto Sans Việt','Arial'])assert.equal(validFontFamily(name),true);
 for(const name of ['',null,'x; color:red','x"','x\\y','x\nz','a'.repeat(161)])assert.equal(validFontFamily(name),false);
});
test('OS language resolution has a deterministic supported fallback',()=>{
 assert.equal(resolveLanguage(['vi-VN','en-US']),'vi');assert.equal(resolveLanguage(['ja-JP']),'en');assert.equal(resolveLanguage(['en-US'],'vi'),'vi');assert.equal(resolveLanguage(['vi-VN'],'en'),'en');
});
test('crop dimensions, bounds, ratios and translation stay valid in every direction',()=>{
 const doc={width:96,height:80};assert.equal(cropRatio('original',doc),1.2);assert.equal(cropRatio('free',doc),0);
 for(const point of [{x:95,y:79},{x:-50,y:-80},{x:200,y:300},{x:-50,y:300}]){const r=cropRect({x:45,y:30},point,doc,.8);assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=96.001&&r.y+r.height<=80.001);assert.ok(Math.abs(r.width/r.height-.8)<.001);}
 const r=exactCrop(null,32,40,doc);assert.equal(r.width,32);assert.equal(r.height,40);const moved=moveCrop(r,200,200,doc);assert.equal(moved.x,64);assert.equal(moved.y,40);
});
function solid(w,h,color=[128,128,128,255]){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data.set(color,i);return data;}
test('healing matches surrounding illumination without copying the blemish center',()=>{
 const width=40,height=20,source=solid(width,height,[110,110,110,255]);for(let y=0;y<height;y++)for(let x=20;x<width;x++)for(let k=0;k<3;k++)source[(y*width+x)*4+k]=150;
 for(let k=0;k<3;k++)source[(10*width+30)*4+k]=30;
 const patch={width:1,height:1,data:new Uint8ClampedArray(4)};retouchPatch({patch,source,width,height,left:30,top:10,point:{x:30.5,y:10.5},radius:4,hardness:1,strength:1,tool:'heal',offset:{x:-20,y:0}});
 assert.ok(patch.data[0]>135&&patch.data[0]<170);assert.equal(patch.data[3],255);
});
test('clone skips out-of-image donors and respects selection alpha',()=>{
 const source=solid(8,8,[255,20,10,255]),patch={width:1,height:1,data:new Uint8ClampedArray(4)},base={patch,source,width:8,height:8,left:0,top:0,point:{x:.5,y:.5},radius:3,hardness:1,strength:1,tool:'clone'};
 retouchPatch({...base,offset:{x:-8,y:0}});assert.deepEqual([...patch.data],[0,0,0,0]);retouchPatch({...base,selection:new Uint8ClampedArray(source.length)});assert.equal(patch.data[3],0);
 retouchPatch(base);assert.deepEqual([...patch.data],[255,20,10,255]);
});
test('dodge and burn alter tonal values, and tonal ranges change strength',()=>{
 const source=solid(8,8),run=(tool,range='all')=>{const patch={width:1,height:1,data:new Uint8ClampedArray(4)};retouchPatch({patch,source,width:8,height:8,left:4,top:4,point:{x:4.5,y:4.5},radius:3,hardness:1,strength:1,tool,range});return patch.data;};
 assert.ok(run('dodge')[0]>128);assert.ok(run('burn')[0]<128);assert.ok(run('dodge','shadows')[3]<run('dodge')[3]);
});
function logo(){const width=64,height=32,data=new Uint8ClampedArray(width*height*4);for(let y=2;y<30;y++)for(let x=2;x<62;x++){if(x>=26&&x<36)continue;if(x>8&&x<18&&y>9&&y<23)continue;if(x>43&&x<54&&y>8&&y<22)continue;data.set([255,186,19,255],(y*width+x)*4);}return {data,width,height};}
test('transparent trace preserves holes, separate components and output scale',()=>{
 const input=logo(),r=tracePixels({...input,outputWidth:640,outputHeight:320,tolerance:0});assert.equal(r.paths.length,2);assert.equal(r.paths.reduce((n,p)=>n+p.holes,0),2);assert.equal(r.width,640);
 const svg=traceSVG(r,{prefix:'larx-vo',animate:true});assert.match(svg,/larx-vo-path-001/);assert.match(svg,/larx-vo-path-002/);assert.match(svg,/fill-rule="evenodd"/);assert.match(svg,/prefers-reduced-motion/);assert.doesNotMatch(svg,/<image|<script/);assert.throws(()=>traceSVG(r,{prefix:'"><script>'}));
 const white=tracePixels({...input,fill:'#ffffff'});assert.equal(white.paths[0].fill,'#ffffff');
});
test('color tracing creates distinct vector regions and validates inputs',()=>{
 const width=24,height=16,data=solid(width,height,[255,0,0,255]);for(let y=0;y<height;y++)for(let x=12;x<width;x++)data.set([0,0,255,255],(y*width+x)*4);
 const r=tracePixels({data,width,height,mode:'colors',colors:2});assert.equal(new Set(r.paths.map(p=>p.fill)).size,2);assert.throws(()=>tracePixels({data,width:0,height}));assert.throws(()=>tracePixels({data,width,height,threshold:NaN}));assert.throws(()=>tracePixels({data:new Uint8ClampedArray(64),width:4,height:4}));
});
test('each selected tool has a native cursor, with distinct pen closure and clone sampling states',()=>{
 const names=['move','node','select','ellipse','lasso','wand','crop','brush','eraser','clone','heal','dodge','burn','pen','shape','gradient','eyedropper','zoom'];for(const name of names)assert.match(toolCursor(name),/^url\("data:image\/svg\+xml,/);
 assert.equal(new Set(names.map(n=>toolCursor(n))).size,names.length);assert.notEqual(toolCursor('pen'),toolCursor('pen',{close:true}));assert.notEqual(toolCursor('clone'),toolCursor('clone',{alt:true}));assert.equal(toolCursor('text'),'text');assert.equal(toolCursor('hand',{drawing:true}),'grabbing');
});
test('preview caching preserves pixels for clipping, adjustment and group edits',()=>{
 const assets=new Assets(),d=createDocument(64,48,'Preview parity'),base=createLayer('shape',{shape:'rect',x:2,y:3,width:40,height:30,color:'#aa4520'}),adjust=createLayer('adjustment',{adjustment:'brightness',params:{brightness:12,contrast:0},width:64,height:48}),clip=createLayer('shape',{shape:'ellipse',x:10,y:5,width:44,height:40,color:'#20aaff',clipToBelow:true}),group=createLayer('group',{name:'Group',width:64,height:48}),child=createLayer('shape',{shape:'rect',x:30,y:20,width:20,height:20,color:'#aaff20',parentId:group.id});
 d.layers=[base,adjust,clip,group,child];
 for(const target of [base,adjust,clip,child]){const cached=renderDocument(d,assets,{preview:{mutableIds:[target.id]}}),full=renderDocument(d,assets);assert.deepEqual(pixels(cached),pixels(full));cached.width=cached.height=full.width=full.height=1;}
 const a=renderDocument(d,assets,{preview:{mutableIds:[child.id]}});a.getContext('2d').clearRect(0,0,64,48);
 const again=renderDocument(d,assets,{preview:{mutableIds:[child.id]}}),full=renderDocument(d,assets);assert.deepEqual(pixels(again),pixels(full));assert.ok(previewCacheStats(assets).hits>0);
 base.color='#0000ff';assert.deepEqual(pixels(renderDocument(d,assets,{preview:{mutableIds:[child.id]}})),pixels(renderDocument(d,assets)));
});
test('preview cache invalidates mutable image content and font revision',()=>{
 const assets=new Assets(),d=createDocument(16,16),image=canvas(16,16),ctx=image.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(0,0,16,16);assets.set('working',image);const l=createLayer('image',{source:'working',width:16,height:16});d.layers=[l];
 renderDocument(d,assets,{preview:{mutableIds:[]}});ctx.fillStyle='#00f';ctx.fillRect(0,0,16,16);assets.touch('working');assert.deepEqual(pixels(renderDocument(d,assets,{preview:{mutableIds:[]}})),pixels(renderDocument(d,assets)));
 const before=previewCacheStats(assets).misses;assets.fontRevision++;renderDocument(d,assets,{preview:{mutableIds:[]}});assert.equal(previewCacheStats(assets).misses,before+1);
});
test('cached preview CPU timing is reported with exact pixel parity',t=>{
 const assets=new Assets(),d=createDocument(384,256,'Preview timing');d.layers=Array.from({length:14},(_,i)=>createLayer('shape',{shape:'ellipse',color:'#3d8366',opacity:.35,x:i*15,y:i*8,width:180,height:140}));const active=d.layers.at(-1),times={};
 for(const mode of ['full','cached']){renderDocument(d,assets,mode==='cached'?{preview:{mutableIds:[active.id]}}:{});const start=performance.now();for(let i=0;i<12;i++){active.x+=.25;const c=renderDocument(d,assets,mode==='cached'?{preview:{mutableIds:[active.id]}}:{});c.width=c.height=1;}times[mode]=+(performance.now()-start).toFixed(2);}
 assert.deepEqual(pixels(renderDocument(d,assets,{preview:{mutableIds:[active.id]}})),pixels(renderDocument(d,assets)));t.diagnostic(JSON.stringify({cpuPreview384x256Frames12:times,cache:previewCacheStats(assets)}));
});
