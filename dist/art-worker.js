import {buildArtGeometry} from './art-vector.js';
import {renderArtPixels,artPalette} from './art-pixels.js';
self.onmessage=({data:{id,input}})=>{
  try {const result=input.task==='geometry'?buildArtGeometry(input):input.task==='palette'?{palette:artPalette(input.data,input.colors)}:renderArtPixels(input);self.postMessage({id,result},result.data?[result.data.buffer]:[]);}
  catch(error){self.postMessage({id,error:error.message||'Không dựng được Art.'});}
};
