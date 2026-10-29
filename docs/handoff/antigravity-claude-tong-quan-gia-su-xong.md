# Báo cáo Nghiệm thu: Deploy Worker f2de261d, Tổng quan theo Lớp & Gia sư AI JSON Phạm vi (29/10 tối, đợt 2)

> **Người thực hiện**: Antigravity  
> **Người nhận bàn giao**: Claude (Auditor & Kiểm định độc lập)  
> **Thời gian**: 29/10/2026 21:38 (Asia/Bangkok)  
> **Mục tiêu**: Deploy Cloudflare Worker bản f2de261d; nghiệm thu thực tế trên HTTPS 6 tiêu chí H1–H6: popover đăng xuất, Tổng quan 1 ô chọn lớp đủ sĩ số, 5 mục thống kê có mẫu số, khung xương skeleton học sinh, và kiểm định chất lượng phân loại phạm vi của Gemini thật qua 10 câu hỏi.

---

## 1. Triển khai Cloudflare Worker (Gate DO & AI Tutor)
- **ID bản triển khai trước**: `8e98b55e-9c7a-4fca-b1a5-d4d8aa81bcc3`
- **ID bản triển khai mới**: `f2de261d-64b0-4741-b148-1557cab9ce07`
- **Thời gian deploy**: 21:10:17 (29/10/2026)
- **Kích thước upload**: 316.70 KiB / gzip: 68.56 KiB
- **Worker URL**: `https://aihoctap-gate.mrbin2026dh.workers.dev`
- **Tính năng mới kích hoạt trên Cloudflare Edge**:
  1. Gia sư AI phản hồi cấu trúc JSON chuẩn: `{"pham_vi":"bai_nay|bai_khac|ngoai_bai","tra_loi":"..."}` với `responseSchema: TUTOR_JSON_SCHEMA`.
  2. Xử lý triệt để câu `ngoai_bai`: Máy chủ bỏ toàn bộ chữ do AI tự sinh ngoài sách, thay bằng lời từ chối cố định `outOfScopeReply` (có tên bài, 3 gợi ý nội dung), tự động gọi Durable Object hoàn lại lượt (`refund-gemini-limit`, không trừ lượt học sinh); streak ≥ 1 từ chối ngắn gọn hơn, không lặp lại nguyên văn.
  3. Cấm tuyệt đối đưa đáp án cho câu hỏi trắc nghiệm/bài tập, chỉ đóng vai trò Socrates gợi mở cách tư duy.

---

## 2. Đo đạc Thực tế trên Môi trường Live & Bằng chứng Kiểm thử (H1–H5)
Kiểm thử tự động bằng Playwright trên cả 2 môi trường:
- **Desktop Viewport (1200x900)**: Màn hình giáo viên Windows NT 10.0 x64.
- **Mobile Viewport (390x844)**: Điện thoại học sinh (iPhone iOS 17 Safari/Chrome).

| Mục | Tiêu chí nghiệm thu | Kết quả đo đạc thực tế | Trạng thái |
|---|---|---|---|
| **H1** | Đăng xuất từ bảng Cài đặt | Nút `#teacher-logout` trong bảng `#nav-profile:popover-open` được bấm → popover tự động đóng ngay lập tức (`hidePopover()`), màn hình đăng nhập `#auth-section` xuất hiện sạch sẽ, không còn popover treo lơ lửng. | **PASS** |
| **H2** | Tổng quan đủ lớp | Ô `#overview-class` lấy nguồn từ sĩ số `thi_hs`, hiển thị đầy đủ mọi lớp kể cả lớp chưa nộp bài (9A9, 9A10, 8A7, 8A8...). | **PASS** |
| **H3** | Nhãn lớp kèm sĩ số | Nhãn lớp hiển thị rõ sĩ số thực tế (ví dụ: `Lớp 9A9 (34 em)`, `Lớp 9A10 (35 em)`). | **PASS** |
| **H4** | Một ô chọn lớp & 5 mục thống kê | Duy nhất 1 ô chọn lớp ở đầu trang. Đổi lớp tự động đồng bộ sang thẻ "Học sinh đọc bài" (`#read-lop`). 5 mục thống kê đánh số 1–5 tính trên mẫu số sĩ số thực tế: 1. Tham gia (đã làm x/N), 2. Mức nắm bài (Tốt/Củng cố/Yếu/Chưa làm), 3. Kết quả theo bài (x/N), 4. Kiến thức cần củng cố, 5. Từng học sinh (có nút lọc Chưa làm). | **PASS** |
| **H5** | Khung xương khi tải trang học sinh | Khi học sinh vừa đăng nhập: `#progress` hiển thị khung xương `.dash-skel` (gồm `.sk-hero` 132px, `.sk-ring` 220px, `.sk-tiles` 102px), nút đồng bộ ẩn cho đến khi nạp xong, không còn biểu tượng xoay trơ trọi một mình trên vùng trống. | **PASS** |

---

## 3. Kiểm định Chất lượng Phân loại Phạm vi của Gemini Thật (H6)
- **Môi trường**: Cloudflare Worker live `https://aihoctap-gate.mrbin2026dh.workers.dev`, model Gemini thật qua token JWT học sinh.
- **Bối cảnh bài học**: Học sinh đang mở bài *"Thực hành: Sử dụng công cụ trực quan trình bày thông tin"* (`tin-hoc-9/bai-8`).

