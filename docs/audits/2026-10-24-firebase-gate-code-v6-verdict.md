# Phán quyết Gate Code lần 6 (J1–J4 + repo sạch)
24/10/2026 · Claude · **KẾT LUẬN: ACCEPT** (mã Worker và repo sạch). Việc K1–K3 làm trong commit đầu trước khi push.

Tự chạy: `j1_j3` 3/3, `i1_i4` 4/4, `h1_h6` 5/5, `g1_g6` 4/4, `worker_gate` 6/6 PASS; đọc mã. Tất cả là MOCK; chưa chạy Firebase/Cloudflare/Gemini THẬT.

## Đạt (đã tự kiểm chứng)
- J1: `/reserve-gemini-limit` tăng lượt ngay trong DO, `/refund-gemini-limit` khi Gemini lỗi, mạng lỗi hoặc thiếu khóa; không còn khe giữa kiểm tra và tính. 40 yêu cầu song song: đúng 30 qua, 10 bị 429.
- J2: `packageKey = course:lesson` khớp giữa Worker và `tools/upload_private_packages.py` (đọc đáp án từ thư mục ngoài repo, có `--dry-run`, token OAuth2, không hardcode).
- J3: repo sạch 1 commit, tác giả `AI AGENT SGK Bot <…@noreply.github.com>`; `frontend/app.js` chỉ còn giữ chỗ; quét tệp văn bản: không khóa API, private key thật, PIN, đáp án; JSON trong `frontend/data` không có khóa đáp án. Workflow Pages chỉ phát hành `frontend/hoc`.
- J4: SETUP có hai lựa chọn dự án Firebase kèm hạn chế API key theo referrer.

## Việc nhỏ, làm trước khi push (K)
- **K1**: `worker/index.js` dòng ~237 còn email service account mặc định `firebase-adminsdk@aihoctap…`. Thiếu `FIREBASE_CLIENT_EMAIL` thì báo lỗi cấu hình, không điền giá trị cứng (mục D).
- **K2**: `upload_private_packages.py` lấy `course_id` từ trường `subject` (ví dụ "Tin học 6"), không qua kiểm `^[A-Za-z0-9_-]{1,64}$` nên Worker không bao giờ khớp. Kiểm regex, bỏ qua và báo gói sai; dùng đường dẫn tệp làm mã khi trường thiếu; thêm test.
- **K3**: dọn dấu vết máy cá nhân khỏi repo: tên người dùng Windows `developer` trong `tests/logs/*`, `tests/f12_diagnostic_report.json`, `tools/sgk_studio_gui.py`, vài tệp `docs/audits`. Xóa hoặc thay giữ chỗ; tạo lại commit đầu.

## Người dùng làm (đang chờ)
Xóa hoặc chuyển riêng tư repo cũ `aihoctap`; tạo repo công khai mới và gửi tên; chọn dự án Firebase mới hoặc `ai-sgk-tinhoc`; tạo tài nguyên theo SETUP. Chạy `upload_private_packages.py --dry-run` trên bản sao lưu thật để xem số gói khớp trước khi nạp.
