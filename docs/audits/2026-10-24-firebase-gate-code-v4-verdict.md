# Phán quyết Gate Code lần 4 (H1–H6)
24/10/2026 · Claude · **KẾT LUẬN: ACCEPT CÓ ĐIỀU KIỆN**
- Được tạo repo công khai mới sạch và bật Pages ngay (Pages chỉ phục vụ `frontend/hoc`, không phụ thuộc Worker).
- I1–I4 phải xong trước khi nối Worker với Firebase và Gemini thật.

Tự chạy: `test_gate_code_h1_h6.mjs`, `test_gate_code_g1_g6.mjs`, `test_worker_gate.mjs` đều PASS; thử thêm bằng mock `fetch`.

## Đạt (đã tự kiểm chứng)
- H1: `attempt_id='../../students_auth/v'` bị 400, không còn lời gọi RTDB; ID kiểm regex và mã hóa.
- H2: chỉ có `FIREBASE_PRIVATE_KEY` vẫn đăng nhập và nộp bài được (khóa công khai suy từ khóa riêng).
- H3: thiếu khóa thật hoặc chỉ có `GATE_DO` trả 500; khóa tạm và mock chỉ chạy khi cờ dev bật rõ.
- G1 giữ nguyên: header giả và secret cũ đều 403.
- H5 một phần: header `x-goog-api-key`, trần 1000 ký tự cho `message`, 30 lượt/ngày/học sinh.
- H6: SETUP đã cập nhật; rà regex 52 gợi ý `goi_y_khi_sai`, không thấy dấu hiệu lộ đáp án.

## Điều kiện trước khi nối dịch vụ thật
- **I1**: xác thực RTDB chưa có đường chạy được. Mã gửi `Bearer <FIREBASE_DATABASE_SECRET>`, trong khi theo tài liệu RTDB REST header Bearer dành cho OAuth2 access token, còn secret cũ đi qua tham số `auth`; và không có mã đổi service account thành access token (hết hạn sau 1 giờ). Thêm bước tạo token từ service account (scope `firebase.database`, `userinfo.email`), lưu đệm, kèm test dùng mock endpoint token. SETUP bỏ chữ "Database Secret".
- **I2**: `ALLOWED_ORIGIN` vẫn mặc định cứng tên miền cá nhân (mục D). Thiếu cấu hình thì trả lỗi, không dùng mặc định.
- **I3**: `context.grade` không kiểm: thử 200KB chữ vào được prompt Gemini, vượt giới hạn 1000 ký tự. Ép thành số 1–12.
- **I4**: bộ đếm Gemini tăng trước khi kiểm `message` và trước lời gọi, nên lỗi 400/502 vẫn mất lượt; `packageKey = course_lesson` có thể trùng (`a_b`+`c` với `a`+`b_c`), dùng dấu phân tách ngoài regex; lỗi đọc RTDB khi chấm bài đang báo 404, đổi thành 502.

## Điều kiện cho repo mới (E2)
Tạo bằng `git init` mới, không sao chép `.git`; chạy sanitizer trên toàn cây (`frontend/`, seed backend, `tests/`, zip) rồi mới push. Repo cũ `aihoctap` phải xóa hoặc chuyển riêng tư; sau đó clone mới và mở `7f670c9` phải 404.

Chưa chạy Cloudflare và Firebase thật.
