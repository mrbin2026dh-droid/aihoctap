# Lỗi/việc mở đã biết (Claude ghi 25/10/2026) — chưa chặn lần thử thực tế
- **Đã hoàn thành sửa S1–S5 và P1–P7:** menu Cài đặt S1–S5 và cập nhật PWA P1–P7 đã PASS 100% (test_settings_menu.mjs 12/12 PASS, test_pwa_update_integrity.mjs 7/7 PASS, audit_settings_behavior.cjs PASS, test_pwa_update.py PASS, package_student_pwa.py --check PASS, oxlint 0/0). Bàn giao Claude kiểm định độc lập trước khi deploy đợt 3.
- N7: chưa xác nhận Worker đang chạy đúng bản đã ACCEPT (kiểm sau deploy bằng smoke test).
- Gợi ý gia sư: mức gợi ý quá mạnh ở ca 003/016/029; ca 043 có tiền đề sai (chạy lại Gemini thật khi đổi tutor).
- Token giáo viên còn hiệu lực 1 giờ sau khi đổi PIN.
- Khóa API web Firebase cũ chưa giới hạn theo referrer (người dùng làm).
- Người dùng cần: đặt `KEY_ENC_SECRET` (≥32 ký tự), `TEACHER_ADMIN_SECRET` ngẫu nhiên qua wrangler, thêm 1 khóa Gemini, đặt trần hóa đơn/hạn mức.
- Chưa làm: đề kiểm tra giáo viên giao (A4/A5), thống kê/quản lý (B5/B6), C2/C4; tải PDF qua Drive (hoãn, Antigravity hướng dẫn sau).
- `test_frontend_outbox_regression.mjs` đã sửa đường dẫn URL tương đối an toàn và fallback khi thiếu `frontend/app.js` (S5 đã giải quyết).
- Ghi nhận lỗi mới khi thử thực tế vào `docs/handoff/nguoidung-release-3-loi.md`.
