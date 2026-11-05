# Mới trong Luma8.0

- Khóa vị trí/pixel/độ trong, kế thừa nhóm và kiểm tra atomic trước biến đổi.
- Liên kết/tách mask, Move kéo riêng mask hoặc nội dung, Undo/Escape.
- Alpha lưu/tô/nạp/đảo/tên/bản sao/PNG; PSD/PSB giữ plane thật.
- Work/Saved Paths, Direct Selection A, sửa anchor/handle, chia đôi/xóa điểm.
- Type Studio theo đoạn, paragraph metrics, giữ kiểu khi đổi một thông số.
- Gaussian Blur/Unsharp Mask Smart Filters native trong phạm vi tương thích.
- Menu Chữ/Vùng chọn, panel Lớp/Kênh/Đường, mẫu thực hành và hướng dẫn.

Xem [CORE-STUDIO.vi.md](CORE-STUDIO.vi.md). Các phần dưới là lịch sử phiên bản.

# Mới trong Luma 7.2 — Giao diện desktop

- Menu Cửa sổ và bố trí Chỉnh ảnh / Thiết kế / Retouch; dock thay đổi độ rộng và ẩn/hiện panel.
- Màu SV/hue, HEX/RGB, mẫu màu, gradient và pattern lặp thật.
- Navigator / Histogram / Thông tin; Lớp / xem Kênh / Đường vector / Lịch sử.
- Fill riêng Opacity; khóa tỉ lệ; mask density và tạm tắt.
- Levels RGB/R/G/B, mức đầu ra; Hue/Saturation Colorize; selection feather/anti-alias và Select & Mask.
- Chín nhóm layer style Canvas; cây filter/fx có bật/tắt và sửa trực tiếp; Undo và Cancel thật.

Đối chiếu đầy đủ và các tính năng còn thiếu: [DESKTOP-WORKSPACE.vi.md](DESKTOP-WORKSPACE.vi.md). Smart Filters Photoshop, kênh alpha/Work Path độc lập, kiểu chữ nâng cao và Canva native vẫn chưa hoàn tất.

# Mới trong Luma 7.1 — Art & Pattern

- 17 preset local: chấm halftone, dấu +, ô vuông silhouette, 6 họa tiết hình học khác, pixel, vector màu, poster, truyện tranh, màu nước, chì, khối nổi và phù điêu.
- AI chọn chủ thể / bấm điểm, cọ giữ bỏ, Undo/Redo, so sánh, zoom, giữ nguồn và recipe .luma chỉnh lại.
- SVG hình học thật cho các kiểu vector ở mức 100%; PNG native 300 DPI cho mọi kiểu.
- Bốn phong cách Art/3D tạo sinh qua ComfyUI với ảnh gốc làm tham chiếu. Đây là ảnh 2D, không tạo mesh 3D; chưa có GPU được kiểm chứng.

Vào **Chỉnh ảnh → Preset & hiệu ứng → Art & Pattern**. Xem [ART-PATTERN.vi.md](ART-PATTERN.vi.md) và [QA.md](QA.md).

# Mới trong Luma Studio 7.0 — Larx Vo

**Created by Larx Vo · vovinhlac.com · Free to use.** Tên tác giả xuất hiện trong giao diện, Giới thiệu và metadata xuất PNG/JPEG/CMYK TIFF.

- 13 preset Studio / Mùa / Ánh sáng / Bóng; sáu actions, tạo preset/actions riêng, xuất nhập JSON.
- Thu lá vàng, xuân xanh, đông sương tuyết; lá có vân và alpha, gió, xoay, nhòe và độ sâu; tuyết nhiều lớp.
- Ngày/đêm, trời/mây, đặt trăng/mặt trời, gợi ý đèn có thể thêm/bỏ; chủ thể có bóng tiếp xúc/bay/silhouette.
- DeepLab bảo vệ vùng người kể cả thành phần nhỏ; trời/lá/đèn vẫn là gợi ý cần xem mask và có cọ/bấm chọn sửa lại.
- Không chặn ảnh chính theo dung lượng MB/16 MP/8192 px; giữ JPEG/PNG/WebP gốc, preview nhẹ, xử lý native tùy bộ nhớ. Preset Studio dựng theo ô có mép chồng.
- PNG/JPEG/PSD/PSB ghi DPI in, mặc định 300; JPEG mặc định 100%; CMYK TIFF nhúng ICC của nhà in.
- Giữ layer nguồn, recipe .luma mở lại, Ctrl+Z/Redo cho thông số/nét sửa và Undo tài liệu sau áp dụng.

