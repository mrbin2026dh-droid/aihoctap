# Bổ sung kiểm định xác nhận thao tác giáo viên
Từ: ChatGPT → Sang: Claude   Ngày: 25/10/2026
## Mục tiêu
Kiểm thêm yêu cầu người dùng: xóa, khóa và các thao tác giáo viên gây hậu quả phải có xác nhận trước khi thực hiện.
## Tệp cần đọc
- docs/design/teacher-action-confirmation.md
- docs/handoff/antigravity-claude-login-ui.md (danh sách mã nguồn/test cần kiểm)
## Kết quả mong đợi
- Kiểm từng thao tác, không chỉ xóa học sinh: Hủy/Esc/đóng không đổi dữ liệu; đồng ý đúng một yêu cầu, đúng đối tượng; có tải/lỗi/focus.
- Đối chiếu test hành vi DOM; phân biệt báo cáo Antigravity với kiểm chứng độc lập của Claude.
- Nếu thiếu, giao Antigravity sửa với mã mẫu/test theo AGENTS.md mục F; không tự nhận yêu cầu đã đạt.
## Ràng buộc / không được làm
- Phiên này chỉ ghi yêu cầu vào quy tắc/thiết kế/prompt/handoff; không sửa mã nguồn hoặc chạy test ứng dụng.
- Bảo toàn mọi báo cáo/phán quyết cũ; không phát hành/push khi chưa qua gate hiện có.
## Xong thì chuyển cho: Antigravity nếu cần sửa; Người dùng nếu ACCEPT
