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
- Mỗi bài là một thẻ: loại thi, lớp/khối, Đang mở/Chưa mở, số câu, đã thi mấy lần; nút **Vào thi** / **Làm lại** chỉ hiện khi bài đang mở (không còn phòng chờ). Biểu tượng thống kê mở trang Kết quả.
- Bài thi thật "Trắc nghiệm + Thực hành": trong bài có ô **Bài thực hành** để học sinh tải file lên (tối đa 10 MB) — file vào thư mục lớp trên Google Drive của thầy cô.
- Nếu thầy cô bật **Cho xem điểm** cho bài đó: thẻ có nút **Kết quả** → điểm lần gần nhất, điểm cao nhất, số lần thi, **hạng trong lớp**, điểm trung bình lớp, bảng xếp hạng lớp (dòng của em được tô sáng).
- Nếu chưa bật: học sinh chỉ thấy "Đã nộp bài — thầy cô sẽ công bố điểm sau".
- Lưu ý: tab Thi chỉ có bài sau khi làm xong 3 bước cài đặt ở trên (Firebase còn trống thì hiện "Chưa có bài thi").

## Dùng hằng ngày
- Nút biểu tượng con mắt trên thẻ bài (app giáo viên → Thi): **Cho xem điểm / Ẩn điểm**. Thi thử mặc định cho xem; thi thật mặc định ẩn đến khi thầy cô bật.
- Thêm/sửa học sinh trong trang HocSinh hoặc sửa đề trong DeThi → bấm **Cập nhật lên Firebase** (trong app, hoặc menu Sheet).
- Tạo/sửa/mở/khóa/xóa bài trong app: tự cập nhật, không cần bấm thêm.
- Thống kê từng bài: hiện tức thì ai chưa vào / đã vào / đã nộp + điểm.
- Điểm vào trang KetQua khi mở menu Thi hoặc menu Sheet **Bài thi → Lấy điểm về Sheet** (cột "Mã nộp" giúp không chép trùng).
- Cho thi lại (thi thật): trang Thống kê → nút "Cho thi lại" (có hộp thoại xác nhận). Thi thử: cột **Số lần thi** thay cho nút này.
- Thi thật: trang Thống kê có tab **Theo dõi nộp bài** (Chưa vào / Đang làm / Đã nộp, có cả trạng thái nộp bài thực hành).
- **Chỉnh sửa** bài: sửa được cả câu hỏi, phương án, đáp án đúng, điểm; thêm/xóa câu. Thi thật: câu hỏi dùng chung trang DeThi của khối đó.
- Thi thật có **Năm học**, **Hình thức thi** (15 phút, Giữa kỳ I, Cuối kỳ I, Giữa kỳ II, Cuối kỳ II, Khác), **Nội dung** (Trắc nghiệm / Trắc nghiệm + Thực hành).
- Lưu trữ Google Drive: thư mục **Bài thi - Góc học tập / Năm học / Lớp … / Hình thức - Tiêu đề**: mỗi học sinh một file chữ (từng câu, đáp án đúng, em chọn, đúng/sai, điểm) + file thực hành. File chữ được tạo khi điểm chép về Sheet (mở menu Thi hoặc menu Sheet **Lấy điểm về Sheet**).
  Lần đầu sau khi dán Code.gs mới, Google hỏi thêm quyền **Google Drive** → Cho phép.

## Tài liệu PDF (menu Tài liệu trong app giáo viên)
- **Thêm tài liệu**: nhập Tiêu đề, chọn Khối, mô tả (không bắt buộc), chọn file PDF ≤ 10 MB trên máy → Lưu. File vào Google Drive: **Tài liệu - Góc học tập / Khối N** (chia sẻ xem bằng đường dẫn).
- Mỗi tài liệu: **Mở xem**, **Chỉnh sửa** (tiêu đề, khối, mô tả, thay file), **Xóa** (có xác nhận, file vào thùng rác Drive).
- Học sinh: mục **Tài liệu** chỉ hiện tài liệu đúng khối của em (không còn ô chọn môn), nút **Mở xem** / **Tải về**.
- Giáo viên lớp thấy và đăng tài liệu cho khối của các lớp mình phụ trách.

## Gia sư AI và đọc bài
- Khung chat Gia sư AI neo góc phải dưới (điện thoại: tấm trượt từ dưới lên), không che bài; câu trả lời hiện dần như đang gõ.
- Gia sư **tự tạm nghỉ** khi lớp em có bài **thi thật** đang mở (chưa nộp). Ô **"Khóa AI trong khi kiểm tra"** (Hồ sơ → Gia sư AI) khóa AI cho mọi học sinh mọi lúc — chỉ bật khi thật cần.
- Nộp bài **thi thử** (có Cho xem điểm): Gia sư AI tự nhận xét — nhận xét chung, em làm tốt, cần ôn thêm (không nêu đáp án). Cần Worker bản mới.
- Bài học có thanh **tên bài + % đã đọc** dính trên cùng khi cuộn. Giáo viên xem ở **Tổng quan → Học sinh đọc bài** (chọn bài, lớp; ai đã đọc hết / đang đọc / chưa đọc).

## Tài khoản (menu Tài khoản trong app giáo viên)
- Tab **Học sinh**: danh sách trang HocSinh của Google Sheet — thêm, sửa, đặt lại mã PIN, khóa/mở, xóa (có hộp thoại xác nhận). Lưu là học sinh đăng nhập được ngay; tài khoản khóa không đăng nhập được.
- Tab **Giáo viên** (chỉ quản trị thấy): thêm giáo viên dạy lớp — Mã giáo viên, Họ tên, Lớp phụ trách (ví dụ `9A, 9B`), Mã PIN. Lưu ở trang **GiaoVien** của Sheet.
- Giáo viên lớp đăng nhập trang giáo viên: chọn **Giáo viên lớp** → Mã giáo viên + PIN. Họ thấy menu **Thi** (tạo/mở/khóa/sửa thi thử, thi thật, thống kê), **Tài liệu** (khối mình) và **Tài khoản** (học sinh lớp mình). **Về nhà** cho giáo viên lớp sẽ bật sau khi Worker được cập nhật (giai đoạn 2).
- Quản trị đăng nhập như cũ (chọn **Quản trị**, nhập PIN giáo viên).

## Nếu có sự cố
- Học sinh báo "Mã học sinh hoặc mã PIN chưa đúng" dù đúng: thầy cô vừa đổi PIN trong Sheet nhưng chưa bấm **Cập nhật lên Firebase**.
- Học sinh mới chưa có trên Firebase vẫn đăng nhập được (đường cũ qua Worker, chậm hơn) nhưng tab Thi dùng bài thi Google Sheet cũ → bấm Cập nhật lên Firebase.
- App giáo viên báo "Chưa nối Firebase": làm lại bước 3.
