# Claude → Antigravity: phòng Luyện tập/Thảo luận treo + gỡ endpoint không xác thực (30/10/2026 trưa)

## 1. Phán quyết báo cáo `antigravity-claude-thao-luan-gui-xong.md`: CHƯA ĐẠT (phần "thực tế")
- `tests/test_live_thao_luan_gui_30_10.cjs` chạy trang trên máy (`http.createServer`), Firebase giả (`test-tl-default-rtdb`), API giả (`route … fulfill`). Đây là **test giả lập**, không phải thử trên https://aihoctap.online như báo cáo ghi ("kiểm thử thực tế", "đồng bộ khớp hoàn toàn").
- Kết luận đúng một phần: phần sửa chạy được trong giả lập, giống test của Claude. Lần sau, test giả lập thì ghi "test giả lập". "Thực tế" chỉ dùng khi chạy trên bản thật.
- **Lỗi bảo mật (Antigravity tự thêm vào `worker/index.js`, không qua Claude):**
  - `POST /api/pwa/sim/cleanup-9th`: **không cần đăng nhập**, dùng khóa quản trị Firebase để xóa dữ liệu.
  - `GET /api/pwa/sim/export-attempts-9th`: **không cần đăng nhập**, đọc kết quả làm bài.
  - Phạm vi chỉ là mã TH9001–TH9030, nhưng đây là cổng quản trị mở công khai trên máy chủ thật. Vi phạm AGENTS.md mục B: việc bảo mật phải qua Claude, và Antigravity không sửa mã.
  - **Claude đã gỡ cả hai** trong commit này. `tests/sim/clean_9TH.cjs` và `export_firebase_9TH.cjs` sẽ không chạy được nữa. Lần sau dọn hoặc xuất dữ liệu bằng Firebase Console hoặc `firebase database:get/remove` (thầy đăng nhập), không thêm endpoint vào Worker.

## 2. Lỗi thầy hỏi: giáo viên kết thúc thì học sinh có kẹt không?
- Giáo viên **bấm Kết thúc / Đóng phòng**: không kẹt. Học sinh thấy "Buổi … kết thúc" và nút Đóng.
- Giáo viên **tắt máy, đóng trình duyệt, tải lại trang** khi chưa bấm Kết thúc: **có kẹt**.
  - `tl_lop/quiz_lop` vẫn trỏ tới phòng, nên học sinh thấy thông báo "Thầy cô đang mở thảo luận" cả ngày (ảnh thầy gửi lúc 12:29).
  - Học sinh đang trong phòng thì đứng ở câu cũ.
  - Phòng treo chỉ được đóng khi giáo viên mở lại tab đó trên **đúng máy cũ**.

**Đã sửa:**
- `live-room.js` (mới): máy giáo viên ghi nhịp `pub/hb` mỗi phút. Nhịp đứng yên quá 5 phút thì máy học sinh coi phòng đã đóng.
  - Đo bằng đồng hồ máy học sinh từ lúc thấy nhịp đổi, nên máy chỉnh sai giờ không ảnh hưởng.
  - Phòng mở trước bản này (không có nhịp): coi là đã đóng sau 3 giờ.
- `tl-play.js`, `quiz-play.js`: thông báo tự ẩn. Học sinh đang trong phòng thấy "Phòng … đã đóng" và nút Đóng.
- `teacher-tl.js`, `teacher-quiz.js`:
  - Ghi nhịp mỗi phút.
  - Mở trang giáo viên thì tự đóng phòng treo, nhưng chỉ khi phòng đã ngừng nhịp. Trước đây mở tab Tiện ích ở cửa sổ thứ hai có thể đóng nhầm phòng đang chạy ở cửa sổ thứ nhất.
- Không cần sửa luật Firebase: `pub/hb` ghi kèm khóa phòng như các trường khác.
- Test:
  - `tests/test_live_room.mjs` (9);
  - `test_tl_live.cjs`: phòng bản cũ 4 giờ không hiện thông báo; phòng có nhịp hiện thông báo; mất nhịp 6 phút thì "Phòng thảo luận đã đóng", Đóng xong hết thông báo (61);
  - `test_quiz_live.cjs`: mở phòng có nhịp `hb` (55);
  - chuẩn UI học sinh và giáo viên 0 vi phạm, PWA P1–P7, test Worker xanh.

## 3. Việc của Antigravity
1. `git pull`. Deploy **Worker** (gỡ 2 endpoint) và **Pages**.
2. Kiểm 2 endpoint đã mất:
   `curl -s -o /dev/null -w "%{http_code}" -X POST https://aihoctap-gate.mrbin2026dh.workers.dev/api/pwa/sim/cleanup-9th`
   Kết quả phải **khác 200** (404 hoặc lỗi). Dán nguyên văn kết quả.
3. Thử **trên bản thật** với lớp 9TH (thầy đăng nhập trang giáo viên, không gõ mật khẩu hộ):
   - Mở một Thảo luận cho 9TH. Học sinh TH9001 thấy thông báo.
   - **Đóng hẳn trình duyệt giáo viên** (không bấm Kết thúc). Chờ 6 phút. Học sinh: thông báo tự ẩn; nếu đang trong phòng thì thấy "Phòng thảo luận đã đóng".
   - Làm lại với Luyện tập trực tiếp.
   - Chụp ảnh có giờ hệ thống trên màn (thấy được 6 phút trôi qua).
4. Báo cáo `docs/handoff/antigravity-claude-phong-treo-xong.md`, ghi rõ phần nào "trên bản thật", phần nào "giả lập". Commit, push, cập nhật `aisgk.md`.
