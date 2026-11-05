# Luma 6.4 — Xóa người & vật thể

Mục tiêu là **một lần bấm để chọn đối tượng và tạo nền**, sau đó bạn duyệt trước khi áp dụng. Ảnh nguồn được giữ lại; các vùng khó có cọ và thông số để sửa tiếp.

## Cách dùng nhanh

1. Mở ảnh, chọn layer ảnh. Bấm **Xóa người** trên thanh đầu, hoặc Filter → Xóa người & vật thể.
2. Giữ bật **Tự tạo nền sau khi bấm chọn**. Bấm vào giữa người hoặc vật cần xóa. Luma tự chọn đối tượng, tinh viền ở vùng phóng gần rồi chạy tái dựng nền.
3. Chọn **Vùng đang sửa** để soi viền. Kéo Gốc / Đã xóa, xem lá, dây, bóng, hình phản chiếu và vật còn sót.
4. Bấm **Áp thành layer riêng**, hoặc xuất PNG nguyên độ phân giải. Lưu `.luma` để mở lại vùng và thông số.

Mỗi lần bấm thêm sẽ chọn đối tượng khác và dựng lại nền từ nguồn gốc cùng toàn bộ vùng đang xóa. Tối đa 8 vùng; một lần bấm có thể gợi ý thêm vật nhỏ. Lùi thao tác bỏ nét cọ cuối, hoặc cả nhóm vùng của lần bấm cuối. Các vùng tự gợi ý có thể bỏ riêng bằng nút ×.

## Các công cụ

| Công cụ | Tác dụng |
| --- | --- |
| Tự tìm & xóa người | DeepLab gợi ý vùng người rồi dùng SlimSAM tinh chọn và tạo nền. Người chạm nhau có thể chung một vùng; bấm riêng nếu cần chọn chính xác hơn. |
| Bấm chọn | Chọn một đối tượng muốn xóa. Nhận diện người có thể thêm các điểm trong vùng người để tránh chỉ chọn một mảnh áo. |
| Tô thêm vùng xóa | Thêm phần bị bỏ sót như mép áo, vật cầm, bóng hoặc mảnh đồ vật. Nét cọ này có thể ghi đè bảo vệ tự động. |
| Giữ chi tiết | Tô lên lá, cành, dây hoặc chi tiết muốn giữ nguyên. Nét này loại vùng đó khỏi phần tái dựng. |
| Chọn lại viền 1/2/3 | Xem các giả thuyết mask của SlimSAM cho vùng đang chọn. Đổi viền làm phương án cũ mất hiệu lực; bấm Cập nhật nền để dựng lại. |
| Giữ cây / lá xanh phía trước | Gợi ý màu và kết nối giữ các phần xanh còn nhìn thấy. Đây là heuristic hỗ trợ, không phải bảo đảm nhận dạng mọi loài lá hay độ sâu trước/sau. Với áo xanh hoặc vùng giữ sai, tắt hoặc tô ghi đè. |
| Giữ dây / cành sáng mảnh | Tìm cấu trúc sáng, mảnh, gần thẳng và nối với vùng ngoài. Có thể bỏ sót dây tối hoặc nhầm đường sáng trên vật; dùng cọ sửa. |
| Xóa kèm vật nhỏ sát đối tượng | Thăm dò các vật nhỏ gần phần dưới đối tượng, lọc theo kích thước, vị trí, vùng chạm và màu. Đây là gợi ý, không xác minh vật đó thuộc về người. Tắt để bỏ các vùng tự gợi ý rồi tạo lại. |
| Xóa kín khoảng hở trong viền | Lấp khoảng rỗng của silhouette; gợi ý vật nhỏ có vùng dọn giới hạn để xử lý mảnh bị che. Có thể bao gồm cả nền hoặc chi tiết trong khoảng hở; kiểm tra mask, dùng Giữ chi tiết hoặc tắt nếu cần. |
| Nới viền xóa | Mở mask thêm 0–12 pixel nguồn để tránh sót viền. Không nới từ mép toàn ảnh. |
| Mềm mép vào trong | Chuyển tiếp tối đa 4 pixel vào phía trong vùng xóa, giữ ngoài vùng không thay đổi. |
| Khớp kết cấu nền | Trộn phần chi tiết tần số cao, có giới hạn, từ các mảng nền nguồn còn nguyên và gần màu. Không lấy donor từ vùng đối tượng bị xóa; không phải tăng nét toàn ảnh. |
| Thử nền khác | Đổi kích thước ngữ cảnh quanh vùng hỏng. LaMa là xác định, không dùng seed ngẫu nhiên; ngữ cảnh khác có thể cho kết quả tương tự. Ảnh quá nhỏ có thể không có thêm ngữ cảnh. |

