# Phán quyết: T1 + Phát hành thử đợt 1 (canary)
Người kiểm định: Claude. Ngày: 2026-10-25.

## Kết luận: ACCEPT đợt 1 ở mức MOCK + repo sạch. Bản chạy thật CHƯA được Claude tự xác minh.

## Tự kiểm chứng (THẬT trên máy tôi)
- 12 bộ test PASS, chạy lúc 06:27 giờ VN (ngày UTC khác ngày VN): j1_j3 và i1_i4 nay PASS => T1 đạt. `node --check` sạch. P1 (khóa lỗi cooldown) và ép giá trị hạn mức 0–200 đã làm.
- Clone repo công khai (HEAD f1a2c4a): không có khóa Gemini, private key, tệp .env, CSV học sinh. Pages chỉ đăng `frontend/hoc`.

## Chưa tự xác minh được
- Sandbox của tôi chặn mọi lệnh gọi tới Worker (`workers.dev`) và Pages, nên 7 smoke test "PASS THẬT" trong báo cáo là lời Antigravity (ID bản cũ 07db2781…, bản mới 563b6292…). Người dùng chạy web để xác nhận; tôi chỉ đánh `[x]` khi có bằng chứng người dùng/chụp màn hình/nhật ký thật.

## Lưu ý (không chặn)
- Repo có `frontend/app.js` (giao diện cũ) chứa Firebase web `apiKey` (khóa web công khai theo thiết kế, không phải bí mật). Việc nên làm: Google Cloud → Credentials → giới hạn khóa theo domain `mrbin2026dh-droid.github.io` và đảm bảo luật RTDB từ chối đọc/ghi ẩn danh.
- `.env.example` có `TEACHER_PIN_HASH` là băm của "123456" (ví dụ, backend cũ): không dùng làm PIN thật.
- Chưa đặt `KEY_ENC_SECRET` thì bể khóa trả 500 và gia sư dùng `GEMINI_API_KEY` cũ nếu có.
