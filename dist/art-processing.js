import {artParams,isVectorArt} from './art-settings.js';
import {artRadius} from './art-pixels.js';
import {drawArtGeometry} from './art-vector.js';
export function crossfadeArt(original,styled,amount) {
  if(original.length!==styled.length)throw Error('Kích thước pha Art không khớp.');const a=Math.max(0,Math.min(1,amount));if(!a)return new Uint8ClampedArray(original);if(a===1)return new Uint8ClampedArray(styled);
  const out=new Uint8ClampedArray(original.length);
  for(let i=0;i<out.length;i+=4){const oa=original[i+3]/255*(1-a),sa=styled[i+3]/255*a,alpha=oa+sa;out[i+3]=alpha*255;for(let k=0;k<3;k++)out[i+k]=alpha?(original[i+k]*oa+styled[i+k]*sa)/alpha:original[i+k];}
  return out;
}
export function drawArtMix(target,original,styled,amount) {
  const x=target.getContext('2d');x.clearRect(0,0,target.width,target.height);x.save();
  x.globalAlpha=1-amount;x.drawImage(original,0,0,target.width,target.height);x.globalCompositeOperation='lighter';x.globalAlpha=amount;x.drawImage(styled,0,0,target.width,target.height);x.restore();return target;
}
export async function renderArtNative({image,params,geometry,palette,maskImage,processor,createCanvas,alive=()=>true,progress=()=>{},tileSize=768}) {
  const p=artParams(params),w=image.width,h=image.height,out=createCanvas(w,h),ox=out.getContext('2d');
  const check=()=>{if(!alive())throw new DOMException('Cancelled','AbortError');};check();
  if(!p.amount){ox.drawImage(image,0,0);return out;}
  if(isVectorArt(p)){if(!geometry)throw Error('Chưa có hình vector hiện tại.');drawArtGeometry(out,geometry);if(p.amount<100){const mixed=createCanvas(w,h);drawArtMix(mixed,image,out,p.amount/100);out.width=out.height=1;check();return mixed;}check();return out;}
  const halo=artRadius(p,w,h)*3+3,cols=Math.ceil(w/tileSize),rows=Math.ceil(h/tileSize);let count=0;
  for(let y=0;y<h;y+=tileSize)for(let x=0;x<w;x+=tileSize) {
    check();const l=Math.max(0,x-halo),t=Math.max(0,y-halo),r=Math.min(w,x+tileSize+halo),b=Math.min(h,y+tileSize+halo),c=createCanvas(r-l,b-t),cx=c.getContext('2d');cx.drawImage(image,l,t,c.width,c.height,0,0,c.width,c.height);
    const original=cx.getImageData(0,0,c.width,c.height).data;
    if(maskImage){cx.globalCompositeOperation='destination-in';cx.drawImage(maskImage,l/w*maskImage.width,t/h*maskImage.height,c.width/w*maskImage.width,c.height/h*maskImage.height,0,0,c.width,c.height);cx.globalCompositeOperation='source-over';}
    const input=cx.getImageData(0,0,c.width,c.height),result=await processor.run({task:'pixels',data:input.data,width:c.width,height:c.height,fullWidth:w,fullHeight:h,offsetX:l,offsetY:t,params:{...p,amount:100},palette});check();
    input.data.set(crossfadeArt(original,result.data,p.amount/100));cx.putImageData(input,0,0);const cw=Math.min(tileSize,w-x),ch=Math.min(tileSize,h-y);ox.drawImage(c,x-l,y-t,cw,ch,x,y,cw,ch);c.width=c.height=1;progress(++count,cols*rows);await new Promise(resolve=>setTimeout(resolve,0));
  }
  return out;
}
