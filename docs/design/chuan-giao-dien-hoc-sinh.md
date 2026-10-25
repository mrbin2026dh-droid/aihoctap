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

## Dark mode: bảng màu xám than ấm (2026-10-25)
Áp dụng cho học sinh và giáo viên. Nền `#262624`, thẻ `#30302e`, thanh bên `#1f1e1d`, viền `#403f3b`, chữ `#faf9f5`, chữ phụ `#b8b5aa`, nhấn xanh ngọc `#2f7a6b` (chữ nhấn `#93d4c3`), nút chính `#ece9df` trên chữ `#1f1e1d`.
- Học sinh: sinh bằng `python3 tools/gen_dark_theme.py` (đổi màu ở `TOK_VARS`/`EXTRA`), rồi `package_student_pwa.py --stamp`.
- Giáo viên: khối `TEACHER-DARK` cuối `teacher.css`; theo hệ thống hoặc `localStorage aisgk-theme` (dùng chung nút đổi giao diện của học sinh).
- Kiểm thử: `test_teacher_ui_standard.cjs` chạy cả light và dark.

## Menu học sinh = chức năng giáo viên (2026-10-25)
| Giáo viên | Học sinh | Ghi chú |
|---|---|---|
| Soạn bài | Học | bài giảng + câu luyện tập |
| (câu luyện tập trong bài) | Luyện tập | làm lại không giới hạn |
| Kiểm tra (chưa làm) | chưa có tab | thêm tab "Kiểm tra" khi có backend đề thi, 1 lần làm |
| Tài liệu | Tài liệu | Google Drive |
| Tài khoản học sinh | Cài đặt > Tài khoản | đổi PIN |
| (kết quả bài nộp) | Tiến độ | |
"Đã tải" (ngoại tuyến) là tính năng kỹ thuật, nằm trong Cài đặt > Tải ngoại tuyến, không phải tab.

## Kết quả, thống kê, Gia sư AI (2026-10-25)
- Nộp xong chuyển sang trang Kết quả riêng: vòng phần trăm, số câu đúng, điểm, lần làm, cao nhất; nút Làm lại / Xem bài / Tiến độ. Không hiện đúng/sai từng câu (chống dò đáp án).
- Mở lại bài đã nộp: tự bắt đầu lượt mới (luyện tập không giới hạn).
- Tiến độ = bảng thống kê: bài đã làm, lượt làm, điểm trung bình, tỉ lệ đúng, biểu đồ 7 ngày (cần Worker trả `submitted_at`), danh sách từng bài với thanh điểm cao nhất.
- Gia sư AI: tiêu đề ngắn "Gia sư AI", chip "Còn N lượt", nút đóng/gửi bằng biểu tượng, toàn màn hình trên điện thoại, nền phủ trung tính.

## Tổng quan học tập (2026-10-25)
Trang đầu sau đăng nhập (tab "Tổng quan"). Tham khảo: Duolingo (chuỗi ngày, lộ trình dạng chặng), Khan Academy (Thành thạo / Đang học, gợi ý bài tiếp), Coursera (thanh tiến độ theo khóa).
Định nghĩa số liệu (chỉ lấy từ bài máy chủ đã nhận, không ước lượng):
- Thành thạo: bài có lượt tốt nhất ≥ 80% câu đúng. Đang học: đã làm, chưa đạt. Chưa bắt đầu: chưa có lượt. Bài không có câu luyện tập chỉ đọc, không tính.
- Vòng lộ trình = bài thành thạo / bài có luyện tập của khối học sinh.
- Điểm trung bình = trung bình kết quả tốt nhất của mỗi bài (thang 10). Tỉ lệ đúng = tổng câu đúng / tổng câu trên mọi lượt.
- Ngày học liên tiếp, 7 ngày, hoạt động gần đây: cần `submitted_at` từ Worker (bài nộp cũ không có thì không tính, mục tự ẩn).
- Gợi ý bài tiếp: đang làm dở > chưa học đầu tiên > điểm thấp nhất cần ôn.
Kiểm thử số liệu: tests/test_dashboard_numbers.cjs.

## Giao diện xanh ngọc (2026-10-25)
- Phông Nunito (tiếng Việt + latin, tự lưu trong `fonts/`), SGK Serif chỉ còn cho logo.
- Nền kem `#fffdf7`, chủ đạo xanh ngọc `#0f766e`, nút chính màu xanh ngọc (không còn đen).
- Màu theo khu vực (token `--teal/blue/amber/violet/green-bg|fg`, có bản tối): Tổng quan = xanh ngọc, Học = xanh dương, Luyện tập = vàng cam, Tài liệu = tím, kết quả tốt = xanh lá.
- Thẻ thống kê có icon màu; thanh tiến độ chuyển sắc; tranh minh họa SVG tự vẽ ở đầu Tổng quan (ẩn trên điện thoại).
- Khối CSS nằm giữa `UI-TEAL:BEGIN/END` trong `styles.css`; chạy lại `tools/gen_dark_theme.py` sau khi sửa.

## Điểm yếu của học sinh (2026-10-25)
- Máy chủ lưu kết quả từng câu ở `attempt_details/{uid}/{attempt_id}` (chỉ quản trị đọc). Học sinh không bao giờ nhận chi tiết từng câu.
- Giáo viên: thẻ "Học sinh đang yếu ở đâu" ở đầu Soạn bài (chủ đề, câu hỏi nhiều bạn sai kèm đáp án sai phổ biến, học sinh cần hỗ trợ). Ngưỡng: Yếu <50%, Cần củng cố 50-79%, Tốt >=80%. Chỉ tính lần nộp mới nhất của mỗi học sinh cho mỗi bài. Không dùng AI.
- Học sinh: mục "Em nên ôn lại" trên Tổng quan, theo chủ đề, chỉ bài luyện tập (không gồm `exam_`), chỉ hiện tên chủ đề và số câu đúng.
- Muốn báo cáo theo chủ đề, giáo viên điền "Chủ đề kiến thức" cho từng câu khi soạn bài.
