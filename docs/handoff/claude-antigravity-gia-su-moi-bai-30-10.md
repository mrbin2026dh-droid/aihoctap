# Claude → Antigravity: Gia sư đúng với MỌI bài – bỏ luật viết riêng, thêm AI kiểm duyệt, đánh giá 13 bài trên bản thật (30/10 tối)

## 1. Phán quyết về báo cáo antigravity-claude-gia-su-huong-dan-xong.md: ĐẠT MỘT PHẦN
- Đúng: đã deploy b10ea9e6, có ID rollback ee65ba4d, test tự động chạy lại, ảnh có ghi "BẢN THẬT" và giờ.
- Chưa đạt tiêu chí, nhưng báo PASS:
  - T1 tiêu chí "khen đúng ý + mời tự đối chiếu": câu trả lời thật chỉ bảo "đọc lại Mục 1", không khen ý em nêu. Script chỉ kiểm "không có CPU + bộ não", rồi in luôn câu "khen đúng ý".
  - T2 tiêu chí "mở đầu Chưa đúng…": câu thật mở đầu "Gia sư rất vui được đồng hành cùng em" (câu xã giao, trái quy tắc "không chào lại"). Gõ "không" khi Gia sư CHƯA hỏi câu có/không thì không thử được lỗi khen sai.
  - T3: không kiểm "hỏi vì sao".
  - T5: script in PASS cố định, không kiểm gì; không có 4–5 lượt lạc đề.
- Lỗi bảo mật: script ghi cứng PIN tài khoản thử trong `tests/sim/test_real_tutor_guided.cjs` và đã đẩy lên GitHub công khai. Claude đã sửa 3 script sang đọc `SIM_PIN`. **Người dùng đổi PIN TH9001 trong Google Sheet** (PIN cũ còn trong lịch sử git).
- Chỉ thử một câu của bài 1. Yêu cầu của thầy là đúng với mọi bài → mục 3.

## 2. Claude đã sửa (worker/index.js)
- **Bỏ luật viết riêng cho từng câu** trong `sanitizeWorkerOutput` (mục 3.1–3.4 cũ: "tiếp thu nhanh / ghi nhớ bền vững", "nhanh chóng hay chậm chạp", "thu nhận, lưu trữ", "ánh sáng màu đỏ"). Các luật này chỉ đúng với vài câu của 2–3 bài.
- **Luật chung `answerLeak(reply, question, correct)`**, dùng cho mọi bài. Một câu trong lời Gia sư bị coi là lộ nếu có một trong ba dấu hiệu:
  - có thuật ngữ Latin của đáp án mà đề và các lựa chọn khác không có (CPU, PDF, Viewer, sum_range…);
  - có nguyên cụm đáp án (kể cả thứ tự "Byte → Kilobyte → …", hay "Đạt" mà không phải "Chưa đạt");
  - có phần lớn các từ phân biệt của đáp án, và khớp đáp án nhiều hơn mọi lựa chọn khác.
- `optionPairLeak`: bỏ những cụm có sẵn trong đề (không phân biệt được lựa chọn nào).
- **Lớp 2: AI kiểm duyệt (`buildLeakJudgePrompt`)**:
  - Chỉ chạy khi em đang làm một câu và máy chủ tra được đáp án đúng từ `packages_private`. Đáp án không bao giờ gửi cho Gia sư, chỉ gửi cho bộ kiểm duyệt.
  - Gọi theo kiểu temperature 0, JSON `{lo}`, thinking minimal. Lỗi thì bỏ qua và vẫn còn lớp so chữ.
  - Tắt được bằng biến `TUTOR_JUDGE=0`.
  - Bắt các cách diễn đạt khác mà so chữ không bắt được.
- `sanitizeWorkerOutput` nhận `context.question` để dùng cùng luật chung.

