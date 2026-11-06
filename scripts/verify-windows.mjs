import {createRequire} from 'node:module';import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,rm,access} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'releases/windows');
const {getPath7za}=require('app-builder-lib/out/toolsets/7zip.js'),asar=require('@electron/asar'),{NtExecutable,NtExecutableResource,Resource}=require('resedit');
const run=(file,args)=>new Promise((resolve,reject)=>{const p=spawn(file,args,{cwd:root,stdio:'inherit'});p.on('error',reject);p.on('exit',n=>n===0?resolve():reject(Error('Archive check failed: '+n)));});
const hash=b=>createHash('sha256').update(b).digest('hex');
const release=JSON.parse(await readFile(path.join(out,'release.json'),'utf8')),installer=path.join(out,release.filename),bytes=await readFile(installer);
if(hash(bytes)!==release.sha256||bytes.length!==release.bytes||bytes.readUInt16LE(0)!==0x5a4d)throw Error('Installer integrity mismatch.');
// Windows' reduced 7za build omits the NSIS reader. Use the full 7-Zip tool.
const seven=process.env.LUMA_7ZIP||(process.platform==='win32'?path.join(process.env.ProgramFiles||'C:\\Program Files','7-Zip','7z.exe'):await getPath7za());
try{await access(seven);}catch{throw Error('Full 7-Zip is required for NSIS verification. Install 7-Zip or set LUMA_7ZIP.');}
await run(seven,['t','-tNsis','-bso0','-bsp0',installer]);
const extracted=path.join(out,'verify-extracted');await rm(extracted,{recursive:true,force:true});await mkdir(extracted,{recursive:true});await run(seven,['x','-y','-bso0','-bsp0','-o'+extracted,installer]);
async function files(root,current=''){const result=[];for(const e of await readdir(path.join(root,current),{withFileTypes:true})){const r=path.posix.join(current,e.name);if(e.isDirectory())result.push(...await files(root,r));else result.push(r);}return result;}
const unpacked=path.join(out,'win-unpacked'),expected=await files(unpacked);let checkedBytes=0;
for(const f of expected){const a=await readFile(path.join(unpacked,f));let b;try{b=await readFile(path.join(extracted,f));}catch{throw Error('Missing installer payload: '+f);}if(hash(a)!==hash(b))throw Error('Payload changed: '+f);checkedBytes+=a.length;}
const exe=await readFile(path.join(extracted,'Luma Studio.exe')),at=exe.readUInt32LE(0x3c);if(exe.readUInt32LE(at)!==0x4550||exe.readUInt16LE(at+4)!==0x8664)throw Error('Application is not x64 PE.');
const resource=NtExecutableResource.from(NtExecutable.from(exe)),version=Resource.VersionInfo.fromEntries(resource.entries)[0],strings=version.getStringValues({lang:1033,codepage:1200});
if(strings.ProductName!=='Luma Studio'||strings.CompanyName!=='Larx Vo'||!strings.ProductVersion?.startsWith(release.version))throw Error('Windows metadata branding/version mismatch.');
const archive=path.join(extracted,'resources/app.asar'),main=asar.extractFile(archive,'main.cjs'),preload=asar.extractFile(archive,'preload.cjs');
for(const [f,b]of [['main.cjs',main],['preload.cjs',preload],['canva.cjs',asar.extractFile(archive,'canva.cjs')]])if(hash(b)!==hash(await readFile(path.join(root,'desktop/app',f))))throw Error('Outdated desktop module: '+f);
if(!main.toString().includes('contextIsolation:true')||!main.toString().includes('sandbox:true')||!main.toString().includes('nodeIntegration:false'))throw Error('Missing desktop isolation.');
if(asar.listPackage(archive).some(f=>f.includes('node_modules')))throw Error('Unnecessary Node dependencies packaged.');
const editor=path.join(extracted,'resources/editor');const checked=[];
for(const f of await files(path.join(root,'dist'))){if(/^assets\/(luma-source\.part|source-manifest\.json)/.test(f))continue;const a=await readFile(path.join(root,'dist',f)),b=await readFile(path.join(editor,f));if(hash(a)!==hash(b))throw Error('Outdated editor payload: '+f);checked.push(f);}
const uninstall=await readFile(path.join(extracted,'Uninstall Luma Studio.exe'));if(uninstall.readUInt16LE(0)!==0x5a4d)throw Error('Missing removal executable.');
const report={schema:'luma-windows-artifact-verification-v1',status:'passed',version:release.version,installerSHA256:release.sha256,checkedPayloadFiles:expected.length,checkedPayloadBytes:checkedBytes,editorFilesChecked:checked.length,applicationArchitecture:'PE x64',installerType:'NSIS',productName:strings.ProductName,companyName:strings.CompanyName,signed:false,desktopIsolationChecked:true,installedOnWindows:false,uninstalledOnWindows:false,gpuQualityVerified:false,scope:'Archive CRC, every packaged file hash, source match, Windows PE metadata and desktop isolation configuration. No native Windows execution or physical GPU inference was performed.'};
await writeFile(path.join(root,'qa/platform9-windows-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
