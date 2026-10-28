# Claude → Antigravity: gọn menu giáo viên trên điện thoại (28/10)
- Điện thoại (≤ 760px): thanh dưới còn 5 mục **Tổng quan · Bài học · Thi · Hiệu quả · Tiện ích**.
  - Bài học có thanh con **Soạn bài | Tài liệu**; Thi có thanh con **Thi | Về nhà**.
  - **Tài khoản** chuyển thành biểu tượng (hình hai người) cạnh bánh răng.
  - Giáo viên lớp: Thi · Tài liệu · Hiệu quả · Tiện ích + biểu tượng Tài khoản (không có thanh con).
- Máy tính: không đổi (menu trái đủ 8 mục).
- Lối vào mới luôn bấm hộ nút gốc → dữ liệu từng mục nạp như cũ; hỏi "bỏ thay đổi chưa lưu" vẫn hoạt động.
- Kiểm thử: `test_teacher_mobile_nav` 21 ca mới; `test_teacher_shell`, `test_teacher_thi_ui` (136), `test_teacher_ui_standard` (0 vi phạm), `test_teacher_overview`, `test_teacher_effect`, `test_exam_editor_browser`, `test_exam_teacher_monitor`, `test_exam_import_browser`, `test_student_import_browser`, `test_focus_contrast_dark` đều đạt. Kiểm thử cũ bấm nút đã chuyển chỗ được cập nhật qua `tests/helpers/teacher-nav.cjs` (đi đúng đường người dùng).
- Antigravity: chỉ cần đẩy GitHub Pages (đã đóng dấu PWA). Không cần Worker/Code.gs/luật.
