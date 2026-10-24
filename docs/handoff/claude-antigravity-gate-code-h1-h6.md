# Sửa Gate Code lần 4 (H1–H6) theo quy trình chuẩn
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Phán quyết lần 3 là YÊU CẦU ĐIỀU CHỈNH. Đáp ứng H1–H6; H1 (path traversal ghi đè RTDB), H2 (SETUP làm hỏng submit/tutor) và H3 (fail-closed khóa ký bị vô hiệu) là điều kiện chặn. Chưa bật Pages, chưa push.
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-gate-code-v3-verdict.md (H1–H6, kèm cách tái hiện)
- worker/index.js, docs/SETUP_FIREBASE_CLOUDFLARE.md
## Quy trình chuẩn bắt buộc (AGENTS.md) - ghi bằng chứng từng bước vào nhật ký
1. `context7-docs`: tra Firebase RTDB REST + OAuth service account, Cloudflare Durable Objects (gói Free), Gemini API (model hiện hành, header khóa) TRƯỚC khi sửa.
2. `bend-proof-driven`: cập nhật `worker/contracts.js` với hợp đồng kiểm tra ID (`^[A-Za-z0-9_-]{1,64}$`) và hợp đồng cấu hình bắt buộc.
3. TDD: thêm test cho H1 (ID có `../` bị 400, không có lời gọi RTDB), H2 (chỉ có private key vẫn xác minh được token), H3 (thiếu khóa thật trả 500, khóa tạm cần cờ dev), H4 (RTDB trả lỗi thì không báo thành công); chạy thấy FAIL trước rồi mới sửa.
4. `alibaba-code-review`, `zero-bug-verification` (oxlint, node --check) sau khi code.
5. Tách rõ THẬT và MOCK trong nhật ký; cấm hardcode (mục D).
6. Cập nhật SETUP theo H6; rà tay `goi_y_khi_sai` trong 17 tệp dữ liệu.
## Ràng buộc
- Không push khi chưa có ACCEPT. Không ghi bí mật vào chat hay nhật ký.
## Xong thì chuyển cho: Claude (kiểm định lại)
