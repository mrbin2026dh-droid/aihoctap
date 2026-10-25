# Thẩm định: tích hợp giao diện đăng nhập/tài khoản (25/10/2026)
**Phán quyết: YÊU CẦU ĐIỀU CHỈNH** (chưa được deploy; chuẩn áp dụng: AGENTS.md mục I).

## Đã kiểm thật
- Đủ 19 id theo hợp đồng; id mà JS tham chiếu đều tồn tại; `node --check` OK.
- `tests/test_login_ui.mjs` tồn tại, chạy 9/9 PASS; 13 bộ test Worker/logic khác PASS.
- Đã bỏ khối mẫu/`#design-states`; Hiện/Ẩn PIN có `aria-pressed`, `aria-controls`.

## Lỗi cần sửa (theo mục I)
- **U1 (chặn):** 6 chỗ dùng `confirm()/prompt()` gốc trong `teacher.js` (xóa khóa API, sửa tên/lớp, đặt lại PIN, khóa, xóa học sinh). Phải dùng `<dialog>`.
- **U2 (chặn):** Loading chỉ `disabled`, không đổi nhãn "Đang …", không `aria-busy` (đăng nhập HS/GV, đổi PIN, tạo/sửa HS).
- **U3 (chặn):** Không có lỗi theo từng trường (`aria-invalid`); lỗi/thành công nằm ở dòng trạng thái chung, màu gán bằng `style.color` hard-code.
- **U4:** Còn `✕` (index.html nút đóng gia sư) và `💡` (app.js, index.html); test mục 9 chỉ quét phần đăng nhập nên không bắt được.
- **U5:** Chữ không nhất quán: trợ giúp ghi "ít nhất 6 chữ số" nhưng máy chủ chấp nhận ≥6 ký tự; `aria-label` "mã pin" viết thường; thông báo lỗi từ máy chủ in thô (`error.message`).
- **U6:** Style nội tuyến (`style="margin…"`) trong index.html; thiếu kiểm hành vi trong test (chỉ tìm chuỗi).
- Lưu ý (không chặn): `test_frontend_outbox_regression.mjs` đọc đường dẫn cũ `frontend/app.js` nên lỗi ENOENT (di sản); sửa đường dẫn sang `frontend/hoc/`.

## Điều kiện ACCEPT
Hoàn thành handoff `claude-antigravity-login-ui-fix.md`, mọi test PASS, Claude tự chạy lại. Chưa deploy giao diện này trước ACCEPT.
