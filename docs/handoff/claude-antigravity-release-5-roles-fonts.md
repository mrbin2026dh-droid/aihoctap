# Claude → Antigravity: đợt 5 — cách ly vai trò (CAO) + sửa phông tiếng Việt
Đọc AGENTS.md (G, L, N). Mã Claude đã đặt trong thư mục dự án theo lệnh chủ dự án; Antigravity kiểm, đóng dấu, đẩy, deploy, smoke test.

## Lỗi gốc
1. Học sinh vào được giao diện giáo viên: trình duyệt còn `sessionStorage['aisgk-pwa-teacher']` từ lần giáo viên đăng nhập trước; học sinh đăng nhập không xóa; liên kết "Góc Giáo viên" vẫn hiện; trang giáo viên dùng lại token đó. (Máy chủ vẫn chặn học sinh gọi API giáo viên nhờ `hasTeacherClaims`; đây là lỗi phiên phía trình duyệt, dùng chung máy trường học.) Claude đã tái hiện bằng Playwright rồi sửa.
2. Chữ tiêu đề lỗi dấu ("Thê´ giới kĩ thuật sô´"): Georgia thiếu glyph ế ố… → thay bằng phông tự lưu trữ Source Serif 4 (OFL) phủ đủ 134 chữ cái Việt (đã kiểm bằng fontTools).

## Đã đặt vào dự án
- `frontend/hoc/app.js`: `clearTeacherSession()` gọi khi học sinh đăng nhập và mỗi lần `identityUI()` có phiên; ẩn `.teacher-link` khi có phiên học sinh.
- `frontend/hoc/teacher.js`: nhập `db.js`; đầu tệp, nếu có phiên học sinh trong IndexedDB thì xóa token giáo viên; khi giáo viên đăng nhập thành công thì `db.remove('meta','session')`.
- `frontend/hoc/styles.css`: 2 `@font-face` `SGK Serif` (latin + vietnamese), thay 6 chỗ Georgia.
- `frontend/hoc/fonts/` (2 woff2 + giấy phép OFL), `sw.js` FILES và `tools/package_student_pwa.py` SHELL_FILES đã thêm phông; `sw.js` đóng dấu `fdd264ba…`.
- `tests/test_role_isolation.cjs` 4/4, `tests/test_fonts_vietnamese.cjs`; AGENTS.md mục N.
Claude đã chạy: toàn bộ `tests/test_*.mjs` exit 0, `test_login_gate` 7/7, dấu SW khớp.

## Việc cần làm
1. `git diff` (nhớ `git add frontend/hoc/fonts`); chạy lại toàn bộ test + 2 test .cjs; `--stamp` rồi kiểm; quét bí mật rỗng; ghi mốc rollback; push; chờ CI xanh.
2. Smoke THẬT: (a) trình duyệt có phiên giáo viên → đăng nhập học sinh → không thấy liên kết giáo viên; mở `teacher.html` phải đòi đăng nhập; (b) tiêu đề "Thế giới kĩ thuật số" hiện đúng dấu (chụp ảnh); (c) thiết bị đã cài: mở 2 lần, bấm cập nhật, thấy phông mới; (d) mất mạng vẫn thấy tiêu đề đúng (phông đã tiền tải).
3. Nhắc người dùng: đổi PIN giáo viên nếu chưa (xem docs/audits/2026-10-25-teacher-auth-fix.md).
Thất bại → `git revert` về mốc rollback. Kết thúc: XONG … / TIẾP THEO → Người dùng.
