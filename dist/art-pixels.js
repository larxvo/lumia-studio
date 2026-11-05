import {artParams} from './art-settings.js';
export const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
export const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export const hex=c=>'#'+c.slice(0,3).map(v=>Math.round(clamp(v)).toString(16).padStart(2,'0')).join('');
function check(data,w,h){if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||data.length!==w*h*4)throw Error('Dữ liệu ảnh Art không hợp lệ.');}
// Population-weighted median cut. Palette analysis stays small and deterministic.
export function artPalette(data,count=8) {
  const bins=new Map();
  for(let i=0;i<data.length;i+=Math.max(4,Math.floor(data.length/120000/4)*4)) {
    if(data[i+3]<24)continue;const key=(data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3),v=bins.get(key)||{c:[0,0,0],n:0};
    for(let j=0;j<3;j++)v.c[j]+=data[i+j];v.n++;bins.set(key,v);
  }
  let boxes=[[...bins.values()].map(v=>({c:v.c.map(x=>x/v.n),n:v.n}))];if(!boxes[0].length)return [[127,127,127]];
  const span=b=>[0,1,2].map(k=>Math.max(...b.map(v=>v.c[k]))-Math.min(...b.map(v=>v.c[k])));
  while(boxes.length<count) {
    let best=-1,axis=0,score=0;
    boxes.forEach((b,i)=>{if(b.length<2)return;const ranges=span(b),a=ranges.indexOf(Math.max(...ranges)),s=ranges[a]*Math.sqrt(b.reduce((n,v)=>n+v.n,0));if(s>score){score=s;best=i;axis=a;}});
    if(best<0)break;const b=boxes.splice(best,1)[0].sort((a,b)=>a.c[axis]-b.c[axis]),total=b.reduce((n,v)=>n+v.n,0);let sum=0,j=0;
    while(j<b.length-1&&sum<total/2)sum+=b[j++].n;j=Math.max(1,Math.min(b.length-1,j));boxes.push(b.slice(0,j),b.slice(j));
  }
  return boxes.map(b=>{const n=b.reduce((n,v)=>n+v.n,0);return [0,1,2].map(k=>Math.round(b.reduce((s,v)=>s+v.c[k]*v.n,0)/n));}).sort((a,b)=>luminance(...a)-luminance(...b));
}
export function paletteLookup(palette) {
  const lut=new Uint8Array(32768);
  for(let r=0;r<32;r++)for(let g=0;g<32;g++)for(let b=0;b<32;b++) {let best=0,d=Infinity;palette.forEach((c,i)=>{const q=(c[0]-r*8-4)**2*.8+(c[1]-g*8-4)**2+(c[2]-b*8-4)**2*.7;if(q<d){best=i;d=q;}});lut[r*1024+g*32+b]=best;}
  return lut;
}
export const paletteIndex=(lut,r,g,b)=>lut[(clamp(r)>>3)*1024+(clamp(g)>>3)*32+(clamp(b)>>3)];
export function boxBlur(a,w,h,r) {
  if(r<1)return new Float32Array(a);const tmp=new Float32Array(a.length),out=new Float32Array(a.length);
  for(let y=0;y<h;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*w+clamp(x,0,w-1)];for(let x=0;x<w;x++){tmp[y*w+x]=s/(2*r+1);s+=a[y*w+clamp(x+r+1,0,w-1)]-a[y*w+clamp(x-r,0,w-1)];}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[clamp(y,0,h-1)*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/(2*r+1);s+=tmp[clamp(y+r+1,0,h-1)*w+x]-tmp[clamp(y-r,0,h-1)*w+x];}}
  return out;
}
export function artRadius(p,w,h){return Math.max(1,Math.round((1+p.smooth*.06)*Math.max(w,h)/1024));}
function noise(x,y){const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);}
export function renderArtPixels({data,width:w,height:h,fullWidth=w,fullHeight=h,offsetX=0,offsetY=0,params={},palette}) {
  check(data,w,h);const p=artParams(params),out=new Uint8ClampedArray(data);if(!p.amount)return {data:out,width:w,height:h};
  const n=w*h,r=artRadius(p,fullWidth,fullHeight),alpha=Float32Array.from({length:n},(_,i)=>data[i*4+3]/255),weight=boxBlur(alpha,w,h,r),channels=[];
  for(let k=0;k<3;k++){const raw=Float32Array.from(alpha,(a,i)=>data[i*4+k]*a),blur=boxBlur(raw,w,h,r);channels.push(Float32Array.from(blur,(v,i)=>weight[i]>.0001?v/weight[i]:data[i*4+k]));}
  const lum=Float32Array.from(alpha,(_,i)=>luminance(channels[0][i],channels[1][i],channels[2][i])),blurLum=p.mode==='pencil'?boxBlur(lum,w,h,r*2):null;
  palette||=artPalette(data,p.colors);const lut=paletteLookup(palette),angle=p.light*Math.PI/180,light=[Math.cos(angle)*.65,Math.sin(angle)*.65,.76],amount=p.amount/100;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const i=y*w+x,k=i*4;if(!data[k+3])continue;const src=[data[k],data[k+1],data[k+2]],a=lum[y*w+Math.max(0,x-1)],b=lum[y*w+Math.min(w-1,x+1)],c=lum[Math.max(0,y-1)*w+x],d=lum[Math.min(h-1,y+1)*w+x],dx=(b-a)/2,dy=(d-c)/2,edge=clamp(Math.hypot(dx,dy)/58,0,1);
    let col=channels.map((c,j)=>src[j]+(c[i]-src[j])*p.smooth/100*(1-edge*.8)),quant=palette[paletteIndex(lut,...col)],Y=lum[i];
    if(p.mode==='poster'||p.mode==='comic'){col=quant.slice();if(p.mode==='comic'){const ink=clamp((edge-.07)*p.edges/100*1.8,0,.94);col=col.map(v=>v*(1-ink));}}
    else if(p.mode==='watercolor'){const grain=(noise((x+offsetX)/Math.max(1,fullWidth/1024),(y+offsetY)/Math.max(1,fullWidth/1024))-.5)*p.texture*.22;col=col.map((v,j)=>v*.65+quant[j]*.35+(255-v)*.10+grain-edge*p.edges*.22);}
    else if(p.mode==='pencil'){const line=clamp(Y*255/Math.max(1,blurLum[i])),tone=clamp(255-(255-line)*(1+p.edges*.05)-edge*p.edges*.8);const grain=(noise(x+offsetX,y+offsetY)-.5)*p.texture*.18;col=[tone+grain,tone+grain,tone*.985+grain];}
    else if(p.mode==='relief'){const z=p.depth*.06,nx=-dx/20*z,ny=-dy/20*z,len=Math.hypot(nx,ny,1),diff=Math.max(0,(nx*light[0]+ny*light[1]+light[2])/len),spec=Math.pow(Math.max(0,(nx*light[0]+ny*light[1]+1.76)/(len*1.96)),16)*p.metal*.95;col=col.map(v=>v*(.34+diff*.9)+spec);}
    col=col.map(v=>clamp((v-128)*(1+p.contrast/180)+128));for(let j=0;j<3;j++)out[k+j]=src[j]+(col[j]-src[j])*amount;
  }
  return {data:out,width:w,height:h};
}