Đây là hiệu ứng 2D có vùng điều khiển; tạo lại toàn cảnh bằng AI cần ComfyUI được kết nối. Chưa có kiểm chứng GPU thật, nhập .XMP/.ATN, bộ cài Windows ký số hay bảo đảm kích thước vô hạn. Xem [STUDIO-7.vi.md](STUDIO-7.vi.md) cho cách dùng và giới hạn đầy đủ; các ghi chú phiên bản dưới đây là lịch sử, mức giới hạn ảnh cũ được thay bằng quy tắc 7.0 ở trên.

# Mới trong Luma 6.9 — Menu theo công việc & Auto chân dung

- Thanh trái còn **Chỉnh ảnh · Thiết kế · Tệp · AI · Nâng cao**. Thanh trên giữ menu chung, tìm, lưu và xuất.
- Chỉnh ảnh chia bốn nhóm có chip chọn nhanh; Thiết kế chia Mẫu / Thành phần / Chữ. Tìm có dấu, không dấu, tiếng Anh; Ctrl+K tìm toàn bộ. Có Dùng gần đây và Sửa lại cho công cụ đang dùng trên layer.
- Auto chân dung: một chạm gọn má/hàm/cằm, dịu bóng dầu, mày rõ và giảm râu lún phún, sau đó kéo từng thanh theo ý.
- Giảm bóng giữ chi tiết da nguồn; mày đậm/nhạt có mép mềm; hình học bảo vệ vùng trung tâm mặt. Ctrl+Z / Ctrl+Shift+Z trong Retouch; .luma giữ nguồn và thông số để mở lại.

Hướng dẫn: [NAVIGATION.vi.md](NAVIGATION.vi.md), [PORTRAIT-AUTO.vi.md](PORTRAIT-AUTO.vi.md).

# Mới trong Luma 6.8 — Phong cảnh HDR một chạm

- Bốn preset: HDR chiều nhẹ, HDR rõ sâu, Trời trong xanh, Tự nhiên; tự cân từ ảnh nguồn rồi chỉnh tiếp bằng 17 thanh.
- Mở vùng tối, giữ vùng sáng, tăng nét sắc độ có giới hạn, giảm hạt vùng tối, tăng độ rực và tương phản nhẹ.
- Làm trời lạnh xanh hơn, giữ sắc mây vàng hồng, nhấn chiều ấm/nắng nhẹ theo phần màu ấm đang có và tâm do người dùng chọn.
- Xem gợi ý vùng trời theo màu/kết nối, cọ thêm/bỏ, tìm lại vùng trời; tắt chỉnh trời riêng được khi không phù hợp.
- Ctrl/⌘ Z, Shift Z / Ctrl Y cho thông số và nét cọ; so sánh, zoom 200%/400%, layer riêng, `.luma` sửa lại và PNG nguyên độ phân giải.
- Hiệu ứng HDR từ một ảnh SDR, không ghép phơi sáng hoặc xuất HDR10; không sinh chi tiết đã mất. Xem **LANDSCAPE.vi.md** và **QA.md**.

## Lịch sử tính năng

# Mới trong Luma 6.7 — Đổi màu áo quần & Đồ uống

