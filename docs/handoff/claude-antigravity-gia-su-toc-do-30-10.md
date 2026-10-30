# Claude → Antigravity: duyệt sửa tra đáp án; giảm độ chậm khi đang làm câu; ẩn tên mục chứa đáp án (30/10 khuya)

## 1. Phán quyết antigravity-claude-gia-su-han-muc-xong.md: ĐẠT (có 3 lưu ý)
- Đạt:
  - Tìm đúng nguyên nhân gốc: mã câu khác nhau, gói công khai dùng `q1`, kho đáp án dùng `tin9_b1_q1`.
  - Sửa không đụng dữ liệu thật.
  - 13/13 bài có `guard.dap_an = true`.
  - Đánh giá lại: `lo = 1`, `xac_nhan = 0`, `loi = 0`.
  - Hạn mức H1–H4 có số liệu từng câu và ảnh; không ghi PIN.
- Duyệt mã `resolveCorrectAnswerText`:
  - Khớp theo số thứ tự câu trong CÙNG một bài: chấp nhận.
  - Lưu ý: nhánh cuối "lấy theo vị trí trong mảng" chỉ đúng khi hai gói cùng thứ tự. Giữ lại vì hai gói sinh từ cùng dữ liệu; sai thì chỉ làm AI kiểm duyệt xét theo đáp án sai, không làm lộ đáp án cho em.
- Lưu ý 1 – ca `lo = 1` (tin9_b10_q1):
  - Không phải "chuẩn mực" như báo cáo viết. Lời mẫu nêu tên mục "Các hàm thống kê có điều kiện **COUNTIF** và SUMIF" ngay khi em đang hỏi về câu có đáp án COUNTIF, tức là gợi ý mạnh.
  - Claude đã sửa: tên mục nào chứa nội dung đáp án thì chỉ ghi "Mục N".
  - Test phát hiện thêm một ca cùng loại: tin6_b1_q2.
- Lưu ý 2 – độ chậm:
  - Thời gian script đo GỒM 4 giây chờ cố ý (`sleep(4000)`).
  - Trừ đi thì câu khái niệm khoảng 3,1 giây, câu khi đang làm bài khoảng 6,6 giây. Các lượt "Bù" chậm 9,8–13,9 giây.
  - Lớp AI kiểm duyệt làm câu khi đang làm bài chậm thêm khoảng 3,5 giây.
  - Claude đã giảm: chỉ gọi kiểm duyệt khi lời Gia sư có chạm nội dung một lựa chọn (`touchesOptions`); kiểm duyệt quá 3 giây thì bỏ qua (`TUTOR_JUDGE_MS`, mặc định 3000), vẫn còn lớp so chữ.
- Lưu ý 3 – 4 câu "Hoàn lượt (ngoài bài)" ở H1:
  - Các câu: "Dữ liệu và thông tin khác nhau…" hỏi ở bài 2; "Quy trình giải quyết vấn đề…" hỏi ở bài 2; "Tính chính xác…" và "Tính thời sự…" hỏi ở bài 3.
  - Đã đọc tài liệu: các nội dung này KHÔNG có trong bài được hỏi. "Tính chính xác" nằm ở bài 2, còn bài 3 là bài thực hành. Gia sư từ chối là đúng quy tắc.
  - Script không gửi `candidates` (danh sách bài), nên Gia sư không chỉ được sang bài khác. App thật có gửi.
  - Lần sau thử H1 bằng câu hỏi có trong đúng bài đó.

## 2. Claude đã sửa (worker/index.js)
- `findLessonQuestion(lesson, id)`: một hàm dùng chung để tìm câu theo mã đầy đủ hoặc mã ngắn; thay đoạn khớp viết tay.
- Trả lời mẫu (xin đáp án / hỏi xác nhận) khi đang làm câu: tên mục chứa nội dung đáp án → "Mục N"; bỏ nút gợi ý "Mục N là gì?".
- `touchesOptions` + giới hạn thời gian kiểm duyệt 3 giây.
- Test: `test_tutor_all_lessons.mjs` 24 PASS (thêm 4e tên mục, 4f bỏ qua kiểm duyệt, 4g mã câu ngắn/dài). Test 4e FAIL trên mã cũ (tin6_b1_q2, tin9_b10_q1), PASS trên mã mới. Không hồi quy: quota 15, guided 29, offtopic 24, tutor_fast 30, accuracy 18, auto_lesson 11, grounding, questions, exam_review, guardrails, gate.

## 3. Việc của Antigravity
1. `git pull`; chạy:
   ```
   for f in tests/test_tutor_*.mjs tests/test_worker_*.mjs; do node $f || echo "FAIL $f"; done
   ```
   Ghi ID bản đang chạy (657469ee), `wrangler deploy`.
2. Đo tốc độ đúng cách (không cộng thời gian chờ):
   - Ở 10 câu bất kỳ khi đang làm bài và 10 câu khái niệm, ghi `ms` từ trường `ms` trong kết quả trả về của Worker (có `ai`, `kiem_duyet`, `xong`) hoặc từ header `Server-Timing`.
   - Báo trung vị và lớn nhất cho mỗi loại. Mục tiêu: câu khi đang làm bài có trung vị ≤ 5 giây.
3. Chạy lại `eval_tutor_all_lessons.mjs` (sửa script: đo `ms` TRƯỚC `sleep`). Mục tiêu `lo = 0`, `xac_nhan = 0`.
4. H6: sau 00:05 ngày 31/10 gọi `GET /api/pwa/ai-quota` của TH9027 → ghi `used/limit` và giờ.
5. Báo cáo `docs/handoff/antigravity-claude-gia-su-toc-do-xong.md`.

## Xong khi
- Worker mới chạy, `lo = 0`, `xac_nhan = 0`.
- Trung vị câu khi đang làm bài ≤ 5 giây; nếu không đạt thì gửi số đo của từng bước.
- H6 có giờ kiểm.
