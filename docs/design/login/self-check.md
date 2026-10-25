# Tự kiểm mockup đăng nhập
Ngày: 25/10/2026 · ChatGPT/Codex

- PASS: Chrome headless qua Playwright, 15 lượt bố cục (5 màn × 360/768/1280), cao 640px trên mobile. Không tràn ngang kể cả mở các khối trạng thái.
- PASS: vùng chạm button/input/summary nhìn thấy ≥48px; input ≥16px; id duy nhất, label liên kết thật; các ID bắt buộc tồn tại; 6 nhóm thuộc tính hợp đồng đã đối chiếu.
- PASS: màn bắt buộc đổi PIN và màn cài đặt hiển thị riêng; nút Hiện/Ẩn hoạt động; không có lỗi JavaScript. Submit mẫu đóng dialog bằng method=dialog, không đưa PIN vào URL và không gọi API.
- Các ảnh *-360.png là ảnh chụp Chrome thực tế, không phải thiết kế sinh ảnh.
- Chưa kiểm điện thoại iOS/Android thật, screen reader, kiểm toàn diện WCAG/Lighthouse hoặc logic tài khoản/backend; chưa có ACCEPT Claude.

| Cặp màu | Tỷ lệ |
|---|---:|
| Chữ chính / nền | 12.72:1 |
| Chữ chính / bề mặt | 13.88:1 |
| Chữ phụ / nền | 5.47:1 |
| Chữ phụ / bề mặt | 5.97:1 |
| Chữ nút / nhấn | 11.64:1 |
| Lỗi / nền lỗi | 7.57:1 |
| Thành công / nền | 7.15:1 |
| Focus / bề mặt | 6.32:1 |
| Viền input / bề mặt | 3.62:1 |