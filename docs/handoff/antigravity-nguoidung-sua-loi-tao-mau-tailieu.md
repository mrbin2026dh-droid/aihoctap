# Hướng dẫn tạo trang TaiLieu sau khi cập nhật Code.gs

## 1. Nguyên nhân
Trước đó trong `apps-script/sheet-exam/Code.gs`, hàm `taoMau()` và `schema_()` chưa gọi `ensure_(SH_TL, TL_HEAD)`. Do đó khi bấm menu **Bài thi → Tạo mẫu**, Google Sheet chỉ tạo các trang `HocSinh, DeThi, CauHinh, GiaoVien, BaiThi, DiemDanh, DeThiThu` mà chưa sinh trang `TaiLieu`.

## 2. Đã sửa trong mã nguồn
- Bổ sung `ensure_(SH_TL, TL_HEAD);` vào cả `schema_()` và `taoMau()` trong `apps-script/sheet-exam/Code.gs`.
- Cập nhật test `tests/test_sheet_exam_gs.cjs` để khẳng định trang `TaiLieu` có đủ các cột:
  `['Mã tài liệu', 'Tiêu đề', 'Khối', 'Mô tả', 'File ID', 'Tên file', 'Kích thước', 'Cập nhật lúc', 'Người đăng']`.
- Chạy test kiểm thử: **80/80 ca PASS**.

## 3. Hướng dẫn Người dùng thực hiện trên Google Sheet (2 bước)
1. Mở file `apps-script/sheet-exam/Code.gs` trong dự án, copy toàn bộ nội dung (Ctrl+A, Ctrl+C).
2. Vào Google Sheet của bạn → menu **Tiện ích mở rộng** → **Apps Script**:
   - Chọn toàn bộ code trong cửa sổ Apps Script và dán đè vào (Ctrl+A, Ctrl+V).
   - Bấm biểu tượng **Lưu** (Ctrl+S).
3. Quay lại Google Sheet:
   - Tải lại trang (F5).
   - Bấm menu **Bài thi** → **Tạo mẫu**.
   - Google Sheet sẽ ngay lập tức tạo thêm trang **TaiLieu** với 9 cột chuẩn.
