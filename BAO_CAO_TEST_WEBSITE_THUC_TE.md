# Kiểm thử website đang chạy — 23/10/2026

**Địa chỉ:** https://mrbin2026dh-droid.github.io/aisgk/
**Kết luận:** NOT READY. Còn lỗi chat Dashboard và chất lượng gia sư cần sửa.

Kiểm thử trực tiếp qua giao diện trình duyệt với phiên học sinh khối 9 do người dùng đăng nhập. Không sửa mã nguồn, không giả lập đăng nhập, không can thiệp localStorage hay gọi API ngoài giao diện. Không nộp/làm lại bài thi hoặc thay đổi dữ liệu quản trị. Đã mở lý thuyết và chấm hai câu luyện tập; thao tác này có thể cập nhật tiến độ của tài khoản.

## Lỗi tái hiện được

### LIVE-01 — P1: Chat Dashboard lỗi, chat trong bài có phản hồi

1. Tại Dashboard, mở Gia sư và hỏi vai trò CPU.
2. Giao diện báo: “Máy chủ AI đang khởi động hoặc đang cập nhật kết nối…”.
3. Vào Bài 1 lý thuyết, hỏi thiết bị gia đình có CPU: có phản hồi.
4. Quay Dashboard và thử lại câu hỏi CPU: lỗi tái diễn.

Console ghi hai lỗi `Lỗi kết nối AI Socrates: Error: Lỗi gọi AI Socrates`, tại `app.js?v=6.0:3509:47`, lúc 16:15:10 và 16:18:42 UTC (23:15 và 23:18 giờ Việt Nam). Chưa có mã HTTP hoặc request_id để kết luận nguyên nhân là 422. Phải đối chiếu network/backend, không quy thành lỗi khởi động máy chủ khi chưa có bằng chứng.

Ảnh: `scratch/live-audit-2026-10-23/dashboard-chat-error.jpg`.

### LIVE-02 — P1: Gia sư không giữ phạm vi bài học

Đang Bài 1 “Thế giới kĩ thuật số”, hỏi: “Trong bài hiện tại, hàm SUMIF dùng thế nào? Hãy kiểm tra xem có đúng nội dung bài 1 không.”

Phản hồi chuyển thẳng sang “Xử lý dữ liệu bảng tính nâng cao (Tin học 9 - Bài 10)”, hướng dẫn COUNTIF/SUMIF/AutoFilter, không xử lý yêu cầu kiểm tra phạm vi bài 1.

### LIVE-03 — P1: Phản hồi thiếu ngữ cảnh và gợi ý sai chủ đề

- Sau khi hỏi thiết bị gia đình có CPU, hỏi tiếp thiết bị vừa hỏi có cần cảm biến không: nhận đoạn chung “Thầy đã nhận được câu hỏi… Xác định tình huống…”, không trả lời nội dung.
- Câu 1 hỏi bộ não thiết bị số; chọn sai “Màn hình hiển thị”, chấm rồi bấm “Nhờ Gia sư Socrates giải thích thêm”: trả đoạn giới thiệu CPU chung, không giải thích lựa chọn sai.
- Xin đáp án A/B/C/D câu 1: từ chối giải hộ, nhưng lại gợi ý phân biệt Dữ liệu/Thông tin, không liên quan câu CPU.

Các phản hồi giống mẫu fallback đã đọc ở mã local. Đây chỉ là dấu hiệu, chưa chứng minh nguồn sinh trên production. Cần log source/request_id.

### LIVE-04 — P2: Tiến độ giữa các khu vực không nhất quán

Ngay sau đăng nhập và sau tải lại, thanh bên hiện “25%, Đã hoàn thành 2/8 bài”, Dashboard hiện “0%, 0/17 bài”. Trong lúc làm quiz, thanh bên đổi sang số câu, sau đó lại trở về 2/8 bài. Cần tách và đặt nhãn rõ tiến độ câu/bài/toàn khóa, không dùng số mẫu.

### LIVE-05 — P2: Không khôi phục luyện tập dở sau F5

Chấm câu 1 sai và câu 2 đúng; giao diện hiện 50%, 2/4 câu. Reload: giữ đăng nhập nhưng về Dashboard, lịch sử chat mất. Mở lại luyện tập: câu 1 chưa chọn, chưa có dấu đúng/sai, hai câu đã chấm không khôi phục. Cần lưu nháp/khôi phục hoặc thông báo rõ giới hạn; chưa kiểm tra lưu bền sau hoàn thành cả bài.

### LIVE-06 — P2: Trợ năng ô chat

`chatInput` không có label liên kết (`labels.length=0`), aria-label hoặc aria-labelledby. Escape đóng chat nhưng tiêu điểm quan sát vẫn ở chatInput. Cần tên truy cập có nghĩa và đưa focus về nút mở chat. Nút gửi cao khoảng 42.4px tại viewport điện thoại, thấp hơn mục tiêu 44px của dự án; không tự kết luận vi phạm toàn bộ WCAG.

## Các hành vi quan sát hoạt động

- Đăng nhập còn hiệu lực sau reload; vai trò học sinh khối 9 được giữ.
- Mở lý thuyết và chuyển từ Bài 1 sang Bài 2 cập nhật nội dung câu hỏi/gợi ý.
- Chưa chọn đáp án: nút kiểm tra bị khóa. Chấm câu sai và câu đúng hiển thị đúng kết quả, khóa phương án sau chấm; chuyển câu được.
- Chat khóa ô nhập/nút gửi khi xử lý và mở lại sau phản hồi/lỗi.
- Danh sách đề và lịch sử bài thi của tài khoản mở được; chưa thử làm lại/nộp bài thi thật.
- Không thấy tràn ngang ở các trạng thái đã đo: documentWidth=clientWidth tại 570px, 390px và 1366px. Chỉ là kiểm tra các trạng thái đã đi qua, không phải chứng nhận responsive toàn bộ.

## Giới hạn và yêu cầu nghiệm thu lại

Chưa xác minh Gemini live bằng log backend; chưa kiểm thử tải, mất mạng chủ động, hai phiên giáo viên/học sinh, toàn bộ 17 bài, bảo mật Firebase, Core Web Vitals hoặc WCAG đầy đủ. Không coi bản kiểm tra này là PASS toàn hệ thống.

Antigravity phải tái hiện LIVE-01..06, sửa theo AGENTS.md, bổ sung test hồi quy có assert và bàn giao log trước/sau. Đối chiếu phiên bản frontend/backend production với mã local. Chưa phát hành bản sửa trước khi kiểm định độc lập lại.
