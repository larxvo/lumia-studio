import {assertImageDimensions} from './capacity.js';
export async function readOriginalImage(file,assets,{readDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);}),createCanvas}={}){
 const uri=await readDataURL(file),image=await assets.load(uri);assertImageDimensions(image.width,image.height);
 // Keep compressed source bytes. A24MP JPEG must not be inflated to a PNG string
 // just to open it. Only formats unsupported by .luma are normalized to PNG.
 if(/^data:image\/(png|jpeg|webp);base64,/.test(uri))return{source:uri,width:image.width,height:image.height,originalBytes:file.size};
 if(!createCanvas)throw Error('Định dạng ảnh cần được chuyển sang PNG trước.');const c=createCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);const source=c.toDataURL('image/png');if(!source.startsWith('data:image/png'))throw Error('Trình duyệt chưa mã hóa được ảnh này.');assets.set(source,c);return{source,width:c.width,height:c.height,originalBytes:file.size};
}
