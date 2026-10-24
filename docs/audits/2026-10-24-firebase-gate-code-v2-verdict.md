# Phán quyết Gate Code lần 2 (F1–F5)
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH**. Chưa bật Pages, chưa push.

Đã tự chạy `node tests/test_worker_gate.mjs` (6/6 PASS) và thử thêm ca. PASS chỉ đúng với dữ liệu giả; F1 và F4 là **mock**, chưa đạt.

## Điều kiện bắt buộc
- **G1 (chặn, bảo mật)**: `/api/teacher/unlock` kiểm `Authorization` có chứa `teacher_token` hoặc `X-Admin-Secret === 'TEACHER_SECRET_KEY'`. Thử: cả hai đều trả 200, ai cũng mở khóa được; còn là hardcode (mục D). Dùng token giáo viên thật (claim admin) hoặc Worker Secret.
- **G2 (chặn)**: token không phải Firebase custom token. Ký bằng cặp khóa RSA tự sinh trong bộ nhớ isolate, `iss` là email giả cứng, không có `kid`; Firebase sẽ từ chối. Thử: token của isolate này bị isolate khác trả 401. Phải ký bằng khóa service account lấy từ Worker Secret; ID token xác minh bằng khóa công khai Google (`iss`, `aud`, `exp`).
- **G3 (chặn)**: dữ liệu vẫn mock. Học sinh và đáp án nằm trong `Map` (`defaultStudentsAuth`, `privatePackagesStore`), rỗng thì không ai đăng nhập được. `/api/submit` không đọc RTDB, không ghi `attempts`; `/api/tutor` trả chuỗi cố định, không gọi Gemini. Ghi rõ "mock" trong nhật ký, nối RTDB và Gemini thật khi người dùng đã cung cấp dịch vụ.
- **G4**: thiếu `env.GATE_DO` thì âm thầm dùng `MockDONamespace` (mất F2 khi chạy thật); phải trả lỗi 500 (fail-closed). Mở khóa dùng tiền tố `lock:${id}` nên `hs1` xóa luôn khóa của `hs10`; dùng `lock:${id}:`.
- **G5 (F5)**: sanitizer đã mở rộng nhưng chú thích nói có `correct`, `ans`, `key` mà thực tế `correct`, `correct_index`, `answerIndex`, `ket_qua` đều không bị bắt. Kết quả "0 leak" trên 17 tệp thật tôi chưa kiểm (dữ liệu không thuộc tệp được giao); in tập tên khóa để rà.
- **G6 (quy trình)**: nhật ký ghi "Firebase Custom Token RS256 chuẩn" và "PASS 100%" cho phần mock, trái mục D. Chưa có bằng chứng các bước Hiến pháp: `context7-docs`, `bend-proof-driven`, TDD fail trước, `alibaba-code-review`, `zero-bug-verification`.

Chưa chạy được Cloudflare và Firebase thật; dựa trên đọc mã, chạy test và thử ca trong Node 22. Sau G1–G6 gửi lại để kiểm định.
