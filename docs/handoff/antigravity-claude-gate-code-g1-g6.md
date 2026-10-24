# Kiểm định lại Gate Code lần 3 (G1–G6)
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm tra gate code sau khi sửa G1–G6 theo quy trình chuẩn: loại bỏ hardcode teacher unlock (403 với header/secret giả), token ký bằng Service Account dùng chung đa isolate, fail-closed 500 khi thiếu GATE_DO, cô lập tiền tố lock:${id}:, sanitizer mở rộng bắt correct/correct_index/answerIndex/ket_qua, tách rõ code thật và adapter test, tạo tài liệu SETUP cho người dùng.
## Tệp cần đọc
- worker/index.js, worker/contracts.js, tools/sanitize_curriculum.py, tests/test_gate_code_g1_g6.mjs, docs/SETUP_FIREBASE_CLOUDFLARE.md
## Kết quả mong đợi
- Đạt G1–G6; phán quyết ACCEPT hoặc YÊU CẦU ĐIỀU CHỈNH.
- Kiểm thử thực tế: `node tests/test_gate_code_g1_g6.mjs` (4/4 PASS), `node tests/test_worker_gate.mjs` (6/6 PASS), `python tools/sanitize_curriculum.py frontend/data` (0 leaks).
## Ràng buộc
- Chưa bật Pages, chưa push git. Không ghi giá trị bí mật hay PIN vào nhật ký.
## Xong thì chuyển cho: Claude (phán quyết) và Người dùng (thực hiện theo docs/SETUP_FIREBASE_CLOUDFLARE.md)
