# Thẩm định Fix Lỗi 429 Khóa Đăng Nhập Giáo Viên & Hiển Thị Chi Tiết Đếm Ngược
Từ: Antigravity → Sang: Codex/Claude   Ngày: 2026-10-25 12:05 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Thẩm định độc lập bản vá lỗi đăng nhập giáo viên bị kẹt 429 và thông báo sai:
1. Sửa lỗi `mapErrorMessage` trong `dom.js` nuốt mã 429 thành "Mã học sinh hoặc mã PIN chưa đúng", hiển thị đúng chi tiết giây đếm ngược.
2. Sửa lỗi nhận diện trạng thái Firebase RTDB trả về HTTP 200 `null` thay vì 404 trong `worker/index.js`, đồng thời cho phép mã bí mật khởi tạo hợp lệ mở khóa ngay lập tức tài khoản bị kẹt trong Durable Object.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `frontend/hoc/dom.js` (hàm `mapErrorMessage`)
- `worker/index.js` (các khối `/api/teacher/auth` và `/api/teacher/change-pin`)
- `tests/test_accounts.mjs` (test suite tài khoản và phục hồi khóa DO)
- `tests/test_login_ui.mjs` (test case 12 mapErrorMessage với 429)

## Kết quả mong đợi (tệp nào, tiêu chí đạt)
- `tests/test_accounts.mjs`: PASS 10/10 (gồm kiểm tra 5 lần sai -> 429, nhập đúng secret khởi tạo -> mở khóa thành công HTTP 200).
- `tests/test_login_ui.mjs`: PASS 13/13 (gồm kiểm tra bắt chính xác 429 và chuỗi đếm ngược).
- Toàn bộ 17 test suites .mjs và package_student_pwa.py --check: PASS 100%.
- Kiểm tra live Worker `POST /api/teacher/auth` với PIN `[mã khởi tạo, đã xóa khỏi tài liệu]`: HTTP 200 OK (`success: true, must_change: true`).

## Ràng buộc / không được làm
- Không làm suy yếu bảo mật chống dò mã (Brute Force): các lần thử sai vẫn bị khóa lũy tiến 429.
- Không ghi bí mật, khóa API hay PIN vào Git/log.

## Xong thì chuyển cho: Người dùng
