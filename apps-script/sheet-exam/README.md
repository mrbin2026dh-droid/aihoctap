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

## Menu "Thi" của giáo viên (bản 27/10, thay bản có mật khẩu)
Cập nhật một lần:
1. Dán lại toàn bộ `Code.gs` → Lưu → Triển khai → Quản lý bản triển khai → Sửa → **Phiên bản mới** (giữ địa chỉ /exec).
2. Mở Sheet → menu **Bài thi → Tạo mẫu** (đổi tiêu đề cột B của DeThi thành "Khối", thêm trang DeThiThu, bổ sung khóa trong CauHinh; không xóa dữ liệu).
3. Nếu trang CauHinh còn ô `mat_khau_gv` cũ: menu **Bài thi → Đặt lại mật khẩu giáo viên** (lần mở menu Thi tiếp theo, Sheet ghi nhớ PIN giáo viên của app).

Dùng:
- App giáo viên → **Thi** → Tạo bài thi: Tiêu đề, Loại thi (Thi thật: đề lấy từ trang DeThi theo khối; Thi thử: tải file Excel theo mẫu của app), Khối 6–9, Lớp (cả khối hoặc một lớp, ví dụ chỉ 9A).
- Bài mới luôn **khóa**. Học sinh đúng lớp đăng nhập app → tab Thi → vào phòng chờ; giáo viên thấy "Đã vào" (điểm danh). Lớp khác bị chặn.
- Đủ mặt → **Mở thi**: phòng chờ tự vào bài. Bảng tự cập nhật 10 giây: Chưa vào / Đã vào / Đã nộp + điểm. "Cho thi lại" (thi thật) mở lại cho một em.
- Cột Khối trong DeThi ghi 9 hoặc 9A đều hiểu là khối 9; để trống = dùng cho mọi khối.
- Không dùng Firebase/Worker cho bài thi: trạng thái nằm ngay trong Sheet (cột "Vào thi gần nhất" của HocSinh và trang KetQua có cột "Mã bài thi").
