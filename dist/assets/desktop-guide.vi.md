# Luma Studio 9.0 — Windows, Canva và kiểm chứng

Được tạo bởi **Larx Vo · https://vovinhlac.com**. Miễn phí sử dụng. Ngày phát hành: 06/11/2026 (Asia/Saigon).

## Bản Windows

Bộ cài `Luma-Studio-9.0.0-Setup-x64.exe` chứa Electron 45.2.3, editor, font, model ONNX và runtime đi kèm. Windows 10/11 x64; không cần tự cài Node/Python để chỉnh ảnh. AI tạo sinh qua ComfyUI vẫn cần máy xử lý và model riêng. Không có khóa trả phí Luma.

Cài cho tài khoản hiện tại, chọn thư mục trống hoặc thư mục Luma đã cài; có shortcut Desktop/Start và mục gỡ trong Windows Settings. Gỡ cài đặt chỉ xóa danh sách file ứng dụng đã đóng gói; giữ dự án, ảnh và AppData. PSD/PSB đăng ký Open With để tránh tự đổi ứng dụng mặc định. Đóng Luma trước khi cập nhật/gỡ.

Bản này **chưa ký số**. Không tự tắt Defender, SmartScreen, kiểm tra chứng chỉ hoặc chính sách hệ thống. Kiểm tra SHA-256 đi kèm để đối chiếu file tải. Bộ cài được biên dịch chéo trên Linux và kiểm tra payload; chưa chạy cài/gỡ trên máy Windows thật trong môi trường này. Không gọi kiểm tra payload là kiểm thử Windows thực.

Mã build: `npm ci`, `npm run build`, `npm run desktop:win`. Công cụ lấy từ Electron/electron-builder/NSIS chính thức; không chạy Wine trong quy trình build cuối. Wrapper dùng sandbox, context isolation, tắt Node trong renderer, kiểm tra nguồn IPC và chặn webview. Dữ liệu dự án ở máy; không có telemetry Luma.

## Canva Connect

Tệp → **Canva · mở native & retouch** hoặc Nâng cao → Trao đổi & cộng tác.

1. Chủ ứng dụng tạo app tại Canva Developer Portal, chọn scopes `design:meta:read design:content:read design:content:write asset:read asset:write` và Redirect URL `http://127.0.0.1:47831/canva/callback`.
2. Trong bản Windows, mở Cấu hình Canva Developer; nhập Client ID và Client secret của app riêng. Secret chỉ tồn tại trong bộ nhớ main process của phiên, không nằm trong mã nguồn, installer, URL hay log. Không gửi secret qua hội thoại.
3. Kết nối tài khoản trong trình duyệt. OAuth dùng PKCE SHA-256, state ngẫu nhiên một lần, thời hạn 5 phút. Luma chỉ nhận callback loopback có state đúng. Token được main process giữ, mã hóa qua kho hệ điều hành khi khả dụng. Token refresh được tuần tự hóa để tránh dùng lại refresh token.
4. Tìm thiết kế. **Mở native** lấy edit URL mới do API trả về và mở tài liệu gốc bằng trình sửa Canva chính thức. Các phần tử native còn ở Canva.
5. Chọn số trang → **Về Luma**. Canva xuất PNG lossless đúng kích thước mặc định. Trang vào Luma thành **một lớp ảnh gộp**, có lưu ID nguồn/trang/thời điểm trong .luma. Mở khóa lớp nếu cần retouch trực tiếp.
6. **Gửi ảnh hiện tại sang Canva** tải PNG thực và tạo một thiết kế Canva mới chứa ảnh đó. Không ghi đè bản gốc; đây không phải đồng bộ layer hai chiều.
7. Ngắt kết nối xóa token local và gọi thu hồi token. Nếu mạng lỗi, cần kiểm tra quyền ứng dụng tại Canva để thu hồi từ tài khoản.

