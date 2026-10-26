# Kiểm định Bước A: Thanh chọn vai trò Giáo viên (.role-switch)
Từ: Antigravity → Sang: Claude   Ngày: 26/10/2026

## Mục tiêu
Kiểm định độc lập việc triển khai Bước A theo phán quyết `docs/handoff/claude-nguoidung-login-segmented.md`: thanh chọn vai trò link-based trên `teacher.html`, nút hiện PIN 48px, tương phản WCAG, và xử lý xóa dữ liệu khi quay lại bằng bfcache.

## Tệp cần đọc
- `docs/handoff/claude-nguoidung-login-segmented.md` (phán quyết gốc của Claude)
- `frontend/hoc/teacher.html` (dòng 24–27: `<nav class="role-switch">`, bỏ `.t-auth-back`)
- `frontend/hoc/teacher.css` (dòng 193–205: `.role-switch`, `.t-reveal` 48px; dòng 280–305: chế độ tối)
- `frontend/hoc/teacher.js` (dòng 625–640: listener `pageshow` xóa PIN và thông báo lỗi)
- `tests/test_role_switch_step_a.cjs` (bộ test tự động kiểm chứng 5 tiêu chuẩn của Claude)

## Kết quả đã đạt & Minh chứng kiểm thử thực tế
1. **Thanh chọn vai trò**: Dùng `<nav class="role-switch" aria-label="Chọn vai trò đăng nhập">` với 2 thẻ `<a>` (Học sinh `./` và Giáo viên `./teacher.html` có `aria-current="page"`). Nằm trong `#auth-section` nên tự động ẩn khi giáo viên đăng nhập hoặc khi vào màn đổi PIN đầu tiên.
2. **Kích thước & Điểm chạm**: Hai liên kết `.role-switch a` đạt `min-height: 48px`, font 16px; nút con mắt `.t-reveal` nâng lên `48x48px` (đạt chuẩn WCAG 2.2); nút Đăng nhập đạt `min-height: 56px`.
3. **Tương phản & Chế độ tối**:
   - Sáng: Đang chọn (trắng trên `#183e39` = 11.75:1), Không chọn (`#18302d` trên `#d8dfd8` = 10.31:1), Viền focus (8.65:1).
   - Tối: Đang chọn (trắng trên `#2f7a6b` = 5.10:1), Không chọn (`#d4d1c8` trên `#403f3b` = 6.90:1), Viền focus (`#93d4c3` trên `#403f3b` = 6.25:1). Tất cả $\ge 4.5:1$ cho chữ và $\ge 3:1$ cho viền focus.
4. **Bfcache (`pageshow`)**: Khi người dùng nhập PIN rồi bấm sang Học sinh rồi ấn Back, sự kiện `pageshow` (`event.persisted`) tự động xóa trắng ô PIN và xóa toàn bộ thông báo lỗi.
5. **Kiểm thử tự động thực tế (PASS 100%)**:
   - `node tests/test_role_switch_step_a.cjs`: PASS 5/5 nhóm tiêu chí (4 viewports + 360x360 không tràn ngang/không lồng cuộn, nút 48px, tương phản, bfcache, ẩn khi đăng nhập, dấu tiếng Việt).
   - `node tests/test_role_isolation.cjs`: PASS 4/4 kịch bản cách ly vai trò.
   - `node tests/test_focus_contrast_dark.cjs`: PASS tương phản viền focus.
   - `node tests/test_teacher_ui_standard.cjs`: PASS 0 vi phạm trên toàn bộ 8 cấu hình viewport.
   - `python tools/package_student_pwa.py --check`: PASS dấu shell SW.

## Ràng buộc tuân thủ
- Không sửa API/xác thực; không sửa tên `id`/`name`/`autocomplete`.
- Không gộp mã giáo viên vào trang học sinh, giữ nguyên cách ly vai trò (AGENTS.md mục N).
- Chưa triển khai Bước B (`index.html`) để chờ Claude kiểm định và duyệt Bước A trước.

## Xong thì chuyển cho
Người dùng (nếu Claude duyệt ACCEPT thì hướng dẫn tiếp tục triển khai Bước B).
