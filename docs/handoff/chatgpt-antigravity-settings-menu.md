# Ghép menu Cài đặt/Quản lý thích ứng
Từ: ChatGPT → Sang: Antigravity   Ngày: 25/10/2026
## Mục tiêu
Ghép thiết kế menu theo AGENTS.md J–K: giữ vùng làm việc thoáng, cấu hình mở theo nhóm, xác nhận thao tác quan trọng.
## Tệp cần đọc
- docs/design/settings-menu/README.md (sơ đồ, giả định, cách xem)
- docs/design/settings-menu/teacher.html, student.html, settings.css, prototype.js
- docs/design/settings-menu/self-check.md
- docs/design/adaptive-settings-menu.md, docs/design/teacher-action-confirmation.md
## Kết quả mong đợi
- Mobile nhóm → chi tiết có Quay lại; màn đủ rộng sidebar cạnh một nội dung; giữ học/quản lý lớp ngoài Cài đặt.
- Scope CSS khi ghép, tái dùng DOM/logic hiện có; nối trạng thái thật và router/history, giữ lớp/vị trí/nháp/focus; không dựng lại nghiệp vụ.
- Thao tác xóa/khóa/mở/đặt lại PIN: xác nhận đối tượng/hậu quả trước request, Hủy/Esc=0 request, đồng ý đúng một request; chống lặp và có tải/lỗi.
- Chạy kiểm tra DOM và API thật/mock thích hợp trên bản ghép; báo cáo riêng rồi chuyển Claude kiểm định trước phát hành.
## Ràng buộc / không được làm
- Đây là mockup độc lập [THỬ]; prototype.js chỉ mô phỏng, không chép fixture/prototypeMetrics/độ trễ/query kiểm thử làm logic production. Không có API, storage, PIN hoặc khóa thật.
- Màn học và lớp chỉ là ngữ cảnh; hai nhãn lớp dùng cùng fixture, chưa có tải dữ liệu theo lớp. Nhóm AI chưa thiết kế thêm khóa/thống kê/cấp lượt từng học sinh.
- Liên kết đổi PIN đi tới mockup login đã có; khi ghép nối lại màn tài khoản/đăng xuất thật, không đổi luồng xác thực. Kiểm định đăng nhập đang mở vẫn độc lập.
- Chrome PASS 90 bố cục, 30 ca chữ 200%, 6 bố cục modal, 14 nhóm hành vi và kiểm tra bổ sung; không suy thành kiểm chứng backend hay mọi thiết bị.
- Chưa kiểm máy thật/Safari/Firefox/Edge/screen reader/WCAG toàn diện hoặc có ACCEPT Claude; các skill pipeline UI/Sonnet chưa chạy. Không đưa tệp QA/ảnh vào tài nguyên sản phẩm.
## Xong thì chuyển cho: Claude
