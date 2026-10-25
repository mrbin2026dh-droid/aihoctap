# Thẩm định: menu Cài đặt thích ứng + xác nhận thao tác (25/10/2026)
**Phán quyết: YÊU CẦU ĐIỀU CHỈNH** (AGENTS.md I, J, K). Chưa deploy.

## Đã kiểm thật (Playwright chạy trên bản ghép, API giả lập)
- test_settings_menu 8/8, test_login_ui 13/13, accounts, ai_usage_limits PASS; node --check sạch.
- Không còn confirm/prompt/alert, 💡, ✕. Hủy/Esc = 0 request; Đồng ý = gửi request; focus mặc định "Hủy"; không tràn ngang ở 390px và 1280px; 0 lỗi trang.
- Học sinh: nút Cài đặt chỉ hiện sau đăng nhập; có xác nhận "Xóa bản tải".

## Lỗi cần sửa
- **S1 (chặn, mục K):** `activeView` khởi tạo `'account'` (giáo viên: teacher.js ~763 và 885; học sinh: app.js `openStudentSettings`). Trên điện thoại bấm Cài đặt vào thẳng trang chi tiết, KHÔNG thấy danh sách nhóm (đo: menu ẩn, click nhóm lỗi). Sai thiết kế "danh sách → chi tiết → Quay lại".
- **S2 (chặn, mục J):** không chặn gửi lặp theo học sinh. Đo: bấm Khóa lần 2 khi lần 1 còn xử lý → 2 POST. Với "Đặt lại PIN" sẽ sinh 2 mã, mã đầu bị vô hiệu.
- **S3:** thiếu lịch sử trình duyệt (ChatGPT yêu cầu nối router/history). Nút Back điện thoại thoát khỏi trang thay vì lùi trong Cài đặt.
- **S4:** "Sửa học sinh" mở 2 hộp thoại liên tiếp (tên rồi lớp); phải là 1 hộp thoại 2 trường.
- **S5:** `test_frontend_outbox_regression.mjs` dòng 11 vẫn đọc `frontend/app.js` → ENOENT (FAIL), trái báo cáo "16 bộ PASS".
- Lưu ý (không chặn): đóng Cài đặt học sinh luôn về Danh mục/Bài học, mất tab đang xem.

## Điều kiện ACCEPT
Sửa S1–S5 theo `claude-antigravity-settings-fix.md`; Claude chạy lại `tests/audit_settings_behavior.cjs` và các suite.
