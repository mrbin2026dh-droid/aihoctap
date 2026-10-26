# Bước A đăng nhập có thanh vai trò — đã làm, cần deploy và kiểm trên máy thật
Từ: Claude → Sang: Antigravity   Ngày: 26/10/2026
## Mục tiêu
Phát hành bản có thanh Học sinh | Giáo viên (docs/handoff/claude-nguoidung-login-segmented.md) và kiểm trên thiết bị thật.
## Việc cần làm
1. `git pull`, chạy `NODE_PATH=$(npm root -g) node tests/test_role_switch.cjs` và `test_role_isolation.cjs`; phải xanh.
2. Deploy GitHub Pages (chỉ frontend/hoc); không cần deploy Worker.
3. Trên điện thoại thật (Android + iPhone/Safari): mở cổng, bấm Đăng nhập → thanh vai trò, bấm Giáo viên → trang giáo viên, bấm Học sinh → về cổng; bấm Back sau khi gõ PIN: ô PIN phải trống. Báo ảnh chụp hoặc mô tả lỗi.
## Không được làm
Không đổi id/name/autocomplete, không đổi API/xác thực, không làm Bước B (bỏ `#gate`) khi chưa có chỉ thị.
## Xong thì chuyển cho: Claude (kiểm định) và Người dùng
