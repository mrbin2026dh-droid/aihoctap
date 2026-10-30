# Báo cáo: Kết quả kiểm thử luật Firebase trên Emulator, triển khai Bảng thi đua và sẵn sàng nghiệm thu bản thật (30/10/2026)

> **Thực hiện**: Antigravity  
> **Kính gửi**: Claude (Auditor & Phán quyết độc lập)  
> **Cam kết trung thực**:
> - Phần Emulator và Test tự động: Chạy 100% trên Firebase Database Emulator cục bộ và Playwright headless.
> - Phần Web Client: Đã cập nhật bản mới nhất trên https://aihoctap.online (khớp phiên bản `?v=20261030c`).
> - Phần Firebase Console thật & Mở phòng thật: Cần Thầy thao tác bằng tài khoản giáo viên thật.

---

## 1. Kết quả kiểm thử luật Firebase trên Emulator cục bộ

Đã cấu hình môi trường Java 21 OpenJDK và chạy toàn bộ các tệp test luật trong `spike/step0/emulator/`:

### A. Kiểm thử luật Bảng thi đua (`rules-thidua.test.mjs`)
- **Lệnh chạy**:
  ```powershell
  $env:RULES_FILE = "../database.rules.ai-sgk-final.json";
  .\node_modules\.bin\firebase.cmd emulators:exec --only database --project demo-aihoctap "node rules-thidua.test.mjs"
  ```
- **Kết quả nguyên văn**:
  ```text
  PASS đọc công khai (học sinh xem bảng của lớp)
  PASS ghi kèm khóa phòng đúng → được
  PASS ghi đè buổi đã lưu → chặn (kết quả không sửa được)
  PASS không có khóa phòng → chặn
  PASS khóa sai → chặn
  PASS phòng không tồn tại → chặn
  PASS số câu đúng > số câu → chặn
  PASS tháng sai dạng → chặn
  PASS trường lạ → chặn
  PASS giáo viên bỏ buổi khỏi thi đua (có khóa) → được
  PASS học sinh tự xóa buổi (không khóa) → chặn
  PASS quiz_ls: không liệt kê được
  PASS quiz_ls: đường dẫn bí mật 64 ký tự đọc/ghi được
  PASS quiz_ls: đường dẫn ngắn → chặn
  THI DUA RULES OK
  +  Script exited successfully (code 0)
  ```
  👉 **ĐẠT 100%**: Mọi ràng buộc an toàn (ghi 1 lần, chống sửa điểm, khóa phòng 48 ký tự, đường dẫn lịch sử 64 ký tự) đều hoạt động chính xác.

### B. Kiểm thử luật Thi thật (`rules-thi-that.test.mjs`)
- **Kết quả**:
  ```text
  PASS thi_goi_y: không ai đọc được (gợi ý chấm tự luận)
  PASS thi_tt: đọc công khai (học sinh biết trạng thái của mình)
  PASS thi_tt: học sinh tự mở thi cho mình (chua_mo → chua_thi) → chặn
  PASS thi_tt: học sinh tự đổi Đã thi → Thi lại → chặn
  PASS thi_tt: đổi sang Đã thi mà không nộp bài → chặn
  PASS thi_nop: Chưa mở thi → chặn
  PASS thi_nop: Chưa thi, nộp + đổi Đã thi cùng lúc → được
  PASS thi_nop: vừa nộp xong (Đã thi) nộp lần nữa → chặn
  PASS thi_nop: Đã thi → chặn
  PASS thi_nop: Thi lại → được (lần 2)
  PASS thi_nop: chỉ ghi thi_nop mà không đổi trạng thái → chặn
  PASS thi_nop: thi thật gửi kèm điểm → chặn (Sheet chấm)
  PASS thi_nop: trường lạ → chặn
  PASS thi_nop: Trắc nghiệm + Thực hành chưa có file thực hành → chặn
  PASS thi_nop: Trắc nghiệm + Thực hành đã có file (thi_th) → được
  PASS thi_tien_do: đang được mở thi → được
  PASS thi_tien_do: Chưa mở thi → chặn
  PASS thi_tien_do: số lạ → chặn
  PASS thi_drive / thi_ip / thi_cfg: đọc được, học sinh không ghi
  PASS thi thử vẫn như cũ: nộp có điểm, nhiều lần → được
  THI THAT RULES OK
  +  Script exited successfully (code 0)
  ```
  👉 **ĐẠT 100%**.

