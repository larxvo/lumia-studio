import {renderSceneTile} from './scene-engine.js';
self.onmessage=({data:{id,input}})=>{try{const result=renderSceneTile(input);self.postMessage({id,result},[result.data.buffer]);}catch(e){self.postMessage({id,error:e.message});}};
