# Bàn giao: deploy Worker — Gia sư AI chính xác hơn
Từ: Claude → Sang: Antigravity   Ngày: 28/10/2026

## Đã đổi (Claude, đã test) — chỉ `worker/index.js`, KHÔNG đổi Code.gs
- `findLetterLeak` + `ANSWER_SEEKING_RE`: bộ lọc lộ đáp án hết chặn nhầm câu giải thích khái niệm ("chọn cách", "câu dưới", "chọn bộ nhớ"…).
- `geminiText` + `maxOutputTokens 2048`: hết câu trả lời bị cụt.
- `pickLessonContext`: bài dài gửi đoạn liên quan nhất thay vì cắt 8.000 ký tự đầu.
- `TUTOR_STYLE_RULES`: giải thích khái niệm đủ ý, không chào lặp.
- `mode:'exam_review'` (AI nhận xét bài thi thử) — nếu bàn giao trước chưa deploy.
- Phân tích đầy đủ: `docs/phan-tich-ai-gia-su.md`.
- Test PASS: `node tests/test_tutor_accuracy.mjs`, `test_worker_tutor_guardrails.mjs`, `test_tutor_grounding.mjs`, `test_tutor_questions.mjs`, `test_tutor_exam_review.mjs`.

## Việc của Antigravity
1. `cd worker && npx wrangler deployments list` → ghi ID bản đang chạy.
2. Chạy lại 5 test trên (từ thư mục gốc) → tất cả PASS.
3. `npx wrangler deploy`.
4. Smoke (tài khoản học sinh thử, bài Tin 9 "Thế giới kĩ thuật số"):
   - Hỏi "Dữ liệu số là gì?" → AI giải thích có định nghĩa + ví dụ, câu trọn vẹn, KHÔNG hiện "Thầy/Cô không đưa ra đáp án…".
   - Mở một câu luyện tập, hỏi "Câu này chọn gì?" → AI từ chối nêu đáp án, gợi ý suy nghĩ.
   - Nộp một bài thi thử có "Cho xem điểm" → mục "Nhận xét của Gia sư AI" hiện chữ gõ dần.
5. Lỗi → `npx wrangler rollback <ID cũ>` và báo Claude kèm câu hỏi + câu trả lời.

## Việc người dùng (nếu chưa làm ở bàn giao trước `claude-antigravity-cap-nhat-gs-ai-tailieu.md`)
Dán Code.gs mới + Publish luật Firebase + BỎ chọn "Khóa AI trong khi kiểm tra" (Hồ sơ → Gia sư AI). Antigravity hướng dẫn từng bước như bàn giao đó.

## Không được làm
Không dán khóa Gemini / Database secret vào chat, Git, tệp bàn giao.

## Xong thì chuyển cho: Người dùng (kiểm tay) → Claude (nếu lỗi)
