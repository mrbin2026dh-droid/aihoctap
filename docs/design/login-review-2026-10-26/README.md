# Nhận xét giao diện đăng nhập hiện tại
Ngày 26/10/2026 — ChatGPT/Codex. Nhận xét thiết kế và phép đo bố cục, không thay audit xác thực/ACCEPT của Claude.

## Bản đã xem
- Bản phát hành: https://mrbin2026dh-droid.github.io/aihoctap/ và teacher.html, không dùng tài khoản hoặc gửi form đăng nhập.
- Localhost 8769/hoc trong nhật ký trả giao diện cũ khác entry hiện có; ảnh đánh giá lấy từ bản phát hành.
- Đã đọc hồ sơ mockup cũ docs/design/login/review-summary.md, handoff đăng nhập và release-5; entry index.html, teacher.html cùng phần CSS liên quan để nhận diện thiết kế. Lý do: người dùng yêu cầu phân tích bản hiện tại, cần tách mockup khỏi triển khai.
- Ảnh JPG là ảnh trình duyệt thực tế trong phiên, không phải ảnh dựng. Mobile là viewport mô phỏng, không phải điện thoại thật. Đã trả chế độ tối ban đầu và reset viewport.

## Quan sát
| Màn | Ưu điểm | Điểm nên cải thiện |
|---|---|---|
| Học sinh desktop 1440×900 | Thẻ giữa màn hình, nhãn rõ, nút Vào học nổi bật, có focus và nút hiện PIN | Cổng chọn vai trò rồi modal tạo hai bước và hai lớp; logo lặp; vùng xám và khoảng trống lớn |
| Học sinh mobile 390×844, 360×640 | Một cột, không thấy tràn ngang, ô nhập lớn, nút chính dễ thấy ở trạng thái ban đầu 360×640 | Modal cao khoảng 573px; logo, tiêu đề và mô tả chiếm nhiều chỗ; ở 320×568 phải cuộn trong modal |
| Giáo viên desktop 1440×900 | Một trường nên dễ hiểu, bố cục yên tĩnh, tách được vai trò | Thẻ thiên về phía trên so với thẻ học sinh, có thanh cuộn dọc dù nội dung đăng nhập nhìn còn thừa chỗ; khoảng PIN tới nút khá rộng |
| Giáo viên mobile 360×640 | Form vừa màn hình, nhãn đầy đủ, quay lại học sinh dễ tìm | Logo và padding lớn cho form một trường; màu nút đen khác nút xanh học sinh; đường quay lại ngang hàng về độ rộng với nút chính nên cần giữ sắc độ phụ |

## Phép đo trực tiếp
- Học sinh desktop: input cao 52px, chữ 16px; nút Vào học cao 56px; Đóng và Hiện PIN 44×44px.
- Học sinh 360×640: modal y=33,4 đến 606,6px, cao 573,2px. Nút chính cao 56px. Trang rộng bằng clientWidth, không ghi nhận tràn ngang.
- Học sinh 320×568: modal clientHeight=510px, scrollHeight=572px; cần cuộn nội bộ.
- Học sinh 360×360: modal cao khả dụng 322px, nội dung cuộn 572px; xuất hiện cả cuộn trong và ngoài. Nút chính ban đầu nằm dưới vùng nhìn. Chuyển focus bằng bàn phím đã cuộn để thấy PIN/nút: không phải kết luận bị chặn hoàn toàn.
- Giáo viên 360×640: input cao 52px, chữ 16px; nút chính 56px; hiện PIN đo 44×48px; liên kết quay lại cao 44px.
- Giáo viên 320×568 và 390×844: không ghi nhận tràn ngang. 360×360: nút chính ở y=432–488px, cần cuộn xuống.
- Các mục 44px chưa đạt yêu cầu nội bộ >=48px theo AGENTS.md mục I. Đây là đối chiếu quy tắc dự án, không tự kết luận vi phạm toàn bộ WCAG.
- Số đo có thể lệch nhẹ so với ảnh do screenshot được trình duyệt co theo scale và thanh cuộn chiếm 15px; lưu số đo CSS theo viewport, không suy px từ ảnh.

## Ưu tiên thiết kế
1. Trên điện thoại, chuyển đăng nhập học sinh thành trang/màn một lớp: tiêu đề → mã học sinh → PIN → Vào học; “Giáo viên” là liên kết phụ khi chưa có phiên. Giữ đúng cách ly vai trò hiện hành; không sửa quyền/phiên chỉ để sửa bố cục.
2. Nếu giữ modal, khi mở phải khóa cuộn nền và chỉ có một vùng cuộn; ở chiều cao thấp giảm padding/logo/margin. Nút và ô PIN phải cuộn vào vùng nhìn khi focus. Kiểm bàn phím iOS/Android thật trước kết luận.
3. Thống nhất logo, màu nhấn, cỡ tiêu đề, khoảng cách và vị trí thẻ giữa hai vai trò. Không cần kéo form rộng toàn màn desktop; thẻ 400–440px là hợp lý. Có thể căn giữa trong vùng dưới header, cho phép cuộn khi thấp.
4. Nâng các điều khiển phụ lên vùng chạm >=48×48px; giữ input 16px và nút chính 56px. Icon người/khóa/mũ/mũi tên có thể giảm nếu không bổ sung ý nghĩa; giữ chức năng hiện PIN.
5. Rút câu hướng dẫn thành “Mã học sinh và mã PIN do giáo viên cấp.”; bổ sung lối trợ giúp phụ “Quên mã PIN? Liên hệ giáo viên.” khi phù hợp, không tự thêm luồng khôi phục chưa có.
6. Cổng desktop có minh họa sách nhiều màu sát nút Giáo viên; nên bỏ hoặc đưa ra khỏi vùng thao tác. Header trước đăng nhập có Gia sư AI/Cài ứng dụng/trạng thái mạng/theme: ưu tiên cài đặt và trợ giúp cần thiết, tránh chức năng AI xuất hiện sớm gây nhiễu.

## Bằng chứng ảnh
- gate-desktop.jpg, gate-desktop-dark.jpg, gate-mobile-360x640.jpg
- student-desktop.jpg, student-mobile.jpg (390×844), student-mobile-360x640.jpg, student-mobile-short.jpg
- teacher-desktop.jpg, teacher-mobile-360x640.jpg, teacher-mobile-short.jpg
- measurements.json chứa số đo giáo viên và quan sát focus khung thấp.

## Chưa kiểm
Không kiểm đăng nhập thành công/thất bại, khóa tài khoản, tải/chờ API, screen reader, zoom 200%, tương phản định lượng, Safari/Firefox hoặc bàn phím ảo. Chưa thử câu kiểm dấu đầy đủ theo mục N: ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự. Không chạy lại bộ test xác thực/phông, không ghi PASS toàn hệ thống.
Chỉ ghi tài liệu và ảnh; không sửa app, không commit/push. Các gợi ý là đề xuất chờ chốt, không phải lệnh triển khai tự động.
