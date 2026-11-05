import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {initializeCanvas,readPsd,writePsd} from 'ag-psd';
import {createDocument,createLayer,defaults} from '../dist/model.js';
import {Assets,renderDocument} from '../dist/renderer.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
initializeCanvas((w,h)=>createCanvas(w,h));
const {importPsd,exportPsd}=await import('../src/psd.js');
const pixels=c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data];
test('cutout copies round trip through PSD and PSB with source visibility and fractional native mask alpha',async()=>{
 const {captureCutout,applyCutouts}=await import('../dist/cutout-workflow.js');
 for(const psb of [false,true]){
  const d=createDocument(16,16),a=new Assets(),c=createCanvas(8,8);c.getContext('2d').fillStyle='#b52e17';c.getContext('2d').fillRect(0,0,8,8);const source=c.toDataURL();a.set(source,c);
  const l=createLayer('image',{name:'Source portrait',source,x:4,y:4,width:8,height:8,locked:true});d.layers=[l];d.activeId=l.id;
  applyCutouts(d,captureCutout(d,l),[{name:'Soft cutout',width:8,height:8,values:Float32Array.from({length:64},(_,i)=>(i%8)/7)}],a);
  const bytes=exportPsd(d,a,{editable:true,psb}),parsed=readPsd(bytes,{skipThumbnail:true});assert.equal(parsed.children[0].hidden,true);assert.ok(parsed.children[1].mask.canvas);
  const reopened=await importPsd(bytes,psb?'cutout.psb':'cutout.psd',a),before=pixels(renderDocument(d,a)),after=pixels(renderDocument(reopened.doc,a));assert.equal(reopened.doc.layers.length,2);assert.equal(reopened.doc.layers[0].visible,false);assert.ok(reopened.doc.layers[1].mask);assert.ok(before.every((v,i)=>Math.abs(v-after[i])<=1));
 }
});
test('plain PSD export reopens with the same layer order, opacity, blend and visible output',async()=>{const d=createDocument(16,16),a=new Assets();d.layers=[createLayer('shape',{name:'Base',shape:'rect',color:'#aabbcc',width:16,height:16}),createLayer('shape',{name:'Overlay',shape:'rect',color:'#dd2244',width:8,height:8,x:4,y:4,opacity:.7,blend:'multiply'})];const bytes=exportPsd(d,a),reopened=await importPsd(bytes,'roundtrip.psd',a);assert.deepEqual(reopened.doc.layers.map(l=>l.name),['Base','Overlay']);assert.equal(reopened.doc.layers[1].blend,'multiply');assert.ok(Math.abs(reopened.doc.layers[1].opacity-.7)<.005);const original=pixels(renderDocument(d,a)),actual=pixels(renderDocument(reopened.doc,a));assert.ok(original.every((v,i)=>Math.abs(v-actual[i])<=1));});
test('PSD with adjustments keeps a correct composite and hidden source pixels',async()=>{const d=createDocument(12,12),a=new Assets();d.layers=[createLayer('shape',{name:'Base',shape:'rect',color:'#ff0000',width:12,height:12}),createLayer('adjustment',{name:'Invert',adjustment:'invert',params:defaults('invert'),width:12,height:12})];const bytes=exportPsd(d,a),psd=readPsd(bytes,{skipThumbnail:true});assert.equal(psd.children.length,2);assert.equal(psd.children[0].hidden,true);assert.equal(psd.children[1].hidden,false);const reopened=await importPsd(bytes,'adjusted.psd',a);assert.deepEqual(pixels(renderDocument(d,a)),pixels(renderDocument(reopened.doc,a)));});
test('PSD depth and color mode checks reject unsupported input before decoding',async()=>{const buffer=new ArrayBuffer(26),v=new DataView(buffer);v.setUint32(0,0x38425053);v.setUint16(4,1);v.setUint16(22,16);v.setUint16(24,3);await assert.rejects(importPsd(buffer,'hdr.psd',new Assets()),/RGB, 8-bit/);v.setUint16(4,2);await assert.rejects(importPsd(buffer,'large.psb',new Assets()),/RGB, 8-bit/);});
test('PSD groups remain editable containers with linked children',async()=>{const c=createCanvas(8,8);c.getContext('2d').fillRect(0,0,8,8);const bytes=writePsd({width:8,height:8,canvas:c,children:[{name:'Group',children:[{name:'Image',canvas:c}]}]});const result=await importPsd(bytes,'group.psd',new Assets());assert.equal(result.doc.layers.length,2);assert.equal(result.doc.layers[0].type,'group');assert.equal(result.doc.layers[1].name,'Image');assert.equal(result.doc.layers[1].parentId,result.doc.layers[0].id);assert.equal(result.mode,'editable');assert.equal(result.stats.groups,1);});

