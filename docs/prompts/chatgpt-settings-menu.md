# Prompt cho ChatGPT: menu Cài đặt/Quản lý thích ứng

## BẮT ĐẦU PROMPT
Thiết kế cách tổ chức menu Cài đặt/Quản lý cho PWA học tập THCS Việt Nam theo AGENTS.md và docs/design/adaptive-settings-menu.md. Mục tiêu: đủ không gian học/làm việc trên điện thoại, tablet và desktop; không bày tất cả cấu hình/form quản trị trên màn chính.

Yêu cầu:
1. Trình bày sơ đồ nhóm và lý do đặt từng chức năng ở điều hướng chính, Cài đặt hay menu thao tác đối tượng. Tác vụ chính thường dùng phải dễ tìm; không gom tất cả vào cài đặt.
2. Thiết kế mobile danh sách nhóm → trang nội dung có Quay lại; màn rộng dùng danh sách bên cạnh nội dung khi đủ chỗ. Giữ cùng thuật ngữ, tránh menu nhiều tầng và popup chồng nhau.
3. Tách theo vai trò: học sinh chỉ thấy nhóm được phép; giáo viên có Tài khoản, Lớp và học sinh, Cài đặt AI theo phạm vi tính năng được giao. Không tạo tùy chọn giả; không thêm menu vào đăng nhập/đổi PIN bắt buộc.
4. Cung cấp mockup HTML/CSS tĩnh trong docs/design/settings-menu/; chưa ghép frontend, không backend/API, không thư viện/CDN. Minh họa menu đóng/mở, nhóm được chọn, chi tiết, quay lại và tải/trống/lỗi nếu liên quan. Nếu chưa có thông tin chức năng cụ thể, ghi giả định và giới hạn thay vì bịa màn nghiệp vụ.
5. Xóa/khóa/đặt lại PIN và thao tác quan trọng phải có xác nhận nêu đúng đối tượng/hậu quả theo docs/design/teacher-action-confirmation.md. Hủy/Esc không thực hiện; đồng ý chủ động mới xử lý. Không dùng window.confirm/alert/prompt.
6. Giữ tông #f5f4ef, #fffefa, #18302d, #536762, #183e39, #d8dfd8; font hệ thống, wordmark sgk, bo góc 8px, không emoji/icon trang trí. Nội dung ngắn, tránh giải thích lặp.
7. Nút >=48px, input >=16px, label thật, focus rõ, tương phản AA. Kiểm bố cục 320/360/430, 768/1024, 1280px trở lên, ngang và chữ 200%; không tràn/cắt nội dung. Khi có bản nháp, chuyển mục không tự làm mất dữ liệu.

Bàn giao: sơ đồ nhóm, mockup đủ trạng thái, bảng tự kiểm có bằng chứng thực tế/giới hạn và handoff Antigravity. Không tự ghi PASS khi chưa chạy; Claude kiểm định bản ghép sau. Phạm vi hiện tại là thiết kế menu, không xây lại các chức năng nghiệp vụ.
## KẾT THÚC PROMPT
