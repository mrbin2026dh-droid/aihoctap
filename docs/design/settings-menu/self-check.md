# Tự kiểm menu Cài đặt/Quản lý
25/10/2026 · ChatGPT/Codex · Chỉ mockup, chưa ghép ứng dụng.

## Đã kiểm thực tế
- Chrome headless qua Playwright: 90 bố cục = 10 màn/trạng thái điều hướng × 9 khung nhìn, rộng 320–1920px; gồm 640×360 và khung thấp 360×320. Không tràn ngang/cắt chữ, mỗi lần chỉ một nhóm nội dung.
- 30 ca chữ tăng 200% ở 320/768/1280, kèm nhãn dài không có khoảng trắng; 6 bố cục dialog gồm ngang, khung thấp và chữ 200%. Không tràn ngang; nội dung dài cuộn được trong modal.
- 14 nhóm hành vi: mobile nhóm/chi tiết/quay lại, giữ lớp và focus; nháp ở lại/bỏ; validate; lưu hạn mức; xóa/khóa/mở/đặt lại PIN; xóa khóa API; khóa/mở AI lớp; xóa bản tải; lỗi mô phỏng; bàn phím; DOM/ARIA và đổi chiều rộng.
- Trước xác nhận/Hủy/Esc/Enter tại Hủy: 0 commit mô phỏng. Đồng ý/bấm lặp: đúng 1 commit/đối tượng; lỗi mô phỏng không xóa dữ liệu. Busy chặn Escape; focus trả đúng nơi còn tồn tại sau xóa.
- Đã sửa và chạy lại lỗi Tab thoát vòng modal bằng xử lý Tab/Shift+Tab. Đã giảm tiêu đề lặp ở trang chi tiết mobile, chạy lại toàn bộ bộ đo cuối.
- Bổ sung 3 kiểm tra: nháp khi đổi nhóm bằng sidebar desktop, lỗi/thử lại danh sách khóa, DOM học sinh không có cấu hình giáo viên.
- 6 mẫu trạng thái tải/trống/lỗi cho 2 vai trò. Mục tiêu chạm >=48px, input/select >=16px. Kiểm DOM label/ARIA, focus, màu tương phản cao và reduced-motion mô phỏng; không có lỗi JS.
- Bộ đo dùng file:// ghi 0 HTTP request; JS mẫu không gọi API hoặc lưu storage. Commit chỉ là biến đếm DOM, không phải test máy chủ.

| Cặp màu | Tỷ lệ |
|---|---:|
| Chữ chính/nền | 12,72:1 |
| Chữ phụ/bề mặt | 5,97:1 |
| Chữ phụ/mục chọn | 5,11:1 |
| Chữ nút/nhấn | 11,64:1 |
| Chữ nút/xóa | 8,32:1 |
| Focus/bề mặt | 6,32:1 |
| Viền input/bề mặt | 3,62:1 |

Bằng chứng: checks.json, additional-checks.json, contrast.json và 13 PNG. Đã xem ảnh mobile cả vai trò/menu/chi tiết, sidebar desktop và dialog. Bộ đo: check.cjs, check-additional.cjs; cần Playwright cục bộ và Chrome. Không ghép các tệp này vào app.

## Chưa kiểm
Điện thoại thật/bàn phím ảo, Safari/Firefox/Edge, screen reader, Lighthouse/WCAG toàn diện, quyền/API/backend và lưu dữ liệu thật. Skill pipeline UI/Stitch/Sonnet không có trong catalog phiên này, chưa chạy; chưa có ACCEPT Claude. Preview là giả lập bố cục, không cam kết mọi thiết bị.

Ghi chú xem mẫu: đã dừng máy chủ preview thử sau khi môi trường chặn kiểm tra socket localhost. Mở trực tiếp teacher.html/student.html hoặc xem các PNG; các phép đo trên Chrome đều dùng file:// và đã hoàn tất, không phụ thuộc máy chủ preview.
