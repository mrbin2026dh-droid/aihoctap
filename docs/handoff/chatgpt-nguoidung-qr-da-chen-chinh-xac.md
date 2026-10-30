# QR đã chèn chính xác vào poster cuối
Từ: ChatGPT → Sang: Người dùng   Ngày: 30/10/2026
## Mục tiêu
Nhận một ảnh poster hoàn chỉnh có đúng QR đã gửi, đúng kích thước gốc.
## Tệp cần đọc
- docs/design/poster-chinh-anh-qr/POSTER-CHINH-XAC-QR-DA-CHEN.png
- docs/design/poster-chinh-anh-qr/kiem-tra-chen-qr-cuoi.json
## Kết quả mong đợi
PNG lossless 1024 × 1536, giữ hai ảnh H2/H3; toàn bộ chữ và vùng ngoài QR không đổi.
## Ràng buộc / không được làm
QR nhúng khớp từng pixel với mã riêng đã gửi sau thu nhỏ nearest-neighbor, không vẽ lại.
Bộ giải mã đọc được HTTPS://AIHOCTAP.ONLINE từ toàn ảnh cuối; chưa thử camera điện thoại thật.
Không gọi đây là ảnh A1 300 dpi. Không thay tệp gốc người dùng.
## Xong thì chuyển cho: Người dùng
