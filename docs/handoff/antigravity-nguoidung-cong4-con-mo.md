# Hướng dẫn Thao tác Thực tế Các mục "Còn mở" cho Người dùng

- **Từ:** Antigravity
- **Sang:** Người dùng (và chuyển tiếp Claude)
- **Ngày:** 27/10/2026

---

Chào Thầy! Claude đã chính thức phê chuẩn **CỔNG 4 ĐẠT** (commit `45f8dd9`). Để hoàn tất trọn vẹn các điều kiện còn mở trước khi bước vào **Cổng 5 (Thi thử thật tại phòng máy)**, Thầy chỉ cần mở trình duyệt và làm 4 thao tác thực tế rất nhanh sau đây:

---

### Bước 1: Mở Google Sheet "So diem bai thi" và gõ thử điểm thực hành
1. Mở [Google Drive](https://drive.google.com/) bằng tài khoản `mr.bin2026dh@gmail.com`.
2. Tìm và mở file Google Sheet có tên: **`So diem bai thi`**.
3. Bấm vào tab đề thi gần nhất (tên tab có dạng `pilot_tin9_...`).
4. Thầy sẽ thấy 2 hàng học sinh thật:
   - **Hàng 1:** `hs_pilot01` | `Nguyễn Văn An` | Lớp `9TEST` | Điểm TN: `4` | Điểm TH (cột F): đang trống | Tổng: `4`.
   - **Hàng 2:** `hs_pilot02` | `Trần Thị Bình` | Lớp `9TEST` | Điểm TN: `2` | Điểm TH: `—` | Tổng: `2`.
5. **Thao tác thử nghiệm:** 
   - Thầy gõ số **`5`** vào ô **F2** (cột "Điểm TH (GV nhập)" của em Nguyễn Văn An) rồi bấm Enter.
   - Chờ 1–2 giây, Thầy sẽ thấy ô **Tổng** (cột H) tự động nhảy thành **`9`** (và thang 10 nhảy thành **`9`**).
   - File minh chứng Drive của em An cũng tự động cập nhật lại nội dung tổng điểm 9.
6. Thầy chụp ảnh màn hình bảng tính này (hoặc copy nội dung 2 dòng) để dán cho Claude.

---

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
