import {sceneParams} from './scene-settings.js';
import {sample} from './cutout-math.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),step=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);},L=(r,g,b)=>.2126*r+.7152*g+.0722*b;
export function rgbHSV(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d)h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return[(h*60+360)%360,max?d/max:0,max];}
function hsvRGB(h,s,v){const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c,r=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return r.map(v=>(v+m)*255);}
function noise(x,y){const q=Math.sin(x*127.1+y*311.7)*43758.5453;return q-Math.floor(q);}
function smoothNoise(x,y){const a=Math.floor(x),b=Math.floor(y),u=step(0,1,x-a),v=step(0,1,y-b);return(noise(a,b)*(1-u)+noise(a+1,b)*u)*(1-v)+(noise(a,b+1)*(1-u)+noise(a+1,b+1)*u)*v;}
export function sampleScene(regions,key,u,v){const a=regions?.[key];return a?sample(a,regions.width,regions.height,u*regions.width-.5,v*regions.height-.5):0;}
export function analyzeScene({data,width:w,height:h,semantic=null,subject=null}){
 if(data.length!==w*h*4||!Number.isSafeInteger(w*h))throw Error('Invalid analysis image.');
 const n=w*h,sky=new Float32Array(n),foliage=new Float32Array(n),people=new Float32Array(n),object=new Float32Array(n),allowed=new Uint8Array(n),seen=new Uint8Array(n),queue=new Int32Array(n),hist=new Uint32Array(256);let count=0,dark=0;
 for(let i=0;i<n;i++){const k=i*4,r=data[k],g=data[k+1],b=data[k+2],Y=L(r,g,b),[hue,sat]=rgbHSV(r,g,b),u=(i%w+.5)/w,v=(Math.floor(i/w)+.5)/h;hist[Math.round(Y)]++;count++;if(Y<55)dark++;
  if(semantic?.map){const j=Math.min(semantic.height-1,Math.floor(v*semantic.height))*semantic.width+Math.min(semantic.width-1,Math.floor(u*semantic.width));people[i]=semantic.classMap?Number(semantic.classMap[j]===15):Number(semantic.regions.some(r=>r.id===semantic.map[j]&&r.classId===15));}
  object[i]=subject?sample(subject.values,subject.width,subject.height,u*subject.width-.5,v*subject.height-.5):people[i];
  foliage[i]=step(55,82,hue)*(1-step(150,174,hue))*step(.10,.33,sat)*step(12,45,Y)*(1-people[i]);
  const green=g>r*1.04&&g>b*1.06,blue=b>r*.92&&b>g*.87,white=sat<.23&&Y>105;allowed[i]=v<.83&&!green&&!people[i]&&Y>9&&(blue||white||r>b*1.09&&Y>95)?1:0;
 }
 let head=0,tail=0;for(let y=0;y<Math.max(1,Math.ceil(h*.025));y++)for(let x=0;x<w;x++){const i=y*w+x;if(allowed[i]){seen[i]=1;queue[tail++]=i;}}
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&allowed[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
 for(let i=0;i<n;i++)sky[i]=seen[i]?(1-people[i])*step(8,28,L(data[i*4],data[i*4+1],data[i*4+2])):0;
 let sum=0,median=.5;for(let i=0;i<256;i++){sum+=hist[i];if(sum>=count/2){median=i/255;break;}}
 let orbCenter=[.5,.18],best=-1;for(let y=Math.round(h*.08);y<h*.48;y+=Math.max(1,Math.round(h*.035)))for(let x=Math.round(w*.15);x<w*.86;x+=Math.max(1,Math.round(w*.04))){let score=0;for(let dy=-8;dy<=8;dy+=4)for(let dx=-8;dx<=8;dx+=4){const xx=Math.max(0,Math.min(w-1,x+dx)),yy=Math.max(0,Math.min(h-1,y+dy));score+=sky[yy*w+xx];}score-=Math.abs(x/w-.6)*.5;if(score>best){best=score;orbCenter=[x/w,y/h];}}
 const lamps=detectLamps(data,w,h,sky,people);return{width:w,height:h,sky,foliage,people,subject:object,lamps,analysis:{median,orbCenter,darkFraction:dark/Math.max(1,count),skyFraction:sky.reduce((a,b)=>a+b,0)/n,foliageFraction:foliage.reduce((a,b)=>a+b,0)/n,semantic:!!semantic,method:'DeepLab people where available; editable color/connectivity sky/foliage and bright-spot hints'}};
}
export function detectLamps(data,w,h,sky,people){
 const n=w*h,seen=new Uint8Array(n),candidate=new Uint8Array(n),q=new Int32Array(n),result=[];
 const luminance=i=>L(data[i*4],data[i*4+1],data[i*4+2]);
 for(let i=0;i<n;i++){const k=i*4,R=data[k],G=data[k+1],B=data[k+2],Y=luminance(i),v=Math.floor(i/w)/h,neutral=(Math.max(R,G,B)-Math.min(R,G,B))/Math.max(1,R,G,B)<.23,warm=R>G*1.12&&G>B*1.15;candidate[i]=v>.18&&v<.82&&Y>154&&(neutral||warm)&&people[i]<.1?1:0;}
 for(let start=0;start<n;start++){
  if(!candidate[start]||seen[start])continue;let read=0,write=1,xsum=0,ysum=0,l=w,t=h,r=0,b=0;q[0]=start;seen[start]=1;
  while(read<write){const i=q[read++],x=i%w,y=Math.floor(i/w);xsum+=x;ysum+=y;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);for(const j of[x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&candidate[j]&&!seen[j]){seen[j]=1;q[write++]=j;}}
  const bw=r-l+1,bh=b-t+1,fill=write/(bw*bh),aspect=bw/bh,cx=xsum/write;
  if(write<Math.max(4,n*.00006)||write>n*.0055||aspect<.55||aspect>1.8||fill<.4)continue;
  // A compact pale globe plus a dark stem is a conservative street-lamp hint.
  // Bright leaf gaps and clouds alone must not switch on as lamps.
  let stem=0,total=0;for(let y=b+2;y<Math.min(h,b+bh*5);y++)for(let x=Math.max(0,Math.round(cx)-1);x<Math.min(w,Math.round(cx)+2);x++){stem+=luminance(y*w+x)<95?1:0;total++;}
  if(!total||stem/total<.8)continue;
  result.push({x:(cx+.5)/w,y:(ysum/write+.5)/h,radius:clamp(Math.sqrt(write/Math.PI)/Math.min(w,h),.003,.04),score:write*fill*stem/total});
 }
 return result.sort((a,b)=>b.score-a.score).slice(0,16).map(({score,...hint})=>hint);
}
export function sceneSubjectBounds(regions){let l=1,t=1,r=0,b=0;for(let y=0;y<regions.height;y++)for(let x=0;x<regions.width;x++)if(regions.subject[y*regions.width+x]>.5){l=Math.min(l,x/regions.width);r=Math.max(r,(x+1)/regions.width);t=Math.min(t,y/regions.height);b=Math.max(b,(y+1)/regions.height);}return r>l&&b>t?{x:l,y:t,width:r-l,height:b-t}:null;}
function shadowAt(u,v,regions,p,b){if(!b||!p.shadow)return 0;const angle=p.shadowAngle*Math.PI/180,dist=p.shadowDistance/100,centerX=b.x+b.width/2+Math.cos(angle)*dist*b.width*.5,centerY=b.y+b.height+dist*b.height*.18,rx=b.width*(.42+p.shadowBlur*.003),ry=b.width*(.015+p.shadowBlur*.0008+dist*.04),ellipse=Math.exp(-(((u-centerX)/Math.max(.001,rx))**2+((v-centerY)/Math.max(.001,ry))**2)*2);if(p.shadowMode!=='cast')return ellipse*(p.shadowMode==='contact'?1:1-dist*.4);const vv=(b.y+b.height-v)/Math.max(.001,b.height*.32),su=u-Math.cos(angle)*vv*b.width*.7,sv=b.y+b.height-vv*b.height;return Math.max(ellipse*.25,sampleScene(regions,'subject',su,sv)*step(-.1,.1,vv)*(1-step(.8,1.2,vv)));}
export function renderSceneTile({data,width:w,height:h,fullWidth=w,fullHeight=h,offsetX=0,offsetY=0,params={},regions}){
 const p=sceneParams(params);if(data.length!==w*h*4||!Number.isSafeInteger(w*h*4))throw Error('Invalid scene tile.');const out=new Uint8ClampedArray(data),amount=p.amount/100;if(!amount||['exposure','contrast','shadows','highlights','warmth','vibrance','clarity','sharpness','foliage','frost','time','sky','celestial','lamps','shadow'].every(k=>!p[k]))return{data:out,width:w,height:h};const b=p.shadow&&regions?sceneSubjectBounds(regions):null;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,k=i*4;if(!data[k+3]){if(p.shadow&&b){const u=(offsetX+x+.5)/fullWidth,v=(offsetY+y+.5)/fullHeight,a=shadowAt(u,v,regions,p,b)*p.shadow/100*amount;out.set([13,17,20,a*210],k);}continue;}const u=(offsetX+x+.5)/fullWidth,v=(offsetY+y+.5)/fullHeight,original=[data[k],data[k+1],data[k+2]],Y=L(...original)/255,person=p.protectPeople?sampleScene(regions,'people',u,v):0,subject=sampleScene(regions,'subject',u,v),sky=sampleScene(regions,'sky',u,v)*(1-person),leaf=sampleScene(regions,'foliage',u,v)*(1-person);let pixel=original.slice(),target=Y*2**p.exposure;
  target+=p.shadows/100*.19*(1-target)**2*step(.003,.05,Y)-p.highlights/100*.15*step(.45,1,target);target=clamp((target-.5)*(1+p.contrast/150)+.5);const gain=target/Math.max(.006,Y);pixel=pixel.map(c=>c*gain);const gray=L(...pixel),sat=1+p.vibrance/100*.38*(1-person*.7);pixel=pixel.map(c=>gray+(c-gray)*sat);pixel[0]+=p.warmth*.20*(1-person*.55);pixel[2]-=p.warmth*.23*(1-person*.55);
  if(p.clarity||p.sharpness){const idx=[(y*w+Math.max(0,x-1))*4,(y*w+Math.min(w-1,x+1))*4,(Math.max(0,y-1)*w+x)*4,(Math.min(h-1,y+1)*w+x)*4],mean=idx.reduce((n,j)=>n+L(data[j],data[j+1],data[j+2]),0)/4,detail=clamp(Y*255-mean,-18,18)*(p.sharpness*.008+p.clarity*.004)*(1-sky*.8);pixel=pixel.map(c=>c+detail);}
  if(leaf&&p.foliage){const [hue,saturation,value]=rgbHSV(...pixel.map(c=>clamp(c,0,255))),color=hsvRGB(clamp(p.leafHue+(hue-110)*.18,15,160),Math.min(1,saturation*1.05),value);pixel=pixel.map((c,j)=>c+(color[j]-c)*leaf*p.foliage/100);}
  if(p.frost&&leaf){const a=leaf*p.frost/100*(.28+.72*step(.04,.65,Y))*.9;pixel=pixel.map((c,j)=>c+([225,237,246][j]-c)*a);}
  const night=Math.max(0,-p.time/100),day=Math.max(0,p.time/100);if(night){pixel=pixel.map((c,j)=>c*(1-night*(person>.2?.38:.58))+[-6,0,12][j]*night*(1-person*.6));}if(day){pixel=pixel.map((c,j)=>c+(1-Y)*day*[12,13,16][j]);}
  if(sky&&p.sky){const cloud=step(.48,.78,smoothNoise(u*8,v*9)*.65+smoothNoise(u*19+7,v*24)*.35)*p.clouds/100;const nightSky=[7+v*13,14+v*18,37+v*19],daySky=[65+v*98,144+v*56,218+v*22];const color=(p.time<0?nightSky:daySky).map((c,j)=>c+([250,252,255][j]-c)*cloud*(1-night));pixel=pixel.map((c,j)=>c+(color[j]-c)*sky*p.sky/100);}
  if(p.celestial&&sky){const aspect=fullWidth/fullHeight,dx=(u-p.orbX/100)*aspect,dy=v-p.orbY/100,r=p.orbSize/100*.45,d=Math.hypot(dx,dy),a=(1-step(r*.95,r,d))*p.celestial/100*sky;if(d<r){const texture=.83+.17*smoothNoise(dx/r*19+5,dy/r*23+2),color=p.time<0?[216*texture,226*texture,239*texture]:[255,239,184];pixel=pixel.map((c,j)=>c+(color[j]-c)*a);}if(p.time>=0){const glow=Math.exp(-(dx*dx+dy*dy)/(r*r*5))*p.celestial/100*.19*sky;pixel=pixel.map((c,j)=>c+([255,222,159][j]-c)*glow);}}
  if(night&&p.lamps)for(const lamp of regions?.lamps||[]){const dx=(u-lamp.x)*fullWidth/fullHeight,dy=v-lamp.y,r=p.lampRadius/100,dist=dx*dx+dy*dy,a=Math.exp(-dist/(r*r*.16))*p.lamps/100*night*(1-person*.65),core=Math.exp(-dist/Math.max(.000002,lamp.radius**2))*p.lamps/100;pixel=pixel.map((c,j)=>c+([255,202,111][j]-c)*a*.48+(255-c)*core*.85);}
  if(p.shadow&&b){const a=shadowAt(u,v,regions,p,b)*p.shadow/100*(1-subject);pixel=pixel.map(c=>c*(1-a*.8));}
  for(let j=0;j<3;j++)out[k+j]=original[j]+(clamp(pixel[j],0,255)-original[j])*amount;
 }
 return{data:out,width:w,height:h};
}
export function sceneParticles(params){const p=sceneParams(params),particles=[];let seed=p.seed>>>0;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(const [kind,count]of [['leaf',Math.round(p.leaves*1.5)],['snow',Math.round(p.snow*5)]])for(let i=0;i<count;i++){const z=.15+rand()*.85,x0=rand(),y0=rand(),phase=rand()*6.28,t=p.frame/1000,y=(y0+t*(.15+z*.65))%1,x=((x0+t*p.wind/100*(.1+z*.35)+Math.sin(phase+t*6)*.018)%1+1)%1;particles.push({kind,x,y,z,angle:rand()*6.28+Math.sin(t*5+phase),sprite:Math.floor(rand()*4),size:kind==='leaf'?p.leafSize/100*(.18+.82*z):(.0015+.006*z),opacity:.35+.65*z});}return particles;}
