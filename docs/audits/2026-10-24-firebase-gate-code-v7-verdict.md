# Phán quyết sau triển khai (route PWA mới)
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH**. Hệ thống đang chạy thật nhưng đăng nhập chưa an toàn.

Đã làm: clone repo công khai `mrbin2026dh-droid/aihoctap` (5 commit, 275 tệp), quét khóa/PIN/email/đường dẫn; đọc `worker/index.js` các route mới. Chưa gọi Worker thật (môi trường của tôi không truy cập được); kết quả "chạy thật" là lời Antigravity, chưa tự kiểm.

## Đạt
- Repo công khai không chứa khóa API, private key thật (khóa trong test là khóa sinh tạm), tệp service account, PIN, giá trị đáp án.
- K1–K3 đã làm; tác giả commit là bot noreply; không còn email cá nhân.
- Workflow Pages chỉ phát hành `frontend/hoc`.

## Điều kiện
- **L1 (chặn, nghiêm trọng)**: `/api/student/lan-login` cấp token RS256 cho BẤT KỲ chuỗi 6 chữ số, không PIN, không danh sách học sinh, không khóa thử sai, không giới hạn theo IP. Ai cũng giả danh `std_<mã>`, nộp bài, đọc tiến độ, và tạo UID mới vô hạn để né trần 30 lượt/ngày/học sinh, làm cạn 1000 lượt Gemini/ngày toàn hệ thống. Cổng đăng nhập PIN + khóa đã kiểm ở vòng G–H bị đi vòng. Ngay lập tức: tắt route (trả 403) hoặc chỉ mở khi bật cờ dev rõ ràng; sau đó chỉ cấp token cho học sinh có trong `students_auth` do giáo viên tạo, kèm khóa thử sai và giới hạn IP.
- **L2 (mục D)**: route gán cứng `grade: 9`, `class_code: '9A'`, tên "Học sinh <mã>" — đây là MOCK, không phải dữ liệu thật; lấy từ hồ sơ học sinh trong RTDB. Báo cáo "PASS 100%, đăng nhập bất kỳ 6 chữ số" phải ghi rõ là MOCK.
- **L3**: CORS phản chiếu mọi `localhost` ở môi trường thật; chỉ cho khi bật cờ dev. Xác nhận `ALLOWED_ORIGIN` = `https://mrbin2026dh-droid.github.io` (không đường dẫn).
- **L4**: route `/api/pwa/*` thêm sau ACCEPT, chưa qua kiểm định và chưa thấy test; thêm test FAIL-first cho từng route. Từ nay triển khai thật sau mỗi lần sửa phải chờ ACCEPT.
- **L5 (nhẹ)**: `aisgk.md` và `docs/` trong repo công khai ghi đường dẫn máy `C:/Users/HPZBook/…` và tên tệp service account; xóa các dòng đó khỏi bản công khai hoặc không đưa nhật ký vào repo.

## Người dùng
Đặt hạn mức/ngân sách cho khóa Gemini (Google AI Studio hoặc Cloud). Chưa cho học sinh thật dùng khi L1 chưa xong. Giữ tệp service account ngoài thư mục dự án; nếu từng nằm trong thư mục Git hoặc chia sẻ, tạo khóa mới và xóa khóa cũ.
