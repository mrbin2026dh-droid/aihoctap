# Giao diện giáo viên: 4 phân hệ — phân tích để thống nhất (Claude, 25/10/2026)
Trạng thái: CHỜ NGƯỜI DÙNG DUYỆT. Chưa viết mã. Làm giao diện trước, nối dữ liệu sau.

## 0. Khung chung
- Điều hướng 4 mục: Soạn bài | Kiểm tra | Tài liệu | Tài khoản. Điện thoại: thanh dưới 4 mục (đủ rộng, không xuống dòng). Máy tính: thanh bên.
- Mỗi phân hệ: màn danh sách (tìm, lọc Lớp/Môn, nút "Thêm") → màn chi tiết có nút Quay lại (AGENTS K). Một biểu mẫu chính mỗi màn hình.
- Cài đặt cá nhân (đổi PIN giáo viên, gia sư AI/hạn mức, khóa API, đăng xuất) vào menu hồ sơ ở góc, KHÔNG nằm trong phân hệ Tài khoản (Tài khoản = tài khoản học sinh).
- Quy tắc cố định: lỗi từng ô, "Đang …" khi chờ, thông báo/xác nhận bằng hộp thoại, xác nhận khi xóa/khóa/ghi đè, cảnh báo thay đổi chưa lưu, không mã nhãn kỹ thuật, tiếng Việt ngắn đúng, mục tiêu chạm 48 px, kiểm thử hành vi mọi nút.

## 1. Soạn bài (Lớp → Môn → Tên bài → Lý thuyết → Luyện tập)
- Danh sách: bài theo Lớp/Môn, trạng thái (Nháp | Đã xuất bản), phiên bản, ngày sửa. Hành động: Thêm, Mở, Nhân bản, Gỡ xuất bản.
- Chi tiết: bước 1 Thông tin (Lớp 6–9, Môn chọn từ danh sách, Tên bài); bước 2 Lý thuyết (soạn Markdown có xem trước); bước 3 Luyện tập (câu trắc nghiệm: đề, 4 đáp án, đáp án đúng, giải thích, thứ tự kéo/nút lên-xuống, nhập hàng loạt từ Excel).
- Quy tắc: Lưu nháp tự động trên máy; Xuất bản tạo phiên bản mới, bài học sinh đang làm giữ nguyên (đã có). Đáp án chỉ ở máy chủ (đã có).
- Máy chủ: ĐÃ CÓ (`/pwa/teacher/publish`, `/lesson/`, catalog). Thiếu: trạng thái Nháp trên máy chủ, gỡ xuất bản, nhân bản.

## 2. Kiểm tra (đề thi, bài 15 phút, giữa kỳ…)
- Danh sách: tiêu đề, Lớp, Môn, thời lượng, trạng thái (Nháp | Đã mở | Đã khóa | Đã đóng), số bài nộp.
- Tạo/sửa: Tiêu đề (tự đặt), Lớp, Môn, Loại (15 phút/1 tiết/giữa kỳ/cuối kỳ), Thời gian làm bài (phút), Giờ mở–đóng, Số lần làm, Trộn câu/đáp án, Khi nào lộ đáp án (sau nộp | sau khi đóng | không). Câu hỏi: nhập từng câu hoặc **tải lên Excel**; có nút **Tải mẫu Excel**.
- Điều khiển: Mở khóa/Khóa đề, Sửa (đề đã có bài nộp: chỉ cho sửa tiêu đề và giờ đóng; sửa câu hỏi phải tạo phiên bản mới), Xóa (xác nhận, đề đã có bài nộp chỉ cho lưu trữ).
- Theo dõi (trực tiếp): bảng học sinh — chưa vào | đang làm | đã nộp, còn bao nhiêu phút. Gia hạn thời gian, cho làm lại từng học sinh.
- Thống kê và xếp hạng: điểm TB, cao nhất, thấp nhất, phân bố điểm, tỉ lệ đúng từng câu (câu khó/dễ), bảng xếp hạng theo lớp. Xuất Excel.
- Máy chủ: CHƯA CÓ (A4/A5). Nhóm bảo mật CAO: đáp án và bài làm chỉ ở máy chủ, nộp một lần, giờ tính theo máy chủ, không ghi nội dung câu trả lời vào nhật ký.

