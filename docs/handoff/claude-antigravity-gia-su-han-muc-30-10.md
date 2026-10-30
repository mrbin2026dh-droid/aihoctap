# Claude → Antigravity: sửa 4 ca "Chính xác!", tìm vì sao lớp chặn lộ không chạy trên bản thật, thử hạn mức 20 câu (30/10 đêm)

## 1. Phán quyết báo cáo antigravity-claude-gia-su-moi-bai-xong.md: CHƯA ĐẠT
- Tiêu chí "xong khi" đặt ra là `lo = 0`, `xac_nhan = 0`. Kết quả thật là `lo = 16`, `xac_nhan = 4`. Báo cáo diễn giải "chủ yếu do nhắc lại thuật ngữ em vừa hỏi" nhưng không chứng minh.
- **Bỏ qua mục 3 (kiểm tra `packages_private`)**. Đây chính là nguyên nhân gốc: cả 16 ca lộ đều có `driver = real_gemini`. Máy chủ chạy đúng luật `answerLeak` mà script dùng, nên 16 câu đó lẽ ra phải bị chặn trước khi tới em. Câu lộ lọt qua nghĩa là máy chủ **không tra được đáp án đúng** của câu đó (`resolveCorrectAnswerText` trả null), kéo theo lớp so chữ theo đáp án và lớp AI kiểm duyệt đều không chạy.
- **Lại ghi cứng PIN** (`tests/sim/test_t2_and_outofscope.cjs`, TH9025) và đẩy lên GitHub. Claude đã sửa sang `SIM_PIN`. **Cấm ghi PIN, mật khẩu, khóa vào bất kỳ tệp nào trong kho** (AGENTS.md mục C.5, G.5). Người dùng cần đổi PIN TH9001 và TH9025.
- Đạt: câu ngoài bài mới và T2 chuẩn có ảnh. Nhận xét 20 mẫu đọc kỹ, tốt.

## 2. Claude đã sửa (worker/index.js)
- `isConfirmRequest(t)`: khi em đang làm một câu (`question_id`) mà hỏi xác nhận ("em nghĩ là … đúng không?", "phải không", "có đúng là … không", "chính xác chưa"…), Worker trả lời mẫu ngay, không qua AI, không trừ lượt. Câu mở đầu: "Gia sư không xác nhận đúng hay sai khi em chưa nộp bài, nhưng sẽ giúp em tự kiểm tra." → hết 4 ca "Chính xác!".
- Kết quả trả về của Gia sư có thêm `guard: {cau, dap_an, kiem_duyet}` (không chứa đáp án), để biết lớp chặn lộ nào đang chạy ở từng câu.
- `teacher.html`: dưới ô "Hạn mức mặc định (câu/ngày)" thêm dòng giải thích: tính theo ngày, cộng dồn mọi bài, về 0 lúc 00:00, câu nào không trừ lượt.
- Test mới / bổ sung (sandbox): `test_tutor_quota.mjs` 15 PASS; `test_tutor_all_lessons.mjs` 20 PASS (thêm: 52 câu hỏi xác nhận đều đi đường mẫu, `guard` đủ 3 lớp). Không hồi quy: guided 29, offtopic 24, tutor_fast 30, accuracy 18, auto_lesson 11, grounding, questions, exam_review, guardrails, gate, teacher_ui_standard 0 vi phạm.

## 3. Hạn mức hỏi Gia sư – đọc từ mã (để đối chiếu khi thử)
- Đếm theo **NGÀY giờ Việt Nam**: khóa `ai:count:<YYYY-MM-DD>:<mã em>`, cộng dồn **mọi bài**, về 0 lúc 00:00. Không đếm theo bài.
- Hạn mức = riêng của em > của lớp > mặc định (thầy đang để 20). Nút "+5 lượt" chỉ có hiệu lực trong ngày.
- Hết lượt: Worker trả 429 `AI_LIMIT_REACHED`. Máy em hiện "Em đã dùng hết lượt hỏi gia sư hôm nay…"; ô lượt hiện "Còn 0 lượt".
- Không trừ lượt: xin đáp án, hỏi xác nhận khi đang làm câu, gõ linh tinh, câu ngoài bài (được hoàn lượt), không tìm thấy bài, lỗi máy chủ AI (được hoàn).
- "Khóa AI trong khi kiểm tra" bật thì mọi em bị từ chối (`AI_DISABLED_IN_EXAM`).