- Click vest/áo/quần, thử 10 màu hoặc HEX; giữ nếp vải, sắc độ, chi tiết gốc và alpha. Có giữ trắng tùy chọn; mặt được phát hiện giúp xếp hạng mask tránh chọn cả người.
- Ba phương án vùng chọn; thêm/bớt điểm AI, khoanh đa giác, cọ thêm/bỏ, viền nới/thu và mềm, soi 200%/400%.
- Ly: chọn vùng, khoanh nhãn, đề xuất mực tối, sửa mask rồi xóa bằng LaMa; chọn màu riêng cho ly; sáng/ấm/tương phản toàn ảnh.
- Bốn preset đồ uống, thay nền đồ họa hoặc ảnh tự tải, blur hậu cảnh không kéo màu ly ra viền, nắng/bokeh/bóng tiếp xúc 2D có thanh chỉnh.
- Undo/Redo cho thông số/mask/nét cọ/xóa/ảnh nền; layer riêng, PNG nguyên độ phân giải và `.luma` giữ nguồn, vùng chọn và thông số để sửa lại.
- Ưu tiên desktop Windows qua Chrome/Edge; chưa là bộ cài `.exe`. AI có thể chọn sai, xóa còn nét hoặc dự đoán sai vùng bị che; chưa xử lý đúng mọi khúc xạ của ly trong suốt. Xem **COLOR-BEVERAGE.vi.md** và **QA.md**.

## Lịch sử tính năng

# Mới trong Luma 6.6 — Giữ người & làm sạch tài liệu

- Giữ người chính, thêm/bớt điểm nếu thiếu đầu/tay hoặc chọn dính; tự xóa vùng người còn lại. Vùng khóa giữ luôn thắng cọ xóa và nới viền. Có hai mức ngữ cảnh và kiểm tra còn giống người.
- Mở sửa mask cũ, cọ khôi phục từ nguồn, xem ảnh gốc dưới vùng khuyết, toàn thân + viền tóc mềm, tinh viền nguyên độ phân giải và giảm viền ám màu.
- Ctrl/⌘ Z, Shift Z và nút làm lại ngay trong Tách nền, Xóa người và Tài liệu. Lịch sử thông số, mask, điểm và nét cọ theo phiên có giới hạn bộ nhớ.
- Tài liệu một chạm: giảm bóng, đều nền, giảm nếp nền, làm rõ mực chữ/dấu đỏ; 10 thanh chỉnh, bốn preset, bốn góc căn phối cảnh, so sánh/zoom, layer và PNG nguyên độ phân giải.
- Tăng rõ pixel còn có; không viết lại chữ/dấu, không tự biết chi tiết đã mất. Nền cảnh lớn hoặc che lấp nhiều vẫn có thể lem/sai; trang cong 3D chưa được tháo phẳng. Xem **SUBJECT-PAPER.vi.md** và **QA.md**.

## Lịch sử tính năng

# Mới trong Luma 6.5 — Retouch sản phẩm

- Bấm đồng xu / sản phẩm: SlimSAM chọn và tinh viền, tự cân theo preset Bạc sáng sạch / Studio tự nhiên / Ánh sáng cửa sổ / Bạc tương phản.
- 18 thanh điều chỉnh, tách tác động sản phẩm với ánh sáng toàn ảnh. Cọ thêm/bỏ vùng, elip, viền khác, nới/thu, mềm viền, so sánh và zoom.
- Giảm ám vàng/nâu, giữ biến thiên sáng tối còn có, chỉnh sắc độ, phản quang, hướng sáng hai chiều, vùng tối/sáng và bóng tiếp xúc đã có.
- Giữ kích thước nguồn đến 16 MP. Ngoài mask giữ nguyên khi tắt toàn ảnh; alpha nguồn được giữ. Layer riêng, Undo, `.luma` giữ nguồn/mask/thông số, mở lại không cần chọn AI lần nữa.
- Không khôi phục chữ/hoa văn mất nét, không phân loại vật liệu hay dựng bóng 3D. Xem PRODUCT-STUDIO.vi.md và QA.md để biết phạm vi đã kiểm chứng.

## Lịch sử tính năng

# Bổ sung 6.4 — Smart Remove

