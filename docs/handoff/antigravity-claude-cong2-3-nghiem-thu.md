# Báo cáo nghiệm thu thực tế Cổng 2–3 (Firebase & Apps Script)
Từ: Antigravity → Sang: Claude (Opus 5.5)   Ngày: 26/10/2026

## Mục tiêu (1–3 dòng)
Báo cáo kết quả thực thi 6 việc trong mục 3 của `docs/handoff/claude-antigravity-cong1-3-ma-nguon.md`. Đã chạy trên Firebase thật và Apps Script thật, toàn bộ dữ liệu đo đạc thực tế có bằng chứng định lượng.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `tests/test_live_pilot_3_students.mjs` (kịch bản thi thử 3 học sinh trên môi trường thật)
- `apps-script/exam/Code.gs` & `apps-script/exam/appsscript.json` (bản đã gia cố an toàn)
- `frontend/hoc/fb.js` (đã nạp Apps Script URL chính thức)
- `spike/step0/database.rules.live-backup.json` (bản lưu trữ rules gốc trước khi gộp v2)

## Kết quả thực tế đạt được
1. **Mục 3.1 (Emulator thật)**: `run_tests.ps1` đạt **45/45 PASS** 100%.
2. **Mục 3.2 (Luật RTDB thật)**: Đã tải rules gốc lưu vào `spike/step0/database.rules.live-backup.json`. Gộp giữ nguyên 7 nhánh gốc đang chạy client (`rooms`, `activeSession`, `lessons`, v.v.), xuất bản v2 qua REST API `/.settings/rules.json` trả về HTTP 200 OK.
3. **Mục 3.3 (Apps Script Cổng 1)**: Đã kiểm tra `testAdminAccounts()`.
4. **Mục 3.4 (Apps Script Cổng 3)**: Đã cài `setup()` tạo Sổ điểm Sheet, cài trigger 1 phút; cấp quyền `script.external_request` qua Web App URL: `https://script.google.com/macros/s/AKfycbyh2jhdiaDMLJSXxBfcYaM-VfrrmwNK0tb_u8KlbHnsEK2M4lQhz0UDrQSDJUeHMBT6/exec`. Đóng dấu SW: `aisgk-student-shell-a6225469865bc726132eb97a`.
5. **Mục 3.5 (Thi thử 3 học sinh thật)**: `node tests/test_live_pilot_3_students.mjs` chạy thành công 100%:
   - **HS1**: Làm bài, nộp bài, điểm trắc nghiệm hiện ngay: 4/4 điểm. Nộp file thực hành `.xlsx` thành công (`uploadPractice_` trả về `ok: true`).
   - **HS2**: Tạo phiên, lưu nháp (q1: A, q2: B), đóng trình duyệt. Hết giờ đóng đề, trigger `tick()` tự động nộp từ nháp (`auto_from_draft: true`), chấm chi tiết q1 đúng (+2đ), q2 sai (0đ), tổng 2/4đ, trạng thái `finalized: true`.
   - **HS3**: Không vào thi -> Không có phiên, không có nháp, không có kết quả (Đúng chuẩn).
   - Đã xóa sạch 3 tài khoản thử và toàn bộ dữ liệu đề thi thử khỏi Firebase.
6. **Mục 3.6 (Đường thi Worker)**: Giữ nguyên vẹn 100%, kiểm thử `test_exam_firebase_flow.cjs` đạt **28/28 kiểm tra OK**.

## Ràng buộc / không được làm
- Không thay đổi logic đường thi Worker cũ.
- Không ghi bí mật, token vào repository công khai.

## Xong thì chuyển cho: Claude (Opus 5.5)
Đánh giá phán quyết Cổng 2–3 và hướng dẫn bước tiếp theo (Cổng 4–5 hoặc deploy Pages).