test('group opacity remains editable on import',async()=>{const c=createCanvas(8,8);c.getContext('2d').fillRect(0,0,8,8);const bytes=writePsd({width:8,height:8,canvas:c,children:[{name:'Group',opacity:.5,children:[{name:'Image',canvas:c}]}]});const result=await importPsd(bytes,'complex.psd',new Assets());assert.equal(result.mode,'editable');assert.ok(Math.abs(result.doc.layers[0].opacity-.5)<.005);assert.equal(result.doc.layers[0].type,'group');});
test('editable PSD export preserves simple type metadata and text settings on import',async()=>{const d=createDocument(400,200),a=new Assets();d.layers=[createLayer('text',{name:'Heading',text:'Hello Luma',x:30,y:20,width:300,height:90,font:'Inter',fontSize:32,fontWeight:700,color:'#aabbcc',align:'left',lineHeight:1.2})];const bytes=exportPsd(d,a,{editable:true}),parsed=readPsd(bytes,{skipThumbnail:true});assert.equal(parsed.children[0].text.text,'Hello Luma');const r=await importPsd(bytes,'type.psd',a);const l=r.doc.layers[0];assert.equal(l.type,'text');assert.equal(l.text,'Hello Luma');assert.equal(l.fontSize,32);assert.equal(l.x,30);assert.equal(l.y,20);assert.equal(l.width,300);assert.equal(l.color,'#aabbcc');});
test('native PSD adjustments round trip without being flattened in editable export',async()=>{const d=createDocument(12,12),a=new Assets();d.layers=[createLayer('shape',{name:'Base',shape:'rect',color:'#ff0000',width:12,height:12}),createLayer('adjustment',{name:'Curves',adjustment:'curves',params:{channel:'rgb',points:[[0,10],[128,150],[255,250]]},width:12,height:12})];const bytes=exportPsd(d,a,{editable:true}),parsed=readPsd(bytes,{skipThumbnail:true});assert.equal(parsed.children.length,2);assert.equal(parsed.children[1].adjustment.type,'curves');assert.equal(parsed.children[0].hidden,false);const r=await importPsd(bytes,'live.psd',a);assert.equal(r.doc.layers[1].type,'adjustment');assert.deepEqual(r.doc.layers[1].params.points,[[0,10],[128,150],[255,250]]);assert.deepEqual(pixels(renderDocument(d,a)),pixels(renderDocument(r.doc,a)));});

test('editable PSD export keeps a native pixel mask and preserves its alpha output',async()=>{const d=createDocument(16,16),a=new Assets();d.layers=[createLayer('shape',{name:'Masked',shape:'rect',color:'#ff0000',width:16,height:16,mask:{type:'ellipse',x:2,y:2,width:12,height:12,feather:0,invert:false}})];const bytes=exportPsd(d,a,{editable:true}),parsed=readPsd(bytes,{skipThumbnail:true});assert.ok(parsed.children[0].mask.canvas);const r=await importPsd(bytes,'masked.psd',a);assert.equal(r.doc.layers[0].mask.type,'paint');assert.deepEqual(pixels(renderDocument(d,a)),pixels(renderDocument(r.doc,a)));});

test('native nested groups, opacity and clipping round trip in PSD and PSB',async()=>{for(const psb of [false,true]){const d=createDocument(16,16),a=new Assets(),group=createLayer('group',{name:'Design',width:16,height:16,opacity:.75});d.layers=[group,createLayer('shape',{parentId:group.id,name:'Base',shape:'rect',color:'#ff0000',width:8,height:16}),createLayer('shape',{parentId:group.id,name:'Clipped',shape:'rect',color:'#0000ff',width:16,height:16,clipToBelow:true})];const bytes=exportPsd(d,a,{editable:true,psb}),view=new DataView(bytes);assert.equal(view.getUint16(4),psb?2:1);const r=await importPsd(bytes,psb?'round.psb':'round.psd',a);assert.equal(r.doc.layers[0].type,'group');assert.equal(r.doc.layers[2].clipToBelow,true);assert.deepEqual(pixels(renderDocument(d,a)),pixels(renderDocument(r.doc,a)));}});
test('unsupported PSD group blend explicitly uses its saved composite',async()=>{const c=createCanvas(8,8);c.getContext('2d').fillRect(0,0,8,8);const bytes=writePsd({width:8,height:8,canvas:c,children:[{name:'Group',blendMode:'linear burn',children:[{name:'Image',canvas:c}]}]});const r=await importPsd(bytes,'blend.psd',new Assets());assert.equal(r.mode,'merged');assert.match(r.warnings[0],/merged image/);});

