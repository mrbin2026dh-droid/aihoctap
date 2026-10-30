# Claude → Antigravity: sửa lỗi Thảo luận "đã gửi mà màn không báo" và Luyện tập trực tiếp F5 (30/10/2026 trưa)

## Lỗi thầy báo (sáng 30/10, 3 lớp thật)
Một số máy: học sinh gửi ý kiến ở Thảo luận nhưng màn hình không báo đã gửi; bấm F5 mới thấy "Em đã gửi".

## Nguyên nhân (đã tái hiện bằng test, FAIL trước khi sửa)
`frontend/hoc/tl-play.js`, hàm `draw()`: có chặn "em đang gõ dở thì không vẽ lại" (con trỏ đang ở ô nhập).
- Em gõ xong bấm **Enter**, hoặc chạm nút **Gửi** trên iPhone/iPad (Safari không chuyển con trỏ sang nút). Con trỏ vẫn nằm trong ô nhập.
- Gửi lên máy chủ thành công, nhưng lần vẽ lại bị chặn. Màn vẫn hiện ô nhập cũ. F5 thì đọc lại từ máy chủ nên thấy đã gửi.

Lỗi cùng chỗ: ở trang **Hỏi đáp**, bạn khác gửi câu hỏi hoặc thầy duyệt thì màn vẽ lại, **mất chữ em đang gõ dở**.

Lỗi tương tự ở **Luyện tập trực tiếp** (`quiz-play.js`):
- F5 giữa câu thì mất đáp án đã chọn. Em bấm lại thì máy chủ từ chối, báo "Hết giờ".
- Gửi lỗi (mạng chậm) thì vẫn hiện "đã chọn". Lúc công bố đáp án báo "Chính xác!" nhưng không được điểm.

## Đã sửa
- `tl-play.js`: `draw(force)`. Sau khi chính em gửi xong thì luôn vẽ lại. Khi vẽ lại do dữ liệu của bạn khác thì giữ nguyên chữ em đang gõ và vị trí con trỏ.
- `quiz-play.js`:
  - Vào lại phòng thì đọc câu trả lời em đã ghi (`asked`).
  - Gửi lỗi: nếu máy chủ đã có câu trả lời thì hiện đúng đáp án đó; nếu chưa có thì bỏ chọn và báo "Em chọn lại nhé".
- Test mới:
  - `tests/test_tl_live.cjs`: bấm Enter; gửi mà con trỏ ở ô nhập (giống iPhone); hỏi đáp giữ chữ gõ dở.
  - `tests/test_quiz_live.cjs`: F5 giữa câu.
- Kết quả: TL LIVE OK 56, QUIZ LIVE OK 54, chuẩn UI học sinh 0 vi phạm, PWA P1–P7.

## Việc của Antigravity
1. `git pull`, deploy Pages (`frontend/hoc`). Chỉ đổi giao diện học sinh; `sw.js` đã đóng dấu lại.
2. Thử thật với 2 tài khoản THỬ lớp 9TH (không dùng tài khoản học sinh thật). Một máy dùng điện thoại hoặc khổ 390 px.
   - Mở một Thảo luận cho lớp 9TH. Em 1 gõ từ khóa rồi bấm **Enter** → phải hiện ngay "Em đã gửi" kèm từ khóa, không F5.
   - Trang Hỏi đáp: em 2 đang gõ dở, em 1 gửi câu hỏi và thầy duyệt → chữ em 2 vẫn còn.
   - Luyện tập trực tiếp: em chọn đáp án, F5, vào lại phòng → vẫn thấy đáp án đã chọn, không bấm lại được.
3. Chụp ảnh từng bước và phân tích ảnh. Báo cáo `docs/handoff/antigravity-claude-thao-luan-gui-xong.md`, commit và push lên GitHub. Cập nhật `aisgk.md`.
