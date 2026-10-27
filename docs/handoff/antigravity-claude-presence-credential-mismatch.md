# Báo cáo: CREDENTIAL_MISMATCH tại accounts:signInWithCustomToken (Service Account khác Project)
Từ: Antigravity → Sang: Claude   Ngày: 27/10/2026

## Mục tiêu (1–3 dòng)
- Báo cáo kết quả chạy kiểm thử Cổng Presence và phát hiện lỗi `CREDENTIAL_MISMATCH` tại bước 5 / điều 18 như Claude đã dự kiến.
- Đã rollback Worker về `70b4a7cd-dc12-4a25-a166-13901ccb1194` an toàn.

## Tệp cần đọc
- `docs/handoff/claude-antigravity-presence-firebase.md` (điều 18)
- `frontend/hoc/fb.js` (dòng 8-9)

## Kết quả kiểm thử thực tế
1. **Emulator (Bước 2)**:
   - `rules-merged.test.mjs`: `TẤT CẢ 69 CA ĐÚNG` (PASS 100%).
   - `rules.test.mjs`: `45/45 ca đúng trên Firebase Emulator thật` (PASS 100%).
2. **Deploy Worker (Bước 4)**:
   - Đã deploy lên bản mới `6b529b20-0327-4f5b-9baa-13195e45440c`.
   - Smoke test `/api/login`: 200 OK, trả đủ `token` và `fb_token`.
3. **Kiểm tra Bước 5 & Điều 18 (Bắt đúng lỗi dự kiến)**:
   - Gọi `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=<apiKey của fb.js>` với `fb_token` thì Identity Toolkit trả:
     ```json
     HTTP 400: {"error": {"code": 400, "message": "CREDENTIAL_MISMATCH"}}
     ```
   - **Nguyên nhân chính xác**:
     - `fb_token` do Worker ký bằng Service Account có `iss`: `firebase-adminsdk-fbsvc@ai-sgk-tinhoc.iam.gserviceaccount.com` (Project: `ai-sgk-tinhoc`).
     - Trong khi `apiKey` và `dbUrl` trong `frontend/hoc/fb.js` thuộc Project: `day-hoc-tuong-tac-7ee69`.
     - Hai dự án Firebase không khớp nhau nên Google từ chối cấp `idToken`.
4. **Xử lý theo Điều 19**:
   - Đã chạy `npx wrangler rollback 70b4a7cd-dc12-4a25-a166-13901ccb1194` thành công 100%.

## Ràng buộc / Không được làm
- Theo đúng Điều 18: Antigravity không tự sửa bí mật hoặc đổi cấu hình Service Account, dừng lại và bàn giao cho Claude.

## Xong thì chuyển cho: Claude
