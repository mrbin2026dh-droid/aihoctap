# Claude → Antigravity: sửa 4 lỗi học bài (Gia sư lạc bài, đánh dấu đã đọc, mở bài ở cuối, ký tự lạ) — 29/10 tối

## 1. Nguyên nhân và cách sửa (Claude đã làm, đã đẩy)
| Lỗi thầy chụp | Nguyên nhân | Đã sửa |
|---|---|---|
| H1. Học sinh gõ "KKKKKKKKKK", Gia sư trả câu "không thể cung cấp đáp án" | Prompt chỉ có 2 lối: lạc đề hẳn (bóng đá…) hoặc xin đáp án; câu vô nghĩa rơi vào lối "xin đáp án". Gia sư không được biết tên bài và các mục của bài để gợi ý. | Worker: `isGibberish()` nhận câu linh tinh → trả lời ngay **không gọi AI, không trừ lượt**: "Em đang học bài **…**, bài có các nội dung: …" + 2–3 nút gợi ý câu hỏi. Câu hỏi thật nhưng lạc bài: prompt có mục **BÀI EM ĐANG HỌC** (tên bài + các mục chính `lessonOutline()`) và dặn từ chối khéo, gợi ý nội dung bài, cấm dùng câu "không thể cung cấp đáp án". App: hiện nút gợi ý, bấm là hỏi luôn. |
| H2. Đọc xong bài, ra danh sách không biết đã học chưa | % đọc chỉ lưu để hiện trong bài, danh sách bài và Tiến độ không đọc tới. | Danh sách bài: nhãn **"Đã đọc hết" / "Đã đọc 40%"**. Tiến độ: dòng **"Học bài: đã đọc hết / đã đọc N% / chưa đọc"** tách riêng với "Bài tập: …"; bài chỉ đọc mà đọc hết thì vòng có dấu ✓. Đổi máy: lấy % từ Firebase `doc_read` một lần mỗi phiên. |
| H4/H5. Mở bài là ở cuối bài | `openLesson` không cuộn lên đầu → giữ vị trí cuộn của danh sách bài. Hệ quả nặng hơn: thanh đọc tính "đã đọc hết" ngay khi mở (vì đáy màn hình đã ở cuối bài) → số liệu đọc bài của giáo viên bị sai. | `window.scrollTo(0, 0)` khi mở bài. Kiểm thử: mở bài từ cuối danh sách → ở đầu bài, chưa bị tính đọc hết. |
| H5. "| :--- | :--- |", "$\rightarrow$" hiện nguyên văn | Bộ hiển thị Markdown cũ chỉ hiểu tiêu đề, **đậm**, trích dẫn 1 dòng. Dữ liệu bài có 48 dòng bảng, 230 gạch đầu dòng, 130 dòng lồng, 72 dòng đánh số, 32 chữ nghiêng, 38 mã, 22 công thức `$…$`. | `renderMarkdown` mới (vẫn không dùng innerHTML): bảng (căn lề theo `:---:`), danh sách lồng nhau + đánh số, *nghiêng*, `mã`, công thức → ký tự (→, ×, ≤, phân số, x²…), trích dẫn nhiều dòng, liên kết chỉ https, hình → chú thích. |

**Tệp:** `worker/index.js` (`lessonOutline`, `isGibberish`, `offTopicReply`, tutor route, prompt), `frontend/hoc/dom.js` (`renderMarkdown`, `inlineMarkdown`, `texToText`), `app.js`, `read-progress.js` (`readPct`, `syncFromServer`), `styles.css`, `whats-new.json`, `sw.js` (dấu).
**Kiểm thử mới:** `tests/test_markdown_render.cjs` (9), `tests/test_read_status.cjs` (8), `tests/test_tutor_offtopic.mjs` (6). Hồi quy PASS: tutor_accuracy 17, tutor_grounding, tutor_questions, tutor_auto_lesson 11, worker_tutor_guardrails, offline_learning 7, lesson_ai_docs_ui 51, student_ui_standard 0, quiz_live 53, tl_live 51, pwa_update_integrity 7/7, auto_update_login 15.
Luật `tl*`: Claude kiểm trên trình duyệt thật đã có hiệu lực (tl_bo con 200, cha 401, tl_key 401).

## 2. Antigravity làm
1. `git pull`; chạy 3 kiểm thử mới + `node tests/test_worker_tutor_guardrails.mjs` + `node tests/test_tutor_accuracy.mjs`.
2. **Deploy Worker** (Gia sư lạc bài): ghi ID cũ để rollback → `npx wrangler deploy`.
3. Thử thật trên https bằng tài khoản học sinh "[THỬ]" (máy tính + 1 điện thoại thật):
   - [ ] Danh sách bài cuộn xuống, mở bài cuối → bài hiện từ đầu.
   - [ ] Bài "Thông tin trong giải quyết vấn đề": bảng tiêu chí hiện thành bảng, không còn "| :--- |".
   - [ ] Đọc hết bài → về danh sách thấy "Đã đọc hết"; Tiến độ thấy "Học bài: đã đọc hết".
   - [ ] Gia sư: gõ "KKKKKKKKKK" → câu trả lời nêu tên bài + nút gợi ý, **số lượt không giảm**; hỏi "Đội bóng nào vô địch World Cup?" → AI nói em đang học bài gì và gợi ý nội dung bài.
4. Ghi `docs/handoff/antigravity-claude-hoc-bai-xong.md` (ghi rõ thử bằng thiết bị thật nào; không dùng kịch bản giả lập để báo đạt).
