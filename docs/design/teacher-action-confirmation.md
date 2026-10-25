# Xác nhận thao tác giáo viên
Yêu cầu người dùng ngày 25/10/2026; dùng cho mọi thiết kế ChatGPT, triển khai Antigravity và kiểm định Claude.

## Phạm vi bắt buộc
- Xóa học sinh, bài học, tài liệu, đề thi hoặc khóa API.
- Khóa/mở khóa tài khoản hoặc quyền dùng AI; đặt lại mã PIN; thay đổi quyền truy cập.
- Thao tác hàng loạt hoặc thay đổi quan trọng tương tự ảnh hưởng dữ liệu/quyền truy cập: hiện phạm vi, số lượng và hậu quả trước xác nhận.
- Mở trang, tìm kiếm, xem, lọc không cần hỏi lại. Biểu mẫu sửa thông thường có bước "Lưu" rõ ràng; không thêm hộp thoại lặp vô ích. Hộp thoại nhập dữ liệu đã có nội dung/hậu quả và nút xác nhận rõ ràng có thể đồng thời là bước xác nhận.

## Hợp đồng thiết kế và hành vi
1. Bấm hành động chỉ mở `<dialog>`; không gửi yêu cầu làm thay đổi dữ liệu trước khi giáo viên xác nhận.
2. Tiêu đề cụ thể: "Xóa học sinh?", "Khóa tài khoản?". Nêu tên/mã hoặc nhãn đối tượng, hậu quả; tác vụ hàng loạt phải có số lượng. Không hiển thị PIN, token hoặc nội dung khóa API.
3. Hai lựa chọn: "Hủy" và "Xóa học sinh"/"Khóa tài khoản"/...; không dùng "OK" mơ hồ. Mặc định focus "Hủy"; không tự thực hiện khi hộp thoại vừa mở hoặc vì nhấn Enter mở hộp thoại.
4. Hủy, Esc, nút đóng hoặc bấm ngoài (nếu cho phép đóng) đều không thực hiện thao tác. Xác nhận phải áp dụng đúng đối tượng/phạm vi đã hiển thị; hủy rồi mở lại không dùng xác nhận cũ.
5. Trong khi gửi: khóa nút, nhãn "Đang xóa…"/"Đang khóa…", `aria-busy`; không gửi lặp khi bấm nhanh. Lỗi phải báo rõ, không giả thành công; đóng hộp thoại không đồng nghĩa hủy được yêu cầu đã gửi.
6. Nhãn/ARIA rõ, giữ focus trong modal và trả focus về nút mở khi đóng; nếu đối tượng vừa bị xóa, chuyển đến vị trí hợp lý còn tồn tại. Đáp ứng mobile và bàn phím; không dùng `window.confirm/alert/prompt`.
7. Không thay kiểm quyền máy chủ bằng hộp thoại; không thêm bước xác thực/PIN lại chỉ vì yêu cầu chống thao tác nhầm này.

## Checklist kiểm định của Claude
- Với từng thao tác: trước xác nhận = 0 yêu cầu thay đổi; Hủy/Esc/đóng = 0; đồng ý = đúng 1 yêu cầu, đúng đối tượng/phạm vi.
- Bấm kép, Enter khi mở, hủy rồi đổi đối tượng, lỗi mạng: không thực hiện nhầm, không gửi lặp; trạng thái tải/lỗi/focus đúng.
- Test hành vi DOM, không chỉ tìm chữ `confirmBox`; không suy từ một ca xóa đạt sang mọi ca khóa/đặt lại PIN đều đạt.
- Ghi bằng chứng và phần chưa kiểm; đây là yêu cầu, chưa phải chứng nhận đã triển khai/PASS. Nếu thiếu, Claude giao Antigravity sửa theo AGENTS.md mục F.
