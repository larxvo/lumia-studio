# Luma 6.6 — Giữ người, sửa mask và làm sạch tài liệu

## Giữ người chính, xóa người còn lại

1. Mở ảnh gốc và chọn layer ảnh. Bấm **Xóa người**.
2. Chọn **Giữ người chính**, bấm vào người muốn giữ. Luma dùng vị trí mặt làm điểm gợi ý nếu nhận ra được; không xác định danh tính. Màu xanh là vùng được khóa giữ.
3. Duyệt đủ đầu, tóc, thân và tay. **Thêm vào người giữ** thêm điểm dương cho người đang giữ; **Bỏ khỏi người giữ** thêm điểm âm để tách người chọn dính. Có thể đổi phương án viền. Chọn lại **Giữ người chính** để thêm người thứ hai, tối đa tám vùng.
4. Bấm **Xóa người còn lại**. Vùng ngữ nghĩa người còn lại được tách khỏi vùng giữ, không chuyển cả nhóm người thành một khung xóa. Có cọ **Tô thêm vùng xóa** và **Giữ chi tiết** để sửa.
5. Chọn xử lý **Sâu** để so sánh hai kích thước ngữ cảnh khi khác nhau; chọn **Nhanh** cho một ngữ cảnh. **Bảo vệ thêm quanh người giữ** nới vùng khóa. Chỉ lớp khóa được chọn được bảo vệ: kiểm tra mask trước khi chạy.
6. Soi kết quả và bấm **Áp thành layer riêng**. Lưu `.luma` để giữ nguồn, mask người giữ/xóa, nét cọ và thông số. Chọn layer kết quả, mở Xóa người để sửa tiếp.

Mô hình DeepLab gợi ý nhóm người, không phải bộ phân đoạn từng người hoàn hảo. Điểm mặt hỗ trợ chọn toàn người nhưng có thể sai với người nghiêng, nhỏ hoặc che khuất. Người chạm nhau có thể phải thêm/bớt điểm. Kiểm tra còn giống người chỉ là gợi ý ngữ nghĩa, không phải chứng nhận chất lượng. Vùng xóa lớn/chiếm nhiều ảnh có thông báo duyệt kỹ. LaMa 512 có thể tạo nền lem, sai cấu trúc hoặc sót hình người, nhất là khi xóa gần hết nhóm. Dùng tư liệu tham chiếu khi cần cấu trúc thật. Hai ngữ cảnh bằng nhau chỉ chạy một lần; thuật toán chọn theo sai số mép, không chấm được thẩm mỹ.

## Lấy lại vai/tay bị lẹm khi tách nền

- Mở layer có mask trong **Tách nền**. Mask cũ được mở để sửa và **Kết hợp mask hiện có** mặc định tắt. Đây là sửa lỗi cũ khiến nét khôi phục bị mask trước đó cắt lần nữa.
- Bật **Hiện ảnh gốc dưới vùng khuyết**, chọn **Cọ khôi phục** và tô phần tay/vai còn nhìn thấy trong nguồn. **Khôi phục bám viền** giới hạn theo màu nguồn gần điểm bấm; với nền gần màu da, dùng cọ thường và cọ xóa để duyệt.
- **SAM toàn thân + viền tóc mềm** phối hợp toàn thân với MODNet; vùng ngữ nghĩa cùng alpha chắc hỗ trợ phần thân. Khi áp dụng, mask được nâng lên kích thước nguồn và tinh viền theo từng ô nhỏ. **Giảm viền ám màu** sửa RGB vùng alpha chuyển tiếp; không nới alpha.
- Mask và nguồn giữ độc lập. RGB tinh viền được lưu cùng nguồn trước tinh viền để mở lại khôi phục. Với Smart Object, chọn layer copy hoặc sửa nội dung nhúng trước khi thay RGB.
- Xuất PNG trong suốt hoặc áp layer riêng, mask trên layer, vùng chọn. Cọ khôi phục chỉ lấy lại pixel có trong ảnh nguồn. Nếu mở PNG đã bị xóa tay và mất alpha thật, cần mở lại ảnh gốc; không có dữ liệu để lấy lại tay từ PNG đó.

