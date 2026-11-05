import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './ui-harness.mjs';
import {createDocument,createLayer,applyPixels,histogram,validateDocument} from '../dist/model.js';
import {Assets,renderDocument} from '../dist/renderer.js';
import {STYLE_DEFS} from '../dist/layer-effects.js';
import {switchLevelChannel} from '../dist/tone-controls.js';
import {exportSvg} from '../dist/pro-export.js';
import {ungroup} from '../dist/pro-model.js';
await setupDOM();
const assets=new Assets();
function fixture(values={}){const d=createDocument(80,80,'Desktop effects');const l=createLayer('shape',{name:'Subject',shape:'rect',color:'#647c96',x:20,y:20,width:32,height:32,...values});d.layers=[l];d.activeId=l.id;return {d,l};}
const px=(d,x,y)=>[...renderDocument(d,assets).getContext('2d').getImageData(x,y,1,1).data];
test('Fill hides content while shadow and Color Overlay remain independently visible; opacity fades both',()=>{
 const {d,l}=fixture({fillOpacity:0,effects:{shadow:true,shadowBlur:0,shadowX:12,shadowY:12,shadowColor:'#ff0000'}});
 assert.equal(px(d,22,22)[3],0);assert.deepEqual(px(d,58,58),[255,0,0,255]);l.opacity=.5;assert.ok(Math.abs(px(d,58,58)[3]-128)<=1);
 l.opacity=1;l.effects={colorOverlay:true,colorOverlayColor:'#00ff00'};assert.deepEqual(px(d,30,30),[0,255,0,255]);
 l.effects={};assert.equal(px(d,30,30)[3],0);l.fillOpacity=.4;assert.ok(Math.abs(px(d,30,30)[3]-102)<=1);
});
for(const [key]of STYLE_DEFS)test(`${key} changes actual pixels without changing source geometry`,()=>{
 const {d,l}=fixture();const before=Buffer.from(renderDocument(d,assets).getContext('2d').getImageData(0,0,80,80).data);const geometry=[l.x,l.y,l.width,l.height];
 l.effects={[key]:true};validateDocument(d);const after=Buffer.from(renderDocument(d,assets).getContext('2d').getImageData(0,0,80,80).data);assert.notDeepEqual(after,before,key);assert.deepEqual([l.x,l.y,l.width,l.height],geometry);l.effects[key]=false;assert.deepEqual(Buffer.from(renderDocument(d,assets).getContext('2d').getImageData(0,0,80,80).data),before);
});
test('Levels output endpoints and per-channel banks compose and survive channel switching',()=>{
 const p={channel:'rgb',black:0,white:255,gamma:1,outputBlack:20,outputWhite:220};switchLevelChannel(p,'red');p.outputWhite=128;switchLevelChannel(p,'blue');p.outputBlack=40;switchLevelChannel(p,'rgb');
 assert.equal(p.outputBlack,20);assert.equal(p.channels.red.outputWhite,128);assert.equal(p.channels.blue.outputBlack,40);
 const data=new Uint8ClampedArray([0,0,0,127,255,255,255,255]);applyPixels(data,'levels',p);assert.deepEqual([...data],[10,20,57,127,110,220,225,255]);
 const d=createDocument(1,1);d.layers=[createLayer('adjustment',{adjustment:'levels',params:p,width:1,height:1})];validateDocument(JSON.parse(JSON.stringify(d)));
});
test('Colorize tints grayscale with a chosen hue, preserves tonal variation and alpha',()=>{
 const input=new Uint8ClampedArray([64,64,64,80,192,192,192,200]);applyPixels(input,'hue',{colorize:true,hue:120,saturation:100,lightness:0});assert.ok(input[1]>input[0]&&input[1]>input[2]);assert.ok(input[5]>input[1]);assert.equal(input[3],80);assert.equal(input[7],200);
});
test('Histogram reports selected color channel and median, ignoring transparent pixels',()=>{const p=new Uint8ClampedArray([20,100,200,255,40,100,200,255,255,0,0,0]),r=histogram(p,'red');assert.equal(r.count,2);assert.equal(r.mean,30);assert.equal(r.median,20);assert.equal(histogram(p,'green').mean,100);});
test('Disabled masks and density reveal source pixels and work on adjustment masks',()=>{
 const {d,l}=fixture({mask:{type:'rect',x:20,y:20,width:12,height:32,feather:0}});assert.equal(px(d,45,30)[3],0);l.mask.density=50;assert.ok(Math.abs(px(d,45,30)[3]-128)<=1);l.mask.disabled=true;assert.equal(px(d,45,30)[3],255);
 const a=createLayer('adjustment',{adjustment:'invert',params:{amount:100},width:80,height:80,mask:{type:'rect',x:0,y:0,width:1,height:1,disabled:true}});d.layers.push(a);assert.deepEqual(px(d,45,30).slice(0,3),[155,131,105]);validateDocument(d);
});
test('Pattern fill repeats at native tile size; SVG honestly embeds raster for new styles and Fill',()=>{
 const {d,l}=fixture({x:0,y:0,width:80,height:80,patternFill:{kind:'dots',size:8,color:'#ff0000'}});assert.deepEqual(px(d,4,4).slice(0,3),[255,0,0]);assert.ok(px(d,4,4)[3]>128);assert.deepEqual(px(d,12,4),px(d,4,4));assert.equal(px(d,0,0)[3],0);const svg=exportSvg(d,assets);assert.match(svg.svg,/<image/);l.patternFill=undefined;l.fillOpacity=.25;assert.match(exportSvg(d,assets).svg,/<image/);validateDocument(d);
});
test('an open unfilled Bezier keeps its intrinsic stroke and has no doubled outline',()=>{
 const {d,l}=fixture({shape:'path',width:40,height:20,pathWidth:40,pathHeight:20,fillEnabled:false,path:[['M',0,10],['L',40,10]],effects:{stroke:true,strokeColor:'#ff0000',strokeWidth:4}});assert.deepEqual(px(d,30,30),[255,0,0,255]);assert.equal(px(d,30,26)[3],0);assert.equal(px(d,30,34)[3],0);validateDocument(d);
});
test('ungroup refuses to discard Fill or new effects and leaves the document exact',()=>{const {d,l}=fixture(),g=createLayer('group',{width:80,height:80,fillOpacity:.5});d.layers.unshift(g);l.parentId=g.id;d.activeId=g.id;const before=JSON.stringify(d);assert.throws(()=>ungroup(d),/group mask/);assert.equal(JSON.stringify(d),before);g.fillOpacity=1;g.effects={innerGlow:true};assert.throws(()=>ungroup(d),/group mask/);});
test('project validation rejects malformed effect stacks and mask flags',()=>{const {d,l}=fixture();l.effects.stack={};assert.throws(()=>validateDocument(d),/effect stack/);l.effects.stack=['unknown'];assert.throws(()=>validateDocument(d),/effect stack/);l.effects={};l.mask={type:'rect',x:0,y:0,width:1,height:1,antiAlias:'yes'};assert.throws(()=>validateDocument(d),/anti-alias/);});
