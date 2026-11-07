export function cropRatio(value,doc) {
  if(value==='original')return doc.width/doc.height;
  if(value==='free')return 0;
  const [w,h]=String(value).split(':').map(Number);return w>0&&h>0?w/h:0;
}
export function cropRect(a,b,bounds,ratio=0) {
  const ax=Math.max(0,Math.min(bounds.width,a.x)),ay=Math.max(0,Math.min(bounds.height,a.y));
  const sx=b.x<ax?-1:1,sy=b.y<ay?-1:1;
  let w=Math.abs(b.x-ax),h=Math.abs(b.y-ay);
  if(ratio){if(w/Math.max(.001,h)>ratio)h=w/ratio;else w=h*ratio;}
  const maxW=sx>0?bounds.width-ax:ax,maxH=sy>0?bounds.height-ay:ay,f=Math.min(1,maxW/Math.max(.001,w),maxH/Math.max(.001,h));
  w*=f;h*=f;return{x:sx>0?ax:ax-w,y:sy>0?ay:ay-h,width:w,height:h};
}
export function moveCrop(r,dx,dy,bounds) {
  return {type:'rect',...r,x:Math.max(0,Math.min(bounds.width-r.width,r.x+dx)),y:Math.max(0,Math.min(bounds.height-r.height,r.y+dy))};
}
export function exactCrop(r,width,height,bounds,ratio=0,changed='width') {
  width=Math.max(1,width);height=Math.max(1,height);
  if(ratio){if(changed==='width')height=width/ratio;else width=height*ratio;}
  const f=Math.min(1,bounds.width/width,bounds.height/height);width*=f;height*=f;
  return moveCrop({x:r?.x||0,y:r?.y||0,width,height},0,0,bounds);
}
