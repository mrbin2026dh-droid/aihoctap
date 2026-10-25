# Thẩm định giao diện giáo viên v3 (Claude, 25/10/2026) — ACCEPT CÓ ĐIỀU KIỆN (đợt A)
Nguồn: ChatGPT `docs/design/teacher-ui-v3/` (teacher.html, teacher.css, GHI_CHU.md). Đã ghép vào `frontend/hoc`.

## Đã kiểm
- Hợp đồng id/name: 59 id, 19 name giữ nguyên; thêm lại id cũ mà kiểm thử cần (`teacher-login-title`, `first-pin-title`, `first-pin-help`, `change-pin-section`, `regular-pin-title`).
- Kiểm thử hành vi mới `tests/test_teacher_shell.cjs` (máy tính 1280 và điện thoại 390): đăng nhập, menu 4 phân hệ, danh sách bài từ danh mục + tìm + lọc, mở bài, tab bàn phím (mũi tên/End), bảo vệ thay đổi chưa lưu (Hủy = ở lại), Kiểm tra chỉ xem thử và không lưu được, tài liệu (mã tự sinh, một yêu cầu), học sinh (tìm, chọn, khóa hàng loạt: Hủy = 0 yêu cầu, OK = 2 yêu cầu, thêm 1 lần), Hồ sơ → cài đặt → quay lại, đăng xuất, không cuộn ngang, không lỗi trang.
- Toàn bộ `tests/test_*.mjs` và 4 bộ `.cjs` đạt; dấu SW không đổi (`6d8ae02b…`).

## Lỗi tìm thấy khi ghép và đã sửa
1. `pattern="[a-z0-9][a-z0-9_-]{0,63}"` không hợp lệ với cờ `v` của Chrome → trình duyệt bỏ qua kiểm tra. Đổi thành `[a-z0-9_\-]` ở HTML và JS.
2. `inFlight`/`guarded` (chặn gửi trùng) khai báo BÊN TRONG `renderStudentsTable` → trạng thái mất mỗi lần vẽ lại. Đưa lên mức mô-đun.
3. Nút Hiện/Ẩn mã PIN ghi "Ấn" sai chính tả → "Ẩn".

## Chưa làm (cần máy chủ hoặc đợt sau) — ghi vào docs/bugs-mo.md
- Kiểm tra (đề, theo dõi, thống kê, xếp hạng): giao diện xem thử [THỬ], nút lưu/khóa/xóa bị vô hiệu; cần Worker + Firebase (bảo mật CAO).
- Danh sách tài liệu đã đăng: chưa có API đọc cho giáo viên; chỉ thêm mới.
- Mã học sinh tự nhập và Ghi chú học sinh: Worker chưa hỗ trợ trường; đã bỏ khỏi biểu mẫu để không giả lưu.
- Excel nhập/xuất/mẫu (học sinh, câu hỏi): chưa có thư viện đọc Excel tự lưu trữ; đã bỏ nút để không gây hiểu lầm.
- Nháp bài chỉ lưu trên máy (localStorage), xóa khi đăng xuất.
- Trình duyệt giữ teacher.js tới 10 phút (GitHub Pages) → cần chuỗi phiên bản cho trang giáo viên.
