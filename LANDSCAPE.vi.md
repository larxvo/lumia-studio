# Luma 6.8 — Phong cảnh HDR một chạm

## Dùng nhanh

1. Mở ảnh hoặc chọn layer ảnh trong PSD. Bấm **Phong cảnh** ở thanh trái hoặc **Filter → Phong cảnh HDR**.
2. Luma tự phân tích sáng tối và chạy **HDR chiều nhẹ**: mở bóng tối vừa phải, giữ vùng sáng, tăng nét và màu, làm trời lạnh xanh hơn và nhấn sắc mây chiều đang có.
3. Thử bốn kiểu: **HDR chiều nhẹ**, **HDR rõ sâu**, **Trời trong xanh**, **Tự nhiên**. Bấm **HDR chiều nhẹ · 1 chạm** để trở về kiểu mặc định; **Tự cân lại** cân lại kiểu đang chọn từ ảnh nguồn.
4. Kéo so sánh: 0 là toàn bộ kết quả, 100 là toàn bộ ảnh gốc. Phóng 200%/400% rồi dùng **Kéo ảnh** để soi cây, mái nhà, dây điện và hạt trong vùng tối.
5. Chỉnh thêm các thanh theo ý. **Áp thành layer riêng** giữ ảnh gốc bên dưới và lưu thông số để sửa tiếp.

## Các thanh chỉnh

| Nhóm | Điều chỉnh |
| --- | --- |
| Tổng | Mức áp dụng |
| Tầng sáng | Dải sáng HDR, mở vùng tối, giữ vùng sáng, phơi sáng, độ sâu tương phản |
| Nét và màu | Độ trong & chi tiết, tăng nét, giảm hạt vùng tối, màu rực tự nhiên, giảm màn mờ |
| Trời và chiều | Trời xanh, độ rõ mây, ấm mây chiều, nắng nhẹ |
| Ánh ấm | Tâm ánh ấm ngang và dọc |

**Trời xanh** ưu tiên phần trời vốn lạnh/xanh. Mây vàng hồng được bảo vệ theo màu đang có; không đổi toàn bộ mây sang xanh. **Ấm mây chiều** và **Nắng nhẹ** nhấn phần mây vốn ấm, không vẽ thêm mây hoặc mặt trời mới. Dùng **Chọn tâm nắng** rồi bấm ảnh, hoặc chỉnh hai thanh vị trí, để dời tâm nhấn sáng ấm. Nếu ảnh không có vùng màu ấm phù hợp, hiệu ứng có thể rất nhẹ.

Độ nét được tăng chủ yếu trên sắc độ, giảm hiệu lực ở trời trơn và vùng quá tối. Mức quá cao vẫn có thể làm lộ hạt hoặc tạo viền; nên soi 200% khi chỉnh nhiều. **Giảm màn mờ** là cân tương phản nhẹ, không bảo đảm phân biệt được sương, khói thật và không khí mờ.

## Sửa vùng trời

- Bật **Xem vùng trời** để hiện lớp phủ xanh. Vùng này được gợi ý theo màu, độ sáng và kết nối từ mép trên ảnh; đây không phải mô hình phân loại trời chuyên dụng.
- Dùng **Thêm trời / Bỏ vùng trời** và cỡ cọ để sửa quanh cây, mái nhà, cửa kính hoặc chân trời. Có thể tô phần trời bị bỏ sót hoặc bỏ các vật sáng bị nhận nhầm.
- **Tìm trời lại** bỏ các nét sửa và tạo lại gợi ý. Có thể Ctrl+Z để lấy lại nét sửa trước đó.
- Tắt **Chỉnh trời / mây theo vùng trời** nếu ảnh không có trời hoặc gợi ý chưa phù hợp. Cân sáng HDR toàn ảnh vẫn hoạt động; các thanh trời/mây riêng không tác động khi tùy chọn này tắt.

## Hoàn tác, lưu và xuất

- **Ctrl/⌘ Z** hoàn tác; **Ctrl/⌘ Shift Z** hoặc Ctrl Y làm lại. Thông số, preset, vùng trời và nét cọ có lịch sử theo phiên, tối đa 40 bước theo ngân sách bộ nhớ. Một lần kéo slider được gộp thành một bước.
- **Về ảnh gốc** đặt mức áp dụng về 0. Bấm một preset hoặc nút một chạm để tiếp tục từ mức 100.
- **Xuất PNG nguyên độ phân giải** giữ kích thước nguồn, đến 16 MP và tối đa 8192 px mỗi cạnh. Phóng vùng xem không tăng độ phân giải ảnh xuất.
- **Save project** tạo `.luma` chứa nguồn, gợi ý mask trời 8-bit, nét cọ, preset và 17 thanh chỉnh. Chọn layer kết quả → **Sửa lại Phong cảnh HDR** để sửa cùng layer. Lịch sử từng bước trong cửa sổ không được lưu qua phiên; recipe hiện tại được lưu.
- Xuất PSD/PSB giữ layer kết quả; muốn giữ thanh chỉnh riêng của Luma cần lưu thêm `.luma`.
- Smart Object cần mở **Sửa nội dung** trước. Nếu chỉnh pixel trực tiếp bằng công cụ khác, recipe phong cảnh cũ được gỡ để công cụ tiếp theo dùng kết quả hiện tại.

## Phạm vi và kiểm chứng

Đây là **hiệu ứng HDR từ một ảnh SDR**: cân tầng sáng, màu và chi tiết có sẵn. Công cụ không ghép nhiều ảnh phơi sáng, không xuất HDR10/HEIF HDR, không phục hồi chính xác vân cây/chi tiết đã đen hoặc cháy trắng, không khôi phục nét thật của ảnh mất focus. Không có sinh ảnh hoặc mô hình mới; xử lý CPU trong Worker trên thiết bị. Bản hiện tại vẫn là ứng dụng web cho máy tính Windows/Chrome/Edge, chưa phải bộ cài `.exe`.

Ảnh phong cảnh bạn cung cấp đã được thử ở 864×1536. Preset chiều nhẹ nâng median sắc độ vùng đường quan sát từ khoảng 49,9 lên 61,2/255 và giữ vùng mây ấm. Alpha không thay đổi. Đây là số đo trên các ô quan sát thủ công của một ảnh, không phải thang điểm thẩm mỹ hay kiểm chứng trên mọi phong cảnh. Xem `QA.md` và `qa/landscape-6.8-verification.json`.

Mẫu trong Filter là minh họa Canvas có nhãn **MẪU ĐỒ HỌA**, không chứa ảnh riêng của người dùng.
