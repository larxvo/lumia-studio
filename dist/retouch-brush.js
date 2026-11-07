const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
function meanRing(data,w,h,x,y,r) {
  const sum=[0,0,0];let weight=0;
  for(const radius of [.6,.85,1.1])for(let n=0;n<16;n++){
    const a=n*Math.PI/8,xx=Math.round(x+Math.cos(a)*r*radius),yy=Math.round(y+Math.sin(a)*r*radius);
    if(xx<0||xx>=w||yy<0||yy>=h)continue;
    const i=(yy*w+xx)*4,k=data[i+3]/255;weight+=k;for(let c=0;c<3;c++)sum[c]+=data[i+c]*k;
  }
  return weight?sum.map(v=>v/weight):[0,0,0];
}
export function retouchPatch({patch,source,width,height,left,top,point,radius,hardness,strength,tool,offset={x:0,y:0},selection=null,range='all'}) {
  const delta=tool==='heal'?(()=>{const a=meanRing(source,width,height,point.x,point.y,radius),b=meanRing(source,width,height,point.x+offset.x,point.y+offset.y,radius);return a.map((v,k)=>v-b[k]);})():[0,0,0];
  for(let y=0;y<patch.height;y++)for(let x=0;x<patch.width;x++){
    const gx=left+x,gy=top+y,dist=Math.hypot(gx+.5-point.x,gy+.5-point.y)/radius;
    if(dist>=1)continue;
    const sx=tool==='clone'||tool==='heal'?Math.round(gx+offset.x):gx,sy=tool==='clone'||tool==='heal'?Math.round(gy+offset.y):gy;
    if(sx<0||sx>=width||sy<0||sy>=height)continue;
    const src=(sy*width+sx)*4,dst=(gy*width+gx)*4,i=(y*patch.width+x)*4;
    const fall=dist<hardness?1:((1-dist)/Math.max(.001,1-hardness))**2;
    const lum=(source[src]*.2126+source[src+1]*.7152+source[src+2]*.0722)/255;
    const weight=range==='shadows'?(1-lum)**2:range==='highlights'?lum**2:range==='midtones'?Math.sin(lum*Math.PI)**2:1;
    const alpha=fall*strength*(selection?selection[dst+3]/255:1)*source[src+3]/255*((tool==='dodge'||tool==='burn')?weight:1);
    if(!alpha)continue;
    const old=patch.data[i+3]/255,out=alpha+old*(1-alpha);
    for(let k=0;k<3;k++){
      let value=source[src+k];
      if(tool==='heal')value=clamp(value+delta[k]);
      if(tool==='dodge')value=255*(value/255)**.72;
      if(tool==='burn')value=255*(value/255)**1.4;
      patch.data[i+k]=(value*alpha+patch.data[i+k]*old*(1-alpha))/(out||1);
    }
    patch.data[i+3]=out*255;
  }
  return patch;
}
