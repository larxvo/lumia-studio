// One task taxonomy for the side panel and accent-insensitive command search.
export const PHOTO_GROUPS=[
 ['Preset & hiệu ứng',[['art-studio','sparkles','Art & Pattern','Ảnh thành tranh, vector, chấm, dấu + và khối nổi.','photo art pattern halftone cross plus pixel vector svg 3d comic cartoon tranh dau cong cham'],['scene-studio','sparkles','Preset & Actions','Studio, chuyển mùa, ngày–đêm và hiệu ứng có thanh chỉnh.','preset action studio color season mua nang tuyet la bay autumn winter night day'],['shadow-studio','layers','Bóng vật thể & bóng bay','Chọn silhouette, tạo bóng tiếp xúc / treo / chiếu.','shadow float drop blur bong bay']]],
 ['Chân dung',[
  ['portrait-auto','user','Auto chân dung','Gọn mặt, cằm, chân mày và giảm bóng dầu.','portrait face chin jaw slim retouch da mat cam may oil'],
  ['skin-lab','clone','Da & kết cấu','Mịn tự nhiên, đốm, sắc tố và rãnh nhăn.','skin smooth da mun tan nhang nhan'],
  ['face-lab','user','Mặt & biểu cảm','Mắt, môi, chân mày và đường nét.','face smile eyes lips eyebrows cuoi'],
  ['eyes-lab','eye','Mắt đỏ & màu mắt','Sửa mắt đỏ một chạm; đổi màu mống mắt.','red eye iris mat do'],
  ['hair-lab','sparkles','Màu tóc','Đổi màu, giữ sợi và sửa mask tóc.','hair color toc'],
  ['beard-lab','user','Râu & ria mép','Giảm râu lún phún hoặc chọn kiểu râu.','beard moustache rau ria']]],
 ['Tách & xóa',[
  ['cutout-studio','mask','Tách nền & tóc','Chọn chủ thể, sửa viền và lấy lại vùng thiếu.','background remove hair cutout tach nen toc'],
  ['remove-studio','eraser','Xóa người & vật thể','Giữ người chính, xóa phần không mong muốn.','remove object person xoa nguoi vat the']]],
 ['Màu & ánh sáng',[
  ['landscape-studio','image','Phong cảnh HDR','Rõ tầng sáng, trời trong và chiều ấm.','landscape hdr sunset sky phong canh troi'],
  ['wardrobe-color','hue','Màu trang phục','Bấm áo / quần, chọn màu, giữ nếp vải.','clothes wardrobe vest ao quan color'],
  ['product-studio','sparkles','Retouch sản phẩm','Bạc sạch sáng, bề mặt và ánh sáng.','product coin silver san pham dong xu'],
  ['beverage-studio','temperature','Đồ uống & hậu cảnh','Màu ly, xóa mực, nền, nắng và bokeh.','drink cup logo background do uong ly']]],
 ['Phục hồi & tài liệu',[
  ['restore-lab','history','Phục hồi ảnh cũ','Bạc màu, nhiễu, xước và ố nhẹ.','restore old damaged wet repair anh cu'],
  ['paper-studio','image','Làm sạch tài liệu','Đều giấy, dịu bóng, rõ chữ và dấu hiện có.','document paper scan stamp tai lieu con dau'],
  ['reference-restore','history','Phục hồi từ tham chiếu','Vá vùng thiếu từ tư liệu bạn cung cấp.','reference restore missing water rach anh']]]
];
export const AI_GROUPS=[['Tạo & phục hồi bằng AI',[
 ['generative-studio','sparkles','Generative Fill','Chọn vùng để vá hoặc tái dựng.','inpaint generative fill xoa tao sinh'],
 ['ai-colorize','temperature','Tô màu ảnh đen trắng','Tạo bản tô màu để xem và chỉnh tiếp.','colorize black white to mau'],
 ['ai-expression','user','Biểu cảm AI','Cười / khép miệng qua máy AI đã kết nối.','expression smile cuoi'],
 ['ai-beard','user','Xóa / tạo râu AI','Xóa vùng râu hoặc tạo kiểu từ máy AI.','beard ai rau'],
 ['ai-art','sparkles','Art & 3D tạo sinh','Chuyển phong cách từ ảnh qua ComfyUI.','art style 3d clay toy paper minh hoa img2img'],
 ['ai-skin','clone','Retouch vùng da AI','Chọn vùng rồi xử lý dấu vết.','skin da ai']]],['Kết nối',[
 ['ai-connect','sliders','Kết nối máy AI','Thiết lập ComfyUI của bạn.','connect comfyui gpu ai']]]];
