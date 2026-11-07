import {readFile,readdir} from 'node:fs/promises';
import {parse} from '../.locale-audit/node_modules/acorn/dist/acorn.mjs';
import {translate} from '../dist/localization.js';
const vietnamese=/[ăâđêôơưĂÂĐÊÔƠƯ\u1ea0-\u1ef9]/u,found=new Map();
function add(text,file){
 text=String(text||'').trim();if(!text||text.length>1000||!vietnamese.test(text))return;
 if(/[<>]/.test(text)){
  for(const m of text.matchAll(/>([^<>]+)</g))if(!/[{}]/.test(m[1]))add(m[1],file);
  for(const m of text.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]+)"/g))if(!/[{}]/.test(m[1]))add(m[1],file);
  return;
 }
 if(/[{}]|(?:const|function|return)\s/.test(text)||/aria-label=|title=/.test(text))return;
 if(!vietnamese.test(translate(text,'en')))return;
 if(!found.has(text))found.set(text,new Set());found.get(text).add(file);
}
function walk(node,file){
 if(!node||typeof node!=='object')return;
 if(node.type==='Literal'&&typeof node.value==='string')add(node.value,file);
 if(node.type==='TemplateElement')add(node.value.cooked||node.value.raw,file);
 for(const [key,value]of Object.entries(node))if(key!=='start'&&key!=='end'&&key!=='value'){if(Array.isArray(value))value.forEach(v=>walk(v,file));else walk(value,file);}
}
for(const name of await readdir('dist')){
 if(!name.endsWith('.js')||!/-ui\.js$|-settings\.js$|photo-lab|workspace|desktop|app\.js|document-tools|cursor-theme|type-studio|platform-studio/.test(name))continue;
 const source=await readFile('dist/'+name,'utf8');walk(parse(source,{ecmaVersion:'latest',sourceType:'module'}),name);
}
const html=await readFile('dist/index.html','utf8');add(html,'index.html');
const rows=[...found].map(([text,files])=>({text,files:[...files]})).sort((a,b)=>a.text.localeCompare(b.text));
console.log('LUMA_LOCALE_AUDIT_BEGIN');console.log(JSON.stringify(rows));console.log('LUMA_LOCALE_AUDIT_END');