## Hoàn tác ngay trong công cụ

**Ctrl/⌘ Z** hoàn tác, **Ctrl/⌘ Shift Z** hoặc **Ctrl/⌘ Y** làm lại. Có nút tương ứng trong Xóa người, Tách nền và Tài liệu. Lịch sử bao gồm nét cọ, điểm, mask, vùng giữ/xóa, viền và thông số; kéo liên tục một thanh được gộp. Text field vẫn giữ thao tác soạn thảo. Kết quả AI đến muộn sau Undo/Hủy bị bỏ qua.

Mỗi phiên giữ tối đa 40 bước, ngân sách buffer mềm khoảng 64 MiB. Ảnh lớn có thể bỏ cache kết quả cũ hoặc bớt bước để tiết kiệm RAM; tham số/mask còn trong bước giữ lại có thể chạy lại. Đóng công cụ kết thúc lịch sử cục bộ. Sau Apply, Undo tài liệu hoàn tác cả lần áp layer. `.luma` lưu công thức chỉnh, không lưu toàn bộ lịch sử phiên.

## Làm sạch giấy, chữ và dấu đỏ

Mở ảnh, chọn **Tài liệu** ở thanh trái hoặc **Filter → Làm sạch tài liệu**. Tự chạy kiểu **Giấy sáng phẳng**; các kiểu **Chữ rõ**, **Chữ & dấu đỏ**, **Giữ màu tự nhiên** cho mức khác nhau. Không tải thêm model.

| Nhóm | Thanh chỉnh |
| --- | --- |
| Tổng | Mức làm sạch |
| Giấy | Giảm bóng, làm trắng nền, giảm nếp nền, trung hòa màu, giảm hạt |
| Mực | Tương phản, tăng nét chữ, giảm nhòe nhẹ, độ rõ mực dấu đỏ |

**Bảo vệ nét mực gốc** giữ nét đen/màu khi làm sạch nền. Kéo so sánh, chọn zoom 200%/400% rồi bấm ảnh để đổi vùng soi. **Căn 4 góc giấy**: bấm trên trái → trên phải → dưới phải → dưới trái. **Về toàn khung** bỏ căn góc. Phối cảnh và thông số đều hoàn tác được.

Áp layer riêng giữ nguồn; mở lại qua **Sửa lại tài liệu · giấy, chữ & dấu** để chỉnh tiếp. PNG xuất đúng kích thước nguồn, tối đa 16 MP, mỗi cạnh 8192 px. Mở **Filter → Ảnh mẫu · Làm sạch tài liệu** để thử trang DEMO tổng hợp.

Xử lý chạy trong worker trên thiết bị: ước lượng trường nền, cân sáng/màu, giảm nếp sáng tối, tăng tương phản mực và chi tiết có giới hạn. Không OCR thay chữ, không dùng sinh ảnh để viết lại dấu/chữ ký. Mực nhòe còn giữ dạng nhòe nguồn; mức quá mạnh có thể gây quầng hoặc làm yếu nét mực nhạt, hãy giảm thanh tương ứng. Căn bốn góc là chỉnh phối cảnh phẳng; chưa có tháo cong trang 3D. Nếp che mất chữ hay phần dấu mất hẳn cần nguồn rõ hơn, không thể xác nhận từ một ảnh mờ.

## Kiểm chứng và phạm vi

Đọc `QA.md` và các script `verify-subjects.mjs`, `verify-paper.mjs`. Kiểm tra pixel giữ nguyên không đồng nghĩa cảnh sinh đúng. Không có nâng cấp Canva native, phân loại bệnh da lâm sàng hoặc kiểm chứng GPU vật lý mới trong bản này. PSD/PSB và các tính năng trước giữ phạm vi hỗ trợ đã công bố.
