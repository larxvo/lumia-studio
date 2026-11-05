import {canvas} from './renderer.js';
let worker=null,sequence=0,pending=new Map();
function getWorker(){
  if(worker)return worker;
  worker=new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    const job=pending.get(data.id);if(!job)return;
    if(data.progress){job.onProgress?.(data.progress);return;}
    clearTimeout(job.timer);pending.delete(data.id);
    if(data.error){console.error(data.details);job.reject(new Error(data.error));}else job.resolve(data);
  };
  worker.onerror=()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('On-device AI could not start. Try a current Chrome or Edge browser.'));}pending.clear();worker?.terminate();worker=null;};
  return worker;
}
export async function segmentImage(image,{mode='portrait',category=15,onProgress,signal}={}){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const limit=1024,scale=Math.min(1,limit/Math.max(image.width,image.height)),small=canvas(image.width*scale,image.height*scale);
  small.getContext('2d').drawImage(image,0,0,small.width,small.height);
  const blob=await new Promise(r=>small.toBlob(r,'image/png'));
  const bitmap=await createImageBitmap(blob),id=++sequence;
  const result=await new Promise((resolve,reject)=>{
    const w=getWorker();
    const abort=()=>{const job=pending.get(id);if(job){clearTimeout(job.timer);pending.delete(id);worker?.terminate();worker=null;reject(new DOMException('Cancelled','AbortError'));}};
    signal?.addEventListener('abort',abort,{once:true});
    const clean=fn=>v=>{signal?.removeEventListener('abort',abort);fn(v);};
    const timer=setTimeout(()=>{pending.delete(id);worker?.terminate();worker=null;signal?.removeEventListener('abort',abort);reject(new Error('AI took too long. Try a smaller image or another browser.'));},90000);
    pending.set(id,{resolve:clean(resolve),reject:clean(reject),timer,onProgress});
    w.postMessage({id,mode,category,bitmap},[bitmap]);
  });
  return result;
}
export function confidenceMask({width,height,values},threshold=.5,softness=.12){
  const c=canvas(width,height),ctx=c.getContext('2d'),pixels=ctx.createImageData(width,height);let selected=0;
  for(let i=0;i<values.length;i++){
    const v=Math.max(0,Math.min(1,(values[i]-(threshold-softness))/Math.max(.01,softness*2))),a=v*v*(3-2*v);
    pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=Math.round(a*255);selected+=a;
  }
  ctx.putImageData(pixels,0,0);return {canvas:c,coverage:selected/values.length};
}