Đây chưa phải parser `.canva` offline, và chưa sửa toàn bộ lớp Canva bên trong Luma. Bản web có nhập PPTX/SVG; kết nối OAuth hiện nằm ở bản Windows. Tích hợp công khai dùng chung cho mọi người cần app Canva được duyệt cùng backend giữ Client secret; không phân phối một secret chung trong installer. Phiên này không có thông tin app Canva để thử đăng nhập live. Test OAuth dùng HTTP fixture có nhãn rõ, không phải kiểm chứng tài khoản Canva thực. Giới hạn xuất và tài nguyên trả phí của Canva vẫn áp dụng.

## Photoshop / PSD / PSB

Engine chỉnh sửa RGB 8-bit sRGB. Mở/xuất PSD và PSB RGB 8-bit với lớp pixel, nhóm, opacity/blend được hỗ trợ, pixel mask, kênh alpha độc lập, Work/Saved Paths, kiểu chữ trong phạm vi hỗ trợ, một số adjustment và Smart Objects nhúng raster/PSD.

9.0 bổ sung **High Pass** và **Invert** dạng native Smart Filter, cùng Gaussian Blur/Unsharp Mask đã có. Stack phải Normal, opacity 100%, không mask filter riêng, bán kính 0–40 px và biến đổi đồng tỉ lệ. Native parameters và nguồn Smart Object được giữ khi mở lại; phép lọc Luma có thể khác kernel Photoshop. Có fixture PSD/PSB kiểm tra tham số và pixel round-trip.

Chưa tương thích toàn bộ Photoshop: CMYK/16/32-bit PSD; nhiều layer effects; warp/perspective Smart Objects; filter blend/mask; adjustment chọn màu theo dải; RAW/HEIC; font/layout phức tạp. File chứa cấu trúc chưa hỗ trợ được mở composite khi có để giữ hình; đọc báo cáo nhập, giữ PSD gốc và lưu .luma cho toàn bộ thiết lập Luma. TIFF CMYK có ICC là đường xuất in riêng, không đồng nghĩa engine biên tập PSD CMYK.

## Kiểm chứng GPU

`gpu-kit/probe.py --output hardware-report.json` luôn ghi báo cáo cả khi thiếu GPU. Tên card/driver không đủ để đánh dấu compute đạt; phải có tensor CUDA chạy thật, thiết bị CUDA và hash kết quả. Nhận diện GPU graphics của Electron cũng không chứng minh model sinh ảnh chạy CUDA.

`Run-Benchmark.ps1` chạy ba mask hư hỏng trên một ảnh chuẩn còn nguyên qua ComfyUI đã cấu hình: ô nhỏ 64, ô lớn 128, vết rách dọc. Lưu ảnh nguồn/input/raw/composite, seed, checkpoint, hash, thời gian; đo MAE/PSNR/SSIM vùng và đường biên, số pixel ngoài mask bị đổi. `review.html` đặt ảnh cạnh nhau để duyệt bằng mắt. SSIM vùng là thống kê thô, không phải chứng nhận cảm nhận hay nhận dạng. Một ảnh không đại diện mọi cảnh/tóc/da/phục hồi lịch sử.

Báo cáo kết thúc là `gpu-executed-review-required`; `imageQualityVerified` vẫn false vì chưa có đánh giá chất lượng tổng quát. Không tự chuyển CPU hoặc gắn nhãn GPU đạt khi thiếu CUDA. Báo cáo môi trường phiên này: `qa/platform9-hardware.json`: không có nvidia-smi, không có torch/CUDA; **chưa kiểm chứng GPU vật lý**. Muốn có kết quả thực cần chạy kit trên Windows + NVIDIA / máy CUDA đang hoạt động, model hợp lệ và ComfyUI. Không có chất lượng ảnh GPU được đo trong phiên này.

## Tài liệu API

- https://www.canva.dev/docs/apps/rest-apis/authentication/
- https://www.canva.dev/docs/apps/rest-apis/reference/designs/list-designs/
- https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/
- https://www.canva.dev/docs/apps/rest-apis/reference/assets/create-asset-upload-job/
- https://www.canva.dev/docs/apps/rest-apis/reference/designs/create-design/
- https://www.electronjs.org/docs/latest/tutorial/security/


---

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
