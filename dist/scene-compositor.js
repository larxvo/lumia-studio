import {sceneParticles,sampleScene} from './scene-engine.js';
import {sceneParams} from './scene-settings.js';
export function compositeSceneEffects(target,{params={},regions,atlas,offsetX=0,offsetY=0,fullWidth=target.width,fullHeight=target.height,createCanvas}){
 const p=sceneParams(params);if(!p.amount||!p.leaves&&!p.snow)return target;
 const c=createCanvas(target.width,target.height),x=c.getContext('2d'),min=Math.min(fullWidth,fullHeight),particles=sceneParticles(p).sort((a,b)=>a.z-b.z);
 for(const q of particles){const size=q.size*min,cx=q.x*fullWidth-offsetX,cy=q.y*fullHeight-offsetY,blur=(1-q.z)*p.depth/100*min*.004;
  if(cx+size+blur<0||cy+size+blur<0||cx-size-blur>c.width||cy-size-blur>c.height)continue;
  const draw=(dx,dy,alpha)=>{x.save();x.translate(cx+dx,cy+dy);x.rotate(q.angle);x.globalAlpha=alpha*p.amount/100;x.filter=blur>.15?`blur(${blur}px)`:'none';if(q.kind==='leaf'){if(!atlas)throw Error('Không tải được texture lá.');const cellW=atlas.width/2,cellH=atlas.height/2;x.drawImage(atlas,q.sprite%2*cellW,Math.floor(q.sprite/2)*cellH,cellW,cellH,-size/2,-size/2,size,size);}else{x.fillStyle='#f5faff';x.beginPath();x.ellipse(0,0,size*.55,size*(.6+p.motion*.006),0,0,Math.PI*2);x.fill();}x.restore();};
  const trail=min*.018*p.motion/100*q.z;if(trail>1)for(let t=4;t>0;t--)draw(-p.wind/100*trail*t/4,-trail*t/4,q.opacity*.07);draw(0,0,q.opacity);
 }
 // Keep overlays behind protected people and retain transparent source regions.
 if(p.protectPeople&&regions?.people){const im=x.getImageData(0,0,c.width,c.height);for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){const k=(y*c.width+xx)*4;im.data[k+3]*=1-sampleScene(regions,'people',(offsetX+xx+.5)/fullWidth,(offsetY+y+.5)/fullHeight);}x.putImageData(im,0,0);}
 const tx=target.getContext('2d'),original=tx.getImageData(0,0,target.width,target.height);tx.drawImage(c,0,0);const out=tx.getImageData(0,0,target.width,target.height);for(let i=0;i<out.data.length;i+=4){if(!out.data[i+3])for(let j=0;j<3;j++)out.data[i+j]=original.data[i+j];}tx.putImageData(out,0,0);return target;
}
