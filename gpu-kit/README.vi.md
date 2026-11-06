# Luma Local GPU — Windows x64 + NVIDIA

Bộ cài tải toàn bộ mã nguồn và model/runtime từ GitHub Releases của `larxvo/lumia-studio`, kiểm tra SHA-256 trước khi giải nén. Không phụ thuộc máy chủ demo.
Bộ này cài / nối ComfyUI Portable chính thức, mở Luma từ máy bạn, kiểm tra CUDA thực và có công cụ xếp hạng nhãn da **nghiên cứu**. Không có GPU đám mây, checkpoint sinh ảnh hoặc trọng số y khoa trong ZIP. Không thay đổi driver, execution policy hay cài thư viện vào môi trường ComfyUI gốc.

## 1. Chuẩn bị

- Windows x64, NVIDIA driver hiện hành; kiểm tra `nvidia-smi` chạy được.
- Cài 7-Zip từ https://www.7-zip.org/ nếu chưa có ComfyUI Portable. Cần dung lượng trống cho portable vài GB, checkpoint, Luma và model nghiên cứu nếu dùng; nên chuẩn bị khoảng 20 GB trở lên.
- Giải nén bộ ZIP vào một thư mục riêng, ví dụ `D:\Luma-GPU`.
- Mở PowerShell trong thư mục đó. Nếu Windows chặn script tải xuống, xem mã nguồn và hướng dẫn chính sách của máy; bộ này không đặt Bypass hoặc tắt bảo vệ. Bạn có thể dùng Properties → Unblock cho các tệp đã tự kiểm tra nếu chính sách của máy cho phép.

## 2. Cài và mở Luma local

```powershell
.\Install-Luma.ps1
```

Script đọc GPU, chọn ComfyUI Portable chính thức: CUDA 13 cho kiến trúc hiện đại, CUDA 12.6 cho compute capability dưới 7. Tên asset và SHA-256 phải có trong GitHub release chính thức; nếu không có bản phù hợp, script dừng để bạn chọn theo hướng dẫn ComfyUI. Không tự cài một bản không kiểm tra được.

Nếu đã tự tải và giải nén ComfyUI phù hợp:

```powershell
.\Install-Luma.ps1 -PortablePath 'D:\ComfyUI_windows_portable'
```

Đặt checkpoint **SD / SDXL `.safetensors` mà bạn có quyền sử dụng** vào `ComfyUI\models\checkpoints`. Bộ này không tự nhận điều khoản model hoặc tải checkpoint không rõ giấy phép. Dùng workflow core SD/SDXL của Luma; Flux/custom-node workflows chưa tương thích luồng này.

```powershell
.\Start-Luma.ps1
```

Giữ cửa sổ dịch vụ đang mở. Trình duyệt mở phiên local ở `http://127.0.0.1:8788`. Liên kết có mã phiên riêng trong fragment; không chia sẻ mã này. Mã bị xóa khỏi thanh địa chỉ sau khi app nhận và chỉ giữ trong RAM. Reload mất phiên thì mở lại liên kết từ cửa sổ dịch vụ.

Trong Luma: **Production → Kết nối máy AI → Kiểm tra → chọn checkpoint → Lưu**. Bản local dùng proxy cùng origin tới ComfyUI loopback, không cần wildcard CORS hay mở cổng ra Internet. ComfyUI có thể giữ ảnh upload / output trong thư mục của nó; dịch vụ Luma không lưu ảnh phân loại da.

## 3. Kiểm chứng GPU và chất lượng ảnh

`runtime\cuda-proof.json` chỉ xuất hiện sau khi phép nhân ma trận float32 chạy trên `cuda:0`, đồng bộ CUDA, kiểm tra kết quả và lấy CUDA event timing thành công. Không có CUDA thì bài này thất bại; không fallback CPU.

Trong **Production → Kiểm chứng CUDA & ảnh**, bản local chạy lại phép tính CUDA trước job ảnh. Báo cáo JSON phân biệt bằng chứng CUDA của tiến trình local, thông tin ComfyUI do server báo, job ảnh hoàn tất, metric vùng vá và đánh giá bằng mắt. Phép tính CUDA không chứng minh từng kernel của ComfyUI hoặc chất lượng ảnh.

Bài nhiều vùng hỏng, sau khi ComfyUI đã chạy:

