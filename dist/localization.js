import {messages} from './locales/messages.js';
const catalogs={en:new Map(),vi:new Map()},key='luma.language.v1';
for(const [en,vi]of messages){catalogs.en.set(en,en);catalogs.en.set(vi,en);catalogs.vi.set(en,vi);catalogs.vi.set(vi,vi);}
export function resolveLanguage(preferred=[],choice='auto'){if(choice==='vi'||choice==='en')return choice;for(const v of preferred){const code=String(v).toLowerCase().split(/[-_]/)[0];if(code==='vi'||code==='en')return code;}return 'en';}
let active='en';
export function translate(value,language=active){
 const original=String(value),text=original.trim(),catalog=catalogs[language]||catalogs.en;let result=catalog.get(text);
 if(result===undefined){
  const count=text.match(/^(\d+)\s+(selected|items|fonts|paths|anchors|holes|layers|đã chọn|mục|phông|đường|điểm neo|lỗ|lớp)$/u);
  if(count){const labels={layers:['layers','lớp'],lớp:['layers','lớp'],selected:['selected','đã chọn'],'đã chọn':['selected','đã chọn'],items:['items','mục'],mục:['items','mục'],fonts:['fonts','phông'],phông:['fonts','phông'],paths:['paths','đường'],đường:['paths','đường'],anchors:['anchors','điểm neo'],'điểm neo':['anchors','điểm neo'],holes:['holes','lỗ'],lỗ:['holes','lỗ']};result=count[1]+' '+labels[count[2]][language==='vi'?1:0];}
  else if(text.includes(' · ')){const parts=text.split(' · ').map(p=>translate(p,language));const joined=parts.join(' · ');if(joined!==text)result=joined;}
  if(result===undefined){for(const [en,vi]of [['Unlock','Mở khóa'],['Lock','Khóa'],['Hide','Ẩn'],['Show','Hiện'],['Close','Đóng']]){const prefix=text.startsWith(en+' ')?en:text.startsWith(vi+' ')?vi:null;if(prefix){result=(language==='vi'?vi:en)+text.slice(prefix.length);break;}}}
 }
 return result===undefined?original:original.replace(text,result);
}
export async function initializeLocalization(){
 let env;try{env=await window.lumaDesktop?.environment?.();}catch{}
 const systemLanguages=env?.languages||globalThis.navigator?.languages||window.navigator?.languages||['en'];let choice=env?.languagePreference||'auto';try{const saved=localStorage.getItem(key);if(['auto','vi','en'].includes(saved))choice=saved;}catch{}
 active=resolveLanguage(systemLanguages,choice);
 const textSources=new WeakMap(),attributeSources=new WeakMap();
 const excluded='script,style,textarea,[contenteditable="true"],[data-i18n-ignore],.layer-name strong,.document-tab>span,.property-title>strong,.trace-stage';
 function source(map,node,value){const old=map.get(node);return old&&old.rendered===value?old.source:value;}
 function textNode(node){
  const parent=node.parentElement;if(!parent||parent.closest(excluded)||parent.matches('option')&&parent.closest('[data-property="font"],#type-font'))return;
  const value=node.nodeValue;if(!value?.trim())return;
  let original=source(textSources,node,value),rendered;
  if(parent.dataset?.menu)rendered=original.replace(original.trim(),translate(parent.dataset.menu));
  else if(parent.dataset?.layerTab&&/^(Layers|Channels|Paths|History|Lớp|Kênh|Đường|Lịch sử)$/.test(original.trim()))rendered=original.replace(original.trim(),translate({layers:'Layers',channels:'Channels',paths:'Paths',history:'History'}[parent.dataset.layerTab]||original.trim()));
  else rendered=translate(original);
  if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.setAttribute('value',parent.textContent);
  textSources.set(node,{source:original,rendered});if(value!==rendered)node.nodeValue=rendered;
 }
 function attrs(el){
  if(el.closest?.(excluded))return;
  for(const name of ['title','aria-label','placeholder','aria-valuetext'])if(el.hasAttribute?.(name)){
   if(name==='aria-label'&&el.hasAttribute('data-layer'))continue;
   const value=el.getAttribute(name),old=attributeSources.get(el)||{},original=old[name]?.rendered===value?old[name].source:value,rendered=translate(original);
   old[name]={source:original,rendered};attributeSources.set(el,old);if(value!==rendered)el.setAttribute(name,rendered);
  }
 }
 function walk(node){if(node.nodeType===3){textNode(node);return;}if(node.nodeType!==1&&node.nodeType!==9)return;if(node.nodeType===1){if(node.matches(excluded))return;attrs(node);}for(const child of [...node.childNodes])walk(child);}
 const Observer=window.MutationObserver||globalThis.MutationObserver;let pending=new Set(),scheduled=false,observer;
 const options={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','aria-valuetext']};
 function flush(){scheduled=false;observer?.disconnect();const roots=[...pending];pending.clear();for(const root of roots)if(root.isConnected!==false)walk(root);observer?.observe(document.body,options);}
 function refresh(){observer?.disconnect();document.documentElement.lang=active;walk(document.body);observer?.observe(document.body,options);}
 if(Observer)observer=new Observer(records=>{for(const r of records){if(r.type==='childList')for(const n of r.addedNodes)pending.add(n);else pending.add(r.target);}if(pending.size&&!scheduled){scheduled=true;queueMicrotask(flush);}});
 refresh();
 const controller={get language(){return active;},get choice(){return choice;},systemLanguages,refresh,async setLanguage(next){if(!['auto','vi','en'].includes(next))throw Error('Invalid language.');choice=next;active=resolveLanguage(systemLanguages,choice);try{localStorage.setItem(key,choice);}catch{}const native=await window.lumaDesktop?.setLanguage?.(choice);refresh();return native?.saved!==false;},dispose(){observer?.disconnect();pending.clear();}};
 return controller;
}
export function openLanguagePreferences(controller,api){
 api.showModal('Application language','Vietnamese and English are available. Other system languages use English.',`<label class="modal-field">Language<select id="application-language"><option value="auto">Follow system</option><option value="vi">Vietnamese</option><option value="en">English</option></select></label><p>Manual language selection changes only the interface. Your layer names and text stay unchanged.</p>`,[{label:'Cancel',run:()=>api.closeModal(true)},{label:'Apply',primary:true,run:async()=>{try{const saved=await controller.setLanguage(document.querySelector('#application-language').value);api.closeModal();api.toast(saved?'Language preference saved.':'Native menu preference could not be saved.',!saved);}catch(e){api.toast(e.message,true);}}}],()=>document.querySelector('#application-language').value=controller.choice);
}
