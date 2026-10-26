# Bàn giao kiểm tra tính năng Tài khoản học sinh (mã tự đặt, nhập/xuất Excel)
Từ: Antigravity → Sang: Người dùng   Ngày: 2026-10-26 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Bàn giao hệ thống Worker đã deploy bản mới (1d946fca-d240-4975-992a-e6c7adf74261) từ commit 8c101cc. Hướng dẫn Người dùng kiểm tra trực tiếp tính năng thêm học sinh với mã tự đặt, tải mẫu và nhập danh sách Excel.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- frontend/hoc/teacher.html
- frontend/hoc/student-import.js
- worker/index.js

## Kết quả đạt được (tiêu chí đạt)
1. Phiên bản Worker:
   - ID bản cũ: `bdb4dd8b-56d2-40a4-9fb4-98cfb48bf332`
   - ID bản mới: `1d946fca-d240-4975-992a-e6c7adf74261`
2. Smoke test endpoints thật:
   - `GET /api/health` → 200 OK
   - `POST /api/teacher/students/import` (không token) → 403 Forbidden ("Từ chối truy cập: Yêu cầu quyền giáo viên hợp lệ.")
3. Kiểm thử tự động:
   - `test_student_import.mjs`, `test_student_import_backend.mjs`, `test_student_import_browser.cjs` PASS 100%.
   - Giao diện GitHub Pages đã cập nhật: thanh tìm kiếm có icon + placeholder gợi ý, nút "Nhập từ Excel", "Tải mẫu Excel", "Xuất danh sách Excel", và ô "Mã học sinh".

## Ràng buộc / không được làm
- Chỉ dùng mã học sinh thử như `hs-thu01` và tên học sinh gắn tiền tố `[THỬ]`.
- Sau khi kiểm tra xong, xóa các tài khoản thử nghiệm khỏi hệ thống.

## Xong thì chuyển cho: Claude