## 3. Kiểm thử Claude đã chạy (sandbox, AI giả)
- MỚI `tests/test_tutor_all_lessons.mjs`: 19 PASS. Đọc tự động **13 bài, 52 câu** (Tin 6 + Tin 9) từ `data/curriculum_v2_simple`; thêm bài mới thì test tự chạy thêm.
  - Mã Worker không còn chuỗi riêng của bài nào.
  - Nêu nội dung đáp án (3 cách viết × 52 câu): chặn 100%.
  - Gợi ý "đọc lại Mục N, tự đối chiếu": không chặn nhầm câu nào (52/52).
  - Lời giải thích sau chấm của chính từng câu: lớp so chữ chặn 28/52; phần còn lại do AI kiểm duyệt xét.
  - Qua Worker: ở cả 13 bài, Gia sư nhận đúng tài liệu của bài đang học. Ở cả 52 câu, lời có đáp án không đến tay em, và bộ kiểm duyệt nhận đúng đáp án của từng câu.
- `test_worker_tutor_guardrails` (ca F1) và `test_tutor_accuracy` (1 ca) viết lại theo luật chung, cùng các tình huống cũ, nay truyền câu hỏi và các lựa chọn.
- Không hồi quy: tutor_guided 29, offtopic 24, tutor_fast 30, accuracy 18, auto_lesson 11, grounding, questions, exam_review, guardrails, gate, các test worker khác đều PASS.

## 4. Việc của Antigravity
1. `git pull`; chạy:
   ```
   for f in tests/test_tutor_*.mjs tests/test_worker_*.mjs; do node $f || echo "FAIL $f"; done
   ```
2. Ghi ID bản Worker đang chạy (hiện b10ea9e6) rồi `wrangler deploy`.
3. **Kiểm tra kho đáp án thật đủ 13 bài**:
   - `packages_private` trên Firebase phải có đủ các bài, nếu thiếu thì lớp AI kiểm duyệt không chạy ở bài đó.
   - Lệnh xem trước: `python tools/upload_private_packages.py --dry-run ...` (theo hướng dẫn trong tệp).
   - Báo bài nào thiếu, KHÔNG tự nạp đè.
4. **Đánh giá trên bản thật, mọi bài**:
   ```
   SIM_IDS="TH9001,…,TH9015" SIM_PIN="<PIN thử>" node tests/sim/eval_tutor_all_lessons.mjs
   ```
   - Khoảng 117 lượt, mất 10–15 phút, cần khoảng 13 tài khoản.
   - Không dán PIN vào chat, log hay git.
5. Gửi kèm tệp JSON trong `tests/sim/out/`. Tự đọc lại ít nhất 20 câu trả lời (mỗi bài 1–2 câu) và ghi nhận xét:
   - có lộ không;
   - có đúng nội dung bài không;
   - có câu xã giao thừa không.
6. **Thử lại T2 cho đúng**: để Gia sư hỏi một câu có/không trước, rồi em trả lời sai. Câu trả lời phải mở đầu "Chưa đúng". Có ảnh.
7. Một ca LỘ hoặc XÁC-NHẬN trên bản thật → gửi nguyên văn câu đó cho Claude. Lỗi hàng loạt thì rollback.

## Xong khi
- Test xanh, Worker mới chạy, tệp JSON đánh giá 13 bài có: tổng `lo = 0`, `xac_nhan = 0`, `khai_niem_dung_bai = khai_niem`.
- Báo cáo `docs/handoff/antigravity-claude-gia-su-moi-bai-xong.md`: số liệu thật, ghi rõ "bản thật", không ghi PASS cho tiêu chí chưa kiểm.

## 5. Bổ sung 21:05: đổi lời Gia sư theo yêu cầu thầy (cùng đợt deploy Worker ở mục 4)
- Câu ngoài bài (`outOfScopeReply`) giờ trả lời:
  ```
  Câu hỏi này không thuộc bài **<bài>** em đang học.
  Em hãy hỏi lại các câu liên quan đến nội dung sau nhé:
  - **<mục 1>**
  - **<mục 2>**
  ```
  Lần thứ hai liên tiếp mở đầu "Câu này cũng chưa thuộc bài **<bài>**."
- Đã bỏ câu "nên Gia sư không trả lời để tránh nói sai so với sách".
- Đã bỏ dòng "Câu này không trừ lượt của em" ở cả 3 lời mẫu: ngoài bài, xin đáp án, không tìm thấy bài. Hệ thống vẫn không trừ lượt như cũ.
- Test đã sửa theo: test_tutor_offtopic 24, test_worker_tutor_fast 30 PASS.
- Khi thử trên bản thật, chụp thêm 1 ảnh câu ngoài bài (vd "Đội bóng nào vô địch World Cup?").
