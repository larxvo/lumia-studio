'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('lumaDesktop',Object.freeze({
  version:'9.1.0',canva:(operation,payload)=>ipcRenderer.invoke('luma:canva',operation,payload),
  fonts:refresh=>ipcRenderer.invoke('luma:fonts',refresh===true),
  environment:()=>ipcRenderer.invoke('luma:environment'),
  setLanguage:choice=>ipcRenderer.invoke('luma:language',choice),
  gpuInfo:()=>ipcRenderer.invoke('luma:gpu-info'),
  onOpen:callback=>{const handler=(_event,files)=>callback(files);ipcRenderer.on('luma:open-files',handler);return()=>ipcRenderer.removeListener('luma:open-files',handler);},
  onAction:callback=>{const handler=(_event,action)=>callback(action);ipcRenderer.on('luma:action',handler);return()=>ipcRenderer.removeListener('luma:action',handler);},
  ready:()=>ipcRenderer.send('luma:ready')
}));
