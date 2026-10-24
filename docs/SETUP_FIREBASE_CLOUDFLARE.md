# Hướng dẫn Thiết lập Hạ tầng Firebase, Cloudflare & Gemini (Chờ người dùng)

Tài liệu này hướng dẫn người quản trị thiết lập các dịch vụ đám mây thực tế để vận hành hệ thống AI AGENT SGK mà không cần máy chủ riêng (Zero-Server).

> **CẢNH BÁO BẢO MẬT QUAN TRỌNG**:
> - TUYỆT ĐỐI KHÔNG dán các khóa bí mật (Private Key, Gemini API Key) vào hộp chat, nhật ký `aisgk.md` hoặc commit lên Git.
> - Toàn bộ các khóa bí mật chỉ được lưu trong biến môi trường bảo mật của Cloudflare Worker (`wrangler secret put`).
> - Khóa công khai (`FIREBASE_PUBLIC_KEY`) **không cần nạp thủ công**: Edge Worker tự động suy luận khóa công khai trực tiếp từ `FIREBASE_PRIVATE_KEY` thông qua hàm trích xuất Web Crypto JWK.
> - **Xác thực Realtime Database (RTDB)**: Hoàn toàn tự động thông qua chuẩn Google OAuth 2.0. Worker tự động tạo và lưu đệm (cache) Google OAuth2 Access Token từ Service Account (`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`) và gửi qua header `Authorization: Bearer <token>`, không dùng Database Secret cũ.

---

## Bước 1: Khởi tạo hoặc Tái sử dụng Dự án Firebase (Authentication & Realtime Database)

Người dùng có 2 lựa chọn theo nhu cầu thực tế:

