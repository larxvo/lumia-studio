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
