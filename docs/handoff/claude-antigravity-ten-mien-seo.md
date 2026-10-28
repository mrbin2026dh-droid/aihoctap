# Claude → Antigravity: tên miền aihoctap.online + thương hiệu AI Học Tập + SEO (28/10)

Thầy quyết định: **bỏ Zalo Bot**; đổi tên ứng dụng thành **AI Học Tập**; gắn tên miền **aihoctap.online** cho GitHub Pages.

## 1. Claude đã làm (đã đẩy GitHub)
- Thương hiệu:
  - Thanh trên học sinh và giáo viên dùng biểu tượng (nét SVG gốc trong bộ nhận diện, đổi màu theo sáng/tối) + chữ "AI Học Tập".
  - Thẻ đăng nhập và màn hình cập nhật dùng biểu tượng app mới.
  - Tiêu đề, manifest, lời chào, trợ giúp nhanh đổi sang tên mới.
  - Tên thư mục Google Drive trong Code.gs **giữ nguyên** (đổi sẽ tách dữ liệu cũ).
- Hình từ gói ZIP:
  - `brand/` (logo), `seo/og-image.png|webp`, `seo/hero-multisubject.webp`.
  - Favicon 16/32/48 + `favicon.ico`, apple-touch-icon 180, biểu tượng app 192/512.
  - Biểu tượng Android maskable 512: tạo từ `android-icon.svg`, nền phủ kín, nội dung nằm trong vùng an toàn.
- SEO:
  - Tiêu đề 54 ký tự, mô tả 140 ký tự, canonical `https://aihoctap.online/`.
  - Open Graph và Twitter Card (ảnh 1200×630, đường dẫn tuyệt đối, có mô tả ảnh).
  - JSON-LD (WebSite + WebApplication giáo dục, miễn phí, không có đánh giá sao), `robots.txt`, `sitemap.xml`.
  - Trang giáo viên `noindex`.
  - Phần giới thiệu ngắn có ảnh minh họa (tải lười) nằm **dưới** thẻ đăng nhập; thẻ vẫn ở giữa màn hình đầu.
- Worker: `ALLOWED_ORIGIN` nhận **nhiều tên miền cách nhau bằng dấu phẩy**, vẫn so khớp chính xác; thêm `Vary: Origin`. Cấu hình cũ một tên miền vẫn chạy.
- Kiểm thử:
  - Mới: `test_seo_brand` 28 ca, `test_worker_multi_origin` 8 ca.
  - Hồi quy giao diện và Worker đạt.
  - Sửa luôn lỗi phông Georgia trong màn hình cập nhật (`test_fonts_vietnamese` đạt lại).

## 2. Antigravity làm — ĐÚNG THỨ TỰ (sai thứ tự sẽ làm ứng dụng lỗi)
### Bước 1 — Worker (làm TRƯỚC)
1. `git pull`; xem `ALLOWED_ORIGIN` đang là secret hay biến: `npx wrangler secret list`.
2. Đặt giá trị mới (cùng kiểu cũ):
   - secret: `npx wrangler secret put ALLOWED_ORIGIN` → dán
   - hoặc biến trên trang Cloudflare
   - giá trị: `https://aihoctap.online,https://mrbin2026dh-droid.github.io`
3. `npx wrangler deploy` (mã mới mới hiểu danh sách).
4. Kiểm: `curl -s -I -X OPTIONS -H "Origin: https://aihoctap.online" <WORKER_URL>/api/health` → `access-control-allow-origin: https://aihoctap.online`. Thử lại với Origin github.io → trả github.io. Mở app ở địa chỉ github.io hiện tại, đăng nhập thử → vẫn chạy.

### Bước 2 — DNS (tại nơi thầy mua tên miền)
- Bản ghi **A** cho `@` (aihoctap.online), đủ 4 dòng: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- (Nên) Bản ghi **AAAA** cho `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
- Bản ghi **CNAME** cho `www` → `mrbin2026dh-droid.github.io`.
- Xóa bản ghi A/CNAME mặc định của nhà đăng ký (trang đỗ tên miền) nếu có.
- (Nên) Xác minh tên miền trong GitHub: Settings tài khoản → Pages → Add a verified domain (chống người khác chiếm tên miền).
- Kiểm: `nslookup aihoctap.online` ra 4 địa chỉ trên.

### Bước 3 — Firebase / Google (kiểm, thường không cần sửa)
- Firebase Console → Authentication → Settings → Authorized domains: thêm `aihoctap.online` nếu có danh sách này.
- Google Cloud Console → khóa API web của Firebase: nếu khóa **giới hạn theo trang web (HTTP referrer)**, thêm `https://aihoctap.online/*`. Nếu không giới hạn thì bỏ qua.

### Bước 4 — GitHub Pages
1. Repo → Settings → Pages → Custom domain: `aihoctap.online` → Save (hoặc `gh api -X PUT repos/mrbin2026dh-droid/aihoctap/pages -f cname=aihoctap.online`). Pages phát hành bằng GitHub Actions nên **không cần tệp CNAME**.
2. Chờ GitHub kiểm DNS xong và cấp chứng chỉ (vài phút đến vài giờ) → bật **Enforce HTTPS**.
3. Kiểm:
   - `https://aihoctap.online/` mở app.
   - `https://aihoctap.online/teacher.html` mở trang giáo viên.
   - `https://aihoctap.online/robots.txt`, `/sitemap.xml`, `/seo/og-image.png` trả 200.
   - Địa chỉ github.io cũ tự chuyển sang tên miền mới.
4. Đăng nhập học sinh + giáo viên trên tên miền mới, hỏi Gia sư 1 câu (kiểm Worker nhận tên miền mới).

### Bước 5 — Sau khi chạy ổn
- Xem trước khi chia sẻ: dán link vào Facebook Sharing Debugger (developers.facebook.com/tools/debug) → "Scrape again"; gửi thử link trong Zalo.
- Google Search Console: thêm thuộc tính tên miền (xác minh bằng bản ghi TXT), gửi `https://aihoctap.online/sitemap.xml`.
- Báo học sinh: **mở https://aihoctap.online và cài lại ứng dụng**. Ứng dụng cài từ địa chỉ cũ vẫn mở được bản đã lưu, nhưng không tự cập nhật nữa (trình duyệt không cho cập nhật qua chuyển hướng). Bài nháp lưu trên máy ở bản cũ không chuyển sang bản mới. Vì vậy giữ github.io trong `ALLOWED_ORIGIN` ít nhất vài tuần.

## 3. Báo cáo
Ghi `docs/handoff/antigravity-claude-ten-mien-xong.md`: kết quả từng bước (lệnh, mã trạng thái), ảnh xem trước link trên Zalo/Facebook (đường dẫn ảnh trên máy), không ghi khóa. Cập nhật `aisgk.md` (ghi rõ: Zalo Bot đã bỏ theo quyết định của thầy).
