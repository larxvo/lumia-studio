# Luma Studio 6.2 — ưu tiên công cụ chỉnh ảnh độc lập

**Tách nền & vật thể** là không gian mới trên thanh trên cùng. Có U²-Net nhỏ cho chủ thể nổi bật, DeepLab cho vùng vật thể gợi ý, SlimSAM cho điểm giữ/bỏ, MODNet alpha chân dung và MediaPipe tóc kết hợp alpha. Kết quả được duyệt trên nền tương phản, sửa bằng cọ, co/mềm mép rồi áp vào mask, vùng chọn hoặc tối đa 8 layer riêng. Không cần ComfyUI/GPU kit để dùng các tác vụ này.

Đọc **SUBJECT-STUDIO.vi.md** để thao tác chi tiết. Mô hình phân tích cạnh dài tối đa 1024 px; nguồn RGB/alpha và geometry của layer được giữ. Tóc mảnh, nền gần màu và vật trong suốt có thể cần sửa tay. Nhận diện tự động giới hạn các nhóm được hỗ trợ; điểm bấm có thể dùng độc lập. PSD/PSB vẫn hỗ trợ trong phạm vi đã công bố. Đợt này chưa triển khai thêm Canva native.

## Công cụ các bản trước

# Luma Studio 6.1 — Local GPU và nghiên cứu da

Bản 6.1 bổ sung bộ cài **Windows x64 + NVIDIA**, dịch vụ local loopback, bằng chứng phép tính CUDA và xếp hạng nhãn da bằng model local tùy chọn. Đây là các công cụ để chủ máy chạy kiểm chứng thực tế; môi trường phát triển không có GPU nên **chưa có kết quả chất lượng trên GPU thật** cho lần phát hành này.

## Bắt đầu với máy NVIDIA của bạn

1. Tải `luma-local-gpu-kit.zip` trong mục Phân loại da · nghiên cứu hoặc Kiểm chứng CUDA & ảnh.
2. Giải nén, cài 7-Zip nếu cần, rồi mở PowerShell trong thư mục kit và chạy `Install-Luma.ps1`. Bộ cài chọn portable chính thức theo kiến trúc, kiểm tra hash và chạy phép tính CUDA. Xem `gpu-kit/README.vi.md` cho điều kiện / tham số.
3. Đặt checkpoint SD/SDXL `.safetensors` bạn có quyền sử dụng vào ComfyUI/models/checkpoints. Bộ cài không tự nhận điều khoản model hoặc tải checkpoint không rõ giấy phép.
4. Chạy `Start-Luma.ps1`; mở đúng liên kết phiên local được in. Kết nối ComfyUI qua proxy cùng origin của phiên, không cần mở dịch vụ ra Internet hoặc wildcard CORS.
5. Dùng Kiểm chứng CUDA & ảnh cho một bài, hoặc `Run-Benchmark.ps1 -Checkpoint 'ten-model.safetensors'` cho ba vùng hỏng. Kết quả ở runtime/reports, có ảnh nguồn, đầu vào hỏng, raw, composited và report JSON.

Bài CUDA kiểm tra tensor trên cuda:0, kết quả nhân ma trận, CUDA event timing và hash output. Bằng chứng này thuộc tiến trình local, tách biệt với metadata ComfyUI và chất lượng ảnh. Bài ảnh dùng ba mask trên một ảnh mẫu có nguồn chuẩn; metric không chứng minh danh tính, tính tự nhiên hoặc màu / chi tiết lịch sử. Cần đánh giá ảnh thực tế sau khi chạy trên máy của bạn.

## Phân loại da — chỉ ở mức nghiên cứu

Chọn cài `-Research`, tự tải model chính thức google/medsiglip-448 sau khi có quyền / chấp nhận điều khoản, rồi mở `Start-Luma.ps1 -SkinModelDir 'duong-dan-model'`. Backend chỉ đọc safetensors local, không remote code, không pickle weights. Không gửi token Hugging Face trong chat.

Khoanh vùng da trên canvas, mở Phân loại da · nghiên cứu và bấm chạy. Công cụ trả top 3 nhãn theo cosine similarity, có từ chối theo chất lượng ảnh / độ tách nhãn, nhưng **chưa phải bộ phân loại bệnh lâm sàng được kiểm định**. Ngưỡng này chưa được hiệu chỉnh, không phải xác suất bệnh hay OOD detector. Không tự retouch, thay ảnh, quyết định điều trị hoặc loại trừ bệnh. Report ghi hash model local và nêu rõ danh tính nguồn trọng số không được độc lập xác thực.

