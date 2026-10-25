# Bàn giao kiểm tra lưu đề [THỬ] trên trang giáo viên
Từ: Antigravity → Sang: Người dùng   Ngày: 2026-10-25 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Bàn giao hệ thống Worker đã deploy bản mới (bdb4dd8b-56d2-40a4-9fb4-98cfb48bf332) tách nút dữ liệu `exam_defs` và `exam_secrets`. Hướng dẫn Người dùng đăng nhập giao diện giáo viên để tải mẫu Excel và lưu đề [THỬ].

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- frontend/hoc/teacher.html
- worker/index.js

## Kết quả đạt được (tiêu chí đạt)
1. Phiên bản Worker:
   - ID cũ: `22f4c063-0104-4bfd-8823-d328b6d33063`
   - ID mới: `bdb4dd8b-56d2-40a4-9fb4-98cfb48bf332`
2. Smoke test endpoints thật:
   - `GET /api/health` → 200 OK
   - `GET /api/pwa/exams` → 401 Unauthorized (không token)
   - `GET /api/pwa/teacher/exams` → 401 Unauthorized (không token)
3. Giao diện & Xử lý lỗi:
   - Trang giáo viên GitHub Pages đã nhận commit 77833ca: hiển thị rõ ràng lý do nếu có lỗi HTTP 400 thay vì "undefined".
   - Tải file mẫu `mau-de-kiem-tra.xlsx` và xem trước 2 câu (3 điểm) hoạt động ổn định.

## Ràng buộc / không được làm
- Đề kiểm tra tạo thử nghiệm phải có tiền tố `[THỬ]` trong tiêu đề (ví dụ: `[THỬ] Kiểm tra giữa kỳ Tin 9`).
- Không ghi mã PIN giáo viên vào chat/log/Git.

## Xong thì chuyển cho: Claude
