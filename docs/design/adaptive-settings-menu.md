# Menu hệ thống thích ứng thiết bị
Yêu cầu người dùng ngày 25/10/2026; áp dụng cho ChatGPT thiết kế, Antigravity triển khai và Claude kiểm tra.

## Mục tiêu
Giữ vùng học tập/làm việc rộng và rõ. Chỉ mở nhóm chức năng hệ thống khi cần, không bày tất cả thẻ, form và nút quản trị trên cùng màn hình.

## Phân nhóm
- Tác vụ chính: học, làm bài, soạn/đăng nội dung, quản lý lớp khi đang làm việc với lớp vẫn có điểm truy cập rõ ở điều hướng chính và vùng nội dung.
- Tài khoản: thông tin, đổi mã PIN, đăng xuất.
- Lớp và học sinh: mở không gian quản lý riêng; tìm/chọn lớp hoặc học sinh trước, rồi xem hành động phù hợp. Không đưa toàn bộ CRUD vào một hộp cài đặt nhỏ.
- Cài đặt AI của giáo viên: hạn mức, khóa/mở AI, quản lý khóa API; chỉ hiện nội dung nhóm được chọn và đúng vai trò.
- Tùy chọn ứng dụng/tải ngoại tuyến/hướng dẫn: phân nhóm khi tính năng đã có hoặc được giao; không tạo tùy chọn giả để lấp menu.
- Thao tác phụ mỗi đối tượng: menu có nhãn chữ rõ, ví dụ "Thao tác"; xóa/khóa cần xác nhận theo teacher-action-confirmation.md. Mở menu không gửi yêu cầu làm thay đổi dữ liệu.

## Bố cục
1. Có điểm vào mang nhãn "Cài đặt" hoặc "Quản lý" theo ngữ cảnh; không chỉ dùng biểu tượng khó hiểu. Tên nhóm thống nhất trên các thiết bị.
2. Mobile: danh sách nhóm một cột; chọn nhóm mở trang nội dung có tiêu đề và "Quay lại"; ưu tiên một vùng cuộn. Không để danh sách cấu hình dài đẩy công việc chính xuống dưới.
3. Tablet/desktop: khi đủ chỗ, dùng danh sách nhóm bên cạnh nội dung; khi thiếu chỗ thì trở về bố cục mobile. Không cố giữ hai cột bằng cách ép chữ/nút quá nhỏ.
4. Chỉ hiển thị một nhóm nội dung tại một thời điểm. Hạn chế hai cấp nhóm → nội dung; không mở popup chồng popup. Khi cần xác nhận, đóng menu thao tác trước khi mở dialog.
5. Quay lại giữ nhóm/lớp đã chọn và vị trí danh sách. Chuyển mục khi có bản nháp chưa lưu cần lựa chọn rõ: ở lại hoặc bỏ thay đổi; không tự mất dữ liệu nhập.
6. Giữ hành động chính gần nội dung đang làm; nút cố định nếu dùng không được che ô nhập/focus khi bàn phím mở hoặc màn ngang. Không thêm menu vào màn đăng nhập hoặc bước bắt buộc đổi PIN.

## Checklist thiết kế và kiểm tra
- Minh họa menu đóng/mở, nhóm đang chọn, trang chi tiết, quay lại; trạng thái tải/trống/lỗi khi có dữ liệu bất đồng bộ. Chỉ thể hiện tính năng thuộc phạm vi được giao.
- Kiểm ở 320/360/430, 768/1024 và 1280px trở lên, màn ngang, chữ tăng 200%, nhãn dài; không tràn ngang/cắt nhãn hoặc che vùng làm việc.
- Nhãn chữ rõ, mục tiêu chạm >=48px, input >=16px, tương phản AA; Tab/focus/Enter/Esc hoạt động phù hợp. Điều hướng dùng link/nút đúng nghĩa; không gắn role=menu nếu không triển khai hành vi bàn phím tương ứng.
- Khi đóng panel trả focus về điểm mở; khi đổi trang đưa focus đến tiêu đề/nội dung mới hợp lý; panel modal phải quản lý focus. Không để nội dung ẩn vẫn nhận Tab.
- Xóa/khóa/đặt lại PIN và thao tác quan trọng giữ xác nhận chủ động; Hủy không gọi API, đồng ý đúng đối tượng và không gửi lặp.
- Người kiểm phải phân biệt mô phỏng viewport với thiết bị thật, ghi rõ phần đã chạy/chưa chạy; đây là yêu cầu thiết kế, chưa phải kết quả PASS.
