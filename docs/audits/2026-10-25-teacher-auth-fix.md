# Thẩm định: sửa kẹt 429 đăng nhập giáo viên (25/10/2026)
**ACCEPT mã; YÊU CẦU XỬ LÝ NGAY sự cố bảo mật (tầng CAO).**

## Đã kiểm thật
- 17 suite .mjs, `test_login_gate` 7/7, `test_pwa_update_integrity` 7/7: đều exit 0; dấu SW `9ae50b99…` khớp; `node --check worker/index.js` OK.
- Đọc `worker/index.js` `/api/teacher/auth`: mã khởi tạo chỉ mở khóa khi `teacher_auth/main` chưa có (RTDB 404 hoặc `null`); đã có PIN thật thì mã khởi tạo vô hiệu; sai vẫn tăng khóa lũy tiến, trả 429 kèm giây đếm ngược. `mapErrorMessage` giữ thông báo 429.

## Lỗi
- **B1 (CAO):** mã PIN khởi tạo giáo viên bị ghi vào `aisgk.md` và `docs/handoff/antigravity-codex-teacher-auth-fix.md`, đã đẩy lên kho CÔNG KHAI (commit ade4cfe). Vi phạm H.1/G.5. Hệ thống đang ở trạng thái "chưa đổi PIN" nên người ngoài có thể đăng nhập giáo viên.
  Xử lý: (1) người dùng đăng nhập ngay và đổi PIN (mã cũ chết); (2) xóa khỏi tài liệu (Claude đã xóa trong tệp làm việc, Antigravity đẩy); (3) đặt `TEACHER_ADMIN_SECRET` mới ngẫu nhiên; (4) từ nay không ghi PIN/mã khởi tạo vào bất kỳ tệp nào, kể cả báo cáo kiểm thử.
- Lưu ý: lịch sử Git vẫn chứa mã cũ; vô hiệu hóa bằng đổi PIN, không cần viết lại lịch sử.
- Lưu ý nhỏ: `mapErrorMessage` so khớp chuỗi con `'sai'`, `'khóa'` — có thể nhầm với câu khác; nên đổi sang so theo mã lỗi.
