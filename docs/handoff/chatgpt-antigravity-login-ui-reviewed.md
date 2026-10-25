# Ghép mockup đăng nhập sau rà soát lần hai
Từ: ChatGPT → Sang: Antigravity   Ngày: 25/10/2026
## Mục tiêu
Dùng bản đã tinh gọn trong docs/design/login, thay bàn giao cũ chatgpt-antigravity-login-ui.md; chỉ ghép sau khi bộ tài khoản có ACCEPT Claude.
## Tệp cần đọc
- docs/design/login/review-summary.md
- docs/design/login/student-login.html, student-account.html, teacher-login.html, teacher-change-pin.html
- docs/design/login/login.css
- docs/prompts/chatgpt-login-ui.md (hợp đồng id/name)
## Kết quả mong đợi
- Ghép đúng 5 màn chính và các trạng thái; giữ id/name/type/autocomplete, logic tài khoản và kiểm thử cũ.
- Chạy kiểm tra hồi quy + responsive trên bản ghép; kiểm Safari/điện thoại thật khi có thiết bị, ghi giới hạn trung thực; chuyển Claude kiểm định.
## Ràng buộc / không được làm
- Bản mặc định đã bỏ tiêu đề phụ trùng và ẩn mẫu thử/cảnh báo không cần. Đừng đưa chữ kiểm thử hoặc thư viện trạng thái vào luồng học sinh/giáo viên.
- #design-states chỉ để xem mẫu lỗi; #change-pin-section xem đổi PIN thường. Thay cơ chế fragment bằng trạng thái thật khi ghép.
- account-must-change đang hidden; chỉ hiện theo trạng thái tài khoản thật. Thông báo lỗi không được bỏ; nối từng lỗi vào vùng status tương ứng.
- method="dialog" chỉ cho bản mẫu; giữ submit handler thực của ứng dụng. Phải dùng cơ chế modal/focus thật của ứng dụng; chưa kiểm focus trap bằng bản mẫu open tĩnh.
- Scope CSS vào giao diện tài khoản, không chép các selector toàn cục để ảnh hưởng toàn ứng dụng; không ghép JS thử nghiệm hoặc review-ui.cjs.
- Chrome PASS 85 bố cục +20 ca chữ 200%, keyboard/focus/DOM/Hiện-Ẩn. Edge không khởi động được; chưa kiểm Safari, điện thoại thật, screen reader hoặc WCAG toàn diện; chưa có ACCEPT bộ UI.
- self-check.md/ảnh *-360.png là lịch sử trước rà soát; ưu tiên review-summary.md, review-checks.json và ảnh review-* của lần cuối. Skill pipeline UI/Sonnet chưa chạy trong phiên soạn mockup.
## Xong thì chuyển cho: Claude
