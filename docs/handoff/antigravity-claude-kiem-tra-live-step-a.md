# Báo cáo kiểm tra live Bước A đăng nhập & Hướng dẫn test trên điện thoại thật
Từ: Antigravity → Sang: Claude và Người dùng   Ngày: 26/10/2026

## Mục tiêu
Báo cáo kết quả kiểm thử sau khi pull commit `d0c1e00`, xác nhận GitHub Pages đã deploy thành công, và cung cấp các bước kiểm thử trên điện thoại thật (Android + iPhone Safari).

## Tệp liên quan
- `docs/handoff/claude-antigravity-login-segmented-stepa.md` (chỉ đạo của Claude)
- `tests/test_role_switch.cjs` (235 checks)
- `tests/test_role_isolation.cjs` (4 checks)
- Live URL: `https://mrbin2026dh-droid.github.io/aihoctap/`
- Ảnh chụp kiểm thử lưu tại: `docs/design/login-segmented/screenshots/`

## Kết quả kiểm thử tự động & Trạng thái triển khai
1. **Đồng bộ mã nguồn**: Đã chạy `git pull origin main` cập nhật commit `d0c1e00`.
2. **Kiểm tra tự động nội bộ**:
   - `test_role_switch.cjs`: **ALL 235 ROLE SWITCH CHECKS PASSED** (4 viewports × 2 theme sáng/tối, vùng chạm ≥48px, tương phản ≥4.5:1, viền focus ≥3:1, Back bfcache, cách ly vai trò, không tràn ngang).
   - `test_role_isolation.cjs`: **ALL 4 ROLE ISOLATION TESTS PASSED** (phiên học sinh/giáo viên cách ly tuyệt đối).
   - `package_student_pwa.py --check`: **PASS** dấu shell PWA `aisgk-student-shell-bfbb64396c2b8e7511d1bca8`.
3. **Triển khai GitHub Pages**:
   - GitHub Actions workflow `deploy-pages.yml` (run id `40300872037`) đã hoàn thành thành công trong 22s.
   - Live URL `https://mrbin2026dh-droid.github.io/aihoctap/` đã nạp mã mới từ commit `d0c1e00`.
4. **Kiểm tra live qua Playwright (giả lập Mobile Safari iPhone 390×844)**:
   - Cổng học sinh: bấm "Đăng nhập" → thanh vai trò `<nav class="role-switch">` hiển thị chuẩn.
   - Bấm "Giáo viên" → chuyển sang `teacher.html`, thanh vai trò hiển thị chuẩn với nút xanh trầm đồng bộ.
   - Bấm "Học sinh" → điều hướng về lại cổng học sinh.
   - Thử nghiệm bfcache: gõ PIN học sinh → chuyển sang Giáo viên → gõ PIN giáo viên → bấm nút Back trình duyệt: cả hai trang đều tự động xóa trắng ô PIN (giá trị `""`), không còn lưu dấu vết mã cũ.

## Hướng dẫn Người dùng kiểm tra trên điện thoại thật
1. Dùng điện thoại (Android qua Chrome và iPhone qua Safari) mở link:
   `https://mrbin2026dh-droid.github.io/aihoctap/`
2. Bấm nút **"Đăng nhập"**:
   - Quan sát thanh vai trò `Học sinh | Giáo viên`.
   - Bấm sang **"Giáo viên"**: trang giáo viên mở ra.
   - Bấm sang **"Học sinh"**: quay lại cổng học sinh.
3. Thử nghiệm nhập PIN và Back:
   - Nhập vài ký tự vào ô PIN.
   - Chuyển sang vai trò kia rồi bấm nút Back của trình duyệt.
   - Kiểm tra ô PIN xem đã tự xóa trống hay chưa.
4. Báo lại kết quả (hoặc kèm ảnh chụp nếu có phát hiện lỗi hiển thị trên thiết bị thực tế).

## Không làm
- Chưa can thiệp vào Bước B (bỏ `#gate`) khi người dùng và Claude chưa có chỉ thị.
- Không sửa đổi API hoặc logic xác thực.

## Tiếp theo
Chuyển cho: **Người dùng** (thử nghiệm trên điện thoại thật) và **Claude** (kiểm định chất lượng để chốt Bước A).
