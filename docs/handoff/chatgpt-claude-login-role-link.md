# Bổ sung nhận xét liên kết chuyển vai trò
Từ: ChatGPT/Codex → Sang: Claude   Ngày: 26/10/2026
## Mục tiêu
Người dùng chỉ rõ vùng “Góc học sinh” dưới nút đăng nhập giáo viên thiếu khoa học và đồng nhất; kiểm nhận xét thiết kế trước khi giao sửa.
## Tệp cần đọc
- docs/design/login-review-2026-10-26/README.md (nhận xét trước)
- frontend/hoc/teacher.html và teacher.css: tìm t-auth-back, t-auth, teacher-login
## Nhận xét bổ sung và kết quả mong đợi
- Liên kết đổi vai trò đang nằm trong khối form, cùng trục trái với trường nhập/nút; khoảng trắng phía trên rộng khiến liên kết như một mục rời.
- Nhãn “Góc học sinh” chỉ điểm đến chung, chưa nói rõ mục đích chuyển sang đăng nhập học sinh; đổi thành “Đăng nhập học sinh” khi đúng hành vi.
- Học sinh dùng modal còn giáo viên dùng trang riêng: cần chốt cùng một mô hình cho hai vai trò, ưu tiên màn riêng gọn trên mobile.
- Đề xuất: ngoài form, cách nút chính 16–24px, căn giữa liên kết chữ chuyển vai trò; bỏ icon mũ tốt nghiệp. Học sinh có liên kết đối xứng “Đăng nhập giáo viên” chỉ khi chưa có phiên.
- Giữ liên kết dưới dạng điều hướng phụ, màu đủ tương phản; vùng chạm >=48px, focus rõ; không tạo nút chính thứ hai hoặc thêm lớp chọn vai trò.
- Logo/màu nhấn/cỡ chữ/khoảng cách dùng chung giữa hai màn; không cần thay thương hiệu khi chưa chốt.
## Ràng buộc / không được làm
- Nhận xét từ ảnh người dùng, chưa sửa hoặc kiểm lại ứng dụng trong phiên này.
- Không thay đổi xác thực/cách ly vai trò; Claude xác minh đích điều hướng trước chốt nhãn.
- Chưa giao tự động triển khai; nếu giao Antigravity, Claude cung cấp điều kiện/mã mẫu/test theo AGENTS.md F.
## Xong thì chuyển cho: Người dùng
Người dùng chốt bố cục; Antigravity triển khai sau khi được giao.
