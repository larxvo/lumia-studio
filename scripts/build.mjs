import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
import path from "node:path";
await mkdir("dist/vendor", { recursive: true });
await build({ entryPoints: ["src/psd.js"], outfile: "dist/vendor/psd.js", bundle: true, format: "esm", platform: "browser", target: ["es2022"], minify: true, legalComments: "eof", alias: { util: path.resolve("scripts/util-browser.js") } });
await copyFile("node_modules/ag-psd/LICENSE", "dist/vendor/ag-psd-LICENSE.txt");
console.log("PSD adapter bundled. Static editor ready in dist/.");
await build({entryPoints:['src/interchange-zip.js'],outfile:'dist/vendor/zip.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'eof'});
await copyFile('node_modules/fflate/LICENSE','dist/vendor/fflate-LICENSE.txt');

await mkdir('dist/vendor/ort',{recursive:true});
for(const name of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await copyFile('node_modules/onnxruntime-web/dist/'+name,'dist/vendor/ort/'+name);

console.log('CPU-only ONNX runtime vendored; AI is loaded on demand.');

await mkdir("dist/vendor/lcms",{recursive:true});
for(const [src,dst] of [["dist/lcms.min.js","lcms.js"],["dist/lcms.wasm","lcms.wasm"],["LICENSE.md","LICENSE.md"]])await copyFile("node_modules/lcms-wasm/"+src,"dist/vendor/lcms/"+dst);
