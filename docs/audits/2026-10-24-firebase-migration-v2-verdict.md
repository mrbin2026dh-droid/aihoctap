# Phán quyết V2: Kế hoạch Firebase Serverless
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH** (V2 tiến bộ rõ, còn 2 điểm chặn: D1, D2)

## Đối chiếu C1–C6
- C1 **chưa đạt**: luật `attempts` có lỗi, xem D1.
- C2 **đạt một phần**: bỏ hash client là đúng; Worker chấm điểm tức thì còn lỗ dò đáp án, xem D4, D5.
- C3 **chưa đạt**: xem D2.
- C4 **gần đạt**: thiếu chi tiết xác minh token và rate-limit, xem D5.
- C5 **gần đạt**: xem D6.
- C6 **chưa đạt**: xem D3.

## Điều kiện bắt buộc
- **D1 (C1)**: `!newData.hasChildren(['score','ack'])` chỉ chặn khi có ĐỦ cả hai trường (theo tài liệu Firebase), nên học sinh vẫn ghi được `score` riêng. Đổi thành `!newData.child('score').exists() && !newData.child('ack').exists()`. Chỉ cho tạo mới (`!data.exists()`), cấm sửa/xóa bài đã nộp. Test phải thử ghi `score` một mình.
- **D2 (C3)**: xóa trường ở working tree không xóa khỏi lịch sử Git; đáp án đã công khai trong commit `7f670c9` và repo đang công khai. Phải làm sạch lịch sử (git filter-repo) hoặc chuyển sang repo mới/private, và coi 4 đề thi đã lộ nên thay đề. Quét theo MỌI tên trường đáp án và lời giải, không chỉ `dap_an_dung`/`correct_answer`. Giới hạn phạm vi Pages không đủ vì `frontend/data` vẫn đọc được trên repo công khai; Pages từ `frontend/hoc` cần GitHub Actions.
- **D3 (C6)**: Anonymous Auth không đủ: xóa dữ liệu trình duyệt là có UID mới (vượt rate-limit 5/phút/UID), và mã học sinh tự khai nên mạo danh được. Thêm `/api/login` trên Worker xác thực mã + PIN rồi cấp custom token với `uid = studentId`, khớp `database.rules.json` hiện có.
- **D4 (C2)**: trắc nghiệm 4 lựa chọn, trả điểm tức thì cho phép nộp lại để dò đáp án. Giới hạn số lần nộp mỗi bài, không trả đúng/sai từng câu trước khi chốt. `/api/submit` phải idempotent theo `attempt_id` vì outbox có thử lại.
- **D5 (C2/C4)**: service account riêng, quyền tối thiểu (chỉ RTDB), lưu Worker Secret, không vào repo. Xác minh token đủ chữ ký, `iss`, `aud`, `exp`. Rate-limit dùng Rate Limiting binding hoặc Durable Object (KV không nhất quán), thêm trần Gemini theo ngày cho cả hệ thống. Ghi rõ chính sách dữ liệu gói Gemini miễn phí (người dùng là học sinh).
- **D6 (C5)**: SDK cần bước bundle (esbuild) thành `vendor/firebase.js`; test tắt mạng phải chạy sau khi đã đăng nhập.

Chưa chạy code; dựa trên kế hoạch V2 và mục cuối nhật ký. Sau D1–D6 gửi lại để kiểm định bản V3.
