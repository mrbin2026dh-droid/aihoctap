# Phán quyết lần 9 (M1–M4 + Giai đoạn 1 dự thi)
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH (nhỏ)**. Chưa deploy giao diện giáo viên/tài liệu; chưa dùng publish trên môi trường thật.

Tự chạy: `m1_m4_phase1` 5/5, `l1_l5`, `j1_j3`, `i1_i4`, `h1_h6`, `g1_g6`, `worker_gate` PASS; `test_manage_students` 6/6. Đọc mã publish, materials, đăng nhập, `manage_students.py`. Đây là MOCK/UNIT; curl "THẬT" (khóa giáo viên 429, publish không token 401) là lời Antigravity.

## Đạt
- M1: `/api/teacher/auth` khóa sau 5 lần sai và giới hạn IP. M2: `/api/pwa/me` thiếu claim trả 401, không đoán. M4: bỏ URL cứng, PIN tự sinh, danh sách xuất ngoài repo, `.gitignore` chặn CSV/JSON học sinh.
- Giai đoạn 1: đáp án tách sang `packages_private`, gói công khai không có `correct_answer`; trình hiển thị markdown dùng `textContent` (không XSS).

## Điều kiện (N)
- **N1 (chặn, mất dữ liệu)**: `publish` không kiểm `res.ok` khi ghi RTDB, và nếu đọc `catalog.json` lỗi tạm thời thì tạo danh mục rỗng rồi GHI ĐÈ, xóa toàn bộ môn. Hai lần xuất bản song song cũng mất bản cập nhật. Dừng và báo 502 khi đọc/ghi lỗi; ghi có điều kiện (ETag `if-match`) hoặc làm trong Durable Object; test: GET catalog trả 500 thì không PUT.
- **N2**: không kiểm câu hỏi: `correct_answer` rỗng hoặc không thuộc `options` vẫn nhận (mọi câu chấm sai). Kiểm đáp án nằm trong khóa lựa chọn; giới hạn nội dung (markdown <= 100KB, <= 100 câu, <= 6 lựa chọn).
- **N3**: `course_id` suy đoán bằng `includes(grade)` (ví dụ `toan12` + lớp 1 giữ nguyên `toan12`). Dùng `course_id` do giáo viên đặt rõ ràng; lưu `subject_id`, `subject_name`, `grade` riêng; test lớp 1, 6, 9, 12.
- **N4 (bảo mật)**: tài liệu nhận `url` bất kỳ, kể cả `javascript:`. Chỉ cho `https://` và danh sách miền cấu hình (Drive, GitHub); giao diện mở bằng `rel="noopener noreferrer"`.
- **N5**: PIN >= 6 chỉ kiểm khi bật biến `STRICT_PIN_LENGTH` (không bật mặc định). Bắt buộc mặc định.
- **N6**: khóa toàn cục 24 giờ cho phép bạn học nghịch khóa học sinh bất kỳ (10 lần sai), kể cả tạo bản ghi cho ID không tồn tại. Dùng lùi mức tối đa vài giờ, không tạo khóa cho ID không có trong `students_auth`, và cần nút mở khóa trong giao diện giáo viên (B5).
- **N7 (quy trình)**: curl `publish` trả 401 cho thấy Worker đang chạy đã chứa route Giai đoạn 1, dù báo cáo ghi chưa deploy. Ghi rõ phiên bản đang chạy; giáo viên chưa xuất bản bài thật cho đến khi N1–N4 xong.
