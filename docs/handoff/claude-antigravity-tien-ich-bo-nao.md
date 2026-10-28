# Bàn giao: Trò chơi câu hỏi (Tiện ích) + Bộ não AI trên VPS
Từ: Claude → Sang: Antigravity   Ngày: 28/10/2026
(Làm SAU bàn giao `claude-antigravity-4-tinh-nang-thi.md` nếu chưa xong — có thể gộp một lần dán Code.gs / publish luật / deploy Worker.)

## Đã đổi (Claude, đã test, đã push)
- Frontend:
  - `teacher-quiz.js` (menu **Tiện ích → Trò chơi câu hỏi**: soạn bộ câu hỏi, trình chiếu, xếp hạng, AI phân tích, CSV);
  - `quiz-play.js` (học sinh: thẻ "Vào chơi", màn chơi 4 ô màu);
  - `teacher-effect.js` (thẻ "Bộ não AI: báo cáo tuần");
  - `support-config.js` (Zalo mặc định).
- Luật `spike/step0/database.rules.ai-sgk-final.json`: thêm `quiz_key` (không ai đọc), `quiz_proof`, `quiz`, `quiz_lop`. Chỉ chủ phòng (gửi kèm khóa phòng trong cùng một lần ghi) mới điều khiển được phòng. Học sinh chỉ được vào phòng và trả lời một lần, đúng câu đang hỏi, trong thời gian cho phép.
- Worker:
  - `POST /api/teacher/ai-quiz` (phân tích trò chơi, không gửi tên học sinh);
  - tutor ghi câu hỏi rút gọn vào DO `brain_log` (3000 câu gần nhất, không ghi câu trả lời);
  - `GET /api/brain/export?since=` (header `X-Brain-Key` = secret `BRAIN_KEY`, tối thiểu 24 ký tự).
- Code.gs: action `brain_save` (VPS gửi báo cáo, khóa `BRAIN_KEY` trong Script Properties) và `gv_brain` (giáo viên xem, giáo viên lớp chỉ lớp mình); trang **NaoAI**; menu **Cài khóa Bộ não AI**.
- Python `brain/` (chỉ thư viện chuẩn), `brain/deploy/` (systemd service/timer, backup), hướng dẫn `docs/huong-dan-vps-bo-nao-ai.md`.
- Test PASS:
  - `tests/test_quiz_live.cjs` (2 trình duyệt, 29 ca), `tests/test_teacher_effect.cjs`, `tests/test_teacher_ai.mjs`, `tests/test_brain_export.mjs`, `tests/test_sheet_exam_gs.cjs`;
  - `python3 -m unittest discover -s brain/tests -t .` (7 ca, có chạy thử toàn bộ quy trình với máy chủ giả).

## Việc 1 — Emulator luật (BẮT BUỘC trước khi publish)
`cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-fast.test.mjs"` → **TẤT CẢ CA ĐÚNG**. Đã có 12 ca mới cho trò chơi (cập nhật nhiều nhánh bằng `update` với `quiz_proof`). Nếu ca "chủ phòng (khóa đúng) mở phòng" bị SAI: báo Claude, không tự nới luật.

## Việc 2 — Người dùng: Code.gs + luật (như bàn giao trước)
Dán Code.gs mới → Triển khai **Phiên bản mới** → menu **Tạo mẫu** → **Cập nhật lên Firebase** → Publish luật (sau Việc 1) → Ctrl+F5.

## Việc 3 — Deploy Worker
1. `npx wrangler deployments list` → ghi lại ID bản đang chạy.
2. Chạy test Worker → PASS.
3. Tạo khóa bằng `openssl rand -hex 24` → `npx wrangler secret put BRAIN_KEY` (dán khóa; KHÔNG ghi khóa vào Git/chat). Đưa khóa này cho người dùng điền vào `.env` trên VPS.
4. `npx wrangler deploy`.
5. Smoke test:
   - giáo viên → Tiện ích → tạo bộ 3 câu (thử AI soạn) → Trình chiếu;
   - điện thoại học sinh lớp đó thấy thẻ "Vào chơi" → chơi hết 3 câu;
   - giáo viên bấm "AI phân tích lớp hiểu bài" → có nhận xét;
   - `curl -H "X-Brain-Key: <khóa>" <WORKER_URL>/api/brain/export` trả `{"items":[...]}`; không có header thì 403.
6. Lỗi → `npx wrangler rollback <ID cũ>`.

## Việc 4 — Hướng dẫn người dùng cài VPS
Đi theo `docs/huong-dan-vps-bo-nao-ai.md` từ mục 0 đến mục 7, ngồi cùng người dùng qua SSH. Kiểm tra:
- `sudo -u brain python3 -m brain run --dry-run --env /opt/brain/.env` in được báo cáo;
- chạy thật thì Sheet có trang NaoAI và trang giáo viên → Hiệu quả hiện báo cáo;
- `systemctl list-timers brain.timer` có lịch 21:00.

## Không được làm
Không dán khóa nào (Database secret, BRAIN_KEY, khóa Bộ não AI của Sheet, Gemini) vào chat, Git, tệp bàn giao. Không mở thêm cổng trên VPS. Không publish luật khi emulator còn ca SAI.

## Xong thì chuyển cho: Người dùng (thử trò chơi trên lớp thật với 2–3 điện thoại) → Claude (nếu lỗi)
