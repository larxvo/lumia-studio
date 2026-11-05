# Luma Studio 7.1 — Art & Pattern

**Created by Larx Vo · [vovinhlac.com](https://vovinhlac.com) · Free to use.**

Mở **Chỉnh ảnh → Preset & hiệu ứng → Art & Pattern**. Hoặc Ctrl+K tìm “art”, “pattern”, “dấu cộng”, “halftone”, “vector”, “3D”. Tệp → Ảnh mẫu → Photo → Art & Pattern có một mẫu cua do AI tạo, không dùng ảnh chụp màn hình người dùng.

## Chuyển một chạm, rồi tinh chỉnh

| Nhóm | Có sẵn | Xuất |
| --- | --- | --- |
| Pattern | Chấm halftone, dấu cộng +, silhouette ô vuông, hạt vuông, kim cương, vòng tròn, nét song song, tam giác, tổ ong | SVG hình học / PNG |
| Art | Pixel art màu, vector màu có đường bao, poster, truyện tranh, màu nước, chì phác thảo | SVG cho pixel/vector; PNG cho mọi kiểu |
| Nổi 2.5D | Khối pixel nổi, phù điêu ánh sáng | SVG cho khối; PNG cho cả hai |
| Art / 3D AI | Đất sét 3D, nhân vật 3D, giấy xếp 3D, tranh minh họa | Ảnh 2D từ ComfyUI của bạn |

17 preset local chạy ngay trên máy, không cần tài khoản AI, không tải thêm trọng số. Màu nước, truyện tranh và phù điêu là thuật toán xử lý ảnh, không giả là mô hình AI tạo sinh. Bốn phong cách AI dùng đường xử lý riêng và cần kết nối ComfyUI.

Chọn preset sẽ điền các thanh thật và thu gọn danh sách để dễ chỉnh tiếp. Các thanh tùy kiểu: mật độ lưới, kích thước hạt, bỏ vùng nhạt, độ phủ sắc độ, tương phản, góc, độ lệch tự nhiên, số màu, độ mượt, nét, vân giấy hoặc ánh sáng. Chỉ những điều khiển phù hợp mới hiện. So sánh trước/sau, zoom 200/400%, kéo ảnh và Ctrl+Z / Ctrl+Shift+Z giúp kiểm tra. Mức áp dụng 0 trả về ảnh nguồn; giữa 0–100 pha Art với ảnh trong không gian alpha phù hợp để tránh viền đen.

## Làm giống ba mẫu bạn gửi

- **Silhouette ô vuông:** dùng ảnh đã tách nền; chọn preset tương ứng. Điều chỉnh Mật độ cho ô lớn/nhỏ. Đây là hình dáng chủ thể được chia thành ô, không phải khôi phục vật bị che trong ảnh.
- **Chấm tròn:** chọn Halftone chấm. “Sáng → nhiều hạt” cho kiểu trắng trên đen như mẫu; đổi sang “Tối → nhiều hạt” nếu muốn đen trên nền sáng. Độ phủ và kích thước điều chỉnh mức sáng tổng thể.
- **Dấu cộng:** chọn Dấu cộng +, chỉnh mật độ/kích thước và màu. Cùng một ảnh có thể chuyển giữa chấm, +, hạt vuông và các hình khác mà không phải chọn chủ thể lại.

Màu hạt có một màu, màu ảnh gốc hoặc bảng màu gọn. Chọn nền giấy/màu hoặc trong suốt. Vòng tròn rỗng và các hình hạt được xuất thành hình học vector thật.

## Tách chủ thể và sửa mask

Ảnh có alpha dùng ngay được. Với ảnh còn nền, mở **Chủ thể & mask** rồi chọn **Chỉ chủ thể · AI** hoặc bấm điểm để chọn bằng SlimSAM. Cọ giữ/bỏ và Xem vùng bỏ cho phép lấy lại phần chọn thiếu, không xóa pixel nguồn. Dùng toàn ảnh bỏ mask riêng. Từng thay đổi mask có Undo/Redo và được lưu trong `.luma`.

AI có thể nhầm vật thể, bỏ sợi mảnh hoặc chọn thiếu tay/chân. Đây không phải bảo đảm mask hoàn hảo; dùng cọ hoặc công cụ Tách nền chuyên sâu để sửa trước khi xuất. Mask có sẵn của layer được đưa vào alpha nguồn đúng một lần; layer gốc vẫn giữ mask để quay lại.

## Vector và in

“Vector màu” gom màu và tạo đường bao khép kín, giữ các khoảng trống thật trong chủ thể. Đốm màu nhỏ được gộp vào vùng xung quanh, không bỏ path rồi tạo lỗ thủng. Số màu, Chi tiết lưới và Độ mượt quyết định độ gần ảnh và độ phức tạp.

SVG chứa circle/path/polygon/rect thật, không nhúng ảnh bitmap. File có tên Larx Vo và vovinhlac.com trong metadata. Đây là vector hóa xấp xỉ theo ảnh, không phải vẽ lại thủ công hoặc bảo đảm tương đương Illustrator Image Trace. Lưới phân tích đến 1024 px; tăng kích thước SVG không khôi phục chi tiết nhỏ hơn lưới. Pattern có giới hạn số hạt / biên để tránh treo máy; giảm mật độ/chi tiết khi công cụ báo quá phức tạp.

SVG chỉ xuất khi **Mức áp dụng = 100%**, vì phần pha với ảnh gốc vẫn là raster. Những kiểu tranh/phù điêu xuất PNG lossless nguyên kích thước pixel nguồn, có metadata 300 DPI. Đổi DPI không tạo thêm độ nét. Các kiểu raster được dựng theo ô có mép chồng, giữ alpha và tránh đường nối; giới hạn thực tế vẫn tùy RAM/canvas/trình duyệt.

Bấm **Xuất Art** để lưu; SVG còn có liên kết **Tải SVG đã tạo** bên dưới trạng thái để bấm lại nếu trình duyệt chưa tải. SVG đã được kiểm tra bằng parser/rasterizer độc lập; môi trường kiểm thử trình duyệt cloud chưa xác nhận được sự kiện tải SVG, trong khi tải và giải mã PNG thành công. File mẫu `qa/art-demo-cross.svg` đi kèm mã nguồn là vector thật để kiểm tra.

**Áp thành layer riêng** giữ layer nguồn ẩn. Mở **Sửa lại Art & Pattern** trong Properties để tiếp tục; Cập nhật thay kết quả cũ, không thêm bản sao. `.luma` giữ nguồn, mask và thanh chỉnh, kể cả khi nằm trong nội dung Smart Object. Layer Art trên canvas là kết quả raster có recipe; chỉnh node vector riêng lẻ cần mở SVG bằng ứng dụng vector. PSD giữ các layer được hỗ trợ và hình thức raster; không mang các thanh Art sang Photoshop.

## 3D tạo sinh

Mở **3D & minh họa AI**, chọn phong cách rồi kết nối máy AI của bạn. Ảnh chỉ gửi khi bấm **Tạo phương án**. Luma dùng ảnh gốc làm tham chiếu trong luồng img2img; không xóa toàn ảnh bằng một mask trắng trước khi mã hóa. Mức tái sinh mặc định 60%; giảm để giữ hình dáng, tăng để đổi mạnh. 100% có thể bỏ qua đặc trưng ảnh nguồn. Có tùy chọn giữ nền trong suốt gốc; bỏ chọn nếu muốn nhận cả nền AI mới.

Kết quả phụ thuộc checkpoint SD/SDXL, câu lệnh và máy chạy. Có thể đổi nhận dạng, tỷ lệ hoặc chi tiết; cần xem lại từng phương án. Luồng này xử lý cạnh dài đến 1024 px và nội suy về kích thước nguồn, chưa phải sinh chi tiết native cho ảnh lớn. Không có máy chủ GPU miễn phí được cấp kèm, không có kiểm chứng GPU thật trong lần nâng cấp này.

“Nổi 2.5D” và “3D AI” đều cho ra **ảnh minh họa 2D**, không tái dựng vật thể để xoay 360°, không xuất GLB/OBJ/STL. Luồng ảnh tham chiếu dựa trên các node chuẩn ComfyUI: [hướng dẫn img2img chính thức](https://github.com/Comfy-Org/workflow_templates/blob/main/site/knowledge/concepts/img2img.md).
