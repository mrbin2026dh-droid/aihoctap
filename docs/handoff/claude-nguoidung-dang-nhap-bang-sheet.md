# Đăng nhập cả hệ thống bằng Google Sheet

Học sinh vào app (học bài, AI gia sư, thi) bằng **Mã học sinh + Mã PIN** ở sheet `HocSinh`. Worker hỏi Apps Script (`action: login`), đúng thì cấp token như cũ.

- Lớp "9A" → khối 9, mã lớp "9A". Họ tên lấy từ Sheet.
- Gõ hs01 hay HS01 đều được. Sai PIN nhiều lần bị khóa như cũ.
- Đổi PIN: giáo viên sửa trong Sheet (nút đổi PIN trong app bị chặn).
- Tắt: xóa dòng `SHEET_LOGIN_URL` trong `wrangler.toml` rồi deploy lại.

## Triển khai (Antigravity hoặc người dùng, 1 lệnh)
`npx wrangler deploy` rồi vào app đăng nhập thử HS01 / 123456.
Nếu Worker báo thiếu `FIREBASE_*` thì các secret cũ vẫn phải còn (dùng ký token).
