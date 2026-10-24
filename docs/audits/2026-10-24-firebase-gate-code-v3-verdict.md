# Phán quyết Gate Code lần 3 (G1–G6)
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH**. Chưa bật Pages, chưa push.

Tự chạy: `test_gate_code_g1_g6.mjs` 4/4, `test_worker_gate.mjs` 6/6 PASS; thử thêm ca bằng mock `fetch`.

## Đạt
- G1: mở khóa giả bị 403; secret lấy từ env (≥16 ký tự), so sánh hằng thời gian.
- G4: thiếu `GATE_DO` trả 500; tiền tố `lock:id:` đúng.
- G5: tự quét 17 tệp thật, tập tên khóa không còn trường đáp án; scanner 0 leak (xem `goi_y_khi_sai` ở H6).

## Điều kiện bắt buộc
- **H1 (chặn, bảo mật)**: `attempt_id`, `course_id`, `lesson_id`, `student_id` nối thẳng vào URL RTDB với quyền admin. Thử: `attempt_id='../../students_auth/victim'` thành `PUT /students_auth/victim.json`; học sinh có token ghi đè dữ liệu bất kỳ. Kiểm `^[A-Za-z0-9_-]{1,64}$` và `encodeURIComponent`, thêm test.
- **H2 (chặn)**: làm theo SETUP sẽ hỏng: có `FIREBASE_PRIVATE_KEY` mà không có `FIREBASE_PUBLIC_KEY` (SETUP không nêu) thì `/api/submit` và `/api/tutor` luôn 401 (đã thử). Suy khóa công khai từ khóa riêng (xuất JWK lấy `n`, `e`). PEM dán dạng chuỗi `\n` làm Worker lỗi; chuẩn hóa.
- **H3 (chặn)**: fail-closed G2 vô hiệu: nhánh sinh khóa tạm điều kiện `env.GATE_DO`, luôn đúng. Thử: chỉ có `GATE_DO`, không có khóa, login vẫn 200 (khóa tạm theo isolate, lỗi cũ). Chỉ cho khóa tạm khi có cờ dev rõ ràng, thiếu khóa thật trả 500. Thiếu RTDB secret cũng rơi về kho mock: dùng `MOCK_MODE` tắt mặc định.
- **H4**: RTDB dùng `?auth=<database secret>` (cơ chế cũ, bí mật nằm trong URL); dùng OAuth token của service account ở header. Ghi `attempts` không kiểm `res.ok`: học sinh nhận 200 nhưng giáo viên không thấy bài. Lỗi đọc RTDB bị tính là đăng nhập sai.
- **H5 (gia sư)**: khóa Gemini nằm trong URL (dùng header `x-goog-api-key`); `gemini-1.5-flash` có thể đã ngừng, tra tài liệu; `message` không giới hạn độ dài; chỉ có trần toàn hệ thống nên một học sinh dùng hết hạn mức cả lớp, cần giới hạn theo UID; CORS mặc định cứng tên miền cá nhân: bắt buộc `ALLOWED_ORIGIN`.
- **H6 (SETUP)**: chưa nói xóa hoặc chuyển riêng tư repo cũ `aihoctap` (`7f670c9` vẫn truy cập được ở đó); ví dụ `Teacher_Admin_Secure_Key_2026` yếu, dùng chuỗi ngẫu nhiên; gói Free có thể cần `new_sqlite_classes` thay `new_classes`, kiểm tra tài liệu Cloudflare; thêm `FIREBASE_PUBLIC_KEY` (nếu còn cần) và `ALLOWED_ORIGIN`. Rà tay `goi_y_khi_sai` xem có lộ đáp án.

Chưa chạy Cloudflare và Firebase thật. Sau H1–H6 gửi lại để kiểm định.
