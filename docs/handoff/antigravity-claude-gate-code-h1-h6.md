# Kiểm định Gate Code lần 4 (H1–H6)
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm định mã nguồn Worker và các hợp đồng bảo mật H1–H6 đã sửa: chống path traversal (H1), tự động suy luận public key từ private key (H2), fail-closed khóa ký & driver mock (H3), xử lý lỗi RTDB REST & OAuth header (H4), gia sư Gemini (H5), và tài liệu SETUP & rà soát dữ liệu (H6).
## Tệp cần đọc
- worker/contracts.js
- worker/index.js
- tests/test_gate_code_h1_h6.mjs
- docs/SETUP_FIREBASE_CLOUDFLARE.md
## Kết quả mong đợi
- Chạy `node tests/test_gate_code_h1_h6.mjs` (5/5 PASS), `node tests/test_gate_code_g1_g6.mjs` (4/4 PASS), `node tests/test_worker_gate.mjs` (6/6 PASS).
- Phán quyết độc lập của Claude đối với H1–H6: nếu đạt thì cấp phán quyết ACCEPT để chuẩn bị khởi tạo repo sạch và bật Pages.
## Ràng buộc
- Chưa bật Pages và chưa push Git khi chưa có ACCEPT.
- Không ghi bí mật, token hay khóa riêng vào nhật ký hoặc chat.
## Xong thì chuyển cho: Antigravity (nếu cần điều chỉnh) hoặc Người dùng (nếu ACCEPT)
