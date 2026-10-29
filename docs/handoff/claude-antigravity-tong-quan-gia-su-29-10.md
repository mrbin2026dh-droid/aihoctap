# Claude → Antigravity: Tổng quan theo lớp, khung tải trang học sinh, Gia sư chỉ trả lời trong bài (29/10 tối, đợt 2)

## 1. Phân tích và đã sửa (Claude, đã đẩy)
| Thầy báo | Nguyên nhân | Đã sửa |
|---|---|---|
| H1. Đăng xuất xong bảng Cài đặt vẫn hiện | Bảng `#nav-profile` là popover; nút mở bị ẩn nhưng popover không tự đóng. | `updateAuth()` (teacher.js) gọi `hidePopover()` khi không còn đăng nhập. Test FAIL-first trong `test_teacher_overview`. |
| H2/H3. "Học sinh đọc bài" đủ lớp, Tổng quan thiếu lớp | Tổng quan lấy lớp từ **bài nộp** (`data.classes`): lớp chưa nộp bài thì không có. "Đọc bài" lấy từ **sĩ số** `thi_hs`. | Tổng quan lấy lớp từ `thi_hs` (như Đọc bài), ghi sĩ số "(34 em)", cộng thêm lớp chỉ có trong bài nộp. |
| H4. Thống kê chưa logic | Mặc định "Tất cả các lớp" trộn khối; số liệu không có mẫu số ("2 học sinh đã làm" mà không biết lớp bao nhiêu em); hai ô chọn lớp ở hai thẻ. | **Một ô chọn lớp** ở đầu trang (bỏ "Tất cả các lớp", mặc định lớp đông nhất của khối cao nhất), thẻ "Học sinh đọc bài" đi theo ô này. 5 mục đánh số: 1. Tham gia (đã làm x/N, chưa làm), 2. Mức nắm bài (Tốt/Củng cố/Yếu/**Chưa làm**, tổng = sĩ số), 3. Kết quả theo bài (đã làm x/N), 4. Kiến thức cần củng cố (chủ đề + câu sai), 5. Từng học sinh (lọc thêm "Chưa làm" có tên). Đổi lớp → mọi mục tính lại. Môn: ô "Môn" hiện khi lớp có ≥ 2 môn. |
| H5. Vừa đăng nhập, biểu tượng xoay hiện một mình trên vùng trống | `progress()` (app.js) đặt nút đồng bộ đang xoay lên đầu trang trước khi có nội dung. | Lần tải đầu: **khung xương** đúng bố cục (lời chào, vòng lộ trình, 4 ô), nút đồng bộ ẩn đến khi nội dung xong; tôn trọng giảm chuyển động. |
| H6. Gia sư vẫn giảng "Python là gì" khi bài không có | Quy tắc cũ cho phép "kiến thức Tin học cơ bản mà tài liệu chưa có thì giải thích ngắn" → AI tự giảng ngoài sách. | Quy trình mới, áp dụng cho mọi câu khi có bài học: AI trả **JSON `{pham_vi, tra_loi}`** (`responseSchema`). `bai_nay` → hướng dẫn theo tài liệu; `bai_khac` → định hướng 1–2 câu + nút "Mở bài"; `ngoai_bai` → **máy chủ bỏ chữ AI viết**, gửi lời từ chối cố định (`outOfScopeReply`), nêu bài đang học + 3 gợi ý, **hoàn lượt**; lần ngoài bài liên tiếp từ chối ngắn hơn (`off_streak`). Quy tắc "KHÔNG BỊA": mọi thông tin phải lấy từ tài liệu gửi kèm, không đủ căn cứ thì `ngoai_bai`. Xin đáp án / hỏi bài đang làm luôn là `bai_nay` (từ chối đáp án, gợi ý cách nghĩ). Chấm tự luận: ý thiếu chỉ nêu mảng kiến thức, không nêu nội dung đáp án. |

Rà soát mọi luồng AI học sinh thấy: Gia sư (bài học), Nhận xét thi thử (`buildExamReviewPrompt` – đã cấm đáp án), Chấm tự luận (`buildEssayGradePrompt` – đã sửa). Các luồng giáo viên (soạn đề, gợi ý thảo luận, tổng hợp) không trả lời học sinh.

**Kiểm thử (đã chạy, PASS):** `test_tutor_offtopic` 14, `test_tutor_grounding`, `test_tutor_questions`, `test_tutor_accuracy` 17, `test_tutor_auto_lesson` 11, `test_tutor_exam_review`, `test_worker_tutor_guardrails`, `test_teacher_overview` (viết lại theo lớp + H1), `test_teacher_thi_ui` 139, `test_loading_states` 11, `test_auto_update_login` 15, `test_pwa_update_integrity`, `test_role_isolation`, `test_tl_live` 52, `test_quiz_live` 53, `test_read_status` 8.
**Chưa kiểm được:** chất lượng phân loại phạm vi của Gemini thật (cần Worker đã deploy + khóa thật).

## 2. Antigravity làm
1. `git pull`; chạy các test trên.
2. **Deploy Worker** (ghi ID cũ để `wrangler rollback`): Gia sư JSON phạm vi + lọc khối/môn Tổng quan.
3. Thử thật https, tài khoản "[THỬ]", máy thầy + 1 điện thoại thật. Gia sư đang mở bài "Thực hành: Sử dụng công cụ trực quan trình bày thông tin":
   - [ ] "Lập trình Python là gì" → lời từ chối có tên bài, 3 gợi ý, "không trừ lượt"; số lượt KHÔNG giảm; không có câu giảng về Python.
   - [ ] Hỏi lại câu ngoài bài → câu từ chối ngắn, khác lần đầu.
   - [ ] "Đội bóng nào vô địch World Cup" → từ chối như trên.
   - [ ] Hỏi một khái niệm có trong bài → giải thích theo bài + 1 câu hỏi kiểm tra; số lượt giảm 1.
   - [ ] Hỏi kiến thức của bài khác cùng môn → định hướng + nút "Mở bài: …".
   - [ ] Đang làm câu trắc nghiệm, "câu này chọn gì" → từ chối đáp án, gợi ý cách nghĩ (không coi là ngoài bài).
   - [ ] Ghi 10 câu hỏi thử và phạm vi Gemini xếp (bảng: câu, mong đợi, thực tế) vào báo cáo.
4. Giáo viên: Tổng quan ô Lớp có đủ 9A9, 9A10, 8A7, 8A8 (kèm sĩ số); đổi lớp → 5 mục đổi theo; "Học sinh đọc bài" đổi theo cùng lớp; đăng xuất từ bảng Cài đặt → bảng đóng.
5. Học sinh đăng nhập: thấy khung xương rồi nội dung, không có biểu tượng xoay một mình.
6. Ghi `docs/handoff/antigravity-claude-tong-quan-gia-su-xong.md` (thiết bị thật nào, cách đo).

## 3. Mã mẫu chính (để đối chiếu)
- `worker/index.js`: `tutorScopeRules`, `parseTutorReply`, `outOfScopeReply`, `TUTOR_JSON_SCHEMA`; trong `/api/pwa/tutor`: `tutorJson`, `tutorGenCfg`, nhánh `parsed.scope === 'ngoai_bai'` (hoàn lượt + `driver: 'scope_rule'`).
- `frontend/hoc/teacher.js`: `loadRoster`, `overviewScope`, `fillOverviewClasses`, `syncReadClass`, `aSection`, `renderOverview` (mục 1–5).
- `frontend/hoc/app.js`: `progressSkeleton`, `tutorOffStreak` (`off_streak` gửi lên máy chủ).
