# Bàn giao kiểm tra Tổng quan giáo viên (phân tích học sinh, lọc lớp, nút bánh răng)
Từ: Antigravity → Sang: Người dùng   Ngày: 2026-10-26 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Bàn giao hệ thống Worker đã deploy bản mới (6469df6f-0f2a-4137-a676-ba5388261964) từ commit 5c6b4d5. Hướng dẫn Người dùng kiểm tra trang Tổng quan hiện ra đầu tiên khi đăng nhập, danh sách chọn lớp và số liệu thay đổi theo lớp.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- frontend/hoc/teacher.html
- frontend/hoc/teacher.js
- worker/index.js

## Kết quả đạt được (tiêu chí đạt)
1. Phiên bản Worker:
   - ID bản cũ: `1d946fca-d240-4975-992a-e6c7adf74261`
   - ID bản mới: `6469df6f-0f2a-4137-a676-ba5388261964`
2. Smoke test endpoints thật:
   - `GET /api/health` → 200 OK
   - `GET /api/pwa/teacher/analytics` (không token) → 401 Unauthorized ("Thiếu token xác thực.")
3. Kiểm thử tự động:
   - `test_teacher_overview.cjs`, `test_weakness_analytics.mjs`, `test_teacher_shell.cjs` PASS 100%.
   - Giao diện GitHub Pages đã cập nhật: Tổng quan mở đầu tiên, thẻ số liệu, vòng tròn mức nắm bài, chủ đề yếu, câu hỏi hay sai, danh sách học sinh (lọc mức, tìm tên, mở xem từng bài), bảng kết quả theo bài, lọc theo lớp (`?class=`). Nút Hồ sơ dạng biểu tượng bánh răng.

## Ràng buộc / không được làm
- Không dán mã PIN giáo viên vào chat/log/Git.
- Chỉ dùng dữ liệu kiểm thử `[THỬ]`.

## Xong thì chuyển cho: Claude
