# Claude → Antigravity: phát hành đợt 3 (Pages) để người dùng thử thực tế
Đọc AGENTS.md (G, L). Chỉ giao diện học sinh/giáo viên (frontend/hoc); Worker KHÔNG đổi trong đợt này. Dừng sau smoke test, không làm việc khác.

## Trước khi đẩy
1. `python tools/package_student_pwa.py --stamp` rồi `python tools/package_student_pwa.py` (phải in dấu, exit 0); commit cả `sw.js` đã đóng dấu. Không sửa tệp shell sau bước này (nếu sửa phải đóng dấu lại).
2. Chạy lại toàn bộ test `tests/test_*.mjs` và quét bí mật trên diff: kết quả rỗng/PASS mới được đẩy.
3. Ghi mốc rollback: hash commit đang chạy trên Pages (`git rev-parse origin/main`) vào `aisgk.md` (không ghi bí mật).
4. `git push origin main` (CI tự đóng dấu + kiểm + deploy). Chờ workflow xanh.

## Smoke test THẬT sau deploy (báo kết quả từng mục, không suy diễn)
S1. `GET <trang>/sw.js` có `CACHE = 'aisgk-student-shell-…'` TRÙNG dấu trong repo; `index.html` có `id="open-settings"` và `id="update-text"`.
S2. Mở trang bằng trình duyệt sạch: tải được, không lỗi console, cài PWA được.
S3. Thiết bị/trình duyệt đã có bản cũ (đợt 2): mở lại hai lần → xuất hiện "Ứng dụng có bản cập nhật" (hoặc tự lên bản mới), bấm cập nhật → tải lại ≤5 giây, Cài đặt → Hướng dẫn hiện "Phiên bản" khớp 8 ký tự cuối dấu.
S4. Đăng nhập học sinh [THỬ], đổi PIN, mở Cài đặt (mobile: danh sách → chi tiết → Back), xóa bản tải có hộp thoại.
S5. Giáo viên [THỬ]: đăng nhập, Cài đặt, Khóa/Mở học sinh có hộp thoại xác nhận.
Thất bại bất kỳ mục → `git revert` về mốc rollback, push, báo Claude.

## Hướng dẫn người dùng thử
Cập nhật `docs/guides/kiem-tay-dot-1.md` (hoặc tạo `kiem-tay-dot-3.md`) ≤ 1 trang: (1) thiết bị đã cài ứng dụng: mở 2 lần, bấm "Cập nhật", xem phiên bản; (2) thử menu Cài đặt trên điện thoại và máy tính; (3) ghi lỗi vào `docs/handoff/nguoidung-release-3-loi.md` (mô tả + thiết bị + ảnh chụp, KHÔNG ghi PIN).
Kết thúc theo mẫu: XONG … / TIẾP THEO → Người dùng.