## Giữ độ phân giải và nguồn

- Ảnh được xử lý ở kích thước nguồn, tối đa **16.777.216 pixel**. Công cụ không tự giảm toàn bộ ảnh xuống 8 MP. Vượt giới hạn sẽ có hướng dẫn trước khi xử lý.
- Model inpainting dùng crop 512×512; các vùng xa nhau được chia thành nhóm cục bộ. Chi tiết nguồn ở ngoài mask không đi qua model và không bị làm mịn toàn ảnh.
- Pixel ngoài mask cuối và pixel bảo vệ hoàn toàn được chép nguyên từ nguồn đã giải mã. Alpha nguồn được giữ. Khẳng định này nói về pixel của editor, không phải giữ nguyên bytes tệp JPEG/PNG đã nén.
- Phần ở trong vùng bị che là dự đoán. Giữ nguyên phần ngoài mask không đồng nghĩa model tái dựng đúng từng lá ở phía sau người.
- Kết quả tạo thành layer riêng, giữ layer gốc bên dưới. Hình học, opacity, filter và mask của layer được giữ. Smart Object cần mở sửa nội dung; layer clipping cần raster độc lập; nhóm cha khóa phải được mở khóa.
- `.luma` giữ nguồn ảnh, các mask crop, tọa độ điểm, vùng chọn, nét cọ, thông số, cờ vật kèm theo và ngữ cảnh. Mở lại hiển thị ngay kết quả đã lưu, không phải chờ chạy model lại. Sửa thông số làm kết quả cũ mất hiệu lực; Cập nhật nền dựng lại từ nguồn trên cùng layer, không xử lý chồng lên ảnh đã xóa. Brush/Eraser vẽ trực tiếp sẽ tách recipe; Undo vẫn có thể khôi phục.
- Xuất PNG trong công cụ là ảnh nguồn đang xử lý ở nguyên kích thước. Dùng Export của editor để xuất toàn bộ thiết kế gồm các layer, biến đổi và hiệu ứng.

## Hiệu năng và giới hạn

Chạy trên CPU/WASM trong worker; không cần ComfyUI, API key hay GPU cho luồng này. Tải các model đã có theo nhu cầu: DeepLab, SlimSAM và LaMa; không thêm bộ weights mới trong 6.4. Xử lý có thể mất hàng chục giây mỗi vùng và lâu hơn với nhiều vùng hoặc thiết bị yếu. Có Dừng xử lý và Hủy; kết quả muộn không được áp vào tài liệu đã thay đổi.

Gợi ý vật mang theo và cây/dây dùng quy tắc bảo thủ, có thể chọn thừa hoặc thiếu. Quần áo xanh, lá khô, dây tối, đồ phản chiếu, bóng, mặt nước, hàng rào và vật bị che nhiều cần kiểm tra. LaMa có thể tạo nền mềm, lặp hoặc sai cấu trúc; khớp texture không bảo đảm cây lá sắc hoặc đúng trên mọi ảnh. Có thể tô thêm, giữ chi tiết, đổi viền, thử ngữ cảnh khác hoặc dùng tư liệu tham chiếu.

Ảnh của bạn không được gửi tới dịch vụ AI bên ngoài ở luồng này. Việc lưu trong trình duyệt và tải `.luma` vẫn theo cơ chế lưu của editor. Ảnh kiểm tra riêng không nằm trong bản phát hành nguồn hoặc mẫu công khai.

## Kiểm tra lại

```sh
npm ci
npm run build
npm test
node scripts/verify-removal.mjs INPUT_IMAGE /tmp/luma-remove-check 0.6 0.58
```

Tọa độ chuẩn hóa là vị trí bấm trên ảnh của bạn. Script chạy model thật, xuất PNG / mask review / báo cáo trong thư mục được chỉ định và kiểm tra pixel ngoài mask, pixel bảo vệ, độ phân giải. Nó không có ground truth cho vùng bị người che nên không chấm “khôi phục đúng” hoặc chứng nhận chất lượng studio. Xem **QA.md**.
