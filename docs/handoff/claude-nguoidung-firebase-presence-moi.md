# Claude → Người dùng, rồi Antigravity: trạng thái trực tuyến trên MỘT dự án Firebase (ai-sgk-tinhoc)
Đọc `docs/huong-dan-firebase-presence-moi.md`. Người dùng chỉ cần gửi **apiKey web** của dự án ai-sgk-tinhoc và bật Authentication; Antigravity điền `presence-config.js`, thêm nhánh `presence` vào luật (kiểm bằng `spike/step0/emulator/rules-live-check.test.mjs`), deploy Worker. Không cần khóa mới.
Đã PASS: test_worker_sheet_login (ký bằng FIREBASE_* khi không có PRESENCE_*), test_presence_ui. Chưa chạy: rules-live-check (cần luật thật; Antigravity).
