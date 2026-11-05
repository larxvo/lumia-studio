import {clone,uid} from './model.js';
import {captureProduct,assertProductSource} from './product-workflow.js';
import {validateArtRecipe} from './art-recipe.js';
export function captureArt(doc,layer) {
  if(doc.selection)throw Error('Bỏ vùng chọn tài liệu trước. Chọn một layer ảnh hoặc mở nội dung Smart Object.');if(layer?.artRecipe&&layer.locked)throw Error('Mở khóa layer Art trước khi sửa lại.');return captureProduct(doc,layer);
}
export function applyArt(doc,snapshot,output,recipe,assets) {
  const current=assertProductSource(doc,snapshot);validateArtRecipe(recipe,s=>{if(typeof s!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(s)&&s!=='assets/wave.jpg')throw Error('Nguồn Art chưa nhúng.');});
  if(output.width!==recipe.width||output.height!==recipe.height)throw Error('Kích thước Art không khớp nguồn.');if(!current.artRecipe&&doc.layers.length>=150)throw Error('Đã đạt giới hạn 150 layer.');
  const source=output.toDataURL('image/png');if(!source.startsWith('data:image/png;base64,'))throw Error('Máy chưa mã hóa được ảnh Art gốc.');
  const next={...clone(current),source,artRecipe:clone(recipe)};
  if(recipe.bakedMask)next.mask=null;
  for(const k of ['photoRecipe','cutoutRecipe','productRecipe','removalRecipe','paperRecipe','colorRecipe','landscapeRecipe','sceneRecipe','generation','assistance'])delete next[k];
  if(!current.artRecipe){next.id=uid();next.visible=true;next.locked=false;next.name=current.name.slice(0,140)+' · Art & Pattern';}
  assets.set(source,output);if(current.artRecipe)Object.assign(current,next);else{doc.layers.splice(doc.layers.indexOf(current)+1,0,next);current.visible=false;}
  doc.activeId=next.id;doc.selectedIds=[next.id];return next;
}
