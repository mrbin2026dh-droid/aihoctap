# Claude → Antigravity: phát hành đợt 4 — cổng đăng nhập bắt buộc + đặt lại tài khoản
Đọc AGENTS.md (G, I, L). Theo lệnh trực tiếp của chủ dự án, Claude đã viết mã cổng đăng nhập (ngoại lệ phân vai, đã ghi log). Antigravity: kiểm lại, chạy test, đẩy, deploy, làm 2 việc dữ liệu bên dưới, rồi dừng cho người dùng thử.

## Mã Claude đã đặt vào thư mục dự án (không sửa nếu không có lý do ghi log)
- `frontend/hoc/index.html`: thêm `<section id="gate">` (nút "Học sinh", liên kết "Giáo viên" → `./teacher.html`); `<body class="… booting">`.
- `frontend/hoc/app.js`: `gateUI()` gắn vào `identityUI()` (chưa có phiên → hiện cổng, ẩn `main`, `.bottom-nav`, `#status`); nút `#gate-student` mở hộp thoại đăng nhập.
- `frontend/hoc/styles.css`: lớp `.is-gated`, `.booting`, `.gate*` (cuối tệp).
- `frontend/hoc/sw.js`: đã đóng dấu mới `bf2a34e5…`.
- `tests/test_login_gate.cjs` (mới, 7 kiểm Playwright); `tests/test_pwa_update_integrity.mjs` T7 sửa: đăng nhập qua cổng trước khi mở Cài đặt.
Claude đã chạy: toàn bộ `tests/test_*.mjs` exit 0, `test_login_gate.cjs` 7/7, dấu SW khớp.

## Việc 1 — phát hành giao diện
1. Xem `git diff`; chạy `python tools/package_student_pwa.py --stamp` rồi không cờ (phải khớp); chạy lại toàn bộ test + `NODE_PATH=$(npm root -g) node tests/test_login_gate.cjs`; quét bí mật rỗng.
2. Ghi mốc rollback (commit hiện chạy), commit, `git push origin main`, chờ workflow xanh.
Worker không đổi trong đợt này.

## Việc 2 — đặt mã PIN khởi tạo giáo viên (người dùng tự gõ, KHÔNG ghi vào tệp/log/Git/chat)
Chủ dự án đã chọn PIN khởi tạo (≥8 ký tự) và tự gõ khi chạy: `npx wrangler secret put TEACHER_ADMIN_SECRET` (nhập giá trị ở dấu nhắc; Antigravity hướng dẫn từng bước, không nhận giá trị). Sau đó xóa DUY NHẤT nút `teacher_auth/main` trong Firebase RTDB (nếu đã tồn tại) để lần đăng nhập đầu dùng mã khởi tạo và bắt buộc đổi. Không động vào `students_auth`, `packages`, `catalog`, `materials` ở bước này. Ghi vào `aisgk.md`: "đã đặt lại PIN khởi tạo giáo viên" (không ghi giá trị).
Lưu ý với người dùng: giá trị đã gõ trong khung chat nên coi là tạm thời — đổi ngay ở lần đăng nhập đầu tiên (hệ thống bắt buộc).

## Việc 3 — xóa toàn bộ tài khoản học sinh thử (chủ dự án đã cho phép bằng văn bản)
Chỉ nút `students_auth/*` (và dữ liệu tiến độ/hàng đợi/nháp gắn với các học sinh đó nếu có). Trước khi xóa: in danh sách `id` + họ tên (KHÔNG in PIN/băm) cho Claude xem trong báo cáo; xóa; đếm lại = 0. Không xóa bài học, danh mục, tài liệu, cấu hình AI, khóa Gemini.

## Smoke test THẬT sau deploy (báo từng mục)
S1. Mở link Pages bằng trình duyệt sạch → chỉ thấy cổng "Đăng nhập để tiếp tục" (không thấy bài học).
S2. `GET sw.js` có dấu `bf2a34e5…` (hoặc dấu CI khớp byte shell).
S3. "Giáo viên" → trang giáo viên → đăng nhập bằng PIN khởi tạo → bắt buộc đổi PIN (người dùng thực hiện).
S4. Sau khi người dùng đổi PIN và tạo 1 học sinh [THỬ]: học sinh đăng nhập từ cổng → vào được bài học; Đăng xuất → về cổng.
S5. Thiết bị đã cài bản cũ: mở 2 lần → nhận bản mới và thấy cổng.
Thất bại → `git revert` về mốc rollback, báo Claude.
Kết thúc: XONG … / TIẾP THEO → Người dùng (đổi PIN, tạo học sinh, thử).
