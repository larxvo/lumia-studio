import {compositeSceneEffects} from './scene-compositor.js';
// Analysis stays small; native rendering works in overlapping tiles, independent
// of compressed file size. Halos keep sharpen/blur and leaf trails continuous.
export async function renderSceneNative({image,params,regions,atlas,processor,createCanvas,alive=()=>true,progress=()=>{},tileSize=768}){
 const w=image.width,h=image.height,out=createCanvas(w,h),ox=out.getContext('2d');
 const particles=params.leaves||params.snow,extent=Math.max(params.leaves?(params.leafSize??5)/100*.72:0,params.snow ? .009 : 0);
 const halo=particles?Math.ceil(3+Math.min(w,h)*(extent+(params.depth??55)/100*.012+(params.motion??35)/100*.018)):2,cols=Math.ceil(w/tileSize),rows=Math.ceil(h/tileSize);let count=0;
 for(let y=0;y<h;y+=tileSize)for(let x=0;x<w;x+=tileSize){if(!alive())throw new DOMException('Cancelled','AbortError');const left=Math.max(0,x-halo),top=Math.max(0,y-halo),right=Math.min(w,x+tileSize+halo),bottom=Math.min(h,y+tileSize+halo),c=createCanvas(right-left,bottom-top),cx=c.getContext('2d');cx.drawImage(image,left,top,c.width,c.height,0,0,c.width,c.height);const result=await processor.run({data:cx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height,fullWidth:w,fullHeight:h,offsetX:left,offsetY:top,params,regions});if(!alive())throw new DOMException('Cancelled','AbortError');const px=cx.createImageData(c.width,c.height);px.data.set(result.data);cx.putImageData(px,0,0);compositeSceneEffects(c,{params,regions,atlas,offsetX:left,offsetY:top,fullWidth:w,fullHeight:h,createCanvas});const cw=Math.min(tileSize,w-x),ch=Math.min(tileSize,h-y);ox.drawImage(c,x-left,y-top,cw,ch,x,y,cw,ch);c.width=c.height=1;progress(++count,cols*rows);await new Promise(resolve=>setTimeout(resolve,0));}
 return out;
}
