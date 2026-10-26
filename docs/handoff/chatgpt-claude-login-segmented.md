# Thẩm định phương án đăng nhập chọn vai trò bằng thanh trượt
Từ: ChatGPT/Codex → Sang: Claude   Ngày: 26/10/2026
## Mục tiêu
Người dùng yêu cầu nghiên cứu và vẽ thử thanh Học sinh/Giáo viên; phương án đã vẽ, chưa yêu cầu sửa app.
## Tệp cần đọc
- docs/design/login-segmented/README.md
- docs/design/login-segmented/role-selector-v1.png (chỉ là ảnh duyệt của người dùng; không gửi ảnh tới Sonnet audit)
## Kết quả mong đợi
- Kiểm phù hợp với một vai trò/thiết bị, tab chỉ chọn form chưa đăng nhập, không cấp quyền.
- Chốt xử lý PIN/lỗi khi chuyển tab, focus/bàn phím, reduced-motion và validation chỉ form đang hiện.
- Khi người dùng chốt và giao triển khai, viết điều kiện/mã mẫu/test theo mục F cho Antigravity.
## Ràng buộc / không được làm
- Ảnh sinh, không phải ứng dụng đã triển khai; chưa có test DOM hay ACCEPT.
- Không đổi luồng xác thực hoặc công việc Firebase/Drive chỉ vì ảnh.
- Không nhờ kéo/vuốt làm cách thao tác duy nhất; nhãn luôn hiện, vùng chạm >=48px.
## Xong thì chuyển cho: Người dùng
Người dùng chọn hướng thiết kế trước khi giao Antigravity triển khai.
