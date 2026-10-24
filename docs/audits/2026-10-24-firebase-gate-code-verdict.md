# Phán quyết Gate Code E1–E4
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH**. Chưa bật Pages, chưa push.

Đã tự chạy `node tests/test_worker_gate.mjs` (5/5 PASS) và thử thêm vài ca. PASS chỉ đúng với mô hình giả lập, chưa chứng minh E1, E3, E4.

## Đạt
- `database.rules.json`: `attempts` chỉ admin ghi, `packages_private` khóa đọc.
- `sw.js` không cache `/api/*`; Pages chỉ xuất bản `frontend/hoc`; 17 JSON đã sao lưu ngoài repo.

## Điều kiện bắt buộc
- **F1 (chặn)**: `/api/login` là mã giả. PIN `1234` và salt cố định cho mọi học sinh, token là chuỗi giả. Thử thực tế: mã bất kỳ + `1234` trả 200. Phải tra PIN băm và salt riêng từng học sinh trong kho chỉ Worker đọc được (không để trong `students/` vì học sinh đọc/ghi node của mình, PIN 4 số bị dò offline), rồi cấp Firebase custom token thật.
- **F2 (chặn)**: khóa đăng nhập, đếm lần nộp, idempotency và trần Gemini nằm trong `Map` của isolate; mất khi isolate bị thu hồi và không chung giữa các instance. Chuyển sang Durable Object như E3/E4 đã yêu cầu, và test nhiều instance.
- **F3**: `checkLoginLockout(a) || checkLoginLockout(b)` luôn trả đối tượng đầu nên khóa theo IP không chạy (thử: IP sai 5 lần vẫn nhận 401). Khóa theo mã học sinh cho người khác khóa hộ (thử: sai từ 5 IP, PIN đúng vẫn 429). Dùng khóa theo cặp mã + IP kèm backoff, giáo viên mở khóa được; lưu ý IP lớp học dùng chung.
- **F4**: `/api/submit` và `/api/tutor` trả 404; `handleSubmission` không xác minh JWT và nhận `privatePackage` qua tham số thay vì đọc RTDB. Nối đủ và test qua HTTP: token sai trả 401.
- **F5 (E2)**: `sanitize_curriculum.py` chỉ bắt khóa theo 8 mẫu, bỏ sót biến thể như `is_correct`, `correct`, và đáp án nằm trong giá trị văn bản. Liệt kê toàn bộ tên khóa của 17 tệp để rà; quét thêm `frontend/hoc`, seed backend, `tests/`, zip. Repo mới phải công khai (Pages gói Free không chạy trên repo riêng tư), đẩy lịch sử đã lọc; kiểm chứng bằng clone mới và SHA `7f670c9` trả 404.

Chưa chạy được Worker thật trên Cloudflare; dựa trên đọc mã, chạy test và thử ca trong Node 22. Sau F1–F5 gửi lại để kiểm định.