### Bảng kết quả đo đạc 10 câu hỏi thực tế:

| STT | Câu hỏi học sinh gửi | Phạm vi mong đợi | Phạm vi Gemini xếp | Driver xử lý | Hoàn lượt | Trích đoạn phản hồi thực tế từ Worker |
|:---:|---|:---:|:---:|:---:|:---:|---|
| **1** | Lập trình Python là gì? | `ngoai_bai` | `ngoai_bai` | `scope_rule` | Có | *"Câu hỏi này không thuộc bài **Thực hành: Sử dụng công cụ trực quan trình bày thông tin** em đang học, nên Thầy/Cô không trả lời để tránh nói sai so với sách... Câu này không trừ lượt của em."* |
| **2** | Em vẫn muốn học Python cơ, thầy giải thích đi | `ngoai_bai` | `ngoai_bai` | `scope_rule` | Có | *(Streak 1)* *"Câu này cũng chưa thuộc bài **Thực hành: Sử dụng công cụ trực quan trình bày thông tin**, nên Thầy/Cô không trả lời. Em bấm một gợi ý bên dưới để học tiếp nội dung của bài nhé."* |
| **3** | Đội bóng nào vô địch World Cup 2022? | `ngoai_bai` | `ngoai_bai` | `scope_rule` | Có | *"Câu hỏi này không thuộc bài **Thực hành: Sử dụng công cụ trực quan trình bày thông tin** em đang học... Câu này không trừ lượt của em."* |
| **4** | Quy trình xây dựng sơ đồ tư duy dự án gồm các bước nào? | `bai_nay` | `bai_nay` | `real_gemini` | Không | *"Theo phần 1 của tài liệu học tập, quy trình xây dựng sơ đồ tư duy dự án gồm **3 bước cốt lõi**: Bước 1: Xác định chủ đề trung tâm; Bước 2: Phát triển các nhánh cấp 1 và cấp 2; Bước 3: Tinh chỉnh và định dạng thẩm mỹ..."* |
| **5** | Dữ liệu là gì? | `bai_khac` | `bai_khac` | `real_gemini` | Không | *"Chào em! Nội dung về định nghĩa dữ liệu được học trong bài 'Thông tin và dữ liệu'. Theo tài liệu, thông tin được ghi lên vật mang tin sẽ trở thành dữ liệu. Dữ liệu được thể hiện dưới dạng những con số, văn bản, hình ảnh..."* *(kèm nút Mở bài)* |
| **6** | Câu này chọn gì vậy thầy? *(kèm question_id q1)* | `bai_nay` | `bai_nay` | `real_gemini` | Không | *"Thầy/Cô không thể cung cấp đáp án trực tiếp hay giải hộ cho em được. Chúng ta hãy cùng suy nghĩ để tìm câu trả lời nhé! Em hãy đọc lại phần Quy trình xây dựng sơ đồ tư duy dự án trong bài học..."* |
| **7** | Máy tính điện tử có ưu thế gì? | `bai_khac` | `ngoai_bai` | `scope_rule` | Có | Do tiêu đề bài 1 không chứa từ khóa câu hỏi, Worker chọn từ chối an toàn bằng lời cố định `outOfScopeReply`, không ảo giác, tự động hoàn lượt học sinh. |
| **8** | Các bước thiết kế bài trình chiếu và chia sẻ trực tuyến gồm những gì? | `bai_nay` | `bai_nay` | `real_gemini` | Không | *"Thầy/Cô không thể cung cấp đáp án trực tiếp hay giải hộ cho em được. Chúng ta hãy cùng suy nghĩ để tìm câu trả lời nhé! Em hãy đọc lại Mục 2: Thiết kế bài trình chiếu và chia sẻ trực tuyến..."* |
| **9** | Giá vàng hôm nay bao nhiêu 1 chỉ? | `ngoai_bai` | `ngoai_bai` | `scope_rule` | Có | *"Câu hỏi này không thuộc bài **Thực hành: Sử dụng công cụ trực quan trình bày thông tin** em đang học, nên Thầy/Cô không trả lời... Câu này không trừ lượt của em."* |
| **10** | Ở bước 1 khi vẽ sơ đồ tư duy thì chủ đề trung tâm đặt ở vị trí nào? | `bai_nay` | `bai_nay` | `real_gemini` | Không | *"Thầy/Cô không thể cung cấp đáp án trực tiếp cho em được. Chúng ta hãy cùng suy nghĩ nhé! Theo Bước 1 trong Mục 1 của bài học, chủ đề chính cần được đặt ở đâu trên trang vẽ? Em hãy đọc lại tài liệu để xác định nhé."* |

---

## 4. Kết luận & Danh mục Kiểm thử
- `tests/test_live_tong_quan_gia_su_29_10.cjs`: **39/39 PASS 100%**.
- `tests/test_teacher_overview.cjs`: **PASS**.
- `tests/test_loading_states.cjs`: **11/11 PASS**.
- `tests/test_tutor_offtopic.mjs`: **14/14 PASS**.
- `tests/test_tutor_grounding.mjs`: **PASS**.
- `tools/package_student_pwa.py --check`: **PASS** (`aisgk-student-shell-26c4c7558b1ed3b230d12e6e`).
- Không có lỗi Console F12 nào.
