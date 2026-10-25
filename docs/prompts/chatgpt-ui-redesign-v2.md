# Prompt cho ChatGPT: viết lại giao diện ứng dụng SGK (đợt UI v2)
Dán nguyên khối này cho ChatGPT. Trước hết đọc: AGENTS.md (mục F, I, J, K, L, N), `docs/design/` hiện có, `frontend/hoc/index.html`, `teacher.html`, `styles.css`.

## Vai trò và đầu ra
Bạn là nhà thiết kế UI/UX. Viết lại giao diện học sinh và giáo viên (mobile-first, chuẩn quốc tế, PWA) thành mockup tĩnh trong `docs/design/ui-v2/` (HTML + CSS + README + `self-check.md`), KHÔNG sửa `frontend/`, Worker hay logic. Antigravity sẽ ghép sau; Claude thẩm định.

## Ràng buộc bắt buộc
1. Cổng đầu tiên: chưa đăng nhập chỉ thấy màn chọn "Học sinh" / "Giáo viên"; không thấy bài học.
2. Giữ NGUYÊN toàn bộ id/name/type/autocomplete/pattern của biểu mẫu đăng nhập, đổi PIN, Cài đặt, hộp thoại `msg-dialog` (xem `docs/prompts/chatgpt-login-ui.md` và các id trong `index.html`/`teacher.html`). Không đổi tên id.
3. Chữ: tiếng Việt chuẩn, ngắn, không câu gợi ý rườm rà, không emoji, không lỗi dấu. PHÔNG: chỉ dùng `SGK Serif` (tự lưu trữ, `frontend/hoc/fonts/`, @font-face đã có trong `styles.css`) cho tiêu đề và phông hệ thống (`system-ui, "Segoe UI", Roboto`) cho nội dung. CẤM Georgia hoặc phông ngoài/CDN; mọi phông phải có đủ U+1EA0–1EF9 và hoạt động offline.
4. Mọi mockup phải chứa khối "kiểm chữ" với câu mẫu: "Thế giới kĩ thuật số; Ứng dụng điều khiển; ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự; ĐẶNG, ĐỖ, Ư, Ơ" và chụp ảnh ở 100% và 200% để chứng minh không tách dấu, không cắt chữ.
5. Chuẩn UI (AGENTS.md I): validate từng trường có lỗi dưới trường; loading "Đang …" cho mọi hành động; thông báo/xác nhận bằng `<dialog>`; mục tiêu chạm >= 48px; input 16px; tương phản AA; reduced-motion; focus rõ; căn lưới thống nhất; không style nội tuyến; màu qua biến CSS.
6. Menu Cài đặt theo mục K: điện thoại danh sách → chi tiết có Quay lại; màn rộng có điều hướng bên. Xác nhận thao tác theo mục J.
7. Học sinh không thấy bất cứ liên kết/giao diện giáo viên; giáo viên và học sinh là hai luồng tách biệt.
8. Kiểm tra: 360, 390, 768, 1280px; chữ 200%; chạy thật bằng Chrome, kèm ảnh chụp và danh sách lỗi đã sửa. Không khẳng định "đã kiểm Safari/Firefox/thiết bị thật" nếu chưa làm.

## Bàn giao
Viết `docs/handoff/chatgpt-antigravity-ui-v2.md` (≤1 trang theo mẫu AGENTS.md) rồi chuyển Claude thẩm định TRƯỚC khi ghép. Kết thúc: XONG … / TIẾP THEO → Claude / Dán cho họ: "Đọc AGENTS.md và docs/handoff/chatgpt-antigravity-ui-v2.md rồi làm theo."
