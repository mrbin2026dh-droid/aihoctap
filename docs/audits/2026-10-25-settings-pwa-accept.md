# Phán quyết: menu Cài đặt (S1–S5) + cập nhật PWA (P1–P7) — 25/10/2026
**ACCEPT (giao diện/PWA, MOCK) — cho phép phát hành đợt 3 theo AGENTS.md G.** Chưa đánh dấu [x] yêu cầu cuộc thi.

## Claude tự chạy (không dựa báo cáo)
- 17 bộ test .mjs đều exit 0 (gồm test_pwa_update_integrity, test_settings_menu, test_login_ui, outbox); `node --check` sạch; `tools/package_student_pwa.py` khớp dấu (`95d8a72e…`).
- E2E PWA riêng của Claude (Chromium, tệp cũ có `max-age=600`): cài v1 → máy chủ đổi sang v2 → `update()` → thông báo hiện → bấm cập nhật → tải lại, chạy mã V2 trong ~3,5 giây, cache cũ bị xóa, hiển thị phiên bản `18ab1389`, mở offline `?source=pwa` được, 0 lỗi trang. Không treo.
- Menu (Playwright, 390px/1280px): mobile vào thấy danh sách nhóm; Back lùi chi tiết → danh sách → màn làm việc; có thay đổi chưa lưu → hộp thoại, Hủy giữ nguyên, Đồng ý thoát; khóa học sinh khi API chậm chỉ 1 POST; Sửa học sinh 1 hộp thoại, tên 1 ký tự báo lỗi dưới trường, 0 request; không dùng hộp thoại gốc.

## Lưu ý (không chặn)
- Handoff ghi "outbox 6/6 PASS": thực tế khi không còn `frontend/app.js` chỉ chạy kiểm hợp đồng trên `frontend/hoc/app.js`; 6 kịch bản cũ bị bỏ qua (đã in rõ trong log).
- Chưa tự kiểm Back/lịch sử bên Cài đặt học sinh (cần phiên đăng nhập thật) → đưa vào thử thực tế.
- `test_pwa_update.py` (Python, giữ nháp) Claude chưa chạy được; Antigravity báo 1/1 PASS.
- Bản cài trước đợt này có `sw.js` cũ không có kiểm định kỳ: máy đó nhận bản mới khi mở lại ứng dụng/tải lại trang (một lần); từ đợt 3 trở đi tự kiểm.

## Điều kiện phát hành (G)
Quét bí mật rỗng; lưu mốc rollback (commit trước); chỉ dữ liệu [THỬ]; sau deploy chạy smoke THẬT (xem `claude-antigravity-release-3.md`); lỗi → rollback.