Ứng dụng web công khai không tự dò hoặc gọi GPU trên máy người xem. Phiên local chỉ bind 127.0.0.1, dùng bearer token phiên, kiểm tra Host/Origin, giới hạn API và chỉ xóa job đang chờ thuộc phiên. Token không được lưu vào báo cáo. Dịch vụ phân loại không lưu ảnh; ComfyUI vẫn có thể lưu input/output trong thư mục riêng của nó.

## Canva native — chưa bật

Chủ dự án hiện chưa có app / thỏa thuận phạm vi tích hợp. Điều khoản hiện hành hạn chế dùng API cho sản phẩm cạnh tranh và app chủ yếu xuất sang nền tảng thiết kế khác. Bản 6.1 có hồ sơ kỹ thuật `gpu-kit/CANVA-NATIVE.vi.md` để làm rõ phạm vi với Canva; không có scraper hoặc bridge chưa được cấp phép. Nhập PPTX/SVG của bản 6.0 được giữ lại.

Nguồn: https://www.canva.com/policies/canva-developer-terms/ ; https://www.canva.dev/docs/apps/design-editing/ ; https://developers.google.com/health-ai-developer-foundations/medsiglip/model-card ; https://docs.comfy.org/installation/comfyui_portable_windows

## Hướng dẫn công cụ kế thừa

# Luma Studio 6.0 — thiết kế tiếp nối, phục hồi tham chiếu và kiểm chứng AI

## Những nâng cấp dùng được ngay

Mở **Production** trên thanh trên cùng. Bản 6.0 thêm năm công cụ, giữ lại Smart Objects, ICC/CMYK, neural fill, tô màu AI và cộng tác của bản 5.

| Công cụ | Làm được | Điều kiện / giới hạn |
| --- | --- | --- |
| Thiết kế từ Canva | Nhập tệp PPTX hoặc SVG đã tải xuống; chọn trang, xem trước, nhận báo cáo và sửa các phần tử được hỗ trợ thành layer | Không mở đường dẫn tài liệu Canva native, không đồng bộ ngược; cần kiểm tra độ tương thích |
| Bản đồ bề mặt da | AI phân vùng da; tách ứng viên tối, đỏ, sáng và rãnh dài bằng màu / tương phản cục bộ; chuyển sang vùng chọn để retouch | Không suy ra bệnh hoặc xác suất bệnh; có thể nhầm bóng đổ / trang điểm |
| Phục hồi có tham chiếu | Chọn ba cặp điểm, căn affine, lấy pixel từ bản scan hoặc ảnh tham chiếu vào vùng tô | Cần nguồn tham chiếu phù hợp; không khớp phối cảnh hoặc góc mặt khác nhau |
| Màu theo chỉ dẫn | Tô màu do người dùng chọn theo mask, thay sắc độ a/b trong Lab và giữ L* nguồn | Màu do người dùng cung cấp; gamut có thể giới hạn; không xác minh màu lịch sử |
| Kiểm chứng máy AI | Đọc thiết bị và node; chạy job sửa ảnh mẫu có vùng mất đã biết; so sánh và tải báo cáo JSON | Cần máy ComfyUI / checkpoint riêng; thông tin GPU do server báo, phải chạy và duyệt kết quả |

### Nhập thiết kế từ Canva

1. Trong Canva, tải thiết kế của bạn dưới dạng PowerPoint nếu loại thiết kế hỗ trợ, hoặc SVG. Tệp xuất sẵn từ nơi khác cũng dùng được.
2. Chọn **Production → Thiết kế từ Canva → Chọn PPTX / SVG**, hoặc mở tệp qua File → Open.
3. Với PPTX, chọn một trong tối đa 50 trang. Mỗi lần mở tạo một tài liệu riêng. Kiểm tra preview và báo cáo trước khi mở.
4. Với SVG, chọn **Mở layer được hỗ trợ** để sửa; hoặc **Mở bản giữ hình** khi có bản render PNG. Checkbox đối chiếu cho phép kiểm tra bản giữ hình trước khi chọn.
5. Lưu `.luma` để giữ cấu trúc đã nhập; phông cần có trên thiết bị hoặc nạp riêng.