## 3. Tài liệu
- Danh sách: tên, Lớp, loại (PDF/Excel/PowerPoint/liên kết), kích thước, ngày tải, trạng thái hiển thị. Hành động: Tải lên, Sửa (tên, lớp, hiện/ẩn), Thay tệp, Xóa (xác nhận).
- Tải lên: Tên tài liệu, Lớp (có thể nhiều lớp), chọn tệp (giới hạn dung lượng và đuôi tệp; kiểm tra loại thật của tệp).
- Máy chủ: hiện chỉ có liên kết Google Drive (`/pwa/teacher/materials`). **Cần quyết định nơi lưu tệp** (xem mục Quyết định).
- Học sinh: mở/tải trong tab Tài liệu; hỗ trợ ngoại tuyến cho tệp nhỏ.

## 4. Tài khoản (học sinh)
- Danh sách: Họ tên, Lớp, Mã HS, trạng thái (Hoạt động | Khóa), ghi chú, lần đăng nhập cuối. Lọc theo Lớp, tìm theo tên/mã, chọn nhiều.
- Thêm một học sinh: Họ tên, Lớp, Mã HS (kiểm tra trùng), Mã PIN (tự sinh hoặc nhập, hiện một lần rồi ẩn, buộc đổi lần đầu), Ghi chú.
- Sửa (họ tên, lớp, ghi chú), Đặt lại PIN, Khóa/Mở khóa, Xóa (xác nhận; có thao tác hàng loạt).
- **Tải Excel lên**: Tải mẫu → chọn tệp → xem trước toàn bộ dòng, đánh dấu dòng lỗi (thiếu tên, trùng mã, lớp sai) → xác nhận mới tạo; báo cáo kết quả; xuất danh sách PIN một lần để in/phát (không lưu PIN rõ trong máy chủ).
- Máy chủ: CÓ phần lớn (`/teacher/students` thêm/sửa/xóa/khóa/đặt lại PIN). Thiếu: nhập hàng loạt, ghi chú (cần xác nhận trường), xuất.

## 5. Quyết định cần người dùng (trả lời ngắn là đủ)
1. Nơi lưu tài liệu PDF/Excel/PowerPoint: (a) liên kết Google Drive (không cần máy chủ lưu, đã có), (b) Cloudflare R2 lưu trực tiếp (đề xuất; cần bật R2 trên tài khoản Cloudflare), (c) Firebase Storage.
2. Đề kiểm tra: học sinh làm trực tiếp trong app có đếm giờ (đề xuất), hay chỉ giao đề và giáo viên nhập điểm?
3. Đọc Excel ngay trên trình duyệt bằng thư viện đặt cùng trang (đề xuất, không gửi tệp lên máy chủ) — đồng ý?
4. Môn học: danh mục cố định (Tin học 6–9 và các môn khác bạn dùng) hay giáo viên tự thêm?
5. Một giáo viên hay nhiều giáo viên (ảnh hưởng đến phạm vi quản lý lớp và học sinh)?

## 6. Kinh nghiệm rút ra (áp dụng khi làm)
- Dựng khung giao diện bằng dữ liệu giả và chạy kiểm thử hành vi TRƯỚC khi nối máy chủ.
- Mỗi phân hệ một tệp mô-đun riêng, tránh một teacher.js 800 dòng.
- Dữ liệu từ máy chủ luôn qua một lớp chuẩn hóa (hợp đồng) — lỗi `data.attempts` xảy ra vì giao diện và Worker hiểu khác nhau; thêm test hợp đồng cho mỗi API.
- Lỗi một phần không được báo như lỗi đăng nhập (đã sửa).
- Tệp nhị phân (phông, ảnh, mẫu Excel) phải khai báo `binary` trong `.gitattributes` (đã sửa).
- Trang giáo viên cũng cần bản mới ngay khi phát hành (hiện bị trình duyệt giữ bản cũ tới 10 phút).
- Mỗi đợt: Claude chạy bộ kiểm thử, đẩy Git, mở link thật kiểm tra trước khi báo hoàn thành.

## 7. Kế hoạch đề xuất
- Đợt A: khung 4 phân hệ + Soạn bài (dữ liệu hiện có) + Tài khoản (thêm/sửa/xóa/khóa có sẵn) + hộp thoại và kiểm thử.
- Đợt B: Tài khoản nhập Excel hàng loạt; Tài liệu (theo quyết định 1).
- Đợt C: Kiểm tra (Worker + giao diện giáo viên), rồi học sinh làm đề.
