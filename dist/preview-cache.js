// One immutable prefix per asset store. Exports and uncached renders never use it.
const stores=new WeakMap();
const ignored=new Set(['name','locked','locks','selectedIds','photoRecipe','removalRecipe','productRecipe','cutoutRecipe','paperRecipe','colorRecipe','landscapeRecipe','sceneRecipe','artRecipe','smartObjectId']);
function fingerprint(doc,layers,assets) {
  const ids=new Set(layers.map(l=>l.id));
  let grew=true;while(grew){grew=false;for(const l of doc.layers)if(ids.has(l.parentId)&&!ids.has(l.id)){ids.add(l.id);grew=true;}}
  return JSON.stringify([doc.id,doc.width,doc.height,assets.fontRevision||0,doc.layers.filter(l=>ids.has(l.id))],(key,value)=>{
    if(ignored.has(key))return undefined;
    if(key==='source')return assets.visualToken?.(value)||value;
    return value;
  });
}
export function paintPreviewPrefix(out,doc,layers,assets,{scale,mutableIds=[]},paint) {
  const changed=new Set(mutableIds),byId=new Map(doc.layers.map(l=>[l.id,l]));
  for(const id of mutableIds){let l=byId.get(id),seen=new Set();while(l?.parentId&&!seen.has(l.id)){seen.add(l.id);changed.add(l.parentId);l=byId.get(l.parentId);}}
  let split=layers.findIndex(l=>changed.has(l.id));if(split<0)split=layers.length;
  if(split<layers.length&&(layers[split].clipToBelow||layers[split].type==='adjustment')){while(split>0){split--;if(!layers[split].clipToBelow&&layers[split].type!=='adjustment')break;}}
  if(!split){paint(out,layers);return;}
  const prefix=layers.slice(0,split),key=scale+':'+fingerprint(doc,prefix,assets);
  let entry=stores.get(assets);
  if(!entry||entry.key!==key){
    const c=document.createElement('canvas');c.width=out.width;c.height=out.height;paint(c,prefix);
    if(entry)entry.canvas.width=entry.canvas.height=1;
    entry={key,canvas:c,hits:0,misses:(entry?.misses||0)+1};stores.set(assets,entry);
  }else entry.hits++;
  out.getContext('2d').drawImage(entry.canvas,0,0);
  if(split<layers.length)paint(out,layers.slice(split));
}
export const previewCacheStats=assets=>{const c=stores.get(assets);return c?{hits:c.hits,misses:c.misses,pixels:c.canvas.width*c.canvas.height}:{hits:0,misses:0,pixels:0};};
