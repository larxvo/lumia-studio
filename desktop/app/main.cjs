'use strict';
const {app,BrowserWindow,Menu,dialog,ipcMain,shell,protocol,net,safeStorage,session}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const {CanvaClient,canvaURL}=require('./canva.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'luma',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
app.setName('Luma Studio');app.setAppUserModelId('com.vovinhlac.lumastudio');
let win,client,authServer,rendererReady=false,pending=[];
const extensions=/\.(luma|psd|psb|png|jpe?g|webp|gif|bmp|svg|pptx)$/i;
const queue=files=>{pending.push(...files.filter(p=>typeof p==='string'&&extensions.test(p)));void deliver();};
async function deliver(){if(!win||!rendererReady)return;const paths=pending.splice(0);for(const filename of paths){try{const bytes=new Uint8Array(await fs.readFile(filename));win.webContents.send('luma:open-files',[{name:path.basename(filename),bytes}]);}catch{await dialog.showMessageBox(win,{type:'error',message:'Không mở được '+path.basename(filename),detail:'Kiểm tra quyền đọc và bộ nhớ trống.'});}}}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',(_e,argv)=>{queue(argv.slice(1));if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.on('open-file',(e,filename)=>{e.preventDefault();queue([filename]);});
 app.whenReady().then(async()=>{
  const root=app.isPackaged?path.join(process.resourcesPath,'editor'):path.resolve(__dirname,'../../dist');
  protocol.handle('luma',request=>{const u=new URL(request.url);if(u.host!=='app')return new Response('Forbidden',{status:403});let target;try{target=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));}catch{return new Response('Bad path',{status:400});}if(!target.startsWith(root+path.sep))return new Response('Forbidden',{status:403});return net.fetch(pathToFileURL(target).href).then(result=>{const headers=new Headers(result.headers);headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: blob:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");return new Response(result.body,{status:result.status,headers});});});
  const tokenPath=path.join(app.getPath('userData'),'canva-session.bin');
  client=new CanvaClient({onTokens:async tokens=>{if(!tokens){await fs.rm(tokenPath,{force:true});return;}if(safeStorage.isEncryptionAvailable()){await fs.writeFile(tokenPath,safeStorage.encryptString(JSON.stringify(tokens)),{mode:0o600});}}});
  // Secret and tokens intentionally stay in memory until explicitly configured this session.
  // The persisted token is loaded only after client ID matches its encrypted envelope.
  const saveTokens=client.onTokens;client.onTokens=async tokens=>saveTokens(tokens?{...tokens,clientId:client.clientId}:null);
  session.defaultSession.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  win=new BrowserWindow({width:1536,height:960,minWidth:1024,minHeight:680,backgroundColor:'#1e2227',title:'Luma Studio · Larx Vo',icon:path.join(__dirname,'luma.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  win.webContents.setWindowOpenHandler(({url})=>{void openExternal(url);return{action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('luma://app/')){e.preventDefault();void openExternal(url);}});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  session.defaultSession.on('will-download',(_event,item)=>{item.setSaveDialogOptions({title:'Lưu từ Luma Studio',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Luma Studio',submenu:[{label:'Về Luma Studio',click:()=>dialog.showMessageBox(win,{title:'Luma Studio 9.0.1',message:'Luma Studio · Miễn phí',detail:'Được tạo bởi Larx Vo · vovinhlac.com\nPSD/PSB RGB 8-bit; tương thích theo từng tính năng. Canva cần kết nối tài khoản. AI GPU cần máy xử lý riêng.'})},{label:'vovinhlac.com',click:()=>shell.openExternal('https://vovinhlac.com')},{type:'separator'},{role:'quit',label:'Thoát'}]},{label:'Chỉnh sửa',submenu:[{label:'Hoàn tác',click:()=>win.webContents.send('luma:action','undo')},{label:'Làm lại',click:()=>win.webContents.send('luma:action','redo')},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'Hiển thị',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
  ipcMain.on('luma:ready',event=>{if(trusted(event)){rendererReady=true;void deliver();}});
  ipcMain.handle('luma:gpu-info',async event=>{check(event);return{schema:'luma-desktop-gpu-v1',graphics:await app.getGPUInfo('basic'),features:app.getGPUFeatureStatus(),computeVerified:false,qualityVerified:false};});
  ipcMain.handle('luma:canva',async(event,operation,payload={})=>{check(event);switch(operation){
    case 'status':return client.status();
    case 'configure':client.configure(payload);try{if(safeStorage.isEncryptionAvailable()){const t=JSON.parse(safeStorage.decryptString(await fs.readFile(tokenPath)));if(t.clientId===client.clientId)client.tokens=t;}}catch{}return client.status();
    case 'connect':return authorize();
    case 'list':return client.list(payload);
    case 'open':{const url=await client.open(payload.id);await shell.openExternal(url);return true;}
    case 'export':return client.exportPage(payload.id,payload.page);
    case 'send':{const result=await client.sendImage(payload);await shell.openExternal(result.editURL);return{id:result.id};}
    case 'disconnect':authServer?.close();return client.disconnect();
    default:throw Error('Thao tác Canva chưa hỗ trợ.');
  }});
  await win.loadURL('luma://app/index.html');queue(process.argv.slice(1));
 }).catch(()=>{dialog.showErrorBox('Luma Studio','Không khởi động được. Cài lại ứng dụng hoặc kiểm tra quyền truy cập.');app.quit();});
}
function trusted(event){return !!win&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url.startsWith('luma://app/');}
function check(event){if(!trusted(event))throw Error('Untrusted renderer.');}
async function openExternal(value){try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)await shell.openExternal(u.href);}catch{}}
function authorize(){return new Promise((resolve,reject)=>{
 if(authServer?.listening){reject(Error('Một phiên kết nối Canva đang mở.'));return;}
 let done=false;const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);authServer.close();error?reject(error):resolve(result);};
 const timer=setTimeout(()=>finish(Error('Hết thời gian chờ Canva.')),300000);
 authServer=http.createServer(async(req,res)=>{if(req.headers.host!=='127.0.0.1:47831'){res.writeHead(403).end();return;}const u=new URL(req.url,'http://127.0.0.1:47831');if(u.pathname!=='/canva/callback'||req.method!=='GET'){res.writeHead(404).end();return;}
   try{const result=await client.exchange(Object.fromEntries(u.searchParams));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'"}).end('<title>Luma Studio</title><h1>Đã kết nối Canva.</h1><p>Quay lại Luma Studio để mở thiết kế.</p>');finish(null,result);win.focus();}catch(error){res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('Kết nối Canva chưa thành công. Quay lại Luma và thử lại.');finish(error);}
 });
 authServer.on('error',()=>finish(Error('Cổng 47831 đang được dùng. Đóng phiên kết nối Canva khác rồi thử lại.')));
 authServer.listen(47831,'127.0.0.1',async()=>{try{await shell.openExternal(client.authorize());}catch(error){finish(error);}});
});}
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>authServer?.close());
