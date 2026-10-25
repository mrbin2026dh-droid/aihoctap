# Lệnh cho ChatGPT: thiết kế giao diện đăng nhập và tài khoản (mockup HTML/CSS tĩnh)
Người dùng dán nguyên khối dưới đây vào ChatGPT (kèm đính kèm `frontend/hoc/styles.css`, `index.html`, `teacher.html` nếu ChatGPT cho phép; nếu không, bỏ qua, mã màu đã ghi sẵn). ChatGPT chỉ trả HTML/CSS, không vẽ ảnh. Tệp kết quả lưu vào `docs/design/login/`; sau đó Antigravity ghép vào ứng dụng, Claude kiểm tra.

---
## BẮT ĐẦU PROMPT

Bạn là nhà thiết kế giao diện sản phẩm (UI/UX) cho ứng dụng PWA học tập của học sinh THCS Việt Nam, dùng điện thoại là chính. Hãy thiết kế **các màn hình đăng nhập và tài khoản** dưới dạng **mockup HTML + CSS tĩnh** (không backend). Chỉ làm đúng phạm vi bên dưới, không thiết kế phần khác của ứng dụng.

### 1. Phạm vi (6 màn hình)
1. **Học sinh đăng nhập** (mở trên trang học).
2. **Học sinh: Tài khoản** (đã đăng nhập: tên, lớp, đổi mã PIN, đăng xuất).
3. **Giáo viên đăng nhập.**
4. **Giáo viên: bắt buộc đổi mã PIN lần đầu** (che hết mục khác cho đến khi đổi xong).
5. **Giáo viên: cài đặt đổi mã PIN** (khối nhỏ nằm trong trang quản lý).
6. **Các trạng thái lỗi** của màn 1 và 3 (mục 5).

### 2. Nguyên tắc thiết kế
- Mobile-first: thiết kế ở 360×640 trước, rồi 768 và 1280. Không cuộn ngang. Khoảng cách lề 16–20px.
- Chuẩn quốc tế: tương phản chữ/nền WCAG AA (≥ 4.5:1), vùng chạm ≥ 48px, trạng thái focus nhìn thấy rõ, nhãn `<label>` thật, `aria-live`/`role="alert"` cho lỗi, hỗ trợ `prefers-reduced-motion`, kích thước chữ nhập liệu ≥ 16px (tránh iOS tự phóng to).
- Rất ít icon: **không dùng emoji, không bộ icon**. Chỉ chữ, một nút "Hiện/Ẩn" cho ô mã PIN, và wordmark chữ "sgk". Câu chữ tiếng Việt ngắn, đời thường, không rườm rà; xưng "em" với học sinh.
- Tông giao diện hiện có (giữ để đồng bộ): nền `#f5f4ef`, bề mặt `#fffefa`, chữ chính `#18302d`, chữ phụ `#536762`, nhấn `#183e39`, đường viền `#d8dfd8`; wordmark kiểu serif (Georgia) chữ thường "sgk" + dòng nhỏ "GÓC HỌC TẬP". Phông hệ thống `system-ui`. Bo góc 8px. Đẹp, tinh gọn, nhiều khoảng thở; không gradient lòe loẹt.
- Màu lỗi/cảnh báo/thông tin chỉ dùng kèm chữ (không dựa mỗi màu).

### 3. Ràng buộc kỹ thuật (BẮT BUỘC, vì lập trình viên sẽ gắn logic vào)
- Giữ NGUYÊN các `id`, `name`, `type`, `autocomplete` ghi dưới đây. Có thể thêm class tùy ý; không đổi id/name.
- Tệp: `student-login.html`, `student-account.html`, `teacher-login.html`, `teacher-change-pin.html`, và **một** tệp `login.css` dùng chung (biến màu khai báo ở `:root`). Không dùng thư viện/CDN/phông ngoài/JS framework. JS chỉ tối đa vài dòng cho nút Hiện/Ẩn mã PIN, không gọi mạng.
- Mỗi màn hình hợp lệ HTML5, có `<meta name="viewport" content="width=device-width, initial-scale=1">`, `lang="vi"`.

**Màn 1 – Học sinh đăng nhập** (hộp thoại `<dialog id="login-dialog" aria-labelledby="login-title">`):
`h2#login-title` "Vào góc học tập" · `p#login-help` "Dùng mã học sinh và mã PIN do giáo viên cấp." · `form#login-form` gồm `input[name=code]` (autocomplete=username, pattern `[A-Za-z0-9_-]{1,64}`, nhãn "Mã học sinh") · `input[name=pin][type=password]` (autocomplete=current-password, inputmode=numeric, maxlength 16, nhãn "Mã PIN") · nút submit `.primary` "Vào học" · `p#login-error[role=alert]` · nút `#close-login` "Đóng".
**Màn 2 – Tài khoản học sinh**: `div#account-info` (ví dụ "Nguyễn Văn An · Lớp 9A") · `div#account-must-change` "Hãy đổi mã PIN do giáo viên cấp để bảo mật tài khoản." (ẩn/hiện) · `form#student-change-pin-form` với `input[name=old_pin]`, `input[name=new_pin]` (minlength 6), `input[name=confirm_pin]`, nút "Lưu mã PIN mới", `p#student-change-pin-status[role=alert]` · nút `#logout` "Đăng xuất".
**Màn 3 – Giáo viên đăng nhập**: `section#auth-section` > `form#teacher-login` > `input[name=pin][type=password]` (autocomplete=current-password, nhãn "Mã PIN giáo viên") + nút `.primary` "Đăng nhập giáo viên".
**Màn 4 – Bắt buộc đổi PIN**: `section#teacher-must-change-section` > `form#teacher-must-change-form` với `input[name=old_pin]` ("Mã PIN hiện tại"), `input[name=new_pin]` ("Mã PIN mới (tối thiểu 8 ký tự)", minlength 8, autocomplete=new-password), `input[name=confirm_pin]` ("Nhập lại mã PIN mới") + nút "Đổi mã PIN và tiếp tục" + `p#teacher-must-change-error[role=alert]`. Có dòng giải thích 1 câu: "Đây là lần đăng nhập đầu. Hãy đặt mã PIN riêng của thầy/cô."
**Màn 5 – Đổi PIN thường**: `section#change-pin-section` > `form#teacher-regular-change-pin-form` (cùng 3 ô như màn 4) + `p#teacher-change-pin-status[role=alert]`.

