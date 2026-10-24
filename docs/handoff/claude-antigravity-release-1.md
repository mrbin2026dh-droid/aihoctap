# Phát hành thử đợt 1 (canary) — Claude → Antigravity
Quyền quyết định đã được người dùng giao cho Claude: phát hành TỪNG tính năng sau khi Claude duyệt, để người dùng chạy web kiểm tra. Quy tắc chung: `AGENTS.md` mục G.

## Phạm vi đợt 1 (đã duyệt ở mức MOCK)
Gác cổng đăng nhập (N1–N6), gia sư AI (F1–F4), tài liệu Drive + bể khóa Gemini (O1–O5). KHÔNG gồm: giới hạn AI học sinh (chưa làm), phase 2/3.

## Bước 0 — Người dùng làm (Claude hướng dẫn, Antigravity KHÔNG tự làm, không dán bí mật vào chat/log/Git)
`npx wrangler secret put KEY_ENC_SECRET` (chuỗi ngẫu nhiên ≥ 32 ký tự); các secret cũ (khóa Firebase, ALLOWED_ORIGIN, TEACHER_ADMIN_SECRET, v.v.) đã có từ lần deploy trước; khóa Gemini nạp qua giao diện giáo viên (không bằng wrangler), chỉ gói miễn phí.

## Bước 1 — Antigravity chuẩn bị (trước khi deploy)
1. Chạy 11 bộ test Node + `node --check` + oxlint; tất cả phải xanh. Dán kết quả vào log.
2. Quét bí mật trước khi push: `git diff --cached | grep -iE "AIza|BEGIN PRIVATE|pin_hash|KEY_ENC_SECRET *=" ` phải rỗng; `git status` không có CSV học sinh, `.env`.
3. Ghi lại phiên bản Worker đang chạy (đóng N7): `npx wrangler deployments list` và lưu ID bản hiện tại vào log để quay lại.
4. Giải quyết lưu ý P1/P2 NẾU chưa tốn quá nhiều thời gian; nếu không, ghi rõ "chưa sửa" ở log (không chặn đợt 1).

## Bước 2 — Deploy
- Worker: `npx wrangler deploy` (đúng tên `aihoctap-gate`).
- Frontend: commit + push nhánh chính (workflow `.github/workflows/deploy-pages.yml` tự đăng lên Pages). Commit theo mẫu `feat/fix: ...`, tác giả bot như cũ.
- Cấm: không xuất bản bài học thật, không tạo học sinh thật; chỉ 1 bài thử có tiêu đề "[THỬ] ..." và 2–3 tài khoản thử tạo bằng `tools/manage_students.py` (PIN do công cụ sinh, CSV ngoài repo).

## Bước 3 — Smoke test sau deploy (Antigravity tự chạy, ghi THẬT vào log; không in bí mật)
1. `GET /api/health` → 200; `GET /api/pwa/catalog` → 200.
2. `POST /api/student/lan-login` → 403.
3. Đăng nhập học sinh thử sai PIN 3 lần → 401, đúng PIN → 200 + token.
4. `GET /api/pwa/materials/x/y/file` không token → 401.
5. `GET/POST /api/teacher/gemini-keys` không quyền → 403.
6. Console F12 trang Pages: 0 lỗi; PWA cài được.
Nếu 1 mục sai → quay lại bản cũ bằng `npx wrangler rollback <ID đã lưu>`, ghi nguyên nhân, DỪNG, báo Claude.

## Bước 4 — Danh sách cho người dùng kiểm tay (Claude soạn hướng dẫn riêng)
Giáo viên đăng nhập → xuất bản bài thử → đăng tài liệu PDF từ Drive (chia sẻ "Bất kỳ ai có liên kết") → thêm 1 khóa Gemini → học sinh thử đăng nhập → làm bài → hỏi gia sư (cả câu ép đưa đáp án) → tải và mở PDF ngoại tuyến. Lỗi người dùng gặp được ghi vào `docs/handoff/nguoidung-release-1-loi.md` (mỗi lỗi: bước, kết quả thấy, kết quả mong đợi); Claude phân loại rồi giao sửa.

## Xong khi
Smoke test 6/6 THẬT, ID bản cũ và bản mới ghi trong log, bàn giao về Claude để xác minh độc lập (Claude tự gọi các điểm cuối công khai nếu mạng cho phép). Chỉ sau đó Claude đánh dấu `[x]`.
