# Kiểm định M1–M4 & Giai đoạn 1 Tính năng Dự thi
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm định kết quả sửa M1–M4, bằng chứng deploy THẬT Giai đoạn 2 (đăng nhập PIN & khóa giáo viên 429), và các tính năng Giai đoạn 1 (xuất bản đa môn, tài liệu, tách đáp án).
## Tệp cần đọc
- worker/index.js (M1 ~1180, M2 ~920, M3 ~995 & ~360, Phase 1 ~1315-1490)
- tools/manage_students.py (M4 auto PIN, no hardcoded DB URL, export CSV)
- .gitignore (M4 CSV/JSON exclusion)
- docs/SETUP_FIREBASE_CLOUDFLARE.md (Mục 6 hướng dẫn giáo viên)
- tests/test_gate_code_m1_m4_phase1.mjs
- tests/test_manage_students.py
## Kết quả mong đợi
- M1: `/api/teacher/auth` khóa 429 sau 5 lần sai. Đã kiểm chứng THẬT bằng curl live Worker trả `Nhập sai 5 lần. Tài khoản giáo viên bị tạm khóa 300s.`
- M2: `/api/pwa/me` thiếu claims trả 401 Unauthorized, không đoán fallback.
- M3: PIN tối thiểu 6 ký tự. Tấn công dò mã từ 10 IP khác nhau kích hoạt khóa toàn cục `student_lock:${id}` (429) cho đến khi giáo viên mở khóa qua `/api/teacher/unlock`.
- M4: `manage_students.py` bỏ URL cứng, tự sinh PIN 6 chữ số, xuất CSV ra file ngoài repo, thêm vào `.gitignore`.
- Giai đoạn 1: `/api/pwa/teacher/publish` tách riêng `packages_private`, sanitizer kiểm tra 0 leak sang gói công khai, catalog tự cập nhật môn học mới (`toan9`) ngay lập tức; route `/api/pwa/teacher/lesson/{course}/{lesson}` ghép đáp án cho giáo viên; `/api/pwa/teacher/materials` và `/api/pwa/materials/{course}` quản lý tài liệu.
- Đầy đủ 7 bộ test PASS 100%: `m1_m4_phase1.mjs` (5/5), `l1_l5.mjs` (5/5), `test_manage_students.py` (6/6), `j1_j3` (4/4), `i1_i4` (4/4), `h1_h6` (5/5), `g1_g6` (4/4), `test_worker_gate.mjs` (6/6); oxlint 0 warnings 0 errors; node --check 0 lỗi.
## Ràng buộc
Chưa deploy Giai đoạn 1 (frontend xuất bản) lên Pages khi chưa có phán quyết ACCEPT của Claude (tuân thủ nghiêm ngặt ràng buộc).
## Xong thì chuyển cho: Claude
