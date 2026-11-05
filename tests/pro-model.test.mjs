import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createDocument,createLayer,validateDocument,clone,applyPixels,defaults} from '../dist/model.js';
import {groupSelection,ungroup,subtree,children,moveObjects,duplicateObjects,deleteObjects,selectLayer,alignObjects,distribute,reorderObject,refreshGroups,affineGeometry,snapDelta} from '../dist/pro-model.js';
import {Assets,renderDocument,renderLayer} from '../dist/renderer.js';
import {filterPixels,boxBlur,morphAlpha} from '../dist/filters.js';
import {exportSvg,zipFiles} from '../dist/pro-export.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
const pixel=(c,x=4,y=4)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
const shape=(values={})=>createLayer('shape',{shape:'rect',color:'#ff0000',width:16,height:16,...values});
function fixture(){const d=createDocument(100,100);d.layers=[shape({name:'a',x:0,width:10}),shape({name:'b',x:35,width:20}),shape({name:'c',x:80,width:10})];d.activeId=d.layers[2].id;d.selectedIds=d.layers.map(l=>l.id);return d;}
test('grouping creates a real parent and serializes a valid nested hierarchy',()=>{const d=fixture(),g=groupSelection(d);assert.equal(d.layers.length,4);assert.equal(children(d,g.id).length,3);assert.equal(subtree(d,g.id).length,4);validateDocument(d);const copy=clone(d);validateDocument(copy);assert.equal(copy.layers[1].parentId,g.id);});
test('moving a group with its child also selected moves descendants exactly once',()=>{const d=fixture(),g=groupSelection(d),child=children(d,g.id)[0],x=child.x;moveObjects(d,[g,child],12,9);assert.equal(child.x,x+12);assert.equal(child.y,9);assert.equal(g.x,12);});
test('duplicating a group remaps nested parent IDs and preserves the original hierarchy',()=>{const d=fixture(),g=groupSelection(d),original=clone(d);duplicateObjects(d);const copy=d.layers.find(l=>l.id===d.activeId);assert.notEqual(copy.id,g.id);assert.equal(subtree(d,copy.id).length,4);assert.equal(children(d,copy.id).length,3);assert.deepEqual(d.layers.slice(0,4),original.layers);validateDocument(d);});
test('ungroup removes only its container and keeps editable children in order',()=>{const d=fixture(),g=groupSelection(d),names=children(d,g.id).map(l=>l.name);ungroup(d);assert.equal(d.layers.length,3);assert.deepEqual(d.layers.map(l=>l.name),names);assert.ok(d.layers.every(l=>!l.parentId));});
test('locked descendants prevent destructive group deletion',()=>{const d=fixture(),g=groupSelection(d);children(d,g.id)[0].locked=true;assert.throws(()=>deleteObjects(d),/Unlock/);assert.equal(d.layers.length,4);});
test('reparenting cannot create a group cycle and can move layers into a group',()=>{const d=fixture(),g=groupSelection(d),child=children(d,g.id)[0];assert.equal(reorderObject(d,g.id,child.id,{inside:true}),false);ungroup(d);d.selectedIds=[d.layers[0].id];d.activeId=d.layers[0].id;const fresh=groupSelection(d),other=d.layers.at(-1);reorderObject(d,other.id,fresh.id,{inside:true});assert.equal(other.parentId,fresh.id);validateDocument(d);});
test('multi-alignment and distribution use outer bounds and equal visual gaps',()=>{const d=fixture();alignObjects(d,'top');assert.ok(d.layers.every(l=>l.y===0));distribute(d,'x');assert.equal(d.layers[1].x,35);d.layers[1].x=20;distribute(d,'x');assert.equal(d.layers[1].x,35);});
test('snapping finds canvas centers, guide lines and peer edges',()=>{const d=fixture(),l=d.layers[0];d.guides=[{axis:'x',position:23}];const r=snapDelta(d,[l],22,0,3);assert.equal(r.dx,23);assert.ok(r.guides.some(g=>g.position===23));});
test('uniform affine transforms preserve text editability and scale its font',()=>{const d=createDocument(100,100),l=createLayer('text',{text:'Text',font:'Arial',fontSize:20,width:40,height:30,x:10,y:20,color:'#fff'});d.layers=[l];affineGeometry(d,[l],{cx:0,cy:0,sx:2,sy:2,angle:90});assert.equal(l.fontSize,40);assert.equal(l.rotation,90);assert.equal(l.width,80);assert.equal(Math.round(l.x),-110);});
test('validation rejects cyclic parents and arbitrary live filter data',()=>{const d=fixture(),g=groupSelection(d);g.parentId=g.id;assert.throws(()=>validateDocument(d),/cyclic/);g.parentId=null;d.layers[1].filters=[{type:'unsafe',params:{}}];assert.throws(()=>validateDocument(d),/filter/);});
test('group opacity applies once to overlapping children',()=>{const d=createDocument(16,16),g=createLayer('group',{width:16,height:16,opacity:.5});d.layers=[g,shape({parentId:g.id}),shape({parentId:g.id,color:'#0000ff',x:2,width:8})];const c=renderDocument(d,new Assets());assert.ok(Math.abs(pixel(c)[3]-128)<=1);assert.ok(pixel(c)[2]>250);});
test('clipping limits a layer to the immediate base alpha and survives group masking',()=>{const d=createDocument(16,16),g=createLayer('group',{width:16,height:16,mask:{type:'rect',x:0,y:0,width:4,height:16}});d.layers=[g,shape({parentId:g.id,width:8}),shape({parentId:g.id,color:'#0000ff',clipToBelow:true})];const c=renderDocument(d,new Assets());assert.equal(pixel(c,2,4)[2],255);assert.equal(pixel(c,6,4)[3],0);assert.equal(pixel(c,12,4)[3],0);});
test('hidden groups hide all their descendants; pass-through adjustments affect lower layers',()=>{const d=createDocument(16,16),g=createLayer('group',{width:16,height:16,blend:'pass-through'});d.layers=[shape(),g,createLayer('adjustment',{parentId:g.id,adjustment:'invert',params:{amount:100},width:16,height:16})];assert.deepEqual(pixel(renderDocument(d,new Assets())),[0,255,255,255]);g.visible=false;assert.deepEqual(pixel(renderDocument(d,new Assets())),[255,0,0,255]);});
test('a live filter changes rendered pixels without changing source bytes',()=>{const d=createDocument(16,16),l=shape({color:'#ff0000',filters:[{type:'sepia',params:{amount:100},visible:true}]});d.layers=[l];const before=clone(l),p=pixel(renderDocument(d,new Assets()));assert.ok(p[1]>50&&p[2]>20);assert.deepEqual(l,before);l.filters[0].visible=false;assert.deepEqual(pixel(renderDocument(d,new Assets())),[255,0,0,255]);});
test('filters preserve alpha; zero-strength sharpen is identity; median removes an impulse',()=>{const src=new Uint8ClampedArray(3*3*4);for(let i=0;i<src.length;i+=4){src[i]=src[i+1]=src[i+2]=50;src[i+3]=123;}src[16]=255;const data=new Uint8ClampedArray(src);filterPixels(data,3,3,'sharpen',{amount:0});assert.deepEqual(data,src);filterPixels(data,3,3,'median',{amount:100});assert.equal(data[16],50);assert.equal(data[19],123);});
test('box blur spreads a bright pixel and keeps a constant image constant',()=>{const src=new Uint8ClampedArray(3*3*4);src[16]=255;const out=boxBlur(src,3,3,1);assert.ok(out[0]>0&&out[16]<255);const constant=new Uint8ClampedArray(4*9).fill(80);assert.deepEqual(boxBlur(constant,3,3,2),constant);});
test('16 live adjustments include working channel mixing, posterization and threshold',()=>{let data=new Uint8ClampedArray([200,60,20,99]);applyPixels(data,'channelmixer',{rr:0,rg:0,rb:100,gr:0,gg:100,gb:0,br:100,bg:0,bb:0});assert.deepEqual([...data],[20,60,200,99]);data=new Uint8ClampedArray([100,150,200,99]);applyPixels(data,'threshold',{level:128});assert.deepEqual([...data],[255,255,255,99]);});
test('SVG export contains true vector elements, escaped text and group structure',()=>{const d=createDocument(400,100),g=createLayer('group',{name:'Group',width:400,height:100});d.layers=[g,shape({parentId:g.id}),createLayer('text',{parentId:g.id,name:'Title',text:'A & <B>',font:'Arial',fontSize:12,color:'#000000',width:300,height:50})];const {svg,notes}=exportSvg(d,new Assets());assert.match(svg,/<rect/);assert.match(svg,/<text/);assert.match(svg,/A &amp; &lt;B&gt;/);assert.match(svg,/data-name="Group"/);assert.equal(notes.length,0);});
test('SVG export explicitly rasterizes documents with live adjustments',()=>{const d=createDocument(16,16);d.layers=[shape(),createLayer('adjustment',{adjustment:'invert',params:{amount:100},width:16,height:16})];const r=exportSvg(d,new Assets());assert.match(r.svg,/data:image\/png;base64/);assert.equal(r.notes.length,1);});
test('ZIP pack has a valid local header, UTF-8 name, central directory and known CRC32',async()=>{const zip=await zipFiles([{name:'hello.txt',data:new TextEncoder().encode('hello')}]),bytes=new Uint8Array(await zip.arrayBuffer()),v=new DataView(bytes.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(14,true),0x3610a686);assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);assert.equal(v.getUint16(bytes.length-12,true),1);});

