'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const valid=value=>typeof value==='string'&&value.trim().length>0&&value.length<=160&&!/[\u0000-\u001f\u007f"'\\;<>{}]/u.test(value);
let pending;
async function enumerateSystemFonts({refresh=false}={}) {
  if(pending&&!refresh)return pending;
  pending=(async()=>{
    let families;
    if(process.platform==='win32') {
      // Fixed command: no renderer text, filenames or arguments enter PowerShell.
      const script='[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Drawing; $fonts=New-Object System.Drawing.Text.InstalledFontCollection; try { @($fonts.Families | ForEach-Object { $_.Name }) | Sort-Object -Unique | ConvertTo-Json -Compress } finally { $fonts.Dispose() }';
      const {stdout}=await run('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});
      const result=JSON.parse(stdout.replace(/^\uFEFF/,''));families=Array.isArray(result)?result:[result];
    }else if(process.platform==='linux'){
      const {stdout}=await run('fc-list',['--format','%{family}\n'],{encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024});families=stdout.split(/\r?\n/).flatMap(line=>line.split(','));
    }else throw Error('Use Local Font Access on this platform.');
    families=[...new Set(families.filter(valid).map(f=>f.trim()))].sort((a,b)=>a.localeCompare(b));
    if(!families.length)throw Error('No system fonts were returned.');
    return {families,source:'system',platform:process.platform};
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
module.exports={enumerateSystemFonts};
