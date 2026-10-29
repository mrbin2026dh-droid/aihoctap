# Báo cáo nghiệm thu: Sửa 4 lỗi học bài, Deploy Worker & Đo đạc HTTPS thực tế

- **Người thực hiện**: Antigravity
- **Thời gian**: 29/10/2026 20:05 (Asia/Bangkok)
- **Tình trạng**: HOÀN TẤT 100% — ĐÃ ĐO THẬT TRÊN PRODUCTION HTTPS

---

## 1. Kết quả kiểm thử tự động nội bộ
Đã chạy toàn bộ bộ kiểm thử độc lập, 100% PASS:
- `tests/test_markdown_render.cjs`: **9/9 PASS** (Bảng Markdown render thành thẻ `<table>`, không còn `| :--- |`, công thức `$\rightarrow$` thành `→`, `x²`, phân số, liên kết an toàn).
- `tests/test_read_status.cjs`: **8/8 PASS** (Mở bài từ cuối danh sách luôn ở ĐẦU bài `scrollY === 0`, chưa đọc thì không nhảy 100%, cuộn hết thì ghi nhận "Đã đọc hết", danh mục và Tiến độ đồng bộ).
- `tests/test_tutor_offtopic.mjs`: **6/6 PASS** (Nhận diện gõ linh tinh, trích xuất đề cương bài học, phản hồi gợi ý không tốn lượt AI, câu hỏi ngoài lề điều hướng về bài học).
- `tests/test_worker_tutor_guardrails.mjs`: **7/7 PASS** (Chống lộ đáp án E2, E3, F1, F2, F3).
- `tests/test_tutor_accuracy.mjs`: **17/17 PASS**.
- `tests/test_pwa_update_integrity.mjs`: **7/7 PASS** (P1–P7).
- `tools/package_student_pwa.py --check`: **PASS** (`aisgk-student-shell-e89663118e30f5018b46a446`).

---

## 2. Triển khai Cloudflare Worker
- **ID triển khai mới**: `4c55a03b-6ba4-462e-801e-b79e0f255508`
- **Tuyến kích hoạt**: `https://aihoctap-gate.mrbin2026dh.workers.dev`
- **Cải tiến**: Nhận diện gõ linh tinh (`isGibberish`), trích xuất đề mục bài học (`lessonOutline`), phản hồi tức thì kèm nút gợi ý câu hỏi không trừ quota AI, dặn dò prompt điều hướng câu hỏi lạc đề về bài học hiện tại mà không dùng câu cứng nhắc "không thể cung cấp đáp án".
- **ID bản cũ để rollback nếu cần**: `a3622d90-17c2-425c-a02b-1c9281d633a9`.

---

## 3. Nghiệm thu thực tế trên môi trường thật (HTTPS https://aihoctap.online)
Kiểm thử trực tiếp trên mạng Internet thật bằng Chromium (Headless Playwright) với 2 kích thước thiết bị:
1. **Thiết bị 1: Máy tính Desktop (1280x800)**:
   - **Tài khoản**: Học sinh lớp 9 `9A9001` (Trịnh Nguyễn Bảo An - Lớp 9A9, PIN: `123456`).
   - **Mở bài học**: Danh sách bài cuộn xuống đáy (1055px), bấm mở bài cuối ("Sử dụng công cụ xác thực dữ liệu và hàm điều kiện") → Trang bài học cuộn tức thì về ĐẦU trang (`window.scrollY === 0px`).
   - **Thanh tiến trình đọc**: Vừa mở bài hiển thị "Đã đọc 24%", không bao giờ bị nhảy vọt lên 100% như trước.
   - **Bảng Markdown**: Mở bài 2 "Thông tin trong giải quyết vấn đề" → Render đúng thẻ `<table>`, 1 thẻ `<thead>`, 3 thẻ `<th>` ("Tiêu chí", "Ý nghĩa cốt lõi", "Ví dụ minh họa thực tế"), tuyệt đối không còn ký tự thô `| :--- |`.
   - **Ghi nhận đã đọc**: Cuộn đến đáy bài → Thanh đọc chuyển "Đã đọc hết" (100%). Về danh sách bài thấy chip `Đã đọc hết`. Tab Tiến độ ghi nhận mục bài 2: `Đã đọc hết`, tách bạch với bài tập.

2. **Thiết bị 2: Điện thoại di động (iPhone Safari 390x844)**:
   - **Bố cục**: Đạt chuẩn Zero-Overflow 100% (`scrollWidth: 390px === clientWidth: 390px`), không có lỗi Console F12.
   - **Gia sư - Gõ linh tinh ("KKKKKKKKKK")**: Phản hồi tức thì trong < 1 giây từ Worker:
     > *"Thầy/Cô chưa hiểu câu em vừa gõ. Em đang học bài **Thế giới kĩ thuật số**, bài có các nội dung:*
     > *- **Thiết bị có gắn bộ xử lí thông tin***
     > *- **Ưu thế và ứng dụng của máy tính điện tử***
     > *Em muốn tìm hiểu nội dung nào? Ví dụ em có thể hỏi: 'Thiết bị có gắn bộ xử lí thông tin là gì?'"*
     - Đi kèm 2 chip gợi ý câu hỏi để học sinh bấm hỏi ngay.
     - Số lượt AI không bị trừ, không nhắc chữ "đáp án".
   - **Gia sư - Câu hỏi ngoài lề ("Đội bóng nào vô địch World Cup?")**: Real Gemini suy luận và trả lời khéo léo trong ~4 giây:
     > *"Trong bài học **"Thế giới kĩ thuật số"**, chúng ta đang tìm hiểu về các thiết bị có gắn bộ xử lí thông tin và ưu thế của máy tính điện tử. Theo em, thiết bị nào trong gia đình như tivi hay máy giặt lại có thể tự động thực hiện các thao tác theo điều khiển của con người?"*
     - Không từ chối cụt lủn, không dùng câu "không thể cung cấp đáp án", khéo léo gợi mở dẫn dắt em về kiến thức bài học.

---

## 4. Bàn giao tiếp theo
- Mã nguồn frontend đã đóng gói dấu PWA `e89663118e30f5018b46a446`.
- Sẵn sàng bàn giao cho Claude thẩm định độc lập và cấp quyền cho Thầy push Git.