```powershell
.\Run-Benchmark.ps1 -Checkpoint 'ten-model.safetensors'
```

Ba job trên ảnh chân dung public domain đi kèm: ô 64 × 64, ô 128 × 128 và vết rách dài, seed 731/732/733. Kết quả nằm trong `runtime\reports\<thời-gian>`, gồm `report.json`, nguồn chuẩn, input hỏng, output raw và output đã giới hạn mask. Báo cáo có SHA-256 checkpoint, tensor CUDA, mã job, thời gian, MAE/PSNR trong mask, số pixel ngoài mask bị đổi và các mục duyệt chưa đánh giá.

Gửi lại **`cuda-proof.json` và thư mục báo cáo** nếu muốn kiểm tra kết quả. Không gửi liên kết phiên chứa token. Đây mới là dữ liệu để xác nhận trên GPU của bạn; bộ cài được chuẩn bị / kiểm thử logic trong môi trường phát triển không có GPU và chưa được chạy trên Windows/GPU thực ở lần phát hành này.

Ba mask trên một ảnh không phải đánh giá tổng quát mọi ảnh, phục hồi danh tính hay độ đúng lịch sử. So sánh ảnh bằng mắt và điền đánh giá danh tính / giải phẫu / đường nối; metric không thay việc này. Ctrl+C không interrupt toàn bộ máy; job đang chạy trên ComfyUI có thể tiếp tục.

## 4. Xếp hạng nhãn da nghiên cứu — tùy chọn

```powershell
.\Install-Luma.ps1 -PortablePath 'D:\ComfyUI_windows_portable' -Research
.\Start-Luma.ps1 -SkinModelDir 'D:\models\medsiglip-448'
```

Tải model chính thức `google/medsiglip-448` từ https://huggingface.co/google/medsiglip-448 bằng tài khoản của bạn sau khi đọc / chấp nhận điều khoản. Thư mục phải có config, processor/tokenizer và trọng số **safetensors**. Có thể tải snapshot bằng công cụ Hugging Face sau khi bạn đã có quyền truy cập. Không gửi token Hugging Face trong chat hoặc nhập vào Luma. Backend chỉ đọc model local, không dùng remote code hoặc pickle weights.

Thư viện nghiên cứu được cài vào `runtime\research-deps`, không sửa package tree ComfyUI. Model có thể tốn nhiều VRAM; nếu hết VRAM, dừng bớt workload do bạn kiểm soát rồi thử lại. Script không tự dừng tiến trình hay xóa model khác.

Khoanh vùng da trên canvas, mở **Phân loại da · nghiên cứu** rồi bấm chạy. Model so embedding ảnh với tập mô tả cố định; trả top 3 với cosine similarity, không softmax thành “% mắc bệnh”. Nhóm nhãn có mụn, vảy nến, chàm, rosacea, bạch biến, tàn nhang, tăng sắc tố, nếp nhăn và các nhãn ngoài nhóm / không đủ dấu hiệu.

**Chưa có bộ phân loại lâm sàng được kiểm định.** Đây là semantic ranking dùng cho nghiên cứu, chưa được đo precision/recall, fairness theo tông da, OOD hoặc hiệu chỉnh ngưỡng. Cơ chế từ chối là ngưỡng kỹ thuật và kiểm tra ảnh cơ bản; không phải cách loại trừ bệnh. Không dùng để chẩn đoán, quyết định điều trị, quản lý bệnh nhân hoặc tự động retouch theo tên bệnh. Không tự thay đổi ảnh / vùng chọn. Report ghi hash trọng số local nhưng không tự chứng thực đó là checkpoint Google nguyên bản.

Nguồn chính thức:

- ComfyUI Portable: https://docs.comfy.org/installation/comfyui_portable_windows
- PyTorch kiểm tra CUDA: https://docs.pytorch.org/get-started/locally/
- Model card và giới hạn MedSigLIP: https://developers.google.com/health-ai-developer-foundations/medsiglip/model-card

## Canva native

Bộ GPU không mở quyền Canva. Luma hiện nhập tệp PPTX/SVG. Tích hợp native cho sản phẩm độc lập này vẫn cần phạm vi / thỏa thuận phù hợp với Canva và một app Developer được cấu hình. Không scrape thiết kế hoặc dùng MCP để né giới hạn API.
