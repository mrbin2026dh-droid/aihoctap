# Claude → Antigravity: chấm đỏ cập nhật, thống kê giáo viên nhiều lớp/môn, giao diện Thảo luận, Gia sư chỉ bài liên quan (29/10 tối)

## 1. Phân tích và đã sửa (Claude, đã đẩy)
| Thầy báo | Nguyên nhân | Đã sửa |
|---|---|---|
| H1. Chấm đỏ cập nhật xấu, thanh chạy ngang khó chịu | Chấm đỏ ở nền tối dùng màu #661e1e (đỏ sẫm, nhòe), có hiệu ứng "nhịp" vô hạn, biểu tượng cập nhật quay liên tục; thanh `net-bar` chạy ngang mép trên mỗi khi gọi máy chủ. | Chấm đỏ tĩnh 11px, viền bằng màu nền, đỏ tươi #dc2626 (tối: #f87171); biểu tượng không quay; nút có viền đỏ nhạt. Bỏ hẳn thanh chạy ngang (trạng thái "đang xử lý" vẫn có ở nút và khối tải). |
| H2. Tổng quan trộn mọi lớp/môn | Chỉ có ô "Lớp" phẳng; không lọc khối, không lọc môn. | Ô Lớp nhóm theo khối (có "Cả khối N"); thêm ô **Môn** (hiện khi có ≥ 2 môn). Worker `/api/pwa/teacher/analytics` nhận `?grade=` và `?course=`, trả `courses`. |
| H3. "Học sinh đọc bài" phải chọn từng bài, mặc định bài lớp 6 + "Tất cả lớp" → toàn số 0 | Chọn bài trước rồi mới chọn lớp; danh sách bài trộn mọi khối. | Chọn **Lớp → (Môn)** → **bảng tổng hợp mọi bài** của khối: đã đọc hết x/N, đang đọc, chưa đọc, thanh tiến độ lớp; bấm tên bài → bảng từng em. Mặc định khối/lớp đông học sinh nhất. |
| H4. Trình soạn Thảo luận xấu; AI gợi ý chỉ chọn 3/5/8 | Ô chọn loại + nút "Thêm trang" lệch hàng, chữ xuống dòng; ô tên cao hơn ô từ cấm (lưới kéo giãn). | Thanh "Thêm câu hỏi" gồm 5 nút loại câu; hàng riêng cho AI gợi ý / Excel; thẻ câu có viền màu theo loại; nhãn lựa chọn đồng đều; **ô nhập số câu (1–10)** có kiểm lỗi; sửa `.t-field` không kéo giãn. |
| H5. Hộp thoại xác nhận trên màn chiếu xấu | Nút nguy hiểm ở nền tối là hồng nhạt chữ trắng (tương phản thấp). | Nút nguy hiểm đỏ #b42318 chữ trắng (đạt AA). |
| H6. Câu cho 3 từ khóa chỉ có 1 ô | Ô nhập vẽ từng ô một. | Hiện **đủ số ô** (3 từ khóa → 3 ô; hỏi đáp 2 câu → 2 ô), gửi một lần, bỏ trùng. |
| H7. Màn học sinh/màn chiếu xấu; đám mây 1 từ rất nhỏ | Cỡ chữ đám mây tính theo (n−1) → khi mới có 1 từ thì nhỏ nhất. | Từ nhiều nhất luôn to nhất; màn học sinh có khung câu hỏi, ô nhập rõ, gợi ý ký tự. |
| Gia sư lặp "Phần này chưa có trong bài học, em hỏi thầy cô nhé" | Quy tắc căn cứ bắt AI nói câu đó với mọi câu ngoài tài liệu bài đang mở (vd "thông tin là gì" thuộc bài khác). | Máy gửi danh sách bài (có tên); Worker tìm bài khớp theo tên, tải thêm **1** bài, so nội dung; nếu bài kia khớp hơn → AI giải thích ngắn theo bài đó + app hiện nút **"Mở bài: …"**. Kiến thức Tin học cơ bản chưa có thì giải thích ngắn; câu "hỏi thầy cô" chỉ dùng khi ngoài môn Tin học, không lặp lại. |

**Kiểm thử:** `test_tutor_offtopic` 9, `test_weakness_analytics` (thêm lọc khối/môn), `test_teacher_thi_ui` 139 (bảng tổng hợp đọc bài theo khối/lớp), `test_teacher_overview`, `test_tl_live` 52 (nút thêm câu, nhiều ô nhập), `test_tl_core` 22, `test_loading_states` 11, `test_auto_update_login` 15, UI chuẩn giáo viên/học sinh 0 vi phạm, các test Gia sư cũ PASS.

## 2. Antigravity làm
1. `git pull`; chạy các test trên.
2. **Deploy Worker** (Gia sư chỉ bài liên quan + lọc khối/môn ở Tổng quan): ghi ID cũ → `npx wrangler deploy`.
3. Thử thật https (máy thầy + 1 điện thoại thật, tài khoản "[THỬ]"):
   - [ ] Điện thoại có bản mới: chấm đỏ tĩnh, rõ; không còn thanh chạy ngang mép trên.
   - [ ] Tổng quan: ô Lớp có nhóm "Khối 9/Khối 8", "Cả khối"; ô Môn hiện khi có nhiều môn.
   - [ ] Học sinh đọc bài: chọn lớp → bảng mọi bài; bấm bài → từng em.
   - [ ] Thảo luận: soạn bằng các nút "+ loại câu"; AI gợi ý nhập 4 câu → ra 4 câu; học sinh thấy 3 ô với câu 3 từ khóa.
   - [ ] Gia sư đang ở bài "Thế giới kĩ thuật số", hỏi "thông tin là gì" → có giải thích + nút "Mở bài: Thông tin và dữ liệu" (nếu bài đó có trong danh mục).
4. Ghi `docs/handoff/antigravity-claude-giao-dien-xong.md` (thiết bị thật nào, đo bằng gì).
