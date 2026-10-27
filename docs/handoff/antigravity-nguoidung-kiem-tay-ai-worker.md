# Hướng dẫn Thầy/Cô kiểm thử tay bản Worker mới (Gia sư AI chính xác hơn)

Từ: Antigravity → Sang: Người dùng (Thầy/Cô)  
Ngày: 28/10/2026

## 1. Kết quả nâng cấp & Deploy Worker
- **Trạng thái deploy**: Đã deploy thành công lên Cloudflare Worker `aihoctap-gate`.
  - **Version ID mới**: `675db789-800d-406f-aba6-bc0706694629`
  - **Version ID dự phòng (Rollback nếu lỗi)**: `2ea55f4e-9718-4231-affb-e0b2ce36079f`
- **Các cải tiến cốt lõi đã tích hợp**:
  1. **Khung chat thành cột bên phải**: Trên màn hình máy tính desktop ($\ge 1100\text{px}$), khi mở Gia sư AI, khung chat sẽ biến thành cột bên phải cao trọn màn hình, nội dung bài đọc tự động thu gọn sang trái và thanh % đọc bài thẳng hàng với nội dung bài học.
  2. **Bộ lọc thông minh chống chặn nhầm**: Không còn bị nhầm các câu hỏi khái niệm thông thường (như "Dữ liệu số là gì?", "chọn bộ nhớ", "câu dưới đây") thành việc hỏi xin đáp án trắc nghiệm.
  3. **Chống cụt câu**: Ghép trọn vẹn phản hồi Gemini và tăng token tối đa lên 2048, tự động ngắt câu tròn trịa không bỏ dở.
  4. **RAG bài dài**: Tự động trích xuất các đoạn văn bản có từ khóa liên quan nhất thay vì chỉ cắt 8.000 ký tự đầu.
  5. **Nhận xét bài thi thử**: Phân tích kết quả thi thử có hiệu ứng gõ chữ dần sinh động.

---

## 2. Các bước Thầy/Cô thử tay (3 kịch bản)

### Kịch bản 1: Hỏi khái niệm bài học
- Vào bài học Tin học 9: **"Thế giới kĩ thuật số"** (hoặc bất kỳ bài học nào).
- Bấm mở biểu tượng Gia sư AI (khung chat mở ra ở cột phải).
- Gõ câu hỏi: **"Dữ liệu số là gì?"**
- **Kết quả mong đợi**: AI giải thích rõ ràng định nghĩa theo SGK, kèm ví dụ thực tế, viết trọn vẹn câu, **KHÔNG** xuất hiện thông báo từ chối *"Thầy/Cô không đưa ra đáp án..."*.

### Kịch bản 2: Hỏi bài tập trắc nghiệm (Thử thách sư phạm)
- Mở một câu hỏi luyện tập/trắc nghiệm trong bài.
- Gõ hỏi AI: **"Câu này chọn gì?"** hoặc **"Đáp án là A hay B?"**
- **Kết quả mong đợi**: AI từ chối đưa ra đáp án trực tiếp, đóng vai trò gia sư gợi ý học sinh đọc lại phần kiến thức liên quan để tự tìm câu trả lời.

### Kịch bản 3: Nhận xét bài thi thử
- Vào mục **Thi** → chọn một bài **Thi thử** có bật chế độ *"Cho xem điểm"*.
- Làm bài và bấm **Nộp bài**.
- **Kết quả mong đợi**: Tại màn hình kết quả thi, mục **"Nhận xét của Gia sư AI"** sẽ tự động phân tích các câu làm đúng/sai với hiệu ứng gõ chữ dần mượt mà.

---

## 3. Lưu ý thêm
- Nếu trong lúc thử nghiệm thầy thấy AI báo "Giờ thi", thầy chỉ cần vào **Hồ sơ** → **Cài đặt Gia sư AI** và **BỎ chọn** ô *"Khóa AI trong khi kiểm tra"*.
- Nếu thầy muốn cập nhật trang `TaiLieu` trên Google Sheet: Copy file `apps-script/sheet-exam/Code.gs` dán vào Apps Script, lưu lại và bấm menu **Bài thi → Tạo mẫu**.
