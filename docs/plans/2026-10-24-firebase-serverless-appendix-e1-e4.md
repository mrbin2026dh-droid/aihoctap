# Phụ lục Kế hoạch Firebase Serverless: Triển khai E1–E4
24/10/2026 · Antigravity · Phán quyết: ACCEPT CÓ ĐIỀU KIỆN

---

### E1 (Chặn): Chống vét PIN & Bảo vệ `/api/login`
- **Khóa theo Mã học sinh & IP**: Giới hạn tối đa 5 lần thử sai liên tiếp trên mỗi `student_id` hoặc client IP; nếu vượt quá -> tạm khóa 15 phút (trả HTTP 429 kèm `Retry-After`).
- **Băm PIN chậm**: PIN lưu dạng băm PBKDF2 (100.000 vòng lặp, SHA-256 qua Web Crypto API, kèm salt ngẫu nhiên riêng cho từng học sinh), triệt tiêu nguy cơ vét cạn PIN 4–6 số khi bị lộ dữ liệu.
- **Kiểm chứng Gate Code**: Test tự động thử 6 lần đăng nhập sai liên tiếp -> xác nhận lần thứ 6 bị khóa 429; đăng nhập đúng trong thời gian khóa vẫn bị từ chối cho đến khi hết hạn.

### E2 (Chặn): Sao lưu Dữ liệu Gốc & Tạo Repo Sạch Triệt tiêu SHA cũ
- **Sao lưu ngoài repo**: Sao lưu toàn bộ 17 tệp JSON chứa đáp án gốc ra thư mục ngoài git: `~/Desktop/aihoctap-curriculum-raw-backup/`.
- **Làm sạch mã nguồn**:
  - Viết `tools/sanitize_curriculum.py` loại bỏ triệt để các trường: `dap_an_dung`, `correct_answer`, `dap_an`, `answer`, `giai_thich`, `explanation`, `solution` khỏi toàn bộ tệp gói học sinh.
  - Thay mới toàn bộ 4 đề thi tại `frontend/data/exams/`.
  - Quét sạch toàn bộ cây thư mục (mã nguồn, `tests/`, file nén `.zip`).
- **Khởi tạo Repo sạch**:
  - Vì GitHub cache các commit SHA cũ (kể cả commit `7f670c9`), bắt buộc tái khởi tạo repository sạch (fresh git init hoặc recreate repo sạch trên GitHub), chỉ push lịch sử đã được làm sạch 100%.
  - Kiểm chứng: Truy cập commit `7f670c9` trên GitHub trả về 404; clone repo mới và chạy `git log -S "dap_an_dung"` trả 0 kết quả.

### E3: Quyền ghi `/attempts` & Đếm N Nguyên tử
- **Phân định quyền ghi**: Chỉ Cloudflare Worker (dùng Firebase Admin Service Account) mới có quyền ghi vào `/attempts/{uid}/{attempt_id}`.
- **Quy tắc Rules**: Đặt `.write: false` (hoặc `auth.token.admin === true`) đối với học sinh trên node `/attempts`, triệt tiêu hoàn toàn khả năng học sinh tự tạo `attempt_id` ảo bằng Client SDK để lách giới hạn N lần nộp.
- **Idempotency & Đếm N**: Worker sử dụng khóa idempotency kép `uid + attempt_id` (trả lại kết quả cũ khi mạng retry) và đếm nguyên tử số bài đã nộp trước khi chấm điểm.

### E4: Quản lý Quota Gemini Toàn hệ thống & Cấu hình SW
- **Trần Gemini Daily Ceiling**: Worker theo dõi số lượt gọi Gemini trong ngày bằng bộ đếm daily (ngăn chặn vượt quá 1000 req/ngày trên toàn hệ thống).
- **Service Worker**: Cấu hình `sw.js` tuyệt đối KHÔNG cache bất kỳ endpoint nào bắt đầu bằng `/api/` (Network-Only, bypass SW cache).
