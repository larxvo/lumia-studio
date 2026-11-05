import test from 'node:test';import assert from 'node:assert/strict';import {setupDOM,tick} from './ui-harness.mjs';import {createCanvas} from '@napi-rs/canvas';
globalThis.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:'+blob.type+';base64,'+Buffer.from(bytes).toString('base64');this.onload?.();}).catch(error=>{this.error=error;this.onerror?.();});}};
const {window,document}=await setupDOM(),calls=[];let connected=false,configured=false;
const png=createCanvas(100,80);png.getContext('2d').fillRect(0,0,100,80);
window.lumaDesktop={ready(){calls.push(['ready']);},onOpen(fn){this.openHandler=fn;},onAction(){},async canva(op,p){calls.push([op,p]);
 if(op==='status')return{connected,configured,clientId:''};
 if(op==='configure'){configured=true;return{connected,configured,clientId:p.clientId};}
 if(op==='connect'){connected=true;return{connected,configured,clientId:'fixture-client'};}
 if(op==='list')return{items:[{id:'design-fixture',title:'Design <script>fixture</script>',thumbnail:null}],continuation:''};
 if(op==='export')return{bytes:new Uint8Array(png.toBuffer('image/png')),name:'Canva page.png',designId:p.id,page:p.page};
 if(op==='disconnect'){connected=false;return{connected,configured:false};}
 return true;
}};
const {studio}=await import('../dist/app.js');for(let i=0;i<80&&!studio.ready();i++)await tick();
const $=s=>document.querySelector(s),click=s=>{assert.ok($(s),s);$(s).dispatchEvent(new window.Event('click',{bubbles:true}));};
test('Canva connection dialog reaches native design, page import and source metadata with isolated desktop bridge',async()=>{
 await studio.runAction('canva-connect');await tick();assert.equal($('#canva-connection').textContent,'Chưa cấu hình');
 $('#canva-client-id').value='fixture-client';$('#canva-client-secret').value='fixture-secret';click('#canva-configure');await tick();assert.equal($('#canva-client-secret').value,'');
 click('#canva-connect');await tick();assert.equal($('#canva-connection').textContent,'Đã kết nối');assert.equal(document.querySelectorAll('.canva-design-card script').length,0);
 click('[data-native-open]');await tick();assert.ok(calls.some(c=>c[0]==='open'&&c[1].id==='design-fixture'));
 $('.canva-page').value='2';click('[data-canva-import]');for(let i=0;i<30&&$('#modal').open;i++)await tick();
 const d=studio.getDocument();assert.equal(d.width,100);assert.equal(d.height,80);assert.equal(d.layers.length,1);assert.equal(d.canvaSource.designId,'design-fixture');assert.equal(d.canvaSource.page,2);assert.equal(d.canvaSource.representation,'flattened-png');
 assert.ok(calls.some(c=>c[0]==='ready'));
});
test('compatibility UI describes supported filters and distinguishes real GPU validation',async()=>{await studio.runAction('platform-status');assert.match($('#modal-content').textContent,/High Pass, Invert/);assert.match($('#modal-content').textContent,/Không tương thích toàn bộ Photoshop/);assert.match($('#modal-content').textContent,/Chỉ xác nhận GPU sau khi chạy thật/);click('[data-modal-close]');});
