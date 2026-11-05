export const ART_FIELDS = {
  amount:['Mức áp dụng',0,100,1], density:['Mật độ / số ô cạnh ngắn',12,180,1], size:['Kích thước hạt (%)',15,140,1],
  threshold:['Bỏ vùng nhạt',0,95,1], gamma:['Độ phủ sắc độ',.3,3,.05], contrast:['Tương phản',-60,100,1],
  angle:['Góc lưới / nét',-90,90,1], jitter:['Độ lệch tự nhiên',0,30,1], seed:['Biến thể',1,9999,1],
  smooth:['Độ mượt',0,100,1], edges:['Đậm đường nét',0,100,1], colors:['Số màu',2,24,1],
  detail:['Chi tiết lưới vector',128,1024,32], speckle:['Bỏ đốm nhỏ (ô²)',0,40,1],
  depth:['Độ nổi',0,100,1], light:['Hướng sáng',0,360,1], metal:['Ánh bóng',0,100,1], texture:['Vân giấy',0,100,1]
};
export const ART_MODES=['dots','cross','square','diamond','line','ring','triangle','hex','pixel','voxel','silhouette','trace','poster','comic','watercolor','pencil','relief'];
export const VECTOR_MODES=ART_MODES.slice(0,12);
export const ART_DEFAULTS={mode:'dots',amount:100,density:80,size:95,threshold:5,gamma:.75,contrast:12,angle:0,jitter:0,seed:17,smooth:38,edges:55,colors:8,detail:512,speckle:2,depth:55,light:315,metal:35,texture:24,tone:'light',colorMode:'mono',background:'paper',ink:'#ffffff',paper:'#111315'};
export const ART_PRESETS=[
 ['dots','Pattern','Halftone chấm','Chấm tròn theo sắc độ · như mẫu',{mode:'dots'}],
 ['cross','Pattern','Dấu cộng +','Lưới dấu + · giữ dáng chủ thể',{mode:'cross',size:112,density:80,gamma:.55}],
 ['silhouette','Pattern','Silhouette ô vuông','Mảng trắng từ vùng chủ thể',{mode:'silhouette',density:70,size:100,tone:'silhouette'}],
 ['square','Pattern','Hạt vuông','Ô vuông lớn nhỏ theo ảnh',{mode:'square',density:75,size:92}],
 ['diamond','Pattern','Kim cương','Lưới hạt xoay hình thoi',{mode:'diamond',size:105}],
 ['ring','Pattern','Vòng tròn','Hạt rỗng · nét khắc nhẹ',{mode:'ring',size:96}],
 ['line','Pattern','Nét song song','Khắc nét theo độ sáng',{mode:'line',density:95,size:95,angle:-30}],
 ['triangle','Pattern','Hạt tam giác','Hình học nhiều nhịp',{mode:'triangle',size:110,density:65}],
 ['hex','Pattern','Tổ ong','Chấm lục giác',{mode:'hex',size:104}],
 ['pixel','Art','Pixel art màu','Giảm ảnh thành từng ô màu',{mode:'pixel',colorMode:'palette',density:64,size:100,colors:12,background:'transparent'}],
 ['trace','Art','Vector màu','Vùng màu có đường bao SVG thật',{mode:'trace',colorMode:'palette',colors:8,detail:512,smooth:55,background:'transparent'}],
 ['poster','Art','Poster phẳng','Bảng màu gọn · mảng rõ',{mode:'poster',colors:10,smooth:45}],
 ['comic','Art','Truyện tranh','Mảng màu & nét mực',{mode:'comic',colors:12,edges:65,smooth:55}],
 ['watercolor','Art','Màu nước','Loang dịu · vân giấy',{mode:'watercolor',colors:18,smooth:60,edges:22,texture:35}],
 ['pencil','Art','Chì phác thảo','Nét chì từ chi tiết gốc',{mode:'pencil',edges:65,smooth:55,texture:22}],
 ['voxel','Nổi 2.5D','Khối pixel nổi','Khối màu có ba mặt · SVG',{mode:'voxel',colorMode:'palette',density:42,colors:12,size:88,depth:60}],
 ['relief','Nổi 2.5D','Phù điêu ánh sáng','Bề mặt nổi từ sắc độ ảnh',{mode:'relief',smooth:65,depth:55,metal:45,light:315}]
].map(([id,group,name,note,params],index)=>({id,group,name,note,params,index}));
export const ART_AI_PRESETS=[
 ['clay','3D đất sét','A beautifully crafted 3D clay sculpture illustration of the subject in the reference image, soft rounded volumes, subtle clay texture, soft studio key light and ambient occlusion, clean composition.'],
 ['toy','3D nhân vật','A polished stylized 3D character or collectible toy interpretation of the subject in the reference image, expressive clean shapes, realistic soft studio lighting, refined materials, professional 3D illustration.'],
 ['paper','Giấy xếp 3D','An intricate layered paper sculpture and origami interpretation of the subject in the reference image, visible paper edges, dimensional folded shapes, soft studio shadows.'],
 ['paint','Tranh minh họa AI','A refined hand-painted editorial illustration of the subject in the reference image, confident painterly shapes, beautiful color harmony, deliberate brush texture.']
].map(([id,name,prompt])=>({id,name,prompt:prompt+' Preserve the main subject, recognizable identity, pose, silhouette, proportions and framing. No text, logos or watermark.'}));
export function artParams(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Thông số Art không hợp lệ.');
  const p={...ART_DEFAULTS,...input};
  for(const [k,v]of Object.entries(p)) {
    if(ART_FIELDS[k]) {const[,a,b]=ART_FIELDS[k];if(!Number.isFinite(v)||v<a||v>b||['density','colors','detail','seed','speckle'].includes(k)&&!Number.isInteger(v))throw Error('Thông số Art không hợp lệ: '+k);}
    else if(k==='mode'){if(!ART_MODES.includes(v))throw Error('Kiểu Art không hợp lệ.');}
    else if(k==='tone'){if(!['light','dark','silhouette'].includes(v))throw Error('Sắc độ không hợp lệ.');}
    else if(k==='colorMode'){if(!['mono','source','palette'].includes(v))throw Error('Màu hạt không hợp lệ.');}
    else if(k==='background'){if(!['paper','transparent'].includes(v))throw Error('Nền không hợp lệ.');}
    else if(['ink','paper'].includes(k)){if(!/^#[0-9a-f]{6}$/i.test(v))throw Error('Màu Art không hợp lệ.');}
    else throw Error('Thông số Art chưa hỗ trợ: '+k);
  }
  return p;
}
export function artPreset(id){const preset=ART_PRESETS.find(p=>p.id===id);if(!preset)throw Error('Preset Art không tồn tại.');return artParams({...ART_DEFAULTS,...preset.params});}
export const isVectorArt=p=>VECTOR_MODES.includes(p.mode);