PPTX giữ nội dung chữ, kiểu chính, hình cơ bản, ảnh nhúng PNG/JPEG/WebP, vị trí, xoay, flip và crop được hỗ trợ. Nhóm được trải thành layer. Master/layout, bảng, biểu đồ, media, custom shape, kiểu chữ hỗn hợp và hiệu ứng phức tạp không được tái tạo đầy đủ. SVG giữ hình cơ bản, text đơn giản, đường M/L/H/V/C/S/Q/T/Z; arc và nhiều tính năng clip/mask/filter/gradient chưa thành layer chỉnh sửa. Bản PNG tham chiếu dùng trình render SVG của môi trường và loại nội dung thực thi / tài nguyên ngoài. Chữ outline không trở lại text.

Giới hạn: tệp tối đa 48 MB; XML tối đa 8 MB, tối đa 100.000 phần tử; PPTX tối đa 4.096 entry, 16 MB mỗi entry và 96 MB sau giải nén. Tài liệu tối đa 16 MP / 150 layer. Nhập không tải ảnh liên kết ngoài và không thực thi script. Các bài kiểm tra tệp dùng fixture kỹ thuật; chưa có bộ kiểm chuẩn đa dạng tài liệu Canva thực tế do người dùng cung cấp.

**Canva native:** Apps SDK có API chỉnh phần tử chạy bên trong Canva; Connect REST không phải API đọc/ghi toàn bộ native document cho trình sửa bên ngoài. Điều khoản Canva hiện hạn chế truy cập API để xây sản phẩm cạnh tranh hoặc xuất thiết kế sang nền tảng thiết kế khác. Phát hành tích hợp native cho Luma cần thỏa thuận phù hợp với Canva. Bản này không scrape API nội bộ, không có ứng dụng Canva được phê duyệt và không quảng bá là đã mở native.

Nguồn: https://www.canva.dev/docs/apps/design-editing/ ; https://www.canva.dev/docs/apps/rest-apis/reference/designs/ ; https://www.canva.com/policies/canva-developer-terms/

### Bản đồ bề mặt da

1. Mở ảnh chân dung; chọn Production → Bản đồ bề mặt da.
2. Bấm Phân tích vùng da để chạy mô hình phân vùng cục bộ. Mắt, môi và chân mày được loại bằng landmarks.
3. Chọn nhóm dấu vết và chỉnh độ nhạy. Số hiển thị là số vùng ứng viên ảnh, không phải xác suất mắc bệnh.
4. Chọn Đặt làm vùng chọn, sau đó sửa vùng chọn hoặc dùng Retouch Lab / công cụ cọ theo ý bạn.

Phân tích ở cạnh dài tối đa 1024 px, trả mask về kích thước tài liệu. Ngưỡng tương phản cục bộ và connected components loại vùng quá nhỏ / quá lớn. Ảnh không đủ da, quá tối, cháy sáng hoặc thiếu chi tiết sẽ không trả vùng chỉnh tự động. Ánh sáng, tóc, trang điểm, râu và độ phân giải vẫn ảnh hưởng; đây là baseline retouch chưa được đo độ chính xác trên tập da liễu hay mọi tông da.

Không có bộ phân loại bệnh lâm sàng đi kèm. Nhãn vảy nến, melanoma hoặc bệnh khác không được suy ra từ màu / texture. Model nền y khoa cần huấn luyện / kiểm chứng đúng nhóm người dùng, không thể thay bằng việc đổi tên các ngưỡng ảnh thành tên bệnh. Ví dụ model card: https://developers.google.com/health-ai-developer-foundations/derm-foundation/model-card

### Phục hồi có tham chiếu và màu chỉ dẫn

- Có thể chọn vùng trên canvas trước; hoặc tô / trừ vùng trong công cụ. Lùi nét giữ tối đa 10 nét gần nhất.
- Chọn ảnh tham chiếu. Bấm lần lượt điểm 1 trên tham chiếu rồi điểm 1 trên ảnh gốc, tiếp tục đủ ba cặp tạo tam giác rộng. Chọn Tô vùng để trở lại cọ.
- Căn theo cùng khung chỉ dùng khi hai ảnh có cùng bố cục. Phép affine không thể sửa mọi phối cảnh, nếp gấp hoặc khuôn mặt khác góc.
- Chỉnh mềm mép vào trong và cường độ; tạo bản xem trước, dùng thanh so sánh, rồi áp layer riêng.
- Màu chỉ dẫn dùng màu foreground khi mở. Có thể lấy bằng Eyedropper trước, hoặc chọn màu trong công cụ. Làm mềm mép cũng áp dụng cho màu.

