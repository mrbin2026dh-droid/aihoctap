# AI SGK TIN HỌC THCS — NỀN TẢNG TỰ HỌC & GIA SƯ AI THÔNG MINH

**Dành cho AI làm việc với dự án:** bắt buộc đọc [nhật ký aisgk.md](aisgk.md) và [quy tắc AGENTS.md](AGENTS.md) trước khi tiếp tục. Ghi mọi kế hoạch và thay đổi code vào nhật ký để AI khác tiếp nối.

**PWA học sinh:** `/hoc/`; **xuất bản bài học:** `/hoc/teacher.html`. Xem [hướng dẫn chạy, offline và cấu hình lưu bền](docs/PWA.md).

Ứng dụng hỗ trợ học sinh THCS (Lớp 6, Lớp 7, Lớp 8, Lớp 9) tự học môn Tin học theo chương trình **Kết nối tri thức với cuộc sống**, tích hợp **Gia sư Trí tuệ Nhân tạo Socrates (Google Gemini AI)**, **Đăng nhập Google Firebase** và **Bảng điều khiển Quản lý Học sinh & Phân tích Sư phạm** dành cho Thầy/Cô.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Học theo SGK Chuẩn Mực**:
   * Số hóa mục lục 17 bài học Tin học 6 và Tin học 9 với sơ đồ cây accordion khoa học.
   * Giao diện đọc lý thuyết phân tầng nhẹ nhàng, định dạng Markdown chuẩn sư phạm.

2. **Luyện Tập Tương Tác Khan-Focus**:
   * Tập trung 1 câu hỏi tại một thời điểm, loại bỏ xao nhãng.
   * Chấm điểm và phản hồi sư phạm ngay lập tức, giải thích vì sao đúng/sai.

3. **Gia Sư Trí Tuệ Nhân Tạo Socrates (Google ADK)**:
   * Áp dụng phương pháp sư phạm gợi mở (Socratic Method), không đưa ra đáp án trực tiếp mà dẫn dắt học sinh tự suy luận.
   * Hiệu ứng chữ gõ sống động (Typewriter Streaming) và ngăn chặn câu hỏi lạc đề (Guardrails).

4. **Cổng Đăng Nhập Học Sinh (Google Identity)**:
   * Học sinh đăng nhập 1 chạm bằng tài khoản Google (Gmail / Google Workspace for Education).
   * Tự động lưu tiến độ và điểm số lên Google Firebase Realtime Database.

5. **Dashboard Quản Lý Học Sinh Dành Cho Giáo Viên**:
   * Theo dõi 5 chỉ số KPI toàn lớp (Sĩ số, Hoàn thành, Điểm TB, Đang học, Cần hỗ trợ).
   * Biểu đồ tròn tiến độ và biểu đồ cột năng lực 5 chủ đề Tin học.
   * Trợ lý Gemini AI cố vấn sư phạm, tự động đề xuất phương pháp hỗ trợ học sinh yếu.
   * Xuất báo cáo điểm số học sinh dạng file Excel CSV chuẩn UTF-8 BOM.

---

## 🚀 HƯỚNG DẪN CHẠY DỰ ÁN TRÊN MÁY CỤC BỘ (LOCAL)

### 1. Cài đặt môi trường
Yêu cầu: Máy tính đã cài đặt **Python 3.10+**.

```bash
# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

### 2. Thiết lập biến môi trường
Tạo file `.env` tại thư mục gốc với nội dung:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8000
HOST=0.0.0.0
```

### 3. Khởi chạy ứng dụng
```bash
# Cách 1: Chạy trực tiếp qua Python
python -m backend.server

# Cách 2 (Windows): Nhấp đúp chuột vào file
Chay_Ung_Dung_Web.bat
```
Truy cập trình duyệt tại: **`http://localhost:8000`**

---

## 🌐 HƯỚNG DẪN TRIỂN KHAI ONLINE TRÊN RENDER

Dự án đã tích hợp sẵn tệp cấu hình **`render.yaml`** chuẩn Blueprint:
1. Đăng nhập vào [Render.com](https://render.com) bằng tài khoản GitHub.
2. Chọn **New** → **Web Service** → Chọn kho lưu trữ GitHub của bạn.
3. Render sẽ tự động nhận diện:
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
4. Trong mục **Environment Variables**, thêm khóa:
   * `GEMINI_API_KEY`: *(Nhập API Key Gemini của bạn)*
5. Bấm **Deploy** để nhận đường link online chính thức.

---

## 🛡️ AN TOÀN & BẢO MẬT HỌC ĐƯỜNG
* Tệp `.env` chứa khóa API bí mật được bảo vệ trong `.gitignore`, tuyệt đối không bao giờ bị đưa lên kho mã công khai.
* Dữ liệu học sinh chỉ sử dụng để lưu kết quả bài tập và hỗ trợ giảng dạy.
