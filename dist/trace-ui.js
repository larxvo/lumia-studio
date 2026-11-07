import {clone,createLayer,validateDocument} from './model.js';
import {renderLayer,canvas} from './renderer.js';
import {tracePixels,traceSVG} from './trace-core.js';
import {downloadBlob} from './storage.js';
export function createTraceStudio(api,{workerFactory=()=>typeof Worker==='undefined'?null:new Worker(new URL('./trace-worker.js',import.meta.url),{type:'module'})}={}) {
 let disposeCurrent=()=>{};
 function open(){
  disposeCurrent();const selected=api.layer(),sourceDoc=api.doc();if(!selected||!['image','paint'].includes(selected.type))throw Error('Select an image or pixel layer to trace.');
  const snapshot=clone(selected),docId=sourceDoc.id;let alive=true,revision=0,worker=null,timer=0,result=null;
  const $=s=>document.querySelector(s),dispose=()=>{alive=false;revision++;clearTimeout(timer);worker?.terminate();worker=null;};disposeCurrent=dispose;
  const style=()=>({prefix:$('#trace-prefix').value.trim(),style:$('#trace-style').value,strokeWidth:Number($('#trace-stroke').value),animate:$('#trace-animate').checked});
  const svg=()=>{if(!result)throw Error('Wait for tracing to finish.');return traceSVG(result,style());};
  function preview(){if(!result)return;try{$('#trace-vector').innerHTML=svg();$('#trace-status').textContent='Ready · separate path IDs for animation';$('#trace-copy').disabled=false;$('#trace-stat').dataset.ready='true';}catch(e){$('#trace-status').textContent=e.message;$('#trace-copy').disabled=true;}}
  async function run(){
   clearTimeout(timer);worker?.terminate();worker=null;const id=++revision;result=null;$('#trace-copy').disabled=true;$('#trace-stat').dataset.ready='false';$('#trace-vector').innerHTML='';$('#trace-status').textContent='Tracing contours…';
   try{
    const scale=Math.min(1,Number($('#trace-detail').value)/Math.max(sourceDoc.width,sourceDoc.height)),c=renderLayer(sourceDoc,snapshot,api.assets,scale),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height),out=$('#trace-original');out.width=c.width;out.height=c.height;out.getContext('2d').drawImage(c,0,0);c.width=c.height=1;
    const input={data:pixels.data,width:pixels.width,height:pixels.height,outputWidth:sourceDoc.width,outputHeight:sourceDoc.height,mode:$('#trace-mode').value,fill:$('#trace-fill').value,colors:Number($('#trace-colors').value),threshold:Number($('#trace-threshold').value),tolerance:Number($('#trace-tolerance').value),speckle:Number($('#trace-speckle').value)};
    const accept=r=>{if(!alive||revision!==id)return;result=r;$('#trace-stat').textContent=r.paths.length+' paths · '+r.anchors+' anchors · '+r.paths.reduce((n,p)=>n+p.holes,0)+' holes';preview();};
    const fail=message=>{if(alive&&revision===id){$('#trace-status').textContent=message;$('#trace-stat').dataset.ready='false';}};
    worker=workerFactory();
    if(worker){const current=worker;current.onmessage=e=>{if(e.data.id!==id)return;current.terminate();if(worker===current)worker=null;e.data.error?fail(e.data.error):accept(e.data.result);};current.onerror=e=>{current.terminate();if(worker===current)worker=null;fail(e.message||'Tracing worker failed.');};current.postMessage({id,input},[input.data.buffer]);}
    else accept(tracePixels(input));
   }catch(e){if(alive&&revision===id)$('#trace-status').textContent=e.message;}
  }
  function add(){
   try{
    if(!result)throw Error('Wait for tracing to finish.');svg();
    const doc=api.doc(),current=doc.layers.find(l=>l.id===snapshot.id);
    if(doc.id!==docId||JSON.stringify(current)!==JSON.stringify(snapshot))throw Error('Source layer changed. Close this dialog and trace it again.');
    if(doc.layers.length+result.paths.length+1>150)throw Error('Too many paths for native layers. Increase simplification or download SVG.');
    const group=createLayer('group',{name:'Traced paths',x:0,y:0,width:doc.width,height:doc.height}),settings=style(),outline=settings.style==='outline'||settings.animate;
    const shapes=result.paths.map((part,i)=>{
     const box=part.commands.reduce((b,c)=>c.type==='Z'?b:{left:Math.min(b.left,c.x),top:Math.min(b.top,c.y),right:Math.max(b.right,c.x),bottom:Math.max(b.bottom,c.y)},{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}),left=box.left,top=box.top,width=Math.max(1,box.right-left),height=Math.max(1,box.bottom-top);
     const path=part.commands.map(c=>c.type==='Z'?['Z']:[c.type,c.x-left,c.y-top]),l=createLayer('shape',{name:settings.prefix+' · '+String(i+1).padStart(3,'0'),parentId:group.id,shape:'path',path,pathWidth:width,pathHeight:height,x:left,y:top,width,height,color:part.fill,fillEnabled:!outline});
     if(outline)Object.assign(l.effects,{stroke:true,strokeColor:part.fill,strokeWidth:settings.strokeWidth});return l;
    });
    const candidate=clone(doc);candidate.layers.push(group,...shapes);if($('#trace-hide-source').checked)candidate.layers.find(l=>l.id===snapshot.id).visible=false;candidate.activeId=shapes[0].id;candidate.selectedIds=[shapes[0].id];validateDocument(candidate);
    doc.layers=candidate.layers;doc.activeId=candidate.activeId;doc.selectedIds=candidate.selectedIds;dispose();api.closeModal();api.commit('Trace image to editable paths');api.setTool('node');
   }catch(e){api.toast(e.message,true);}
  }
  api.showModal('Trace image → SVG paths','Transparent logo, icon or artwork · editable geometry',`<div class="trace-grid"><div><div class="trace-stage"><canvas id="trace-original"></canvas><div id="trace-vector"></div></div><label><input id="trace-compare" type="checkbox"> Compare source</label><p id="trace-stat" data-ready="false"></p><p id="trace-status" role="status">Preparing trace…</p><button class="button" id="trace-copy" disabled>Copy SVG</button></div><div class="trace-controls">
<label>Trace mode<select id="trace-mode"><option value="alpha">Transparent silhouette</option><option value="colors">Color regions</option></select></label>
<label>Fill color<input id="trace-fill" type="color" value="#ffba13"></label><label>Colors<input id="trace-colors" type="number" min="2" max="16" value="6"></label>
<label>Analysis detail<select id="trace-detail"><option value="1024">1024 px</option><option value="2048" selected>2048 px</option><option value="4096">4096 px</option></select></label>
<label>Alpha threshold<input id="trace-threshold" type="range" min="1" max="255" value="128"></label><label>Simplification<input id="trace-tolerance" type="range" min="0" max="4" step=".1" value=".8"></label><label>Remove speckles<input id="trace-speckle" type="number" min="0" max="100" value="2"></label>
<label>SVG ID prefix<input id="trace-prefix" maxlength="61" value="luma-logo"></label><label>Style<select id="trace-style"><option value="fill">Filled paths</option><option value="outline">Outline paths</option></select></label><label>Stroke width<input id="trace-stroke" type="number" min=".1" max="100" step=".1" value="2"></label><label><input id="trace-animate" type="checkbox"> Draw animation</label><label><input id="trace-hide-source" type="checkbox" checked> Hide source after tracing</label>
<p class="dock-caption">Alpha tracing preserves transparent holes. Use color regions for opaque artwork. Simplification trades detail for fewer anchors.</p></div></div>`,
  [{label:'Cancel',run:()=>api.closeModal(true)},{label:'Download SVG',run:()=>{try{downloadBlob(new Blob([svg()],{type:'image/svg+xml'}),$('#trace-prefix').value.trim()+'.svg');}catch(e){api.toast(e.message,true);}}},{label:'Add editable paths',primary:true,run:add}],
  ()=>{
   $('#trace-hide-source').checked=true;
   const image=api.assets.get(snapshot.source);if(image){const sample=canvas(64,64),x=sample.getContext('2d');x.drawImage(image,0,0,64,64);const p=x.getImageData(0,0,64,64).data,bins=new Map();for(let i=0;i<p.length;i+=4)if(p[i+3]>200){const key=[p[i]>>4,p[i+1]>>4,p[i+2]>>4].join(','),bin=bins.get(key)||{sum:[0,0,0],n:0};for(let k=0;k<3;k++)bin.sum[k]+=p[i+k];bin.n++;bins.set(key,bin);}const best=[...bins.values()].sort((a,b)=>b.n-a.n)[0];if(best)$('#trace-fill').value='#'+best.sum.map(v=>Math.round(v/best.n).toString(16).padStart(2,'0')).join('');sample.width=sample.height=1;}
   for(const id of ['mode','fill','colors','detail','threshold','tolerance','speckle'])$('#trace-'+id).oninput=()=>{clearTimeout(timer);revision++;worker?.terminate();worker=null;result=null;$('#trace-copy').disabled=true;$('#trace-stat').dataset.ready='false';$('#trace-vector').innerHTML='';$('#trace-status').textContent='Tracing contours…';timer=setTimeout(run,130);};
   for(const id of ['prefix','style','stroke','animate'])$('#trace-'+id).oninput=preview;
   $('#trace-compare').onchange=()=>{$('#trace-original').style.opacity=$('#trace-compare').checked?'.45':'0';};
   $('#trace-original').style.opacity='0';$('#trace-copy').onclick=async()=>{try{await navigator.clipboard.writeText(svg());api.toast('SVG copied.');}catch(e){api.toast(e.message,true);}};void run();
  },dispose);
 }
 return {open,cancel:()=>disposeCurrent()};
}
