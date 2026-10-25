# Rà soát lần hai: mockup đăng nhập/tài khoản
Ngày: 25/10/2026 · ChatGPT/Codex · Phạm vi: docs/design/login, chưa ghép ứng dụng.

## Kết luận
Bản mẫu đã tinh gọn và đạt các tiêu chí đã đo trên Chrome. Chưa có cơ sở khẳng định đạt trên mọi thiết bị hoặc toàn bộ WCAG. Không thay phán quyết Claude.

## Đã sửa
- Bỏ các tiêu đề phụ trùng ý và hai câu hướng dẫn hiển nhiên ở màn giáo viên.
- Ẩn toàn bộ thư viện trạng thái khỏi màn mặc định; chỉ mở qua #design-states. Thông báo lỗi cần thiết vẫn giữ đủ để ghép logic thật.
- Cảnh báo đổi PIN học sinh ẩn mặc định, chỉ bật khi trạng thái tài khoản yêu cầu.
- Rút gọn nhãn PIN mới, giữ yêu cầu 8 ký tự ngay dưới ô; giảm khoảng cách và cỡ wordmark trên mobile.
- Sửa lỗi tên học sinh viết liền gây tràn 320px (quan sát trước sửa: trang rộng 1826px). Cho phép ngắt dòng ở phần tài khoản.
- Giữ vùng thông báo rỗng trong cây truy cập; thêm chế độ màu tương phản cao và khoảng đệm màn hình ngang/vùng an toàn.
- Các section giáo viên chứa trực tiếp form tương ứng, giữ nguyên toàn bộ ID gốc, name/type/autocomplete.

## Kiểm chứng
Bằng chứng: review-checks.json; bộ đo: review-ui.cjs.
- Chrome: 85 lượt bố cục = 5 màn × 17 khung nhìn, rộng 320–2560px; có ngang 640×360, 844×390 và khung thấp 360×320. Không tràn ngang, không cắt chữ.
- Thêm 20 lượt chữ tăng 200% ở 320/360/768/1280; kèm tên dài giả lập ở màn tài khoản. Không tràn ngang hoặc cắt nhãn/nút.
- 5 luồng Tab đúng thứ tự và focus nhìn thấy; không đi vào khối mẫu ẩn. Vùng chạm >=48px, chữ nhập >=16px, card <=420px.
- ID duy nhất, label/ARIA tham chiếu đúng, thuộc tính input và Hiện/Ẩn hoạt động. Mẫu lỗi xem riêng, màu tương phản cao/reduced-motion đã mô phỏng; không yêu cầu mạng ngoài.
- Tương phản giữ nguyên: chữ chính/nền 12,72:1; chữ phụ/nền 5,47:1; chữ nút/nền nhấn 11,64:1; viền input/bề mặt 3,62:1.
- Đã xem trực tiếp ảnh mobile của cả 5 màn, desktop và ngang; bố cục một cột, nhãn rõ, một hành động chính, không emoji/icon trang trí.

## Giới hạn
Edge lỗi khởi động trong môi trường kiểm tra; không tính PASS. Chưa kiểm Safari/Firefox, điện thoại thật/bàn phím ảo, screen reader hoặc chứng nhận WCAG toàn diện. Khung nhìn thấp chỉ mô phỏng diện tích còn lại, không thay thử bàn phím iOS/Android.
Không có axe-core và các skill audit UI/Sonnet trong phiên; chưa chạy Lighthouse hay có ACCEPT Claude. Trong lúc hoàn thiện bộ đo đã sửa lỗi test tích lũy phóng chữ qua điều hướng fragment; lần chạy cuối tải lại trang trước từng ca.
