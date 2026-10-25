# Rà soát độ phức tạp và đề xuất đơn giản hóa (2026-10-25)

## Hệ thống đang chạy thật gồm 3 phần
1. Trang web học sinh và giáo viên (`frontend/hoc`, GitHub Pages).
2. Worker (`worker/index.js`, Cloudflare, khoảng 4.200 dòng): người trung gian giữa trang web, Firebase và Gemini.
3. Firebase Realtime Database: nơi lưu dữ liệu.

## Vì sao cần Worker (không thể chỉ dùng Firebase)
- Trang web chạy trên máy học sinh nên mọi thứ trong đó học sinh đều xem được. Khóa Gemini, đáp án đúng và mã PIN phải nằm ở nơi học sinh không xem được: đó là Worker.
- Chấm bài, giới hạn số lượt hỏi gia sư, và kiểm tra mã PIN đều cần nơi đáng tin để chạy.
- Chỉ dùng Firebase thì phải mở quyền đọc cho học sinh, tức là lộ đáp án và đề thi (mức bảo mật HIGH theo AGENTS.md H).

## Điều đã đơn giản hóa hôm nay
- Phiên học sinh kéo dài 12 giờ (một buổi học), giáo viên giữ 1 giờ. Học sinh không còn bị hỏi đăng nhập lại giữa buổi. Chỉ thay đổi một tham số, không thêm thành phần mới. Cần triển khai lại Worker.

## Phần thừa trong kho mã (ứng viên dọn, cần xác nhận trước khi xóa)
- `backend/` (Python, 424 KB), `your_application/`, `render.yaml`, `Procfile`, các tệp `test_*.py` ở thư mục gốc, 20 tệp báo cáo và `.bat` ở thư mục gốc. Quy trình triển khai chỉ đưa `frontend/hoc` lên Pages và Worker lên Cloudflare, không dùng các mục này.
- Khuyến nghị: Claude lập danh sách chính xác, Antigravity chuyển vào thư mục `_luu_tru/` rồi xóa sau một tuần nếu không ai cần.

## Nguyên tắc để không phức tạp thêm
- Không thêm dịch vụ mới khi chưa có yêu cầu. Mỗi thay đổi nhỏ, có kiểm thử, có mô tả trong aisgk.md.
