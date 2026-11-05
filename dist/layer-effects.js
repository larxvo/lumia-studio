// Canvas-native styles. Effects use the unfilled silhouette; Fill affects content only.
import {checkedCanvas as canvas} from './capacity.js';
export const STYLE_DEFS = [
  ['bevel','Bevel & Emboss','Khối nổi', [['bevelSize','Size',1,40,6,'px'],['bevelDepth','Depth',0,100,50,'%'],['bevelAngle','Angle',-180,180,120,'°']]],
  ['stroke','Stroke','Viền', [['strokeWidth','Size',1,30,2,'px'],['strokeOpacity','Opacity',0,100,100,'%']]],
  ['innerShadow','Inner Shadow','Bóng trong', [['innerShadowOpacity','Opacity',0,100,45,'%'],['innerShadowBlur','Size',0,100,12,'px'],['innerShadowX','Offset X',-100,100,4,'px'],['innerShadowY','Offset Y',-100,100,4,'px']]],
  ['innerGlow','Inner Glow','Sáng trong', [['innerGlowOpacity','Opacity',0,100,55,'%'],['innerGlowSize','Size',1,100,14,'px']]],
  ['satin','Satin','Ánh lụa', [['satinOpacity','Opacity',0,100,35,'%'],['satinSize','Size',1,100,18,'px'],['satinDistance','Distance',0,100,12,'px'],['satinAngle','Angle',-180,180,45,'°']]],
  ['colorOverlay','Color Overlay','Phủ màu', [['colorOverlayOpacity','Opacity',0,100,100,'%']]],
  ['gradientOverlay','Gradient Overlay','Phủ chuyển sắc', [['gradientOverlayOpacity','Opacity',0,100,100,'%'],['gradientOverlayAngle','Angle',-180,180,90,'°']]],
  ['glow','Outer Glow','Quầng sáng', [['glowOpacity','Opacity',0,100,80,'%'],['glowSpread','Spread',0,100,0,'%'],['glowSize','Size',0,150,24,'px']]],
  ['shadow','Drop Shadow','Đổ bóng', [['shadowOpacity','Opacity',0,100,100,'%'],['shadowSpread','Spread',0,100,0,'%'],['shadowBlur','Size',0,150,20,'px'],['shadowX','Offset X',-200,200,0,'px'],['shadowY','Offset Y',-200,200,12,'px']]],
];
export const EFFECT_KEYS=STYLE_DEFS.map(d=>d[0]);
export const hasLayerEffects=l=>EFFECT_KEYS.some(k=>l.effects?.[k]);
export const effectDefaultColor=k=>['shadow','innerShadow','satin'].includes(k)?'#000000':['glow','gradientOverlay'].includes(k)?'#7de4d4':'#ffffff';
const pct=(e,k,f=100)=>Math.max(0,Math.min(100,e[k]??f))/100;
const release=c=>{c.width=c.height=1;};
export function styleLayer(raw, layer, scale=1, effects=true) {
  const e=effects?(layer.effects||{}):{}, fill=Math.max(0,Math.min(1,layer.fillOpacity??1));
  if(!hasLayerEffects({effects:e})&&fill===1)return raw;
  const out=canvas(raw.width,raw.height),x=out.getContext('2d');
  const blank=()=>canvas(raw.width,raw.height);
  const tint=(color)=>{const c=blank(),q=c.getContext('2d');q.drawImage(raw,0,0);q.globalCompositeOperation='source-in';q.fillStyle=color;q.fillRect(0,0,c.width,c.height);return c;};
  const put=(c,blend='source-over',alpha=1,dx=0,dy=0,blur=0)=>{x.save();x.globalCompositeOperation=blend==='normal'?'source-over':blend;x.globalAlpha=alpha;x.filter=blur>0?`blur(${Math.min(150,blur)*scale}px)`:'none';x.drawImage(c,dx*scale,dy*scale);x.restore();};
  const spread=(c,r)=>{if(r<=0)return c;const n=blank(),q=n.getContext('2d');q.drawImage(c,0,0);for(let i=0;i<24;i++){const a=i*Math.PI/12;q.drawImage(c,Math.cos(a)*r*scale,Math.sin(a)*r*scale);}release(c);return n;};
  // Outside effects remain visible at Fill=0.
  for(const k of ['shadow','glow'])if(e[k]){
    const size=k==='shadow'?(e.shadowBlur??20):(e.glowSize??24),c=spread(tint(e[k+'Color']||effectDefaultColor(k)),size*pct(e,k+'Spread'));
    put(c,e[k+'Blend']||'normal',pct(e,k+'Opacity',k==='glow'?80:100),k==='shadow'?(e.shadowX||0):0,k==='shadow'?(e.shadowY??12):0,size*(1-pct(e,k+'Spread'))/(k==='glow'?2:1));release(c);
  }
  if(e.stroke){const c=spread(tint(e.strokeColor||'#ffffff'),Math.min(30,e.strokeWidth??2));const q=c.getContext('2d');q.globalCompositeOperation='destination-out';q.drawImage(raw,0,0);put(c,e.strokeBlend||'normal',pct(e,'strokeOpacity'));release(c);}
  const content=blank(),cx=content.getContext('2d');cx.globalAlpha=fill;cx.drawImage(raw,0,0);cx.globalAlpha=1;
  const overlay=(c,blend='source-over',opacity=1)=>{const q=c.getContext('2d');q.globalCompositeOperation='destination-in';q.drawImage(raw,0,0);cx.save();cx.globalAlpha=opacity;cx.globalCompositeOperation=blend==='normal'?'source-over':blend;cx.drawImage(c,0,0);cx.restore();release(c);};
  if(e.colorOverlay)overlay(tint(e.colorOverlayColor||'#ffffff'),e.colorOverlayBlend||'normal',pct(e,'colorOverlayOpacity'));
  if(e.gradientOverlay){const c=blank(),q=c.getContext('2d'),a=(e.gradientOverlayAngle??90)*Math.PI/180,len=Math.abs(c.width*Math.cos(a))+Math.abs(c.height*Math.sin(a)),cx=c.width/2,cy=c.height/2,g=q.createLinearGradient(cx-Math.cos(a)*len/2,cy-Math.sin(a)*len/2,cx+Math.cos(a)*len/2,cy+Math.sin(a)*len/2);g.addColorStop(0,e.gradientOverlayColor||'#7de4d4');g.addColorStop(1,e.gradientOverlayColor2||'#376ba5');q.fillStyle=g;q.fillRect(0,0,c.width,c.height);overlay(c,e.gradientOverlayBlend||'normal',pct(e,'gradientOverlayOpacity'));}
  // Inner effects derive edges from the silhouette, never from a rectangular layer box.
  const inner=(color,dx,dy,blur)=>{const c=blank(),q=c.getContext('2d');q.fillStyle=color;q.fillRect(0,0,c.width,c.height);q.globalCompositeOperation='destination-out';q.filter=blur?`blur(${blur*scale}px)`:'none';q.drawImage(raw,dx*scale,dy*scale);q.filter='none';return c;};
  if(e.innerShadow)overlay(inner(e.innerShadowColor||'#000000',e.innerShadowX??4,e.innerShadowY??4,e.innerShadowBlur??12),e.innerShadowBlend||'multiply',pct(e,'innerShadowOpacity',45));
  if(e.innerGlow)overlay(inner(e.innerGlowColor||'#ffffff',0,0,e.innerGlowSize??14),e.innerGlowBlend||'screen',pct(e,'innerGlowOpacity',55));
  if(e.satin){const a=(e.satinAngle??45)*Math.PI/180,d=e.satinDistance??12,c=blank(),q=c.getContext('2d'),t=tint(e.satinColor||'#000000');q.filter=`blur(${(e.satinSize??18)*scale/2}px)`;q.drawImage(t,Math.cos(a)*d*scale,Math.sin(a)*d*scale);q.globalCompositeOperation='xor';q.drawImage(t,-Math.cos(a)*d*scale,-Math.sin(a)*d*scale);release(t);overlay(c,e.satinBlend||'multiply',pct(e,'satinOpacity',35));}
  if(e.bevel){const a=(e.bevelAngle??120)*Math.PI/180,s=e.bevelSize??6,dx=Math.cos(a)*s,dy=-Math.sin(a)*s;overlay(inner('#ffffff',dx,dy,s/3),'screen',pct(e,'bevelDepth',50));overlay(inner('#000000',-dx,-dy,s/3),'multiply',pct(e,'bevelDepth',50));}
  x.drawImage(content,0,0);release(content);release(raw);return out;
}
