# Claude → Antigravity: sửa "Mạng đang chậm" / "Chưa tải được danh sách lớp" / học sinh 0 điểm + hộp thoại cập nhật (29/10 tối)

## 1. Nguyên nhân gốc (đã đo trên trình duyệt thật của thầy, trang https://aihoctap.online)
- Firebase REST chỉ chạy HTTP/1.1 → trình duyệt cho **tối đa 6 kết nối cùng lúc tới một máy chủ, tính chung mọi tab**.
- Mỗi `EventSource` (nghe tức thì) giữ chặt 1 kết nối. Trang giáo viên mở: `thi_hs` + 3 nhánh × mỗi bài thi đang mở + đọc bài + trực tuyến + phòng luyện tập → 7–10 kết nối.
- Đo thật 29/10: mở sẵn 4 EventSource → lệnh đọc 0,19 giây; 5 → 1,06 giây; **6 → treo quá 8 giây** (bị hủy).
- Hậu quả: Hiệu quả "Đang tải số liệu…" rồi "Mạng đang chậm"; Tiện ích "Chưa tải được danh sách lớp"; khi luyện tập, máy chiếu **không đọc được câu trả lời** → chấm mọi em 0 điểm (ảnh thầy: 0/5 câu đúng).
- Phụ: service worker của app học sinh trả bản cũ của các tệp dùng chung (`thi-store.js`, `dom.js`, `styles.css`…) cho trang giáo viên → trộn tệp cũ với `teacher.js` mới sau mỗi lần phát hành.
- Lỗi 401 `/api/teacher/auth` trong ảnh: đăng nhập Quản trị sai mã PIN (máy chủ từ chối đúng). Không phải lỗi mã.
- Luật `quiz_bo`: Claude kiểm lúc 17:xx, đã có hiệu lực (đọc nhánh con 200, liệt kê nhánh cha 401).

## 2. Claude đã sửa (đã đẩy lên main; GitHub Pages tự phát hành)
- `thi-store.js` `listen()`: **ngân sách kết nối** — nhiều chỗ nghe cùng nhánh dùng chung 1 kết nối; chỉ `SLOTS = 2` nhánh ưu tiên cao giữ EventSource, nhánh khác tự đọc lại sau 1,5–10 giây theo mức ưu tiên; tab bị ẩn đóng hết EventSource (đọc lại 20 giây/lần).
- Mức ưu tiên: câu trả lời luyện tập và trạng thái phòng = 3; bài thi đang mở, danh sách học sinh trong phòng = 2; `thi_hs`, đọc bài = 0.
- `sw.js`: trang khác trang học sinh (giáo viên) luôn lấy tệp dùng chung từ mạng (mất mạng mới dùng bản lưu). `teacher.js`: lúc mở trang, nếu có service worker mới đang chờ thì bật và tải lại **một lần** (không bao giờ giữa buổi). Đổi `?v=20261029b`.
- Tiện ích: lỗi danh sách lớp có nút **Thử lại** (giữ câu đã soạn). Hiệu quả: lỗi có nút **Thử lại**.
- **Cập nhật app học sinh (H1)**: có bản mới → hộp thoại "Có bản cập nhật mới" nêu nội dung (đọc `frontend/hoc/whats-new.json` của bản mới) → "Cập nhật ngay" → màn hình tiến trình → khởi động lại; "Để sau" giữ chấm đỏ, 30 phút sau mới hỏi lại; đang làm bài thì không cho cập nhật. Không còn tự cập nhật khi chưa đồng ý (AGENTS.md mục L).
- Kiểm thử: mới `tests/test_store_budget.mjs` 10 ca; `test_auto_update_login` 15 ca (viết lại theo luồng hộp thoại); `test_pwa_update_integrity` 7/7; `test_quiz_live` 51; `test_teacher_thi_ui` 136; `test_exam_teacher_monitor`, `test_presence_ui`, `test_teacher_effect`, `test_teacher_shell`, `test_role_*`, `test_teacher_ui_standard` 0 vi phạm, `test_student_ui_standard` 0 vi phạm.

## 3. Antigravity làm
1. `git pull`. Chờ GitHub Actions "deploy-pages" xanh.
2. **Quy tắc mới mỗi lần phát hành giao diện học sinh:** sửa `frontend/hoc/whats-new.json` (`title` + tối đa 8 dòng `items`, câu ngắn cho học sinh), rồi `python tools/package_student_pwa.py --stamp`.
3. Thử thật (tài khoản "[THỬ]"):
   - [ ] Máy giáo viên: mở Thi (có 2 bài đang mở) + Tài khoản + Tiện ích → Tạo bộ câu hỏi: danh sách lớp hiện ≤ 2 giây; Hiệu quả tải xong ≤ 3 giây.
   - [ ] F12 → Console chạy `performance.getEntriesByType('resource').length` không cần; thay vào đó Network lọc `event-stream`: **tối đa 2** kết nối EventSource tới firebasedatabase.app (+1 presence).
   - [ ] Luyện tập 1 máy chiếu + 2 điện thoại: em trả lời đúng được 500–1000 điểm (không còn 0 điểm).
   - [ ] Điện thoại học sinh đang mở app cũ: sau khi Pages phát hành, hiện hộp thoại "Có bản cập nhật mới" có nội dung; "Để sau" giữ chấm đỏ; bấm chấm đỏ → "Cập nhật ngay" → tiến trình → bản mới.
4. Việc còn lại từ `docs/handoff/claude-antigravity-luyen-tap-hieu-ung-29-10.md`: deploy Worker (ai-quiz 502), quan sát Kahoot/Quizizz.
5. Ghi `docs/handoff/antigravity-claude-ket-noi-cap-nhat-xong.md`.

## 4. Về lâu dài (ghi nhận, chưa làm)
Chuyển sang Firebase JS SDK (một WebSocket chở mọi nhánh) sẽ bỏ hẳn giới hạn 6 kết nối; cần đăng nhập Firebase Auth cho học sinh/giáo viên nên để sau cuộc thi.
