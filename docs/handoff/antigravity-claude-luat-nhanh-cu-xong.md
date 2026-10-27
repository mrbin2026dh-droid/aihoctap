# Báo cáo Thực hiện Đóng 7 Nhánh RTDB Cũ & Xuất bản Luật Merged

- **Từ:** Antigravity
- **Sang:** Claude (và Người dùng)
- **Ngày:** 27/10/2026
- **Trạng thái:** **HOÀN THÀNH TOÀN BỘ 5 BƯỚC THEO THỨ TỰ (PASS 100%)**

---

## 1. Bước 1: Kiểm tra tài khoản Firebase Auth
- Lệnh chạy: `npx firebase-tools auth:export users.json --project day-hoc-tuong-tac-7ee69`
- **Kết quả thống kê:**
  - Tổng số tài khoản trên dự án: **845** tài khoản.
  - Phân loại email domain: Toàn bộ 845 tài khoản đều không có domain (`no-domain` — tài khoản ẩn danh / khách tham gia phòng học tương tác cũ).
  - Số tài khoản có đuôi `@hs.aihoc.test`: **0** tài khoản.
- **Bảo mật:** Tệp `users.json` đã được xóa sạch ngay lập tức (`fs.unlinkSync`), không lưu trữ hay commit lên Git.

---

## 2. Bước 2: Chạy kiểm thử trên Firebase Emulator (45 + 42 ca)

### Lệnh 1: `npm test` (45 ca luật đường thi)
```text
i  emulators: Starting emulators: database
i  Running script: node rules.test.mjs
PASS 1.1 đọc đề trước giờ mở → chặn
PASS 1.5 giáo viên đọc đề mọi lúc → được
PASS 2.1 tạo phiên trước giờ mở → chặn
PASS 0.1 đọc đáp án exam_secrets → chặn
PASS 0.2 giáo viên đọc exam_secrets từ client → chặn (chỉ Apps Script)
PASS 0.3 đọc cả cây exam_questions → chặn
PASS 0.5 giáo viên đọc danh sách học sinh → được
PASS 0.6 học sinh đọc danh sách học sinh → chặn
PASS 0.7 giáo viên tự kiểm quyền teachers/{uid} → được
PASS 0.8 học sinh đọc cả nút teachers → chặn
PASS 0.4 học sinh tự sửa students/ của mình → chặn
PASS 1.2 đọc đề đúng giờ đúng khối → được
PASS 1.3 khối 8 đọc đề khối 9 → chặn
PASS 2.4 tạo phiên cho uid người khác → chặn
PASS 2.5 tạo phiên với started_at do client tự đặt → chặn
PASS 2.6 tạo phiên tự cộng extra_ms → chặn
PASS 2.7 tạo phiên thiếu extra_ms → chặn
PASS 2.2 tạo phiên đúng giờ → được
PASS 2.3 tạo phiên lần 2 → chặn
PASS 4.1 lưu nháp → được
PASS 4.4 nháp có leaves (số lần rời tab) → được
PASS 7.1 ghi đồng hồ clock/{uid} bằng giờ máy chủ → được
PASS 7.2 ghi clock/{uid} bằng giờ tự đặt → chặn
PASS 7.3 ghi clock của người khác → chặn
PASS 4.2 nháp có trường lạ → chặn
PASS 3.13 nộp bài khi chưa tạo phiên → chặn
PASS 3.4 câu trả lời 2500 ký tự → chặn
PASS 3.8 bài nộp có trường lạ (score) → chặn
PASS 3.1 nộp lần 1 trong giờ → được
PASS 3.5 nộp đè lần 1 → chặn
PASS 3.6 nộp lần 2 khi max_attempts=1 → chặn
PASS 3.9 học sinh đọc bài nộp của bạn → chặn
PASS 5.1 học sinh tự ghi results → chặn
PASS 5.2 giáo viên ghi results từ client → chặn
PASS 6.1 giáo viên đọc phiên cả đề → được
PASS 6.2 học sinh đọc phiên cả đề → chặn
PASS 3.2 nộp quá hạn → chặn
PASS 4.3 lưu nháp quá hạn → chặn
PASS 3.10 học sinh tự gia hạn extra_ms → chặn
PASS 3.3a giáo viên gia hạn 10 phút → được
PASS 3.3b sau gia hạn học sinh nộp được
PASS 6.3 giáo viên xóa phiên (đặt lại lượt) → được
PASS 3.11 nộp lần 2 khi chưa có lần 1 → chặn
PASS 3.7 nộp lần 2 khi max=2 và đã có lần 1 → được
PASS 3.12 nộp lần 3 → chặn

45/45 ca đúng trên Firebase Emulator thật
+  Script exited successfully (code 0)
```

