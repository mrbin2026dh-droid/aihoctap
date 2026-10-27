# Bàn giao: siết luật Firebase (ai-sgk-tinhoc) + triển khai lại Worker
Từ: Claude → Sang: Antigravity   Ngày: 27/10/2026   Mức độ: KHẨN (luật hiện tại mở cho mọi người đọc/ghi đến 18/11/2026)

## Mục tiêu
1. Thay luật test-mode (`now < 1794934800000`) bằng luật đóng, giữ đọc công khai `catalog` và `packages` (Worker có 2–3 chỗ gọi không xác thực), thêm nhánh `presence`.
2. Triển khai lại Worker để cấp vé Firebase 1 giờ cho học sinh/giáo viên.

## Tệp
- `spike/step0/database.rules.ai-sgk-final.json` (luật mới)
- `spike/step0/emulator/rules-live-check.test.mjs`

## CẬP NHẬT 27/10 19:xx — thi nhanh không qua Worker
Luật đã thêm nhánh `thi_hs/thi_bai/thi_de` (chỉ đọc), `thi_vao/thi_nop` (học sinh ghi có điều kiện) và `presence` ghi KHÔNG cần vé.
Chạy thêm: `cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-fast.test.mjs"` (phải TẤT CẢ CA ĐÚNG).
`rules-live-check.test.mjs` cũ có các ca presence theo vé → nay sai theo thiết kế mới, bỏ qua các ca presence của nó.
Người dùng có thể tự dán luật (docs/huong-dan-thi-firebase-nhanh.md). Deploy lại Worker KHÔNG còn bắt buộc cho thi/trực tuyến.

## Việc làm (theo thứ tự, dừng và báo nếu bước nào lỗi)
1. Console Firebase → Realtime Database → Rules: **sao lưu luật hiện tại** vào `docs/handoff/` (chỉ nội dung luật, không bí mật).
2. Emulator: `cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json PUBLIC_READ=catalog,packages npx firebase emulators:exec --only database --project demo-aihoctap "node rules-live-check.test.mjs"` — phải đạt toàn bộ.
3. Kiểm tra không có ứng dụng cũ nào (app Python/legacy client) đọc ghi trực tiếp RTDB không qua Worker. Nếu có → dừng, báo Claude.
4. Publish luật mới. Smoke: Worker `/api/login` vẫn 200; trang học vẫn tải danh mục.
5. Ghi ID bản Worker hiện tại (`npx wrangler deployments list`), `npx wrangler deploy`. Smoke: `fb_token` có `iss` = FIREBASE_CLIENT_EMAIL; `signInWithCustomToken` trả `idToken`; giáo viên đăng nhập thấy bảng trực tuyến. Lỗi → `wrangler rollback <ID cũ>`.

## Không được làm
- Không in/ghi khóa bí mật vào chat, Git hay tệp bàn giao. Không đổi dự án Firebase.

## Xong thì chuyển cho: Claude (báo kết quả từng bước vào aisgk.md)
