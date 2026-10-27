# Bài thi từ một file Google Sheet (bản đơn giản — dùng từ 27/10/2026)

> **Mới (27/10 tối): thi nhanh qua Firebase** — học sinh đăng nhập, lấy đề, nộp bài trực tiếp trên Firebase. Cài theo `docs/huong-dan-thi-firebase-nhanh.md` (dán Code.gs mới, dán luật Firebase, menu **Bài thi → Cài khóa Firebase**).

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

## Menu "Thi" của giáo viên — nhiều bài thi cùng lúc (bản 27/10, nhiều bài)
Cập nhật một lần:
1. Dán lại toàn bộ `Code.gs` → Lưu → Triển khai → Quản lý bản triển khai → Sửa → **Phiên bản mới** (giữ địa chỉ /exec).
2. Mở Sheet → menu **Bài thi → Tạo mẫu**: tạo thêm trang **BaiThi**, **DiemDanh**, cột "Mã bài thi" của DeThiThu và **tự chuyển bài thi đang có** (trang CauHinh) sang BaiThi. Không xóa dữ liệu. (Cột G "Vào thi gần nhất" của HocSinh không còn dùng, xóa được.)
3. Nếu giáo viên báo "PIN chưa khớp": menu **Bài thi → Đặt lại mật khẩu giáo viên** rồi mở lại menu Thi trong app.

Dùng (app giáo viên → **Thi**, 2 tab):
- **Tạo đề thi**: Tiêu đề, Loại (Thi thật: đề lấy trang DeThi theo khối; Thi thử: tải Excel theo mẫu), Khối 6–9, Lớp (cả khối hoặc một lớp). Tạo được nhiều bài cho nhiều lớp cùng lúc. Bài mới luôn **khóa**.
- **Danh sách bài thi**: mỗi bài một thẻ (loại, đối tượng, mở/khóa, số câu, đã vào/đã nộp) với 4 nút biểu tượng: **Thống kê**, **Chỉnh sửa** (tiêu đề/khối/lớp; thi thử có thể tải Excel mới thay đề; đề thi thật sửa ở trang DeThi), **Mở/Khóa thi**, **Xóa** (ẩn bài, điểm vẫn nằm trong KetQua; có hộp thoại xác nhận).
- **Thống kê** một bài: học sinh thuộc bài, Chưa vào / Đã vào / Đã nộp + điểm, trạng thái trực tuyến (Firebase), Mở/Khóa, **Cho thi lại** (thi thật).
- Học sinh đăng nhập app → tab Thi → **chọn bài** trong danh sách các bài dành cho lớp mình. Thi thật đang khóa vẫn hiện: bấm vào là vào phòng chờ (giáo viên thấy "Đã vào"); thi thử đang khóa thì ẩn. Lớp khác không thấy bài.
- Cột Khối trong DeThi ghi 9 hoặc 9A đều hiểu là khối 9; để trống = mọi khối.
- Trang dữ liệu: BaiThi (danh sách bài), DiemDanh (ai đã vào phòng thi của bài nào), KetQua (có cột Mã bài thi), DeThiThu (cột J Mã bài thi).
