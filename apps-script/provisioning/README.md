# Hướng dẫn Quản trị Danh bạ & Cấp phát Tài khoản Học sinh (Cổng 1)

Thư mục này chứa mã nguồn Google Apps Script thực thi nghiệp vụ Cổng 1 của kiến trúc Firebase Serverless:
1. **`Code.gs`**: Mã nguồn Apps Script đọc danh sách học sinh từ Google Sheet, cấp phát tài khoản Firebase qua Identity Platform API, ghi danh bạ vào RTDB `students/{uid}`, và cung cấp chức năng đặt lại mã PIN.
2. **`appsscript.json`**: Tệp manifest cấu hình timezone và các OAuth Scopes bắt buộc (`cloud-platform`, `firebase.database`, `spreadsheets`).

---

## 1. Cấu trúc Bảng tính Google Sheet Chuẩn
Tạo một Google Sheet mới với tên `Danh sách Học sinh AI SGK`.
Sheet đầu tiên đặt tên bất kỳ (mặc định Sheet1) có cấu trúc các cột như sau:

| Cột A | Cột B | Cột C | Cột D | Cột E | Cột F | Cột G | Cột H | Cột I |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Mã HS** | **Họ và tên** | **Lớp** | **Khối** | **Mã PIN** | **Email Firebase** | **UID Firebase** | **Trạng thái** | **Ngày cập nhật** |
| `hs09001` | Nguyễn Văn An | 9A | 9 | `123456` | *(Tự động điền)* | *(Tự động điền)* | *(Tự động)* | *(Tự động)* |
| `hs09002` | Trần Thị Bình | 9A | 9 | `123456` | *(Tự động điền)* | *(Tự động điền)* | *(Tự động)* | *(Tự động)* |

---

## 2. Các bước Cài đặt trong Google Apps Script
1. Trong Google Sheet, chọn menu: **Tiện ích mở rộng (Extensions)** $\rightarrow$ **Apps Script**.
2. **Cấu hình Manifest**:
   - Bấm biểu tượng ⚙️ (Project Settings) ở thanh bên trái.
   - Tích chọn: **"Hiển thị tệp kê khai 'appsscript.json' trong trình chỉnh sửa"** ("Show 'appsscript.json' manifest file in editor").
   - Quay lại Trình chỉnh sửa (Editor) $\rightarrow$ Mở `appsscript.json` $\rightarrow$ Dán nội dung từ `apps-script/provisioning/appsscript.json`.
3. **Cấu hình Mã nguồn**:
   - Mở tệp `Code.gs` $\rightarrow$ Dán toàn bộ nội dung từ `apps-script/provisioning/Code.gs`.
4. **Cấu hình Thuộc tính Dự án (Script Properties)**:
   - Vào ⚙️ **Project Settings** $\rightarrow$ Cuộn xuống mục **Script properties** $\rightarrow$ Thêm 3 thuộc tính:
     - `FIREBASE_PROJECT_ID`: ID dự án Firebase (ví dụ: `day-hoc-tuong-tac-7ee69` hoặc dự án thi của bạn).
     - `FIREBASE_DATABASE_URL`: `https://<PROJECT_ID>-default-rtdb.asia-southeast1.firebasedatabase.app`
     - `EMAIL_DOMAIN`: `hs.aihoc.test` (hoặc tên miền trường bạn dùng).
5. **Cấp quyền (Authorization)**:
   - Chọn hàm `testAdminAccounts` $\rightarrow$ Bấm **Run (Chạy)**.
   - Google sẽ hiện hộp thoại yêu cầu cấp quyền: Bấm *Xem quyền* $\rightarrow$ Chọn tài khoản chủ dự án $\rightarrow$ Bấm *Nâng cao (Advanced)* $\rightarrow$ Bấm *Đi tới dự án (không an toàn)* $\rightarrow$ Bấm *Cho phép (Allow)*.
   - Hàm `testAdminAccounts()` sẽ chạy xong và in ra "Nhật ký thực thi".

---

## 3. Sử dụng Hàng ngày trên Google Sheet
Khi mở lại Google Sheet, trên thanh menu sẽ xuất hiện menu mới: **🤖 Quản trị Học sinh (AI SGK)**:
1. **1. Cấp phát tài khoản (Toàn bộ danh sách)**: Duyệt toàn bộ danh sách học sinh trên Sheet, tạo tài khoản và ghi RTDB. Nếu học sinh đã có tài khoản thì giữ nguyên UID không tạo trùng (Idempotent).
2. **2. Đặt lại mã PIN cho dòng đang chọn**: Nhấp chuột vào bất kỳ ô nào thuộc dòng học sinh cần đổi PIN $\rightarrow$ Bấm menu này $\rightarrow$ Nhập PIN mới $\rightarrow$ Hệ thống cập nhật Firebase và cập nhật cột Mã PIN.
3. **3. Đồng bộ lại danh bạ students/ sang RTDB**: Đẩy lại toàn bộ tên, lớp, khối lên Firebase RTDB.
4. **4. Kiểm thử Cổng 1 (40 học sinh thử & Tự động dọn)**: Tự động chạy chu trình kiểm tra 40 học sinh mẫu và dọn dẹp sạch sau khi test.
