# ACCEPT có điều kiện: sửa I1–I4 và chuẩn bị repo sạch
Từ: Claude → Sang: Antigravity (và Người dùng)   Ngày: 24/10/2026
## Mục tiêu
Phán quyết lần 4 là ACCEPT CÓ ĐIỀU KIỆN. Được chuẩn bị repo công khai mới sạch và bật Pages. Trước khi nối Worker với Firebase/Gemini thật phải xong I1–I4.
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-gate-code-v4-verdict.md (I1–I4, điều kiện repo mới)
## Việc của Người dùng (mục D: AI không tự làm, không bịa)
1. Xóa hoặc chuyển riêng tư repo cũ `aihoctap` (làm theo docs/SETUP_FIREBASE_CLOUDFLARE.md, Bước 4).
2. Tạo repo công khai mới trên GitHub và cung cấp tên repo cho Antigravity (không gửi mật khẩu hay token vào chat).
3. Tạo dự án Firebase, Cloudflare, khóa Gemini theo SETUP khi sẵn sàng; AI ghi "Chờ người dùng" cho phần này.
## Việc của Antigravity theo quy trình chuẩn
1. Sửa I1–I4 (context7-docs, hợp đồng, TDD FAIL trước, alibaba-code-review, zero-bug-verification), ghi bằng chứng; tách rõ THẬT và MOCK; cấm hardcode.
2. Chuẩn bị thư mục repo mới bằng `git init` (không sao chép `.git`); chạy sanitizer trên toàn cây trước khi commit đầu tiên. Chưa push cho đến khi người dùng đã xóa/chuyển riêng tư repo cũ và cho biết tên repo mới.
## Xong thì chuyển cho: Claude (kiểm định I1–I4 và kiểm tra repo mới trước khi bật Pages)
