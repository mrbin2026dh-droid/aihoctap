# Bài thi từ một file Google Sheet (bản đơn giản — dùng từ 27/10/2026)

## Cài một lần (5 phút)
1. Tạo một Google Sheet mới (ví dụ "Bai thi Tin hoc").
2. **Tiện ích mở rộng → Apps Script** → xóa nội dung có sẵn → dán toàn bộ `Code.gs` này → **Lưu**.
3. Quay lại Sheet, tải lại trang → menu **Bài thi → Tạo mẫu** (lần đầu bấm Cho phép). Có 2 trang:
   - **HocSinh**: `Stt | Họ tên | Lớp | Mã học sinh | Mã PIN | Trạng thái`
   - **DeThi**: `Stt | Lớp | Đề bài | A | B | C | D | Đáp án đúng | Điểm`
4. Apps Script → **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**: Thực thi với tư cách **Tôi**, Ai có quyền truy cập **Bất kỳ ai** → Triển khai → chép địa chỉ kết thúc bằng `/exec` → gửi Claude (Claude dán vào `frontend/hoc/thi.js`).

## Dùng hằng ngày
- Điền học sinh vào **HocSinh** (cột Mã PIN nên để định dạng Văn bản để giữ số 0 đầu).
- Điền câu hỏi vào **DeThi**. Cột **Lớp** ghi lớp được làm câu đó (ví dụ `9A`); để trống = mọi lớp. Đáp án đúng: A/B/C/D.
- Học sinh mở ứng dụng → tab **Thi** → **Vào bài thi** → gõ Mã học sinh + PIN → **Lấy đề** → làm → **Nộp bài** → thấy điểm.
- Kết quả tự ghi vào trang **KetQua** (giờ nộp, mã, họ tên, lớp, điểm, số câu đúng, bài làm từng câu); cột Trạng thái của em thành **Đã thi**.
- Cho em làm lại: xóa chữ "Đã thi" ở cột Trạng thái của em đó.
- Đổi đề: sửa hoặc xóa dòng trong DeThi — không cần triển khai lại. Chỉ khi Claude gửi `Code.gs` mới mới cần: dán → Lưu → Triển khai → Quản lý triển khai → ✏️ → Phiên bản mới.
