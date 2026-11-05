# Luma Studio 8.0 — Creative essentials

**Được tạo bởi Larx Vo · [vovinhlac.com](https://vovinhlac.com) · Miễn phí sử dụng.**

Bản8.0 bổ sung các phần cốt lõi còn thiếu trong đối chiếu bốn ảnh Photoshop: dữ liệu thực, công cụ canvas, Undo và lưu lại để sửa. Các công cụ chỉnh ảnh, retouch, Art & Pattern, preset, ICC và Smart Objects của các bản trước được giữ.

## Bắt đầu nhanh

1. **Trợ giúp → Thử tính năng8.0**, hoặc tìm `Mẫu Luma8` bằng Ctrl K, mở poster vector/chữ có alpha và đường riêng.
2. Chọn Headline, vào **Chữ → Type Studio**. Bôi đen một đoạn hoặc nhập Từ/Đến, thay thông số, bấm **Áp kiểu vào đoạn**; **Lưu định dạng** tạo một bước lịch sử chính.
3. **Kênh**: bấm alpha mẫu, B/E tô hoặc xóa. Bấm RGB trở về ảnh. Nút↗ nạp kênh thành vùng chọn; Shift thêm, Alt trừ, Shift+Alt giao.
4. **Đường**: chọn đường lưu; A kéo điểm neo/tay nắm, Alt-kéo tách hai phía. **Thông số điểm** sửa tọa độ, đóng/mở đường, tách đôi hoặc xóa điểm.
5. **Lớp**: hàng Khóa có Vị trí/Pixel/Độ trong riêng. Dây xích cạnh thumbnail mask chọn liên kết hoặc độc lập; Move có đích Nội dung/Mask.
6. Lưu **.luma** giữ toàn bộ thiết lập Luma. PSD/PSB xuất được phần cấu trúc tương thích; thông báo nêu rõ phần raster hóa/composite.

## Bổ sung từ ảnh tham chiếu

| Thành phần | Trạng thái8.0 | Nơi dùng |
|---|---|---|
| Khóa vị trí, pixel, alpha | Riêng từng phần, kế thừa nhóm, kiểm tra trước transform/align/distribute | Hàng Khóa trong Lớp |
| Mask có dây xích | Mask theo nội dung hoặc di chuyển độc lập, Undo | Thumbnail mask; Move |
| Kênh alpha lưu riêng | Lưu/nạp, tô/xóa, tên, đảo, bản sao, PNG xám, dữ liệu PSD thật | Kênh; Vùng chọn |
| Work Path / saved paths | Độc lập với layer, lưu tên, tạo vector/vùng chọn | Đường |
| Anchor và Bézier handles | Kéo/sửa số; thêm điểm bằng chia đôi đường cong; xóa, Cancel/Undo | A; Thông số điểm |
| Character / Paragraph | Định dạng từng đoạn, baseline, scale, tracking/kerning, gạch, lề/khoảng cách/justify | Type Studio; Thuộc tính |
| Smart Filters | Gaussian Blur/Unsharp Mask trên Smart Object nhúng trong phạm vi tương thích | Cây Live Filters |

## Quy tắc thao tác

**Khóa Vị trí** chặn kéo, nudge, flip và transform hình học; đổi màu vẫn được khi Pixel không khóa. **Khóa Pixel** chặn sửa nội dung; mask vẫn chỉnh riêng. **Khóa Độ trong** cho cọ sửa màu trong alpha sẵn có bằng source-atop, chặn xóa/thay pixel làm thay alpha. **Khóa lớp** chặn chỉnh trên lớp và các lớp con. Align/distribute/transform kiểm tra cả cây trước khi sửa để tránh thao tác dở một phần.

Mask liên kết di chuyển cùng nội dung. Mask tách liên kết có thể kéo riêng bằng Move → Mask; Move → Nội dung để kéo ảnh. Crop/resize/rotate toàn tài liệu vẫn chuyển tọa độ của mọi mask, alpha và đường lưu. Di chuyển nội dung riêng không kéo mask đã tách.

Một nét tô/một lần kéo điểm/một phiên Type Studio đã Lưu là một bước Undo. Escape hoặc Hủy trả lại trước thao tác. Ctrl Z/Ctrl Shift Z hoạt động trong Type Studio; khi đóng, dùng lịch sử tài liệu. Alpha brush áp Opacity một lần cho nét, không cộng hai lần ở đầu nét. Các bản kết quả riêng không kế thừa khóa riêng của lớp nguồn.

## Alpha và đường lưu

Tối đa16 alpha/64 đường/2.000 lệnh mỗi đường; chỉ một Work Path được cập nhật. Alpha là mặt nạ0–255, giữ cạnh mềm. Kênh đang xem không thay màu ảnh export, histogram hoặc navigator. Menu••• có tên, đảo, bản sao, xóa, xuất PNG xám.

Vùng chọn rect/ellipse/polygon đổi thành Work Path theo hình học thật. Vùng chọn pixel lưu vào alpha; trace/vectorize nằm trong Art & Pattern. Đường đã lưu không làm đổi composite cho đến khi tạo vùng chọn hoặc layer. Lưu đường của layer chuyển đúng tọa độ khi layer đã xoay/scale/flip.

## Typography

Tối đa512 đoạn kiểu theo chỉ số UTF-16. Chọn đoạn hiện thông số hiệu lực; chỉ thông số đã thay đổi được áp, nên đổi màu giữ font/size/weight khác. Chèn/xóa chữ giữ kiểu ở phần nội dung còn lại. Cancel và Undo phục hồi cả nội dung lẫn ranges. Thuộc tính có lề trái/phải/dòng đầu, khoảng cách trước/sau đoạn, baseline, scale ngang/dọc, kerning và justify.

Đây là layout Canvas, chưa có đầy đủ OpenType/RTL, optical kerning, variable-font axes hoặc parity với Adobe. Font và độ đậm khi qua PSD có thể khác. SVG raster hóa typography nâng cao để giữ diện mạo; .luma giữ ranges và thông số.

## PSD/PSB: hỗ trợ và giới hạn

Engine **RGB8-bit**. Adapter đọc alpha RAW, PackBits RLE, ZIP, ZIP prediction8-bit; PSB dùng độ dài section/row tương ứng. Xuất alpha vào plane RAW riêng; không dùng nhầm kênh đầu làm opacity của ảnh ghép. Work Path dùng resource1025, đường lưu2000–2997, điểm8.24. Tên đường PSD legacy về ASCII gần đúng; .luma giữ Unicode. Mask link state đảm bảo trong .luma; chưa đảm bảo tương đương khi đi qua PSD.

Gaussian Blur/Unsharp Mask native yêu cầu Smart Object nhúng, scale đều, blend Normal100%, không filter pixel mask/warp/perspective, radius0–40px, Unsharp amount0–200%/threshold0–255, tối đa12 filter. Luma giữ thông số nhưng tái hiện gần đúng Photoshop. Smart Filters lạ/không tương thích mở composite đã lưu và có thông báo. Hue/Saturation/Curves Smart Filters chưa thành stack live native; adjustment layer tương ứng có hỗ trợ riêng từ trước.

Kiểm thử phân tích bytes và đọc/ghi qua ag-psd, so sánh pixel/metadata; chưa có xác nhận mở bản8.0 trong Photoshop thật. Chất lượng layout/filter không đồng nghĩa tương đương mọi PSD.

## Vẫn còn thiếu

- Canva native chưa mở/chỉnh trực tiếp; dùng PDF/SVG/PNG/gói interchange theo khả năng tài liệu.
- Chưa có engine CMYK16/32-bit; proof/xuất CMYK TIFF vẫn dùng ICC/LittleCMS. DPI không tự tạo chi tiết.
- Chưa có bộ cài Windows có chữ ký, RAW/HEIC đầy đủ, cache tile/disk cho ảnh cực lớn, toàn bộ Photoshop.
- Chưa có kiểm chứng chất lượng tạo sinh trên GPU vật lý. ComfyUI và gpu-kit là kết nối/công cụ kiểm chứng hiện có, không phải báo cáo GPU đã chạy.
- Vùng da phục vụ retouch không phải chẩn đoán/phân loại bệnh đã thẩm định. Phục hồi chi tiết mất vẫn là dự đoán; tham chiếu giúp ràng buộc nội dung.

Không thêm hạn mức MB cố định trong8.0; giới hạn thực tế theo bộ nhớ/canvas/định dạng của máy. Đọc QA.md để phân biệt kiểm thử chức năng với đánh giá chất lượng ảnh.
