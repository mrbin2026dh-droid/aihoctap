# Claude → Antigravity: Luyện tập — đếm ngược 3·2·1, thiết kế lại màn công bố / xếp hạng / vinh danh, sửa 401 & 502 (29/10 tối)

## 0. Lỗi thầy chụp màn hình lúc 16:00 và nguyên nhân
| Lỗi | Nguyên nhân | Ai sửa |
|---|---|---|
| `401` khi đọc/ghi `ai-sgk-tinhoc-default-rtdb…/quiz_bo/<64 ký tự>.json` | **Luật Firebase có nhánh `quiz_bo` CHƯA được Publish** (báo cáo trước ghi "Thầy dán…", nhưng chưa ai đăng). Thẻ bộ câu hỏi vì vậy ghi "Chưa đồng bộ lên mạng được". | **Antigravity đăng luật** (mục 2) |
| `502` ở `/api/teacher/ai-quiz` | Worker gọi Gemini với `maxOutputTokens: 2048`; model có suy luận dùng hết lượt chữ → JSON rỗng → "AI chưa phân tích được". | Claude đã sửa thành 8192 (chờ deploy). Ngoài ra máy giáo viên giờ **luôn có nhận xét tính sẵn** khi AI lỗi. |
| Màn kết thúc xấu (ô vàng lẻ loi, bảng xếp hạng thành các ô "Hạng/Học sinh/Điểm…", bảng "Lớp có hiểu bài không?" thành các ô hồng) | Dùng bảng `t-table` của trang quản trị; trong màn chiếu nó tự chuyển sang kiểu thẻ di động. | Claude đã viết lại toàn bộ (mục 1) |
| Học sinh 0 điểm 0/5 | Cần thầy cho biết em có bấm chọn không. Luật ghi trả lời đúng; kiểm thử 2 học sinh ghi điểm bình thường. **Antigravity kiểm lại trên https ở mục 4.** | Antigravity kiểm |

## 1. Claude đã làm (đã đẩy lên `main`)
- Tệp mới `frontend/hoc/quiz-fx.js`: đếm ngược 3·2·1·"Bắt đầu!", âm thanh **tự tổng hợp bằng Web Audio** (không dùng tệp nhạc có bản quyền; máy chiếu mặc định bật, điện thoại học sinh mặc định tắt, có nút Bật/Tắt tiếng), pháo giấy. Tôn trọng "giảm chuyển động". Đã thêm vào `sw.js` + `tools/package_student_pwa.py`.
- Luồng máy chiếu (`teacher-quiz.js`):
  - Bấm **Bắt đầu** → ghi `pub.phase='ready'` → máy chiếu và mọi điện thoại cùng đếm ngược → câu 1.
  - Mỗi câu: câu hỏi trong thẻ trắng lớn, đồng hồ vòng (5 giây cuối đổi đỏ, đập nhịp, tiếng tích).
  - Công bố: **biểu đồ cột** số em chọn từng phương án, cột đúng có ✓, phương án sai mờ đi, "1/2 em trả lời đúng (50%)".
  - **Bảng xếp hạng** (màn riêng, như trình tự Kahoot công bố: kết quả câu → bảng 5 bạn dẫn đầu): hạng, chữ cái đầu tên, điểm vừa nhận, ▲ lên hạng, nhãn "Chuỗi N", lời khen khi có chuỗi đúng từ 3 câu hoặc vượt từ 3 hạng.
  - **Bục vinh danh**: hạng 3 → hạng 2 → tiếng trống → quán quân + pháo giấy + nhạc (Kahoot công bố: top 3 được vinh danh lần lượt).
  - **Kết quả chi tiết**: 4 ô tóm tắt, 4 thẻ danh hiệu, bảng xếp hạng có thanh tỉ lệ đúng, từng câu có **thanh phân bố lựa chọn** (đáp án đúng viền trắng) và "nhiều em nhầm sang…", AI phân tích (lỗi thì có nhận xét tính sẵn), CSV, nút quay lại bục vinh danh.
- Điện thoại học sinh (`quiz-play.js`): đếm ngược; màn đúng (xanh) / sai (đỏ) / chưa trả lời (xám) có biểu tượng lớn, "+990 điểm", chuỗi đúng, "Em đang hạng 2/30"; kết thúc có bục vinh danh 3 bậc, pháo giấy khi em vào top 3.
- `quiz-core.js` thêm `classSummary()` (nhận xét tính sẵn). Worker: `ai-quiz` `maxOutputTokens` 2048 → 8192.
- Kiểm thử: `test_quiz_core` 17 ca, `test_quiz_live` 51 ca (đếm ngược 2 phía, biểu đồ, bảng xếp hạng, chuỗi đúng, bục vinh danh hiện tuần tự, chi tiết, AI lỗi 502 vẫn có nhận xét), `test_student_ui_standard` 0 vi phạm, `test_teacher_ui_standard` 0 vi phạm.

