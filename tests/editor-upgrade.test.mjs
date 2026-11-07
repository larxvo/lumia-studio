import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM,tick} from './ui-harness.mjs';
import {createDocument,createLayer,validateDocument} from '../dist/model.js';
const {window,document}=await setupDOM();
let fontsCalls=0,actionCallback;
window.lumaDesktop={fonts:async()=>{fontsCalls++;return {source:'system',families:['Inter','Noto Sans','Yu Gothic UI','思源黑体','SVN-Gilroy']};},environment:async()=>({languages:['vi-VN','en-US'],languagePreference:'auto'}),setLanguage:async()=>({saved:true}),ready(){},onOpen(){return()=>{};},onAction(callback){actionCallback=callback;return()=>{};}};
const {studio}=await import('../dist/app.js');
for(let i=0;i<80&&!studio.ready();i++)await tick();
function click(selector){const el=document.querySelector(selector);assert.ok(el,'Missing '+selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));}
function value(selector,value,event='change'){const el=document.querySelector(selector);assert.ok(el,'Missing '+selector);el.value=String(value);el.dispatchEvent(new window.Event(event,{bubbles:true}));}
function pointer(type,x,y,more={}){const match=document.querySelector('#artboard').style.transform.match(/translate\(([-.\d]+)px,\s*([-.\d]+)px\)\s*scale\(([-.\d]+)\)/);assert.ok(match);const e=new window.Event(type,{bubbles:true});Object.assign(e,{pointerId:1,button:0,clientX:Number(match[1])+x*Number(match[3]),clientY:Number(match[2])+y*Number(match[3]),pointerType:'mouse',pressure:.5,...more});document.querySelector('#stage').dispatchEvent(e);}
function sample({empty=false,text=false}={}){const d=createDocument(96,80,'File');if(!empty){const l=createLayer(text?'text':'shape',{name:'Move',text:'File · Chỉnh ảnh',font:'Inter',fontSize:12,color:'#808080',shape:'rect',width:96,height:80});d.layers=[l];d.activeId=l.id;d.selectedIds=[l.id];}studio.setDocument(d,'Fixture');studio.setTool('move');return d;}
function image(layer){return studio.assets.get(layer.source).getContext('2d');}
test('every layer row exposes a reversible lock control and locked pixels cannot be painted',async()=>{
 const d=sample(),id=d.activeId,selector='[data-layer-lock="'+id+'"]';assert.ok(document.querySelector(selector));click(selector);assert.equal(studio.getDocument().layers[0].locked,true);assert.equal(document.querySelector(selector).getAttribute('aria-pressed'),'true');
 studio.setTool('brush');pointer('pointerdown',12,12);pointer('pointerup',12,12);assert.equal(studio.getDocument().layers.length,1);await studio.runAction('undo');assert.equal(studio.getDocument().layers[0].locked,false);
});
test('installed Unicode fonts populate both type selectors and support search without changing option values',async()=>{
 sample({text:true});await tick();assert.ok(fontsCalls>0);let select=document.querySelector('[data-property="font"]');assert.ok([...select.options].some(o=>o.value==='思源黑体'));
 value('#font-filter','思源','input');select=document.querySelector('[data-property="font"]');assert.equal(select.options.length,1);value('[data-property="font"]','思源黑体','input');value('[data-property="font"]','思源黑体');assert.equal(studio.getDocument().layers[0].font,'思源黑体');validateDocument(studio.getDocument());await studio.runAction('type-studio');assert.ok([...document.querySelector('#type-font').options].some(o=>o.value==='思源黑体'));click('[data-modal-close]');
});
test('language follows the machine, changes UI safely and native menu forwards preferences',async()=>{
 sample({text:true});await tick();assert.equal(studio.localization.language,'vi');assert.equal(document.querySelector('[data-menu="Image"]').textContent,'Ảnh');
 await studio.localization.setLanguage('en');await tick();assert.equal(document.querySelector('[data-menu="Image"]').textContent,'Image');assert.equal(document.querySelector('[data-menu="Type"]').textContent,'Type');assert.equal(document.querySelector('#layer-count').textContent,'1');
 assert.equal(studio.getDocument().name,'File');assert.equal(studio.getDocument().layers[0].name,'Move');assert.equal(studio.getDocument().layers[0].text,'File · Chỉnh ảnh');
 actionCallback('language-preferences');await tick();assert.equal(document.querySelector('#modal').open,true);assert.equal(document.querySelector('#application-language').value,'en');click('[data-modal-close]');
 await studio.localization.setLanguage('vi');await tick();assert.equal(document.querySelector('[data-property="font"]').value,'Inter');await studio.localization.setLanguage('en');
});
test('Lasso only commits after drawing and supports cancellation, Undo and Redo',async()=>{
 sample();studio.setTool('lasso');assert.equal(studio.getDocument().selection,null);pointer('pointerdown',10,10);pointer('pointermove',60,12);pointer('pointermove',50,60);assert.equal(studio.getDocument().selection,null);pointer('pointerup',50,60);assert.equal(studio.getDocument().selection.type,'polygon');await studio.runAction('undo');assert.equal(studio.getDocument().selection,null);await studio.runAction('redo');const old=studio.getDocument().selection;pointer('pointerdown',20,20);pointer('pointermove',40,20);pointer('pointercancel',40,20);assert.deepEqual(studio.getDocument().selection,old);
});
test('Crop uses a separate draft, offers ratios and exact pixels, and applies with one Undo',async()=>{
 sample();await studio.runAction('select-all');const selection=studio.getDocument().selection;studio.setTool('crop');assert.equal(studio.getCrop(),null);value('#crop-ratio','4:5');pointer('pointerdown',10,10);pointer('pointermove',58,70);pointer('pointerup',58,70);let crop=studio.getCrop();assert.ok(Math.abs(crop.width/crop.height-.8)<.001);assert.deepEqual(studio.getDocument().selection,selection);
 value('#crop-width',32);assert.equal(Math.round(studio.getCrop().height),40);await studio.runAction('cancel-crop');assert.equal(studio.getCrop(),null);assert.deepEqual(studio.getDocument().selection,selection);
 value('#crop-ratio','1:1');pointer('pointerdown',10,10);pointer('pointermove',50,50);pointer('pointerup',50,50);await studio.runAction('apply-crop');assert.equal(studio.getDocument().width,40);assert.equal(studio.getDocument().height,40);await studio.runAction('undo');assert.equal(studio.getDocument().width,96);assert.equal(studio.getDocument().height,80);
});
test('Brush draws empty-coalesced input and final release position, with one history entry',async()=>{
 sample({empty:true});studio.setTool('brush');value('#brush-size',10);value('#brush-hardness',100);const before=studio.getHistory().index;
 pointer('pointerdown',12,30);pointer('pointermove',50,30,{getCoalescedEvents:()=>[]});pointer('pointerup',65,30);await tick();
 const d=studio.getDocument();assert.equal(d.layers.length,1);const ctx=image(d.layers[0]);for(const x of [12,30,50,65])assert.ok(ctx.getImageData(x,30,1,1).data[3]>240,'Missing stroke at '+x);
 assert.equal(studio.getHistory().index,before+1);await studio.runAction('undo');assert.equal(studio.getDocument().layers.length,0);await studio.runAction('redo');assert.equal(studio.getDocument().layers.length,1);
});
test('pointer cancellation and Ctrl+Z during a new stroke preserve earlier history',async()=>{
 sample({empty:true});studio.setTool('brush');pointer('pointerdown',12,20);pointer('pointermove',25,20);pointer('pointercancel',25,20);assert.equal(studio.getDocument().layers.length,0);assert.equal(studio.getHistory().index,0);
 pointer('pointerdown',12,20);pointer('pointerup',25,20);const source=studio.getDocument().layers[0].source,before=studio.getHistory().index;pointer('pointerdown',45,40);pointer('pointermove',65,40);await studio.runAction('undo');assert.equal(studio.getHistory().index,before);assert.equal(studio.getDocument().layers[0].source,source);
});
test('Brush and Eraser respect a selection and restore pixels with Undo',async()=>{
 sample({empty:true});studio.setTool('select');pointer('pointerdown',10,10);pointer('pointermove',40,60);pointer('pointerup',40,60);studio.setTool('brush');value('#brush-size',20);value('#brush-hardness',100);pointer('pointerdown',5,30);pointer('pointermove',70,30);pointer('pointerup',70,30);let l=studio.getDocument().layers[0];assert.equal(image(l).getImageData(5,30,1,1).data[3],0);assert.equal(image(l).getImageData(25,30,1,1).data[3],255);assert.equal(image(l).getImageData(60,30,1,1).data[3],0);
 studio.setTool('eraser');pointer('pointerdown',25,30);pointer('pointerup',25,30);l=studio.getDocument().layers[0];assert.equal(image(l).getImageData(25,30,1,1).data[3],0);await studio.runAction('undo');assert.equal(image(studio.getDocument().layers[0]).getImageData(25,30,1,1).data[3],255);
});
test('Clone sampling is isolated by document identity',async()=>{
 sample();studio.setTool('clone');pointer('pointerdown',20,20,{altKey:true});pointer('pointerup',20,20,{altKey:true});sample();studio.setTool('clone');pointer('pointerdown',60,40);pointer('pointerup',60,40);assert.equal(studio.getDocument().layers.length,1);
});
test('Dodge and Burn change real pixels on a separate reversible layer',async()=>{
 for(const tool of ['dodge','burn']){const original=sample();studio.setTool(tool);pointer('pointerdown',45,35);pointer('pointerup',45,35);const d=studio.getDocument(),l=d.layers.at(-1),color=image(l).getImageData(45,35,1,1).data;assert.ok(color[3]>0);assert.ok(tool==='dodge'?color[0]>128:color[0]<128);assert.deepEqual(d.layers[0],original.layers[0]);await studio.runAction('undo');assert.equal(studio.getDocument().layers.length,1);}
});
test('transparent trace adds actual editable path layers with preserved holes and atomic Undo',async()=>{
 const d=createDocument(64,32,'Logo'),c=document.createElement('canvas');c.width=64;c.height=32;const x=c.getContext('2d');x.fillStyle='#ffba13';x.fillRect(2,2,26,28);x.clearRect(9,10,10,12);x.fillRect(36,2,26,28);const source=c.toDataURL();studio.assets.set(source,c);const l=createLayer('image',{source,width:64,height:32,name:'Logo'});d.layers=[l];d.activeId=l.id;d.selectedIds=[l.id];studio.setDocument(d,'Trace fixture');
 await studio.runAction('trace-svg');for(let i=0;i<30&&document.querySelector('#trace-stat')?.dataset.ready!=='true';i++)await tick();assert.equal(document.querySelector('#trace-stat').dataset.ready,'true');const svg=document.querySelector('#trace-vector svg');assert.ok(svg);assert.equal(svg.querySelectorAll('path').length,2);assert.doesNotMatch(svg.outerHTML,/<image/);click('[data-modal-button="2"]');const after=studio.getDocument();validateDocument(after);assert.equal(after.layers.filter(l=>l.shape==='path').length,2);assert.equal(after.layers[0].visible,false);assert.equal(after.layers.find(l=>l.id===after.activeId).shape,'path');await studio.runAction('undo');assert.equal(studio.getDocument().layers.length,1);assert.equal(studio.getDocument().layers[0].visible,true);
});
test('canceling trace does not alter source or layer count',async()=>{
 const before=studio.getDocument();await studio.runAction('trace-svg');click('[data-modal-close]');assert.deepEqual(studio.getDocument(),before);
});
