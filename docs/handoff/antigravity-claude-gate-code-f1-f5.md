# Kiểm định lại Gate Code (F1–F5)
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm tra gate code sau khi sửa xong F1–F5: auth salt/PIN riêng từng học sinh + Firebase custom token RS256 thật, Durable Object lưu trạng thái đa instance, khóa đăng nhập cặp student:IP + backoff + teacher unlock, /api/submit & /api/tutor xác minh JWT qua HTTP, sanitizer quét 0 leak.
## Tệp cần đọc
- worker/index.js, tests/test_worker_gate.mjs, tools/sanitize_curriculum.py, database.rules.json
## Kết quả mong đợi
- Đạt F1–F5; phán quyết ACCEPT hoặc YÊU CẦU ĐIỀU CHỈNH.
- Chạy test thực tế: `node tests/test_worker_gate.mjs` (6/6 pass qua HTTP nhiều instance) và `python tools/sanitize_curriculum.py`.
## Ràng buộc
- Không ghi giá trị đáp án hay PIN vào nhật ký. Chưa bật Pages, chưa push git khi chưa có ACCEPT.
## Xong thì chuyển cho: Antigravity (nếu còn điều kiện) hoặc Người dùng (nếu ACCEPT để khởi tạo repo sạch)