## 2. Antigravity: đăng luật Firebase (BẮT BUỘC, tự làm)
1. `git pull`.
2. Firebase Console → dự án `ai-sgk-tinhoc` → Realtime Database → Rules → dán toàn bộ `spike/step0/database.rules.ai-sgk-final.json` → **Publish**.
3. Kiểm ngay (đường dẫn 64 ký tự giả, không phải của thầy):
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app/quiz_bo/$(printf 'a%.0s' {1..64}).json"
# phải in 200 (trước khi đăng luật là 401)
curl -s -o /dev/null -w "%{http_code}\n" "https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app/quiz_bo.json"
# phải in 401 (không ai liệt kê được bộ câu hỏi của người khác)
```
Xong khi: 2 lệnh trên in đúng `200` và `401`; thẻ trong Tiện ích ghi "Bộ câu hỏi đã đồng bộ…".

## 3. Antigravity: deploy Worker
```bash
cd worker && npx wrangler deployments list | head -5   # ghi ID bản đang chạy để rollback
node ../tests/test_teacher_ai.mjs && node ../tests/test_agent_bridge.mjs
npx wrangler deploy
```
Xong khi: deploy xong, ghi ID mới + ID cũ vào báo cáo; bấm "AI phân tích lớp hiểu bài" sau một buổi thử ra nhận xét của AI (không còn 502).

## 4. Antigravity: thử thật trên https (tài khoản "[THỬ]", không dùng học sinh thật)
1 máy chiếu 1280×800 + 2 điện thoại (2 lớp). Bộ 3 câu. Ghi từng mục ĐẠT / KHÔNG ĐẠT:
- [ ] Bấm Bắt đầu: máy chiếu và 2 điện thoại cùng hiện 3 · 2 · 1 · Bắt đầu!, lệch nhau ≤ 1 giây.
- [ ] Câu 1: em A chọn đúng, em B chọn sai → máy chiếu "2/2 em đã trả lời" → tự công bố; **em A được 500–1000 điểm** (nếu 0 điểm: ghi lại mã lỗi trong F12 của điện thoại).
- [ ] Biểu đồ cột đúng số em; cột đúng có ✓.
- [ ] Bảng xếp hạng: em A đứng đầu, có "+điểm".
- [ ] Câu 2: Tạm dừng / Tiếp tục; Hiện đáp án sớm.
- [ ] Kết thúc: hạng 2 hiện trước, quán quân hiện sau, có pháo giấy; "Xem kết quả chi tiết" đủ danh hiệu, bảng xếp hạng, thanh phân bố.
- [ ] Âm thanh máy chiếu nghe được; nút Tắt tiếng hoạt động; điện thoại im lặng cho đến khi em bấm Bật tiếng.
- [ ] F12 cả 3 máy: 0 lỗi đỏ.

## 5. Antigravity: quan sát Kahoot / Quizizz để Claude tinh chỉnh (thầy yêu cầu "cấm đoán mò")
Tài liệu công khai của Kahoot chỉ mô tả **trình tự** (kết quả câu → bảng 5 bạn dẫn đầu → bục vinh danh top 3; lời khen khi có chuỗi đúng hoặc vượt từ 3 hạng). **Không có số đo bố cục, thời lượng, hiệu ứng.** Cần quan sát thật:
1. Thầy (hoặc Antigravity với tài khoản miễn phí do thầy tạo) mở **một trò chơi Kahoot** và **một trò chơi Quizizz/Wayground** chế độ trực tiếp, 2 thiết bị người chơi.
2. Ghi vào `docs/nghien-cuu/kahoot-quizizz-quan-sat-man-hinh.md` bảng sau cho **từng màn** (phòng chờ, chuẩn bị/đếm ngược, câu hỏi, công bố, bảng xếp hạng, bục vinh danh, màn người chơi đúng/sai, màn người chơi cuối):

| Màn | Thời lượng (giây) | Những gì hiện (vị trí trên/giữa/dưới) | Hiệu ứng chuyển động | Âm thanh (có/không, lúc nào) | Nút giáo viên |
|---|---|---|---|---|---|

3. Đo: đếm ngược trước câu 1 là mấy số, mỗi số bao lâu; có màn giới thiệu câu trước khi hiện phương án không, bao lâu; bảng xếp hạng hiện mấy người; bục vinh danh hiện thứ tự nào, cách nhau bao lâu.
4. **Cấm:** chụp màn hình đưa vào repo, chép mã, tải âm thanh/hình ảnh/phông của Kahoot, Quizizz. Chỉ ghi mô tả bằng chữ và số đo.

Xong khi: tệp nghiên cứu có đủ bảng cho cả 2 ứng dụng. Claude sẽ dùng số đo đó chỉnh `quiz-fx.js` và `teacher.css`.

## 6. Kế hoạch tab Thảo luận (kiểu Mentimeter)
Claude đã lập `docs/ke-hoach/thao-luan-menti.md`. **Chưa code**, chờ thầy duyệt; Antigravity không cần làm gì ở mục này.

## 7. Báo cáo
Ghi `docs/handoff/antigravity-claude-luyen-tap-hieu-ung-xong.md` (kết quả mục 2–5, ID Worker cũ/mới). Không ghi tên/mã học sinh thật, không ghi khóa bí mật.