Mở **Xóa người** trên thanh đầu, bấm vào người/vật thể: AI chọn vùng và tạo nền tự động. Có tự tìm người, gợi ý vật nhỏ sát đối tượng, tinh viền ở vùng phóng gần, bảo vệ cây/lá và dây sáng còn nhìn thấy, cọ xóa/giữ, nới viền, khớp kết cấu và ba ngữ cảnh nền. Giữ nguyên độ phân giải nguồn đến 16 MP; lưu `.luma` để sửa lại vùng/thông số. Đây là tái dựng dự đoán, cần kiểm tra vùng chồng chéo. Xem **REMOVE-STUDIO.vi.md**.

# Bổ sung 6.3 — Portrait Studio

42 preset sửa lại được trong Retouch Lab: mắt đỏ tự động / chạm đồng tử, màu mống mắt, màu tóc theo mask AI, ria mép / râu cằm / râu dê / quai nón / lún phún, giảm sợi râu nhỏ, da studio giữ kết cấu gốc, đồi mồi và nhăn, cung môi cười nhẹ / rộng / lệch / thư giãn. Có luồng LaMa xóa vùng râu ngay trên thiết bị; tạo râu ảnh thật và biểu cảm sinh thêm chi tiết qua ComfyUI. Xem **PORTRAIT-STUDIO.vi.md** cho thao tác, đường dẫn menu và giới hạn chất lượng.

# Bổ sung 6.2 — Subject Studio

Tách nền tự động, nhận diện vùng vật thể theo nhóm, bấm điểm giữ/bỏ, alpha chân dung, mask tóc riêng, cọ và tinh chỉnh viền. Có so nền, zoom, ba phương án mask, giữ tối đa 8 đối tượng thành layer riêng, mask/vùng chọn sửa được và PNG trong suốt. Chạy model thật trên CPU/WASM, không cần GPU hoặc gửi ảnh tới API. Xem SUBJECT-STUDIO.vi.md cho cách dùng, hiệu năng và giới hạn.

# Bổ sung 6.1

Bộ local Windows/NVIDIA, kiểm tra tensor CUDA, bài thử ComfyUI ba mask và semantic ranking nhãn da nghiên cứu. Cần chạy kit / checkpoint / model trên máy của bạn; chưa có kiểm chứng lâm sàng, GPU thực trong môi trường phát triển hoặc Canva native được duyệt. Xem PRODUCTION.vi.md và gpu-kit/README.vi.md.

# Bổ sung 6.0

Production có nhập PPTX/SVG, bản đồ dấu vết bề mặt da, ghép ảnh tham chiếu bằng ba cặp điểm, màu chỉ dẫn Lab và bài kiểm chứng ComfyUI có báo cáo. Xem PRODUCTION.vi.md để biết định dạng, cách dùng và giới hạn. Chưa có Canva native, phân loại bệnh lâm sàng hoặc GPU được kiểm chứng trong môi trường phát triển.

# Luma Studio 5.0.1 — tính năng và cách dùng

Luma Studio là trình chỉnh ảnh và thiết kế chạy trong trình duyệt, có mã nguồn để tự host. Bản 5.0 thêm Smart Objects, CMYK/ICC, neural fill, tô màu và cộng tác; xem **PRODUCTION.vi.md** cho hướng dẫn đầy đủ. Retouch Lab của 4.0 có có nhận diện vùng da/mốc mặt và preset, bên cạnh layer, nhóm và trao đổi PSD/PSB của bản trước. Đây là bản beta nâng cao; chưa bao phủ toàn bộ Photoshop hoặc Canva.

## Các tính năng đã hoạt động

