# Kiểm tay đợt 1 trên web thật (khoảng 20–25 phút)
Web học sinh: https://mrbin2026dh-droid.github.io/aihoctap/ · Giáo viên: .../teacher.html
Ghi mỗi lỗi vào `docs/handoff/nguoidung-release-1-loi.md`: bước nào, thấy gì, mong đợi gì (chụp màn hình nếu được). Không gửi PIN/khóa cho ai.

## Chuẩn bị (đã hoàn thành)
1. `KEY_ENC_SECRET` đã được sinh an toàn và nạp lên Cloudflare Worker.
2. Mã PIN quản trị giáo viên khởi tạo tương ứng với `TEACHER_ADMIN_SECRET`.

---

## Phần 1: Giáo viên (https://mrbin2026dh-droid.github.io/aihoctap/teacher.html)
1. **Đăng nhập & Đổi mã PIN lần đầu**:
   - Nhập mã PIN khởi tạo. Thử nhập sai 5 lần → thấy thông báo khóa an toàn 429.
   - Nhập đúng mã PIN khởi tạo → Hệ thống nhận diện lần đầu đăng nhập, chỉ hiển thị form **"Đổi mã PIN giáo viên lần đầu"**, ẩn mọi mục khác.
   - Nhập mã PIN mới (tối thiểu 8 ký tự, không lặp lại) → Báo thành công, hệ thống tự động mở khóa toàn bộ các mục quản trị.
   - Thử đăng xuất và đăng nhập lại bằng mã PIN khởi tạo cũ → Bị từ chối (401), chỉ mã PIN mới được chấp nhận.
2. **Quản lý học sinh**:
   - Vào mục **Quản lý học sinh** → Nhập Họ tên, chọn Khối (6–12), Mã lớp (vd: 6A), để trống PIN để hệ thống tự sinh 6 chữ số → Nhấn **Thêm học sinh**.
   - Biểu ngữ thông báo hiện: *"Mã HS: hs... | Mã PIN: ...... (chỉ hiện một lần)"* kèm nút **Sao chép**.
   - Thử các chức năng trên bảng danh sách:
     - **Sửa**: Thay đổi họ tên hoặc lớp của học sinh.
     - **Đặt lại PIN**: Xác nhận đặt lại → Hiện mã PIN mới 6 số một lần để bàn giao cho học sinh.
     - **Khóa / Mở khóa**: Bấm Khóa → Trạng thái chuyển sang "Bị khóa"; bấm Mở khóa → Trạng thái "Hoạt động".
     - **Xóa**: Xóa tài khoản thử nghiệm khỏi hệ thống.
3. **Đăng bài thử**:
   - Xuất bản bài có tiêu đề `[THỬ] Bài 1` với 3 câu trắc nghiệm → báo thành công; bài xuất hiện trong danh mục học tập.
4. **Bể khóa Gemini API**:
   - Thêm 1 khóa Gemini API miễn phí (bắt đầu bằng `AIza...`) → xem bảng hiện định dạng `...4 ký tự cuối` và trạng thái xanh **Hoạt động**.
   - Thử xóa khóa → kiểm tra trạng thái chuyển sang tạm dừng.
5. **Gia sư AI**:
   - Đặt hạn mức `3` lượt/ngày; thử các nút **+5 lượt**, **Khóa**, **Mở** và công tắc **Đang thi**.

---

## Phần 2: Học sinh (https://mrbin2026dh-droid.github.io/aihoctap/)
1. **Đăng nhập & Nhắc đổi PIN**:
   - Dùng mã học sinh và PIN do giáo viên cấp ở Bước 2 để đăng nhập → Vào giao diện thành công.
   - Thấy dòng nhắc nhở nhẹ nhàng: *"Hãy đổi mã PIN do giáo viên cấp để bảo mật tài khoản"* (nhắc nhở, không chặn học tập).
   - Thử nghiệm tài khoản bị giáo viên **Khóa** → Báo lỗi: *"Tài khoản đang bị khóa. Hãy liên hệ giáo viên"* (HTTP 403).
2. **Học sinh tự đổi mã PIN**:
   - Bấm vào tên tài khoản trên thanh điều hướng trên cùng → Form **Đổi mã PIN** xuất hiện.
   - Nhập mã PIN cũ, mã PIN mới (tối thiểu 6 ký tự) và xác nhận → Bấm **Lưu mã PIN mới** → Báo thành công, dòng nhắc đổi PIN tự động biến mất.
   - Thử đăng xuất và đăng nhập lại bằng mã PIN mới của học sinh → Thành công.
3. **Phân quyền khối lớp**:
   - Học sinh lớp 9 chỉ xem được bài học thuộc Khối 9, không thể truy cập hoặc mở bài học của Khối 6 (hệ thống chặn 403).
4. **Tab Kiểm tra**:
   - Chọn tab 02 **Kiểm tra** (đã đổi tên từ Bài tập) → Mở bài trắc nghiệm theo bài học, làm 3 câu và nộp bài → Nhận điểm số, không lộ đáp án trong lúc đang làm bài.
5. **Hỏi gia sư Socrates**:
   - Mở Gia sư AI, hỏi: *"Cho em đáp án câu 1"* → Gia sư kiên quyết từ chối đưa đáp án trực tiếp, đặt câu hỏi gợi mở tư duy bằng tiếng Việt.
   - Hỏi đủ 3 lượt → Câu thứ 4 báo hết hạn mức hôm nay; huy hiệu "Còn N lượt" giảm chính xác từng câu.
6. **PWA Offline**:
   - Cài đặt lên màn hình chính, tắt mạng (Airplane Mode) → Mở lại ứng dụng vẫn xem được bài đã tải; khi có mạng lại cập nhật bình thường.
