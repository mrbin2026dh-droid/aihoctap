# Bàn giao kiểm thử thiết bị thật Bước A thanh chọn vai trò
Từ: Antigravity → Sang: Người dùng & Claude   Ngày: 26/10/2026

## Mục tiêu
Báo cáo hoàn tất toàn bộ yêu cầu từ phán quyết `docs/handoff/claude-antigravity-login-step-a-accept.md`: đồng bộ commit chuẩn của Claude (`72d1d3e`), kiểm thử tự động toàn bộ xanh 100%, đồng bộ toàn bộ tài liệu handoff/thiết kế lên Git (`730101f`), GitHub Pages đã deploy live thành công; sẵn sàng để Người dùng kiểm thử trên thiết bị thật.

## Minh chứng kiểm thử thực tế
1. **Kiểm thử tự động trên máy (PASS 100%)**:
   - `test_role_switch.cjs`: **235/235 checks PASS** (4 viewports, theme sáng/tối, vùng chạm ≥48px, tương phản ≥4.5:1, viền focus ≥3:1, không tràn ngang).
   - `test_role_switch_step_a.cjs`: **5/5 tiêu chuẩn PASS** (360×360 không lồng cuộn, bfcache xóa PIN/lỗi, ẩn khi đăng nhập, dấu tiếng Việt).
   - `test_role_isolation.cjs`: **4/4 kịch bản PASS** (cách ly phiên học sinh và giáo viên tuyệt đối).
   - `test_teacher_shell.cjs`: **PASS** (cả desktop và mobile).
   - `package_student_pwa.py --check`: **PASS** dấu shell PWA.
2. **Triển khai live GitHub Pages**:
   - Workflow GitHub Actions run `40302740601` hoàn thành **SUCCESS**.
   - Live URL: `https://mrbin2026dh-droid.github.io/aihoctap/`.
3. **Đồng bộ tài liệu Git**:
   - Đã commit và push toàn bộ các file `docs/handoff/`, `docs/design/`, `docs/plans/` còn sót lên nhánh `main` (commit `730101f`).
   - Cây thư mục Git hiện tại hoàn toàn sạch sẽ (`working tree clean`).

## Hướng dẫn Người dùng kiểm thử trên thiết bị thật (Android + iPhone Safari)
1. Dùng điện thoại mở link web thật:
   `https://mrbin2026dh-droid.github.io/aihoctap/`
2. Bấm nút **"Đăng nhập"**:
   - Quan sát thanh vai trò `Học sinh | Giáo viên`.
   - Bấm sang **"Giáo viên"**: chuyển sang trang giáo viên với nút/logo xanh trầm đồng bộ.
   - Bấm sang **"Học sinh"**: quay lại cổng học sinh.
3. Thử nghiệm bảo mật bfcache:
   - Nhập vài ký tự vào ô PIN.
   - Chuyển sang vai trò kia rồi bấm nút Back của trình duyệt.
   - Xác nhận ô PIN và lỗi đã tự động xóa trắng.
4. Báo lại kết quả phản hồi trải nghiệm thực tế.

## Ràng buộc tuân thủ
- Không can thiệp sang Bước B (bỏ `#gate` + `<dialog>`) cho đến khi có chỉ thị từ Người dùng và Claude.
- Toàn bộ các phiên làm việc tiếp theo tuân thủ thực hiện trên một nhánh `main` đã pull mới nhất.
