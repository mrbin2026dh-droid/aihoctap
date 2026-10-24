# Phán quyết: Kế hoạch Firebase Serverless
24/10/2026 · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH**

## 1. Khả thi Zero-Server: CÓ, kèm điều kiện
GitHub Pages + RTDB đủ cho quy mô lớp học (gói Spark). Lưu ý: Cloud Function cần gói Blaze (có thẻ), trái "0 chi phí".

## 2. Lộ đáp án: CHƯA ĐỦ
- `database.rules.json` hiện tại **không có** `courses`, `packages`, `packages_private`, `attempts`. Gốc `.read/.write: false` nên mọi đường dẫn trong kế hoạch bị chặn.
- Hash SHA-256 + salt phía client vô hiệu: trắc nghiệm chỉ 4 lựa chọn, salt và hash đều công khai nên thử 4 giá trị là ra đáp án.
- Nhật ký ghi 17 JSON legacy (13 curriculum, 4 exams) có trường đáp án, đã push lên repo công khai. Chặn nhánh RTDB không che được đáp án này.
- Chấm phía server mới giữ được phản hồi tức thì mà không lộ đáp án. Nếu chỉ giáo viên chấm thì học sinh không thấy kết quả ngay.

## 3. Cloudflare Worker proxy: HƯỚNG ĐÚNG, thiếu chi tiết
- Chỉ giới hạn theo IP là yếu (IP lớp học chung, Origin giả được). Worker cần xác minh Firebase ID token và giới hạn theo UID.
- Cần CORS cố định và giới hạn độ dài đầu vào/ra.
- Gia sư chỉ nhận ngữ cảnh public.
- Nên cân nhắc Firebase AI Logic (không giữ key) và chính sách dữ liệu gói Gemini miễn phí (người dùng là học sinh).

## 4. Offline-First: RỦI RO TRUNG BÌNH
- RTDB web không có lưu bền, nên IndexedDB hiện có vẫn phải là nguồn chính; Firebase Auth dùng IndexedDB riêng (tên khác, không đè `aisgk-student-pwa`).
- SDK nạp từ CDN sẽ không chạy offline: phải đóng gói SDK vào shell cache, thêm vào allowlist và hash stamp của `package_student_pwa.py`.
- SW không được cache lời gọi Firebase/Auth (websocket, long-poll).
- Giữ nguyên outbox/ACK hiện tại, không dựa vào hàng đợi offline của RTDB.
- Subpath `/aihoctap/` của GitHub Pages ảnh hưởng scope SW và `start_url`.

## Điều kiện bắt buộc
- **C1**: Viết lại `database.rules.json` cho đúng schema kế hoạch (public/private/attempts); thêm test Playwright 2 context chứng minh học sinh bị chặn đọc private.
- **C2**: Bỏ hash client; chọn rõ cơ chế chấm (Cloud Function Blaze hoặc chấm hoãn bởi giáo viên) và ghi chi phí/trade-off.
- **C3**: Xử lý 17 JSON legacy (loại khỏi repo công khai hoặc xóa trường đáp án) trước khi bật GitHub Pages.
- **C4**: Worker xác minh ID token, CORS cố định, rate-limit theo UID, không chạm dữ liệu private.
- **C5**: Vendor SDK vào shell cache, cập nhật allowlist SW và test offline sau cài đặt.
- **C6**: Mô tả auth học sinh (mã học sinh/PIN → UID Firebase) và cách đặt claim admin giáo viên.

Chưa chạy code; dựa trên kế hoạch, `aisgk.md`, `database.rules.json`.
