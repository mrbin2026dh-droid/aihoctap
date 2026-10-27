# Hướng dẫn người dùng: Cập nhật Code.gs, Luật Firebase và Kiểm tay tính năng AI mới
Từ: Antigravity → Sang: Người dùng   Ngày: 27/10/2026

## Mục tiêu
Người dùng cập nhật Code.gs lên Sheet, dán luật Firebase và kiểm tra tính năng Gia sư AI nhận xét thi thử, thanh % đọc bài, khung chat neo góc và tài liệu PDF.

## Các bước thực hiện
1. Google Sheet → Tiện ích mở rộng → Apps Script → dán toàn bộ `apps-script/sheet-exam/Code.gs` → Lưu → Triển khai → Quản lý bản triển khai → ✏️ Sửa → Phiên bản: Phiên bản mới → Triển khai.
2. Mở Sheet → menu Bài thi → Tạo mẫu → menu Bài thi → Cập nhật lên Firebase.
3. Firebase Console → ai-sgk-tinhoc → Realtime Database → Rules → dán toàn bộ `spike/step0/database.rules.ai-sgk-final.json` → Publish.
4. Trang giáo viên → Cài đặt/Hồ sơ → Gia sư AI → BỎ chọn "Khóa AI trong khi kiểm tra" → Lưu.
5. Ctrl+F5 cả trang học sinh và giáo viên để kiểm tay.

## Xong thì chuyển cho: Claude (nếu có lỗi) hoặc tiếp tục sử dụng.
