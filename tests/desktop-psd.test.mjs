import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {initializeCanvas,readPsd,writePsd} from 'ag-psd';
import {createDocument,createLayer,defaults,validateDocument} from '../dist/model.js';
import {Assets,renderDocument} from '../dist/renderer.js';
import {switchLevelChannel} from '../dist/tone-controls.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
initializeCanvas((w,h)=>createCanvas(w,h));
const {importPsd,exportPsd}=await import('../src/psd.js');
const pixels=(d,a)=>[...renderDocument(d,a).getContext('2d').getImageData(0,0,d.width,d.height).data];
function fixture(){const d=createDocument(48,48,'PSD desktop'),a=new Assets();d.layers=[createLayer('shape',{shape:'rect',color:'#7090b0',width:24,height:24,x:8,y:8})];d.activeId=d.layers[0].id;return {d,a,l:d.layers[0]};}
test('PSD/PSB export bakes Fill and all nine styles without losing visible pixels',async()=>{
 for(const effect of ['bevel','stroke','innerShadow','innerGlow','satin','colorOverlay','gradientOverlay','glow','shadow'])for(const psb of [false,true]){
  const {d,a,l}=fixture();l.fillOpacity=.4;l.effects={[effect]:true};const bytes=exportPsd(d,a,{editable:true,psb}),r=await importPsd(bytes,'styles.psd',a);assert.deepEqual(pixels(r.doc,a),pixels(d,a),effect);validateDocument(r.doc);
 }
});
test('PSD channel Levels with output endpoints remain editable on round trip',async()=>{
 const {d,a}=fixture(),params=defaults('levels');params.outputBlack=20;params.outputWhite=235;switchLevelChannel(params,'red');params.gamma=1.2;params.outputWhite=190;switchLevelChannel(params,'green');params.black=12;switchLevelChannel(params,'rgb');d.layers.push(createLayer('adjustment',{adjustment:'levels',params,width:48,height:48}));
 const bytes=exportPsd(d,a,{editable:true}),parsed=readPsd(bytes,{skipThumbnail:true});assert.equal(parsed.children[1].adjustment.rgb.shadowOutput,20);assert.equal(parsed.children[1].adjustment.red.highlightOutput,190);assert.equal(parsed.children[1].adjustment.green.shadowInput,12);const r=await importPsd(bytes,'levels.psd',a);assert.equal(r.mode,'editable');assert.equal(r.doc.layers[1].params.channels.red.outputWhite,190);const expected=pixels(d,a);assert.ok(pixels(r.doc,a).every((v,i)=>Math.abs(v-expected[i])<=1),"Levels rendering must retain channels");validateDocument(r.doc);
});
test('Colorize uses finished composite in PSD and preserves the source as hidden pixels',async()=>{const {d,a}=fixture();d.layers.push(createLayer('adjustment',{adjustment:'hue',params:{...defaults('hue'),colorize:true,hue:120,saturation:50},width:48,height:48}));const bytes=exportPsd(d,a,{editable:true}),parsed=readPsd(bytes,{skipThumbnail:true});assert.equal(parsed.children[0].hidden,true);const r=await importPsd(bytes,'colorize.psd',a);assert.deepEqual(pixels(r.doc,a),pixels(d,a));});
test('Imported PSD Fill and a disabled native mask preserve their actual visibility',async()=>{
 const c=createCanvas(10,10);c.getContext('2d').fillStyle='#ff0000';c.getContext('2d').fillRect(0,0,10,10);const mask=createCanvas(10,10);mask.getContext('2d').fillStyle='#000';mask.getContext('2d').fillRect(0,0,10,10);const bytes=writePsd({width:10,height:10,canvas:c,children:[{name:'Fill',canvas:c,fillOpacity:.5,mask:{canvas:mask,top:0,left:0,disabled:true}}]}),a=new Assets(),r=await importPsd(bytes,'fill.psd',a);assert.equal(r.doc.layers[0].mask.disabled,true);assert.ok(Math.abs(r.doc.layers[0].fillOpacity-.5)<.01);assert.ok(Math.abs(pixels(r.doc,a)[3]-128)<=1);
});
test('Photoshop mask density imports at its actual value',async()=>{const c=createCanvas(8,8),mask=createCanvas(8,8),a=new Assets();c.getContext('2d').fillStyle='#ff0000';c.getContext('2d').fillRect(0,0,8,8);mask.getContext('2d').fillStyle='#000';mask.getContext('2d').fillRect(0,0,8,8);const bytes=writePsd({width:8,height:8,canvas:c,children:[{canvas:c,mask:{canvas:mask,top:0,left:0,userMaskDensity:.5}}]}),r=await importPsd(bytes,'density.psd',a);assert.ok(Math.abs(r.doc.layers[0].mask.density-50)<1);assert.ok(Math.abs(pixels(r.doc,a)[3]-128)<=1);});
