# Claude → Antigravity: tab "Thảo luận" kiểu Mentimeter (29/10 tối) — đã code xong, cần đăng luật + deploy Worker + thử thật

Kế hoạch gốc: `docs/ke-hoach/thao-luan-menti.md`. Quy trình giống hệt Luyện tập.

## 1. Đã làm (Claude, đã đẩy lên main)
**Giáo viên → Tiện ích → thẻ Thảo luận** (Tiện ích giờ có 2 thẻ: Luyện tập | Thảo luận, đổi bằng chuột hoặc phím mũi tên)
- Tạo bộ thảo luận: tên, **chọn một hoặc nhiều lớp**, từ cấm thêm; mỗi câu chọn 1 trong 5 loại:
  - **Đám mây từ khóa**: mỗi em 1–3 từ (≤ 25 ký tự), gộp chữ thường, từ gửi nhiều to hơn, giáo viên bấm một từ để ẩn (có xác nhận).
  - **Câu trả lời mở**: mỗi em 1 ý (≤ 200 ký tự); **duyệt trước khi hiện** bật sẵn; hàng chờ duyệt chỉ hiện chữ, bấm "Hiện tên" mới thấy ai gửi; Duyệt / Ẩn / Duyệt tất cả; ẩn một ý thì ẩn mọi ý giống hệt.
  - **Bình chọn**: 2–6 lựa chọn, biểu đồ thanh số em + %.
  - **Thang điểm 1–5**: 1–6 tiêu chí, điểm trung bình trên thước màu.
  - **Hỏi đáp**: mỗi em 1–3 câu hỏi, duyệt trước, các bạn bấm "Cùng thắc mắc" (▲), giáo viên đánh dấu "Đã trả lời".
- Nguồn câu hỏi: **AI gợi ý theo bài** (Worker `/api/teacher/ai-tl` mode `goi_y`), **tải Excel** (có file mẫu, báo dòng lỗi), tự thêm.
- Lưu trên máy + đồng bộ `tl_bo/{mã băm 64}`; thẻ có Mở thảo luận / Sửa / Xóa (xác nhận).
- **Mở thảo luận** → phòng chờ (mã 6 số, tên em đã vào) → **Bắt đầu** (đếm ngược 3·2·1) → từng câu: kết quả trực tiếp, "N/M em đã gửi"; nút Câu trước, **Dừng nhận / Mở lại**, **Ẩn / Hiện kết quả**, Câu tiếp theo, Kết thúc.
- **Kết thúc** (xác nhận): tổng kết từng câu, **AI tổng hợp ý kiến** (gom 2–4 nhóm ý chính; chỉ gửi chữ đã duyệt, **không gửi tên/mã**, không gửi ý đã ẩn); AI lỗi → tổng hợp tính sẵn; tải CSV (có tên, trạng thái duyệt/ẩn — chỉ trên máy giáo viên); lịch sử buổi.

**Học sinh → mục Luyện tập**: thẻ "Thảo luận đang mở" (hoặc thông báo nhỏ ở mục khác) → Vào phòng → gửi theo loại câu; **từ ngữ không phù hợp bị chặn ngay trên máy em** (bộ lọc tiếng Việt có dấu/không dấu, viết tắt, lách bằng số; không chặn nhầm "các", "lon nước", "con chó"); giáo viên vẫn duyệt tay vì bộ lọc nào cũng không bắt hết (Mentimeter cũng nói rõ điều này).

**Tệp**: mới `frontend/hoc/tl-core.js`, `teacher-tl.js`, `tl-play.js`, `tests/test_tl_core.mjs` (22), `tests/test_tl_ai.mjs` (8), `tests/test_tl_live.cjs` (51: 1 giáo viên + 2 học sinh khác lớp, đủ 5 loại câu, duyệt/ẩn, chặn từ ngữ, máy chủ chặn gửi quá số ý, dừng nhận, ẩn kết quả, AI không nhận tên, CSV, xóa). Sửa `teacher.html`, `teacher.css`, `styles.css`, `app.js`, `quiz-play.js` (thẻ trống chung), `teacher.js`, `sw.js` + `tools/package_student_pwa.py`, `whats-new.json`, `worker/index.js` (`/api/teacher/ai-tl`), luật Firebase (`tl_key`, `tl_proof`, `tl`, `tl_lop`, `tl_bo`).

## 2. Antigravity làm
1. `git pull`; chạy `node tests/test_tl_core.mjs`, `node tests/test_tl_ai.mjs`, `node tests/test_tl_live.cjs`, `node tests/test_quiz_live.cjs`.
2. **Đăng luật Firebase**: dán `spike/step0/database.rules.ai-sgk-final.json` → Publish. Kiểm:
```bash
B=https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app
curl -s -o /dev/null -w "%{http_code}\n" "$B/tl_bo/$(printf 'a%.0s' {1..64}).json"   # 200
curl -s -o /dev/null -w "%{http_code}\n" "$B/tl_bo.json"                              # 401
curl -s -o /dev/null -w "%{http_code}\n" "$B/tl_key.json"                             # 401
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -d '{"v":"x","t":1}' "$B/tl/123456/y/s0/hs01/0.json"   # 401 (phòng không mở)
```
3. **Deploy Worker** (thêm `/api/teacher/ai-tl`): ghi ID cũ để rollback, `node tests/test_teacher_ai.mjs && node tests/test_tl_ai.mjs`, `npx wrangler deploy`.
4. **Thử thật trên https** (tài khoản "[THỬ]"; 1 máy chiếu + 2 điện thoại THẬT ở 2 lớp — không dùng kịch bản giả lập để báo đạt):
   - [ ] Tạo bộ 5 câu (đủ 5 loại) → lưu → thẻ ghi "đã đồng bộ".
   - [ ] Mở thảo luận → 2 điện thoại thấy thẻ / thông báo → Vào phòng → Bắt đầu, cả 3 máy đếm ngược.
   - [ ] Đám mây: gõ "Internet" và "internet" → gộp một từ to; gõ "vcl" → bị chặn.
   - [ ] Câu mở: ý vào hàng chờ, chưa lên màn chiếu; Duyệt → hiện; Ẩn → biến mất.
   - [ ] Hỏi đáp: điện thoại B bấm ▲ câu của A → máy chiếu ▲ 1.
   - [ ] Kết thúc → AI tổng hợp ý kiến có nội dung; F12 cả 3 máy 0 lỗi đỏ.
   - Ghi máy nào trễ bao lâu (bấm giờ bằng gì), chữ nào bị cắt.
5. Ghi `docs/handoff/antigravity-claude-thao-luan-xong.md`. Không ghi tên/mã học sinh thật.