test('group pixel masks preserve output in both pixel and editable PSD exports',async()=>{
  for(const editable of [false,true]){
    const d=createDocument(16,16),a=new Assets(),g=createLayer('group',{name:'Masked group',width:16,height:16,mask:{type:'rect',x:0,y:0,width:6,height:16,feather:0,invert:false}});
    d.layers=[g,createLayer('shape',{parentId:g.id,shape:'rect',color:'#f04a30',width:16,height:16})];
    const bytes=exportPsd(d,a,{editable}),parsed=readPsd(bytes,{skipThumbnail:true});
    assert.ok(parsed.children[0].mask.canvas);
    const reopened=await importPsd(bytes,'group-mask.psd',a);
    assert.deepEqual(pixels(renderDocument(d,a)),pixels(renderDocument(reopened.doc,a)));
  }
});
test('group effects are rendered into a PSD layer without losing the group appearance',async()=>{
  const d=createDocument(32,32),a=new Assets(),g=createLayer('group',{name:'Styled group',width:32,height:32,opacity:.8});
  g.effects.stroke=true;g.effects.strokeColor='#0000ff';g.effects.strokeWidth=2;
  d.layers=[g,createLayer('shape',{parentId:g.id,shape:'rect',color:'#ff0000',x:8,y:8,width:12,height:12})];
  const bytes=exportPsd(d,a,{editable:true}),parsed=readPsd(bytes,{skipThumbnail:true});
  assert.ok(parsed.children[0].canvas);assert.match(parsed.children[0].name,/effects rendered/);
  const reopened=await importPsd(bytes,'effects.psd',a),before=pixels(renderDocument(d,a)),after=pixels(renderDocument(reopened.doc,a));
  assert.ok(before.every((v,i)=>Math.abs(v-after[i])<=1));
});

test('embedded native Smart Objects round trip shared PSD content and affine geometry',async()=>{
  const {convertSmartObject}=await import('../dist/smart-objects.js');
  for(const psb of [false,true]){
    const d=createDocument(64,64),a=new Assets(),c=createCanvas(16,12);c.getContext('2d').fillStyle='#a63b26';c.getContext('2d').fillRect(0,0,16,12);const source=c.toDataURL();a.set(source,c);const l=createLayer('image',{name:'Embedded photo',source,x:10,y:12,width:32,height:24,rotation:13});d.layers=[l];d.activeId=l.id;convertSmartObject(d,l,a);
    const copy=JSON.parse(JSON.stringify(d.layers[0]));copy.id+='-copy';copy.x+=18;copy.flipY=true;d.layers.push(copy);
    const bytes=exportPsd(d,a,{editable:true,psb}),parsed=readPsd(bytes,{skipThumbnail:true});assert.equal(parsed.linkedFiles.length,1);assert.ok(parsed.children[0].placedLayer);assert.equal(parsed.children[0].placedLayer.id,parsed.children[1].placedLayer.id);
    const result=await importPsd(bytes,psb?'smart.psb':'smart.psd',a);assert.equal(result.mode,'editable');assert.equal(result.doc.smartObjects.length,1);assert.equal(result.doc.layers[0].smartObjectId,result.doc.layers[1].smartObjectId);assert.ok(Math.abs(result.doc.layers[0].rotation-13)<.001);assert.equal(result.doc.layers[1].flipY,true);assert.equal(result.doc.smartObjects[0].document.layers[0].type,'image');
    assert.deepEqual(pixels(renderDocument(d,a)),pixels(renderDocument(result.doc,a)));
  }
});

test('print PSD and PSB store requested resolution and export more than the old40-layer budget',()=>{for(const psb of [false,true]){const d=createDocument(12,10),a=new Assets();d.layers=Array.from({length:41},(_,i)=>createLayer('shape',{name:'Print '+i,shape:'rect',color:'#758a43',width:12,height:10}));const parsed=readPsd(exportPsd(d,a,{psb,dpi:600}),{skipThumbnail:true});assert.equal(parsed.children.length,41);assert.equal(parsed.imageResources.resolutionInfo.horizontalResolution,600);assert.equal(parsed.imageResources.resolutionInfo.horizontalResolutionUnit,'PPI');assert.equal(parsed.imageResources.resolutionInfo.verticalResolution,600);}assert.throws(()=>exportPsd(createDocument(12,10),new Assets(),{dpi:0}),/DPI/);assert.throws(()=>exportPsd(createDocument(30001,1),new Assets()),/PSB/);});