export const ADVANCED_GROUPS=[['Layer & màu in',[
 ['studio','sliders','Công cụ layer & bố cục','Căn chỉnh, biến đổi, filter và đường dẫn.','studio align transform paths filters layer'],
 ['smart-manager','layers','Smart Objects','Quản lý, sửa và thay nội dung nhúng.','smart object psd'],
 ['color-studio','hue','CMYK / ICC','Xem thử màu in và xuất TIFF có profile.','cmyk icc print in an']]],['Trao đổi & cộng tác',[
 ['canva-connect','image','Canva · mở bản gốc & retouch','Kết nối tài khoản, mở Canva native và chuyển trang qua Luma.','canva native connect oauth design'],
 ['design-import','image','Nhập thiết kế PPTX / SVG','Nhập tệp thiết kế đã xuất từ Canva.','canva pptx svg import'],
 ['collaborate','copy','Đồng biên tập','Kết nối và làm việc cùng người khác.','collaborate collab dong bien tap'],
 ['guided-color','temperature','Tô màu theo chỉ dẫn','Chọn màu tham chiếu theo từng vùng.','guided reference color mau']]],['Kiểm tra & nghiên cứu',[
 ['skin-map','clone','Bản đồ bề mặt da','Xem các vùng gợi ý cho retouch.','skin surface map da'],
 ['skin-research','clone','Nghiên cứu mô hình da','Công cụ nghiên cứu local hiện có.','research skin model da'],
 ['ai-verify','check','Kiểm chứng máy AI','Chạy job ComfyUI và xem báo cáo.','verify benchmark gpu comfyui']]]];
ADVANCED_GROUPS.push(['Ứng dụng & tương thích',[['platform-status','check','Windows & tương thích','Bản cài, PSD, Canva và tình trạng kiểm chứng GPU.','windows installer exe compatibility photoshop psd canva gpu']]]);
ADVANCED_GROUPS.unshift(['Cốt lõi thiết kế',[['core-sample','layers','Luma8 · Mẫu thực hành','Thử layer, mask, alpha, path và chữ.','core sample layer alpha path text mau'],['type-studio','text','Type Studio','Định dạng từng đoạn chữ.','type typography font text chu'],['panel-channels','adjust','Kênh & alpha','Lưu và sửa vùng chọn.','alpha channel kenh'],['panel-paths','pen','Đường & điểm neo','Work Path, đường lưu và Direct Selection.','path anchor bezier diem neo']]]);
export const SAMPLE_ACTIONS=[['core-sample','Luma8 · Layer & chữ'],['art-sample','Photo → Art & Pattern'],['scene-sample','Mùa & ánh sáng'],['retouch-sample','Chân dung'],['cutout-sample','Tách nền'],['landscape-sample','Phong cảnh'],['color-sample','Trang phục'],['beverage-sample','Đồ uống'],['paper-sample','Tài liệu'],['restore-sample','Ảnh cũ']];
export const NAV_GROUPS={photo:PHOTO_GROUPS,'ai-tools':AI_GROUPS,advanced:ADVANCED_GROUPS};
export const normalizedSearch=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
export function matchesTool(tool,query,group=''){const haystack=normalizedSearch([group,...tool].join(' '));return normalizedSearch(query).split(/\s+/).filter(Boolean).every(token=>haystack.includes(token));}
export const TOOL_INDEX=Object.values(NAV_GROUPS).flatMap(groups=>groups.flatMap(([group,items])=>items.map(tool=>({group,tool}))));
export function searchActions(items,query){const tokens=normalizedSearch(query).split(/\s+/).filter(Boolean);return items.filter(a=>{const extra=TOOL_INDEX.find(i=>i.tool[0]===a[0]);const text=normalizedSearch([a[0],a[1],extra?.group,...extra?.tool||[]].join(' '));return tokens.every(t=>text.includes(t));});}
