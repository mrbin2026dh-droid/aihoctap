# Thi nhanh qua Firebase — hướng dẫn cài (27/10/2026)

## Cách hoạt động
- **Google Sheet** là nơi thầy cô soạn: HocSinh (tài khoản), DeThi (ngân hàng đề thi thật), bài thi tạo trong app, KetQua (sổ điểm).
- **Firebase** (dự án `ai-sgk-tinhoc`) là nơi học sinh đọc/ghi: đăng nhập, danh sách bài, đề, nộp bài. Nhanh (~0,2 giây), cập nhật tức thì.
- Học sinh **không chờ Worker hay Google Sheet**. Worker chỉ chạy ngầm sau khi vào app, dùng cho Gia sư AI.
- Thầy cô tạo/sửa/mở/khóa/xóa bài trong app → Sheet tự đẩy lên Firebase. Mở menu Thi → điểm trên Firebase tự chép về trang KetQua.
- Đổi lại: đề, đáp án và tài khoản (PIN đã băm một chiều) nằm trên Firebase ở dạng ai rành kỹ thuật có thể xem — chấp nhận được với học sinh THCS.

## Cài một lần (khoảng 10 phút)
1. **Code.gs mới**: Google Sheet → Tiện ích mở rộng → Apps Script → dán đè toàn bộ `apps-script/sheet-exam/Code.gs` → Lưu → Triển khai → Quản lý bản triển khai → Sửa ✏️ → **Phiên bản mới** → Triển khai. Tải lại trang Sheet.
   Lần đầu Google hỏi quyền "kết nối dịch vụ bên ngoài" → Cho phép (để Sheet gửi dữ liệu lên Firebase).
2. **Luật Firebase**: Firebase Console → dự án `ai-sgk-tinhoc` → Realtime Database → **Rules** → dán toàn bộ nội dung `spike/step0/database.rules.ai-sgk-final.json` → **Publish**.
   (Luật này cũng đóng lại chế độ thử nghiệm đang mở cho mọi người đến 18/11.)
3. **Khóa Firebase cho Sheet**: Firebase Console → ⚙️ Cài đặt dự án → **Service accounts** → **Database secrets** → Hiện → chép.
   Mở Google Sheet → menu **Bài thi → Cài khóa Firebase** → dán → OK. Sheet báo "Đã kết nối Firebase và đẩy … bài thi + danh sách học sinh lên".
   Khóa chỉ nằm trong Sheet của bạn (Script Properties) — không dán vào chat, không đưa lên GitHub.
4. Mở app giáo viên (Ctrl+F5) → **Thi** → bấm **Cập nhật lên Firebase** một lần.

## Học sinh thấy gì
- Đăng nhập app một lần → mục **Thi** hiện ngay các bài thầy cô đã tạo cho lớp/khối của em (không đăng nhập lại).
- Mỗi bài là một thẻ: loại thi, lớp/khối, Đang mở/Chưa mở, số câu, đã thi mấy lần; nút **Vào thi**, **Vào phòng chờ**, **Làm lại** (thi thử).
- Nếu thầy cô bật **Cho xem điểm** cho bài đó: thẻ có nút **Kết quả** → điểm lần gần nhất, điểm cao nhất, số lần thi, **hạng trong lớp**, điểm trung bình lớp, bảng xếp hạng lớp (dòng của em được tô sáng).
- Nếu chưa bật: học sinh chỉ thấy "Đã nộp bài — thầy cô sẽ công bố điểm sau".
- Lưu ý: tab Thi chỉ có bài sau khi làm xong 3 bước cài đặt ở trên (Firebase còn trống thì hiện "Chưa có bài thi").

## Dùng hằng ngày
- Nút biểu tượng con mắt trên thẻ bài (app giáo viên → Thi): **Cho xem điểm / Ẩn điểm**. Thi thử mặc định cho xem; thi thật mặc định ẩn đến khi thầy cô bật.
- Thêm/sửa học sinh trong trang HocSinh hoặc sửa đề trong DeThi → bấm **Cập nhật lên Firebase** (trong app, hoặc menu Sheet).
- Tạo/sửa/mở/khóa/xóa bài trong app: tự cập nhật, không cần bấm thêm.
- Thống kê từng bài: hiện tức thì ai chưa vào / đã vào / đã nộp + điểm.
- Điểm vào trang KetQua khi mở menu Thi hoặc menu Sheet **Bài thi → Lấy điểm về Sheet** (cột "Mã nộp" giúp không chép trùng).
- Cho thi lại (thi thật): trang Thống kê → nút "Cho thi lại".

## Nếu có sự cố
- Học sinh báo "Mã học sinh hoặc mã PIN chưa đúng" dù đúng: thầy cô vừa đổi PIN trong Sheet nhưng chưa bấm **Cập nhật lên Firebase**.
- Học sinh mới chưa có trên Firebase vẫn đăng nhập được (đường cũ qua Worker, chậm hơn) nhưng tab Thi dùng bài thi Google Sheet cũ → bấm Cập nhật lên Firebase.
- App giáo viên báo "Chưa nối Firebase": làm lại bước 3.
