# Antigravity → Claude: Đã hoàn tất triển khai Zalo mở trình duyệt, cài App, Loading, Gia sư tự chọn bài & Bộ não lượt nhanh

## 1. Kết quả triển khai và kiểm thử

### 1.1. Cloudflare Worker Gateway (`aihoctap-gate`)
- **Định tuyến bài học tự động (`routeLesson`)**:
  - Khi học sinh mở Gia sư từ màn hình Tổng quan mà **không chọn bài trước**, Worker tự động so khớp từ khóa câu hỏi với danh sách bài học của khối, chọn ra bài học phù hợp nhất làm căn cứ trả lời.
  - Phản hồi trả về trường `lesson: {course_id, lesson_id, title}` và giao diện ứng dụng hiển thị nhãn:
    `Gia sư dùng bài: [Tên bài học]`
- **Mô hình AI**: Vận hành chính thức bằng `GEMINI_MODEL = "gemini-3.5-flash-lite"` (mô hình chuẩn đang hoạt động của Google Gemini API).
- **Cơ chế dự phòng**: Fallback tự động sang `env.GEMINI_API_KEY` nếu bể khóa DO Key Pool cooldown; Fallback xác thực qua Firebase `thi_hs` cho tài khoản học sinh.
- **Triển khai live**: Version ID `efdc82a0-45cd-4ea3-859d-a387c0d455d6`.

### 1.2. Máy chủ VPS Bộ não
- **Cập nhật mã nguồn & dịch vụ**: Chạy hoàn tất `setup.sh`.
- **Kiểm thử tự động**: Chạy 18/18 Unit Tests PASS (`Ran 18 tests in 0.825s: OK`).
- **Quản lý Systemd Timers**:
  ```bash
  systemctl list-timers brain.timer brain-quick.timer
  ```
  - `brain-quick.timer`: Đang chạy định kỳ mỗi 30 phút từ 6:00 đến 22:00 (lượt nhanh cập nhật hiểu lầm cho Gia sư, không gọi AI, không tốn quota).
  - `brain.timer`: Đã kích hoạt sẵn sàng cho ngày thi thật 29/10.

### 1.3. HTTPS & Tên miền `aihoctap.online`
- **GitHub Pages**: Đã bật `Enforce HTTPS` (`https_enforced: true`), chứng chỉ SSL Let's Encrypt đã cấp duyệt (`approved`) cho cả `aihoctap.online` và `www.aihoctap.online`.
- **Chuyển hướng 301**: Mọi truy cập qua `http://` tự động chuyển hướng sang `https://`.
- **Worker CORS**: Bí mật `ALLOWED_ORIGIN` chỉ chấp nhận kết nối HTTPS:
  `https://aihoctap.online,https://mrbin2026dh-droid.github.io`

### 1.4. Kiểm thử tự động chuyên sâu (PASS 100%)
- `test_install_browser.cjs`: **25/25 ca PASS** (nhận diện Zalo, Messenger, Facebook, TikTok, nút Mở bằng Chrome/Safari, bảng cài app theo thiết bị, ghi nhớ không làm phiền).
- `test_loading_states.cjs`: **11/11 ca PASS** (thanh tiến trình mép trên `netbar.js`, vòng xoay nút đang xử lý, khối loading danh sách).
- `test_tutor_auto_lesson.mjs`: **11/11 ca PASS** (so khớp ngữ nghĩa N-gram, định tuyến bài, bảo toàn lượt hỏi).
- `test_live_demo_full.cjs`: Kiểm thử E2E trên web thật `https://aihoctap.online` với tài khoản học sinh thử nghiệm đạt **0 lỗi Console F12**, không tràn ngang. Sau kiểm thử, toàn bộ dữ liệu tạm trên Firebase đã được dọn sạch hoàn toàn (Zero-Mock).

---

## 2. Hướng dẫn Thầy thử nghiệm trên điện thoại thật qua Zalo

1. **Gửi link qua Zalo**:
   - Thầy gửi đường dẫn `https://aihoctap.online` vào tin nhắn Zalo (ví dụ gửi cho chính mình hoặc Cloud của tôi).
2. **Mở link trong Zalo**:
   - Bấm vào link trong cửa sổ chat Zalo.
   - Ứng dụng sẽ hiển thị màn hình hướng dẫn thân thiện: **"Mở AI Học Tập bằng trình duyệt"**.
   - **Trên Android**: Bấm nút **"Mở bằng Chrome"** (trình duyệt Chrome sẽ tự động bật lên và giữ nguyên trang).
   - **Trên iPhone**: Bấm nút **"Mở bằng Safari"** (hoặc làm theo chỉ dẫn 2 bước: bấm biểu tượng `⋯` góc phải $\to$ chọn *"Mở bằng trình duyệt"*).
3. **Cài đặt ứng dụng PWA lên màn hình chính**:
   - Khi đã mở trong Chrome/Safari, ứng dụng sẽ hiện thanh thông báo gợi ý: **"Cài AI Học Tập lên máy"**.
   - Bấm **"Cài đặt"** $\to$ Biểu tượng ứng dụng học tập sẽ xuất hiện trực tiếp trên màn hình chính của điện thoại như một ứng dụng độc lập, sẵn sàng sử dụng cho buổi thi ngày mai.
