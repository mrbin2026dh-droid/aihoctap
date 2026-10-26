# Kiểm định Bước A (bản Antigravity) — ACCEPT CÓ ĐIỀU KIỆN, đã gộp vào main
Từ: Claude → Sang: Antigravity & Người dùng   Ngày: 26/10/2026
## Phán quyết
Hướng làm của Antigravity đúng phán quyết (nav + liên kết, 48px, bfcache, ẩn khi đăng nhập). NHƯNG Claude đã làm và đẩy cùng việc này trước (commit d0c1e00), nên hai bản chồng nhau. Bản trên main là bản chuẩn; KHÔNG đẩy bản teacher.html/teacher.css/dom.js/sw.js trên máy bạn lên.
## Đã lấy từ bản Antigravity (có giá trị, đã gộp)
- dom.js: `setFieldError` tìm `.t-field` — trước đó lỗi ô PIN giáo viên không hiện ở đâu (lỗi thật, tìm được nhờ test của Antigravity).
- teacher.js: PIN <8 ký tự hiện thông báo ở `#teacher-login-error`.
- tests/test_role_switch_step_a.cjs (5 tiêu chí, 360×360 một vùng cuộn) — giữ làm test; chỉnh để chấp nhận đoạn đang chọn là `<span aria-current="page">`.
## Khác biệt, giữ bản main vì
- Đoạn đang chọn là `<span>`, không phải `<a>` trỏ về chính trang (không tải lại trang vô nghĩa).
- Nút/logo giáo viên đổi xanh trầm cùng học sinh (ChatGPT nhận xét lệch màu đen/xanh); bản Antigravity vẫn đen.
- Bản main có cả phía học sinh (index.html) — bản trên máy Antigravity chưa có.
## Việc cần làm (Antigravity)
1. Lưu thay đổi cục bộ nếu cần (`git stash`), rồi `git pull --rebase`; khi xung đột teacher.*, dom.js, sw.js lấy bản main (`git checkout --theirs`/`--ours` tùy chế độ rebase; kiểm lại bằng test).
2. Chạy: test_role_switch, test_role_switch_step_a, test_role_isolation, test_teacher_shell; `python tools/package_student_pwa.py --check`.
3. Deploy Pages (chỉ frontend/hoc) và kiểm trên điện thoại thật như file claude-antigravity-login-segmented-stepa.md.
4. Commit và push mọi file docs/handoff còn nằm trên máy (nhiều file chưa lên GitHub). Lần sau làm chung trên MỘT nhánh main đã pull mới nhất để tránh làm trùng.
## Chưa làm
Bước B (bỏ #gate + dialog) chờ người dùng chốt.
