> Ghi chú của7.2. Trạng thái mới: [CORE-STUDIO.vi.md](CORE-STUDIO.vi.md) bổ sung alpha, Work Path, typography, khóa riêng và một phần Smart Filters.

# Luma Studio 7.2 — Giao diện desktop và đối chiếu tính năng

Được tạo bởi **Larx Vo · [vovinhlac.com](https://vovinhlac.com)**. Miễn phí sử dụng.

Bản này nâng cấp trực tiếp editor hiện có. Ảnh tham chiếu được đối chiếu với mã nguồn và thao tác thật; không lấy nhãn trên ảnh làm bằng chứng rằng Luma đã hỗ trợ tính năng đó.

## Bố trí và menu

- **Thanh trên:** menu chung, bố trí làm việc, tìm công cụ, Lưu dự án và Xuất ảnh.
- **Thanh tác vụ trái:** Chỉnh ảnh / Thiết kế / Tệp / AI / Nâng cao. Các công cụ chuyên biệt nằm trong nhóm có tìm kiếm, không xếp thành hàng dài các nút trên header.
- **Thanh công cụ:** Move, vùng chọn, cắt, vẽ, retouch, Pen, chữ, hình, gradient, lấy màu, bàn tay và zoom. Tùy chọn của công cụ đang dùng nằm ngay dưới menu.
- **Dock phải:** tài nguyên màu → thuộc tính lớp → xem/đo ảnh → cấu trúc lớp. Các phần cuộn riêng; kéo cạnh trái dock hoặc dùng phím mũi tên khi focus để đổi độ rộng.
- **Cửa sổ:** chọn bố trí Chỉnh ảnh / Thiết kế / Retouch; hiện/ẩn Màu, Thuộc tính và Điều hướng/Histogram/Thông tin; chuyển Lớp/Kênh/Đường/Lịch sử; khôi phục bố trí.
- **Xem:** zoom, grid, guides, snapping, xem kênh và so sánh. Các trình sửa chuyên biệt không còn bị trộn vào menu này.
- **Lớp:** tạo lớp → nhóm/nhân bản/gộp → biến đổi → mask/clipping/hiệu ứng/filter → Smart Objects → tên/khóa/thứ tự/xóa.

Chỉnh ảnh mặc định ưu tiên vùng nhìn ảnh, thuộc tính và histogram/điều hướng. Thiết kế mở màu và dành thêm chiều cao cho layer; Retouch mở rộng vùng thuộc tính/layer. Có thể thay lại từng panel. Bố trí lưu trên thiết bị; thông số ảnh lưu trong `.luma`.

## Đối chiếu bốn ảnh

| Thành phần trong ảnh | Luma 7.2 thực hiện được | Phạm vi / phần còn thiếu |
| --- | --- | --- |
| Color, Swatches, Gradients, Patterns | Chọn màu SV/hue; nhập HEX/RGB; 16 mẫu màu; 6 gradient; 6 pattern lặp thật | Pattern ở dock áp vào lớp hình hoặc tạo lớp hình mới. Chưa nhập thư viện Photoshop `.pat` / `.grd` / `.aco`. Art & Pattern là công cụ chuyển ảnh riêng. |
| Properties / Adjustments | Thuộc tính theo lớp, 16 adjustment, Curves theo RGB/R/G/B | Nhóm hoặc nhiều lớp dùng công cụ bố cục; không có mọi thuộc tính Photoshop. |
| Transform W/H/X/Y, chain | Tọa độ, kích thước, góc, khóa tỉ lệ, flip/căn chỉnh | Mask đi theo biến đổi. Chưa có perspective/warp tương đương Photoshop. |
| Navigator / Histogram / Info | Điều hướng, histogram độ sáng/R/G/B, mean/median/độ lệch chuẩn; kích thước gốc, RGB dưới trỏ | Histogram đo composite xem trước tối đa 1600px cạnh dài; không phải thống kê toàn bộ pixel native. |
| Levels | Kênh RGB/R/G/B giữ thông số riêng, input black/gamma/white, output black/white và Auto | Kết quả màu của engine Luma có thể khác Photoshop. Auto đo composite đang xem. |
| Hue/Saturation | Hue, Saturation, Lightness, Colorize; visible và clip to below | Chưa chọn dải Reds/Yellows… riêng như Photoshop. Colorize xuất PSD bằng composite. |
| Layers, tìm theo tên/kind | Cây nhóm, layer order, nhiều lớp, blend, Opacity, Fill, khóa toàn lớp | Chưa có khóa riêng pixel/transparency/position. |
| Fill khác Opacity | Fill giảm nội dung, giữ hiệu ứng; Opacity giảm cả kết quả lớp | Canvas blend không mô phỏng đầy đủ các blend có Fill đặc biệt của Photoshop. |
| Mask thumbnail | Thumbnail thật, vẽ/ẩn/đảo/feather/density; Shift-click bật/tắt mask | Mask đi cùng nội dung; chưa unlink để biến đổi độc lập. |
| Smart Object badge | Đánh dấu nội dung nhúng, sửa/thay nội dung, tạo bản độc lập và dùng nhiều instance | Chỉ các dạng nhúng/biến đổi đã hỗ trợ. Linked external files, perspective và warp phức tạp chưa có. |
| Smart Filters dưới layer | Filter local của Luma có cây con, bật/tắt từng mục, mở đúng filter để sửa và sắp xếp | **Không phải hỗ trợ Photoshop Smart Filters.** PSD có Smart Filters chưa hỗ trợ sẽ mở composite toàn tài liệu; không giữ giả một stack với nhãn “kept, not editable”. |
| Layer Style: 9 nhóm trong ảnh | Bevel & Emboss, Stroke, Inner Shadow, Inner Glow, Satin, Color Overlay, Gradient Overlay, Outer Glow, Drop Shadow | Hiệu ứng Canvas với các thông số được hiển thị. Chưa có contour/noise/range/choke/texture và mọi thuật toán chính xác của Photoshop. |
| Outer Glow / Shadow | Blend, opacity, màu, size, spread; bóng có offset X/Y | Ánh sáng 2D; không dựng hình học 3D hay tương tác ánh sáng vật lý. |
| Character / Paragraph | Font, weight, size, leading, tracking, italic, underline, màu và canh trái/giữa/phải; nhập font | Chưa có mixed text runs, optical kerning, baseline shift, paragraph indent/justify/hyphenation và font fallback hoàn chỉnh. |
| Selection toolbar | Replace / Add / Subtract / Intersect; feather, anti-alias; Select & Mask | Select & Mask chỉnh feather/grow/contract và xuất vùng chọn hoặc mask lớp. Sửa tóc/vùng thiếu chuyên sâu nằm ở Tách nền & tóc. |
| Channels | Xem RGB/R/G/B/alpha; Curves/Levels chỉnh kênh màu | Chưa có alpha channel độc lập, lưu selection thành channel hoặc channel painting. Xem kênh không đổi xuất ảnh. |
| Paths | Liệt kê đường Bézier thuộc lớp vector; chọn/biến đổi; đường khép thành vùng chọn | Pen vẽ đường mới và tay nắm trong lúc vẽ. Chưa chỉnh lại điểm neo của đường đã hoàn thành; chưa có Photoshop Work Path độc lập. |
| History | Ctrl+Z / Ctrl+Shift+Z, danh sách lịch sử; Cancel khôi phục preview | Lịch sử trong phiên, không lưu toàn bộ lịch sử như session replay vào PSD. |

## Thao tác nhanh

1. Mở ảnh/PSD hoặc dùng ảnh mẫu. Chọn lớp cần sửa.
2. Chọn **Cửa sổ → bố trí** phù hợp. Mở màu khi thiết kế, thu lại khi retouch.
3. Chọn adjustment để hiện thông số. Với Levels, thay Channel và Output Levels; mỗi kênh giữ giá trị riêng. Với Hue/Saturation, bật Colorize nếu muốn phủ một sắc.
4. Mở **fx** hoặc bấm tên hiệu ứng ở cây layer. Bật hiệu ứng, thay màu/blend/opacity/size. Hủy trả lại bản trước; Áp dụng tạo một bước Undo.
5. Fill và Opacity nằm riêng trên danh sách lớp. Mở cây con để tắt từng filter/hiệu ứng. Tìm layer vẫn giữ các thao tác này.
6. Vẽ vùng chọn, chọn **Select & Mask**, sửa biên và chọn đầu ra. Dùng mask/nguồn gốc để phục hồi phần lỡ xóa.
7. Lưu `.luma` để giữ đầy đủ các thông số của Luma, rồi xuất bản thành phẩm.

## Độ trung thực khi lưu và xuất

- `.luma`: giữ nguồn, nhóm, Smart Objects được hỗ trợ, mask, thông số Fill, Levels theo kênh, Colorize, filter và chín nhóm layer style.
- PNG/JPEG: dùng kích thước native của tài liệu, có DPI tùy chọn; giới hạn thực tế là bộ nhớ/canvas/định dạng. Không tự tạo chi tiết ảnh vì tăng DPI.
- PSD/PSB: giữ cấu trúc và adjustment hỗ trợ. Levels mới có kênh và output endpoints. Hiệu ứng/Fill/pattern được render vào layer để giữ hình; kiểu chữ hoặc Smart Object có những thành phần này có thể trở thành pixel. Colorize dùng composite và giữ nguồn dưới dạng lớp ẩn. Giữ `.luma` để chỉnh lại mọi thông số.
- SVG: vector đơn giản vẫn là hình học; các lớp có style/pattern/Fill hoặc thành phần không thể biểu diễn được sẽ nhúng raster. Không gắn nhãn “SVG thuần vector” cho những trường hợp này.
- Màu in: tiếp tục dùng Nâng cao → CMYK / ICC để proof và xuất CMYK TIFF. Engine chỉnh chính vẫn là RGB 8-bit sRGB, chưa có native CMYK/16-bit/32-bit painting.

## Các hạng mục chưa hoàn tất

Ngoài các thiếu hụt chi tiết trong bảng: mở/chỉnh Canva native, tương thích toàn bộ PSD, giải mã RAW/HEIC, bộ cài Windows ký số, quản lý ảnh vượt RAM bằng tile cache trên đĩa, phân loại bệnh da đã kiểm định và chứng nhận chất lượng bằng GPU vật lý chưa được bổ sung ở bản này. UI desktop chạy trên trình duyệt và có mã nguồn tự host; chưa phải ứng dụng Windows đóng gói.

AI sinh ảnh và phục hồi vùng thiếu vẫn tạo dự đoán; không thể chứng minh chi tiết đã mất nếu thiếu tư liệu gốc. Việc đánh giá các tính năng đó độc lập với kiểm thử bố cục/renderer của bản 7.2.

## Kiểm chứng

Các bài kiểm tra mới đo pixel thật của Fill/style/mask/pattern/Colorize/Levels, kiểm tra xuất rồi mở lại PSD/PSB, và chạy thao tác DOM với native Canvas cho menu, bố trí, Undo, filter/fx, màu và vùng chọn. Trình duyệt Chrome được kiểm tra riêng để quan sát bố cục và thao tác thực tế. Xem `QA.md` để biết kết quả cuối cùng và giới hạn kiểm chứng.

Ảnh người dùng gửi chỉ dùng đối chiếu; không đưa vào tài nguyên công khai hoặc mã nguồn phát hành.
