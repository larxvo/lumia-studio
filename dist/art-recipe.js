import {artParams} from './art-settings.js';
import {assertImageDimensions} from './capacity.js';
export function validateArtRecipe(r,assertSource) {
  if(!r||r.version!==1||r.engine!=='luma-art-v1')throw Error('Recipe Art không hợp lệ.');assertImageDimensions(r.width,r.height);assertSource(r.source);if(r.maskSource!==null)assertSource(r.maskSource);
  artParams(r.params);if(typeof r.originId!=='string'||typeof r.bakedMask!=='boolean')throw Error('Nguồn Art không hợp lệ.');return r;
}
