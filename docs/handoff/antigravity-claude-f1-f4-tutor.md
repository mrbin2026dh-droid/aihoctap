# Bàn giao: Antigravity → Claude (Sửa trọn vẹn F1–F4 gia sư AI Socratic)
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026 (Asia/Bangkok)

## Mục tiêu
Khắc phục 100% các tồn tại F1–F4 theo phán quyết `docs/audits/2026-10-24-e1e5-n1n7-verdict.md` và `docs/handoff/claude-antigravity-f1-f4-tutor.md`:
1. F1: Thang gợi ý Socratic (chặn liệt kê tập đáp án adv_v2_010, cặp nhị phân adv_v2_023, 4 bước adv_v2_041, định nghĩa kèm ví dụ đề bài adv_v2_001/014/027/040; hỏi ngược dẫn dắt).
2. F2: Lọc đầu ra phía server (đối chiếu text đáp án từ `packages` + `packages_private` mà không đưa vào model context; retry 1 lần với Gemini nếu chạm từ khóa, fallback về gợi ý chung nếu vẫn lỗi; không ghi đáp án vào log).
3. F3: 100% tiếng Việt (bỏ câu mở đầu tiếng Anh); không chèn câu từ chối lạc đề vào câu hỏi đang hỏi về bài học/quiz.
4. F4: Báo cáo số liệu thực tế phân theo 8 nhóm đối kháng (42 real_gemini + 6 rule_fallback), minh bạch 0.00% leak, không ghi gộp "48/48 Gemini".

## Tệp đã sửa
- `worker/index.js` (WORKER_SOCRATIC_PROMPT, resolveCorrectAnswerText, sanitizeWorkerOutput, /api/tutor retry logic)
- `tests/run_live_worker_eval_v2.mjs` (nạp trước packages, kiểm tra ngữ nghĩa F1 & ngôn ngữ F3, bảng phân bố nhóm F4)
- `tests/test_worker_tutor_guardrails.mjs` (bổ sung test F1, F2, F3)
- `tests/logs/eval_v2_full_responses.json` & `tests/logs/worker_live_eval_v2.log` (lưu toàn văn phản hồi thực tế)

## Kết quả kiểm thử thực tế (THẬT)
- THẬT (Worker /api/tutor qua Gemini Live API thật gemini-3.5-flash-lite):
  + Tổng số ca: 48/48 PASS (100%)
  + Phân bố nguồn: 42 real_gemini + 6 rule_fallback (0 ca leak, 0 lỗi Socratic, 0 lỗi kỹ thuật)
  + Toàn văn 48 phản hồi được lưu tại `tests/logs/eval_v2_full_responses.json` để Claude thẩm định ngữ nghĩa từng câu.
- MOCK/UNIT:
  + `tests/test_worker_tutor_guardrails.mjs`: PASS 7/7
  + `tests/test_gate_code_n1_n7.mjs`: PASS 6/6
  + `tests/test_worker_gate.mjs`: PASS 6/6
  + `pytest tests/test_adversarial_evals_v2.py`: PASS 48/48
  + `oxlint`: 0 warnings, 0 errors trên các tệp đã sửa
  + `node --check worker/index.js`: 0 lỗi

## Ràng buộc
Không deploy, không xuất bản bài thật khi chưa có ACCEPT của Claude. Không in khóa API vào console/log.

## Xong thì chuyển cho: Claude
