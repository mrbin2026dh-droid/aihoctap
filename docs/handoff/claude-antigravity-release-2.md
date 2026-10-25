# Phát hành thử đợt 2 (bộ tài khoản) — Claude → Antigravity
Căn cứ: `docs/audits/2026-10-25-c1-verdict.md`, AGENTS.md mục G. Phạm vi: bộ tài khoản + C1 + các bản sửa T1/P1 chưa lên. KHÔNG gồm tài liệu PDF/Apps Script, không gồm mockup đăng nhập của ChatGPT (ghép sau). Chỉ dữ liệu thử "[THỬ]", không học sinh/bài thật.

## Trước deploy
1. Chạy 14 bộ test + `node --check` + `npx oxlint`; xanh hết, dán kết quả vào log.
2. Quét bí mật trước khi push: `git diff --cached | grep -iE "AIza|BEGIN PRIVATE|pin_hash|KEY_ENC_SECRET *=|TEACHER_ADMIN_SECRET *="` phải rỗng; không có `.env`, CSV học sinh.
3. Xác nhận Worker production không có biến `MOCK_MODE` (Dashboard hoặc `npx wrangler secret list`; không in giá trị).
4. Lưu ID bản đang chạy: `npx wrangler deployments list` (bản hiện tại 563b6292-2efe-4e4e-9141-4d1888ae060c nếu chưa đổi) để `npx wrangler rollback <ID>`.
5. PIN khởi tạo giáo viên = `TEACHER_ADMIN_SECRET` đang đặt trên Worker. Nếu người dùng muốn đổi: để NGƯỜI DÙNG tự chạy `npx wrangler secret put TEACHER_ADMIN_SECRET` và nhập chuỗi ngẫu nhiên 10–12 ký tự (khuyến nghị; chuỗi từng gửi trong chat không nên dùng). Antigravity chỉ hướng dẫn, không nhận/ghi chuỗi đó.

## Deploy
`npx wrangler deploy`; commit + push `main` (Pages tự đăng `frontend/hoc`). Commit theo mẫu cũ, tác giả bot.

## Smoke test THẬT sau deploy (ghi vào log; sai một mục → rollback và báo Claude)
1. `GET /api/health` 200; `GET /api/pwa/catalog` 200.
2. `POST /api/teacher/auth` với PIN sai → 401; `GET /api/teacher/students` với header `X-Admin-Secret` (giá trị bất kỳ) không token → 403/401.
3. `GET /api/teacher/students` không token → 403/401; `POST /api/pwa/change-pin` không token → 401.
4. `POST /api/student/lan-login` → 403; `POST /api/login` với ID không tồn tại → 401.
5. Pages: `index.html`, `teacher.html`, `sw.js` 200 và console F12 không lỗi.
(Đăng nhập giáo viên bằng PIN thật, đổi PIN, tạo học sinh: người dùng tự làm theo `docs/guides/kiem-tay-dot-1.md`.)

## Xong khi
ID bản cũ/mới trong log, smoke 5/5 THẬT. Chuyển lại Claude; người dùng kiểm tay, lỗi ghi vào `docs/handoff/nguoidung-release-1-loi.md`.
