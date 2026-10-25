# Triển khai Worker + Firebase rules cho tính năng Kiểm tra và Báo cáo điểm yếu — Claude → Antigravity
Quy tắc chung: `AGENTS.md` mục G. Không dán bí mật vào chat/log/Git. Bản mã đã nằm trên nhánh `main` (commit fef667c trở đi).

## Vì sao cần
Bản Worker đang chạy là bản cũ nên tab Thi và báo cáo điểm yếu bị lỗi 404 "Endpoint không tồn tại". Cần: (1) `wrangler deploy`; (2) deploy `database.rules.json` có thêm 4 nút dữ liệu mới: `attempt_details`, `exams`, `exams_private`, `exam_sessions` (client không được đọc/ghi, chỉ Worker dùng quyền admin).

## Bước 1 — Chuẩn bị
1. `git pull`; chạy toàn bộ test Node (`tests/*.mjs`, `tests/*.cjs`), `node --check worker/index.js worker/exams.js`, oxlint. Phải xanh, dán kết quả vào log.
2. Quét bí mật: `git diff --cached | grep -iE "AIza|BEGIN PRIVATE|pin_hash|KEY_ENC_SECRET *="` rỗng.
3. Ghi ID bản Worker đang chạy: `npx wrangler deployments list` (để `npx wrangler rollback <ID>`).
4. Kiểm tra `database.rules.json` là JSON hợp lệ: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8'))"`.

## Bước 2 — Deploy (đúng thứ tự: rules trước, Worker sau)
1. Rules: nếu repo chưa có `firebase.json`, tạo tạm (không commit) `{"database":{"rules":"database.rules.json"}}` rồi chạy `npx firebase-tools deploy --only database --project <project-id>`. project-id lấy từ `FIREBASE_DATABASE_URL` (phần trước `-default-rtdb`). Nếu CLI chưa đăng nhập: nhờ người dùng chạy `npx firebase-tools login`, hoặc dán nội dung `database.rules.json` vào Firebase Console > Realtime Database > Rules > Publish. Sau khi xong, xác nhận Console hiển thị đủ `attempt_details`, `exams`, `exams_private`, `exam_sessions`.
2. Worker: `cd` thư mục gốc rồi `npx wrangler deploy` (tên `aihoctap-gate`). Ghi ID bản mới.
3. Frontend: chỉ cần push `main` (workflow Pages tự đăng). Chờ workflow xanh. Học sinh nhận bản mới khi PWA cập nhật (nút "Kiểm tra cập nhật").

## Bước 3 — Smoke test sau deploy (ghi kết quả THẬT, không in token/PIN)
1. `GET /api/health` → 200; `GET /api/pwa/catalog` → 200.
2. `GET /api/pwa/exams` không token → 401 (trước đây 404 nghĩa là chưa deploy).
3. `GET /api/pwa/teacher/exams` không quyền → 401/403, không phải 404.
4. `GET /api/pwa/teacher/analytics` không quyền → 401/403, không phải 404.
5. Đăng nhập giáo viên thử → mở tab Kiểm tra: thẻ báo cáo điểm yếu hết báo "chưa cập nhật"; tạo đề Thử [THỬ] 2 câu bằng file mẫu Excel, lưu và "Mở đề".
6. Đăng nhập học sinh thử cùng lớp → tab Thi thấy đề → làm → nộp → thấy điểm; giáo viên mở "Thống kê" thấy 1 bài nộp, "Xuất Excel" tải được.
7. Với đề Thật [THỬ] (15 phút, 1 lượt): học sinh thử vào thi, đồng hồ đếm, nộp, vào lại → báo hết lượt; giáo viên "Theo dõi" thấy trạng thái và "Gia hạn" hoạt động khi học sinh đang làm.
8. Console F12 các trang: 0 lỗi.
Chỉ dùng tài khoản thử và đề có tiêu đề "[THỬ]". Cấm tạo học sinh thật hay đề thật.
Nếu một mục sai: `npx wrangler rollback <ID cũ>`, ghi nguyên nhân, DỪNG, báo Claude.

## Xong khi
Rules đã publish, Worker bản mới chạy, smoke test 8/8 có log, ID bản cũ và mới được ghi. Bàn giao về Claude để xác minh độc lập.
