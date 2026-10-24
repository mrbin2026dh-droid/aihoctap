# Sửa Gate Code lần 3 (G1–G6) theo quy trình chuẩn
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Phán quyết lần 2 là YÊU CẦU ĐIỀU CHỈNH. Đáp ứng G1–G6, tuân thủ mục D của AGENTS.md (cấm hardcode, tách rõ THẬT và mock). Chưa bật Pages, chưa push.
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-gate-code-v2-verdict.md (G1–G6, kèm cách tái hiện)
- worker/index.js, tools/sanitize_curriculum.py
## Quy trình chuẩn bắt buộc (AGENTS.md, Hiến pháp) - ghi bằng chứng từng bước vào nhật ký
1. `context7-docs`: tra tài liệu Firebase custom token, Cloudflare Durable Objects và Worker Secrets TRƯỚC khi sửa code.
2. `bend-proof-driven`: viết hợp đồng/schema cho login, submit, unlock trước khi code.
3. `test-driven-development`: thêm test cho G1 (header giả bị 403), G2 (token ký bằng khóa service account, kiểm iss/aud/exp), G4 (thiếu GATE_DO trả 500); chạy thấy FAIL trước rồi mới sửa.
4. `alibaba-code-review` và `zero-bug-verification` (node --check, oxlint) sau khi code xong.
5. Nhật ký phải ghi rõ phần THẬT và phần MOCK; cấm ghi "chuẩn", "đáp ứng", "PASS 100%" cho phần mock.
## Chờ người dùng (mục D, điều 4)
Chưa nối RTDB, Gemini và khóa service account thật. Viết `docs/SETUP_FIREBASE_CLOUDFLARE.md` hướng dẫn người dùng tạo từng bước: dự án Firebase (RTDB, Authentication), service account, tài khoản Cloudflare (Worker, Durable Object), khóa Gemini, repo GitHub công khai mới. Nêu tên biến cần đặt, không dán bí mật vào chat hay nhật ký. Ghi "Chờ người dùng" cho phần này.
## Ràng buộc
- Không hardcode PIN, salt, secret, ID, email service account. Không push khi chưa có ACCEPT.
## Xong thì chuyển cho: Claude (kiểm định lại) và Người dùng (làm theo SETUP)
