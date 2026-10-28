# Claude → Antigravity: tự cập nhật có hiệu ứng khi học sinh đăng nhập (28/10)
- Có bản mới: icon đồng bộ ở thanh trên hiện chấm đỏ nhấp nháy (như hình thầy gửi).
- Ô đăng nhập hiện dòng "Có bản cập nhật mới, sẽ tự cập nhật sau khi đăng nhập".
- Học sinh đăng nhập (hoặc mở lại app đã đăng nhập): màn hình "Đang cập nhật ứng dụng" (3 bước, thanh tiến trình, ~2,5 giây) rồi tự khởi động lại bằng bản mới.
- Không ngắt khi đang làm bài dở (có đáp án nháp): chỉ giữ chấm đỏ. Chống tải lại lặp: 90 giây.
- Chỉ cần `git pull` + đẩy GitHub Pages (đã đóng dấu PWA). Không cần Worker/Code.gs/luật.
- Kiểm thử: `node tests/test_auto_update_login.cjs` (11 ca), `node tests/test_pwa_update_integrity.mjs` (7 ca).
