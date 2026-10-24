# Phán quyết: Tài liệu Drive (D1/A6) + Bể khóa Gemini (C5)
Người kiểm định: Claude. Ngày: 2026-10-24.

## Kết luận: YÊU CẦU ĐIỀU CHỈNH (chưa deploy, chưa đánh [x])

## Đã tự kiểm chứng (MOCK)
- Tự chạy 11 bộ test Node (drive 4/4, key_pool 6/6, n1_n7, tutor, g..m, worker_gate): PASS. Chưa có bằng chứng THẬT với Drive/Gemini.
- Đạt: chỉ lưu `file_id`; URL Drive cố định; giới hạn 10MB; khóa mã hóa AES-GCM, chỉ trả 4 ký tự cuối; chọn khóa ít dùng; 429 → cooldown + failover; cạn bể → `AI_QUOTA_EXHAUSTED` + hoàn hạn mức; học sinh thấy thông báo thân thiện.

## Điều kiện phải sửa
- O1 (chặn): `deriveKeyEncryptionKey` dùng chuỗi mặc định hardcode `default-gemini-pool-secret-key-32b` khi thiếu `KEY_ENC_SECRET`. Repo công khai nên ai cũng giải mã được. Phải fail-closed: thiếu hoặc < 32 ký tự thì trả 500 cấu hình, không mã hóa/giải mã. Thêm test FAIL-first. Người dùng tạo secret (xem hướng dẫn dưới).
- O2: `POST materials` ghi RTDB không kiểm `res.ok` (lặp lại lỗi N1) nên báo thành công giả. GET tài liệu cũng không gửi Bearer token RTDB.
- O3: proxy trả nguyên Content-Type của Drive, không kiểm PDF (Drive có thể trả trang HTML). Chỉ nhận `application/pdf` + đầu tệp `%PDF`; còn lại 415/502. Route chưa yêu cầu đăng nhập: cần JWT học sinh/giáo viên.
- O4: giao diện giáo viên thiếu biểu ngữ khi bể rỗng/cạn kèm ô thêm khóa (theo spec); bỏ emoji 🟢🟡🔴 trong bảng (yêu cầu ít icon).
- O5 (ghi nhận): ngày khóa tính theo UTC; chuyển sang giờ VN khi làm giới hạn AI.

## Hướng dẫn người dùng (không dán khóa vào chat)
Tạo chuỗi ngẫu nhiên ≥ 32 ký tự, chạy `npx wrangler secret put KEY_ENC_SECRET` và dán khi được hỏi. Đừng đổi sau khi đã thêm khóa (khóa cũ sẽ không giải mã được).
