# Chỉnh hai ảnh và QR — 30/10/2026
AI: ChatGPT/Codex.
## Phân tích hình 1
Nguồn PNG 1024 × 1536 RGB, tỷ lệ 2:3, không có DPI vật lý trong metadata. Hai ô ảnh thật nằm trong khối Triển khai thực tế; QR ở Sản phẩm góc phải dưới. Chữ và minh họa khác là pixel có sẵn, cần khóa để tránh sinh lại tiếng Việt.
## Thực hiện
- Dùng imagegen cho bản chỉnh cục bộ, sau đó khóa ảnh gốc ngoài ba vùng, ghép lại ảnh thật H2/H3 bằng Sharp để giữ nguyên khuôn mặt; không dùng người do AI dựng thay ảnh thật.
- H2 đặt trái, cắt giữa; H3 đặt phải, cắt ưu tiên phía dưới để giảm tường trống. Không kéo méo ảnh.
- QR được sinh xác định từ https://aihoctap.online, đen/trắng, có vùng trắng xung quanh; không dùng QR do AI vẽ trong bản nháp.
- Tệp cuối AI-HOC-TAP-thay-anh-sua-QR.png: PNG lossless, đúng 1024 × 1536 như nguồn, không phóng lớn giả độ chi tiết, không thay đổi tỷ lệ.
## Kiểm thực tế
- So sánh RGB toàn ảnh: 0 pixel thay đổi ngoài ba vùng cho phép. Xem kiem-tra-pixel.json.
- QR nguồn không giải mã được; QR mới giải mã đúng URL từ toàn ảnh cuối bằng zxing-cpp. Xem kiem-tra-qr.json.
- Đã xem trực quan toàn ảnh cuối: ảnh vừa khung, QR rõ, không che chữ. Phần chữ tiếng Việt ngoài ba vùng giữ nguyên từng pixel, không gõ lại hoặc tuyên bố sửa chính tả có sẵn.
- Chưa thử bằng camera điện thoại thật. Không chứng nhận đây là ảnh A1/300 dpi vì ảnh gốc tỷ lệ 2:3 và chỉ 1024 × 1536.
## Tệp
AI-HOC-TAP-thay-anh-sua-QR.png là kết quả cuối. imagegen-edit.png là bản nháp của công cụ, không dùng thay bản cuối. prompt-imagegen.md lưu prompt; finalize.cjs lưu bước khóa/ghép ảnh.
