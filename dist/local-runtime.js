let session=null;
if(typeof location!=='undefined'&&typeof history!=='undefined'&&location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)){
 const hash=new URLSearchParams(location.hash.slice(1)),token=hash.get('luma-local-token');
 if(token&&/^[A-Za-z0-9_-]{40,100}$/.test(token)){
  session={token,origin:location.origin};hash.delete('luma-local-token');const rest=hash.toString();history.replaceState(null,'',location.pathname+location.search+(rest?'#'+rest:''));
 }
}
export function localRuntime(){return session?{...session}:null;}
export async function localRequest(path,{method='GET',body,signal}={}){
 if(!session)throw Error('Mở Luma bằng Start-Luma.ps1 và liên kết phiên local. Bản web không tự truy cập máy của bạn.');
 if(!['/api/local-info','/api/cuda-proof','/api/skin-classify'].includes(path))throw Error('Unknown local operation.');
 const response=await fetch(session.origin+path,{method,signal,credentials:'omit',headers:{Authorization:'Bearer '+session.token,...body?{'Content-Type':'application/json'}:{}},...body?{body:JSON.stringify(body)}:{}});
 const value=await response.json();if(!response.ok)throw Error(value.error||'Máy local chưa sẵn sàng.');return value;
}