### C. Các tệp test luật khác trong kho
- `rules-merged.test.mjs`: **TẤT CẢ 69 CA ĐÚNG** (Khởi chạy qua `npm run test:merged`).
- `rules.test.mjs`: **45/45 ca đúng trên Firebase Emulator thật** (Khởi chạy qua `npm test`).
- *Lưu ý về `rules-thi-fast.test.mjs`*: Tệp test cũ (tạo ngày 28/10) có 1 ca `set thi_nop` đơn lẻ bị `PERMISSION_DENIED` do Claude đã nâng cấp luật `thi_nop` yêu cầu cập nhật nguyên tử cùng trạng thái `thi_tt = 'da_thi'` trong kiến trúc Thi thật theo ca (đã được bao phủ và chứng minh xanh hoàn toàn bởi `rules-thi-that.test.mjs`).

---

## 2. Triển khai Web Client & Kiểm tra phiên bản trên máy chủ thật

- **GitHub Pages**: Đã tự động triển khai thành công commit `986705d` (Run ID: `41011959214`, hoàn thành trong 18s).
- **Kiểm tra phiên bản**:
  ```bash
  curl -s https://aihoctap.online/teacher.html | grep "20261030c"
  ```
  👉 **Kết quả**: `<script type="module" src="./teacher.js?v=20261030c"></script>` (Khớp 100% phiên bản mới nhất).
- **Kiểm tra tài nguyên**:
  + `curl -I https://aihoctap.online/thidua-play.js` -> `HTTP/1.1 200 OK`.
  + `curl -I https://aihoctap.online/thidua-core.js` -> `HTTP/1.1 200 OK`.
- **Dấu đóng gói Service Worker**: `python tools/package_student_pwa.py --check` đạt **PASS 100%** (`aisgk-student-shell-468168d0352700e0818a0c35`).

---

## 3. Kết quả chạy bộ kiểm thử tính năng Thi đua
- `tests/test_thidua_core.mjs`: **PASS 20/20** (tính toán phân số BigInt, làm tròn nửa lên 2 chữ số, quy tắc 60% làm tròn lên, bằng điểm/bằng câu, danh hiệu Chăm chỉ/Tiến bộ).
- `tests/test_thidua_ui.cjs`: **PASS 26/26** (kiểm định giao diện học sinh chỉ thấy top 10 và khoảng cách điểm của mình, không lộ điểm bạn khác, responsive 390px, giao diện giáo viên).
- `tests/test_quiz_live.cjs`: **PASS 67/67** (lưu số câu đúng từng em theo lớp và tháng, ghi lịch sử giáo viên, tab Thi đua, tải CSV, chốt tháng, bỏ buổi).

---

## 4. Công cụ hỗ trợ Thầy kiểm tra thực tế trên bản thật
Đã chuẩn bị script tự động cho 3 học sinh ảo: [tests/sim/auto_students_quiz_live.cjs](file:///c:/Users/HPZBook/Desktop/AI AGENT SGK/tests/sim/auto_students_quiz_live.cjs).

Thầy chỉ cần:
1. Đăng luật `spike/step0/database.rules.ai-sgk-final.json` lên Firebase Console và bấm Publish.
2. Mở trình duyệt giáo viên thật `https://aihoctap.online/teacher.html`, mở phòng Luyện tập cho lớp `9TH`.
3. Chạy lệnh:
   - Buổi 1 (3 em TH9001, TH9002, TH9003 tham gia):
     ```powershell
     node tests/sim/auto_students_quiz_live.cjs buoi1
     ```
   - Buổi 2 (2 em TH9001, TH9002 tham gia):
     ```powershell
     node tests/sim/auto_students_quiz_live.cjs buoi2
     ```
   *(Script sẽ tự động đăng nhập, trả lời câu hỏi và chụp ảnh Bảng thi đua trên giao diện điện thoại của học sinh để lưu minh chứng)*.
