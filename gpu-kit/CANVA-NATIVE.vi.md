# Phạm vi cần làm rõ trước khi tích hợp Canva native

Trạng thái của Luma 6.1: **chưa có app Canva Developer / thỏa thuận cho phạm vi này**, theo thông tin chủ dự án cung cấp. Nhập PPTX/SVG vẫn hoạt động; đây không phải native editing.

## Ràng buộc đã xác minh

- API chỉnh phần tử native `openDesign` thuộc Apps SDK, chạy trong ngữ cảnh Canva; không phải một parser `.canva` công khai cho trình sửa độc lập.
- Điều khoản API/App Developer cập nhật 16/10/2026, §5a(iv) hạn chế dùng API để xây hoặc quảng bá sản phẩm cạnh tranh; §5a(viii) giới hạn app chủ yếu xuất thiết kế sang nền tảng thiết kế khác, trừ trường hợp được phép theo điều khoản đó.
- Quyền tải thiết kế của tài khoản cá nhân hoặc một OAuth client thông thường không đồng nghĩa với thỏa thuận cho toàn bộ phạm vi sản phẩm này.

## Hồ sơ kỹ thuật để trao đổi phạm vi

1. Nêu đúng sản phẩm: Luma là trình sửa ảnh / thiết kế độc lập, có người dùng miễn phí; không gợi ý đang là đối tác Canva.
2. Yêu cầu Canva xác nhận bằng văn bản phạm vi nào được phép: đọc phần tử native, biên tập bên ngoài, quay lại tài liệu, lưu tài sản / lịch sử và nội dung có giấy phép.
3. Thống nhất tài liệu và phần tử hỗ trợ, quyền read/write, lưu trữ tạm, thời hạn xóa, quyền nội dung trả phí và nghĩa vụ thông báo người dùng.
4. Sau khi có phạm vi được chấp thuận, đăng ký / cấu hình app và origin, thực hiện OAuth hoặc ngữ cảnh Apps SDK phù hợp, giữ client secret ở backend nếu có.
5. Làm bridge có version, mapping text / shape / rect-image / group, giữ ID và tọa độ; phần không hỗ trợ phải báo riêng, không âm thầm flatten hoặc bỏ nội dung.
6. Trước khi ghi ngược: so revision, hiển thị thay đổi để người dùng duyệt; dùng một lần sync và giữ thao tác Undo theo khả năng SDK.
7. Kiểm chứng bằng tài liệu Canva thực do tài khoản được phép cung cấp, có font, crop, nhóm, nhiều trang và nội dung được cấp phép. Chỉ bật tính năng sau khi quyền truy cập và chất lượng đều được xác nhận.

Không có scraper, truy cập API nội bộ, lấy token trình duyệt hoặc dùng MCP để né giới hạn trong bản này. Không gửi client secret / mật khẩu Canva trong chat. Hồ sơ này là đề xuất phạm vi kỹ thuật, không phải bằng chứng Canva đã chấp thuận.

Nguồn chính thức đã đọc:

- https://www.canva.dev/docs/apps/design-editing/
- https://www.canva.com/policies/canva-developer-terms/
