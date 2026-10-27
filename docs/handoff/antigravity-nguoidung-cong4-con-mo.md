# Hướng dẫn Thao tác Thực tế Các mục "Còn mở" cho Người dùng

- **Từ:** Antigravity
- **Sang:** Người dùng (và chuyển tiếp Claude)
- **Ngày:** 27/10/2026

---

Chào Thầy! Claude đã chính thức phê chuẩn **CỔNG 4 ĐẠT** (commit `45f8dd9`). Để hoàn tất trọn vẹn các điều kiện còn mở trước khi bước vào **Cổng 5 (Thi thử thật tại phòng máy)**, Thầy chỉ cần mở trình duyệt và làm 4 thao tác thực tế rất nhanh sau đây:

---

### Bước 1 (Claude sửa lại): Tự kiểm tra sổ điểm bằng hàm `thuSoDiem`
> Bản hướng dẫn cũ (gõ 5 vào ô F2 của tab `pilot_tin9_...`) **sẽ không chạy**: bài thi thử đã bị xóa khỏi Firebase khi dọn dẹp, nên sổ điểm không còn đề để cập nhật. Ngoài ra bảng không có cột "thang 10".
1. Dán lại `Code.gs` mới nhất từ GitHub vào dự án Apps Script chấm thi, bấm Lưu (không cần Deploy lại cho bước này; nhưng vẫn nên Deploy New version vì có sửa lỗi dán nhiều điểm cùng lúc).
2. Chọn hàm **`thuSoDiem`** → **Run ▶**. Hàm tự tạo đề và 2 học sinh giả (không hiện cho học sinh), chốt điểm, gõ thử điểm thực hành 5, thử điểm sai 99, thử dán 2 điểm cùng lúc, kiểm Tổng và phiếu minh chứng, rồi tự dọn sạch.
3. Phải thấy dòng cuối `=== SỔ ĐIỂM + MINH CHỨNG: ĐẠT TOÀN BỘ ===`. Copy toàn bộ nhật ký dán cho Claude.

### Bước 2: Chạy `kiemTraHeThong()` trong Google Apps Script
1. Mở trình soạn thảo Google Apps Script (chứa dự án đường thi `Code.gs`).
2. Trên thanh công cụ trên cùng (chỗ chọn hàm), bấm vào menu thả xuống và chọn hàm: **`kiemTraHeThong`**.
3. Bấm nút **Run** (Chạy ▶).
4. Cửa sổ bên dưới sẽ hiện **Execution log** (Nhật ký thực thi). Thầy copy nguyên văn toàn bộ các dòng chữ trong nhật ký đó dán cho Claude (để Claude xác nhận hệ thống đang dùng OAuth hay DB_SECRET và in "ĐẠT TOÀN BỘ").

---

### Bước 3: Dọn dẹp bản triển khai cũ & Thư mục Drive
1. **Lưu trữ bản triển khai Apps Script cũ:**
   - Trong Apps Script, bấm vào nút **Deploy** (Triển khai) góc trên bên phải > Chọn **Manage deployments** (Quản lý các bản triển khai).
   - Bấm vào các bản triển khai cũ (có URL chứa `...bNti...`, `...xIvXSX...`), bấm vào biểu tượng bánh răng hoặc menu chọn **Archive** (Lưu trữ).
   - Chỉ giữ lại duy nhất bản triển khai mới nhất đang hoạt động (`...bz5b5dzfz9...`).
2. **Dọn dẹp Drive:**
   - Trong Google Drive, tìm thư mục **`9LOAD`** (chứa các file nộp 10 MB lúc test tải) và thư mục **`9TEST`** (nếu có).
   - Bấm chuột phải chọn **Xóa** (Move to trash) và dọn sạch Thùng rác để giải phóng dung lượng Drive.

---

### Bước 4: Chuẩn bị Cổng 5 (Thi thử phòng máy thật)
- Thầy báo cho Claude biết: Thầy dự kiến chọn **lớp nào** (khoảng 30–40 em) và **thời gian nào** (1 buổi 15 phút) để Claude soạn phiếu theo dõi và hướng dẫn đo đạc thực tế tại phòng máy trường!
