# Luma Studio 6.2 — Tách nền, vật thể và tóc

Bấm **Tách nền** trên thanh trên cùng, hoặc **Production → Tách nền & vật thể**. Công cụ làm việc trên một layer ảnh; giữ dữ liệu nguồn để tiếp tục chỉnh PSD hoặc dự án .luma. Không cần bộ GPU/ComfyUI để sử dụng các chức năng này.

## Chọn đúng cách tách

| Chế độ | Thao tác | Phù hợp / giới hạn |
| --- | --- | --- |
| Tách nền | Bấm Tự tách nền | U²-Net nhỏ tìm chủ thể nổi bật, không gán tên mọi vật thể. Ảnh nhiều chủ thể có thể cần điểm bấm. |
| Người & tóc | Bấm Tách chân dung & viền tóc | MODNet tạo alpha mềm cho người trong ảnh. Kiểm tra tóc mảnh, nền gần màu, vai áo và phụ kiện. |
| Chỉ vùng tóc | Bấm Nhận diện & tách tóc | Vùng tóc MediaPipe kết hợp alpha MODNet, để tạo mask tóc riêng. Bản đồ bộ phận 256×256 không giữ chính xác mọi khe/sợi tóc. |
| Bấm vật thể | Bấm điểm trong vật cần giữ; chọn Điểm bỏ hoặc chuột phải để bỏ nền | SlimSAM-77 trả ba phương án biên. Chọn phương án phù hợp rồi thêm điểm; tối đa 24 điểm cho một vùng. Mô hình không tự đặt tên vật thể. |

**Nhận diện vật thể** tìm các vùng thuộc 20 nhóm Pascal VOC như người, chai/lọ, chó, mèo, xe, ghế và cây. Chọn vùng gợi ý, rồi bấm **Cập nhật theo điểm** để tinh chọn bằng SlimSAM. Vùng gợi ý được tách từ semantic map, không phải một object detector/instance segmenter mới. Các đối tượng chạm nhau có thể bị gộp; đồ vật ngoài nhóm có thể không được gợi ý nhưng vẫn dùng điểm bấm được.

## Duyệt và sửa viền

- Đổi nền kiểm tra sang trắng, tối hoặc hồng để thấy phần nền còn sót; nền này không được đưa vào PNG xuất.
- Đổi kiểu xem giữa Kết quả, Vùng giữ, Mask đen/trắng và Ảnh gốc.
- Vừa khung hiển thị toàn ảnh. Zoom 200%/400% và cuộn để soi viền.
- Điểm giữ / bỏ cập nhật AI. Cọ giữ / xóa sửa alpha trực tiếp, không cần chạy lại model; Lùi nét / điểm bỏ lần chỉnh cuối.
- Co/nới mép, Mềm mép, Độ chắc mask, Bám theo viền ảnh và Đảo vùng giúp tinh chỉnh. Giá trị co/mềm tính theo pixel của mask phân tích. Tăng độ chắc quá cao có thể làm mất phần tóc bán trong suốt.
- Đổi chế độ hoặc chạy lại AI sẽ tạo lại mask hiện tại, bỏ các nét tinh chỉnh của mask đó. Các đối tượng đã Giữ được bảo toàn.

## Tách nhiều đối tượng thành layer

1. Chọn một vật thể, duyệt và sửa mask.
2. Bấm **Giữ đối tượng & chọn tiếp**; bấm vào vật thể khác hoặc chọn vùng gợi ý khác.
3. Lặp lại, tối đa 8 đối tượng mỗi lần. Vùng đang xem cũng được tính khi áp dụng.
4. Bấm **Tạo N layer đối tượng**. Mỗi đối tượng dùng chung pixel nguồn nhưng có mask riêng, vị trí/rotation/flip giữ theo layer gốc.

Mặc định tạo bản sao có mask và ẩn layer nguồn; ảnh nguồn không bị xóa. Có thể chọn Áp mask trên layer hiện tại (cần mở khóa layer) hoặc Đặt làm vùng chọn. Nhóm cha đang khóa phải được mở khóa. Với mask sẵn có, mặc định lấy giao; bỏ Kết hợp mask hiện có nếu muốn thay thế vùng che. Undo khôi phục trạng thái trước khi áp dụng.

Sau khi áp dụng, bấm thumbnail mask trong bảng Layers rồi dùng Brush/Eraser để sửa tiếp. Lưu .luma giữ ảnh nguồn và mask. PSD/PSB RGB 8-bit hỗ trợ mask pixel trong phạm vi hiện có của bộ xuất; các hiệu ứng/phông/phần tử phức tạp vẫn có giới hạn nhập/xuất như trước.

**Tải PNG trong suốt** xuất vùng đang xem theo kích thước ảnh nguồn, tối đa 16 MP/cạnh 8192 px; alpha gốc được nhân với mask. PNG xuất riêng layer nguồn, không bao gồm vị trí/rotation, hiệu ứng, độ mờ hay mask của nhóm trong tài liệu. Để xuất toàn bộ bố cục, áp dụng layer rồi dùng Export của Luma.

## Hiệu năng và chất lượng

- Mô hình chạy thật qua CPU/WASM trong Web Worker; Dừng AI hoặc đóng công cụ kết thúc worker và giải phóng cache phiên. Không cần tài khoản, API key hoặc gửi ảnh tới server AI.
- Các model mới tổng khoảng 44,25 MB, tải từng tác vụ khi dùng: saliency 4,57 MB; SlimSAM encoder+decoder 13,79 MB; portrait matting 25,89 MB. Tóc dùng thêm model bộ phận có sẵn 16,45 MB. Runtime dùng chung và được tải khi gọi AI.
- Ảnh đưa vào suy luận có cạnh dài tối đa 1024 px. MODNet giữ cạnh ngắn tới 512/cạnh dài tới 1024; hair part map 256 px. Mask được scale về tài liệu, không sinh thêm chi tiết tóc đã mất.
- Điểm giữ/bỏ sau lần đầu tái sử dụng embedding nguồn. Thời gian phụ thuộc trình duyệt/CPU/bộ nhớ. Ảnh nguồn, layer nguồn và độ phân giải đầu ra không bị giảm chỉ vì model phân tích ở kích thước nhỏ.
- Đã chạy suy luận thực và kiểm tra chức năng trên chân dung public domain đi kèm. Đây chưa phải benchmark chất lượng trên mọi tóc/tông da/vật thể. Vật trong suốt, bóng đổ/phản xạ, tóc gần màu nền, ảnh rung/mờ và nhiều vật chạm nhau có thể cần cọ sửa. Không cam kết tách chính xác từng sợi tóc.

Nguồn và hash model, xử lý đầu vào, giấy phép: `dist/ai/CUTOUT-NOTICE.md`. Bản 6.2 tập trung vào nền tảng chỉnh ảnh độc lập; chưa triển khai thêm Canva native.
