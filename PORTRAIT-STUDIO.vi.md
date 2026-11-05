# Luma 6.3 — Portrait Studio

Mở ảnh, chọn layer ảnh rồi bấm **Retouch Lab**. Sáu mục có tổng cộng **42 preset**. Chọn preset trước, kéo thông số sau; kéo thanh Gốc / Kết quả hoặc chọn Soi khuôn mặt, 200%, 400%. Các mục áp cộng dồn; dòng “Đang áp dụng” cho biết mục đang có thông số. “Đặt lại mục này” chỉ đặt lại mục hiện tại.

## Công cụ và thao tác

| Nhu cầu | Đường dẫn và hành vi |
| --- | --- |
| Mắt bị đỏ do flash | Filter → **Mắt đỏ 1 chạm & màu mắt**, hoặc mục Mắt → **Sửa mắt đỏ · 1 chạm**. Chọn tất cả khuôn mặt hoặc một mặt. Chỉ sửa pixel có sắc đỏ mạnh trong vùng mống mắt; giữ điểm phản sáng. |
| Nhận diện thiếu mắt | Bấm **Chạm vào mắt**, chỉnh bán kính rồi chạm đồng tử trên preview. Tối đa 16 điểm; Lùi điểm bỏ điểm cuối. Điểm lưu theo tọa độ ảnh, dùng lại ở độ phân giải đầu ra. |
| Đổi màu mắt | Mục Mắt: nâu hạt dẻ, nâu ô liu, xanh lá, xanh lam, xám; hoặc màu tùy chọn. Có cả hai / bên trái ảnh / bên phải ảnh. Mask nằm trong mí, loại đồng tử tối và điểm lóe. Kéo Cường độ màu mắt. |
| Đổi màu tóc | Filter → **Đổi màu tóc · AI mask**. Chọn chocolate, đồng, đỏ rượu, đen, vàng, xám hoặc màu khác; chỉnh mức màu và nâng/hạ sáng. Có toàn bộ tóc / vùng gần mặt đã chọn. Bật mask, dùng cọ +/− để sửa viền; mắt, môi và chân mày được bảo vệ. |
| Thêm râu nhanh | Mục Râu: lún phún, ria mép, râu cằm, râu dê, quai nón gọn, quai nón đầy. Chỉnh màu, độ đậm, mật độ, chiều dài, biến thể sợi. Đây là mô phỏng từng sợi theo mốc mặt, chạy ngay trên thiết bị. |
| Giảm râu nhỏ | **Giảm râu lún phún** tìm sợi tối nhỏ ở phần dưới mặt và giảm bằng mẫu da lân cận. Có cọ sửa vùng. Râu dày cần tái dựng da che khuất nên dùng công cụ AI. |
| Xóa râu dày | Filter → **Râu AI · xóa râu / ria mép / quai nón**, chọn Xóa râu dày. Vùng râu theo mốc hàm được chọn sẵn, môi được loại ra. Sửa mask rồi bấm **Tạo phương án**. LaMa chạy trên CPU/WASM; có thể chọn ComfyUI. So sánh và duyệt trước khi áp. |
| Râu ảnh thật | Trong Râu AI chọn ria mép / cằm / dê / quai nón. Luồng này cần kết nối ComfyUI + checkpoint, dùng prompt sửa được. Không tự thay bằng thuật toán mô phỏng khi chưa kết nối. |
| Miệng cười | Mặt & biểu cảm: cười nhẹ, rộng, mỉm khép môi, lệch nhẹ, thư giãn, trung tính. Chỉnh cung môi, khóe, chiều ngang, độ mở, độ lệch. Các phép này biến đổi pixel hiện có. |
| Cười có răng / thay miệng | Filter → Biểu cảm AI, chọn cười tươi có răng, mỉm khép, lệch hoặc trung tính; chọn vùng miệng và tạo qua ComfyUI. Chi tiết mới cần xem và duyệt. |
| Da studio | Da studio → **Da studio · giữ lỗ chân lông**. Tách tần số để cân màu không đều và giữ chi tiết nhỏ từ ảnh gốc. Giữ kết cấu điều chỉnh độ giữ chi tiết; Hạt ảnh bổ sung mặc định **0**. |
| Đồi mồi / da nhăn | Preset Tàn nhang / đồi mồi, Nếp nhăn nhẹ, Da trưởng thành. Tinh chỉnh sắc tố, rãnh nhăn, đốm nhỏ, đỏ, kết cấu, vùng da và cọ. Có bảo vệ mắt / môi / chân mày. |

