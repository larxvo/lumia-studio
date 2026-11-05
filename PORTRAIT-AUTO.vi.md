# Luma 6.9 — Auto chân dung

Mở ảnh, chọn layer ảnh, vào **Chỉnh ảnh → Chân dung → Auto chân dung**. Chọn khuôn mặt nếu ảnh có nhiều người rồi bấm **Tự chỉnh tự nhiên · 1 chạm**. Bấm trong khi nhận diện thì Luma thực hiện ngay khi nhận diện xong. Kéo so sánh trước/sau; dùng Soi khuôn mặt hoặc phóng 200–400% để xem kỹ.

Mọi giá trị một chạm được điền vào các thanh. Bạn có thể chỉnh tiếp từng mục:

| Thanh | Tác động |
| --- | --- |
| Thu gọn hai má / góc hàm / cằm | Thu nhẹ đường viền từng vùng. Mặc định 18 / 20 / 18 trên thang 100. |
| Giảm bóng dầu | Dịu vùng phản sáng trong da của mặt đã chọn. Tự chọn mức 28 hoặc 62 theo lượng phản sáng ước lượng. |
| Độ nhạy vùng bóng | Tăng để xử lý thêm vùng lóe sáng nhẹ; giảm để giữ nhiều ánh sáng gốc. |
| Cân màu da studio / Giữ kết cấu | Dịu tông da không đều, giữ chi tiết da từ nguồn. Mặc định 18 / 96; không thêm hạt giả. |
| Độ đậm chân mày | Âm: nhạt hơn. Dương: đậm hơn. Chỉnh sợi tối, làm mềm mép. |
| Độ dày chân mày | Âm: thanh hơn. Dương: dày hơn bằng biến dạng vùng mày hiện có. |
| Giảm sợi râu lún phún | Dịu sợi tối nhỏ bằng mẫu da lân cận; mặc định nhẹ 28. |
| Cường độ chung | Trộn kết quả với nguồn; 0 = ảnh gốc. |

Mở **các preset có sẵn** để chỉnh nhanh từng mục: giảm bóng dầu, gọn mặt/cằm, chân mày đậm/nhạt và giảm râu. Preset riêng cộng dồn, giữ những mục đã chỉnh. **Đặt lại mục này** bỏ thông số thuộc tab hiện tại; tab khác được giữ.

**Ctrl+Z** hoàn tác; **Ctrl+Shift+Z / Ctrl+Y** làm lại ngay trong Retouch. Một lượt kéo thanh là một bước. Lịch sử cục bộ giữ tối đa 40 trạng thái, gồm preset, thông số, chọn mặt, màu/kiểu, nét tô và điểm mắt.

**Áp thành layer riêng** giữ ảnh nguồn ở layer bên dưới. Chọn kết quả, bấm **Sửa lại Retouch** để cập nhật đúng layer. Lưu **.luma** để mang nguồn, mask, mốc mặt và thông số sang lần chỉnh sau. PNG/JPEG giữ ảnh đã dựng. .luma cũ kế thừa các thanh mới ở 0.

Muốn thêm kiểu râu, vào tab **Râu**: ria mép, râu cằm, râu dê, quai nón gọn/đầy và lún phún có màu, độ đậm, mật độ và độ dài riêng. Đây là sợi mô phỏng. Râu dày dùng **Áp retouch & mở xóa râu / tạo râu AI**: LaMa xóa vùng trên thiết bị; sinh râu ảnh thật dùng máy ComfyUI bạn kết nối và cần xem duyệt.

Nhận diện dùng model da và 478 mốc mặt cục bộ. Thu gọn dùng các vùng kéo viền theo góc mặt, bảo vệ mắt, mũi và môi. Giảm bóng trừ thành phần sáng đã làm mềm và giữ chi tiết ảnh gốc. Một ảnh không phân biệt chắc chắn bóng dầu với ánh sáng chiếu lên da; nên kiểm tra so sánh và chỉnh mức theo ý. Không cam kết xóa mọi phản quang hoặc giữ đường nền sát viền mặt thẳng ở mức thu gọn cao. Mặt quá nhỏ, mờ, nghiêng mạnh hoặc bị che có thể cần ảnh khác / mức nhẹ hơn.

Đầu ra Retouch tối đa **8 MP**; nguồn lớn hơn vẫn giữ nhưng kết quả giảm kích thước và giao diện báo rõ. Ảnh người dùng không được đưa vào demo, source ZIP hay bản public. Đây là bản web có mã nguồn tự host; chưa có bộ cài Windows mới hay kiểm chứng GPU thật trong đợt nâng cấp này.
