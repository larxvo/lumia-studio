import {tracePixels} from './trace-core.js';
self.onmessage=event=>{try{self.postMessage({id:event.data.id,result:tracePixels(event.data.input)});}catch(error){self.postMessage({id:event.data.id,error:error.message});}};