Đầu ra tối đa 8 MP, các layer nguồn vẫn giữ nguyên. Pixel ngoài mask giữ nguyên ở kích thước xử lý; bản kết quả có thể được scale về khung tài liệu nếu nguồn lớn. Metadata `.luma` lưu phương pháp, màu / tên tham chiếu, ma trận, cặp điểm và thông số; không lưu lại toàn bộ ảnh tham chiếu để tái chạy. Đây là ghép / tô màu có chỉ dẫn, không phải mô hình AI tự phục hồi sự thật đã mất.

### Kiểm chứng ComfyUI

1. Chọn Kết nối máy AI, kiểm tra và lưu checkpoint SD / SDXL.
2. Mở Kiểm chứng máy AI. Bấm Kiểm tra thiết bị & node để lấy `/system_stats` và `/object_info`.
3. Bấm Chạy bài thử thực: gửi ảnh mẫu public domain đi kèm ở 512 × 512 với ô 64 × 64 bị xóa tới endpoint bạn cấu hình. Seed 731, 16 steps, CFG 6, denoise .85.
4. Báo cáo ghi checkpoint, thiết bị do server báo, prompt ID, thời gian, hash đầu ra khi WebCrypto có sẵn, MAE / PSNR bên trong ô thử và số pixel ngoài mask bị đổi trước / sau compositing.
5. Duyệt danh tính, giải phẫu và đường nối bằng mắt; tải JSON để lưu bằng chứng của lần chạy đó.

Thông tin GPU do server tự báo không chứng minh một job đã sử dụng GPU. Hoàn tất job chỉ xác nhận pipeline và kết quả của lần chạy; MAE / PSNR không phải chứng chỉ chất lượng thẩm mỹ, danh tính hoặc độ đúng lịch sử. Nút kiểm tra không tự gửi ảnh người dùng. Bearer token ở RAM của phiên, không xuất vào báo cáo. Dừng chỉ xóa job đang chờ của Luma; không interrupt toàn máy.

**Trạng thái kiểm chứng phát hành:** bộ kiểm thử adapter HTTP, phần tính pixel, UI và mô hình cục bộ đã chạy; chưa có endpoint GPU thật được cung cấp để đánh giá chất lượng sinh ảnh. Bản 6.0 bổ sung cách thu bằng chứng thực tế, không biến giới hạn này thành tuyên bố đã được kiểm chứng. Không có GPU công cộng miễn phí đi kèm.

## Các công cụ kế thừa từ bản 5.0.1


Mở **Production** trên thanh trên cùng, hoặc **Pro** ở thanh bên trái. Các công cụ vẫn có trong menu Layer, Image, Filter và File. Mã nguồn và mô hình được cung cấp để tự host; không cần tài khoản Luma. Chỉnh sửa thường, phân vùng, tô màu và LaMa chạy trên thiết bị. Máy AI ngoài và máy chủ cộng tác tùy chọn do người triển khai cung cấp.

## Smart Objects

1. Vào Production → Smart Objects, chọn layer ảnh, chữ, shape hoặc nhóm. Nếu layer khóa, nút ghi rõ **Mở khóa & chuyển thành Smart Object**.
2. Duplicate tạo instance dùng chung nội dung. Từng instance có vị trí, tỷ lệ, xoay/lật, opacity, mask, style và live filter riêng.
3. **Sửa nội dung** mở tài liệu con ở tab riêng. Sửa các layer bên trong, sau đó bấm **Lưu nội dung** trên thanh trên cùng. Mọi instance dùng chung nguồn được cập nhật, giữ biến đổi ngoài của chúng.
4. **Thay nội dung** nhận PNG/JPEG/WebP, giữ khung ngoài. **Tạo bản riêng** tách nguồn cho instance hiện tại. **Rasterize** chuyển thành layer pixel bình thường khi muốn tô trực tiếp.
5. Lưu `.luma` để giữ tài liệu nhúng. Giới hạn 30 nội dung Smart Object/tài liệu, tối đa 3 cấp nhúng. Không tạo vòng tham chiếu. Tài liệu cha cần còn mở khi lưu nội dung con.