Trong mục Mặt/Râu, **Áp retouch & mở … AI** lưu kết quả retouch đang có vào layer trước, rồi mở Generative Studio từ tài liệu hiện tại. Có thể dùng Undo để quay lại.

## Lưu và sửa lại

- Áp thành layer riêng giữ ảnh gốc bên dưới. Mở lại layer Retouch để đổi thông số; không chỉnh chồng lên bản đã xử lý.
- `.luma` giữ ảnh gốc, thông số, 478 mốc mặt, mask da/tóc, điểm mắt thủ công, nét cọ và vùng chọn. Recipe cũ 6.2 mở được; khi cần vùng tóc cũ chưa lưu, nhận diện lại.
- Kết quả tối đa 8 MP; ảnh nguồn đầy đủ vẫn giữ. Hình học layer, độ trong suốt, mask layer và filter tiếp tục áp trong tài liệu. Vùng chọn hiện có giới hạn kết quả.
- PSD/PSB xuất ảnh kết quả cùng các layer được hỗ trợ. Recipe retouch đầy đủ được giữ trong `.luma`.

## Xử lý và chất lượng

Nhận diện dùng YuNet + FaceMesh V2 478 mốc và Selfie Multiclass 6 lớp đã có trong Luma. Xác suất tóc là lớp 1, da cơ thể/mặt là lớp 2/3; không suy đoán tóc bằng màu pixel. Các model tải theo nhu cầu và chạy trên CPU/WASM. Không thêm model lớn cho các preset mới.

Mắt đỏ dùng ngưỡng sắc đỏ trong vùng mắt, không phải một model phân loại bệnh mắt. Đổi màu giữ độ sáng L* trong giới hạn gamut; nâng sáng tóc không tạo thêm sợi. Da studio giữ chi tiết có sẵn, không khôi phục lỗ chân lông mà ảnh đã mất. Các preset bề mặt da xử lý dấu vết nhìn thấy, không chẩn đoán da.

Râu trực tiếp là mô phỏng đồ họa, không phải kết quả AI ảnh thật. LaMa có thể làm nhòe hoặc tạo da không đúng khi vùng râu lớn; môi, hàm, danh tính và kết cấu cần được kiểm tra. Da dưới râu và răng chưa thấy là chi tiết dự đoán. Mặt nghiêng mạnh, bị che, ánh sáng gắt, tóc bay, độ phân giải thấp và nhiều người sát nhau có thể cần cọ hoặc ảnh tham chiếu.

Đã chạy model CPU/WASM thật và kiểm tra bằng ảnh chân dung public domain, cùng các bài thử tổng hợp có ground truth. Các kiểm tra này không phải đánh giá chuẩn studio trên tập ảnh đa dạng. Chưa có kiểm chứng chất lượng ComfyUI trên GPU vật lý trong môi trường này. Xem **QA.md** và `qa/*.json` để biết bằng chứng và ranh giới kiểm tra.

## Chạy lại kiểm tra

```sh
npm ci
npm run build
npm test
node scripts/verify-portrait.mjs /tmp/luma-portrait-qa
node scripts/verify-beard-inpaint.mjs /tmp/luma-portrait-qa
```

Bài LaMa dùng râu mô phỏng trên ảnh đã biết để đo sai số và pixel ngoài mask, không được gọi là bài thử xóa râu thật. Các file ảnh trong thư mục QA là đầu ra kiểm tra có ghi nhãn.
