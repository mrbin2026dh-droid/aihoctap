# Hoàn thành ghép menu Cài đặt/Quản lý thích ứng và xác nhận thao tác (AGENTS.md J & K)
Từ: Antigravity → Sang: Claude   Ngày: 2026-10-25 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Hoàn thành ghép thiết kế menu Cài đặt/Quản lý thích ứng cho cả Giáo viên và Học sinh theo AGENTS.md mục J–K và `docs/handoff/chatgpt-antigravity-settings-menu.md`: giữ không gian làm việc chính thoáng, tổ chức cài đặt theo nhóm có điều hướng thích ứng (mobile nhóm → chi tiết có Quay lại, desktop sidebar 2 cột), thu gọn thao tác đối tượng học sinh vào menu `details.row-actions`, xác nhận chủ động mọi thao tác phá hủy (0 request khi Hủy/Esc, 1 request khi Đồng ý, có trạng thái busy), bảo vệ nháp dirty settings.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `frontend/hoc/teacher.html` & `frontend/hoc/teacher.js` (Phân nhóm Cài đặt giáo viên, `#workspace` tách biệt `#settings`, thu gọn thao tác học sinh)
- `frontend/hoc/index.html` & `frontend/hoc/app.js` (Cài đặt học sinh thích ứng `#settings`, `#panel-account`, `#panel-offline`, `#panel-help`)
- `frontend/hoc/styles.css` (CSS responsive cho `.settings-layout`, `.settings-menu`, `.row-actions`, media query 959px/960px)
- `frontend/hoc/dom.js` (Bổ sung bẫy Tab/Shift+Tab focus trap trong `dialogBox`)
- `tests/test_settings_menu.mjs` (Bộ test kiểm thử 8 kịch bản DOM & hành vi J & K)

## Kết quả đạt được theo từng yêu cầu
1. **Phân nhóm Cài đặt Giáo viên (`teacher.html`, `teacher.js`)**:
   - Vùng làm việc chính (`#workspace`): Giữ nguyên công việc thường dùng (Bài học, Soạn bài `#publish-form`, Kết quả `#teacher-results`, Tài liệu Google Drive `#materials-section`, Quản lý lớp & học sinh `#students-section`).
   - Cài đặt hệ thống (`#settings`): Tổ chức thành 2 nhóm rõ ràng:
     - **Cá nhân**: `account` (Thông tin giáo viên & form Đổi mã PIN `#change-pin-section`).
     - **Cài đặt AI**: `quota` (Hạn mức & chế độ thi `#ai-usage-section`), `keys` (Bể khóa Gemini API `#keys-section`).
   - Nút `#open-settings` trên topbar mở/đóng Cài đặt với `aria-expanded`, nút `#close-settings` quay lại `#workspace` kèm khôi phục vị trí cuộn `workScroll`.
2. **Thu gọn thao tác học sinh & Xác nhận theo AGENTS.md mục J**:
   - Trong bảng học sinh, 4 nút thao tác (Sửa, Đặt lại PIN, Khóa/Mở, Xóa) được thu gọn trong `<details class="row-actions"><summary>Thao tác</summary><div class="action-list">...</div></details>`, có nhãn ẩn hỗ trợ bộ đọc màn hình (`.visually-hidden`).
   - Tự động đóng menu thao tác trước khi mở modal xác nhận, tự động đóng các `details` khác khi mở một cái mới.
   - Thao tác xóa học sinh, khóa/mở khóa, đặt lại PIN, xóa khóa API dùng `confirmBox`: tiêu đề cụ thể ("Xóa học sinh?", "Khóa tài khoản?", "Đặt lại mã PIN?", "Xóa khóa API?"), mặc định focus "Hủy", Hủy/Esc = 0 request, Đồng ý = đúng 1 request, có `withBusy`/`aria-busy`.
3. **Bảo vệ nháp cài đặt (Draft protection)**:
   - Khi chỉnh sửa hạn mức AI mà chưa lưu (`quotaDirty = true`), chuyển tab cài đặt hoặc bấm "Về quản lý lớp" sẽ kích hoạt xác nhận "Bỏ thay đổi chưa lưu?". Hủy giữ nguyên vị trí, Đồng ý reset form và chuyển view.
4. **Cài đặt thích ứng cho Học sinh (`index.html`, `app.js`)**:
   - Bổ sung nút `#open-settings` trên topbar, tích hợp mượt mà với `#account`.
   - Giao diện `#settings` với 3 nhóm:
     - `account`: Tài khoản học sinh, mã PIN, đăng xuất.
     - `offline`: Tải ngoại tuyến, danh sách bài đã lưu, nút "Xóa bản tải" có xác nhận chủ động ("Xóa bản tải?", cảnh báo cần mạng để tải lại).
     - `help`: Hướng dẫn học ngoại tuyến và dùng gia sư AI Socrates.
5. **Khả năng thích ứng thiết bị (Responsive K)**:
   - Dưới 960px (Mobile): danh sách nhóm một cột; chọn nhóm mở chi tiết kèm nút "Quay lại Cài đặt" (`data-back`).
   - Từ 960px (Desktop): Grid 2 cột (sidebar 240px bên cạnh panel chi tiết), ẩn nút Quay lại.
   - Quản lý focus: khi mở/đóng dialog, chuyển view, focus được chuyển và trả về đúng ngữ cảnh, Tab/Shift+Tab được giữ trong modal.
6. **Kiểm thử thực tế**:
   - `tests/test_settings_menu.mjs`: Chạy thực tế 8/8 tests PASS 100%.
   - `tests/test_login_ui.mjs`: Chạy 13/13 tests PASS 100%.
   - Toàn bộ 16 bộ test suites của dự án (`tests/test_*.mjs`) PASS 100%.
   - `npx oxlint`: 0 warnings, 0 errors trên toàn bộ 37 files.
   - `node --check`: sạch toàn bộ các file JS.
   - Quét bí mật rỗng trên toàn bộ git diff.

## Ràng buộc / Không được làm
- TUYỆT ĐỐI KHÔNG tự ý deploy lên Worker / GitHub Pages hoặc push git trước khi có phán quyết ACCEPT từ Claude (AGENTS.md G.1).
- KHÔNG in bí mật, PIN hay token vào log/chat/Git (AGENTS.md G.5 & H.1).

## Xong thì chuyển cho: Claude
Dán cho họ: "Đọc AGENTS.md và docs/handoff/antigravity-claude-settings-menu.md rồi làm theo."
