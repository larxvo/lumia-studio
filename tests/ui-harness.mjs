// DOM + native Canvas integration, not a browser or visual screenshot test.
import {parseHTML} from 'linkedom';
import {createCanvas,Image,GlobalFonts} from '@napi-rs/canvas';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {indexedDB} from 'fake-indexeddb';

export async function setupDOM(){
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const {window,document}=parseHTML(html),native=new WeakMap();
  const getCanvas=el=>{let c=native.get(el);if(!c){c=createCanvas(el.width,el.height);native.set(el,c);}return c;};
  const cp=window.HTMLCanvasElement.prototype;
  Object.defineProperties(cp,{width:{get(){return Number(this.getAttribute('width')||300);},set(v){this.setAttribute('width',String(v));if(native.has(this))native.get(this).width=Number(v);}},height:{get(){return Number(this.getAttribute('height')||150);},set(v){this.setAttribute('height',String(v));if(native.has(this))native.get(this).height=Number(v);}}});
  cp.getContext=function(kind,options){const ctx=getCanvas(this).getContext(kind,options);return new Proxy(ctx,{get(target,key){if(key==='drawImage'||key==='createPattern')return (image,...args)=>target[key](native.has(image)?getCanvas(image):image,...args);const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});};
  cp.toDataURL=function(...args){return getCanvas(this).toDataURL(...args);};
  cp.toBlob=function(callback,type='image/png',quality=.92){const nativeCanvas=getCanvas(this);const format=type==='image/jpeg'?'image/jpeg':type==='image/webp'?'image/webp':'image/png';callback(new Blob([nativeCanvas.toBuffer(format,format==='image/png'?undefined:quality*100)],{type:format}));};
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){const selected=this.querySelector('option[selected]')||this.querySelector('option');return selected?.getAttribute('value')??selected?.textContent??'';},set(v){for(const o of this.querySelectorAll('option')){if((o.getAttribute('value')??o.textContent)===String(v))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
  Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{get(){return this.id==='stage'?1080:this.id==='curve'?255:240;}},clientHeight:{get(){return this.id==='stage'?710:this.id==='curve'?160:30;}},offsetWidth:{get(){return this.clientWidth;}},offsetHeight:{get(){return this.clientHeight;}}});
  window.HTMLElement.prototype.getBoundingClientRect=function(){const width=this.clientWidth,height=this.clientHeight;return {left:0,top:0,right:width,bottom:height,width,height};};
  window.HTMLElement.prototype.setPointerCapture=function(){};window.HTMLElement.prototype.releasePointerCapture=function(){};
  const dialog=document.querySelector('#modal');Object.defineProperty(dialog,'open',{get(){return this.hasAttribute('open');}});dialog.showModal=function(){this.setAttribute('open','');};dialog.close=function(){this.removeAttribute('open');};
  Object.defineProperty(document,'fonts',{value:{ready:Promise.resolve()}});
  class DOMImage extends Image {set src(value){super.src=value.startsWith('assets/')?path.resolve('dist',value):value;}get src(){return super.src;}}
  Object.assign(globalThis,{window,document,Image:DOMImage,indexedDB,devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame:callback=>setTimeout(()=>callback(Date.now()),1),cancelAnimationFrame:clearTimeout});
  window.innerWidth=1440;window.innerHeight=900;window.getSelection=()=>({removeAllRanges(){},addRange(){}});
  GlobalFonts.registerFromPath(path.resolve('dist/assets/InterVariable.woff2'),'Inter');
  return {window,document};
}
export const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
