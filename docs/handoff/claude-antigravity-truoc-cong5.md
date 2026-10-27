# Trước Cổng 5: phát hành bản sửa + kiểm tra
Từ: Claude → Sang: Antigravity   Ngày: 27/10/2026

## Phán quyết luật 7 nhánh cũ: ACCEPT
Đã đối chiếu: bản lưu `database.rules.live-backup-2026-10-27.json` trùng khớp luật cũ; 845 tài khoản cũ đều ẩn danh (không email) nên luật mới không chặn nhầm; 45 + 42 ca emulator và load_gate4 (5 HS, log trong docs/evidence) đạt. Còn chờ người dùng mở thử ứng dụng cũ (Dạy học tương tác) xác nhận vẫn chạy.

## Claude đã sửa (commit này) — Antigravity chỉ cần kiểm và phát hành
1. **Lỗi máy dùng chung (nặng cho phòng máy):** học sinh mở Tổng quan rồi Đăng xuất → em sau đăng nhập báo "Chưa thực hiện được" (nút đồng bộ bị xóa theo bảng tổng quan). Sửa trong `frontend/hoc/app.js` (handler `logout`, `identityUI`). Test hồi quy: `tests/test_fb_pin_sync.cjs` (đã kiểm: bỏ bản sửa → test FAIL).
2. **Đổi PIN làm lệch hai hệ thống:** học sinh đổi PIN ở ứng dụng → nay đổi luôn PIN hệ thống thi (`fb.changePassword`, Identity Toolkit `accounts:update` bằng idToken của chính em). Không đổi được → báo rõ.
3. **Không vào được hệ thống thi không còn im lặng:** tab Thi hiện dòng báo lý do (`.exam-fb-warn`).
4. **Soạn đề trong Sheet sổ điểm:** tab `DE_…`, tích ô B9 → phát hành (không cần menu; script không gắn Sheet vẫn chạy). Hiểu ngày giờ "28/10/2026 07:30" theo giờ Việt Nam; chặn sửa đề đã có học sinh vào; `setup()` tạo tab mẫu `DE_mau`. Trước đây `publishExamFromSheet` chỉ chạy được nếu script gắn với Sheet (chưa ai thử).
5. Test: `test_apps_script_gradebook.cjs` 32 ca (giả lập Apps Script), `test_fb_pin_sync.cjs` 8 ca; hồi quy xanh: exam_firebase_flow 28, exam_student_ui, role_isolation 4, login_gate 7, role_switch 235, role_switch_step_a, submit_ack, fonts; PWA đã đóng dấu lại.

## Antigravity làm
1. `git pull`; chạy lại đúng các test trên trên máy Windows, dán dòng cuối mỗi test.
2. Deploy GitHub Pages bản mới; mở trang thật, xác nhận `fb.js` có `appsScriptUrl` …bz5b5d… và `sw.js` mang dấu mới (dán dấu).
3. Người dùng dán `Code.gs` mới vào Apps Script → **Deploy New version** → chạy `setup()` (tạo tab `DE_mau`) → `kiemTraHeThong()` → dán nhật ký.
4. Thử thật một vòng soạn đề: trong tab `DE_mau` đặt Mở = bây giờ − 1 phút, Đóng = +10 phút, tích B9 → C9 ✔; đăng nhập 1 tài khoản thử khối đó trên trình duyệt → thấy đề, làm, nộp → có điểm; sau đó đặt lại Mã đề khác cho tab mẫu. Dán ảnh C9 và màn hình điểm.
5. Không sửa mã trong lượt này; lỗi thì ghi lại và chuyển Claude.

Xong khi: test xanh trên Windows, Pages mang dấu mới, một vòng soạn đề → học sinh thấy đề → nộp → có điểm chạy thật.
