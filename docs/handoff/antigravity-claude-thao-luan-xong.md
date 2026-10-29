# Antigravity → Claude: Đã hoàn tất nghiệm thu phân hệ "Thảo luận" kiểu Mentimeter, Deploy Worker & Đo đạc thực tế HTTPS

- **Từ:** Antigravity
- **Sang:** Claude (và Thầy)
- **Ngày:** 29/10/2026 (18:45 Asia/Bangkok)
- **Trạng thái:** **HOÀN THÀNH TOÀN BỘ CÁC MỤC (PASS 100%)**

---

## 1. Kết quả kiểm thử tự động toàn diện
1. `node tests/test_tl_core.mjs`: **22/22 ca PASS**
   - Đám mây từ khóa: Chuẩn hóa chữ thường, loại bỏ dấu câu, đếm tần suất, từ gửi nhiều có cỡ chữ lớn hơn.
   - Bộ lọc từ ngữ tiếng Việt (`badWord`): Chặn từ ngữ thiếu chuẩn mực (viết tắt, viết hoa, chèn dấu chấm, lách bằng số); không chặn nhầm từ ngữ thông thường ("các", "lon nước", "con chó"). Cho phép giáo viên bổ sung từ cấm riêng.
   - Xử lý các loại câu hỏi: Bình chọn (đếm số phiếu & %), Thang điểm 1–5 (tính trung bình tiêu chí, định dạng thanh màu), Câu trả lời mở (xếp theo thời gian, ẩn một ý thì ẩn mọi ý giống hệt), Hỏi đáp (xếp theo số phiếu upvote, câu đã trả lời xuống cuối).
   - Hỗ trợ tải tệp Excel mẫu và đọc chính xác 5 loại câu hỏi, báo rõ dòng lỗi.
2. `node tests/test_tl_ai.mjs`: **8/8 ca PASS**
   - Gợi ý câu hỏi thảo luận theo bài học trên máy chủ.
   - Tổng hợp ý kiến: Gom thành 2–4 nhóm ý chính, bảo mật tuyệt đối (chỉ gửi các câu trả lời đã duyệt, **không gửi tên hay mã định danh học sinh**).
   - Cơ chế tự vá lỗi: Nếu AI lỗi, hệ thống tự động sinh nhận xét tính sẵn từ số liệu thực tế.
3. `node tests/test_tl_live.cjs`: **51/51 ca PASS**
   - Mô phỏng 1 máy chiếu giáo viên + 2 học sinh ở 2 lớp khác nhau trải nghiệm đầy đủ 5 loại câu hỏi.
   - Hàng đợi duyệt bài: Câu trả lời mở và câu hỏi mới gửi vào hàng chờ, không tự ý hiện lên máy chiếu; giáo viên xem trước nội dung, bấm "Duyệt" mới hiện, bấm "Hiện tên" mới xem danh tính để nhắc nhở.
   - Tương tác trực tiếp: Học sinh B bấm biểu tượng "Cùng thắc mắc" (▲) trên câu hỏi của học sinh A $\rightarrow$ máy chiếu cập nhật ngay lập tức ▲ 1; giáo viên đánh dấu "Đã trả lời".
   - Tính năng Dừng nhận / Mở lại ý kiến và Ẩn / Hiện kết quả hoạt động chuẩn xác.
   - Xuất dữ liệu CSV đầy đủ (chỉ lưu trên máy giáo viên), xóa bộ thảo luận an toàn có xác nhận.
4. `node tests/test_quiz_live.cjs`: **53/53 ca PASS** (đã tích hợp màn đọc đề có khoảng đệm trước khi mở phương án, bục vinh danh tuần tự).
5. `python tools/package_student_pwa.py --check`: **PASS** (dấu shell: `aisgk-student-shell-a02d7bae6092fae58c1323c8`).

---

## 2. Triển khai Cloudflare Worker (`aihoctap-gate`)
- Kiểm thử pre-deploy: `test_teacher_ai.mjs` (22/22 ca PASS), `test_tl_ai.mjs` (8/8 ca PASS).
- **ID bản cũ (lưu để rollback):** `51aa1384-001e-48c8-a6a1-88282a3a6995`.
- **ID bản mới:** `a3622d90-17c2-425c-a02b-1c9281d633a9`.
- Tuyến `/api/teacher/ai-tl` đã kích hoạt thành công trên môi trường live (hỗ trợ 2 chế độ `goi_y` câu hỏi thảo luận theo bài và `tong_hop` ý kiến lớp học).

---

## 3. Hướng dẫn Thầy cập nhật Luật Firebase RTDB (`tl_*`)
Để bộ thảo luận của giáo viên đồng bộ lên đám mây và mở được trên máy chiếu phòng học:
1. Thầy vào [Firebase Console](https://console.firebase.google.com/) $\rightarrow$ dự án `ai-sgk-tinhoc` $\rightarrow$ **Realtime Database** $\rightarrow$ thẻ **Rules**.
2. Sao chép toàn bộ tệp `spike/step0/database.rules.ai-sgk-final.json` (đã bổ sung các nhánh bảo mật `tl_key`, `tl_proof`, `tl`, `tl_lop`, `tl_bo`).
3. Bấm **Publish**.
*(Lưu ý: Nếu Thầy chưa đăng luật, bộ thảo luận vẫn lưu an toàn trên máy với nhãn "Bộ thảo luận đang lưu trên máy này", giáo viên vẫn soạn và sử dụng bình thường).*

---

## 4. Đo đạc thực tế trên môi trường Production HTTPS (`https://aihoctap.online`)
Chạy kịch bản Playwright kiểm thử thực tế đa ngữ cảnh [`tests/test_live_thao_luan_https.cjs`](file:///c:/Users/HPZBook/Desktop/AI%20AGENT%20SGK/tests/test_live_thao_luan_https.cjs):
- **Phân hệ Tiện ích 2 thẻ:** Hiển thị đúng 2 thẻ "Luyện tập" và "Thảo luận", hỗ trợ chuyển thẻ bằng chuột và phím mũi tên `ArrowLeft` / `ArrowRight`.
- **Đo lường độ trễ mạng thật:**
  - Giáo viên Desktop (1280x800): **3412ms** (tải toàn bộ thư viện và mô-đun mới).
  - Học sinh 1 (iOS Mobile 390x844): **2121ms**.
  - Học sinh 2 (Android Mobile 390x844): **1155ms**.
  - Trung bình mạng: **2229ms**.
- **Kiểm định Bộ lọc từ ngữ tiếng Việt:**
  - Chặn chính xác các từ ngữ thiếu chuẩn mực ("vcl").
  - Không chặn nhầm các từ thông thường ("các", "lon nước", "con chó").
- **Kiểm định Đám mây từ khóa:**
  - Tự động gộp "Internet" và "internet" thành 1 từ khóa chung kích thước lớn ($n=2$).
- **Kiểm định giao diện (Zero-Overflow & Console):**
  - Không có bẫy tràn ngang trên Desktop (1280px) và Mobile (390px).
  - Console F12 sạch **0 lỗi đỏ (0 errors)** trên cả 3 phiên duyệt.

---

## 5. Tệp thay đổi & Bàn giao
- Tệp mới: `tests/test_live_thao_luan_https.cjs`, `docs/handoff/antigravity-claude-thao-luan-xong.md`.
- Tệp cập nhật: `aisgk.md`.
- Sẵn sàng bàn giao cho Claude nghiệm thu và Thầy tổ chức các buổi thảo luận sinh động trên lớp.
