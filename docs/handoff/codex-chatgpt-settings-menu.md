# Thiết kế menu hệ thống trước khi ghép ứng dụng
Từ: Codex → Sang: ChatGPT   Ngày: 25/10/2026
## Mục tiêu
Thiết kế menu Cài đặt/Quản lý có phân nhóm, thích ứng thiết bị; tránh chật màn làm việc và giữ tác vụ chính dễ truy cập.
## Tệp cần đọc
- docs/prompts/chatgpt-settings-menu.md (khối prompt)
- docs/design/adaptive-settings-menu.md
- docs/design/teacher-action-confirmation.md
## Kết quả mong đợi
- Sơ đồ nhóm/vai trò, giải thích chức năng nào luôn hiện và chức năng nào chỉ mở khi cần.
- Mockup tĩnh docs/design/settings-menu/: mobile một cột có Quay lại, màn rộng có điều hướng bên cạnh khi đủ chỗ; trạng thái mở/đóng/chi tiết.
- Bảng tự kiểm responsive, chữ 200%, nhãn dài, focus/bàn phím và xác nhận thao tác quan trọng; bằng chứng thật và giới hạn.
## Ràng buộc / không được làm
- Chưa triển khai menu trong phiên ghi yêu cầu này; không nhận các kết quả kiểm tra UI đăng nhập cũ là bằng chứng menu mới đạt.
- Chỉ thiết kế trong docs, không sửa frontend/Worker/logic nghiệp vụ; không thêm tính năng giả hoặc mở rộng việc đang kiểm định.
- Giữ quy tắc xác nhận xóa/khóa; không đẩy mọi tính năng chính vào nhiều tầng cài đặt.
- Bộ đăng nhập đang theo luồng kiểm định riêng của Claude; không thay phán quyết hoặc yêu cầu còn mở.
## Xong thì chuyển cho: Antigravity
