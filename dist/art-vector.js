import {artParams,isVectorArt} from './art-settings.js';
import {artPalette,paletteLookup,paletteIndex,luminance,clamp,hex,rgb} from './art-pixels.js';
const MAX_MARKS=250000;
const random=(x,y,s)=>{const v=Math.sin(x*127.1+y*311.7+s*17.2)*43758.5453;return v-Math.floor(v);};
function sampler(data,w,h) {
  const stride=w+1,planes=Array.from({length:4},()=>new Float64Array((w+1)*(h+1)));
  for(let y=0;y<h;y++){const sums=[0,0,0,0];for(let x=0;x<w;x++){const i=(y*w+x)*4,a=data[i+3]/255;for(let k=0;k<4;k++){sums[k]+=k===3?a:data[i+k]*a;planes[k][(y+1)*stride+x+1]=planes[k][y*stride+x+1]+sums[k];}}}
  return (x,y,r)=>{
    const l=clamp(Math.floor(x-r),0,w),t=clamp(Math.floor(y-r),0,h),rr=clamp(Math.ceil(x+r),0,w),b=clamp(Math.ceil(y+r),0,h),area=(rr-l)*(b-t);if(!area)return[0,0,0,0];
    const v=planes.map(p=>p[b*stride+rr]-p[t*stride+rr]-p[b*stride+l]+p[t*stride+l]);return v[3]>.001?[...v.slice(0,3).map(a=>a/v[3]),v[3]/area]:[0,0,0,0];
  };
}
export function buildArtGeometry({data,width:w,height:h,params={}}) {
  const p=artParams(params);if(!isVectorArt(p)||data.length!==w*h*4)throw Error('Ảnh / kiểu vector không hợp lệ.');
  const palette=artPalette(data,p.colors),lut=paletteLookup(palette);
  if(p.mode==='trace')return traceArt(data,w,h,p,palette,lut);
  const get=sampler(data,w,h),cell=Math.min(w,h)/p.density,a=p.angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a),cx=w/2,cy=h/2;
  const corners=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>[(x-cx)*co+(y-cy)*si,-(x-cx)*si+(y-cy)*co]);
  const left=Math.floor(Math.min(...corners.map(q=>q[0]))/cell)-1,right=Math.ceil(Math.max(...corners.map(q=>q[0]))/cell)+1,top=Math.floor(Math.min(...corners.map(q=>q[1]))/cell)-1,bottom=Math.ceil(Math.max(...corners.map(q=>q[1]))/cell)+1;
  if((right-left)*(bottom-top)>MAX_MARKS)throw Error('Lưới pattern có quá nhiều hạt. Giảm Mật độ để tạo / xuất.');
  const marks=[];
  for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++) {
    const j=p.jitter/100,u=(col+.5+(random(col,row,p.seed)-.5)*j)*cell,v=(row+.5+(random(row,col,p.seed+1)-.5)*j)*cell,x=cx+u*co-v*si,y=cy+u*si+v*co;
    if(x<0||y<0||x>w||y>h)continue;const rgba=get(x,y,cell*.45);if(rgba[3]<.08)continue;
    let tone=p.tone==='silhouette'||['pixel','voxel'].includes(p.mode)?1:luminance(...rgba)/255;if(p.tone==='dark'&&!['pixel','voxel'].includes(p.mode))tone=1-tone;tone=clamp((tone-.5)*(1+p.contrast/100)+.5,0,1);
    tone=clamp((tone-p.threshold/100)/Math.max(.05,1-p.threshold/100),0,1)**p.gamma;if(tone<.012)continue;
    const solid=['pixel','voxel','silhouette'].includes(p.mode),size=cell*p.size/100*(solid?1:Math.sqrt(tone)),fill=p.colorMode==='mono'?p.ink:p.colorMode==='palette'?hex(palette[paletteIndex(lut,...rgba)]):hex(rgba);
    marks.push({shape:p.mode,x,y,size,cell,fill,alpha:solid?clamp((rgba[3]-.08)/.5,0,1):rgba[3],angle:p.angle,depth:p.depth});
  }
  return {width:w,height:h,marks,palette:palette.map(hex),background:p.background==='paper'?p.paper:null,mode:p.mode};
}
function signedArea(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}return sum/2;}
function simplifyOpen(points,tol) {
  if(points.length<4||!tol)return points;const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]],t2=tol*tol;
  while(stack.length){const [a,b]=stack.pop(),[x,y]=points[a],dx=points[b][0]-x,dy=points[b][1]-y,len=dx*dx+dy*dy;let best=-1,dist=t2;
    for(let i=a+1;i<b;i++){const px=points[i][0]-x,py=points[i][1]-y,t=len?clamp((px*dx+py*dy)/len,0,1):0,d=(px-t*dx)**2+(py-t*dy)**2;if(d>dist){dist=d;best=i;}}
    if(best>=0){keep[best]=1;stack.push([a,best],[best,b]);}
  }
  return points.filter((_,i)=>keep[i]);
}
function simplifyClosed(points,tol) {
  let far=1,distance=0;for(let i=1;i<points.length;i++){const d=(points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2;if(d>distance){distance=d;far=i;}}
  const a=simplifyOpen(points.slice(0,far+1),tol),b=simplifyOpen([...points.slice(far),points[0]],tol);return [...a.slice(0,-1),...b.slice(0,-1)];
}
function traceArt(data,w,h,p,palette,lut) {
  const scale=Math.min(1,p.detail/Math.max(w,h)),tw=Math.max(1,Math.round(w*scale)),th=Math.max(1,Math.round(h*scale)),labels=new Int16Array(tw*th).fill(-1),get=sampler(data,w,h);
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const c=get((x+.5)/scale,(y+.5)/scale,(.5+p.smooth/100*2)/scale);if(c[3]>.3)labels[y*tw+x]=paletteIndex(lut,...c);}
  // Merge tiny color islands into a surrounding color before outlining. Dropping
  // their paths afterwards would punch unwanted transparent holes in the art.
  const visited=new Uint8Array(labels.length),queue=new Int32Array(labels.length);
  for(let start=0;start<labels.length;start++) {
    if(labels[start]<0||visited[start])continue;const color=labels[start],border=new Uint32Array(palette.length);let head=0,tail=1;queue[0]=start;visited[start]=1;
    while(head<tail){const i=queue[head++],x=i%tw,y=Math.floor(i/tw);for(const j of[x?i-1:-1,x<tw-1?i+1:-1,y?i-tw:-1,y<th-1?i+tw:-1]){if(j<0||labels[j]<0)continue;if(labels[j]===color){if(!visited[j]){visited[j]=1;queue[tail++]=j;}}else border[labels[j]]++;}}
    if(tail<=p.speckle&&border.some(v=>v>0)){let best=0;for(let i=1;i<border.length;i++)if(border[i]>border[best])best=i;for(let i=0;i<tail;i++)labels[queue[i]]=best;}
  }
  const marks=[];let totalVertices=0;
  for(let color=0;color<palette.length;color++) {
    const edges=new Map(),stride=tw+1;let count=0;
    const add=(a,b,dir)=>{const list=edges.get(a)||[];list.push({b,dir});edges.set(a,list);count++;};
    for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const i=y*tw+x;if(labels[i]!==color)continue;const a=y*stride+x;
      if(y===0||labels[i-tw]!==color)add(a,a+1,0);if(x===tw-1||labels[i+1]!==color)add(a+1,a+stride+1,1);
      if(y===th-1||labels[i+tw]!==color)add(a+stride+1,a+stride,2);if(x===0||labels[i-1]!==color)add(a+stride,a,3);
    }
    if((totalVertices+=count)>2000000)throw Error('Vector có quá nhiều biên. Giảm Chi tiết hoặc Số màu.');
    const polygons=[];
    for(const [start,initial]of edges)while(initial.length) {
      const points=[];let current=start,dir=initial[0].dir,guard=0;
      do {points.push([current%stride,Math.floor(current/stride)]);const list=edges.get(current);if(!list?.length)break;
        const order=[(dir+1)%4,dir,(dir+3)%4,(dir+2)%4];let index=order.map(d=>list.findIndex(e=>e.dir===d)).find(i=>i>=0),edge=list.splice(index??0,1)[0];current=edge.b;dir=edge.dir;
      } while(current!==start&&++guard<=count);
      if(current===start&&points.length>=4&&Math.abs(signedArea(points))>=.5){const q=simplifyClosed(points,p.smooth/100*1.2);if(q.length>=3)polygons.push(q.map(([x,y])=>[x*w/tw,y*h/th]));}
    }
    if(polygons.length)marks.push({shape:'path',fill:hex(palette[color]),alpha:1,polygons});
  }
  return {width:w,height:h,marks,palette:palette.map(hex),background:p.background==='paper'?p.paper:null,mode:p.mode};
}
function glyph(ctx,m) {
  const s=m.size,h=s/2;ctx.beginPath();
  if(m.shape==='dots')ctx.ellipse(0,0,h,h,0,0,Math.PI*2);
  else if(['square','pixel','silhouette','voxel'].includes(m.shape))ctx.rect(-h,-h,s,s);
  else if(m.shape==='cross'){const t=s*.14;ctx.moveTo(-t,-h);for(const q of[[t,-h],[t,-t],[h,-t],[h,t],[t,t],[t,h],[-t,h],[-t,t],[-h,t],[-h,-t],[-t,-t]])ctx.lineTo(...q);ctx.closePath();}
  else if(m.shape==='line')ctx.rect(-m.cell/2,-s*.25,m.cell,s*.5);
  else if(m.shape==='ring'){ctx.ellipse(0,0,h,h,0,0,Math.PI*2);ctx.ellipse(0,0,h*.54,h*.54,0,0,Math.PI*2,true);}
  else {const count=m.shape==='triangle'?3:m.shape==='hex'?6:4;for(let i=0;i<count;i++){const a=i*2*Math.PI/count-Math.PI/2;i?ctx.lineTo(Math.cos(a)*h,Math.sin(a)*h):ctx.moveTo(Math.cos(a)*h,Math.sin(a)*h);}ctx.closePath();}
}
export function drawArtGeometry(target,g) {
  const ctx=target.getContext('2d');ctx.save();ctx.scale(target.width/g.width,target.height/g.height);
  if(g.background){ctx.fillStyle=g.background;ctx.fillRect(0,0,g.width,g.height);}
  for(const m of g.marks){ctx.save();ctx.globalAlpha=m.alpha;ctx.fillStyle=m.fill;
    if(m.shape==='path'){ctx.beginPath();for(const points of m.polygons){points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}ctx.fill('evenodd');}
    else {ctx.translate(m.x,m.y);ctx.rotate(m.angle*Math.PI/180);
      if(m.shape==='voxel'){const d=m.cell*m.depth/100*.65,h=m.size/2,base=rgb(m.fill);ctx.fillStyle=hex(base.map(v=>v*.46));ctx.beginPath();ctx.moveTo(-h,h);ctx.lineTo(h,h);ctx.lineTo(h+d,h+d*.65);ctx.lineTo(-h+d,h+d*.65);ctx.closePath();ctx.fill();ctx.fillStyle=hex(base.map(v=>v*.72));ctx.beginPath();ctx.moveTo(h,-h);ctx.lineTo(h+d,-h+d*.65);ctx.lineTo(h+d,h+d*.65);ctx.lineTo(h,h);ctx.closePath();ctx.fill();ctx.fillStyle=m.fill;}
      glyph(ctx,m);ctx.fill('evenodd');
    }ctx.restore();
  }ctx.restore();return target;
}
const num=v=>Number(v.toFixed(3)),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function artSVG(g,{width=g.width,height=g.height,params}={}) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Kích thước SVG không hợp lệ.');if(params)artParams(params);
  const paths=[];
  for(const m of g.marks){const fill=escape(m.fill),opacity=num(m.alpha),s=num(m.size||0),h=num(s/2);let shape='';
    if(m.shape==='path'){const d=m.polygons.map(q=>q.map(([x,y],i)=>(i?'L':'M')+num(x)+' '+num(y)).join('')+'Z').join('');paths.push(`<path fill="${fill}" fill-rule="evenodd" d="${d}"/>`);continue;}
    if(m.shape==='dots')shape=`<circle r="${h}"/>`;
    else if(m.shape==='ring')shape=`<circle r="${num(s*.385)}" fill="none" stroke="${fill}" stroke-width="${num(s*.23)}"/>`;
    else if(m.shape==='line')shape=`<rect x="${num(-m.cell/2)}" y="${num(-s*.25)}" width="${num(m.cell)}" height="${num(s*.5)}"/>`;
    else if(['square','pixel','silhouette','voxel'].includes(m.shape)){shape=`<rect x="${-h}" y="${-h}" width="${s}" height="${s}"/>`;if(m.shape==='voxel'){const d=m.cell*m.depth/100*.65,base=rgb(m.fill);shape=`<path fill="${hex(base.map(v=>v*.46))}" d="M${-h} ${h}H${h}L${num(h+d)} ${num(h+d*.65)}H${num(-h+d)}Z"/><path fill="${hex(base.map(v=>v*.72))}" d="M${h} ${-h}L${num(h+d)} ${num(-h+d*.65)}V${num(h+d*.65)}L${h} ${h}Z"/>`+shape;}}
    else if(m.shape==='cross'){const t=num(s*.14);shape=`<path d="M${-t} ${-h}H${t}V${-t}H${h}V${t}H${t}V${h}H${-t}V${t}H${-h}V${-t}H${-t}Z"/>`;}
    else{const count=m.shape==='triangle'?3:m.shape==='hex'?6:4,pts=Array.from({length:count},(_,i)=>{const a=i*2*Math.PI/count-Math.PI/2;return num(Math.cos(a)*h)+','+num(Math.sin(a)*h);}).join(' ');shape=`<polygon points="${pts}"/>`;}
    paths.push(`<g fill="${fill}" opacity="${opacity}" transform="translate(${num(m.x)} ${num(m.y)}) rotate(${num(m.angle)})">${shape}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${g.width} ${g.height}"><title>Luma Art · ${escape(g.mode)}</title><metadata>${escape(JSON.stringify({creator:'Larx Vo',website:'https://vovinhlac.com',software:'Luma Studio',format:'luma-art-svg',version:1,params:params||null}))}</metadata>${g.background?`<rect width="100%" height="100%" fill="${escape(g.background)}"/>`:''}${paths.join('')}</svg>`;
}
