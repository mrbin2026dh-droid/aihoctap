# Đóng 7 nhánh RTDB cũ với tài khoản hệ thống thi
Từ: Claude → Sang: Antigravity   Ngày: 27/10/2026

## Vấn đề
Luật đang publish để 7 nhánh của ứng dụng cũ (`rooms, remoteCommand, activeSession, lessons, sessionHistory, lessonPlans, questionBank`) là `auth != null`. Mọi tài khoản học sinh mới (`…@hs.aihoc.test`) đăng nhập xong là đọc/ghi được, kể cả `questionBank` (có thể chứa đáp án) và `remoteCommand` (điều khiển lớp học). Repo này không dùng nhánh nào trong số đó → chúng thuộc ứng dụng cũ.

## Đã làm (Claude)
- `spike/step0/build_merged.py`: sinh `database.rules.merged.json` từ `database.rules.v2.json` (nguồn duy nhất) + 7 nhánh cũ với luật
  `auth != null && (auth.token.email == null || !auth.token.email.endsWith('@hs.aihoc.test'))` → tài khoản ứng dụng cũ vẫn dùng bình thường, tài khoản hệ thống thi (học sinh và `gv_…`) bị chặn.
- `spike/step0/emulator/rules-merged.test.mjs` (42 ca, `npm run test:merged`). 10 nhánh thi giữ nguyên v2.

## Antigravity làm theo thứ tự
1. **Kiểm tra ứng dụng cũ không dùng đuôi `@hs.aihoc.test`:** `npx firebase auth:export users.json --project day-hoc-tuong-tac-7ee69`, đếm theo đuôi email (chỉ in số lượng mỗi đuôi, KHÔNG commit `users.json`, xóa file sau khi đếm). Nếu có tài khoản cũ dùng `@hs.aihoc.test` → DỪNG, báo Claude.
2. `cd spike/step0/emulator && npm test && npm run test:merged` → dán nguyên văn (45 + 42 ca).
3. Tải luật đang chạy về làm bản lưu: `npx firebase database:get /.settings/rules` (hoặc copy từ Console) → lưu `spike/step0/database.rules.live-backup-2026-10-27.json`.
4. Publish `database.rules.merged.json` (Console → Rules, hoặc `firebase deploy --only database` với file này).
5. Sau publish chạy lại `node tests/load_gate4.mjs --n=5 --mb=0` (luồng thi vẫn đạt) và nhờ người dùng mở ứng dụng cũ (Dạy học tương tác) bằng tài khoản giáo viên cũ xem còn chạy không. Hỏng thì publish lại bản lưu ở bước 3 ngay.