### 4. Gợi ý bố cục
Màn 1 và 3: thẻ giữa màn hình, wordmark phía trên, một cột, nút chính rộng tối đa, liên kết "Đóng" phụ. Màn 4: nhấn mạnh đây là bước bắt buộc nhưng giọng nhẹ nhàng, hiển thị gợi ý độ mạnh mã PIN bằng chữ ("Chưa đủ 8 ký tự"/"Đủ dài") không chỉ bằng màu. Desktop: thẻ rộng ≤ 420px canh giữa.

### 5. Các trạng thái phải minh họa (bằng class `.is-error`, `.is-loading`… hoặc khối ví dụ ở cuối tệp)
- Mặc định, focus, đang gửi (nút đổi chữ "Đang vào…", `disabled`), lỗi sai mã: "Mã học sinh hoặc PIN không chính xác."
- Bị tạm khóa do sai nhiều lần: "Nhập sai 5 lần. Tài khoản bị tạm khóa 60 giây." (kèm đếm ngược giả "Thử lại sau 00:59").
- Tài khoản bị khóa bởi giáo viên: "Tài khoản đang bị khóa. Hãy liên hệ giáo viên."
- Mất mạng: "Chưa có mạng. Em cần mạng để đăng nhập."
- Đổi PIN: "Hai mã PIN mới chưa khớp.", "Mã PIN mới phải khác mã cũ.", thành công "Đã đổi mã PIN."

### 6. Cách trả lời
1) 3–5 dòng nêu lý do các quyết định thiết kế chính (không dài dòng). 2) Mã đầy đủ từng tệp trong khối riêng, ghi tên tệp phía trên. 3) Bảng tự kiểm: tương phản các cặp màu chính (tỷ lệ), kích thước nút, danh sách id/name đã giữ nguyên. Không giải thích thêm.

### 7. Xác nhận thao tác giáo viên — yêu cầu bổ sung 25/10/2026
Khi thiết kế thao tác xóa, khóa/mở khóa, đặt lại mã PIN, thay đổi quyền hoặc thao tác hàng loạt, bắt buộc minh họa hộp thoại xác nhận trước khi thực hiện. Nêu rõ đối tượng/phạm vi, hậu quả; có "Hủy" và nút gọi đúng hành động, focus mặc định "Hủy". Hủy/Esc/đóng không thay đổi dữ liệu; chỉ gửi yêu cầu sau đồng ý chủ động, chống gửi lặp, có trạng thái tải/lỗi. Không dùng hộp thoại trình duyệt; không dùng thông báo thành công thay xác nhận. Tuân thủ docs/design/teacher-action-confirmation.md khi thiết kế và tự kiểm. Áp dụng khi mở rộng giao diện giáo viên; không thêm màn quản lý ngoài phạm vi tác vụ hiện tại chỉ để minh họa yêu cầu này.

### 8. Tổ chức menu hệ thống — yêu cầu bổ sung 25/10/2026
Chức năng hệ thống nhiều thao tác phải được phân nhóm trong menu Cài đặt/Quản lý, chỉ mở nội dung khi cần theo docs/design/adaptive-settings-menu.md. Giữ tác vụ chính dễ truy cập, không bày toàn bộ form/nút quản trị lên màn làm việc. Mobile dùng danh sách nhóm và trang chi tiết có Quay lại; màn rộng có thể dùng danh sách bên cạnh nội dung. Không thêm menu vào màn đăng nhập hoặc bước đổi PIN bắt buộc; chỉ áp dụng trong các màn tài khoản/quản lý thuộc phạm vi được giao. Xác nhận xóa/khóa ở mục 7 vẫn bắt buộc. Khi được giao thiết kế menu riêng, dùng docs/prompts/chatgpt-settings-menu.md.

## KẾT THÚC PROMPT
---
## Sau khi ChatGPT trả kết quả
1. Người dùng lưu tệp vào `docs/design/login/` (không ghép vào `frontend/hoc` ngay).
2. Nhờ Antigravity: "Đọc AGENTS.md và docs/prompts/chatgpt-login-ui.md; ghép thiết kế trong docs/design/login/ vào frontend/hoc (giữ id/name/logic, không đổi JS ngoài class), chạy test, báo cáo."
3. Claude kiểm: id/name còn nguyên, test cũ xanh, tương phản/cỡ chạm, không emoji, không hồi quy logic đăng nhập.
