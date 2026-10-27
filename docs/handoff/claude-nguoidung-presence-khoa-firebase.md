# Claude → Người dùng (rồi Antigravity): bật bảng trực tuyến — khóa Firebase cho Worker

## Vì sao lỗi (Antigravity đã xác nhận)
Worker ký vé bằng service account của dự án `ai-sgk-tinhoc`, còn trạng thái trực tuyến nằm ở dự án `day-hoc-tuong-tac-7ee69` → Google trả `CREDENTIAL_MISMATCH` (400).
Sửa: Worker ký vé presence bằng khóa RIÊNG của dự án `day-hoc-tuong-tac-7ee69` (3 secret mới `PRESENCE_*`). Luật Firebase đã đạt 69/69 không đổi.
Chưa cài khóa thì app vẫn học/thi bình thường; menu Thi báo "Bảng trực tuyến chưa bật".

## Người dùng làm (bí mật — chỉ bạn làm, không dán vào chat/Git)
1. Firebase Console → chọn dự án **day-hoc-tuong-tac-7ee69** → bánh răng → Project settings → Service accounts → **Generate new private key** → tải file JSON (giữ kín, xóa sau khi xong).
2. Trong thư mục dự án chạy 3 lệnh, mỗi lệnh dán đúng một giá trị từ file JSON:
   - `npx wrangler secret put PRESENCE_CLIENT_EMAIL` → giá trị `client_email`
   - `npx wrangler secret put PRESENCE_PRIVATE_KEY_ID` → giá trị `private_key_id`
   - `npx wrangler secret put PRESENCE_PRIVATE_KEY` → giá trị `private_key` (cả dòng, gồm `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----\n`)
3. Báo Antigravity "đã cài 3 secret PRESENCE".

## Antigravity làm (sau khi người dùng xong bước 1–3)
1. `git pull`; ghi ID Worker đang chạy (`npx wrangler deployments list`); `npx wrangler deploy`.
2. Smoke: `/api/login` của học sinh thử trả `fb_token` khác rỗng; giải mã phần giữa: `iss` phải là email `…@day-hoc-tuong-tac-7ee69.iam.gserviceaccount.com`.
3. Gọi `accounts:signInWithCustomToken?key=<apiKey trong frontend/hoc/fb.js>` với `fb_token` → phải có `idToken` (không còn CREDENTIAL_MISMATCH).
4. Trang giáo viên: **đăng xuất rồi đăng nhập lại** → menu Thi → "Học sinh trực tuyến" báo "Đang cập nhật tức thì từ Firebase". Máy khác đăng nhập học sinh → trong vài giây hiện "Đang học".
5. Sai bước nào → `npx wrangler rollback <ID bước 1>` và báo Claude (dán thông báo lỗi, không dán khóa).

## Test đã chạy (PASS)
`tests/test_worker_sheet_login.mjs` (vé ký bằng khóa PRESENCE, chữ ký khớp, PEM có \n, thiếu khóa → fb_token rỗng, giáo viên có fb_token), `tests/test_presence_ui.cjs` (27), `tests/test_teacher_thi_ui.cjs` (50), test_worker_gate / student_contract / tutor_guardrails.
