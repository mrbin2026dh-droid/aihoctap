# Sơ đồ và quyết định thiết kế
25/10/2026 · ChatGPT/Codex · Bản mẫu độc lập, không ghép ứng dụng.

| Vị trí | Học sinh | Giáo viên | Lý do |
|---|---|---|---|
| Màn làm việc | Bài đang học | Lớp và học sinh, chọn lớp | Công việc thường dùng luôn ở ngoài Cài đặt |
| Cài đặt → Cá nhân | Tài khoản | Tài khoản | Thông tin và liên kết đổi PIN không chiếm chỗ màn chính |
| Cài đặt → Học ngoại tuyến | Tải ngoại tuyến, Hướng dẫn | Không có trong mẫu này | Chỉ mở khi cần; không đưa cấu hình giáo viên cho học sinh |
| Cài đặt → AI | Không có | Hạn mức sử dụng, Khóa API | Các thao tác hệ thống cùng nhóm, một nội dung mỗi lần |
| Thao tác học sinh | Không có | Khóa/mở khóa, đặt lại PIN, xóa | Thu gọn theo từng đối tượng, không bày hàng nút |

Mobile dưới 960px: Cài đặt mở danh sách nhóm; chọn một nhóm mở chi tiết, có Quay lại. Từ 960px: danh sách nhóm cạnh nội dung, tối đa 2 vùng. Kích thước dựa trên không gian cần cho nhãn, không nhận diện thiết bị bằng user-agent.

Lựa chọn một lớp và danh sách không bị dựng lại khi mở/đóng cài đặt. Bản nháp hạn mức có hộp thoại ở lại/bỏ thay đổi trước chuyển nhóm; lưu có xác nhận đối tượng và hạn mức. Menu thao tác đóng trước mở modal; mặc định focus Hủy, native dialog giữ focus. Nhóm hiện tại/tiêu đề có focus đúng ngữ cảnh.

## Giả định và giới hạn
- Fixture cố định: 2 học sinh mẫu, 2 nhãn lớp, 1 nhãn khóa API và 1 bài đã tải. Lựa chọn lớp chỉ minh họa điều hướng; chưa truy vấn dữ liệu theo lớp. Tất cả dùng [THỬ], không người học thật, không khóa API/PIN thật.
- Màn học chỉ là ngữ cảnh để thấy không gian được giữ lại, không triển khai học/chấm/đăng bài. Đổi PIN liên kết tới mockup đã có trong ../login, không viết lại xác thực. Điều hướng theo vai trò ở đây chỉ là thiết kế, không thay phân quyền máy chủ.
- JS chỉ mô phỏng DOM, menu, bản nháp, dialog và độ trễ 350ms; không network/storage/API. Commit trong prototypeMetrics là ý định mô phỏng, không phải yêu cầu máy chủ hoặc dữ liệu được lưu bền.
- Xóa chỉ ở mẫu đã xác định không thể hoàn tác; Antigravity phải đối chiếu lại ngữ nghĩa xóa thực tế trước ghép câu chữ. Đặt lại PIN chỉ minh họa xác nhận, không tạo mã mới.
- Nhóm AI chỉ minh họa cấu hình theo lớp; giao diện thống kê/cấp lượt theo học sinh và thêm khóa không thuộc phạm vi bản mẫu này.

## Xem mẫu
Mở teacher.html hoặc student.html; nhấn Cài đặt. Tham số ?view=menu mở danh sách, ?view=account/quota/keys (giáo viên), ?view=account/offline/help (học sinh) mở chi tiết.
Trạng thái riêng: teacher.html?state=loading, teacher.html?state=empty, teacher.html?state=error; với khóa dùng thêm &view=keys; học sinh dùng ?view=offline&state=loading/empty/error. Không có bộ nút kiểm thử trong màn làm việc mặc định.
Thêm ?simulate=error vào URL để xem lỗi sau xác nhận; dữ liệu mẫu không đổi. Reload đặt lại fixture. Trạng thái thành công/xác nhận được tạo qua thao tác thật trong mẫu. Không dùng prototypeMetrics thay bằng chứng API của bản ghép.
