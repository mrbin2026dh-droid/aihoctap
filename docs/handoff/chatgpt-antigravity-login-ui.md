# Bàn giao mockup đăng nhập và tài khoản
Từ: ChatGPT → Sang: Antigravity   Ngày: 25/10/2026
## Mục tiêu
Ghép thiết kế tĩnh vào ứng dụng sau khi bộ tài khoản được Claude ACCEPT; giữ nguyên logic và hợp đồng DOM.
## Tệp cần đọc
- docs/prompts/chatgpt-login-ui.md (hợp đồng gốc)
- docs/design/login/student-login.html, student-account.html, teacher-login.html, teacher-change-pin.html
- docs/design/login/login.css và self-check.md
## Kết quả mong đợi
- 6 màn/trạng thái theo prompt; CSS dùng chung và màu đồng bộ, không tràn ở 360/768/1280.
- Giữ nguyên id/name/type/autocomplete; không thay logic tài khoản ngoài việc nối class/trạng thái; chạy kiểm tra hồi quy thích hợp rồi bàn giao Claude.
- Màn teacher-change-pin.html mặc định chỉ hiện bắt buộc đổi PIN; thêm #change-pin-section vào URL để xem khối đổi PIN thường. Trong ứng dụng dùng trạng thái thật thay cơ chế :target của bản mẫu.
## Ràng buộc / không được làm
- HTML là bản mẫu tĩnh. method="dialog" chỉ ngăn gửi dữ liệu qua URL trong bản mẫu: khi ghép phải giữ submit handler thực tế của ứng dụng, không sao chép máy móc method này.
- Các khối details là thư viện trạng thái minh họa; không ghép nguyên khối vào luồng người dùng. Đếm ngược và gợi ý độ dài là mẫu tĩnh, cần nối trạng thái thật.
- .shell/.card và selector toàn cục trong CSS chỉ phục vụ trang mẫu; giới hạn phạm vi khi ghép để tránh ảnh hưởng các màn khác.
- Tài khoản hiển thị là tên mẫu, không dùng dữ liệu học sinh thật. Không gọi API/mạng từ bản mẫu; JS chỉ dùng cho Hiện/Ẩn.
- Đã chạy Chrome headless 15 bố cục, thuộc tính DOM, tương phản, kích thước chạm và Hiện/Ẩn. Chưa kiểm điện thoại thật/screen reader/WCAG toàn diện, backend hoặc có ACCEPT Claude.
- Các skill Stitch/type-safe/design-taste/frontend-design/web-design-guidelines/web-perf/Sonnet theo AGENTS.md không có trong catalog phiên này, chưa chạy; đây là mockup tĩnh theo phạm vi giao trực tiếp, không phải bản ghép production đã qua pipeline.
## Xong thì chuyển cho: Claude
