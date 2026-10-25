# Hoàn thành sửa UI đăng nhập và tài khoản theo điều kiện U1–U6
Từ: Antigravity → Sang: Claude   Ngày: 2026-10-25 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Hoàn thành toàn diện 6 điều kiện U1–U6 theo `docs/handoff/claude-antigravity-login-ui-fix.md` và AGENTS.md mục I (Quy tắc giao diện UI): hộp thoại dùng chung `<dialog id="msg-dialog">`, trạng thái tải `withBusy`, validate trường `setFieldError`, thông điệp tiếng Việt thân thiện, dọn sạch emoji và inline styles, bộ test hành vi T-a..T-e.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `frontend/hoc/dom.js` (`dialogBox`, `confirmBox`, `noticeBox`, `withBusy`, `setFieldError`, `mapErrorMessage`)
- `frontend/hoc/index.html` (Màn học sinh đăng nhập, tài khoản, cấu trúc `<dialog id="msg-dialog">`)
- `frontend/hoc/teacher.html` (Màn giáo viên đăng nhập, đổi PIN, cấu trúc `<dialog id="msg-dialog">`)
- `frontend/hoc/styles.css` (Biến `--danger`, CSS scoped cho `.msg-dialog`, `.field-error`, v.v.)
- `frontend/hoc/app.js` (Validate regex, `withBusy`, `setFieldError`, xóa lỗi khi nhập `input`, 0 emoji)
- `frontend/hoc/teacher.js` (Triệt tiêu 6 chỗ `confirm/prompt/alert`, thay bằng `confirmBox/dialogBox`, `withBusy`, `aria-busy`)
- `tests/test_login_ui.mjs` (13 ca test hợp đồng & hành vi T-a, T-b, T-c, T-d, T-e)
- `tests/test_frontend_outbox_regression.mjs` (Assert hợp đồng outbox với `frontend/hoc/app.js`)

## Kết quả đạt được theo từng điều kiện U1–U6
1. **U1 — Hộp thoại modal dùng chung (`<dialog id="msg-dialog">`)**:
   - Khai báo cấu trúc HTML chuẩn accessible trong cả `index.html` và `teacher.html`.
   - Xuất các hàm `dialogBox`, `confirmBox`, `noticeBox` trong `frontend/hoc/dom.js`.
   - Thay thế triệt để toàn bộ 6 vị trí `window.confirm`, `window.prompt`, `window.alert` trong `frontend/hoc/teacher.js`: xóa khóa API, sửa tên/lớp học sinh, đặt lại mã PIN, khóa/mở khóa học sinh, xóa học sinh.
2. **U2 — Trạng thái đang xử lý (`withBusy`)**:
   - Hàm `withBusy(btn, busyText, fn)` tự động thiết lập `disabled=true`, `aria-busy="true"`, đổi nhãn thành `"Đang đăng nhập…"`, `"Đang đổi mã PIN…"`, `"Đang tạo học sinh…"`, và khôi phục nhãn gốc trong khối `finally`.
   - Thiết lập `aria-busy` và nhãn đang tải cho danh sách học sinh và danh sách khóa Gemini khi nạp dữ liệu.
3. **U3 — Báo lỗi theo trường (`setFieldError`)**:
   - Tự động gán/xóa phần tử lỗi `.field-error[role=alert]`, thiết lập `aria-invalid="true"`, `aria-describedby`.
   - Lắng nghe sự kiện `input` trên tất cả các ô nhập liệu để xóa lỗi ngay khi người dùng gõ.
   - Kiểm tra mã học sinh regex `/^[A-Za-z0-9_-]{1,64}$/`, mã PIN học sinh $\ge 6$, giáo viên $\ge 8$, kiểm tra khớp mật khẩu và khác mật khẩu cũ. Tự động `focus()` vào trường lỗi đầu tiên.
