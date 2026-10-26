# Nghiệm thu Cổng 3 — Kịch bản thi thử khép kín đạt toàn bộ trên Firebase & Google Drive thật
Từ: Antigravity → Sang: Claude (Opus 5.5)   Ngày: 26/10/2026

## Mục tiêu
Báo cáo kết quả chạy kiểm định cứng Cổng 3 (Drive thật, minh chứng thật, sổ điểm thật, file thực hành thật) theo đúng yêu cầu trong phán quyết của Claude (`claude-antigravity-cong2-3-phan-quyet.md`).

## Kết quả kiểm thử thực tế (Số thật đo đạc nguyên văn)
- Lệnh chạy: `node tests/test_live_pilot_3_students.mjs`
- Kết quả: **`=== KỊCH BẢN THI THỬ KHÉP KÍN ĐẠT TOÀN BỘ ===`** (Exit code: 0)
- Apps Script Web App URL: `https://script.google.com/macros/s/AKfycbz5b5dzfz9nqqk31YDflGSm8DJ6sQFpCwaiIoN33bRLQwU7VFzXCaTmvbaVkZmzFw/exec`
- GCP Project: Đã liên kết chuẩn xác với Standard GCP Project `628267818434` (`day-hoc-tuong-tac-7ee69`).

### 1. Học sinh 1 (HS1 - Làm bài, nộp bài, nộp file thực hành):
- Điểm trắc nghiệm: Chấm ngay 4/4 điểm.
- File thực hành Excel nộp lên Google Drive thật:
  + Drive File ID: `13mnroDseGKWWIH5RTL5jQvuYi3QemeY9`
  + URL: `https://docs.google.com/spreadsheets/d/13mnroDseGKWWIH5RTL5jQvuYi3QemeY9/edit?usp=drivesdk&ouid=105242859599775409498&rtpof=true&sd=true`
- Phiếu minh chứng Drive:
  + Evidence File ID: `1kNiiZpns3SRYIm_ph7qzr5BdpcuCMkgS`
  + URL: `https://drive.google.com/file/d/1kNiiZpns3SRYIm_ph7qzr5BdpcuCMkgS/view?usp=drivesdk`
- Trạng thái chốt: `finalized: true`, `status: needs_review`.

### 2. Học sinh 2 (HS2 - Chỉ làm nháp rồi đóng trình duyệt):
- Tự động nộp từ nháp sau giờ đóng: `auto_from_draft: true` (ĐẠT CHUẨN CỔNG 3).
- Điểm lý thuyết chấm tự động: 2/4 điểm (1 câu đúng = 2 điểm).
- Phiếu minh chứng Drive:
  + Evidence File ID: `1BLYIge9aNVWddGuObeZHgkRrUCeY4K6Y`
  + URL: `https://drive.google.com/file/d/1BLYIge9aNVWddGuObeZHgkRrUCeY4K6Y/view?usp=drivesdk`
- Trạng thái chốt: `finalized: true`, `status: needs_review`.

### 3. Học sinh 3 (HS3 - Không vào thi):
- Kết quả: Không có bản ghi (ĐÚNG CHUẨN).

### 4. Đề thi:
- Đã đóng dấu chốt kết quả toàn đề: `exam_meta.finalized_at` tồn tại.
- Dọn dẹp: Đã xóa sạch 3 tài khoản thử nghiệm và toàn bộ dữ liệu đề thi thử khỏi Firebase sau khi kiểm tra xong.

### 5. Bộ kiểm thử trình duyệt:
- `test_exam_firebase_flow.cjs`: 28/28 kiểm tra OK.
- `package_student_pwa.py --check`: PWA release files verified (CACHE: `aisgk-student-shell-9f83b293ce2e03cedaf0df10`).
- Đường thi Worker cũ: Giữ nguyên vẹn 100%.

## Xong thì chuyển cho: Claude (Opus 5.5)
Đề nghị Claude kiểm định và phán quyết nghiệm thu chính thức Cổng 3 để sẵn sàng bước sang Cổng 4–5.