PSD/PSB RGB 8-bit hỗ trợ nhập Smart Object nhúng dạng PNG/JPEG hoặc PSD có biến đổi affine vuông góc (dịch, tỷ lệ, xoay/lật), và xuất nội dung nhúng khi bật giữ thành phần editable. Instance dùng chung nguồn giữ quan hệ này. Perspective/custom warp, Smart Filters, AI/PDF/SVG nhúng và file liên kết bị thiếu chưa được diễn giải; tài liệu phức tạp dùng merged preview và có báo cáo. Style/live filter của Luma được render khi xuất PSD. Đây không phải tuyên bố bảo toàn mọi Smart Object Photoshop. Chưa xác minh bằng ứng dụng Photoshop gốc; fixture kiểm tra trao đổi qua ag-psd.

## CMYK / ICC

Mở **Image → CMYK / ICC · màu in & TIFF** hoặc thẻ CMYK trong Production.

- Luma biên tập trong **sRGB 8-bit**. LittleCMS WebAssembly thực hiện sRGB → CMYK qua bảng ICC, sau đó CMYK → sRGB cho bản xem thử. Đây là mô phỏng chuyển đổi qua profile, không phải cam kết màn hình và giấy giống hệt nhau.
- Nạp ICC/ICM **CMYK** của nhà in (tối đa 6 MB); chọn intent: Perceptual, Relative colorimetric, Saturation hoặc Absolute colorimetric; bật/tắt bù điểm đen BPC.
- Kéo trước/sau để xem. Bật **Xem thử CMYK trên canvas**, bấm Lưu thiết lập màu. Dấu ICC trên thanh công cụ cho biết khi đang bật; các pixel tài liệu và xuất PNG/JPEG/PSD vẫn dùng sRGB.
- **Xuất TIFF CMYK + ICC** tạo TIFF 4 kênh CMYK 8-bit, nhúng đúng ICC đã chọn, gộp các layer, nền trắng và không nén. DPI chỉ gán mật độ in, không tăng số pixel. Lưu `.luma` làm bản gốc có layer và thiết lập ICC.
- Profile Amethyst ISOcoated v2 300 đi kèm là **mẫu thử nghiệm** do tác giả đánh dấu chưa được kiểm chứng thực hành. Với đơn in thật, dùng profile nhà in và duyệt bản in thử theo quy trình của họ.

Chưa có canvas vẽ CMYK nguyên sinh, HDR, spot colors, overprint, giấy/mực mô phỏng đầy đủ, nhập TIFF tổng quát hoặc PSD CMYK/Lab/16/32-bit. ICC đầu ra không tự sửa các profile đầu vào khác đã bị gán sai. Ảnh raster thông thường được trình duyệt giải mã vào canvas sRGB.

## Vá / tái dựng bằng neural AI

Mở **Filter → Generative Studio · vá & tái dựng**.

1. Bắt đầu từ ảnh/tài liệu đang mở; công cụ lấy composite các layer đang thấy. Nếu đã có vùng chọn, vùng đó được dùng làm mask ban đầu.
2. Chọn preset **Vá rách & mất ảnh**, **Giảm vùng hỏng do nước** hoặc **Xóa vật thể**. Với engine trên thiết bị, các preset cùng dùng LaMa theo ngữ cảnh, không đọc prompt chữ.
3. **Tô vùng** để thêm, **Trừ vùng** để bảo vệ, chỉnh cỡ cọ, lùi nét hoặc xóa mask. Giữ lại ít nhất 15% ảnh làm ngữ cảnh.
4. Bấm **Tạo phương án**. Lần đầu tải mô hình LaMa khoảng 60 MB cùng runtime dùng chung; CPU có thể cần hàng chục giây hoặc lâu hơn trên máy yếu. Bộ xử lý ở Web Worker để không chặn giao diện.
5. So sánh trước/sau, chỉnh cường độ và áp dụng. Kết quả là layer composite mới; các root layer cũ được ẩn, không bị xóa. Undo khôi phục trạng thái trước. Kết quả giữ thông tin engine, mô tả đã dùng, seed, cường độ và mask trong `.luma`.

