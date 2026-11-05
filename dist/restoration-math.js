import {labToRgb,rgbToLightness} from './colorization-math.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function pixels(data,w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||data.length!==w*h*4)throw Error('Dữ liệu ảnh xử lý không hợp lệ.');}
export function affineFromPairs(source,target){
 if(source.length!==3||target.length!==3||[...source,...target].some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Chọn đủ ba cặp điểm tương ứng.');
 const [p,q,r]=source,det=(q.x-p.x)*(r.y-p.y)-(r.x-p.x)*(q.y-p.y),span=Math.max(1,...source.flatMap(a=>source.map(b=>Math.hypot(a.x-b.x,a.y-b.y))));
 if(Math.abs(det)<span*span*.002)throw Error('Ba điểm quá gần hoặc thẳng hàng. Chọn tam giác rộng.');
 const fit=k=>{const u=target[1][k]-target[0][k],v=target[2][k]-target[0][k],a=(u*(r.y-p.y)-v*(q.y-p.y))/det,b=((q.x-p.x)*v-(r.x-p.x)*u)/det;return[a,b,target[0][k]-a*p.x-b*p.y];};
 const x=fit('x'),y=fit('y'),m=[x[0],y[0],x[1],y[1],x[2],y[2]];if(Math.abs(m[0]*m[3]-m[1]*m[2])<1e-5)throw Error('Căn chỉnh bị suy biến. Chọn lại điểm đích.');return m;
}
export function featherMask(mask,w,h,radius=0){
 if(mask.length!==w*h||!Number.isFinite(radius)||radius<0||radius>100)throw Error('Mask không hợp lệ.');
 const out=Float32Array.from(mask,v=>clamp(Number.isFinite(v)?v:0));if(!radius)return out;
 const d=new Float32Array(w*h);d.fill(radius+1);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;d[i]=out[i]<.01?0:Math.min(d[i],x?d[i-1]+1:1,y?d[i-w]+1:1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;d[i]=Math.min(d[i],x+1<w?d[i+1]+1:1,y+1<h?d[i+w]+1:1);out[i]*=clamp(d[i]/(radius+1));}return out;
}
export function referencePatch(source,w,h,reference,rw,rh,matrix,mask,{strength=1,feather=0}={}){
 pixels(source,w,h);pixels(reference,rw,rh);if(matrix.length!==6||matrix.some(v=>!Number.isFinite(v))||mask.length!==w*h)throw Error('Căn chỉnh hoặc mask không hợp lệ.');
 const[a,b,c,d,e,f]=matrix,det=a*d-b*c;if(Math.abs(det)<1e-5)throw Error('Căn chỉnh bị suy biến.');
 const m=featherMask(mask,w,h,feather),out=new Uint8ClampedArray(source);let replaced=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,weight=m[i]*clamp(strength);if(!weight)continue;const sx=(d*(x-e)-c*(y-f))/det,sy=(-b*(x-e)+a*(y-f))/det;if(sx<0||sy<0||sx>rw-1||sy>rh-1)continue;
  const x0=Math.floor(sx),y0=Math.floor(sy),tx=sx-x0,ty=sy-y0;let alpha=0;const rgb=[0,0,0];
  for(const[px,py,v]of[[x0,y0,(1-tx)*(1-ty)],[Math.min(rw-1,x0+1),y0,tx*(1-ty)],[x0,Math.min(rh-1,y0+1),(1-tx)*ty],[Math.min(rw-1,x0+1),Math.min(rh-1,y0+1),tx*ty]]){const j=(py*rw+px)*4,aw=reference[j+3]/255*v;alpha+=aw;for(let k=0;k<3;k++)rgb[k]+=reference[j+k]*aw;}
  if(alpha<.001)continue;const sa=source[i*4+3]/255*(1-weight),ra=alpha*weight,oa=sa+ra;for(let k=0;k<3;k++)out[i*4+k]=oa?(source[i*4+k]*sa+rgb[k]/alpha*ra)/oa:0;out[i*4+3]=oa*255;replaced++;
 }if(!replaced)throw Error('Vùng tô không giao với ảnh tham chiếu sau căn chỉnh.');return{data:out,replaced,matrix:[...matrix]};
}
const linear=n=>(n/=255)<=.04045?n/12.92:((n+.055)/1.055)**2.4;
function rgbAB(rgb){const[r,g,b]=rgb.map(linear),f=n=>n>.008856?Math.cbrt(n):7.787*n+16/116,x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);return[500*(x-y),200*(y-z)];}
export function guidedColor(source,w,h,mask,hex,strength=1){pixels(source,w,h);if(mask.length!==w*h||!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Màu hoặc mask không hợp lệ.');const[a,b]=rgbAB([1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))),out=new Uint8ClampedArray(source);for(let i=0;i<mask.length;i++){const weight=clamp(mask[i])*clamp(strength);if(!weight)continue;const j=i*4,color=labToRgb(rgbToLightness(source[j],source[j+1],source[j+2]),a,b);for(let k=0;k<3;k++)out[j+k]=source[j+k]+weight*(color[k]-source[j+k]);}return out;}
export function reconstructionMetrics(truth,output,mask){if(truth.length!==output.length||truth.length!==mask.length*4)throw Error('Dữ liệu đối chiếu không hợp lệ.');let count=0,absolute=0,square=0,outside=0,changed=0;for(let i=0;i<mask.length;i++){if(mask[i]>.5){for(let k=0;k<3;k++){const d=truth[i*4+k]-output[i*4+k];absolute+=Math.abs(d);square+=d*d;count++;}}else{outside++;if([0,1,2,3].some(k=>truth[i*4+k]!==output[i*4+k]))changed++;}}if(!count)throw Error('Bài đo cần vùng hỏng đã biết.');const mse=square/count;return{maskedPixels:count/3,maskedMAE:absolute/count,maskedPSNR:mse===0?null:10*Math.log10(255*255/mse),perfectMatch:mse===0,outsidePixels:outside,outsideChangedPixels:changed};}
