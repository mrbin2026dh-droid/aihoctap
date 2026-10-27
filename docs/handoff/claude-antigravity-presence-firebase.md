# Claude → Antigravity: trạng thái trực tuyến qua Firebase (thời gian thực, không qua Worker)

## Đã làm (commit kèm tệp này)
- `worker/index.js` (/api/login): trả thêm `fb_token` = custom token **1 giờ** (Firebase từ chối custom token > 1 giờ; token Worker 12 giờ giữ nguyên).
- `frontend/hoc/presence.js` (mới): đổi vé → idToken/refreshToken (Identity Toolkit REST), học sinh PATCH `presence/{mã}` = {name, lop, state, at:{.sv:timestamp}}, nhịp 60 giây; giáo viên nghe `presence` bằng EventSource (REST streaming).
- `app.js` (đăng nhập/đăng xuất/mở lại), `thi.js` (phòng chờ / đang thi / đã nộp), `teacher-thi.js` + `teacher.html` (thẻ "Học sinh trực tuyến", cột "Trực tuyến"), `teacher.js` (đổi vé giáo viên khi đăng nhập).
- Luật: `spike/step0/database.rules.v2.json` thêm nhánh `presence`; `build_merged.py` chặn vé Worker (claim `role`) khỏi 7 nhánh ứng dụng cũ (trước đây vé không email lọt qua) → `database.rules.merged.json`.
- Test (đã chạy, PASS): `tests/test_presence_ui.cjs` (21), `test_worker_sheet_login.mjs`, `test_teacher_thi_ui.cjs` (50), `test_thi_sheet_ui.cjs` (36), `test_sheet_exam_gs.cjs`, shell/ui_standard/login_gate/role_isolation/exam_firebase_flow/fb_pin_sync/fonts.
- CHƯA chạy được: emulator luật (máy Claude không tải được jar). Ca mới đã viết sẵn trong `spike/step0/emulator/rules-merged.test.mjs` (69 ca).

## Việc của Antigravity (theo thứ tự, dừng nếu bước nào FAIL)
1. `git pull`.
2. Emulator: `cd spike/step0/emulator && npm ci && npm run test:merged` → phải in `TẤT CẢ 69 CA ĐÚNG`. Chạy thêm `npm test` (luật v2 cũ) phải xanh.
3. Lưu bản luật đang chạy (Firebase Console → Realtime Database → Rules → sao chép vào `spike/step0/database.rules.live-backup-<ngày>.json`), rồi publish `spike/step0/database.rules.merged.json`.
4. Worker: ghi lại ID bản đang chạy (`npx wrangler deployments list`), rồi `npx wrangler deploy`.
5. Kiểm thật (5 phút): trang giáo viên Ctrl+F5 → menu Thi → thẻ "Học sinh trực tuyến" phải báo "Đang cập nhật tức thì từ Firebase". Máy khác đăng nhập học sinh HS01 → trong vài giây bảng hiện "Đang học"; vào tab Thi → "Phòng chờ thi".
   - Nếu thẻ báo "Firebase từ chối quyền đọc" → luật chưa publish đúng.
   - Nếu học sinh không hiện: DevTools học sinh → Network → `accounts:signInWithCustomToken`; lỗi `INVALID_CUSTOM_TOKEN`/`CREDENTIAL_MISMATCH` nghĩa là service account của Worker (FIREBASE_CLIENT_EMAIL) không thuộc dự án `day-hoc-tuong-tac-7ee69` → báo Claude, không tự sửa.
6. Thất bại bước 5 → `npx wrangler rollback <ID bước 4>` và dán lại luật đã lưu ở bước 3.

## Xong khi
Emulator 69/69, luật đã publish, Worker đã deploy, bước 5 thấy trạng thái đổi trong vài giây. Ghi kết quả vào `aisgk.md`.
