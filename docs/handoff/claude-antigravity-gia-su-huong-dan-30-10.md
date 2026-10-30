# Claude → Antigravity: Gia sư "học có hướng dẫn" – deploy Worker và thử thật (30/10 tối)

## Bối cảnh (ảnh hội thoại thật thầy gửi 19:30)
| # | Lỗi | Mức |
|---|---|---|
| 1 | Hỏi phụ "robot hút bụi có bộ xử lí không?", em đáp "không?" → Gia sư "**Đúng rồi** em nhé! Robot hút bụi **có** tích hợp…" (khen sai, nói ngược) | Cao – sai kiến thức |
| 2 | Câu "bộ phận nào là 'bộ não'", em chưa nộp, đáp "bộ xử lý câu lệnh" → Gia sư "Bộ xử lí thông tin **(CPU)** … được ví như **bộ não**" = nêu luôn phương án A | Cao – lộ đáp án |
| 3 | Chuỗi câu hỏi có/không về tivi, robot, máy giặt… trôi khỏi câu hỏi chính, không quay lại | Trung bình |
| 4 | "đáp án đó chĩnh xác", "Đáp án là gì?" đi qua AI (chậm, tốn lượt) | Thấp |
| 5 | Gia sư viết "được ví như 'bộ nhé'" (AI gõ nhầm "bộ não") | Thấp – lỗi chữ của mô hình, chưa chặn được bằng mã |

## Đã sửa (worker/index.js, commit kèm tệp này)
- `TUTOR_JSON_SCHEMA` thêm trường bắt buộc `danh_gia` (`dung|mot_phan|sai|chua_chac|khong_phai_tra_loi`), `propertyOrdering` đặt trước `tra_loi` → AI quyết định đánh giá TRƯỚC khi viết (nguyên tắc chống "chiều lòng" của LearnLM).
- `fixPraise(reply, verdict, message)`: chỉ giữ câu khen đầu ("Đúng rồi", "Chính xác"…) khi `danh_gia = dung` và em không trả lời kiểu đoán (`isHedgedAnswer`: "không?", "có ạ?", "chắc là có"); còn lại thay bằng câu đúng với đánh giá.
- `optionPairLeak(reply, question)`: một câu trong lời Gia sư vừa chứa mô tả câu hỏi (cụm trong ngoặc, hoặc ≥ 2 cụm 3 từ trùng câu hỏi; coi lý = lí) vừa chứa nội dung một lựa chọn → coi là lộ → sinh lại 1 lần → vẫn lộ thì dùng `PAIR_LEAK_FALLBACK`.
- `tutorScopeRules`: thêm 3 quy tắc ĐÁNH GIÁ / PHẢN HỒI ĐÚNG VỚI ĐÁNH GIÁ / HỌC CÓ HƯỚNG DẪN (một bước, hỏi mở, không dồn câu có/không). Khi có câu hỏi đang làm: thêm "MỤC TIÊU CUỘC TRÒ CHUYỆN" (câu hỏi phụ tối đa 2 lượt rồi quay lại; em nêu đúng ý thì khen đúng ý, không gọi tên lựa chọn).
- `isAnswerBegging` bắt thêm: "đáp án đó chính xác/chĩnh xác", "đáp án là gì?", "phương án em chọn có đúng không", "em chọn vậy đúng không".

## Kiểm thử Claude đã chạy (sandbox, AI giả)
- MỚI `tests/test_tutor_guided.mjs`: 29 PASS (cả 4 lỗi trên, chạy qua `worker.fetch`).
- Không hồi quy: test_tutor_offtopic 24, test_worker_tutor_fast 30, test_tutor_accuracy 17, auto_lesson 11, grounding, questions, exam_review, guardrails, gate, teacher_scope, thi_ip 9 – đều PASS.

## Việc của Antigravity
1. `git pull`, chạy lại: `node tests/test_tutor_guided.mjs && node tests/test_tutor_offtopic.mjs && node tests/test_worker_tutor_fast.mjs`.
2. Ghi ID bản Worker đang chạy (`wrangler deployments list`) để rollback, rồi `wrangler deploy`.
3. Thử THẬT bằng tài khoản [THỬ] lớp 9TH, bài "Thế giới kĩ thuật số", mục Làm bài tập, câu "bộ não", chọn A, mở Gia sư:
   - T1 gõ "bộ xử lý câu lệnh" → KHÔNG được có "CPU" hay "bộ não" cùng câu; phải khen đúng ý + mời tự đối chiếu lựa chọn.
   - T2 Gia sư hỏi phụ có/không, em gõ sai (vd "không" khi tài liệu nói có) → mở đầu "Chưa đúng…", không "Đúng rồi".
   - T3 gõ "không?" → Gia sư hỏi vì sao, không khen.
   - T4 gõ "đáp án đó chĩnh xác" → trả lời mẫu ngay (có dòng "Câu này không trừ lượt").
   - T5 nói chuyện 4–5 lượt → Gia sư đưa em quay lại câu hỏi chính.
   - Chụp màn hình từng ca. Ghi rõ "bản thật" và giờ chụp.
4. Một ca sai → rollback ngay, báo Claude kèm ảnh.

## Xong khi
- Test xanh, Worker mới chạy, 5 ca T1–T5 đạt trên bản thật, có ảnh; báo cáo `docs/handoff/antigravity-claude-gia-su-huong-dan-xong.md`.
