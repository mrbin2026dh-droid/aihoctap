# Cài cầu nối tài liệu (làm 1 lần, khoảng 5 phút)
Giáo viên sẽ tải PDF trực tiếp trong ứng dụng; bạn chỉ cài cầu nối này một lần. Không gửi mã bí mật hay địa chỉ script cho ai (kể cả AI); chỉ nhập vào lệnh ở bước 5–6.

1. Vào https://script.google.com → **Dự án mới** → đặt tên `SGK-Cau-Noi`.
2. Xóa mã mặc định, dán toàn bộ nội dung tệp `docs/appscript/materials-bridge.gs`, bấm **Lưu**.
3. Chọn hàm `setup` ở thanh trên → **Chạy**. Khi Google hỏi quyền: **Xem lại quyền** → chọn tài khoản → **Nâng cao** → **Đi tới ... (không an toàn)** → **Cho phép** (đây là script của chính bạn). Script tự tạo thư mục `SGK-TaiLieu` trong Drive của bạn.
4. Mở **Nhật ký thực thi** (dưới màn hình): có dòng `BRIDGE_SECRET ...` — đó là mã bí mật. Để cửa sổ này mở.
5. Trong thư mục dự án trên máy: `npx wrangler secret put APPS_SCRIPT_SECRET`, dán mã bí mật khi được hỏi.
6. Quay lại Apps Script: **Triển khai** → **Tùy chọn triển khai mới** → loại **Ứng dụng web** → *Thực thi với tư cách*: **Tôi** → *Người có quyền truy cập*: **Bất kỳ ai** → **Triển khai**. Chép **URL ứng dụng web**, chạy `npx wrangler secret put APPS_SCRIPT_URL` và dán.
7. Kiểm tra: mở URL trên trình duyệt, kết quả đúng là `{"ok":false,"error":"FORBIDDEN"}`. Nếu thấy `NOT_CONFIGURED` thì chạy lại bước 3.

Dùng hằng ngày: giáo viên vào ứng dụng → Tài liệu → chọn PDF từ máy (≤ 10MB), đặt tên, Tải lên; có nút Đổi tên và Xóa. Xóa chỉ đưa vào Thùng rác Drive (khôi phục được 30 ngày).
Khi sửa mã Apps Script: **Triển khai → Quản lý triển khai → Sửa → Phiên bản mới** thì mới có hiệu lực.
