const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
export const LEVEL_FIELDS=['black','gamma','white','outputBlack','outputWhite'];
export function levelSettings(p={}){return {black:p.black??0,gamma:p.gamma??1,white:p.white??255,outputBlack:p.outputBlack??0,outputWhite:p.outputWhite??255};}
export function switchLevelChannel(p,next){const channels=p.channels||(p.channels={});channels[p.channel||'rgb']=levelSettings(p);Object.assign(p,levelSettings(channels[next]));p.channel=next;}
export function levelLuts(p){const bank={...p.channels,[p.channel||'rgb']:levelSettings(p)};return Object.fromEntries(['rgb','red','green','blue'].map(k=>{const s=levelSettings(bank[k]),lo=bound(s.black,0,254),hi=bound(s.white,lo+1,255),g=bound(s.gamma,.1,4),o=bound(s.outputBlack,0,255),end=bound(s.outputWhite,0,255);return [k,Float32Array.from({length:256},(_,v)=>o+(end-o)*Math.pow(bound((v-lo)/(hi-lo),0,1),1/g))];}));}
export function hslRgb(h,s,l){h=((h%360)+360)%360/360;s=bound(s,0,1);l=bound(l,0,1);const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return 255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)));};return [f(0),f(8),f(4)];}
export function hexRgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function rgbHex(rgb){return '#'+rgb.map(v=>Math.round(bound(v,0,255)).toString(16).padStart(2,'0')).join('');}
export function hsvRgb(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,colors=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(((h%360)+360)%360/60)];return colors.map(n=>(n+m)*255);}
export function rgbHsv(rgb){const [r,g,b]=rgb.map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=!d?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return [((h*60)+360)%360,max?d/max:0,max];}
