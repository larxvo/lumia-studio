# Luma 6.7 — Đổi màu trang phục & Đồ uống

Bản này ưu tiên máy tính Windows/laptop, dùng Chrome hoặc Edge. Đây là ứng dụng web và bộ source tự chạy; chưa phải bộ cài `.exe`. Các mô hình hiện chạy CPU/WASM theo nhu cầu. Không cần mua thêm dịch vụ AI cho hai công cụ này.

## Đổi màu áo, vest, quần

1. Mở ảnh JPG/PNG/WebP hoặc chọn layer ảnh trong PSD. Chọn **Màu áo** ở thanh trái hoặc **Filter → Đổi màu trang phục**.
2. Bấm giữa phần vải. Luma tạo ba phương án vùng chọn, dùng vị trí mặt được phát hiện để giảm khả năng chọn cả người, rồi thử màu Navy. Trên ảnh vest đã thử, phương án 2 bao gồm cả hai tay áo và hai vạt áo.
3. Chọn một trong 10 màu, dùng ô chọn màu hoặc nhập mã HEX. Màu chỉ tác động trong vùng chọn khi **Bật chỉnh màu toàn ảnh** đang tắt.
4. Điều chỉnh **Đổi sang màu đã chọn**, **Độ sáng vùng chọn**, **Giữ nếp & sắc độ**, **Độ rực màu**, **Mức áp dụng**. Tắt **Giữ chi tiết trắng / gần trắng** khi cần đổi một chiếc áo trắng.
5. Bật **Xem vùng chọn** và soi 200%/400% quanh cổ áo, bàn tay, sơ mi và mép tay áo. Thử Phương án 1–3 nếu AI chỉ chọn một phần hoặc chọn cả người. **AI thêm phần / AI bỏ phần** thêm điểm cho mô hình; **Cọ thêm / Cọ bỏ** sửa trực tiếp mask. **Khoanh đa giác** + Enter dùng khi AI không chọn đúng.
6. **Áp thành layer riêng** giữ layer nguồn và thông số. Chọn layer kết quả → **Sửa lại màu trang phục** để chỉnh tiếp.

Đây là chọn vùng theo điểm bấm với SlimSAM, không phải bộ phân loại loại quần áo chuyên dụng. Không bảo đảm một click đúng toàn bộ mọi áo/quần, nhất là họa tiết trùng nền, phần bị che hoặc người đứng sát nhau. Ánh sáng, nếp vải và texture dùng pixel gốc; vùng đen/trắng đã mất chi tiết không thể tự có lại vân vải chính xác. Màu HEX là màu tham chiếu trung bình; sắc độ hiển thị thay đổi theo sáng tối của vải.

## Ly nước, logo, màu và hậu cảnh

1. Chọn **Đồ uống** ở thanh trái hoặc trong Filter. Bấm giữa ly để lấy vùng ly. Nếu ảnh có phản chiếu ly xuống bàn, tùy chọn bỏ phản chiếu sát đáy giúp thử vùng chọn khác; tắt tùy chọn khi ly thật bị cắt ở mép ảnh.
2. Chọn **Trong trẻo**, **Studio kem**, **Vườn bokeh** hoặc **Nắng chiều** để có điểm bắt đầu. Mọi thanh chỉnh vẫn thay đổi được.
3. Muốn xóa logo/chữ tối: dùng **Khoanh khung nhãn** kéo vùng bao quanh hình in → **Tìm mực tối**. Vùng hồng là đề xuất, chưa xóa. Kiểm tra vùng đề xuất, dùng **Mực + / Mực −** để thêm nét sót hoặc bỏ phần trà/hoa văn bị chọn nhầm.
   Với hình in màu hoặc chữ nhỏ còn sót, chỉnh khung ôm sát toàn nhãn rồi dùng **Chọn kín khung nhãn**. Cách này tái dựng cả hình chữ nhật trong ly, có thể làm mất chi tiết đá/hoa văn nếu khung lấn vào chúng; kiểm tra vùng hồng trước khi xóa.
