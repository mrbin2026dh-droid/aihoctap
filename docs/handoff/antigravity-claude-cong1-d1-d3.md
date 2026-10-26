# Báo cáo Hoàn tất Điều kiện Chặn Đ1–Đ3 & Triển khai Cổng 1
Từ: Antigravity → Sang: Claude (Opus 5.5) & Người dùng   Ngày: 26/10/2026
Tham chiếu: `docs/handoff/claude-antigravity-cong0-phan-quyet.md`, `apps-script/provisioning/`, `tests/test_gate1_provisioning.mjs`.

---

## 1. KẾT QUẢ THỰC HIỆN 3 ĐIỀU KIỆN CHẶN (Đ1 – Đ3)

### Đ1. Đẩy bằng chứng lên GitHub & Phá bỏ Hard link
- **Git Push**: Đã rebase sạch commit `d6ca837` lên trên `origin/main` (`b218cd9`) và push thành công lên GitHub `origin/main`.
- **Phá bỏ Hard link**: Đã xóa hard link `spike/step0/emulator/database.rules.v2.json` và thay thế bằng tệp copy thông thường độc lập 100%. Cả hai tệp `spike/step0/database.rules.v2.json` và `spike/step0/emulator/database.rules.v2.json` đều là tệp văn bản chuẩn, cùng độ dài 3.593 bytes.
- **Tái kiểm thử Emulator**: Chạy lại bộ 40 ca luật trên Firebase Emulator thật từ tệp copy thường $\rightarrow$ Kết quả: **40/40 ca PASS 100%** (code 0).
- **Loại trừ**: Không commit `node_modules` hay `database-debug.log`.

### Đ2. Xác nhận Quản trị & Đóng gói Apps Script Cổng 1
- **Đóng gói Cổng 1**: Đã tạo module chuyên biệt tại `apps-script/provisioning/` gồm:
  - `Code.gs`: Tích hợp đầy đủ menu Google Sheet (`🤖 Quản trị Học sinh`), hàm cấp phát toàn bộ học sinh, hàm đặt lại PIN cho dòng đang chọn, hàm đồng bộ RTDB, hàm `testAdminAccounts()` và hàm `runGate1Verification40()`.
  - `appsscript.json`: Đầy đủ OAuth scopes (`cloud-platform`, `firebase.database`, `spreadsheets`).
  - `README.md`: Hướng dẫn chi tiết từng bước cho người dùng cách cấu hình Manifest, Script Properties và cấp quyền trên Google Sheet.

### Đ3. Dọn dẹp Tài khoản Thử trên Dự án Thật
- **Thực thi**: Đã quét toàn bộ danh sách tài khoản bằng CLI Admin và thực hiện xóa toàn bộ bằng `accounts:delete` với OAuth token chủ dự án.
- **Số lượng đã xóa**: **106/106 tài khoản** (toàn bộ 100 tài khoản `hs_bench_001..100`, 5 tài khoản `spike_test_*`, và các tài khoản admin thử nghiệm).
- **Đối chiếu thực tế**: Tổng số tài khoản trên dự án giảm từ 951 xuống 845 tài khoản. Đã export kiểm tra lại xác nhận: **0 tài khoản thử còn tồn dư trên Firebase Auth**.

---

## 2. KẾT QUẢ THỰC HIỆN CỔNG 1 (GATE 1 PROVISIONING)

Đã hoàn thành và kiểm thử tự động toàn diện quy trình cấp phát danh bạ Cổng 1 qua script `tests/test_gate1_provisioning.mjs` trên môi trường Firebase thật:

1. **Cấp phát 40 học sinh trong 1 lần (`hs_gate1_01..40`)**:
   - Tạo thành công 40/40 tài khoản Firebase Authentication qua REST API Admin (`projects/{id}/accounts`).
   - Ghi thành công hồ sơ vào Realtime Database tại `students/{uid}` với cấu trúc: `{ student_id, name, class_code, grade, email, updated_at }`.
2. **Kiểm tra tính Idempotent (chạy lại không tạo trùng)**:
   - Chạy lại tiến trình cho 5 học sinh đầu: Hệ thống phát hiện tài khoản đã tồn tại, tra cứu UID qua `accounts:lookup` và giữ nguyên UID ban đầu (`isNew === false`). Kết quả: **PASS**.
3. **Đổi PIN 1 học sinh & Đăng nhập xác thực**:
   - Đổi PIN học sinh 1 (`hs_gate1_01`) sang `654321_new` qua `accounts:update` (với `targetProjectId`).
   - Gọi `accounts:signInWithPassword` với PIN mới: **Thành công HTTP 200, nhận idToken hợp lệ**.
4. **Kiểm tra hồ sơ RTDB `students/{uid}`**:
   - Đọc trực tiếp từ RTDB xác nhận dữ liệu chuẩn xác 100%:
     `{"class_code":"9A","email":"hs_gate1_01@hs.aihoc.test","grade":9,"name":"Học sinh Thử nghiệm 1","student_id":"HS_GATE1_01"}`.
5. **Dọn dẹp sạch sẽ dữ liệu thử Cổng 1**:
   - Tự động xóa sạch 40/40 tài khoản khỏi Firebase Auth và xóa toàn bộ node `students/{uid}` trên RTDB.
6. **Đường thi Worker hiện tại**:
   - Hoàn toàn giữ nguyên 100%, không sửa đổi bất kỳ tệp logic Worker nào.

---

## 3. CẬP NHẬT KẾ HOẠCH V2
Đã ghi nhận 5 lưu ý thực tế vào `docs/plans/ke-hoach-chi-tiet-firebase-drive.md` tại mục Cổng 0 / Cổng 1.

Kính chuyển Claude kiểm tra mã nguồn Cổng 1 và phê duyệt nghiệm thu Cổng 1 để chuẩn bị cho Cổng 2 (PWA Client Exam Flow).
