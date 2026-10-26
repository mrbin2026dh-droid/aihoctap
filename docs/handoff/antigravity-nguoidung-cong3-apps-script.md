# Cập nhật Apps Script chấm thi (Cổng 3) và cấp quyền Drive thật
Từ: Antigravity → Sang: Người dùng   Ngày: 26/10/2026

## Mục tiêu
Dán mã nguồn mới từ commit `050a7e5` vào dự án Apps Script `exam` (`apps-script/exam`), cấp quyền Drive thật và triển khai New version để chạy kiểm định Cổng 3 đạt 100%.

## Tệp cần đọc / copy
- `apps-script/exam/appsscript.json`
- `apps-script/exam/Code.gs`

## Các bước thực hiện trong Apps Script (theo đúng thứ tự)

### A. Dự án Chấm thi (apps-script/exam)
1. Mở dự án Apps Script chấm thi trên trình duyệt.
2. **Kiểm tra GCP Project**: Vào ⚙️ **Project Settings** -> Cuộn xuống mục **Google Cloud Platform (GCP) Project** -> Nếu chưa phải `628267818434` thì bấm **Change project** -> Nhập `628267818434` -> Bấm **Set project**.
3. **Bật manifest**: Trong ⚙️ **Project Settings**, tích chọn ô: **"Show "appsscript.json" manifest file in editor"**.
4. **Cập nhật mã**:
   - Quay lại `< > Editor`:
   - Mở tệp `appsscript.json`: Dán toàn bộ nội dung từ `apps-script/exam/appsscript.json`.
   - Mở tệp `Code.gs`: Dán toàn bộ nội dung từ `apps-script/exam/Code.gs`.
   - Bấm **Save** (Ctrl + S).
5. **Cấp quyền Drive & Firebase**:
   - Chọn hàm `setup` trên thanh công cụ -> Bấm **Run ▶️**.
   - Bấm **Review permissions** -> Chọn tài khoản Google (`mrhatrongkhoi.dh@gmail.com` / `havanty84@gmail.com`) -> Bấm **Advanced** -> Bấm **Go to ... (unsafe)** -> Bấm **Allow**.
   - Xem nhật ký in ra: `Đã cài trigger thành công. Sổ điểm: ... — Thư mục Drive: ...`
6. **Kiểm tra quyền Drive**:
   - Chạy hàm kiểm tra (hoặc tạo hàm `function testDrive() { Logger.log(rootFolder_().getUrl()); }` -> Run ▶️).
   - Copy đường link Google Drive thư mục bài thi in ra trong nhật ký.
7. **Triển khai New version**:
   - Bấm **Deploy** -> **Manage deployments** -> Chọn bản Web App -> Bấm biểu tượng ✏️ (Edit).
   - Mục **Version**: chọn **New version** (Phiên bản mới).
   - Bấm **Deploy**. URL `/exec` giữ nguyên là `https://script.google.com/macros/s/AKfycbyh2jhdiaDMLJSXxBfcYaM-VfrrmwNK0tb_u8KlbHnsEK2M4lQhz0UDrQSDJUeHMBT6/exec`.

### B. Dự án Cấp phát tài khoản (apps-script/provisioning - Đóng Đ2)
1. Mở dự án Apps Script `provisioning`.
2. Chọn hàm `testAdminAccounts` -> Bấm **Run ▶️**.
3. Copy nhật ký thực thi dán cho Antigravity.

## Xong thì chuyển cho: Antigravity
Dán kết quả nhật ký kiểm tra Drive và nhật ký `testAdminAccounts` cho Antigravity để kích hoạt test khép kín tự động và bàn giao Claude.
