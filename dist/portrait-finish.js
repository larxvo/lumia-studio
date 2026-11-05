import {boxBlur} from './filters.js';
import {limit,polygon} from './face-geometry.js';
import {fillPolygon} from './portrait-masks.js';
const light=(a,k)=>.2126*a[k]+.7152*a[k+1]+.0722*a[k+2];
const step=(a,b,x)=>{const t=limit((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Estimate broad specular residual in protected skin; retain source pore detail.
// Normalized convolution excludes hair/eyes/background from the diffuse estimate.
export function portraitShine(source,w,h,skin,face,amount=0,sensitivity=50){
 const out=new Uint8ClampedArray(source),mask=new Float32Array(w*h);
 if(!amount||!face)return {data:out,mask,count:0,meanReduction:0};
 const radius=Math.max(3,Math.round(face.box.width*w*.12)),weighted=new Uint8ClampedArray(source.length),coverageBytes=new Uint8ClampedArray(source.length);
 for(let i=0;i<skin.length;i++){const a=skin[i]*(source[i*4+3]/255);for(let c=0;c<3;c++)weighted[i*4+c]=source[i*4+c]*a;weighted[i*4+3]=a*255;coverageBytes[i*4]=skin[i]*255;}
 const base=boxBlur(weighted,w,h,radius),fine=boxBlur(source,w,h,Math.max(1,Math.round(face.box.width*w*.005))),edge=boxBlur(coverageBytes,w,h,Math.max(1,Math.round(face.box.width*w*.014))),field=new Uint8ClampedArray(source.length);
 const threshold=13-limit(sensitivity,0,100)*.095;let count=0,total=0;
 for(let i=0;i<skin.length;i++){const k=i*4,coverage=base[k+3]/255;if(!skin[i]||coverage<.04||!source[k+3])continue;
  const L=light(fine,k),B=light(base,k)/coverage,excess=L-B,sat=Math.max(fine[k],fine[k+1],fine[k+2])-Math.min(fine[k],fine[k+1],fine[k+2]),baseSat=(Math.max(base[k],base[k+1],base[k+2])-Math.min(base[k],base[k+1],base[k+2]))/coverage;
  const neutral=1-step(baseSat+5,baseSat+38,sat),gate=step(70,150,L)*step(threshold,threshold+14,excess)*neutral;
  field[k]=Math.min(48,Math.max(0,excess-threshold*.4)*.85)*gate*step(.04,.4,coverage)*4;
 }
 const smooth=boxBlur(field,w,h,Math.max(1,Math.round(face.box.width*w*.009)));
 for(let i=0;i<skin.length;i++){const k=i*4,reduction=smooth[k]/4*skin[i]*step(0,245,edge[k])*limit(amount/100,0,1);if(reduction<.02||!source[k+3])continue;for(let c=0;c<3;c++)out[k+c]=source[k+c]-reduction;mask[i]=reduction/48;count++;total+=reduction;}
 return {data:out,mask,count,meanReduction:count?total/count:0};
}
// Feather inward; shift real dark strands rather than painting flat brow skin.
export function adjustBrows(source,w,h,face,amount){
 if(!amount||!face)return new Uint8ClampedArray(source);
 const hard=new Float32Array(w*h),bytes=new Uint8ClampedArray(source.length);for(const name of ['leftBrow','rightBrow'])fillPolygon(hard,w,h,polygon(face,name,w,h));for(let i=0;i<hard.length;i++)for(let c=0;c<4;c++)bytes[i*4+c]=hard[i]*255;
 const feather=boxBlur(bytes,w,h,Math.max(1,Math.round(face.box.width*w*.008))),local=boxBlur(source,w,h,Math.max(3,Math.round(face.box.width*w*.045))),out=new Uint8ClampedArray(source);
 for(let i=0;i<hard.length;i++){const k=i*4;if(!hard[i]||!source[k+3])continue;const dark=light(local,k)-light(source,k),a=hard[i]*step(0,220,feather[k])*step(2,18,dark)*Math.abs(amount)/100,shift=amount>0?-Math.min(42,light(source,k)*.36):Math.min(42,Math.max(0,dark)*.7);for(let c=0;c<3;c++)out[k+c]=source[k+c]+shift*a;}return out;
}
