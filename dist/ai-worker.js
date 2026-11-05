// CPU-only ONNX inference. Models and runtime are served locally; pixels never leave the worker.
import * as ort from './vendor/ort/ort.wasm.min.mjs';
ort.env.wasm.wasmPaths=new URL('./vendor/ort/',import.meta.url).href;
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
const sessions=new Map();
let queue=Promise.resolve();
self.onmessage=event=>{queue=queue.then(()=>run(event.data)).catch(()=>{});};
async function run({id,mode,bitmap,category=15}){
  try{
    let task=sessions.get(mode);
    if(!task){
      self.postMessage({id,progress:'Loading on-device CPU model…'});
      task=await ort.InferenceSession.create(new URL(mode==='portrait'?'./ai/portrait.onnx':'./ai/objects.onnx',import.meta.url).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});sessions.set(mode,task);
    }
    self.postMessage({id,progress:'Finding your subject…'});
    const size=mode==='portrait'?256:513,c=new OffscreenCanvas(size,size),ctx=c.getContext('2d',{willReadFrequently:true});
    let fit={x:0,y:0,w:size,h:size};
    if(mode==='objects'){
      const scale=size/Math.max(bitmap.width,bitmap.height);fit.w=Math.round(bitmap.width*scale);fit.h=Math.round(bitmap.height*scale);fit.x=Math.floor((size-fit.w)/2);fit.y=Math.floor((size-fit.h)/2);ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);
    }
    ctx.drawImage(bitmap,fit.x,fit.y,fit.w,fit.h);
    const rgba=ctx.getImageData(0,0,size,size).data,plane=size*size;
    let input,tensor;
    if(mode==='portrait'){
      input=new Float32Array(plane*3);
      for(let i=0;i<plane;i++){input[i]=rgba[i*4]/255;input[plane+i]=rgba[i*4+1]/255;input[plane*2+i]=rgba[i*4+2]/255;}
      tensor=new ort.Tensor('float32',input,[1,3,size,size]);
    }else{
      input=new Uint8Array(plane*3);for(let i=0;i<plane;i++){input[i*3]=rgba[i*4];input[i*3+1]=rgba[i*4+1];input[i*3+2]=rgba[i*4+2];}
      tensor=new ort.Tensor('uint8',input,[1,size,size,3]);
    }
    const outputs=await task.run({[task.inputNames[0]]:tensor}),out=outputs[task.outputNames[0]],dims=out.dims,width=dims.at(-1),height=dims.at(-2),n=width*height;
    let values;
    if(mode==='portrait')values=new Float32Array(out.data);
    else{
      values=new Float32Array(n);for(let i=0;i<n;i++)values[i]=Number(out.data[i])===category?1:0;
      // A small feather softens semantic edges before the user's threshold control.
      const blurred=new Float32Array(n);for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0,count=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<width&&yy>=0&&yy<height){sum+=values[yy*width+xx];count++;}}blurred[y*width+x]=sum/count;}values=blurred;
      // Crop model letterboxing so the mask maps back to every source pixel.
      const croppedW=Math.max(1,Math.round(width*fit.w/size)),croppedH=Math.max(1,Math.round(height*fit.h/size)),cropped=new Float32Array(croppedW*croppedH);
      for(let y=0;y<croppedH;y++)for(let x=0;x<croppedW;x++){
        const sx=(fit.x+(x+.5)*fit.w/croppedW)/size*width-.5,sy=(fit.y+(y+.5)*fit.h/croppedH)/size*height-.5,x0=Math.max(0,Math.min(width-1,Math.floor(sx))),y0=Math.max(0,Math.min(height-1,Math.floor(sy))),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),dx=Math.max(0,sx-x0),dy=Math.max(0,sy-y0);
        cropped[y*croppedW+x]=(values[y0*width+x0]*(1-dx)+values[y0*width+x1]*dx)*(1-dy)+(values[y1*width+x0]*(1-dx)+values[y1*width+x1]*dx)*dy;
      }
      values=cropped;self.postMessage({id,width:croppedW,height:croppedH,values},[values.buffer]);return;
    }
    self.postMessage({id,width,height,values},[values.buffer]);
  }catch(error){console.error('AI worker:',error);self.postMessage({id,error:error.message||'AI could not process this image.',details:error.stack});}
  finally{bitmap?.close();}
}
