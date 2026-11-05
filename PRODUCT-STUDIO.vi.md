# Luma 6.5 — Retouch sản phẩm

**Bấm chọn đồng xu / sản phẩm → tự retouch → chỉnh lại bằng thanh trượt → áp layer riêng.** Bạc sáng sạch là preset đang chọn mặc định. AI chọn vùng bằng SlimSAM; phần màu và ánh sáng là xử lý pixel có kiểm soát trên thiết bị.

## Dùng nhanh

1. Mở ảnh và chọn layer ảnh. Bấm **Sản phẩm** trên thanh đầu, mục **Retouch sản phẩm** trong Filter hoặc thẻ đầu của Production. Với Smart Object, mở **Sửa nội dung** để xử lý ảnh ở bên trong.
2. Chọn **Bạc sáng sạch** cho bạc; chọn **Studio tự nhiên** hoặc **Ánh sáng cửa sổ** để giữ màu vật thể khác. Bấm giữa đồng xu / sản phẩm. Luma tự chọn và tinh viền ở vùng phóng gần, phân tích sắc độ rồi tạo bản xem trước.
3. Chọn **Soi sản phẩm**, kéo so sánh **Gốc / Retouch**. Chọn lại Viền 1/2/3 nếu cần. Dùng **Tô thêm**, **Bỏ vùng**, **Khoanh elip**, nới/thu và mềm viền để sửa mask.
4. Chỉnh các thanh trượt. **Ánh sáng toàn ảnh** đang bật mặc định; tắt khi chỉ muốn sửa sản phẩm và giữ nguyên pixel ở ngoài mask. Nút **Tự cân lại** tính lại mức tự động theo preset, giữ mức tổng, phạm vi toàn ảnh và thông số viền. **Về ảnh gốc** đưa các tác động về 0.
5. Bấm **Áp thành layer riêng**; ảnh gốc được giữ bên dưới. Chọn layer kết quả → **Sửa lại Retouch sản phẩm** để mở đúng ảnh nguồn và thông số, tránh xử lý chồng lên kết quả đã chỉnh.
6. Lưu `.luma` để giữ khả năng sửa tiếp. **Xuất PNG nguyên độ phân giải** trong công cụ xuất riêng ảnh đang xử lý. Export của editor xuất toàn bộ thiết kế cùng layer, transform, mask và hiệu ứng.

Mỗi lượt có một vùng sản phẩm. Bấm đối tượng khác sẽ thay vùng của lượt này và tính lại từ ảnh nguồn. Dùng cọ để thêm phần cùng sản phẩm bị bỏ sót. Các giả thuyết viền AI chỉ có trong phiên chọn; `.luma` giữ viền đã chọn cùng nét cọ.

## Thanh điều chỉnh

| Nhóm | Điều chỉnh |
| --- | --- |
| Mức tổng | Mức retouch 0–100%; mức 0 trả lại chính xác pixel nguồn. |
| Sắc bạc | Giảm ám ố, trung hòa màu bạc, độ sáng sản phẩm, nổi khối kim loại. |
| Chi tiết và hướng sáng | Tăng chi tiết còn có ở ảnh gốc, cường độ tạo khối, hướng sáng. |
| Ánh sáng toàn ảnh | Phơi sáng, vùng tối, vùng sáng, độ sâu tương phản. |
| Màu, hậu cảnh và bóng | Ấm/lạnh, độ sáng hậu cảnh, tăng bóng tiếp xúc đã có sát sản phẩm, tối góc nhẹ. |
| Vùng chọn | Nới/thu tối đa 5 pixel nguồn, mềm viền vào trong tối đa 5 pixel, cỡ cọ, lùi nét và chọn lại. |

## Cách xử lý

