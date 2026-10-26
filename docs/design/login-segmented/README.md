# Đề xuất đăng nhập có thanh chọn vai trò
26/10/2026 — ChatGPT/Codex. Ý tưởng để người dùng duyệt, chưa triển khai; không thay phán quyết của Claude.

## Kết luận nghiên cứu
Có thể áp dụng segmented control về hình thức và tabs về hành vi: hai nhãn luôn hiện, một form được hiển thị theo lựa chọn. Một nền chọn trượt ngang biểu thị vai trò đang chọn. Không dùng công tắc on/off hoặc bắt buộc kéo/vuốt.
- Apple mô tả segmented control gồm các phân đoạn hoạt động như nút: https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- W3C Tabs: một panel hiện tại một thời điểm, trạng thái chọn và điều khiển bàn phím: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- W3C Switch dành cho on/off: https://www.w3.org/WAI/ARIA/apg/patterns/switch/
Đây là lựa chọn thiết kế của ChatGPT theo ngữ cảnh ứng dụng; nguồn không yêu cầu mọi form đăng nhập phải dùng thanh chọn vai trò.

## Thiết kế đề xuất
- Một màn đăng nhập, logo một lần, tiêu đề Đăng nhập, thanh Học sinh | Giáo viên; không cổng chọn vai trò riêng, không liên kết Góc học sinh cuối form, không modal chồng.
- Mặc định Học sinh khi mở cổng chung; đường vào giáo viên có thể mở sẵn tab Giáo viên. Luôn viết đủ nhãn, không chỉ GV/HS.
- Học sinh: Mã học sinh, Mã PIN, Vào học. Giáo viên: Mã PIN giáo viên, Đăng nhập, theo luồng hiện tại; không tự thêm username hoặc khôi phục tài khoản.
- Cùng màu xanh trầm, kiểu chữ, chiều rộng, nhịp khoảng cách; form giáo viên ngắn hơn tự nhiên, không chừa ô giả cho cân hàng.
- Mobile một cột, padding 20–24px, input chữ 16px; vùng chạm >=48px, nút chính 52–56px. Desktop thẻ rộng khoảng 400–440px. Không coi số đo ảnh sinh là số đo CSS đã nghiệm thu.
- Nhấn tab chuyển panel và nền chọn trượt trong khoảng 160–200ms (đề xuất); reduced-motion bỏ chuyển động. Không kéo cả form qua màn hình; không bắt vuốt.
- Tabs theo APG: tablist/tab/tabpanel, aria-selected, liên kết nhãn đúng, phím mũi tên trái/phải; Tab đi vào nội dung. Chọn tự động chỉ khi panel hiện ngay; focus vẫn ở tab sau chuyển, không tự bật bàn phím điện thoại.
- Chỉ hiển thị và validate form đang chọn. Xóa PIN và thông báo lỗi khi đổi vai trò để tránh gửi nhầm; không gửi API đăng nhập chỉ vì đổi tab. Claude kiểm lựa chọn xử lý trạng thái trước triển khai.
- Thanh này chỉ có ở màn chưa đăng nhập. Chọn Giáo viên không cấp quyền, không chuyển phiên đã xác thực. Giữ quy tắc một thiết bị một vai trò; không hiện đường chuyển sang giáo viên trong giao diện học sinh đã đăng nhập.

## Ảnh và giới hạn
role-selector-v1.png: ảnh ý tưởng sinh bằng công cụ imagegen tích hợp, gồm hai trạng thái mobile cạnh nhau; không phải screenshot ứng dụng. Đã xem ảnh: nhãn vai trò, trường nhập và màu nhấn đúng hướng; ảnh tĩnh không chứng minh chuyển động/trợ năng. Chưa đo tương phản, test DOM, phông hay bàn phím thật.
Câu kiểm dấu khi triển khai: ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự.
Prompt: tạo bảng so sánh hai màn đăng nhập SGK mobile, thanh hai phân đoạn Học sinh/Giáo viên với nền xanh trượt, form học sinh hai ô và giáo viên một ô, cùng hệ thiết kế, không logo lặp/icon trang trí/liên kết chuyển vai trò phía dưới. Ảnh dùng để duyệt ý tưởng, chưa dùng làm tài sản giao diện.
Đề xuất này là phương án mới so với liên kết chuyển vai trò ở docs/handoff/chatgpt-claude-login-role-link.md; giữ nguyên tài liệu trước làm lịch sử.
