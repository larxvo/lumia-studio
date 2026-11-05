# Luma Studio 7.0 — Larx Vo

**Created by Larx Vo · [vovinhlac.com](https://vovinhlac.com) · Free to use.**

Ứng dụng và mã nguồn miễn phí. Mã ứng dụng dùng MIT; thư viện, font và mô hình AI giữ giấy phép riêng trong các NOTICE đi kèm. Tên tác giả hiện trên thanh thương hiệu, sidebar, phần Giới thiệu, chân panel và metadata PNG/JPEG/CMYK TIFF. Ảnh xuất không có watermark phủ lên hình.

## Mở ảnh lớn và giữ chất lượng

PNG, JPEG và WebP được giữ nguồn nén cùng kích thước pixel gốc khi mở. Không còn mức chặn cố định theo MB, 16 MP hoặc cạnh 8192 px cho ảnh và tài liệu chính. Bản xem trên canvas làm việc được thu nhỏ; xuất và các công cụ xử lý giữ pixel gốc. Preset Studio dựng ảnh lớn theo các ô chồng mép để giảm bộ nhớ tạm và tránh đường nối.

Khả năng thực tế vẫn tùy RAM, bộ giải mã ảnh, canvas và trình duyệt. Một ảnh 18 MB có thể có rất nhiều pixel; dung lượng nén không nói lên RAM cần dùng. Nếu canvas không cấp phát được, Luma báo kích thước đang xử lý và giữ nguồn; không tự âm thầm hạ độ phân giải. Không có bảo đảm mở mọi kích thước trên mọi máy. Các giới hạn riêng về định dạng, số layer, ZIP/PPTX/SVG và mô hình suy luận vẫn áp dụng. RAW/HEIC, ảnh 16/32-bit và toàn bộ tính năng Photoshop chưa được hỗ trợ.

Đã kiểm tra Chrome với JPEG thử tổng hợp 25.766.300 byte, 6000 × 4000 px: mở, chạy preset, xuất PNG 6000 × 4000 có pHYs 300 DPI. Đây là kiểm tra dung lượng/kích thước, không phải thước đo chất lượng ảnh chụp hay bảo đảm cho mọi thiết bị.

## Preset rồi tinh chỉnh

Vào **Chỉnh ảnh → Preset & hiệu ứng → Preset & Actions**. Hoặc Ctrl+K tìm “preset”, “thu”, “đông”, “ngày đêm”, “shadow”. Tệp → Ảnh mẫu có ảnh cảnh do AI tạo để thử, không phải ảnh chụp dùng làm bằng chứng chất lượng.

| Nhóm | Có sẵn |
| --- | --- |
| Studio | Studio tự nhiên, Chân dung dịu, Sản phẩm sạch sáng, Film mật ong |
| Mùa | Xuân trong xanh, Thu lá vàng, Đông tuyết nhẹ |
| Ánh sáng | Chiều nắng vàng, Ngày thành đêm, Đêm thành ngày |
| Bóng | Tiếp xúc, Bay studio, Đổ theo vật thể |

Chọn một preset sẽ mở các giá trị thật trên thanh chỉnh và thu gọn danh sách preset. Điều chỉnh sáng, vùng tối/sáng, độ rực, độ trong, sắc lá, ánh trời, hạt hiệu ứng hoặc bóng. “Mức áp dụng” bằng 0 trở lại pixel gốc. So sánh, xem 200/400%, kéo ảnh và Undo/Redo giúp kiểm tra trước khi áp dụng. Ctrl+Z/Ctrl+Shift+Z hoạt động trong công cụ; sau khi áp layer, Undo của tài liệu có thể quay lại bước trước.

**Actions** có sáu chuỗi: Studio tự động, Sản phẩm có bóng mềm, Thu vàng lá bay, Đông lạnh tuyết rơi, Đêm trăng đèn, Ngày sáng trời trong. Có thể tạo action từ các bước preset, đổi thứ tự, lưu và chạy lại. Đây là action theo thông số trong Preset Studio, chưa phải trình ghi toàn bộ thao tác Photoshop hay nhập file .ATN. Preset riêng và actions lưu trong “Của tôi”, xuất/nhập JSON để chuyển máy. Không nhập .XMP/.LRTemplate của Lightroom.

## Đổi mùa, ngày đêm và lá bay

Luma dùng DeepLab chạy trên máy để gợi ý vùng người. Vùng trời dựa trên màu và kết nối với mép trên; vùng lá dựa trên màu xanh. Các vùng này có thể sai hoặc bỏ sót, đặc biệt người nhỏ, cây tối, vật thể xanh và ảnh thiếu sáng. “AI bấm chọn”, cọ thêm/bỏ và “Xem vùng” dùng để sửa. Nếu AI không tìm thấy vùng người, giao diện nói rõ; không giả định người đã được bảo vệ.

Thu vàng đổi sắc vùng lá, giữ biến thiên sáng và vân có sẵn. Lá bay dùng atlas lá có alpha, vân lá, bốn hình lá, xoay, gió, độ sâu và nhòe chuyển động. “Thời điểm” chọn vị trí của hiệu ứng trong ảnh tĩnh; chưa xuất video hoạt họa. Đông nhẹ thêm tông lạnh, lớp sương trên vùng lá và tuyết nhiều lớp; không tự tái dựng toàn bộ mặt đất thành tuyết dày.

Ngày → đêm đổi tông, trời, trăng và đèn. Điểm đèn tự động là gợi ý bảo thủ từ vùng sáng dạng cầu có trụ tối; không phải mô hình hiểu mọi loại đèn. Chọn “Chạm điểm đèn” để thêm, Alt+chạm để bỏ. “Đặt trăng / mặt trời” cho phép đặt vị trí trực tiếp. Đêm → ngày nâng vùng tối, thêm trời xanh, mây và mặt trời; không khôi phục được chi tiết đã mất trong vùng đen tuyệt đối.

Đây là hiệu ứng **2D có vùng điều khiển**, không phải tái dựng cảnh 3D hoặc mô phỏng ánh sáng vật lý. Nút “Tái dựng mùa / ánh sáng bằng AI” chuyển sang Generative Studio, điền gợi ý và vùng toàn ảnh cho ComfyUI đã kết nối. Người dùng kiểm tra cấu hình rồi chạy. Không tự có máy chủ AI miễn phí, không có GPU thật được kiểm chứng trong lần nâng cấp này; kết quả sinh có thể đổi chi tiết và cần xem lại.

## Tạo bóng cho vật thể hoặc người

Chọn **Bóng studio** trong cùng nhóm. Ảnh đã tách nền dùng alpha làm chủ thể; ảnh thường có thể chạy AI chọn chủ thể hoặc bấm chọn/cọ vùng “Vật thể / bóng”. Chọn kiểu bóng và chỉnh độ đậm, độ mềm, khoảng cách, góc. Bóng tiếp xúc/bay dùng hình mềm theo biên bao; bóng chiếu dùng silhouette trên mặt phẳng giả định. Đây chưa phải mô hình suy ra phối cảnh, độ sâu và nguồn sáng 3D. Kiểm tra chân, mặt phẳng và hướng bóng trên từng ảnh.

## Lưu và xuất in

“Áp thành layer riêng” giữ layer nguồn ẩn cùng recipe có thể mở lại; “Cập nhật layer” thay kết quả hiện tại mà không thêm bản sao. Lưu **.luma** để mang nguồn, các vùng, điểm đèn và mọi thanh chỉnh sang phiên khác. Ctrl+Z sau áp dụng phục hồi tài liệu; lịch sử Undo không được lưu thành một undo stack trong file.

**Export**: chọn PNG lossless hoặc JPEG (mặc định 100%), Scale 100% để giữ pixel gốc, đặt DPI từ 1 đến 2400. PNG/JPEG ghi mật độ in thật; PSD/PSB ghi tài nguyên resolution. WebP dành cho màn hình, không ghi DPI qua công cụ này. DPI thay kích thước in, không tạo chi tiết mới: 6000 × 4000 px tại 300 DPI tương ứng khoảng 50,80 × 33,87 cm. Xuất 200% chỉ nội suy, không phải AI khôi phục chi tiết.

In CMYK: vào **Nâng cao → Màu in**, nạp ICC CMYK do nhà in cung cấp, proof rồi xuất TIFF CMYK có nhúng ICC và DPI. Profile demo chỉ để thử, không thay profile nhà in. Không phải chế độ biên tập CMYK 16-bit gốc. PSD có giới hạn định dạng 30.000 px mỗi cạnh; dùng PSB khi cần. TIFF cổ điển dùng offset 32-bit nên file trên 4 GiB cần định dạng/chia ảnh khác. Chất lượng in còn phụ thuộc nguồn ảnh, profile, giấy và máy in.

Bản này vẫn là web editor ưu tiên laptop/desktop, có thể tự host trên Windows bằng Node.js theo README. Chưa có bộ cài Windows ký số.
