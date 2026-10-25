# Chuẩn bố cục giao diện giáo viên (bắt buộc cho mọi màn hình quản trị)

Nguồn tham chiếu: Carbon Design System (Data table), PatternFly (Toolbar), WCAG 2.2 (kích thước vùng chạm), quy tắc AGENTS.md mục I.

1. Mỗi màn hình có đúng một h1 (tên phân hệ ở đầu trang). Tiêu đề phụ lặp lại tên phân hệ chỉ để dạng ẩn (visually-hidden), không hiển thị hai tiêu đề chồng nhau.
2. Một thanh công cụ (toolbar) duy nhất nằm ngay dưới h1: ô tìm kiếm và bộ lọc ở bên trái, hành động chính (Thêm …) là nút nổi bật duy nhất, nằm bên phải cùng hàng. Không đặt nút hành động chính ở hàng riêng.
3. Tối đa hai nút chữ trong toolbar (một chính, một phụ). Hành động phụ dùng chung như "Tải lại" là nút biểu tượng có tên truy cập, không chiếm một hàng.
4. Chọn nhiều dòng thì hiện thanh thao tác hàng loạt ngay trên bảng; thao tác hủy hoặc đóng ở phía cuối.
5. Thao tác theo từng dòng: dưới 6 thao tác thì hiện thẳng dưới dạng nút biểu tượng 48×48 px có aria-label và title; thao tác phá hủy màu đỏ, luôn xác nhận bằng hộp thoại.
6. Màn hình hẹp (≤1050px): bảng chuyển thành thẻ; toolbar xuống hàng, nút chính chiếm trọn chiều ngang.
7. Thông báo và xác nhận dùng hộp thoại, không dùng thanh trượt hay toast.

Lý do chọn: Carbon khuyến nghị tìm kiếm bên trái, hành động toàn bảng trong toolbar, thao tác dòng nằm ở dòng (hiện thẳng khi ít). PatternFly khuyến nghị toolbar tối đa hai nút, một chính và một phụ.
