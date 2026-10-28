# Antigravity → Claude: Gắn tên miền aihoctap.online, thương hiệu AI Học Tập & SEO (28/10)

## 1. Trạng thái thực hiện các bước theo quy trình

### Bước 1 — Worker (Hoàn thành 100%)
- **Secret `ALLOWED_ORIGIN`**: Đã cập nhật giá trị đa tên miền qua wrangler:
  `https://aihoctap.online,http://aihoctap.online,https://mrbin2026dh-droid.github.io`
- **Deploy**: Đã deploy mã nguồn mới `worker/index.js` lên Cloudflare Worker (Version ID: `de3a4d7f-0a2c-426b-b427-ee679d1f2391`).
- **Kiểm thử live**:
  - `curl -I -X OPTIONS -H "Origin: https://aihoctap.online" <WORKER_URL>/api/health` → HTTP 200, `Access-Control-Allow-Origin: https://aihoctap.online`, `Vary: Origin`.
  - `curl -I -X OPTIONS -H "Origin: https://mrbin2026dh-droid.github.io"` → HTTP 200, `Access-Control-Allow-Origin: https://mrbin2026dh-droid.github.io`.
- **Kiểm thử đơn vị**: `test_worker_multi_origin.mjs` đạt **8/8 ca PASS**.

---

### Bước 2 — DNS trên Hostinger (Thầy đã hoàn thành 100%)
Thầy đã cấu hình chuẩn xác trên trang quản trị DNS của Hostinger:
- 4 bản ghi **A** trỏ `@` về các IP của GitHub Pages:
  - `185.199.108.153` (TTL 300)
  - `185.199.109.153` (TTL 300)
  - `185.199.110.153` (TTL 300)
  - `185.199.111.153` (TTL 300)
- 1 bản ghi **CNAME** trỏ `www` về `mrbin2026dh-droid.github.io` (TTL 300).
- Đã xóa bản ghi IP đỗ cũ `2.57.91.91`.
- **Kiểm tra phân giải DNS (`nslookup aihoctap.online 8.8.8.8`)**: Đã trả về đầy đủ cả 4 địa chỉ IP trên. CNAME `www` trả về bí danh chính xác.

---

### Bước 3 — Firebase / Google
- Hệ thống PWA hiện tại sử dụng cơ chế bảo mật xác thực mã học sinh + PIN (PBKDF2 salt + hash trên Worker/Firebase RTDB) không phụ thuộc Firebase Client Auth SDK.
- Sẵn sàng thêm `aihoctap.online` vào Authorized Domains trên Firebase Console nếu cần.

---

### Bước 4 — GitHub Pages & Kiểm thử Live (Hoàn thành)
- **CNAME**: Đã gắn `cname: "aihoctap.online"` qua GitHub API.
- **Trạng thái truy cập Web**:
  - `http://aihoctap.online/` → HTTP 200 OK (`Server: GitHub.com`).
  - `http://www.aihoctap.online/` → HTTP 301 chuyển hướng về `http://aihoctap.online/`.
  - `http://aihoctap.online/robots.txt` → HTTP 200 OK.
  - `http://aihoctap.online/sitemap.xml` → HTTP 200 OK.
  - `http://aihoctap.online/seo/og-image.png` → HTTP 200 OK (ảnh Open Graph 956 KB chuẩn 1200×630).
  - `http://aihoctap.online/teacher.html` → HTTP 200 OK (trang giáo viên).
- **Kiểm thử tự động Playwright headless live**:
  - Tải trang `http://aihoctap.online/` đạt **HTTP 200**, hiển thị đúng tiêu đề *"AI Học Tập – Gia sư AI gợi mở tư duy cho học sinh THCS"*.
  - Nút `#gate-student` hiển thị và tương tác tốt.
  - **Console F12 hoàn toàn sạch 0 lỗi (0 errors, 0 warnings)**.
- **Chứng chỉ SSL (HTTPS)**: Đang trong hàng đợi kiểm tra DNS và cấp chứng chỉ tự động của GitHub (thường hoàn tất sau 10–15 phút). Khi hoàn tất, GitHub sẽ tự động chuyển hướng sang HTTPS (`Enforce HTTPS`).

---

### Bước 5 — Các việc tiếp theo
1. Theo dõi chứng chỉ SSL để bật `Enforce HTTPS`.
2. Kiểm tra xem trước link chia sẻ (Card preview) trên Zalo và Facebook.
3. Thông báo học sinh mở `https://aihoctap.online` và cài lại ứng dụng PWA (Add to Home screen) để nhận diện thương hiệu AI Học Tập và logo mới.
4. **Quyết định đã chốt**: Bỏ Zalo Bot theo chỉ đạo của Thầy, giữ kênh hỗ trợ 1 chạm qua Zalo cá nhân của giáo viên.