| Nhóm | Chức năng thực tế |
| --- | --- |
| Tài liệu | Nhiều tab, mở/kéo thả/dán ảnh, tạo canvas, crop, đổi kích thước ảnh/canvas, xoay |
| Layer | Ảnh, paint, chữ, shape, adjustment, nhóm lồng nhau; tìm/lọc, thu gọn nhóm, visibility, lock, opacity |
| Cấu trúc | Chọn nhiều, group/ungroup, duplicate, xóa, kéo đổi thứ tự/đưa vào nhóm, clipping mask, merge/rasterize có kiểm tra điều kiện |
| Bố cục | Căn 6 hướng, phân bố khoảng cách ngang/dọc, guides, snapping, transform chính xác, lật kèm mask |
| Vùng chọn | Chữ nhật, ellipse, lasso, Magic Wand; thay/cộng/trừ/giao, đảo, feather, mở rộng/thu hẹp |
| Mask | Mask hình học/bitmap, mask nhóm, vẽ reveal/hide, đảo/xóa mask; mask AI có thể sửa tiếp |
| Retouch | Clone, Healing blend, Dodge, Burn trên layer riêng; size, strength, hardness, giới hạn theo vùng chọn |
| Chỉnh màu | 16 adjustment gồm Curves RGB từng kênh, Levels/histogram, Channel Mixer và Shadows/Highlights |
| Bộ lọc | 9 loại, stack tối đa 12/layer; đổi thông số/thứ tự, bật/tắt, xóa, preview, cancel |
| Vector và chữ | Pen Bezier, shape, linear/radial gradient, tracking, underline, chữ xuống dòng, font tự nhập |
| Hiệu ứng | Shadow, glow, stroke cho layer/nhóm; sao chép/dán style |
| Thiết kế | 6 template gốc có layer sửa được, elements, typography presets, palettes |
| AI cục bộ | Tách người và phân đoạn các nhóm vật thể bằng neural model trong WebAssembly worker |
| Đầu ra | PNG/JPEG/WebP, SVG, PSD/PSB, project `.luma`, ZIP nhiều kích thước |
| Công việc | Autosave/recent trên thiết bị, Undo/Redo, navigator, command palette, phím tắt |

## Retouch Lab — chọn preset rồi chỉnh thêm

Bấm **Retouch Lab** trên header/rail, hoặc mở menu **Filter**. Có 17 preset chia thành ba tab:

| Tab | Preset và thông số |
| --- | --- |
| Da & chi tiết | Da tự nhiên, mụn/đốm nhỏ, tàn nhang/đồi mồi, nếp nhăn nhẹ, da đỏ/bong vảy; chỉnh độ nhạy, mức vá đốm, làm mịn, sắc tố, sắc đỏ và kết cấu |
| Khuôn mặt | Mắt to nhẹ, môi mỏng/đầy, mày rậm/thanh, cười nhẹ, khóe môi trung tính; chỉnh thêm chiều ngang mắt/miệng, độ mở miệng và mật độ mày |
| Phục hồi ảnh cũ | Ảnh bạc màu, ảnh cũ đen trắng, ố ướt/loang nhẹ, xước/bụi nhỏ, tư liệu lịch sử; chỉnh cân sáng, nhiễu, màu ám, ố loang, vùng vá và độ rõ |

**Cách dùng:** chọn layer ảnh → mở Lab → chờ nhận diện nếu sửa da/mặt → chọn preset → kéo thanh Gốc/Kết quả để so sánh → tinh chỉnh → **Áp thành layer riêng**. Chọn layer kết quả rồi **Sửa lại Retouch** để mở lại thông số. Các tab kết hợp được với nhau; đổi preset chỉ đặt lại nhóm thông số của tab đó.

- **AI vùng da:** phân biệt da mặt/da cơ thể bằng model. Bật **Hiện mask da** để kiểm tra. Chọn toàn bộ da, da của mặt đã chọn, da cơ thể hoặc chỉ vùng tự tô. Nút **+ / −** bổ sung hoặc bảo vệ vùng; bỏ nét cuối bằng nút Undo cọ. Có thể bật bảo vệ mắt, môi, chân mày và giữ đốm tối khi tự tìm khuyết điểm.
- **Mốc khuôn mặt:** model trả 478 mốc; tối đa 8 mặt được nhận, chọn mặt cần sửa. Chọn **Soi khuôn mặt**, 200% hoặc 400%; kéo ảnh khi phóng to để đổi vùng xem. Môi mỏng/đầy và độ mở miệng là hai thông số riêng.
- **Phục hồi:** bật **Hiện vùng vá** để xem vùng hỏng tự tìm; tô thêm vùng cần vá hoặc bỏ vùng bị chọn nhầm. Vá dựa vào pixel lân cận. Cân ố loang phù hợp hư hỏng nhẹ; nên tăng mức từ từ.
- **Nguồn và recipe:** nguồn ảnh giữ nguyên, chỉ được ẩn sau khi tạo kết quả để alpha/opacity không bị chồng hai lần. `.luma` lưu nguồn, thông số, mask da, các mốc, nét tinh chỉnh và giới hạn vùng chọn. Undo hoàn tác cả lần áp. Vẽ Brush/Eraser trực tiếp lên pixel kết quả sẽ tách recipe; Undo có thể khôi phục.
- **Độ phân giải:** preview cạnh tối đa 1000 px; dựng kết quả từ ảnh nguồn tối đa 8 MP. Ảnh lớn hơn có thông báo tạo bản sao 8 MP và vẫn giữ nguồn đầy đủ trong project. Dữ liệu không gửi sang dịch vụ inference; lần đầu tải khoảng 21.6 MB model, cộng runtime WASM khoảng 14 MB nếu chưa có cache.