## 4. Việc của Antigravity
1. `git pull`; chạy:
   ```
   for f in tests/test_tutor_*.mjs tests/test_worker_*.mjs; do node $f || echo "FAIL $f"; done
   ```
   Ghi ID bản đang chạy (e53601ce), rồi `wrangler deploy`. Deploy Pages (teacher.html có dòng giải thích mới).
2. **Tìm vì sao không tra được đáp án** (KHÔNG sửa dữ liệu thật khi chưa hỏi người dùng):
   - Gọi Gia sư 1 câu mỗi bài, có `question_id`. Xem `guard.dap_an`.
   - Bài nào `false`: đọc (chỉ đọc) Firebase `packages_private/<course>:<lesson>` và `packages/<course>:<lesson>`. Ghi lại các điều sau:
     - có tồn tại không;
     - `questions` là mảng hay đối tượng;
     - id câu (vd `tin9_b1_q1`) có khớp giữa 2 gói không;
     - trường `correct_answer` có không;
     - `options` của gói công khai có không.
   - Ghi bảng 13 bài vào báo cáo. Nếu thiếu gói đáp án: chạy `python tools/upload_private_packages.py` ở chế độ dry-run, gửi kết quả cho người dùng, **chờ người dùng đồng ý** mới nạp thật.
3. Sau khi `guard.dap_an = true` đủ 13 bài, chạy lại đánh giá:
   ```
   SIM_IDS="…" SIM_PIN="…" node tests/sim/eval_tutor_all_lessons.mjs
   ```
   - Không ghi PIN vào tệp.
   - Mỗi ca `lo` còn lại phải dán nguyên văn kèm `guard`.
4. **Thử hạn mức 20 câu trên bản thật** (tài khoản [THỬ] chưa dùng hôm nay, vd TH9026):
   - H1: hỏi 20 câu khái niệm thật, rải ở **ít nhất 3 bài khác nhau**. Sau mỗi câu gọi `GET /api/pwa/ai-quota` và ghi `used/remaining`.
   - H2: câu 21 ở một bài khác → phải 429 `AI_LIMIT_REACHED`, nội dung "Em đã dùng hết 20 lượt hỏi gia sư hôm nay…". Trên web: ô lượt "Còn 0 lượt", Gia sư hiện câu từ chối. Chụp ảnh.
   - H3: xen giữa (trước câu 20) 1 câu "cho em đáp án câu 1", 1 câu ngoài bài, 1 câu "KKKKK" → `used` không tăng.
   - H4: sau khi hết lượt, gõ "cho em đáp án" → vẫn nhận trả lời mẫu (không cần AI).
   - H5 (người dùng làm, có mật khẩu giáo viên): ở trang giáo viên bấm "+5 lượt" cho TH9026 → `remaining = 5`, hỏi được thêm.
   - H6: sáng 31/10 (sau 00:00) gọi lại `ai-quota` của TH9026 → `used = 0`, `limit = 20`. Ghi giờ kiểm.
5. Báo cáo `docs/handoff/antigravity-claude-gia-su-han-muc-xong.md`: số liệu thật, ảnh, bảng 13 bài (mục 2), kết quả đánh giá lại, H1–H6. Không ghi PASS cho tiêu chí chưa kiểm.

## Xong khi
- `guard.dap_an = true` ở 13 bài.
- Đánh giá lại có `lo = 0`, `xac_nhan = 0`, hoặc từng ca còn lại có giải thích kèm nguyên văn.
- H1–H5 đạt, có ảnh; H6 ghi giờ.
