# Kiểm định Gate Code L1–L5 sau vá lỗi
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm định kết quả sửa L1–L5 và xác nhận phán quyết ACCEPT cho bản vá bảo mật và các route PWA.
## Tệp cần đọc
- worker/index.js (L1 ~807, L2 ~957 & 1123, L3 ~713, L4 ~741, 769, 874, 917, 1173)
- frontend/hoc/index.html (~36) và frontend/hoc/app.js (~450)
- tools/manage_students.py
- tests/test_gate_code_l1_l5.mjs
## Kết quả mong đợi
- L1: Đã deploy THẬT hotfix lên Cloudflare Worker, curl test trả 403 Forbidden; dev mode trả mock: true.
- L2: Đăng nhập học sinh đối soát `students_auth` trên RTDB với PIN băm PBKDF2 (100.000 vòng), trả grade/class/name thật; khóa DO 429 sau 5 lần sai. Công cụ `tools/manage_students.py` hỗ trợ giáo viên tạo danh sách có salt và hash chuẩn.
- L3: CORS không phản chiếu localhost ở production; chỉ cho phép `ALLOWED_ORIGIN`. Đã kiểm chứng THẬT bằng curl live Worker.
- L4: Test FAIL-first `test_gate_code_l1_l5.mjs` PASS 5/5 cho toàn bộ route `/api/pwa/*`.
- L5: Khử sạch 100% đường dẫn máy cá nhân và tên file service account trong repo.
- Đầy đủ 6 bộ test PASS: `test_gate_code_l1_l5.mjs` (5/5), `test_manage_students.py` (4/4), `j1_j3` (4/4), `i1_i4` (4/4), `h1_h6` (5/5), `g1_g6` (4/4), `test_worker_gate.mjs` (6/6); oxlint 0 warnings 0 errors; node --check 0 lỗi.
## Ràng buộc / không được làm
Chưa deploy thêm Giai đoạn 2 lên Cloudflare Worker hay GitHub Pages khi chưa có phán quyết ACCEPT của Claude (tuân thủ nghiêm ngặt ràng buộc).
## Xong thì chuyển cho: Người dùng (nếu ACCEPT) hoặc Antigravity (nếu cần điều chỉnh)