4. **Xóa kín hình mực & khoảng rỗng nhỏ** giúp chọn cả phần nằm trong chữ/hình kín. Độ nhạy và nới mực thay đổi cần bấm **Tìm mực tối** lại. Bấm **Xóa vùng đã chọn** để LaMa tái dựng phần ly bên dưới. Có thể tắt **Dùng kết quả xóa mực** để so lại bản gốc.
5. Chọn màu ly bằng bảng màu hoặc HEX. Giảm mức đổi màu để pha với màu gốc. **Giữ chi tiết trắng** giúp bảo vệ nắp và đá sáng.
6. Bật chỉnh toàn ảnh để thay nền, cân sáng/ấm/tương phản và thêm blur, nắng, bokeh. Nền có sẵn là gradient đồ họa. **Chọn ảnh nền của bạn** nhận JPG/PNG/WebP dưới 40 MB, tự phủ kín khung bằng cách cắt giữa. Blur có tác dụng với hậu cảnh gốc hoặc ảnh nền tự tải.
7. Vị trí nắng có thanh ngang/dọc. Bóng tiếp xúc là một vùng bóng 2D mềm ở chân vùng ly khi thay nền; không phải mô phỏng nguồn sáng vật lý.

Tìm mực là phép đề xuất nét tối trong khung nhãn, không phải OCR hoặc nhận diện mọi logo. Có thể nhầm màu trà đậm, dấu in màu hoặc hoa văn. Phần bị logo che là dự đoán; nét sót/chi tiết lạ có thể cần tô lại và chạy xóa. Chưa có phép đo chất lượng ảnh đồ uống thật đa dạng. Nhựa trong suốt vẫn có khúc xạ/phản xạ của cảnh gốc; thay nền 2D không tái dựng đúng các hiệu ứng này.

## Hoàn tác, lưu và xuất

- **Ctrl/⌘ Z** hoàn tác; **Ctrl/⌘ Shift Z** hoặc Ctrl Y làm lại. Lịch sử gồm thông số, vùng chọn, nét cọ, vùng mực, kết quả xóa và ảnh nền, tối đa 40 bước theo ngân sách bộ nhớ. Nét cọ đang vẽ kết thúc khi thả chuột. Một lần kéo thanh trượt được gộp thành một bước.
- So sánh kéo về 100 để xem gốc, 0 để xem toàn bộ kết quả. 200%/400% là phóng vùng xem, không phải tăng độ phân giải ảnh; dùng **Kéo ảnh** để soi chỗ khác.
- **Về ảnh gốc** đặt mức áp dụng bằng 0; kéo lại mức áp dụng để tiếp tục chỉnh.
- **Xuất PNG nguyên độ phân giải** giữ kích thước nguồn đến 16 MP, mỗi cạnh 8192 px. Không tăng chi tiết đã mất bằng thao tác phóng xem.
- **Save project** tải `.luma` giữ ảnh nguồn, mask nền, nét cọ, kết quả xóa, ảnh nền tự tải và toàn bộ thông số. Reopen cập nhật cùng layer kết quả. PSD/PSB giữ lớp ảnh kết quả; thông số riêng của Luma cần lưu `.luma`.
- Khi sửa trực tiếp pixel bằng công cụ khác, kết quả được dùng làm nguồn mới và recipe màu cũ được gỡ để tránh mở lại ảnh trước lần sửa đó. Smart Object cần mở **Sửa nội dung** trước khi dùng công cụ.
- Lịch sử trong cửa sổ là lịch sử theo phiên. Sau khi đóng và mở lại, các thông số/mask được giữ trong recipe, còn các bước Undo cũ trong cửa sổ không được lưu vào `.luma`.

Ảnh mẫu trong Filter là **minh họa Canvas có mask sẵn**, được ghi rõ trên ảnh. Chúng dùng để thử giao diện; không phải ảnh của người dùng hay bằng chứng AI tự chọn được ảnh đó.

## Kiểm chứng

Ảnh vest được chạy với CPU/WASM thật ở 1147×1536. Ba màu Navy/Bordeaux/Xanh rêu giữ pixel ngoài mask và alpha nguyên vẹn; phần lõi khuôn mặt được phát hiện thay đổi 0 pixel khi tắt chỉnh toàn ảnh. Đây là kiểm tra một ảnh, không phải chứng nhận trên mọi trang phục. Xem `QA.md` và báo cáo ẩn danh trong `qa/color-6.7-verification.json`.
