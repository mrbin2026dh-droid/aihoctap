# Chuẩn giao diện học sinh (điện thoại trước, sáng và tối)

Nguồn tham chiếu: WCAG 2.2 (tương phản 4.5:1, vùng chạm, co giãn chữ), hướng dẫn cỡ chữ cho web di động của LearnUI (nội dung 16–18px, chữ phụ nhỏ hơn khoảng 2px, ô nhập tối thiểu 16px để iOS không tự phóng to), web.dev về `color-scheme` và `prefers-color-scheme`, Material và Apple HIG (vùng chạm 44–48px).

## Cỡ chữ (điện thoại)
- Nội dung chính 17px; chữ phụ 15px; nhãn in hoa 14px; nút và ô nhập 16px. Không có chữ nào dưới 14px.
- Khai báo bằng biến `--fs-body`, `--fs-small`, `--fs-label`, `--fs-control` ở cuối `styles.css`.

## Bố cục
- Header điện thoại: một hàng logo, một hàng nút (Cài ứng dụng, Cài đặt). Trạng thái mạng chỉ hiện chữ khi mất mạng; khi có mạng là chấm xanh (chữ vẫn có cho trình đọc màn hình). Tên tài khoản ở Cài đặt, không chen vào header. Header không dính khi cuộn trên điện thoại để nhường chỗ đọc bài.
- Thanh điều hướng dưới: 5 mục chia đều một hàng, mỗi mục cao tối thiểu 48px.
- Vùng chạm tối thiểu 44×44px (ô chọn đáp án tính theo cả dòng nhãn).
- Không tràn ngang ở 360, 390, 768, 1280px.

## Giao diện tối
- Tự theo hệ thống bằng `prefers-color-scheme`; có `<meta name="color-scheme">` và `theme-color` cho cả hai chế độ.
- Khối tối ở cuối `styles.css` (giữa `DARK-THEME:BEGIN` và `END`) do `tools/gen_dark_theme.py` sinh từ các luật màu sáng. Sửa màu sáng xong thì chạy lại công cụ này.
- Nền sáng thành nền tối nâng nhẹ; chữ tối thành chữ sáng; màu thương hiệu làm nền được làm sáng lên để chữ trắng vẫn đạt 4.5:1.

## Kiểm định tự động
`tests/test_student_ui_standard.cjs` chạy ở sáng và tối, bốn khổ màn hình, các màn: cổng đăng nhập, danh mục, kiểm tra, đã tải, tiến độ, tài liệu, bài học, làm bài tập, gia sư AI. Đo chữ dưới 14px, tương phản dưới 4.5:1 (3:1 cho chữ lớn), vùng chạm dưới 44px và tràn ngang. Mọi vi phạm làm bài kiểm thử thất bại.

## Chưa làm
- Giao diện giáo viên chưa có chế độ tối (teacher.css riêng).
- Chưa có nút chọn Sáng/Tối/Theo hệ thống trong Cài đặt.
- Chưa đo trên máy thật và trình duyệt Safari.

## Đăng nhập và thanh trên (theo mẫu tham khảo)
- Thẻ đăng nhập bo góc 20px trên nền trung tính; logo tròn, tiêu đề đậm 30px, mô tả một dòng, nút cao 56px bo 14px (đen ở chế độ sáng, trắng ở chế độ tối) có biểu tượng đầu và mũi tên cuối.
- Ô nhập cao 56px, biểu tượng đầu dòng (người dùng, ổ khóa), nút mắt hiện/ẩn mã PIN; nhãn nằm trên ô; lỗi nằm dưới và báo bằng `role=alert`.
- Thanh trên chỉ dùng biểu tượng 44px có tên truy cập: kết nối mạng, cài ứng dụng, sáng/tối, cài đặt, tài khoản (chữ cái đầu tên), góc giáo viên. Không còn nút chữ "Hiện", "Đóng", "Cài ứng dụng".
- Nút sáng/tối lưu lựa chọn trên thiết bị (`aisgk-theme`); mặc định theo hệ thống.

## Trang sau đăng nhập (đã áp dụng)
- Tiêu đề trang dùng cùng kiểu chữ đậm không chân với màn đăng nhập; chỉ logo dùng chữ có chân.
- Bài học và môn học là thẻ bo góc 16px: ô biểu tượng (sách, bút, thư mục), tiêu đề 18px, nhãn số câu, nút có mũi tên. Trên điện thoại nút trải hết chiều ngang.
- Điều hướng dưới có biểu tượng trên nhãn (60px cao); thanh bên trên máy tính có biểu tượng bên trái nhãn; mục đang chọn nổi bằng nền mềm và biểu tượng xanh.
- Trạng thái rỗng có biểu tượng tròn, tiêu đề và một hành động tiếp theo.
- Bài tập có thanh tiến độ theo số câu đã trả lời; kết quả có biểu tượng hoàn thành.
- Nút chính màu đen (trắng ở chế độ tối); nút phụ viền; mọi nút thao tác có biểu tượng đi kèm chữ.

## Cập nhật, chữ thừa và phiên hết hạn
- Chữ co giãn theo chiều rộng khi màn hình hẹp: nội dung 18–22px, chữ phụ 16–20px, nhãn 15–18px, nút và ô nhập 17–20px. Máy tính giữ 17/15/14/16px. Kiểm định yêu cầu tối thiểu 15px trên điện thoại.
- Thông báo cập nhật là biểu tượng làm mới có chấm đỏ ở đầu thanh trên (có tên truy cập "Cập nhật ứng dụng"), không còn thanh chữ.
- Bỏ khẩu hiệu và chữ trang trí: "SGK · Học theo nhịp của em", "Mỗi ngày một chút", nhãn in hoa phía trên tiêu đề, câu mở đầu trang chủ. Thông báo trạng thái bình thường chỉ dành cho trình đọc màn hình; chỉ lỗi mới hiện chữ.
- Token đăng nhập (học sinh và giáo viên) hết hạn sau 1 giờ. Khi gặp 401, ứng dụng hiện một hộp thoại duy nhất, giữ nháp và bài chờ nộp, rồi mở đăng nhập với mã học sinh đã điền (PIN luôn để trống).
- Giao diện giáo viên khai báo `only light` để Chrome không tự ép tối; chữ giáo viên cũng theo thang trên (tests/test_teacher_ui_standard.cjs).
