# Claude → Người dùng, rồi Antigravity: dự án Firebase mới cho trạng thái trực tuyến
Đọc `docs/huong-dan-firebase-presence-moi.md` (từng bước cho người dùng, rồi cho Antigravity). Tóm tắt: dự án mới chỉ chứa `presence`; Worker giữ nguyên `FIREBASE_*`, chỉ thay 3 secret `PRESENCE_*` và điền `apiKey`/`dbUrl` vào `frontend/hoc/presence-config.js`.
Đã chạy PASS: `tests/test_presence_ui.cjs` (28, gồm trường hợp chưa điền cấu hình → tắt êm). Chưa chạy: `spike/step0/emulator/rules-presence.test.mjs` (13 ca, Antigravity chạy).
