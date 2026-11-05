export const PATTERNS=[['dots','Chấm'],['cross','Dấu +'],['checker','Ô cờ'],['lines','Sọc'],['grid','Lưới'],['diagonal','Chéo']];
export function patternTile(make,settings){const size=Math.max(4,Math.min(256,Math.round(settings.size||20))),c=make(size,size),x=c.getContext('2d');if(settings.background){x.fillStyle=settings.background;x.fillRect(0,0,size,size);}x.fillStyle=x.strokeStyle=settings.color||'#a5e4d1';x.lineWidth=Math.max(1,size/12);const mid=size/2;
 if(settings.kind==='dots'){x.beginPath();x.arc(mid,mid,size*.16,0,Math.PI*2);x.fill();}
 else if(settings.kind==='cross'){x.beginPath();x.moveTo(mid,size*.22);x.lineTo(mid,size*.78);x.moveTo(size*.22,mid);x.lineTo(size*.78,mid);x.stroke();}
 else if(settings.kind==='checker'){x.fillRect(0,0,mid,mid);x.fillRect(mid,mid,mid,mid);}
 else if(settings.kind==='lines'){x.fillRect(0,size*.4,size,size*.2);}
 else if(settings.kind==='grid'){x.fillRect(0,0,size,x.lineWidth);x.fillRect(0,0,x.lineWidth,size);}
 else{for(const offset of [-size,0,size]){x.beginPath();x.moveTo(offset,size);x.lineTo(offset+size,0);x.stroke();}}return c;}
