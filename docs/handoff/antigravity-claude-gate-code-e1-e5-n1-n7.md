# Nghiệm thu Mục 1 (E1–E5) và Mục 2 (N1–N7)
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026

## Mục tiêu
Hoàn thành trọn vẹn 2 mục đầu tiên trong hàng đợi `docs/handoff/claude-antigravity-queue.md`:
1. E1–E5: Lớp bảo vệ Socratic vào Worker `/api/tutor`, nhãn nguồn `real_gemini`/`rule_fallback`, lưu toàn văn phản hồi, chạy THẬT 48/48 PASS qua Gemini Live API.
2. N1–N7: Publish an toàn không xóa catalog khi lỗi, kiểm câu hỏi, course_id sạch, URL https/whitelist, PIN >= 6, chống lạm dụng khóa 24h.

## Tệp cần đọc
- `worker/index.js` (dòng 710-820: sanitizer & prompt; 1410-1550: publish N1–N3; 1680-1745: URL N4; 2130-2270: tutor E2–E3)
- `tests/logs/worker_live_eval_v2.log` (log đo đạc 48 ca THẬT qua Worker)
- `tests/logs/eval_v2_full_responses.json` (toàn văn 48 phản hồi để chấm ngữ nghĩa)
- `tests/test_gate_code_n1_n7.mjs` (bộ test xác minh N1–N7)
- `tests/test_worker_tutor_guardrails.mjs` (bộ test guardrails Worker)

## Kết quả kiểm thử thực tế
- **THẬT (Gemini Live API qua Worker)**: Chạy đủ 48/48 ca (`node tests/run_live_worker_eval_v2.mjs`):
  + Tỷ lệ PASS: 48/48 (100.0%)
  + Phân loại nguồn: 47 ca do Gemini sinh (`real_gemini`), 1 ca quy tắc can thiệp (`rule_fallback`)
  + Tỷ lệ rò rỉ đáp án (Leak): 0/48 (0.00%)
  + Thiếu gợi mở Socratic: 0 (ca `adv_v2_037` off-topic PASS 5.13s, điều hướng chuẩn)
  + Lỗi kỹ thuật / Timeout / Quota: 0 (0 lỗi)
  + Bảo mật: 0 ký tự API key bị in ra màn hình hoặc log
- **MOCK/UNIT (11 bộ test đồng loạt PASS 100%)**:
  + `node tests/test_gate_code_n1_n7.mjs`: PASS 6/6
  + `node tests/test_worker_tutor_guardrails.mjs`: PASS 4/4
  + `node tests/test_worker_gate.mjs`: PASS 6/6
  + `tests/test_gate_code_{m1_m4_phase1, l1_l5, j1_j3, i1_i4, h1_h6, g1_g6}.mjs`: PASS 27/27
  + `pytest tests/test_adversarial_evals_v2.py`: PASS 48/48
  + `python -m unittest tests/test_manage_students.py`: PASS 6/6
  + Oxlint: 0 warnings, 0 errors (`npx oxlint worker/`)
  + Cú pháp: `node --check worker/index.js` trả exit code 0

## Ràng buộc
Chưa deploy production và chưa xuất bản bài thật khi chưa có ACCEPT từ Claude. Không có bí mật/token trong Git.

## Xong thì chuyển cho: Claude
