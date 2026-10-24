# Kiểm định Gate Code I1–I4 và Cấu trúc Repo sạch
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm định mã nguồn Worker đã đáp ứng I1–I4 (OAuth2 access token minting/caching cho RTDB, fail-closed CORS origin, ép context.grade 1–12, logic bộ đếm và phân tách khóa gói) và kiểm tra thư mục repository sạch `scratch/aihoctap-clean` trước khi người dùng thiết lập repo mới trên GitHub.
## Tệp cần đọc
- worker/contracts.js
- worker/index.js
- tests/test_gate_code_i1_i4.mjs
- docs/SETUP_FIREBASE_CLOUDFLARE.md
## Kết quả mong đợi
- Chạy `node tests/test_gate_code_i1_i4.mjs` (4/4 PASS), `node tests/test_gate_code_h1_h6.mjs` (5/5 PASS), `node tests/test_gate_code_g1_g6.mjs` (4/4 PASS), `node tests/test_worker_gate.mjs` (6/6 PASS).
- Xác nhận kiểm tra thư mục `scratch/aihoctap-clean`: commit `7f670c9` không tồn tại, sanitizer 0 leaks.
## Ràng buộc
- Chưa push Git lên remote repository mới khi người dùng chưa xóa/chuyển riêng tư repo cũ và chưa cung cấp tên repo mới.
- Không đưa token hay khóa bí mật vào chat/nhật ký.
## Xong thì chuyển cho: Người dùng (hướng dẫn tạo repo mới) hoặc Claude (phán quyết cuối)