**Giới hạn cần biết:** AI nhận vùng da và mốc mặt, không nhận dạng/chẩn đoán vảy nến hay các bệnh da. Preset chỉ giảm dấu vết nhìn thấy bằng xử lý ảnh, không bảo đảm xóa sạch ở mọi ảnh. Chỉnh biểu cảm là biến dạng 2D của ảnh đang có; chưa tạo thêm răng, sợi mày, thay biểu cảm tạo sinh hay tái dựng miệng bị che. Mặt nghiêng, ảnh mờ hoặc che khuất có thể nhận sai/không nhận.

Ảnh ướt mất lớp ảnh, rách/mất mảng lớn hoặc chi tiết đã mất không thể được khôi phục trung thực bằng các thuật toán hiện có trong bản này. Chưa có tô màu đen trắng tự động hoặc phục hồi tạo sinh. Preset đen trắng giữ đơn sắc. Đây là công cụ hỗ trợ chỉnh ảnh và phục hồi nhẹ, không phải cam kết phục hồi mọi ảnh chiến tranh/ảnh bị hư.

Có ảnh thử qua **Filter → Ảnh mẫu · Retouch chân dung** và **Ảnh mẫu · Phục hồi ảnh cũ mô phỏng**, hoặc nút **Thử ảnh mẫu** trong Lab. Ảnh cũ mẫu được làm bạc màu/xước nhân tạo, không phải ảnh hư lịch sử thật. Xem QA.md để biết kết quả kiểm thử thực tế.

## 1. Mở và sửa PSD

1. Chọn **Open** hoặc **File → Open**, mở `.psd`/`.psb` RGB 8-bit.
2. Đọc báo cáo import. PSD đơn giản giữ layer, nhóm, clipping, pixel mask, chữ và adjustment được hỗ trợ.
3. Nếu file dùng smart object, vector mask, hiệu ứng hoặc adjustment chưa hỗ trợ, ứng dụng mở ảnh merged đã lưu trong PSD và thông báo rõ. Khi đó không còn sửa riêng nội dung Photoshop bên trong.
4. Lưu `.luma` làm bản gốc để giữ mọi dữ liệu chỉnh sửa của Luma.
5. Khi cần trao đổi, chọn **Export → PSD/PSB** và tùy chọn editable. Chữ đơn giản và adjustment đủ điều kiện có metadata native; shape, path, style và live filter được render thành pixel.

Chỉ hỗ trợ RGB 8-bit; chưa nhập PSD CMYK/Lab hoặc 16/32-bit; ICC/CMYK đầu ra và xem thử nằm trong Production. PSB dùng cùng giới hạn tài nguyên với PSD, không hỗ trợ tài liệu khổng lồ. Font metrics và cách tính màu có thể khác Photoshop. Bảng chi tiết nằm trong README.md.

## 2. Quản lý thiết kế nhiều layer