### Lựa chọn A (Khuyến nghị): Khởi tạo Dự án Firebase Mới Hoàn Toàn (ví dụ: `ai-agent-sgk`)
1. Truy cập [Firebase Console](https://console.firebase.google.com/) và nhấn **Add project** (Tạo dự án mới, ví dụ: `ai-agent-sgk`).
2. Tách biệt hoàn toàn cơ sở dữ liệu, người dùng và khóa API với các dự án cũ.

### Lựa chọn B: Tái sử dụng Dự án Firebase Sẵn có (ví dụ: `ai-sgk-tinhoc`)
1. Nếu bạn đã có dự án `ai-sgk-tinhoc` và muốn dùng lại để tiết kiệm thời gian cấu hình:
   - **BẮT BUỘC RÀNG BUỘC TÊN MIỀN (HTTP Referrer Restriction)**:
     - Truy cập [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials) với dự án tương ứng.
     - Chọn Web API Key (khóa dùng ở frontend client).
     - Trong mục **Application restrictions**, chọn **Websites (HTTP referrers)**.
     - Thêm tên miền GitHub Pages của bạn: `https://<your-username>.github.io/*` và tên miền kiểm thử cục bộ: `http://localhost:*`, `http://127.0.0.1:*`.
     - Lưu lại để đảm bảo dù Web API Key có nằm trong mã nguồn công khai của frontend thì kẻ xấu cũng không thể dùng ở các website khác.

---

### Các bước cấu hình Firebase (áp dụng cho cả 2 lựa chọn):
1. **Kích hoạt Firebase Authentication**:
   - Chọn mục **Build** > **Authentication** > **Get started**.
   - Tại tab **Sign-in method**: Kích hoạt **Custom** (hoặc Anonymous nếu cần), cho phép đăng nhập qua Firebase Custom Token do Cloudflare Worker cấp.
2. **Kích hoạt Realtime Database (RTDB)**:
   - Chọn **Build** > **Realtime Database** > **Create Database**.
   - Chọn khu vực (Location: ví dụ `Singapore - asia-southeast1`).
   - Chọn chế độ ban đầu **Start in locked mode**.
   - Truy cập tab **Rules**, dán toàn bộ nội dung từ tệp [database.rules.json](database.rules.json) trong dự án và nhấn **Publish**.
3. **Tạo Service Account Key**:
   - Nhấn biểu tượng Bánh răng (Project settings) > tab **Service accounts**.
   - Chọn **Firebase Admin SDK** và nhấn **Generate new private key** > **Generate key**.
   - Tệp JSON tải về máy tính chứa các thông tin quan trọng:
     - `client_email` (Ví dụ: `firebase-adminsdk-xxxxx@ai-agent-sgk.iam.gserviceaccount.com`)
     - `private_key` (Chuỗi PEM bắt đầu bằng `-----BEGIN PRIVATE KEY-----`)
     - `private_key_id`
     - `project_id`
   - *Lưu tệp này ở nơi an toàn ngoài thư mục dự án.*

---

## Bước 1b: Nạp Gói Đáp án Bảo Mật Lên RTDB (Dùng công cụ `upload_private_packages.py`)

Hệ thống đã tách biệt 100% câu hỏi công khai và đáp án riêng tư (Zero-Leak). Để chấm bài tự động và gia sư Socrates hoạt động chính xác, đáp án cần được nạp trực tiếp vào node `/packages_private/${course_id}:${lesson_id}.json` trên Firebase RTDB mà **KHÔNG ĐƯỢC COMMIT LÊN REPO CÔNG KHAI**.

1. Chuẩn bị thư mục chứa dữ liệu bài học gốc (có chứa `correct_answer` hoặc `quiz`) tại một thư mục **NGOÀI repository Git** (ví dụ: `C:/backup_curriculum_full`).
2. Cài đặt thư viện hỗ trợ (nếu chưa có):
   ```bash
   pip install pyjwt cryptography
   ```
3. Chạy thử nghiệm với cờ `--dry-run` để kiểm tra số lượng gói câu hỏi được nhận diện:
   ```bash
   python tools/upload_private_packages.py --backup-dir "C:/backup_curriculum_full" --dry-run
   ```
4. Thực hiện nạp gói chính thức lên Firebase RTDB bằng Service Account:
   ```bash
   python tools/upload_private_packages.py \
     --backup-dir "C:/backup_curriculum_full" \
     --service-account "C:/path/to/serviceAccountKey.json" \
     --database-url "https://<your-project-id>-default-rtdb.asia-southeast1.firebasedatabase.app"
   ```
5. Kết quả: Toàn bộ đáp án được lưu dạng phẳng `/packages_private/<courseId>:<lessonId>.json` với dấu phân cách `:` chống trùng lặp, bảo vệ tuyệt đối trước học sinh và mã nguồn public.

---

## Bước 2: Lấy Khóa Google Gemini AI (Gia sư Socrates)

1. Truy cập [Google AI Studio](https://aistudio.google.com/).
2. Đăng nhập tài khoản Google và nhấn **Get API key**.
3. Nhấn **Create API key** (chọn dự án Google Cloud tương ứng hoặc tạo mới).
4. Sao chép chuỗi API Key được cấp (chuỗi bắt đầu bằng `AIza...`).
5. Mô hình được hỗ trợ mặc định: `gemini-2.5-flash` (nhanh, chi phí tối ưu, bảo mật qua header `x-goog-api-key`).

---

## Bước 3: Thiết lập Cloudflare Worker & Durable Objects (Gói Free SQLite)

1. Đăng ký/Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Cài đặt công cụ dòng lệnh Wrangler trên máy tính:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Tạo tệp cấu hình `wrangler.toml` trong thư mục dự án:
   ```toml
   name = "aihoctap-gate"
   main = "worker/index.js"
   compatibility_date = "2026-10-24"
   compatibility_flags = ["nodejs_compat"]

   [durable_objects]
   bindings = [
     { name = "GATE_DO", class_name = "GateDurableObject" }
   ]

   # Chú ý: Trên gói Cloudflare Free và các namespace mới từ 2024,
   # bắt buộc khai báo new_sqlite_classes (backend SQLite) thay vì new_classes cũ.
   [[migrations]]
   tag = "v1"
   new_sqlite_classes = ["GateDurableObject"]

   [vars]
   GEMINI_MODEL = "gemini-2.5-flash"
   ```

4. **Nạp các biến môi trường bí mật lên Cloudflare (Worker Secrets)**:
   Chạy các lệnh sau trong terminal và dán giá trị tương ứng khi được hỏi:
   ```bash
   # 1. URL của Firebase Realtime Database
   wrangler secret put FIREBASE_DATABASE_URL
   # (Ví dụ: https://ai-agent-sgk-default-rtdb.asia-southeast1.firebasedatabase.app)

   # 2. Client Email từ Service Account (dùng tạo OAuth2 Access Token và cấp Firebase Custom Token)
   wrangler secret put FIREBASE_CLIENT_EMAIL
   # (Ví dụ: firebase-adminsdk-xxxxx@ai-agent-sgk.iam.gserviceaccount.com)

   # 3. Private Key từ Service Account
   wrangler secret put FIREBASE_PRIVATE_KEY
   # (Dán toàn bộ khối -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----)
   # Lưu ý: Worker tự động xử lý ký tự xuống dòng \n, tự động suy luận public key và tự động đổi OAuth access token.

   # 4. Gemini API Key cho gia sư AI (sẽ được gửi qua header x-goog-api-key)
   wrangler secret put GEMINI_API_KEY

   # 5. Khóa quản trị giáo viên mở khóa tài khoản (yêu cầu chuỗi ngẫu nhiên độ dài >= 24 ký tự)
   # KHÔNG dùng mật khẩu dễ đoán. Hãy sinh ngẫu nhiên, ví dụ: openssl rand -hex 24
   wrangler secret put TEACHER_ADMIN_SECRET
   # (Ví dụ chuỗi ngẫu nhiên: 7c4e1b8a9f3d2e5a6c0b4d8e1f2a3c4b5d6e7f8a9b0c1d2e)

   # 6. Tên miền frontend được phép gọi API (BẮT BUỘC để kích hoạt CORS bảo mật)
   wrangler secret put ALLOWED_ORIGIN
   # (Ví dụ: https://mrbin2026dh-droid.github.io)
   ```

5. Triển khai Worker:
   ```bash
   wrangler deploy
   ```
   Sau khi hoàn tất, Cloudflare sẽ cấp URL Worker (ví dụ: `https://aihoctap-gate.<your-subdomain>.workers.dev`).

---

## Bước 4: Xử lý Repository Cũ & Khởi tạo Repository Sạch Mới

1. **Xử lý Repository Cũ (`mrbin2026dh-droid/aihoctap`)**:
   - **BẮT BUỘC**: Truy cập vào repository cũ trên GitHub: `https://github.com/mrbin2026dh-droid/aihoctap/settings`.
   - Kéo xuống mục **Danger Zone**:
     - Hoặc chọn **Change repository visibility** -> Chuyển sang **Private**.
     - Hoặc chọn **Delete this repository** (Xóa hoàn toàn).
   - **Lý do**: Lịch sử commit cũ (như commit `7f670c9`) từng chứa dữ liệu bài học kèm đáp án/lời giải. Nếu repository cũ vẫn để Public, bất kỳ ai có đường dẫn commit cũ đều có thể xem được dữ liệu nhạy cảm.

2. **Khởi tạo Repository Sạch Mới (ví dụ: `aihoctap-clean`)**:
   - Tạo một Repository mới trên GitHub (Công khai / Public).
   - *Lưu ý*: Gói GitHub Pages miễn phí bắt buộc repository phải ở chế độ Public để kích hoạt Pages.
   - Đẩy cây mã nguồn đã được lọc sạch (đã chạy `tools/sanitize_curriculum.py` 0 leak).
   - Kiểm chứng commit cũ `7f670c9` trên repository mới trả về lỗi 404 Not Found.

3. **Kích hoạt GitHub Pages**:
   - Vào **Settings** > **Pages**.
   - Mục **Build and deployment**: Chọn Source là **GitHub Actions**.

---

## Bước 5: Bàn giao & Kích hoạt

Sau khi người dùng hoàn thành cấu hình các bước trên:
1. Cập nhật URL Worker vào `frontend/hoc/api.js`.
2. Thông báo cho AI để thực hiện kiểm thử kết nối trực tiếp (Live Network Verification) qua Worker thật.