LaMa suy luận một crop có ngữ cảnh ở 512×512 rồi ánh xạ về ảnh. **Mọi pixel ngoài mask được giữ nguyên** trong kết quả neural fill. Đầu ra toàn ảnh tối đa 8 MP; nếu nguồn lớn hơn, bản xử lý giảm kích thước, canvas và layer nguồn vẫn giữ nguyên. Mô hình không tạo thêm độ phân giải thực cho vùng mất lớn.

AI tạo chi tiết hợp lý từ ngữ cảnh; không thể xác nhận lại hình dạng, chữ, huy hiệu, khuôn mặt hay sự kiện đã bị mất. Không có bảo đảm tái dựng chính xác ảnh thời chiến/ảnh gia đình bị hủy hoại nặng. Giữ bản scan gốc để đối chiếu.

## Tô màu AI

Mở **Filter → Tô màu AI · ảnh đen trắng**. Không cần tô mask nếu muốn toàn ảnh; tô mask nếu chỉ muốn đổi màu một vùng.

- Dùng mạng ECCV16 Colorful Image Colorization, trọng số lưu INT8 nhưng tính toán float32 trên CPU/WASM. Mô hình tải khi cần, khoảng 31 MB.
- Mạng dự đoán hai kênh màu a*/b* ở 256×256; ghép với độ sáng L* ở độ phân giải nguồn để giữ chi tiết độ sáng. Alpha nguồn giữ nguyên.
- Chỉnh cường độ và xem trước khi áp dụng. Không yêu cầu API key hoặc gửi ảnh lên máy chủ.
- Màu là suy đoán từ nội dung, **không xác minh màu lịch sử**. Cần chỉnh tay hoặc tham khảo ảnh/tư liệu có màu đã biết nếu tính chính xác quan trọng. Ví dụ ảnh cũ trong ứng dụng được ghi rõ là mô phỏng bạc màu và xước.

## Generative Fill theo prompt, biểu cảm và dấu vết da

Đây là luồng **ComfyUI tùy chọn**, cần máy AI của bạn. Luma không cung cấp GPU công cộng miễn phí hay tự nhận có máy AI khi chưa kết nối.

1. Vào Production → **Kết nối máy AI**. Nhập endpoint và token nếu máy chủ yêu cầu. Bấm Kiểm tra để lấy checkpoint, chọn checkpoint, rồi Lưu kết nối. Token chỉ giữ trong phiên, không lưu vào `.luma` hay localStorage.
2. Máy cần các node ComfyUI có sẵn: CheckpointLoaderSimple, LoadImage, CLIPTextEncode, VAEEncodeForInpaint, KSampler, VAEDecode, SaveImage; dùng checkpoint SD/SDXL phù hợp. Luồng hiện tại chưa hỗ trợ checkpoint Flux hoặc custom workflow.
3. Endpoint cần cho phép CORS đúng origin Luma. Ví dụ tự host tại localhost: `python main.py --enable-cors-header http://localhost:3000`. Khi mở Luma qua HTTPS, dùng endpoint HTTPS hoặc quyền mạng cục bộ được trình duyệt cho phép. Không bỏ kiểm tra chứng chỉ TLS.
4. Mở lại Generative Studio, chọn engine **Máy AI của tôi**. Prompt được gửi cùng ảnh và mask tới endpoint đã chọn. Máy có thể lưu ảnh input/output theo cấu hình ComfyUI.
5. Tab **Biểu cảm** có preset cười tự nhiên, miệng khép tự nhiên và nét mặt thư giãn. **Tự chọn vùng miệng bằng AI** dùng mốc mặt thật; chọn từng mặt và chỉnh mask trước khi tạo. Đây là tái sinh vùng miệng, không chỉ kéo khóe môi.
6. Tab **Da & dấu vết** có preset dấu mụn nhỏ, tàn nhang/đốm sậm, mảng đỏ/bong tróc, nếp nhăn nhỏ. **Tự chọn da bằng AI** tạo mask da và loại vùng mắt, môi, chân mày bằng mốc mặt; luôn kiểm tra lại mask.
7. Seed cho phép lặp thông số; mức tái sinh điều chỉnh mức thay đổi của diffusion. Ảnh gửi tới ComfyUI được giới hạn cạnh tối đa khoảng 1024 px và căn bội số 8, sau đó ghép vào composite ở mask. Vùng ngoài mask giữ nguyên. Chất lượng, độ giống người thật và kết quả phụ thuộc checkpoint, mask và prompt.

