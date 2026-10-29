# Kế hoạch H5: Tiện ích → tab "Thảo luận" (kiểu Mentimeter), quy trình giống Luyện tập

Người lập: Claude, 29/10/2026. Trạng thái: **KẾ HOẠCH, chưa code.** Làm sau ngày 30/10, khi thầy duyệt.

Nguồn đã đọc (tài liệu công khai, không dịch ngược, không chép mã/giao diện):
- Mentimeter, Word Cloud: help.mentimeter.com/en/articles/410469-word-cloud
- Mentimeter, gỡ ý kiến khỏi Word Cloud / Open Ended: intercom.help/mentimeter/en/articles/2780529
- Mentimeter, bộ lọc từ ngữ: help.mentimeter.com/en/articles/1649840
- Báo cáo nghiên cứu của Antigravity: `docs/nghien-cuu/quizizz-menti-tinh-nang.md`

## 1. Điều đã xác minh từ tài liệu Mentimeter (dùng làm chuẩn)
| Điểm | Mentimeter làm gì | Ta áp dụng |
|---|---|---|
| Đám mây từ khóa | Ý kiến hiện tức thì; từ được gửi nhiều thì to hơn; chữ thường để gộp trùng; tối đa 400 từ khác nhau; nên ≤ 25 ký tự; giáo viên đặt số lần gửi mỗi người | Giống: ≤ 25 ký tự, gộp chữ thường + bỏ khoảng trắng thừa, mỗi em 1–3 từ |
| Câu trả lời mở | Dùng cho câu dài hơn | ≤ 200 ký tự |
| Gỡ ý kiến | Giáo viên ẩn/xóa sau khi đã hiện; ẩn một ý thì ẩn mọi ý giống hệt; ý bị ẩn vẫn còn trong kết quả | Giống, **và thêm "duyệt trước khi hiện"** (bắt buộc với học sinh THCS) |
| Bộ lọc từ ngữ | Danh sách từ theo ngôn ngữ; không bắt hết; vẫn cần gỡ tay | Danh sách từ tiếng Việt (có/không dấu, viết lách luật) + gỡ tay + tùy chọn AI kiểm duyệt |
| Đóng nhận ý kiến | Giáo viên đóng/mở nhận ý kiến | Nút "Dừng nhận ý kiến / Mở lại" |

## 2. Quy trình (giống hệt Luyện tập)
1. **Giáo viên → Tiện ích → tab Thảo luận → Tạo bộ thảo luận**
   - Tên bộ, chọn một hoặc nhiều lớp (dùng lại `#qz-lops`), danh sách "trang" (mỗi trang một câu hỏi), mỗi trang chọn loại:
     - **Đám mây từ khóa**: số từ mỗi em (1–3).
     - **Câu trả lời mở**: có/không duyệt trước khi hiện (mặc định: có).
     - **Bình chọn**: 2–6 phương án, không có đáp án đúng, biểu đồ cột.
     - **Thang đo 1–5**: nhiều tiêu chí, hiện điểm trung bình.
     - **Hỏi đáp**: học sinh gửi câu hỏi, các bạn bấm "Cùng thắc mắc".
   - Soạn bằng AI (gợi ý câu hỏi thảo luận theo bài học) hoặc nhập tay; tải Excel (cột: STT, Loại, Câu hỏi, Phương án 1–6, Số từ).
   - Lưu: trên máy + đồng bộ `tl_bo/{mã băm 64}` (như `quiz_bo`). Thẻ có **Mở thảo luận**, Sửa, Xóa (xác nhận).
2. **Trên lớp: Mở thảo luận** → phòng chờ (mã 6 số, tên em đã vào) → **Bắt đầu** (đếm ngược 3·2·1 dùng `quiz-fx.js`).
3. **Mỗi trang**: máy chiếu hiện câu hỏi + kết quả cập nhật trực tiếp; giáo viên có: Dừng nhận / Mở lại, Ẩn kết quả (để học sinh không bị ảnh hưởng), Duyệt / Ẩn từng ý, Trang trước / Trang sau, Tạm dừng, Kết thúc.
4. **Học sinh → mục Luyện tập** (thẻ "Thảo luận đang mở" cạnh thẻ luyện tập; một chỗ duy nhất, không thêm mục mới): vào phòng → gõ ý kiến / chọn → "Đã gửi". Trên màn chiếu **không hiện tên** (ẩn danh như Menti); giáo viên xem được tên ở bảng duyệt để nhắc nhở.
5. **Kết thúc**: tổng hợp từng trang (đám mây, biểu đồ, ý đã duyệt), **AI gom cụm ý kiến** (2–4 nhóm ý chính, hiểu lầm phổ biến; gửi AI không kèm tên), tải CSV, lịch sử buổi.