### Lệnh 2: `npm run test:merged` (42 ca bảo vệ 7 nhánh cũ)
```text
i  emulators: Starting emulators: database
i  Running script: node rules-merged.test.mjs
PASS rooms: học sinh hệ thống thi đọc → chặn
PASS rooms: học sinh hệ thống thi ghi → chặn
PASS rooms: giáo viên hệ thống thi (gv_) đọc → chặn
PASS rooms: tài khoản ứng dụng cũ đọc/ghi → được
PASS rooms: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS rooms: chưa đăng nhập → chặn
PASS remoteCommand: học sinh hệ thống thi đọc → chặn
PASS remoteCommand: học sinh hệ thống thi ghi → chặn
PASS remoteCommand: giáo viên hệ thống thi (gv_) đọc → chặn
PASS remoteCommand: tài khoản ứng dụng cũ đọc/ghi → được
PASS remoteCommand: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS remoteCommand: chưa đăng nhập → chặn
PASS activeSession: học sinh hệ thống thi đọc → chặn
PASS activeSession: học sinh hệ thống thi ghi → chặn
PASS activeSession: giáo viên hệ thống thi (gv_) đọc → chặn
PASS activeSession: tài khoản ứng dụng cũ đọc/ghi → được
PASS activeSession: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS activeSession: chưa đăng nhập → chặn
PASS lessons: học sinh hệ thống thi đọc → chặn
PASS lessons: học sinh hệ thống thi ghi → chặn
PASS lessons: giáo viên hệ thống thi (gv_) đọc → chặn
PASS lessons: tài khoản ứng dụng cũ đọc/ghi → được
PASS lessons: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS lessons: chưa đăng nhập → chặn
PASS sessionHistory: học sinh hệ thống thi đọc → chặn
PASS sessionHistory: học sinh hệ thống thi ghi → chặn
PASS sessionHistory: giáo viên hệ thống thi (gv_) đọc → chặn
PASS sessionHistory: tài khoản ứng dụng cũ đọc/ghi → được
PASS sessionHistory: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS sessionHistory: chưa đăng nhập → chặn
PASS lessonPlans: học sinh hệ thống thi đọc → chặn
PASS lessonPlans: học sinh hệ thống thi ghi → chặn
PASS lessonPlans: giáo viên hệ thống thi (gv_) đọc → chặn
PASS lessonPlans: tài khoản ứng dụng cũ đọc/ghi → được
PASS lessonPlans: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS lessonPlans: chưa đăng nhập → chặn
PASS questionBank: học sinh hệ thống thi đọc → chặn
PASS questionBank: học sinh hệ thống thi ghi → chặn
PASS questionBank: giáo viên hệ thống thi (gv_) đọc → chặn
PASS questionBank: tài khoản ứng dụng cũ đọc/ghi → được
PASS questionBank: tài khoản ẩn danh (ứng dụng cũ) đọc → được
PASS questionBank: chưa đăng nhập → chặn
TẤT CẢ 42 CA ĐÚNG
+  Script exited successfully (code 0)
```

---

## 3. Bước 3: Tải và lưu bản backup luật đang chạy
- Đã tải toàn bộ luật RTDB trước khi thay đổi và lưu tại:  
  `spike/step0/database.rules.live-backup-2026-10-27.json` (143 dòng, kích thước 4.9 KB).

---

## 4. Bước 4: Xuất bản luật `database.rules.merged.json` lên Firebase thật
- Đã thực hiện `PUT /.settings/rules.json` với token chủ dự án.
- Phản hồi từ Firebase RTDB: `HTTP 200 {"status":"ok"}`.
- Kiểm tra lại: RTDB xác nhận luật mới đã hoạt động thật trên đám mây.

---

## 5. Bước 5: Kiểm tra tải hồi quy sau khi xuất bản
```bash
node tests/load_gate4.mjs --n=5 --mb=0
```
**Kết quả nguyên văn:**
```text
# commit 3dfca3a; sha256(script)=93828b613ff82366; args=--n=5 --mb=0
=== CỔNG 4: 5 học sinh, file 0 MB, đề load_tin9_66574 ===
Đã tạo 5 tài khoản.
Đăng nhập đồng loạt: n=5 p50=305ms p95=311ms max=311ms
Kiểm luật bằng token học sinh…
✔ luật: HS đọc exam_secrets → HTTP 401 (bị chặn)
✔ luật: HS ghi results → HTTP 401 (bị chặn)
✔ luật: HS ghi nháp của bạn khác → HTTP 401 (bị chặn)
✔ luật: HS tự kéo dài giờ (extra_ms) → HTTP 401 (bị chặn)
✔ luật: HS sửa exam_meta → HTTP 401 (bị chặn)
Vào thi (đồng hồ + phiên + tải đề): n=5 p50=231ms p95=334ms max=334ms
Lưu nháp: n=5 p50=75ms p95=278ms max=278ms
Nộp bài (ghi attempts): n=5 p50=72ms p95=186ms max=186ms
✔ luật: nộp đè attempts/1 → HTTP 401
Chấm ngay đồng loạt: 5/5 trả điểm ngay (phần còn lại sẽ được trigger tick() chấm bù)
grade_my_attempt: n=5 p50=4285ms p95=4698ms max=4698ms
Đã dọn tài khoản và dữ liệu RTDB. File Drive thử: thư mục lớp "9LOAD" — xóa tay.

=== CỔNG 4 ĐẠT ===
```
- **Nhận xét:** Đường thi hoạt động hoàn hảo 100%, cả 6 ca luật bảo mật RTDB đều bị chặn HTTP 401, không bị ảnh hưởng bởi việc đóng 7 nhánh cũ.
