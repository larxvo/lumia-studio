import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import * as ort from 'onnxruntime-web/wasm';
import path from 'node:path';
import {createFaceAnalyzer} from '../dist/face-inference.js';
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=path.resolve('node_modules/onnxruntime-web/dist')+'/';ort.env.logLevel='error';
test('real CPU models detect a face, 478 landmarks and nontrivial skin on the bundled public-domain fixture',{timeout:120000},async()=>{
 const analyzer=createFaceAnalyzer(ort,{createCanvas,loadModel:name=>readFile(new URL('../dist/ai/'+name+'.onnx',import.meta.url))});
 try{const image=await loadImage(new URL('../dist/assets/portrait-demo.jpg',import.meta.url).pathname),result=await analyzer.analyze(image);assert.equal(result.faces.length,1);assert.equal(result.faces[0].points.length,478);assert.ok(result.faces[0].score>.9);const [left,right,mouth]=[33,263,13].map(i=>result.faces[0].points[i]);assert.ok(left.x<right.x&&mouth.y>left.y);const coverage=result.skin.values.filter(p=>p>.5).length/result.skin.values.length;assert.ok(coverage>.02&&coverage<.6);assert.ok(result.skin.values.every(v=>v>=0&&v<=1));assert.ok(result.skin.hair.some(v=>v>.8));assert.ok(result.skin.hair.every(v=>v>=0&&v<=1));}finally{await analyzer.dispose();}
});
