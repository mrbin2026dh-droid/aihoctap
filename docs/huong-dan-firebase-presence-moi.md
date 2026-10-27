# Firebase mới cho trạng thái trực tuyến (hướng dẫn cho người dùng và Antigravity)

## Quyết định (Claude)
- Tạo **một dự án Firebase mới chỉ để chứa trạng thái trực tuyến** (nhánh `presence`). Đây đúng là chỗ đang lệch dự án gây `CREDENTIAL_MISMATCH`.
- **Không gộp** dữ liệu của Worker (tài khoản giáo viên, đáp án bài học, tiến độ, hạn mức AI đang nằm ở dự án `ai-sgk-tinhoc`) sang dự án mới: gộp nghĩa là phải chuyển dữ liệu thật, đổi toàn bộ `FIREBASE_*`, dễ hỏng đăng nhập giáo viên mà không thêm được gì cho tính năng trực tuyến. Worker tiếp tục dùng `FIREBASE_*` như hiện nay.
- Dự án mới không dính 7 nhánh của ứng dụng "Dạy học tương tác" và không có dữ liệu cũ nào (luật chỉ có `presence`, mọi nhánh khác đóng).
- Dự án `day-hoc-tuong-tac-7ee69` giữ nguyên cho ứng dụng cũ; hệ thống này không còn ghi gì vào đó.

## Người dùng làm trên Firebase Console (khoảng 10 phút, gói Spark miễn phí)
1. https://console.firebase.google.com → **Thêm dự án** → tên gợi ý `sgk-truc-tuyen` → tắt Google Analytics → Tạo.
2. **Build → Realtime Database → Create database** → vị trí **Singapore (asia-southeast1)** → chọn **Locked mode** → Enable.
3. Tab **Rules** → xóa hết, dán nội dung file `spike/step0/database.rules.presence.json` → **Publish**.
4. **Build → Authentication → Get started** (chỉ cần bật; không cần bật phương thức đăng nhập nào, vì vé do Worker cấp).
5. Bánh răng → **Project settings → General** → mục "Your apps" → biểu tượng `</>` (Web) → đặt tên bất kỳ → Register (không cần Hosting). Chép 2 giá trị công khai: **apiKey** và **databaseURL** (dạng `https://…firebasedatabase.app`) → gửi cho Claude/Antigravity (hai giá trị này không phải bí mật).
6. Cùng trang → tab **Service accounts → Generate new private key** → tải file JSON (**bí mật**, không dán vào chat/Git).
7. Trong thư mục dự án chạy 3 lệnh, mỗi lệnh dán một giá trị từ file JSON (cùng 3 tên secret đã dùng ở bàn giao trước):
   - `npx wrangler secret put PRESENCE_CLIENT_EMAIL` ← `client_email`
   - `npx wrangler secret put PRESENCE_PRIVATE_KEY_ID` ← `private_key_id`
   - `npx wrangler secret put PRESENCE_PRIVATE_KEY` ← `private_key` (cả đoạn BEGIN…END)
8. Xóa file JSON khỏi máy. (Nếu trước đó đã cài secret PRESENCE_* của dự án cũ thì lệnh trên ghi đè.)

## Antigravity làm (sau khi có apiKey, databaseURL và 3 secret)
1. `git pull`. Mở `frontend/hoc/presence-config.js`, điền `apiKey` và `dbUrl` (đúng hai giá trị bước 5). Không sửa `fb.js`.
2. Emulator: `cd spike/step0/emulator && npx firebase emulators:exec --only database --project demo-aihoctap "node rules-presence.test.mjs"` → phải in `TẤT CẢ 13 CA ĐÚNG`.
3. `python3 tools/package_student_pwa.py --stamp` rồi `--check`; chạy `tests/test_presence_ui.cjs` (phải PASS).
4. Ghi ID Worker đang chạy (`npx wrangler deployments list`), `npx wrangler deploy`.
5. Smoke: đăng nhập học sinh thử → `fb_token` khác rỗng, `iss` kết thúc bằng `@<id-dự-án-mới>.iam.gserviceaccount.com`; gọi `accounts:signInWithCustomToken?key=<apiKey mới>` với vé đó → có `idToken`.
6. Commit/push → chờ Pages deploy → giáo viên đăng xuất rồi đăng nhập lại → menu Thi → "Học sinh trực tuyến" báo "Đang cập nhật tức thì từ Firebase"; máy khác đăng nhập học sinh → trong vài giây hiện "Đang học", vào tab Thi → "Phòng chờ thi".
7. Sai bước 5/6 → `npx wrangler rollback <ID bước 4>`, báo Claude (kèm thông báo lỗi, không kèm khóa).

## Dọn dẹp sau khi chạy ổn (không gấp)
- Xóa file JSON service account đã tải; xóa các secret `PRESENCE_*` cũ nếu có từ dự án khác (ghi đè ở bước 7 là đủ).
- Luật cũ `database.rules.merged.json` (nhánh `presence` + chặn vé Worker khỏi 7 nhánh cũ) chỉ cần nếu dự án `day-hoc-tuong-tac-7ee69` còn dùng cho ứng dụng cũ; học sinh của hệ thống này không còn nhận vé của dự án đó.
