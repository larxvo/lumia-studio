// Real CPU/WASM selection + native pixel retouch. Private inputs and outputs
// must remain outside the checkout and public release.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/wasm';
import {createCutoutEngine} from '../dist/cutout-inference.js';
import {loadCutoutModel} from '../dist/cutout-models.js';
import {selectRemovalTarget} from '../dist/removal-selection.js';
import {productMask,prepareProduct,renderProduct,autoProductParams} from '../dist/product-engine.js';
const [input,outFolder,nx='.5',ny='.5',preset='silver']=process.argv.slice(2);
if(!input||!outFolder)throw Error('Usage: node scripts/verify-product.mjs INPUT_IMAGE OUTPUT_DIRECTORY normalized_x normalized_y [preset]');
const folder=path.resolve(outFolder),repo=fileURLToPath(new URL('../',import.meta.url)),rel=path.relative(repo,folder);
if(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel))throw Error('Keep private QA outputs outside the source checkout.');
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=path.resolve('node_modules/onnxruntime-web/dist')+'/';ort.env.logLevel='error';
const fetcher=async url=>{const u=new URL(url);u.search='';const b=await readFile(u);return{ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>Uint8Array.from(b).buffer};};
const engine=createCutoutEngine(ort,{createCanvas,loadModel:k=>loadCutoutModel(k,()=>{},fetcher)});
try{
 await mkdir(folder,{recursive:true});const photo=await loadImage(input),w=photo.width,h=photo.height,source=createCanvas(w,h),sx=source.getContext('2d');sx.drawImage(photo,0,0);const data=sx.getImageData(0,0,w,h).data,scale=Math.min(1,1024/Math.max(w,h)),preview=createCanvas(Math.round(w*scale),Math.round(h*scale));preview.getContext('2d').drawImage(source,0,0,preview.width,preview.height);
 const start=performance.now(),[region]=await selectRemovalTarget(source,preview,{run:(im,opt,progress)=>engine.run(im,{...opt,onProgress:progress})},{point:{x:Number(nx),y:Number(ny)},nearby:false,imageKey:'local-product-check',createCanvas,progress:console.log}),selectionMs=performance.now()-start;
 await engine.dispose();const t=performance.now(),mask=productMask(w,h,region),context=prepareProduct({data,width:w,height:h,mask}),params=autoProductParams(context.analysis,preset),result=renderProduct(context,params),isolated=renderProduct(context,{...params,scene:false}),processingMs=performance.now()-t;
 const toImage=rgba=>{const c=createCanvas(w,h),x=c.getContext('2d'),p=x.createImageData(w,h);p.data.set(rgba);x.putImageData(p,0,0);return c;},retouched=toImage(result.data);
 await writeFile(path.join(folder,'retouched.png'),retouched.toBuffer('image/png'));await writeFile(path.join(folder,'silver-only.png'),toImage(isolated.data).toBuffer('image/png'));
 let outside=0,alpha=0,castBefore=0,castAfter=0,objectBefore=0,objectAfter=0,totalBefore=0,totalAfter=0,count=0;
 const luma=(a,k)=>a[k]*.2126+a[k+1]*.7152+a[k+2]*.0722,view=new Uint8ClampedArray(data);
 for(let i=0;i<mask.length;i++){const k=i*4;if(!mask[i]&&[0,1,2].some(c=>data[k+c]!==isolated.data[k+c]))outside++;if(data[k+3]!==result.data[k+3]||data[k+3]!==isolated.data[k+3])alpha++;if(mask[i]>.95){castBefore+=Math.abs(data[k]-data[k+2]);castAfter+=Math.abs(result.data[k]-result.data[k+2]);objectBefore+=luma(data,k);objectAfter+=luma(result.data,k);count++;}totalBefore+=luma(data,k);totalAfter+=luma(result.data,k);const a=mask[i]*.55;view[k]=view[k]*(1-a)+120*a;view[k+1]=view[k+1]*(1-a)+210*a;view[k+2]=view[k+2]*(1-a)+255*a;}
 if(outside||alpha)throw Error('Source exterior or alpha isolation failed.');await writeFile(path.join(folder,'mask-review.png'),toImage(view).toBuffer('image/png'));
 const b=context.analysis.bounds,pad=36,crop={x:Math.max(0,b.x-pad),y:Math.max(0,b.y-pad),width:Math.min(w,b.right+pad)-Math.max(0,b.x-pad),height:Math.min(h,b.bottom+pad)-Math.max(0,b.y-pad)},dw=430,dh=Math.round(crop.height/crop.width*dw),sheet=createCanvas(900,dh+70),cx=sheet.getContext('2d');cx.fillStyle='#202c35';cx.fillRect(0,0,sheet.width,sheet.height);cx.fillStyle='#e5f2fa';cx.font='17px sans-serif';cx.fillText('Source',15,25);cx.fillText('Product retouch',465,25);[source,retouched].forEach((im,i)=>cx.drawImage(im,crop.x,crop.y,crop.width,crop.height,i*450+10,48,dw,dh));await writeFile(path.join(folder,'coin-comparison.png'),sheet.toBuffer('image/png'));
 const report={runtime:'Real CPU/WASM SlimSAM global + local crop; deterministic native pixel tone processing',dimensions:[w,h],selectionMs:Math.round(selectionMs),processingMs:Math.round(processingMs),preset,params,lowDetailWarning:context.analysis.blurred,maskPixels:mask.reduce((n,v)=>n+(v>0),0),outsideMaskChangedSilverOnly:outside,alphaChangedPixels:alpha,meanRedBlueDifferenceBefore:castBefore/Math.max(1,count),meanRedBlueDifferenceAfter:castAfter/Math.max(1,count),objectMeanLuminanceBefore:objectBefore/Math.max(1,count),objectMeanLuminanceAfter:objectAfter/Math.max(1,count),sceneMeanLuminanceBefore:totalBefore/(w*h),sceneMeanLuminanceAfter:totalAfter/(w*h),resultStats:result.stats,isolatedStats:isolated.stats,limitation:'Tone/cast measurements are functional evidence, not a photographic quality score or material/chemistry classification. No clean ground-truth photo exists. Original defocus, scratches and lost lettering cannot be recovered by this operation.'};await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await engine.dispose();}