## 3. Dữ liệu Firebase (theo mẫu `quiz*` đã chạy ổn)
```
tl_key/{phòng}          bí mật phòng (không ai đọc)       ← như quiz_key
tl_proof/{phòng}        bằng chứng đổi mỗi lần ghi        ← như quiz_proof
tl_lop/{lớp}            mã phòng đang mở cho lớp          ← như quiz_lop
tl_bo/{chủ 64 hex}/{id} bộ thảo luận của giáo viên         ← như quiz_bo
tl/{phòng}/pub          {phase: lobby|ready|open|closed|pause|end, i, slide:{k,type,text,opts,max}, hide, an:{ý bị ẩn}}
tl/{phòng}/ds/{mã}      {ten, at}
tl/{phòng}/y/{k}/{mã}/{n}   {v: chữ ≤ 25|200 / số / phương án, t}   n < số từ cho phép
tl/{phòng}/duyet/{k}/{id}   true|false (chỉ máy giáo viên ghi)
tl/{phòng}/hoi/{id}     câu hỏi của học sinh; tl/{phòng}/vote/{id}/{mã}: true
```
Luật: học sinh chỉ ghi `y/{k}/{mã của mình}` khi `pub.phase==='open'` và `pub.slide.k===k`, độ dài đúng loại, mỗi ô ghi một lần; chỉ máy có khóa phòng ghi `pub`, `duyet`, `an`.

## 4. Kiểm duyệt nội dung (bắt buộc vì học sinh THCS)
1. Trên máy học sinh: chặn gửi nếu trùng danh sách từ cấm (so sau khi bỏ dấu, gộp ký tự lặp, đổi số thành chữ: 0→o, 1→i, 3→e, 4→a, 5→s).
2. Câu trả lời mở: mặc định chỉ hiện sau khi giáo viên bấm Duyệt (có "Duyệt tất cả").
3. Gỡ tay: ẩn một ý thì ẩn mọi ý giống hệt (như Menti), ý ẩn vẫn còn trong kết quả của giáo viên.
4. Tùy chọn AI kiểm duyệt qua Bộ não VPS (`/moderate`, gửi chữ không kèm tên) khi lớp đông.
5. Danh sách từ cấm: tệp `frontend/hoc/tl-tu-cam.js`, giáo viên thêm từ ở giao diện (lưu `tl_bo/{chủ}/_tu_cam`).

## 5. Tệp dự kiến
- Mới: `frontend/hoc/tl-core.js` (thuần: gộp từ, đếm, lọc từ cấm, đọc Excel, tổng hợp), `frontend/hoc/teacher-tl.js` (giáo viên), `frontend/hoc/tl-play.js` (học sinh), `tests/test_tl_core.mjs`, `tests/test_tl_live.cjs`.
- Sửa: `teacher.html` (tab Luyện tập | Thảo luận trong Tiện ích, `role="tablist"`), `teacher.css`, `styles.css`, `app.js` (thẻ thảo luận trong mục Luyện tập), `sw.js` + `tools/package_student_pwa.py`, luật Firebase (`tl*`), Worker `/api/teacher/ai-tl` (gom cụm), agent `/moderate` (tùy chọn).
- Dùng lại: `quiz-fx.js` (đếm ngược, âm thanh), mẫu ghi `write()` có `quiz_proof`, `confirmBox`, `ui.iconButton`.

## 6. Các bước và tiêu chí xong
| Bước | Việc | Xong khi |
|---|---|---|
| 1 | `tl-core.js` + test thuần (gộp từ, lọc từ cấm có dấu/không dấu, Excel) | `test_tl_core` xanh, ≥ 20 ca |
| 2 | Luật Firebase `tl*` + test luật (học sinh không ghi pub, không ghi khi đóng, không ghi thay bạn) | test luật xanh |
| 3 | Giáo viên: tab, soạn, lưu/đồng bộ, Sửa/Xóa có xác nhận | test DOM soạn–lưu–xóa |
| 4 | Phòng: chờ → đếm ngược → trang đám mây / mở / bình chọn / thang đo / hỏi đáp; duyệt, ẩn, dừng nhận | `test_tl_live`: 1 GV + 2 HS khác lớp chạy đủ 5 loại |
| 5 | Kết thúc: tổng hợp, AI gom cụm (không gửi tên), CSV, lịch sử | test kiểm payload AI không có tên |
| 6 | Kiểm chuẩn UI (`test_teacher_ui_standard`, `test_student_ui_standard`), PWA stamp | 0 vi phạm |
| 7 | Antigravity thử thật trên https với tài khoản "[THỬ]" | báo cáo đo đạc, 0 lỗi Console |

Ước lượng: bước 1–2 nửa ngày; bước 3–5 một đến hai ngày; bước 6–7 nửa ngày.

## 7. Rủi ro và cách xử lý
- **Ngôn từ không phù hợp lên màn chiếu** → duyệt trước khi hiện (mặc định), danh sách từ cấm, ẩn danh trên màn chiếu nhưng giáo viên biết tên.
- **Lớp đông, nhiều ý** → đám mây chỉ vẽ 100 từ nhiều nhất; danh sách ý mở phân trang.
- **Mạng trường chập chờn** → học sinh gửi lại được khi chưa có xác nhận; ý chỉ ghi một lần (luật `!data.exists()`).
- **Bản quyền** → không chép giao diện, biểu tượng, âm thanh của Mentimeter; chỉ học quy trình đã công bố.