4. **U4 & U6 — Sạch giao diện & Anti-slop**:
   - Xóa bỏ 100% thuộc tính `style="..."` nội tuyến trong các khối đăng nhập/tài khoản; chuyển sang các lớp CSS có scoping rõ ràng trong `styles.css`.
   - Triệt tiêu hoàn toàn biểu tượng cảm xúc `💡` (thay bằng chữ "Hỏi gợi ý AI") và ký tự `✕` (thay bằng chữ "Đóng").
5. **U5 — Bản địa hóa văn bản tiếng Việt chuẩn mực**:
   - Hàm `mapErrorMessage` chuẩn hóa thông điệp lỗi: `INVALID_CREDENTIALS` ("Mã học sinh hoặc mã PIN chưa đúng."), `ACCOUNT_DISABLED` ("Tài khoản đang bị khóa. Liên hệ giáo viên."), `TEACHER_PIN_CHANGE_REQUIRED` ("Cần đổi mã PIN trước khi tiếp tục."), ngoại tuyến ("Không có kết nối mạng.").
   - Sửa `aria-label` thành "Hiện hoặc ẩn mã PIN". Bỏ `inputmode="numeric"` trên các trường PIN để hỗ trợ ký tự chữ-số.
6. **Kiểm thử thực tế (T-a đến T-e)**:
   - `tests/test_login_ui.mjs`: Chạy thực tế 13/13 kịch bản PASS 100%, bao gồm:
     - T-a: Mã học sinh chứa khoảng trắng (`a b`) bị bắt lỗi tại trường, không gọi API.
     - T-b: Trạng thái `withBusy` thiết lập đúng `disabled`, `aria-busy`, nhãn và khôi phục sau khi hoàn tất.
     - T-c: Xóa học sinh mở `dialogBox`, `window.confirm` tuyệt đối không bị gọi (gọi sẽ văng stub error); Hủy không gọi API; Đồng ý gọi API DELETE đúng 1 lần.
     - T-d: Quét tĩnh 100% file trong `frontend/hoc/` đảm bảo 0 `confirm/prompt/alert`, 0 `💡`, 0 `✕`.
     - T-e: Kiểm định nghiêm ngặt các quy tắc PIN (<6, không khớp, trùng cũ).
   - `tests/test_frontend_outbox_regression.mjs`: Chạy 6/6 kịch bản PASS 100%.
   - Toàn bộ 15 bộ test suites của dự án PASS 100%.
   - `npx oxlint` báo 0 lỗi, 0 cảnh báo (Finished on 33 files with 0 warnings, 0 errors).
   - `node --check` kiểm tra cú pháp tất cả file JS đạt PASS.
   - Quét bí mật rỗng trên toàn bộ git diff.

## Ràng buộc / Không được làm
- TUYỆT ĐỐI KHÔNG tự ý deploy lên Worker / GitHub Pages hoặc push git trước khi có phán quyết ACCEPT từ Claude (AGENTS.md G.1).
- KHÔNG in bí mật, PIN hay token vào log/chat/Git (AGENTS.md G.5 & H.1).

## Xong thì chuyển cho: Claude
Dán cho họ: "Đọc AGENTS.md và docs/handoff/antigravity-claude-login-ui.md rồi làm theo."

## Bổ sung từ người dùng — 25/10/2026 (ChatGPT ghi nhận, không thay báo cáo Antigravity)
- Trước các thao tác giáo viên như xóa, khóa/mở khóa, đặt lại mã PIN hoặc thay đổi quan trọng tương tự phải có xác nhận chủ động để tránh nhầm; thông báo sau xử lý không thay thế bước này.
- Claude đọc thêm docs/design/teacher-action-confirmation.md và docs/handoff/chatgpt-claude-teacher-confirmation.md, kiểm từng hành vi Hủy/Esc/đồng ý/gửi lặp và đúng đối tượng; không suy từ riêng ca xóa sang mọi thao tác.
- Đây là yêu cầu mới cần kiểm, chưa có kết quả kiểm thử hay ACCEPT cho phần bổ sung trong phiên ghi nhận này.
