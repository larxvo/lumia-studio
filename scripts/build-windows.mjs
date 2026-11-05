// Build a complete offline Windows installer on Linux without executing Windows code.
// Both setup and removal executables are compiled directly with the official NSIS toolset.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,stat,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(file,args,env={})=>new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd:root,stdio:'inherit',env:{...process.env,...env}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(path.basename(file)+' exited '+code)));});
const quote=s=>'"'+String(s).replaceAll('$','$$').replaceAll('"','$\\"')+'"';
export function renderInstaller({version,payload,out,icon,license,files}){
 const common=String.raw`Unicode true
RequestExecutionLevel user
SetCompressor zlib
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
Name "Luma Studio ${version}"
BrandingText "Created by Larx Vo - vovinhlac.com - Free"
Icon ${quote(icon)}
VIProductVersion "${version}.0"
VIAddVersionKey /LANG=1033 "ProductName" "Luma Studio"
VIAddVersionKey /LANG=1033 "CompanyName" "Larx Vo"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Larx Vo - vovinhlac.com"
VIAddVersionKey /LANG=1033 "FileVersion" "${version}"
VIAddVersionKey /LANG=1033 "FileDescription" "Luma Studio setup / removal"
ShowInstDetails show
SetDatablockOptimize on
`;
 const dirs=[...new Set(files.flatMap(f=>{const a=[];let p=path.posix.dirname(f);while(p!=='.'){a.push(p);p=path.posix.dirname(p);}return a;}))].sort((a,b)=>b.split('/').length-a.split('/').length);
 const deletes=files.map(f=>'  Delete "$INSTDIR\\'+f.replaceAll('/','\\')+'"').join('\n');
 const removeDirs=dirs.map(f=>'  RMDir "$INSTDIR\\'+f.replaceAll('/','\\')+'"').join('\n');
 const uninstall=common+String.raw`
OutFile ${quote(path.join(out,'Uninstall Luma Studio.exe'))}
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  SetRegView 64
  SetShellVarContext current
  $${'{'}GetParameters${'}'} $0
  $${'{'}GetOptions${'}'} $0 "/LUMA-DIR=" $INSTDIR
  StrCmp $INSTDIR "" 0 cleanup
  ; A separate temporary copy removes only installed application files, preserving user data.
  GetTempFileName $1
  Delete $1
  StrCpy $1 "$1.exe"
  CopyFiles /SILENT "$EXEPATH" "$1"
  IfSilent silentLaunch interactiveLaunch
silentLaunch:
  Exec '"$1" /S /LUMA-DIR="$EXEDIR"'
  Goto launched
interactiveLaunch:
  Exec '"$1" /LUMA-DIR="$EXEDIR"'
launched:
  Quit
cleanup:
  FileOpen $0 "$INSTDIR\luma-install.id" r
  IfErrors invalid
  FileRead $0 $1
  FileClose $0
  StrCmp $1 "com.vovinhlac.lumastudio" valid
invalid:
  MessageBox MB_OK|MB_ICONSTOP "This is not a Luma Studio installation. No files were removed."
  Abort
valid:
FunctionEnd
Section "Remove Luma Studio"
  IfFileExists "$INSTDIR\Luma Studio.exe" 0 remove
  ClearErrors
  FileOpen $0 "$INSTDIR\Luma Studio.exe" a
  IfErrors running
  FileClose $0
  Goto remove
running:
  MessageBox MB_OK|MB_ICONSTOP "Close Luma Studio and run removal again."
  Abort
remove:
${deletes}
${removeDirs}
  Delete "$INSTDIR\Uninstall Luma Studio.exe"
  Delete "$INSTDIR\luma-install.id"
  Delete "$DESKTOP\Luma Studio.lnk"
  Delete "$SMPROGRAMS\Luma Studio.lnk"
  ReadRegStr $0 HKCU "Software\Classes\.luma" ""
  StrCmp $0 "LumaStudio.Document" 0 +2
  DeleteRegValue HKCU "Software\Classes\.luma" ""
  DeleteRegValue HKCU "Software\Classes\.psd\OpenWithProgids" "LumaStudio.Document"
  DeleteRegValue HKCU "Software\Classes\.psb\OpenWithProgids" "LumaStudio.Document"
  DeleteRegKey HKCU "Software\Classes\LumaStudio.Document"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio"
  RMDir "$INSTDIR"
  ; Projects, preferences and encrypted session tokens under AppData are retained.
SectionEnd
`;
 const setup=common+String.raw`
OutFile ${quote(path.join(out,`Luma-Studio-${version}-Setup-x64.exe`))}
InstallDir "$LOCALAPPDATA\Programs\Luma Studio"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "InstallLocation"
!define MUI_DIRECTORYPAGE_VERIFYONLEAVE
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE ${quote(license)}
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE CheckDirectory
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Luma Studio.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open Luma Studio"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  $${'{'}IfNot${'}'} $${'{'}RunningX64${'}'}
    MessageBox MB_OK|MB_ICONSTOP "Luma Studio requires Windows 10 or 11 x64."
    Abort
  $${'{'}EndIf${'}'}
  SetRegView 64
  SetShellVarContext current
FunctionEnd
Function CheckDirectory
  IfFileExists "$INSTDIR\luma-install.id" checkmarker
  IfFileExists "$INSTDIR\*.*" used valid
checkmarker:
  FileOpen $0 "$INSTDIR\luma-install.id" r
  IfErrors used
  FileRead $0 $1
  FileClose $0
  StrCmp $1 "com.vovinhlac.lumastudio" valid used
used:
  MessageBox MB_OK|MB_ICONSTOP "Choose an empty folder or an existing Luma Studio installation."
  Abort
valid:
FunctionEnd
Section "Install Luma Studio"
  ; Also validate in silent mode, where the directory page is not visited.
  Call CheckDirectory
  IfFileExists "$INSTDIR\Luma Studio.exe" 0 copy
  ClearErrors
  FileOpen $0 "$INSTDIR\Luma Studio.exe" a
  IfErrors running
  FileClose $0
  Goto copy
running:
  MessageBox MB_OK|MB_ICONSTOP "Close Luma Studio before updating."
  Abort
copy:
  SetOutPath "$INSTDIR"
  File /r ${quote(path.join(payload,'*'))}
  File ${quote(path.join(out,'Uninstall Luma Studio.exe'))}
  FileOpen $0 "$INSTDIR\luma-install.id" w
  FileWrite $0 "com.vovinhlac.lumastudio"
  FileClose $0
  CreateShortcut "$DESKTOP\Luma Studio.lnk" "$INSTDIR\Luma Studio.exe"
  CreateShortcut "$SMPROGRAMS\Luma Studio.lnk" "$INSTDIR\Luma Studio.exe"
  WriteRegStr HKCU "Software\Classes\LumaStudio.Document" "" "Luma Studio document"
  WriteRegStr HKCU "Software\Classes\LumaStudio.Document\DefaultIcon" "" '$\"$INSTDIR\Luma Studio.exe$\",0'
  WriteRegStr HKCU "Software\Classes\LumaStudio.Document\shell\open\command" "" '$\"$INSTDIR\Luma Studio.exe$\" $\"%1$\"'
  ReadRegStr $0 HKCU "Software\Classes\.luma" ""
  StrCmp $0 "" 0 +2
  WriteRegStr HKCU "Software\Classes\.luma" "" "LumaStudio.Document"
  WriteRegStr HKCU "Software\Classes\.psd\OpenWithProgids" "LumaStudio.Document" ""
  WriteRegStr HKCU "Software\Classes\.psb\OpenWithProgids" "LumaStudio.Document" ""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "DisplayName" "Luma Studio"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "DisplayVersion" "${version}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "Publisher" "Larx Vo"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "URLInfoAbout" "https://vovinhlac.com"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "DisplayIcon" '$\"$INSTDIR\Luma Studio.exe$\",0'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "UninstallString" '$\"$INSTDIR\Uninstall Luma Studio.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LumaStudio" "NoRepair" 1
SectionEnd
`;
 return{setup,uninstall};
}
async function listFiles(root,current=''){const result=[];for(const e of await readdir(path.join(root,current),{withFileTypes:true})){const rel=path.posix.join(current,e.name);if(e.isSymbolicLink())throw Error('Symlinks are not allowed in Windows payload.');if(e.isDirectory())result.push(...await listFiles(root,rel));else result.push(rel);}return result.sort();}
async function main(){
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 await run(process.execPath,[require.resolve('electron-builder/cli.js'),'--config','desktop/electron-builder.cjs','--win','--x64','--dir']);
 const out=path.join(root,'releases/windows'),payload=path.join(out,'win-unpacked');
 const files=await listFiles(payload),scripts=renderInstaller({version,payload,out,files,icon:path.join(root,'desktop/resources/luma.ico'),license:path.join(root,'LICENSE')});
 const staging=path.join(out,'nsis');await mkdir(staging,{recursive:true});
 const {getMakeNsisPath}=require('app-builder-lib/out/toolsets/windows.js');const tool=await getMakeNsisPath('0.0.0');
 for(const kind of ['uninstall','setup']){const target=path.join(staging,kind+'.nsi');await writeFile(target,scripts[kind]);await run(tool.path,['-V2',target],tool.env);}
 const filename=`Luma-Studio-${version}-Setup-x64.exe`,exe=path.join(out,filename),b=await readFile(exe),sha256=createHash('sha256').update(b).digest('hex');
 const manifest={schema:'luma-windows-release-v1',version,filename,bytes:b.length,sha256,architecture:'x64',platform:'Windows 10/11',creator:'Larx Vo · vovinhlac.com',signed:false,build:'Electron + native NSIS cross-compilation',nativeWindowsRuntimeTest:'not-performed',gpuQualityVerified:false,payloadFiles:files.length};
 await writeFile(path.join(out,'release.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(path.join(out,filename+'.sha256'),sha256+'  '+filename+'\n');
 console.log(JSON.stringify(manifest));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
