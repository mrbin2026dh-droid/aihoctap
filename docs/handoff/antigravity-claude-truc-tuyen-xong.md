# Antigravity → Claude: Đã hoàn tất cài đặt trực tuyến, thời gian học, Worker dự phòng, cập nhật VPS & Enforce HTTPS

## 1. Kết quả thực hiện

### 1.1. Cập nhật Luật Firebase RTDB (`thoi_gian`)
- Đã nạp thành công bộ luật mới từ `spike/step0/database.rules.ai-sgk-final.json` vào Firebase Realtime Database.
- Xác nhận kiểm tra:
  ```bash
  curl -s "https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app/thoi_gian.json?shallow=true"
  ```
  Kết quả trả về: `null` (đã mở quyền đọc hợp lệ, không còn lỗi `Permission denied`).

### 1.2. Cloudflare Worker Gateway (`aihoctap-gate`)
- Đã bổ sung cấu hình mô hình dự phòng:
  - `GEMINI_MODEL = "gemini-3.5-flash-lite"`
  - `GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest"`
- Đã triển khai live thành công qua `npx wrangler deploy`:
  - **Version ID**: `34e051ef-8c18-42d1-92dd-f70fa3652384`.

### 1.3. Cập nhật Máy chủ VPS Bộ não
- Đã chạy cập nhật `setup.sh` và kiểm thử tự động:
  - **Unit Tests**: Chạy hoàn tất **20/20 ca OK** (`Ran 20 tests in 0.912s: OK`).
- Chạy thử nghiệm lệnh lượt nhanh:
  ```bash
  python3 -m brain quick --env /opt/brain/.env
  ```
  Kết quả: Thu thập thành công dữ liệu từ Firebase, gửi hiểu lầm cho Gia sư, 0 lỗi.
- Hai dịch vụ systemd timer (`brain.timer` và `brain-quick.timer`) đang hoạt động bình thường.

### 1.4. Thắt chặt Bảo mật Máy chủ VPS
- Cấu hình SSH đã được chuyển sang chế độ an toàn cao nhất:
  - `PasswordAuthentication no` (Cấm đăng nhập bằng mật khẩu).
  - `PermitRootLogin without-password` (Chỉ cho phép đăng nhập root qua SSH Key).
- Đã khởi động lại dịch vụ SSH (`systemctl restart ssh`) và xác thực kết nối qua khóa bí mật thành công.

### 1.5. Cưỡng chế Chuyển hướng HTTPS (Fix lỗi Not Secure do Cache)
- Đã bổ sung thẻ meta và script tự động nâng cấp HTTPS vào `frontend/hoc/index.html` và `frontend/hoc/teacher.html`:
  - `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`
  - Tự động phát hiện nếu giao thức là `http:` thì lập tức chuyển hướng `location.replace('https://' + location.host + ...)` trước khi nạp trang.

### 1.6. Kết quả Kiểm thử Hồi quy
- `test_accounts_live.cjs`: **42/42 ca PASS** (cột Trực tuyến, thời gian học 7 ngày, lọc lớp, chuyên cần).
- `test_install_browser.cjs`: **25/25 ca PASS**.
- `test_loading_states.cjs`: **11/11 ca PASS**.
- `test_tutor_auto_lesson.mjs`: **11/11 ca PASS**.

---

## 2. Việc Thầy thao tác (Dành cho Thầy)

1. **Khóa API Google (để học sinh đăng nhập có vé trực tuyến không bị chặn Referer)**:
   - Vào **Google Cloud Console** → **APIs & Services** → **Credentials** → chọn Khóa API web của dự án `ai-sgk-tinhoc`.
   - Tại mục **Website restrictions** (Giới hạn trang web): Thêm `https://aihoctap.online/*` (giữ nguyên dòng `*.github.io` cũ) → Bấm **Save**.
   - Vào **Firebase Console** → **Authentication** → **Settings** → **Authorized domains**: Thêm `aihoctap.online`.
2. **Xóa cảnh báo "Not secure" trên Chrome của Thầy**:
   - Tại tab đang mở trang `aihoctap.online`, Thầy bấm **`Ctrl + Shift + R`** (hoặc `Ctrl + F5`) để trình duyệt bỏ qua cache cũ và tải lại bằng HTTPS có chứng chỉ SSL hợp lệ.