Không có mô hình chẩn đoán/phân loại bệnh da trong bản này. Các nhãn preset mô tả **dấu vết nhìn thấy**, không xác nhận mụn bệnh lý, vảy nến, eczema hay tổn thương ác tính. Không có đánh giá lâm sàng hoặc công bố độ chính xác chẩn đoán.

Nút **Dừng xử lý** ngừng nhận kết quả; tác vụ đang chạy trên máy ComfyUI có thể tiếp tục. Luma chỉ xóa job đang chờ có ID của chính phiên, không gửi lệnh interrupt toàn máy làm gián đoạn người dùng khác.

## Đồng biên tập hai người

Vào **File → Đồng biên tập**. Chỉ dùng mã mời với người bạn muốn cấp quyền sửa; không có tài khoản hoặc phân quyền xem riêng trong phiên này.

**WebRTC trực tiếp:** chủ phiên Tạo mã mời → người được mời dán mã và Nhận lời mời → gửi mã trả lời → chủ phiên dán và Hoàn tất kết nối. Tài liệu hiện tại của người nhận được giữ ở tab riêng. Nếu tài liệu nhận về trùng ID với tab đã mở, bản cũ được giữ thành bản riêng; lịch sử Undo và liên kết nội dung Smart Object vẫn theo bản cũ. Một số mạng cần STUN/TURN; nhập TURN của bạn trong phần Mạng khi cần. STUN có thể nhận thông tin địa chỉ mạng; nội dung đi qua datachannel mã hóa WebRTC.

**Máy chủ chuyển tiếp của bạn:** dùng lựa chọn Máy chủ của tôi, nhập `wss://your-server.example/luma-collab`, Tạo mã và gửi cho người cùng sửa. Người nhận dán mã và Nhận lời mời; **không cần mã trả lời**. Mã nguồn Node đi kèm có server này trong `npm start`. Mở Luma bằng HTTPS hoặc localhost để có WebCrypto. Đặt `LUMA_ALLOWED_ORIGINS` thành danh sách origin được phép, phân cách dấu phẩy, khi kết nối từ tên miền khác. Ví dụ:

```bash
LUMA_ALLOWED_ORIGINS=https://editor.example.com npm start
```

Phần server mặc định chỉ nghe 127.0.0.1:3000; cấu hình reverse proxy HTTPS/WSS khi tự triển khai Internet. AES-GCM mã hóa nội dung ở trình duyệt bằng khóa trong mã mời; khóa không được gửi tới relay. Máy chủ giữ room và kết nối tạm trong RAM, chuyển các envelope mã hóa, không lưu tài liệu. Bản Luma công khai là static host, **không kèm relay WSS đang vận hành**.

Hai người đồng bộ layer, thuộc tính, thứ tự, nhóm, nội dung Smart Object, guide và thiết lập màu. Vùng chọn, layer đang chọn và zoom riêng. Thay đổi khác thuộc tính được gộp; xung đột cùng thuộc tính dùng thứ tự Lamport rồi ID người sửa. Undo tạo thay đổi mới cho cả hai. Giới hạn tài liệu 32 MB, hai người; không có offline replay, cloud backup, live cursor hoặc lịch sử phiên sau khi ngắt. Ngắt kết nối vẫn giữ tài liệu ở mỗi máy.

## Canva và các giới hạn còn lại

Bản này chọn triển khai đồng biên tập trong Luma. **Chưa mở và chỉnh trực tiếp tài liệu native Canva**, chưa có OAuth Canva và không quảng cáo nhập được đầy đủ layer từ link Canva. Các template/shape/text của Luma vẫn chỉnh độc lập như trước.

Canvas tối đa 16 MP, cạnh ≤8192 px và ≤150 layer. Smart Object và AI không thay thế một engine tiled/GPU. Trọng số nén giảm tải xuống, không chứng minh giảm bộ nhớ suy luận. Chưa có benchmark so sánh Photoshop/PhotoCraft, bộ test ảnh hỏng lịch sử đại diện, đánh giá lâm sàng, đánh giá độ giống danh tính, hoặc chứng nhận prepress. `QA.md` ghi rõ phần đã kiểm chứng.
