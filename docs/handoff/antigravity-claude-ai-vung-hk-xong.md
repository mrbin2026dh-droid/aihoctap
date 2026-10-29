# Antigravity → Claude & Thầy: Đã triển khai Worker Placement US (Chống chặn vùng Hong Kong)

Ngày: 29/10/2026 12:28 (Asia/Bangkok)

---

## 1. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)

### Hiện tượng
- Toàn bộ các bài tự luận nộp hôm nay đều rơi vào trạng thái "chờ chấm", học sinh thấy 502 Bad Gateway.
- Cả 2 khóa Gemini trong kho của Thầy đều ghi nhận 0/1500 lượt gọi thành công.
- Trace mạng từ máy người dùng tại Việt Nam vào Cloudflare đi qua trạm **HKG (Hong Kong)** (`colo=HKG loc=VN`).

### Nguyên nhân kỹ thuật
- Mặc định, Cloudflare Workers chạy phân tán tại trạm mạng gần người dùng nhất (Anycast Edge PoP). Khi học sinh hoặc giáo viên tại Việt Nam truy cập, Worker được kích hoạt và chạy trực tiếp tại cụm máy chủ **Hong Kong (HKG)**.
- Khi Worker từ Hong Kong gửi yêu cầu HTTP sang API Google Gemini (`https://generativelanguage.googleapis.com`), Google phát hiện IP nguồn thuộc vùng Hong Kong.
- **Chính sách của Google**: Google Gemini API áp dụng geo-restriction, **không hỗ trợ / chặn các cuộc gọi từ Hong Kong và Trung Quốc đại lục**.
- Google trả về mã **HTTP 400** với lỗi:
  ```json
  {
    "error": {
      "code": 400,
      "message": "User location is not supported for the API use.",
      "status": "FAILED_PRECONDITION"
    }
  }
  ```
- Vì mã trả về là 400 (không phải 429 quota hay 401 auth), Worker phiên bản cũ hiểu là lỗi dịch vụ upstream nên bọc thành HTTP 502 Bad Gateway và không thể cứu vãn dù đổi bao nhiêu khóa hay mô hình.

---

## 2. Giải pháp kỹ thuật đã triển khai

1. **Cưỡng chế vị trí chạy Worker tại Mỹ (Cloudflare Placement)**:
   - Cấu hình trong `wrangler.toml`:
     ```toml
     [placement]
     region = "aws:us-east-1"
     ```
   - Cloudflare tự động định tuyến thực thi Worker tại khu vực Đông Bắc Hoa Kỳ (US East - Nơi Google hỗ trợ 100% dịch vụ Gemini).
2. **Triển khai Cloudflare Worker thành công**:
   - **Worker Name**: `aihoctap-gate`
   - **Current Version ID**: `d831f13d-15c0-4d97-9ad7-f10baf9ff15a`
   - **Placement Region**: `aws:us-east-1`
3. **Phân biệt lỗi 400 thông minh trong Worker & Giao diện**:
   - Bắt chính xác chuỗi `User location is not supported` để thông báo rõ ràng "Google chặn vùng đặt máy chủ", không thử lại lặp vô ích.
   - Bắt chính xác lỗi sai khóa API để đổi sang khóa khác.
4. **Kiểm thử tự động**:
   - `test_gemini_recovery.mjs`: **15/15 PASS (100%)**, bao gồm cả ca test giả lập lỗi 400 Location not supported và 400 API key invalid.

---

## 3. Hướng dẫn Thầy thực hiện bước tiếp theo

Thầy mở lại:
👉 **`https://aihoctap.online/teacher.html`**

1. Đăng nhập tài khoản Giáo viên.
2. Vào mục **Hồ sơ** → cuộn xuống mục **Khóa API**.
3. Bấm nút **"Kiểm tra AI ngay"**.
4. Quan sát dòng thông tin địa lý và bảng kết quả:
   - Dòng: **"Máy chủ AI đang gọi Google từ: ..."** (Kỳ vọng: Hiện trạm tại Mỹ như `IAD / US`, `EWR / US`... thay vì `HKG / HK`).
   - Cột **Mã**: Có ít nhất một dòng đạt **200 (Chạy tốt)**.
5. Sau khi thấy mã **200**:
   - Nhờ 4 học sinh có bài "chờ chấm" sáng nay mở tab Thi → bấm **"Chấm lại phần tự luận"**.
   - Bài làm sẽ được chấm điểm và nhận xét ngay tức thì.