test('selection expansion and contraction match a bounded square neighborhood including canvas edges',()=>{
  const w=7,h=5,src=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)src[(y*w+x)*4+3]=(x*47+y*83)%256;
  for(const amount of [-3,-1,1,3]){
    const out=morphAlpha(src,w,h,amount),r=Math.abs(amount);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const values=[];for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)values.push(xx<0||xx>=w||yy<0||yy>=h?0:src[(yy*w+xx)*4+3]);
      assert.equal(out[(y*w+x)*4+3],amount>0?Math.max(...values):Math.min(...values));
    }
  }
});
test('SVG clipped raster layers keep transparent pixels outside their base layer',async()=>{
  const d=createDocument(16,16);d.layers=[shape({width:8}),shape({color:'#0000ff',clipToBelow:true})];
  const {svg}=exportSvg(d,new Assets()),uri=svg.match(/href="(data:image\/png;base64,[^"]+)"/)[1],image=await loadImage(uri),c=createCanvas(16,16);c.getContext('2d').drawImage(image,0,0);
  assert.equal(pixel(c,4,4)[2],255);assert.equal(pixel(c,12,4)[3],0);
});
test('SVG uses wrapped text lines rather than overflowing the editable text frame',()=>{
  const d=createDocument(100,100);d.layers=[createLayer('text',{text:'A very long title',font:'Arial',fontSize:18,width:38,height:100,color:'#123456'})];
  const {svg}=exportSvg(d,new Assets());assert.ok((svg.match(/<tspan /g)||[]).length>=3);
});
