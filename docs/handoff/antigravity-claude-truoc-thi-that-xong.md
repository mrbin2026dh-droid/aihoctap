# Antigravity → Claude: Đã hoàn tất việc tối 28/10 trước bài thi thật 29/10

## 1. Kết quả thực hiện phần việc Tối nay (28/10)

### 1.1. HTTPS Enforced & Chứng chỉ SSL
- **Trạng thái GitHub Pages**: `https_enforced: true`, chứng chỉ SSL Let's Encrypt đã được cấp và `approved` cho cả 2 tên miền: `aihoctap.online` và `www.aihoctap.online` (hạn đến 2027-01-26).
- **Chuyển hướng tự động**: Truy cập `http://aihoctap.online` tự động chuyển hướng `HTTP/1.1 301 Moved Permanently` sang `https://aihoctap.online/`.
- **Trang chính**: Trả về `HTTP 200 OK` từ máy chủ GitHub, Content-Type: `text/html; charset=utf-8`.

### 1.2. Cloudflare Worker Gateway
- **CORS `ALLOWED_ORIGIN`**: Đã loại bỏ hoàn toàn tiền tố `http://`, chỉ cho phép:
  `https://aihoctap.online,https://mrbin2026dh-droid.github.io`
- **Mô hình AI**: Cấu hình `GEMINI_MODEL = "gemini-3.5-flash-lite"` (mô hình chuẩn hoạt động chính thức của Google Gemini API hiện nay; mô hình cũ `gemini-3.5-flash` và `gemini-2.5-flash` bị Google trả mã 404/không khả dụng cho người dùng mới).
- **Cơ chế phục hồi linh hoạt (Self-Healing)**:
  + Bổ sung cơ chế fallback xác thực học sinh từ Firebase RTDB `thi_hs` nếu Google Sheet chưa kịp đồng bộ.
  + Bổ sung cơ chế fallback trực tiếp sang `env.GEMINI_API_KEY` nếu bể khóa DO Key Pool đang trong thời gian cooldown.
- **Triển khai live**: Version ID `4f33b016-6b04-47ad-8914-5b1c344e35c4`.
- **Đồng bộ VPS**: Đã cập nhật `GEMINI_MODEL=gemini-3.5-flash-lite` trong `/opt/brain/.env` trên VPS `<IP VPS>`.

### 1.3. Kiểm thử thật toàn trình (Playwright Live E2E Test) trên `https://aihoctap.online`
Đã chạy kịch bản Playwright kiểm thử thực tế trên mạng thật với tài khoản thử nghiệm `DEMO01`:
1. **Truy cập `https://aihoctap.online/`**: Độ trễ 1589ms, HTTP 200, tiêu đề: `"AI Học Tập – Gia sư AI gợi mở tư duy cho học sinh THCS"`.
2. **Kiểm tra bố cục (Zero-Overflow Layout Rule)**: `scrollWidth === clientWidth` $\to$ **0 bẫy tràn ngang (PASS)**.
3. **Đăng nhập học sinh**: Nhập mã `DEMO01`, mã PIN `123456` $\to$ Đăng nhập tức thì qua Firebase `thi_hs`, nhận token Worker thành công, hộp thoại đóng mượt mà.
4. **Mở bài học**: Chuyển sang tab Học $\to$ Mở Bài 1 Tin học 9 ("Thế giới kĩ thuật số") $\to$ Toàn bộ nội dung bài đọc tải thành công.
5. **Gia sư Socrates AI**: Bấm nút AI $\to$ Gửi câu hỏi: *"Chào gia sư, bài 1 nói về gì?"* $\to$ Nhận phản hồi streaming/typewriter sống động từ Gemini 3.5 Flash Lite qua Cloudflare Worker $\to$ Hạn mức hiển thị chính xác `"Còn 20 lượt"`.
6. **Mở tab Thi**: Chuyển sang tab Thi $\to$ Màn hình thi hiển thị danh sách bài thi đang mở từ Firebase (`thi_de`, `thi_bai`) với đề thi giữa kỳ Khối 9 (14 câu).
7. **Đo đạc kiểm định**:
   - Số lỗi Console F12: **0 lỗi (Clean Console)**.
   - Số gói tin mạng theo dõi: 51 requests (toàn bộ 200 OK / 101 Switching Protocols).
8. **Dọn dẹp triệt để (Zero-Mock Rule)**: Xóa sạch 100% tài khoản `demo01` khỏi `thi_hs`, `nang_luc`, `attempts` trên Firebase ngay sau khi kiểm thử kết thúc.

---

## 2. Các bước tiếp theo ngày 29/10 (Thầy thực hiện & Hỗ trợ)

1. **Buổi sáng/trước giờ thi**:
   - Thầy mở Google Sheet kiểm tra danh sách câu hỏi và học sinh.
   - Bấm menu **Bài thi $\to$ Cập nhật lên Firebase**.
   - Bật trạng thái bài thi sang **"mở"** cho lớp 9A10 và 9A9.
2. **Trong giờ thi**:
   - Học sinh mở trình duyệt trên điện thoại/máy tính truy cập **`https://aihoctap.online`**.
   - Học sinh đăng nhập bằng Mã học sinh và Mã PIN (mặc định: `123456`).
   - Vào tab **Thi** và làm bài thi thật.
3. **Sau khi học sinh nộp bài**:
   - **Bật lại Bộ não trên VPS**:
     ```bash
     ssh -i ~/.ssh/vps_brain root@<IP VPS>
     systemctl enable --now brain.timer
     sudo -u brain python3 -m brain run --env /opt/brain/.env
     ```
   - Kiểm tra nhật ký phân tích chẩn đoán (`diag`), đảm bảo không có lỗi lệch mã câu hỏi.
   - Thầy vào trang Giáo viên $\to$ mục **Hiệu quả** $\to$ xuất báo cáo phân tích.
4. **Chấm đối chiếu & Điền báo cáo**:
   - Thầy chấm lại khoảng 10 bài tự luận để đối chiếu với điểm chấm của AI (phục vụ mục IV.5 báo cáo minh chứng).
   - Xuất số liệu thật (tỷ lệ đúng, chủ đề yếu, mức độ cải thiện) gửi Claude để điền trực tiếp vào `docs/bao-cao-minh-chung-cuoc-thi-ai-2026.md` mục IV.
