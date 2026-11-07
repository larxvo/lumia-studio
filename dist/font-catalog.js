import {validFontFamily} from './font-family.js';
const bundled=['Inter'];
let families=[...bundled],source='bundled',pending=null,error=null;
const listeners=new Set();
export function fontFamilies(doc,selected='') {
  return [...new Set([selected,...families,...(doc?.fonts||[]).map(f=>f.family)].filter(validFontFamily))].sort((a,b)=>a.localeCompare(b));
}
export const fontCatalogStatus=()=>({count:families.length,source,error});
export const onFontsChanged=callback=>{listeners.add(callback);return()=>listeners.delete(callback);};
export function loadSystemFonts({request=false,refresh=false}={}) {
  if(pending&&!refresh)return pending;
  pending=(async()=>{
    try {
      let result;
      if(window.lumaDesktop?.fonts) result=await window.lumaDesktop.fonts(refresh);
      else if(request&&typeof window.queryLocalFonts==='function') result={families:(await window.queryLocalFonts()).map(f=>f.family),source:'system'};
      else return fontCatalogStatus();
      if(!Array.isArray(result?.families))throw Error('Font catalog unavailable.');
      families=[...new Set([...bundled,...result.families.filter(validFontFamily)])].sort((a,b)=>a.localeCompare(b));source=result.source||'system';error=null;
    } catch(e) {error=e.message||'System fonts unavailable.';}
    return fontCatalogStatus();
  })().finally(()=>{pending=null;listeners.forEach(f=>f());});
  return pending;
}
