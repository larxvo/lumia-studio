import {PHOTO_DEFAULTS,PHOTO_GROUP_FIELDS} from './photo-settings.js';
import {skinMask} from './portrait-engine.js';
import {portraitShine} from './portrait-finish.js';
export function autoPortraitParams({data,width,height,analysis,faceIndex=0,current={}}){
 if(!analysis?.faces?.[faceIndex])throw Error('Cần nhận diện được khuôn mặt trước khi tự chỉnh.');
 const params={...PHOTO_DEFAULTS,...current,faceIndex,scope:'face',protect:true};for(const key of PHOTO_GROUP_FIELDS.portrait)params[key]=PHOTO_DEFAULTS[key];
 const mask=skinMask(width,height,analysis,params),shine=portraitShine(data,width,height,mask,analysis.faces[faceIndex],100,55),pixels=mask.reduce((n,v)=>n+(v>.5?1:0),0),coverage=shine.count/Math.max(1,pixels);
 Object.assign(params,{faceSlim:18,jawSlim:20,chinSlim:18,shine:coverage>.015?62:28,shineSensitivity:55,browDensity:18,browThickness:8,stubble:28,studio:18,texture:96});
 return {params,report:{shineCoverage:coverage,skinPixels:pixels,faceIndex,method:'local-landmarks-tone-v1'}};
}
