# Kiểm tra Windows, xác nhận Pages live và các bước thực tế trước Cổng 5
Từ: Antigravity → Sang: Người dùng   Ngày: 27/10/2026

## Mục tiêu (1–3 dòng)
Báo cáo kết quả kiểm thử Windows và xác nhận GitHub Pages live; hướng dẫn người dùng dán Code.gs New version, chạy setup(), kiemTraHeThong(), thử mở ứng dụng cũ và chạy thử 1 vòng soạn đề.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `apps-script/exam/Code.gs`
- `apps-script/exam/README.md`
- `docs/plans/cong5-thi-thu-phong-may.md`

## Kết quả kiểm thử Windows & GitHub Pages live (đã đạt)
1. `tests/test_apps_script_gradebook.cjs`: `APPS SCRIPT GRADEBOOK OK`
2. `tests/test_fb_pin_sync.cjs`: `FB PIN SYNC OK (8 kiểm tra)`
3. `tests/test_exam_firebase_flow.cjs`: `EXAM FIREBASE FLOW OK (28 kiểm tra)`
4. `tests/test_exam_student_ui.cjs`: `EXAM STUDENT UI OK`
5. `tests/test_role_isolation.cjs`: `ALL 4 ROLE ISOLATION TESTS PASSED`
6. `tests/test_login_gate.cjs`: `ALL 7 LOGIN GATE TESTS PASSED`
7. `tests/test_role_switch.cjs`: `ALL 235 ROLE SWITCH CHECKS PASSED`
8. `tests/test_role_switch_step_a.cjs`: `TẤT CẢ 5 TIÊU CHÍ BƯỚC A ĐỀU ĐẠT (PASS)`
9. `tests/test_submit_ack.cjs`: `SUBMIT ACK OK`
10. `tests/test_fonts_vietnamese.cjs`: `ALL FONT TESTS PASSED`
11. Đóng dấu PWA: `const CACHE = 'aisgk-student-shell-b8619930f9fcc54fc16ed6ff';`
12. GitHub Pages live: `sw.js` mang dấu trên, `fb.js` có `appsScriptUrl` chứa `bz5b5d`, phản hồi live `{"ok":true,"service":"aihoctap-exam"}`.

## Các bước người dùng cần thực hiện
1. **Dán Code.gs mới**: Mở Google Sheet sổ điểm → Tiện ích mở rộng → Apps Script → Dán toàn bộ `apps-script/exam/Code.gs` mới vào → Lưu.
2. **Deploy New version**: Nhấn Triển khai (Deploy) → Quản lý bản triển khai (Manage deployments) → Chọn bản Web App → Chỉnh sửa (biểu tượng bút chì) → Phiên bản: Chọn **Phiên bản mới** (New version) → Triển khai (Deploy).
3. **Chạy setup()**: Trong Apps Script, chọn hàm `setup` → Nhấn Chạy (Run) để tự động tạo tab mẫu `DE_mau` trong Google Sheet và kích hoạt trigger.
4. **Chạy kiemTraHeThong()**: Chọn hàm `kiemTraHeThong` → Nhấn Chạy (Run) → Xem Nhật ký thực thi (Execution log) xác nhận tất cả các mục đều ĐẠT.
5. **Mở thử ứng dụng cũ (Dạy học tương tác)**: Xác nhận học sinh cũ vẫn truy cập bình thường, không bị ảnh hưởng bởi luật RTDB mới.
6. **Thử 1 vòng soạn đề thật**:
   - Trong tab `DE_mau`: Đặt `Mở lúc` = thời gian hiện tại - 1 phút, `Đóng lúc` = hiện tại + 10 phút.
   - Tích vào ô B9 → Quan sát ô C9 chuyển thành ✔ (và ô B9 tự bỏ tích).
   - Dùng 1 tài khoản học sinh thử khối đó truy cập web (Pages hoặc local) → Vào tab Thi → Thấy đề → Làm và nộp bài → Kiểm tra điểm số hiển thị.
   - Đặt lại Mã đề khác cho tab mẫu để tránh xung đột bài thi thật sau này.

## Xong thì chuyển cho: Claude
