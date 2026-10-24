# Phán quyết Gate Code lần 8 (L1–L5)
24/10/2026 · Claude · **KẾT LUẬN: ACCEPT** cho L1–L5. Được deploy giai đoạn 2 (đăng nhập PIN). M1–M4 làm trước khi cho học sinh thật dùng.

Tự chạy: `l1_l5` 5/5, `j1_j3`, `i1_i4`, `h1_h6`, `g1_g6`, `worker_gate` PASS; `test_manage_students` 4/4. Đọc mã `worker/index.js`, `tools/manage_students.py`, `frontend/hoc`. Tất cả là MOCK/UNIT; các lệnh curl "THẬT" (403 lan-login, CORS) là lời Antigravity, tôi chưa gọi được Worker.

## Đạt
- L1: `lan-login` chỉ chạy khi `MOCK_MODE` bật; sản xuất trả 403; tên có nhãn (MOCK).
- L2: `/api/login` đối soát `students_auth` (PBKDF2 100.000 vòng, salt riêng), lớp/khối/tên lấy từ hồ sơ; sai 5 lần bị khóa theo cặp học sinh+IP, giới hạn IP; lỗi RTDB trả 502, không tính lần sai.
- L3: CORS chỉ `ALLOWED_ORIGIN`. L4: route `/api/pwa/*` có test. L5: sạch đường dẫn máy.
- Trạng thái giáo viên: đã có `/api/teacher/auth`, `/api/pwa/teacher/results` (cần quyền `admin`).

## Điều kiện (M)
- **M1**: `/api/teacher/auth` không khóa thử sai, không giới hạn IP. Dùng chung cơ chế khóa của đăng nhập học sinh.
- **M2**: `/api/pwa/me` còn `grade || 9`, `class_code || '9A'`, tên mặc định (mục D). Thiếu claim thì 401, không đoán.
- **M3**: PIN 4 ký tự và kẻ tấn công đổi IP vẫn thử được 10.000 tổ hợp. Tăng PIN tối thiểu 6, thêm trần lỗi theo học sinh (toàn IP) rồi cần giáo viên mở khóa.
- **M4**: `manage_students.py`: `DEFAULT_DATABASE_URL` cứng của dự án thật; nhận `--pin` trên dòng lệnh. Bỏ URL mặc định (lấy từ biến môi trường), thêm chế độ tự sinh PIN ngẫu nhiên và xuất danh sách PIN ra tệp NGOÀI repo, thêm vào `.gitignore`.

Giáo viên nhắc: mã giáo viên `TEACHER_ADMIN_SECRET` phải là chuỗi ngẫu nhiên dài (SETUP: `openssl rand -hex 24`).
