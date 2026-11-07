import {traceLabels} from './art-vector.js';
import {artPalette,paletteLookup,paletteIndex} from './art-pixels.js';
const number=v=>Number(v.toFixed(3)),color=s=>/^#[0-9a-f]{6}$/i.test(s)?s:'#ffba13';
function area(points){return points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;}
function inside(p,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function tracePixels({data,width,height,outputWidth=width,outputHeight=height,mode='alpha',colors=6,threshold=128,tolerance=.8,speckle=2,fill='#ffba13'}) {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216||data?.length!==width*height*4)throw Error('Invalid tracing image.');
 if(!['alpha','colors'].includes(mode)||!Number.isInteger(colors)||colors<2||colors>16||!Number.isFinite(threshold)||threshold<1||threshold>255||!Number.isFinite(tolerance)||tolerance<0||tolerance>8||!Number.isInteger(speckle)||speckle<0||speckle>100)throw Error('Invalid tracing settings.');
 if(![outputWidth,outputHeight].every(v=>Number.isFinite(v)&&v>=1&&v<=1e7))throw Error('Invalid output size.');
 const palette=mode==='alpha'?[[...color(fill).slice(1).match(/../g).map(v=>parseInt(v,16))]]:artPalette(data,colors),lut=mode==='colors'?paletteLookup(palette):null,labels=new Int16Array(width*height).fill(-1);
 for(let i=0;i<labels.length;i++)if(data[i*4+3]>=threshold)labels[i]=mode==='alpha'?0:paletteIndex(lut,data[i*4],data[i*4+1],data[i*4+2]);
 const marks=traceLabels(labels,width,height,palette,{tolerance}),paths=[];let anchors=0;
 for(const mark of marks){const contours=mark.polygons.map(points=>({points:points.map(([x,y])=>[number(x*outputWidth/width),number(y*outputHeight/height)]),area:area(points)})).filter(p=>Math.abs(p.area)>=speckle);
  const outer=contours.filter(p=>p.area>0).map(p=>({...p,holes:[]}));
  for(const hole of contours.filter(p=>p.area<0)){const parent=outer.filter(p=>inside(hole.points[0],p.points)).sort((a,b)=>a.area-b.area)[0];if(parent)parent.holes.push(hole.points);}
  for(const shape of outer){const commands=[shape.points,...shape.holes].flatMap(points=>[...points.map(([x,y],i)=>({type:i?'L':'M',x,y})),{type:'Z'}]),count=commands.filter(c=>c.type!=='Z').length;
   anchors+=count;paths.push({id:'trace-'+String(paths.length+1).padStart(3,'0'),fill:mark.fill,commands,anchors:count,holes:shape.holes.length});}
 }
 if(!paths.length)throw Error('No visible contours. Lower the alpha threshold or choose color tracing.');
 return {width:outputWidth,height:outputHeight,paths,anchors};
}
export function traceSVG(result,{prefix='luma-logo',style='fill',strokeWidth=2,animate=false}={}) {
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(prefix))throw Error('Use an SVG ID starting with a letter, followed by letters, digits, - or _.');
 if(!['fill','outline'].includes(style)||!Number.isFinite(strokeWidth)||strokeWidth<.1||strokeWidth>100)throw Error('Invalid SVG style.');
 const lines=animate||style==='outline',css=animate?'<style>.luma-trace{stroke-dasharray:1;stroke-dashoffset:1;animation:luma-draw 2.4s ease forwards}@keyframes luma-draw{to{stroke-dashoffset:0}}@media(prefers-reduced-motion:reduce){.luma-trace{animation:none;stroke-dashoffset:0}}</style>':'';
 const paths=result.paths.map((p,i)=>{const d=p.commands.map(c=>c.type==='Z'?'Z':c.type+' '+number(c.x)+' '+number(c.y)).join(' ');return `<path id="${prefix}-path-${String(i+1).padStart(3,'0')}" class="luma-trace" data-part="${i+1}" pathLength="1" fill-rule="evenodd" fill="${lines?'none':color(p.fill)}" ${lines?`stroke="${color(p.fill)}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`:''} d="${d}"/>`;}).join('\n');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}"><title>Traced artwork</title><metadata>Created with Luma Studio · Larx Vo · vovinhlac.com</metadata>${css}\n${paths}\n</svg>`;
}
