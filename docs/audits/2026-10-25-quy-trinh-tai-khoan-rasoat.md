# Rà soát: quy trình tài khoản giáo viên/học sinh so với yêu cầu người dùng
Người kiểm định: Claude. Ngày: 2026-10-25. Mức bảo mật: CAO.

| Yêu cầu | Hiện trạng (đã đọc mã) | Kết luận |
|---|---|---|
| Giáo viên đăng nhập bằng PIN do Antigravity cấp | Đăng nhập bằng `TEACHER_ADMIN_SECRET` (đặt bằng wrangler), có khóa thử sai | Có một phần |
| Đăng nhập xong phải đổi PIN | Không có route/giao diện đổi PIN, không bắt đổi lần đầu | THIẾU |
| Tạo học sinh (họ tên, lớp, PIN) trong giao diện | Chỉ có công cụ dòng lệnh `manage_students.py`; Worker/giao diện không có tạo/sửa/xóa | THIẾU |
| Sửa, xóa, khóa học sinh | Không có (chỉ "mở khóa đăng nhập sai"); khóa riêng cho AI thì có | THIẾU |
| Học sinh đăng nhập đúng PIN giáo viên cấp | Có (`/api/login`, PBKDF2, khóa thử sai) | ĐẠT |
| Giao diện theo lớp (lớp 9 hiện lớp 9) | Có: khi đăng nhập, ô Khối lớp bị khóa theo lớp của học sinh; hiện tên + lớp | ĐẠT |
| Mục đổi PIN của học sinh | Không có | THIẾU |
| Mục Kiểm tra | Có tab "Bài tập" (trắc nghiệm chấm ở máy chủ); chưa có tab "Kiểm tra", chưa có đề thi giáo viên giao (A4) | THIẾU / quyết định đặt tên |

Quyết định của Claude: tạm dừng mọi việc khác; làm trọn bộ "Tài khoản" trước. Tab 02 "Bài tập" đổi tên thành "Kiểm tra" (bài trắc nghiệm của từng bài học); đề thi giáo viên giao (A4) làm sau và sẽ nằm trong tab này.
