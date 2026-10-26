# Phán quyết Cổng 3 và lệnh Cổng 4
Từ: Claude → Sang: Antigravity (và Người dùng)   Ngày: 26/10/2026

## Phán quyết
**Cổng 3: ĐẠT CÓ ĐIỀU KIỆN.** Phần tự động đạt thật (Drive thật, phiếu minh chứng thật, chốt điểm, tự nộp từ nháp, HS3 không có bản ghi). Đã kiểm lại: kiểm định cứng trong `tests/test_live_pilot_3_students.mjs` còn nguyên, `package_student_pwa --check` và `test_exam_firebase_flow.cjs` (28/28) xanh trên commit 86daaeb. Sửa `null index` của Antigravity (Firebase trả mảng khi khóa là 1,2) là đúng.

## Chưa chứng minh (làm nốt, không chặn Cổng 4)
1. **Pilot ghi bằng quyền quản trị.** `sessions`, `drafts`, `attempts` trong pilot đều ghi bằng token admin (bỏ qua luật). Luật RTDB chưa được thử trực tiếp bằng token học sinh trên Firebase thật (mới có 45 ca emulator). → Cổng 4 mới thử đúng điều này (`tests/load_gate4.mjs`, mục "luật").
2. Chưa thấy nội dung 2 phiếu minh chứng, chưa thấy 2 hàng sổ điểm, chưa thấy gõ điểm thực hành ở cột F rồi Tổng/phiếu đổi theo (`onGradebookEdit`). → Dán nội dung phiếu minh chứng của HS1 và ảnh/ghi chú 2 hàng sổ điểm; gõ thử điểm thực hành rồi dán kết quả.
3. Chưa có nhật ký `kiemTraHeThong()` (cho biết đang dùng OAuth hay `DB_SECRET`) và `testAdminAccounts()` (Đ2). Dán nguyên văn.
4. File thực hành trong pilot chỉ là chuỗi 38 byte, chưa phải .xlsx thật (Cổng 4 dùng file 10 MB ngẫu nhiên; thêm 1 file .xlsx thật mở được từ Drive).

## Việc dọn dẹp bắt buộc
- Địa chỉ `/exec` đã đổi nhiều lần (…bz-bNti…, …xIvXSX…, …bz5b5d…, bản gốc …yh2jh…). Vào Deploy → Manage deployments, **lưu trữ (Archive) mọi bản triển khai cũ**, chỉ giữ `…bz5b5dzfz9…`. Bản cũ chứa lỗi báo nộp file thành công giả; không được để đường nào còn sống.
- Xóa thư mục Drive thử của pilot (`9TEST`) sau khi chụp bằng chứng.

## CỔNG 4 — lệnh cho Antigravity
Chạy trên máy PC (có firebase-tools), dán nguyên văn kết quả, kể cả khi chưa đạt:
1. `node tests/load_gate4.mjs --n=100 --mb=0` — 100 học sinh đồng loạt đăng nhập, vào thi, lưu nháp, nộp; kiểm 5 ca luật bằng token học sinh (đọc `exam_secrets`, ghi `results`, ghi nháp bạn khác, tự kéo giờ, sửa `exam_meta`, nộp đè → đều phải bị chặn).
2. `node tests/load_gate4.mjs --n=30 --mb=10` — 30 học sinh nộp file 10 MB cùng lúc (mục tiêu ≤ 60 s, bắt buộc 30/30 không mất file). Nếu Apps Script từ chối payload ~13,4 MB (base64) thì ghi đúng lỗi, thử `--mb=5`, `--mb=8` để tìm ngưỡng thật, rồi báo Claude hạ `MAX_UPLOAD_BYTES`.
3. Thử `--n=30 --mb=10` hai lần cách nhau 5 phút (kiểm hạn mức Drive/Apps Script theo ngày).
Script chưa chạy thử trên Firebase thật (Claude không có quyền); nếu lỗi cú pháp/tham số thì sửa tại chỗ và ghi lại.

## Rủi ro mở (không thuộc Cổng 4)
7 nhánh dữ liệu cũ (rooms, lessons, questionBank…) vẫn cho mọi tài khoản đã đăng nhập đọc/ghi. Cần Claude rà riêng trước thi thật; nếu có đáp án trong đó thì học sinh đọc được.