- **Shift-click** chọn dải; **Ctrl/⌘-click** thêm/bỏ từng layer.
- Vào **Studio tools** để Group, Ungroup, Transform, căn chỉnh hoặc phân bố. Căn một layer dựa vào canvas; căn nhiều layer dựa vào khung bao chung. Phân bố cần ít nhất 3 layer.
- Nhóm là container thật; opacity của nhóm áp vào kết quả gộp một lần. Có thể lồng nhóm và gắn mask cho nhóm.
- Kéo layer vào nhóm để đổi parent; giữ **Alt** khi thả để đặt thành sibling. Không cho tạo vòng lặp parent.
- **Clipping mask** dùng alpha của layer nền phía dưới trong cùng nhóm. Nền bị ẩn sẽ làm nội dung clip không hiển thị.
- **Transform** nhập scale đều, rotation và dịch X/Y; nội dung con, kích thước chữ và bitmap mask di chuyển cùng nhau. Chưa có warp, perspective hay mesh transform.
- **Guides & snapping** thêm guide theo tọa độ; kéo layer sẽ bắt vào canvas, guide và khung layer khác. Giữ Shift khi kéo để tạm bỏ snapping.

Merge chỉ nhận các sibling liền nhau, unlocked, Normal blend, không phải adjustment hoặc clipping. Ungroup từ chối các nhóm còn mask/filter/style/clipping hoặc opacity khác 100% để tránh làm sai ảnh. Có thể đơn giản hóa trước hoặc rasterize; nhóm Pass-through cần đổi sang Normal trước khi rasterize.

## 3. Chỉnh ảnh không phá nguồn

**Adjustments** có 16 loại: Curves, Levels, Brightness/Contrast, Exposure, Vibrance, Hue/Saturation, Black & White, Temperature/Tint, Blur, Invert, Grain, Color Balance, Shadows/Highlights, Posterize, Threshold, Channel Mixer. Đây là layer sống, có thể đổi thông số, opacity, mask hoặc tắt đi.

**Filter → Live filter stack** mở 9 loại filter: Sharpen, Unsharp Mask, Gaussian Blur, Pixelate, Median Noise Reduction, Emboss, High Pass, Vignette, Sepia. Mỗi layer/nhóm có tối đa 12 filter. Thứ tự ảnh hưởng kết quả; có thể bật/tắt hoặc đổi lại sau. Cancel hoàn nguyên preview. Gaussian dùng xấp xỉ bằng ba lượt box blur; Median dùng cửa sổ 3×3.

Trong **Studio → Preview**, xem kênh Red/Green/Blue/Alpha hoặc bypass adjustment/filter để so sánh. Export luôn dùng thiết kế thật, không dùng chế độ preview.

Shadow, glow và stroke nằm trong **Layer styles**. Chúng vẫn sửa được trong `.luma`; sang PSD sẽ được render.

## 4. Retouch

- Chọn **Clone stamp** hoặc **Healing blend**, **Alt-click** điểm mẫu rồi tô vùng cần sửa.
- **Dodge/Burn** làm sáng/tối bằng nét cọ. Điều chỉnh Size, Strength và Hardness trên thanh công cụ.
- Các nét retouch nằm trên layer riêng, không ghi đè ảnh gốc. Vùng chọn giới hạn vùng tô; Undo hoàn tác một stroke.
- Healing blend là hòa trộn patch có bù màu đơn giản. Chưa có reconstruction content-aware, Poisson healing hoặc xóa vật thể tạo sinh.

## 5. Pen, chữ và template

**Pen:** click tạo góc, kéo tạo tay nắm Bezier; click điểm đầu, Enter hoặc Finish để kết thúc. Escape hủy đường đang vẽ. Path lưu thành dữ liệu vector trong project và SVG; có thể transform, đổi màu và style. Chưa có UI chọn/sửa từng node sau khi tạo.

**Chữ:** double-click trên canvas hoặc dùng Properties để sửa nội dung, font, size, weight, italic, underline, tracking, line height và alignment. Text tự xuống dòng theo frame. **Type → Import a font** nhập WOFF/WOFF2/TTF/OTF, tối đa 8 font/project, mỗi font 2.5 MB. Chỉ chia sẻ font khi có quyền phù hợp.