- Ảnh kết quả giữ kích thước nguồn, đến **16.777.216 pixel**, mỗi cạnh tối đa 8192 px. Không giảm toàn ảnh xuống kích thước model.
- SlimSAM đọc bố cục ở preview tối đa 1024 px rồi tinh viền trên crop từ nguồn. Không tải thêm weights mới cho 6.5; dùng model đã có của Subject Studio.
- Phần sáng/tối sản phẩm dùng thống kê trong mask và phân tách tần số có chuẩn hóa theo mask, tránh lấy màu bàn hoặc nền vào bạc. Trung hòa màu giảm ám vàng/nâu; tăng chi tiết chỉ dùng biến thiên nguồn. Tạo khối là biến đổi sáng tối hai chiều theo hướng chọn.
- Ánh sáng toàn ảnh là đường cong sắc độ, phơi sáng có chuyển tiếp ở vùng sáng và cân màu. Bóng tiếp xúc tăng phần tối vốn có gần mask; công cụ không dựng cảnh 3D hoặc vẽ bóng đổ mới.
- Tắt Ánh sáng toàn ảnh giữ nguyên pixel ngoài mask. Bật mục này chủ động thay đổi các pixel xung quanh theo các thanh toàn ảnh. Alpha và RGB ở pixel hoàn toàn trong suốt được giữ. Vùng chọn của tài liệu giới hạn tất cả tác động.
- Worker giữ nguồn và thống kê để thanh trượt cập nhật mà không phải chạy SAM lại. Chỉnh nhanh nhiều lần sẽ bỏ kết quả cũ và chỉ cho áp bản mới nhất. Có Dừng xử lý và Hủy.
- `.luma` giữ nguồn, preset, thông số, mask crop, nét cọ, vùng chọn và cờ cảnh báo ít chi tiết. Mở lại hiển thị ngay kết quả đã lưu. Vẽ Brush/Eraser hoặc retouch pixel trực tiếp tách recipe; Undo có thể khôi phục. Chuyển Smart Object đưa recipe vào nội dung bên trong.
- Chuyển sang Retouch Lab hay Xóa vật thể sẽ lấy pixel kết quả hiện tại làm nguồn cho layer mới, giữ các layer trước bên dưới. Recipe của công cụ trước không được gắn nhầm lên kết quả của công cụ sau.

## Giới hạn thực tế

Preset Bạc sáng sạch là lựa chọn thẩm mỹ, không tự xác định vật liệu hoặc hóa học của lớp ten. Nó giảm màu ố và cân sắc độ; không bảo đảm loại sạch từng vết đen, bụi, vết xước hay phần khắc. Bạc có thể trông phẳng nếu trung hòa hoặc nâng sáng quá nhiều; giảm mức tổng, giảm sáng hoặc tăng tương phản nhẹ và xem ở 100%.

Ảnh mất nét, chữ mờ, chi tiết đã cháy sáng không được khôi phục đúng bằng cách nâng sáng. Cảnh báo ít chi tiết là heuristic, có thể nhầm bề mặt trơn với ảnh mất nét. Chất lượng chọn vùng còn phụ thuộc viền mờ, phản chiếu, vật trong suốt và ánh sáng. Có thể sửa cọ hoặc khoanh elip; không có bảo đảm một click đạt chất lượng studio trên mọi ảnh.

Ảnh kiểm thử riêng không nằm trong source ZIP hoặc mẫu công khai. Luồng này không cần ComfyUI, API key hay GPU. CPU/WASM đã được thử trên một ảnh thực; Safari/iPhone và một tập ảnh sản phẩm đa dạng chưa được đánh giá chất lượng ở đây.

## Tự kiểm tra

```sh
npm ci
npm run build
npm test
node scripts/verify-product.mjs INPUT_IMAGE /tmp/luma-product-qa 0.5 0.5
```

Script chạy SlimSAM thật và xử lý pixel thật, xuất PNG, mask review, so sánh giữ đúng tỉ lệ và báo cáo ở thư mục ngoài source. Kiểm tra gồm độ phân giải, pixel ngoài mask khi tắt toàn ảnh và alpha. Các số đo màu/sắc độ không phải điểm chất lượng thẩm mỹ hoặc bằng chứng khôi phục chi tiết. Xem `QA.md`.
