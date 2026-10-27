# Trạng thái trực tuyến trên MỘT dự án Firebase (đã chốt: quay lại 1 dự án)

## Quyết định
- Dùng đúng dự án mà Worker đang dùng: **`ai-sgk-tinhoc`**. Không tạo dự án mới, không cài thêm khóa nào: Worker ký vé bằng `FIREBASE_*` sẵn có (secret `PRESENCE_*` chỉ là tùy chọn, bỏ qua).
- Việc phải làm chỉ còn 3 thứ: (1) lấy **apiKey web** của dự án này, (2) **thêm đúng một nhánh `presence`** vào luật Firebase (không ghi đè luật cũ), (3) deploy Worker.
- Lỗi `CREDENTIAL_MISMATCH` trước đó do app trỏ sang dự án `day-hoc-tuong-tac-7ee69`; giờ app trỏ cùng dự án với khóa của Worker nên hết lệch.

## Người dùng làm (5 phút)
1. Firebase Console → dự án **ai-sgk-tinhoc** → bánh răng → Project settings → General → "Your apps". Nếu chưa có ứng dụng Web: bấm biểu tượng `</>` để tạo (không cần Hosting). Chép **apiKey** (chuỗi bắt đầu `AIza…`; là thông tin công khai) và gửi cho Claude/Antigravity.
2. Build → **Authentication → Get started** (chỉ cần bật dịch vụ; không bật phương thức đăng nhập nào).
3. Xác nhận địa chỉ cơ sở dữ liệu ở Realtime Database có dạng `https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app` (nếu khác, gửi địa chỉ đúng).
4. Báo Antigravity. Phần luật do Antigravity làm (có kiểm thử), không dán luật vào chỗ khác.

## Antigravity làm (theo thứ tự, dừng nếu một bước FAIL)
1. `git pull`. Mở `frontend/hoc/presence-config.js`: điền `apiKey` (và sửa `dbUrl` nếu người dùng báo khác).
2. **Luật (bước quan trọng, mức CAO):**
   a. Firebase Console → Realtime Database → Rules → sao chép NGUYÊN luật đang chạy vào `spike/step0/database.rules.live-ai-sgk-<ngày>.json` (bản sao lưu).
   b. Tạo bản gộp: thêm vào đối tượng `rules` của bản sao đúng một khóa `presence` lấy từ `spike/step0/database.rules.presence-branch.json`. Không sửa gì khác.
   c. Chạy `cd spike/step0/emulator && RULES_FILE=<đường dẫn bản gộp> npx firebase emulators:exec --only database --project demo-aihoctap "node rules-live-check.test.mjs"` → phải in `TẤT CẢ … CA ĐÚNG`.
   d. **Nếu có ca FAIL ở nhánh khác presence** (ví dụ luật cũ có `auth != null` hoặc `".read": true` ở nhánh nào đó): DỪNG, gửi Claude tên nhánh và dòng luật. Lý do: vé học sinh/giáo viên nay đăng nhập được vào dự án này nên luật cũ kiểu "ai đăng nhập cũng đọc/ghi" sẽ mở dữ liệu cho học sinh.
   e. Đạt thì Publish bản gộp.
3. `python3 tools/package_student_pwa.py --stamp` rồi `--check`; chạy `tests/test_presence_ui.cjs` và `tests/test_worker_sheet_login.mjs` (phải PASS).
4. Ghi ID Worker đang chạy (`npx wrangler deployments list`), `npx wrangler deploy`.
5. Smoke: đăng nhập học sinh thử → `fb_token` khác rỗng, giải mã phần giữa: `iss` = email `FIREBASE_CLIENT_EMAIL`. Gọi `accounts:signInWithCustomToken?key=<apiKey>` với vé đó → phải có `idToken` (không còn CREDENTIAL_MISMATCH).
6. Commit/push → chờ Pages → giáo viên đăng xuất rồi đăng nhập lại → menu Thi → "Học sinh trực tuyến" báo "Đang cập nhật tức thì từ Firebase"; máy khác đăng nhập học sinh → vài giây sau hiện "Đang học".
7. Sai bước 5/6 → `npx wrangler rollback <ID bước 4>` và dán lại luật đã sao lưu ở bước 2a; báo Claude kèm thông báo lỗi (không kèm khóa).
