# Bàn giao triển khai Worker chịu tải 100 học sinh (khóa IP riêng, lưu nháp nhẹ)
Từ: Antigravity → Sang: Người dùng   Ngày: 2026-10-26 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Bàn giao hệ thống Worker đã deploy bản mới (b0df0cc6-5973-42ed-b8a0-e27feab0d04b) từ commit cf1f2b7. Báo cáo kết quả smoke test live worker và thông tin gói dịch vụ Cloudflare Workers & Firebase để chuẩn bị chạy thử 30–100 máy thật.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- worker/index.js
- tests/test_class_shared_ip.mjs
- tools/load_sim_exam.mjs

## Kết quả đạt được (tiêu chí đạt)
1. Phiên bản Worker:
   - ID bản cũ: `6469df6f-0f2a-4137-a676-ba5388261964`
   - ID bản mới: `b0df0cc6-5973-42ed-b8a0-e27feab0d04b`
2. Smoke test endpoints thật (Live Production):
   - `GET https://aihoctap-gate.mrbin2026dh.workers.dev/api/health` → 200 OK (`{"status":"healthy","serverless":true}`)
   - `GET https://aihoctap-gate.mrbin2026dh.workers.dev/api/pwa/exams` (không token) → 401 Unauthorized (`{"detail":"Thiếu token xác thực."}`)
3. Kiểm thử tự động:
   - `tests/test_class_shared_ip.mjs` PASS 100% (`CLASS SHARED IP OK`).
   - `tools/load_sim_exam.mjs` mô phỏng kiểm tra tải không có lỗi logic.
   - `test_exam_backend.mjs`, `test_weakness_analytics.mjs`, `test_student_import_backend.mjs` PASS 100%.
4. Thông tin gói dịch vụ:
   - **Cloudflare Workers**: Gói **Free** (tiêu chuẩn, tài khoản `Mr.bin2026dh@gmail.com's Account`, hạn mức 100.000 requests/ngày, Durable Objects với SQLite backend miễn phí).
   - **Firebase**: Gói **Spark** (miễn phí 100%, 0 chi phí, không dùng Cloud Functions).

## Ràng buộc / không được làm
- Không dán mã PIN, token hay private key vào chat/log/Git.
- Chỉ dùng đề thi thử `[THỬ]` và tài khoản thử nghiệm khi chạy tải thực tế.

## Xong thì chuyển cho: Claude
