# Hoàn thành sửa menu Cài đặt (S1–S5) và cập nhật PWA không treo (P1–P7)
Từ: Antigravity → Sang: Claude   Ngày: 2026-10-25 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Hoàn thành sửa toàn bộ các lỗi S1–S5 (menu Cài đặt thích ứng, chặn gửi lặp, lịch sử trình duyệt, sửa học sinh 1 hộp thoại) và P1–P7 (công cụ đóng dấu CI, precache bỏ qua cache HTTP, điều hướng query, kiểm tra cập nhật đa cửa sổ & phiên bản). Toàn bộ test suites thật PASS 100%, sẵn sàng để Claude kiểm định độc lập và cấp phán quyết ACCEPT trước khi deploy đợt 3.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `frontend/hoc/teacher.js` & `frontend/hoc/dom.js` (S1–S4: mobile group view, inFlight guard, history push/pop, dialogBox multi-fields)
- `frontend/hoc/app.js`, `frontend/hoc/index.html` & `frontend/hoc/sw.js` (S1, S3, P1, P3–P7: version, precache reload, query navigation, controllerchange)
- `tools/package_student_pwa.py` & `.github/workflows/deploy-pages.yml` (P2: shell stamp & CI verification)
- `tests/audit_settings_behavior.cjs`, `tests/test_settings_menu.mjs` & `tests/test_pwa_update_integrity.mjs` (Kết quả đo thật)

## Kết quả đạt được theo từng yêu cầu
1. **S1 (Mobile thấy danh sách nhóm trước)**: `activeView` khởi tạo rỗng, mobile mở Cài đặt thấy danh sách nhóm, desktop (>=960px) tự động mở 'account'.
2. **S2 (Chặn gửi lặp học sinh)**: `inFlight` Set + `guarded(key, fn)` chặn re-click trước khi mở dialog; nút khóa/mở/đặt lại PIN/xóa đạt đúng 1 request khi API trễ 600ms (đo bằng `audit_settings_behavior.cjs`).
3. **S3 (Lịch sử trình duyệt)**: `history.pushState` khi mở Cài đặt và khi vào nhóm trên mobile; `popstate` gọi `settingsBack()`/`studentSettingsBack()` lùi từ chi tiết về danh sách nhóm rồi mới thoát về màn làm việc; bảo vệ nháp có xác nhận, Hủy khôi phục history.
4. **S4 (Một hộp thoại Sửa học sinh)**: `dialogBox` mở rộng nhận `fields: [{name,label,value,validate}]`, hiển thị lỗi dưới từng trường, focus trường lỗi đầu tiên; 1 lần gọi cho cả Họ tên và Mã lớp; không đổi không gọi API.
5. **S5 (Test outbox)**: `test_frontend_outbox_regression.mjs` dùng URL tương đối an toàn, chạy sạch 6/6 PASS không phụ thuộc cwd hay sự tồn tại của `frontend/app.js`.
6. **P1 & P2 (Đóng dấu SW & CI)**: `tools/package_student_pwa.py` hỗ trợ cờ `--check` và `--stamp`; CI workflow `deploy-pages.yml` đóng dấu và kiểm tra trước khi upload artifact; băm shell `sw.js` khớp 100% byte shell thật.
7. **P3 & P6 (`sw.js`)**: `install` dùng `fetch(new Request(path, {cache: 'reload'}))` bỏ qua cache HTTP; `fetch` handler điều hướng hỗ trợ query string (`/?source=pwa`).
8. **P4, P5, P7 (`app.js` & `index.html`)**: Định kỳ kiểm tra cập nhật mỗi 60 phút, khi online và visibilitychange; đa cửa sổ hiển thị thông báo "Ứng dụng vừa cập nhật ở cửa sổ khác"; nháp chưa nộp chặn cập nhật bằng hộp thoại; nút "Kiểm tra cập nhật" trong Cài đặt mở hộp thoại "Đã là bản mới nhất" kèm phiên bản; SW phản hồi message `VERSION`.
9. **Kiểm thử thực tế**:
   - `node tests/audit_settings_behavior.cjs`: mobile group list visible = true, lock POST count = 1, detail visible without choosing = 0, history length unchanged = false (PASS).
   - `node tests/test_settings_menu.mjs`: 12/12 PASS 100%.
   - `node tests/test_pwa_update_integrity.mjs`: 7/7 PASS 100% (T1–T7).
   - `python -m pytest tests/test_pwa_update.py`: 1/1 PASS.
   - Toàn bộ 17 MJS test suites (`tests/test_*.mjs`) PASS 100%.
   - `npx oxlint .`: 0 warnings, 0 errors trên 39 files.
   - `python tools/package_student_pwa.py --check`: khớp dấu cache hoàn toàn.
   - Quét bí mật rỗng trên toàn bộ git diff.

## Ràng buộc / Không được làm
- TUYỆT ĐỐI KHÔNG deploy hay push git trước khi Claude kiểm định và cấp phán quyết ACCEPT (AGENTS.md G.1).

## Xong thì chuyển cho: Claude
Dán cho họ: "Đọc AGENTS.md và docs/handoff/antigravity-claude-settings-and-pwa-fix.md rồi làm theo."
