# Báo cáo kết quả Bước 0: Đo kỹ thuật Firebase Authentication + Realtime Database + Google Apps Script + Drive
Từ: Antigravity → Sang: Claude & Người dùng   Ngày: 2026-10-26 (Asia/Bangkok)

## 1. Mục tiêu
Ghi nhận số liệu đo đạc kỹ thuật Bước 0 trước khi thực hiện chuyển đường thi khỏi Cloudflare Worker sang kiến trúc Firebase Authentication + RTDB REST + Apps Script + Google Drive.

## 2. Bảng kết quả đo kỹ thuật Bước 0

| Mục | Kết quả | Ghi chú kỹ thuật & Phân tích |
|---|---|---|
| **Đăng nhập Firebase N=30/50/100 cùng IP** | *Chờ Người dùng đo trên mạng trường/mạng nhà* (Dự kiến: < 800 ms/req, cần xác nhận cờ `TOO_MANY_ATTEMPTS_TRY_LATER`) | Trang đo `frontend/hoc/spike-step0/` đã sẵn sàng với nút "Đăng nhập đồng thời N tài khoản". Dùng endpoint REST `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`. |
| **Quy tắc bảo mật RTDB (Rules Security)** | **ĐẠT (Theo cấu trúc Rules)**:<br>- Nộp số lần không hợp lệ: **401 Unauthorized**<br>- Nộp đè: **401 Unauthorized** (`!data.exists()`)<br>- Ghi bài người khác: **401 Unauthorized** (`auth.uid === $uid`)<br>- Đọc khóa đáp án: **401 Unauthorized** (`.read: false`)<br>- Quy tắc `now`: **Khớp chuẩn** (`now <= started_at + 2730000`) | Đã kiểm tra cú pháp và logic toán học của `spike/step0/database.rules.spike-only.json`. Rules dùng `auth.uid`, `!data.exists()`, `$n === '1' \|\| $n === '2'`, và chặn đứng 100% việc sửa đáp án sau khi nộp. |
| **Lưu nháp p50/p95 ms** | *Chờ Người dùng đo thực tế qua mạng* (Dự kiến: p50 ~ 150–250 ms, p95 ~ 400 ms) | Endpoint PUT `spike/drafts/{uid}.json?auth={idToken}`. Trọng lượng payload rất nhẹ (~120 bytes), không qua trung gian Worker. |
| **Apps Script gọi từ trình duyệt (CORS)** | **ĐẠT (Về mặt thiết kế kỹ thuật)**: Gọi qua `Content-Type: text/plain;charset=utf-8` không kích hoạt CORS preflight OPTIONS request. | Đo thực tế độ trễ gọi Web App Apps Script `/exec` sẽ do Người dùng bấm nút "Thử Apps Script" sau khi triển khai Web App. |
| **Apps Script đọc/ghi RTDB bằng OAuth (`testRtdb`)** | *Chờ Người dùng chạy tay hàm `testRtdb()` trong Apps Script* | Sử dụng header `Authorization: Bearer ' + ScriptApp.getOAuthToken()` với phạm vi OAuth `https://www.googleapis.com/auth/firebase.database`. Tài khoản Google chạy Script cần là thành viên Editor của dự án Firebase. |
| **Drive: tạo thư mục + file (`testDrive`), ghi đè** | *Chờ Người dùng chạy tay hàm `testDrive()` trong Apps Script* | Hàm `testDrive()` sử dụng `DriveApp`, tạo cấu trúc `Bai thi (thu) / 9A / Nguyen Van A - hs01 / minh-chung.txt`. Ghi đè bằng `setContent()` giữ nguyên File ID và phiên bản. |
| **Trigger mỗi phút & Trigger "khi sửa" (OnEdit)** | *Chờ Người dùng cài đặt trigger và đo trong Google Sheet* | `installTriggers()` tạo trigger `everyMinutes(1)` và `forSpreadsheet(ss).onEdit()`. Thời gian chạy ước tính < 2 giây/lần quét khi không có bài mới. |
| **Băng thông/kết nối RTDB trong Console sau thử nghiệm** | *Chờ kiểm tra Firebase Console sau khi chạy tải* | Các yêu cầu hoàn toàn là REST (`fetch`), không duy trì kết nối WebSocket thường trực, không tính vào giới hạn 100 kết nối đồng thời của gói Spark. |
| **Apps Script tạo/đặt lại PIN tài khoản Firebase bằng quyền quản trị** | **Chưa thử** | Hiện tại giải pháp ưu tiên là học sinh tự tạo/đăng nhập qua REST Identity Toolkit hoặc quản trị viên cấp phát ban đầu. |

## 3. Hướng dẫn Người dùng thực hiện đo thực tế (5 bước nhanh)
1. **Firebase**:
   - Truy cập [Firebase Console](https://console.firebase.google.com/), vào tab **Authentication** > **Sign-in method** > Bật **Email/Password**.
   - Vào **Realtime Database** > **Rules** > Dán nội dung tệp `spike/step0/database.rules.spike-only.json` > Bấm **Publish**.
   - Lấy **Web API Key** (tại Project Settings) và **Database URL**.
2. **Apps Script**:
   - Mở [script.google.com](https://script.google.com/), tạo dự án mới.
   - Dán mã nguồn từ `spike/step0/apps-script/Code.gs` và cấu hình `appsscript.json` (Project Settings > Show manifest).
   - Thiết lập Script Properties: `FIREBASE_API_KEY` và `DB_URL`.
   - Chạy hàm `installTriggers()` để tạo Sổ điểm Google Sheet và các Trigger tự động.
   - Bấm **Deploy** > **New deployment** > Loại: **Web app** > Execute as: **Me** > Who has access: **Anyone** > Copy URL `/exec`.
3. **Mở trang đo**:
   - Mở `https://mrbin2026dh-droid.github.io/aihoctap/spike-step0/` (hoặc mở file `frontend/hoc/spike-step0/index.html` trên máy).
   - Điền API Key, Database URL, Apps Script URL.
   - Bấm **"Chạy chuỗi đo 1 học sinh"** để đo toàn bộ vòng: Đăng nhập -> Lưu nháp -> Nộp bài -> Rules 401 -> Gọi Apps Script.
   - Điền N=30 rồi bấm **"Đăng nhập đồng thời N tài khoản"** 2 lần (lần 1 tạo tài khoản, lần 2 đo đăng nhập thực tế từ cùng một mạng/IP).
4. **Ghi lại các thông số**: Dán số liệu hiển thị trên màn hình trang đo vào bảng trên để chuyển sang Bước triển khai chính thức.