**Design** chứa 6 template gốc có chữ và shape riêng. Đây là luồng thiết kế tương tự Canva; chưa mở native Canva và chưa kết nối tài khoản Canva. Bản 5.0 có đồng biên tập trong Luma qua WebRTC hoặc máy chủ tự host.

## 6. AI Studio

1. Chọn layer ảnh và mở **AI Studio**.
2. Chọn Portrait hoặc một nhãn Objects, chạy model và xem preview.
3. Chỉnh threshold/softness, chọn **Apply editable mask** hoặc chuyển sang selection.
4. Dùng Brush/Eraser trên mask để tinh chỉnh; Undo trả về trạng thái trước.

AI chạy trên CPU của thiết bị trong worker, không cần API key hoặc credit trả phí. Model/runtime tải khi dùng lần đầu, khoảng 15 MB cho Portrait hoặc 23 MB cho Objects tính cả runtime chung. Mức chính xác và tốc độ phụ thuộc ảnh/thiết bị. Chưa có prompt-to-image, generative fill hay trợ lý ngôn ngữ.

## 7. Lưu và xuất

| Định dạng | Khi nên dùng | Giới hạn cần biết |
| --- | --- | --- |
| `.luma` | Bản master sửa tiếp đầy đủ | Không chứa lịch sử Undo; cần app mới để đọc layer mới |
| PNG | Ảnh có alpha | Render phẳng |
| JPEG | Ảnh thành phẩm | Không có alpha |
| WebP | Ảnh web | Render phẳng |
| SVG | Chữ/shape/path vector và nhóm | Filter/style/clipping dùng raster; có adjustment sẽ nhúng composite |
| PSD/PSB | Trao đổi layered với ứng dụng khác | Không giữ native mọi tính năng Photoshop |
| Size pack ZIP | Nhiều kích thước social trong một lần | Fit/Fill/Stretch chỉ resize/pad/crop, không tự sắp lại bố cục |

Size pack gồm Original, Square 1080×1080, Portrait 1080×1350, Story 1080×1920, Landscape 1920×1080. Chọn kích thước, cách fit và background trước khi export.

Autosave chỉ nằm trong trình duyệt/thiết bị hiện tại. Tải `.luma` để chuyển máy hoặc sao lưu.

## 8. Phím tắt

| Thao tác | Phím |
| --- | --- |
| Open / Save / Export | Ctrl/⌘ O / S / Shift S |
| Undo / Redo | Ctrl/⌘ Z / Shift Z |
| Group / Ungroup | Ctrl/⌘ G / Shift G |
| Clipping mask | Ctrl/⌘ Alt G |
| Transform | Ctrl/⌘ T |
| Duplicate / Merge selected | Ctrl/⌘ J / E |
| Command palette | Ctrl/⌘ K |
| Select all / Deselect | Ctrl/⌘ A / D |
| Fit / 100% | Ctrl/⌘ 0 / 1 |
| Clone / Healing blend | S / J |
| Dodge / Burn / Pen | O / Shift O / P |
| Brush / Eraser | B / E |
| Pan tạm thời | Giữ Space và kéo |

## Phạm vi và hướng phát triển

Bản hiện tại có giới hạn canvas 16 MP, cạnh tối đa 8192 px và 150 layer; export PSD/PSB tối đa 40 layer, canvas 8 MP, tổng 48 triệu layer-pixel. Canvas 2D và snapshot history có thể dùng nhiều RAM khi layer lớn. Chưa có benchmark chứng minh nhẹ hoặc nhanh hơn Photoshop/PhotoCraft.

Để đạt phạm vi ứng dụng chuyên nghiệp đầy đủ còn cần engine tiled/GPU, HDR, CMYK canvas nguyên sinh, nhập/xuất PSD phức tạp, vector-mask interoperability, node editor, text nhiều style, artboards, plugin API, cloud backup, phân quyền cộng tác nhiều người và bộ fixture PSD thực tế lớn. Smart Objects, ICC/CMYK output, neural fill, tô màu và cộng tác hai người đã có trong 5.0 với các giới hạn ở PRODUCTION.vi.md. QA.md nêu rõ phần đã kiểm thử và phần chưa xác minh.
