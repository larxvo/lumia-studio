'use strict';
// Official Canva REST API connector. Tokens and client secret never cross into the renderer.
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const API='https://api.canva.com/rest/v1';
const SCOPES='design:meta:read design:content:read design:content:write asset:read asset:write';
function id(value){if(typeof value!=='string'||!/^[-\w]{1,160}$/.test(value))throw Error('ID Canva không hợp lệ.');return encodeURIComponent(value);}
function canvaURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='canva.com'||u.hostname.endsWith('.canva.com')))throw Error('Canva không trả URL hợp lệ.');return u.href;}
class CanvaClient {
  constructor({fetchImpl=fetch,now=Date.now,onTokens=async()=>{},tokens=null}={}){this.fetch=fetchImpl;this.now=now;this.onTokens=onTokens;this.tokens=tokens;this.pending=null;this.refreshing=null;}
  configure({clientId,clientSecret,redirectURI='http://127.0.0.1:47831/canva/callback'}){
    if(typeof clientId!=='string'||!/^[-\w]{3,200}$/.test(clientId)||typeof clientSecret!=='string'||clientSecret.length<5||clientSecret.length>1000)throw Error('Nhập Client ID và Client secret từ Canva Developer Portal.');
    const u=new URL(redirectURI);if(u.origin!=='http://127.0.0.1:47831'||u.pathname!=='/canva/callback'||u.search||u.hash)throw Error('Redirect URI phải là http://127.0.0.1:47831/canva/callback.');
    if(this.clientId&&this.clientId!==clientId){this.tokens=null;void this.onTokens(null);}
    this.clientId=clientId;this.clientSecret=clientSecret;this.redirectURI=u.href;this.pending=null;
  }
  status(){return{configured:!!this.clientSecret,connected:!!this.tokens,clientId:this.clientId||'',scope:SCOPES};}
  authorize(){
    if(!this.clientSecret)throw Error('Chưa cấu hình Canva.');
    const verifier=randomBytes(64).toString('base64url'),state=randomBytes(32).toString('base64url');
    this.pending={verifier,state,until:this.now()+300000};
    const u=new URL('https://www.canva.com/api/oauth/authorize');u.search=new URLSearchParams({client_id:this.clientId,response_type:'code',redirect_uri:this.redirectURI,scope:SCOPES,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return u.href;
  }
  async exchange(params){
    const p=this.pending,got=Buffer.from(String(params.state||'')),expected=Buffer.from(p?.state||'');
    if(!p||p.until<this.now()||got.length!==expected.length||!timingSafeEqual(got,expected))throw Error('Phiên Canva hết hạn hoặc state không khớp.');
    this.pending=null;
    if(params.error)throw Error('Bạn chưa cấp quyền Canva.');
    if(typeof params.code!=='string'||!params.code||params.code.length>4096)throw Error('Canva không trả mã đăng nhập.');
    return this.token({grant_type:'authorization_code',code:params.code,code_verifier:p.verifier,redirect_uri:this.redirectURI});
  }
  async token(fields){
    const r=await this.fetch(API+'/oauth/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Basic '+Buffer.from(this.clientId+':'+this.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString()});
    if(!r.ok)throw Error('Canva từ chối xác thực (HTTP '+r.status+'). Kiểm tra cấu hình hoặc kết nối lại.');
    const t=await r.json();if(typeof t.access_token!=='string'||typeof t.refresh_token!=='string'||!Number.isFinite(t.expires_in)||t.expires_in<=0)throw Error('Phản hồi token Canva không hợp lệ.');
    this.tokens={access_token:t.access_token,refresh_token:t.refresh_token,expiresAt:this.now()+t.expires_in*1000};await this.onTokens(this.tokens);return this.status();
  }
  async access(force=false){
    if(!this.clientSecret||!this.tokens)throw Error('Kết nối tài khoản Canva trước.');
    if(force||this.tokens.expiresAt<this.now()+60000){
      if(!this.refreshing)this.refreshing=this.token({grant_type:'refresh_token',refresh_token:this.tokens.refresh_token}).finally(()=>{this.refreshing=null;});
      await this.refreshing;
    }return this.tokens.access_token;
  }
  async request(path,{method='GET',body,headers={}}={},retry=true){
    const token=await this.access();const r=await this.fetch(API+path,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});
    if(r.status===401&&retry){await this.access(true);return this.request(path,{method,body,headers},false);}
    if(!r.ok)throw Error('Canva HTTP '+r.status+(r.status===429?' · Đã chạm giới hạn, hãy thử lại sau.':r.status===403?' · Kiểm tra quyền và gói Canva của bạn.':'. Hãy thử lại hoặc kết nối lại.'));
    return r.json();
  }
  async list({query='',continuation=''}={}){const q=new URLSearchParams();if(query)q.set('query',String(query).slice(0,200));if(continuation)q.set('continuation',String(continuation).slice(0,4096));const r=await this.request('/designs?'+q);return{items:(r.items||[]).map(d=>({id:d.id,title:d.title||'Untitled',thumbnail:d.thumbnail?.url?canvaURL(d.thumbnail.url):null})),continuation:r.continuation||''};}
  async get(designId){return (await this.request('/designs/'+id(designId))).design;}
  async open(designId){const d=await this.get(designId);return canvaURL(d.urls?.edit_url);}
  async poll(path,{attempts=90,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
    for(let i=0;i<attempts;i++){const r=await this.request(path),j=r.job;if(j?.status==='success')return j;if(j?.status==='failed')throw Error('Canva không xử lý được tác vụ. Kiểm tra quyền hoặc định dạng thiết kế.');if(j?.status!=='in_progress')throw Error('Trạng thái tác vụ Canva không hợp lệ.');await wait(1500);}throw Error('Canva chưa hoàn thành sau thời gian chờ. Có thể thử lại sau.');
  }
  async exportPage(designId,page=1){
    if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Số trang không hợp lệ.');
    const r=await this.request('/exports',{method:'POST',body:{design_id:decodeURIComponent(id(designId)),format:{type:'png',lossless:true,pages:[page]}}});
    const j=await this.poll('/exports/'+id(r.job?.id));if(!j.urls?.length)throw Error('Canva chưa trả ảnh.');
    const url=canvaURL(j.urls[0]),response=await this.fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('Không tải được trang Canva.');const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<8||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Canva trả dữ liệu khác PNG; không thể mở như ảnh.');
    const d=await this.get(designId);return{bytes:new Uint8Array(bytes),name:(d.title||'Canva').slice(0,160)+' · trang '+page+'.png',designId,page};
  }
  async sendImage({bytes,name,width,height}){
    if(!(bytes instanceof Uint8Array)||bytes.length<8||!Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Cần ảnh PNG hợp lệ.');
    if(![width,height].every(n=>Number.isSafeInteger(n)&&n>=40&&n<=8000)||width*height>25000000)throw Error('Canva giới hạn thiết kế mới 40–8000 px mỗi cạnh, tối đa 25 MP. Hãy xuất ảnh nhỏ hơn để gửi.');
    const title=String(name||'Luma Studio').slice(0,50);
    const r=await this.request('/asset-uploads',{method:'POST',body:Buffer.from(bytes),headers:{'Content-Type':'application/octet-stream','Asset-Upload-Metadata':JSON.stringify({name_base64:Buffer.from(title).toString('base64')})}});
    const j=await this.poll('/asset-uploads/'+id(r.job?.id));
    const result=await this.request('/designs',{method:'POST',body:{type:'type_and_asset',design_type:{type:'custom',width,height},asset_id:j.asset?.id,title}});
    return{id:result.design?.id,editURL:canvaURL(result.design?.urls?.edit_url)};
  }
  async disconnect(){if(this.tokens&&this.clientSecret){const t=this.tokens.refresh_token;try{await this.fetch(API+'/oauth/revoke',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Basic '+Buffer.from(this.clientId+':'+this.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:t}).toString()});}catch{/* Local credentials are still cleared. */}}
    this.pending=null;this.tokens=null;this.clientSecret=null;await this.onTokens(null);return this.status();}
}
module.exports={CanvaClient,canvaURL,SCOPES};
