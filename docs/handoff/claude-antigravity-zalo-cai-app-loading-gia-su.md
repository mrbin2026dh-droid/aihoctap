# Claude → Antigravity: mở bằng trình duyệt (Zalo), cài app, loading, Gia sư tự chọn bài, Bộ não chạy ban ngày (28/10 tối)

## 1. Đã làm (đã đẩy GitHub; Pages tự phát hành)
- **Mở link trong Zalo/Facebook/Messenger/TikTok…** (`frontend/hoc/install.js`): màn hình "Mở AI Học Tập bằng trình duyệt".
  - Android: nút **Mở bằng Chrome** (link `intent://`, giữ nguyên trang, có đường dự phòng).
  - iPhone: nút **Mở bằng Safari** (thử `x-safari-https://`, iOS 17+); bị chặn thì hiện 2 bước "⋯ → Mở trong Safari".
  - Có "Ở lại trình duyệt hiện tại" (nhớ trong lần mở đó) và "Sao chép link".
- **Cài app:** bảng hướng dẫn mới theo đúng thiết bị (Android, iPhone 3 bước có hình, máy tính, trong Zalo).
  - Gợi ý cài **chỉ khi máy chưa cài**: Chrome/Edge/Cốc Cốc chỉ báo `beforeinstallprompt` khi chưa cài hoặc đã gỡ.
  - iPhone không cho biết đã cài hay chưa → nhắc tối đa 7 ngày/lần; bấm "Em đã cài rồi" thì nghỉ 60 ngày.
  - Đang mở bằng app → ẩn nút cài.
  - Nút **Install trên thanh địa chỉ** (như trang Đấu trường) là của chính Chrome, sẽ tự hiện khi trang chạy **HTTPS**.
- **Loading:**
  - Thanh tiến trình mỏng mép trên khi đợi máy chủ (Worker, Google Sheet) quá 0,4 giây, cả trang học sinh và giáo viên (`netbar.js`).
  - Nút đang xử lý (Tạo bài thi, Lưu, AI soạn…) có vòng xoay trong nút.
  - Danh sách / báo cáo đang tải có khối vòng xoay + thanh lướt sáng. Lỗi thì khối tải biến mất, không quay mãi.
  - Tổng quan học sinh sau đăng nhập có khối "Đang tải tổng quan học tập…" (trước đây chỉ có nút đồng bộ xoay lạc chỗ).
- **Gia sư khi học sinh chưa chọn bài:** trước đây gõ câu hỏi mà chưa chọn bài thì **bị bỏ qua**.
  - Nay ứng dụng gửi danh sách bài của khối em, Worker chấm độ khớp câu hỏi với từng bài, dùng bài khớp nhất làm căn cứ, rồi báo lại tên bài.
  - Không khớp bài nào → không gọi AI, không trừ lượt, mời chọn bài.
- **Bộ não:** thêm lệnh `quick` + `brain-quick.timer` (mỗi 30 phút, 6:00–22:00): thu thập + cập nhật hiểu lầm cho Gia sư, không gọi AI, không gửi báo cáo. Báo cáo tuần do AI viết vẫn chạy buổi tối.
- **Kiểm thử mới:**
  - `test_install_browser` 25 ca, `test_loading_states` 11 ca, `test_tutor_auto_lesson` 11 ca.
  - Bộ não 18 ca (có ca lượt nhanh không gọi AI, không gửi Sheet).

## 2. Antigravity làm
1. `git pull`; **deploy Worker** `npx wrangler deploy` (Gia sư tự chọn bài). Kiểm: đăng nhập tài khoản học sinh giả trên `https://aihoctap.online`, mở Gia sư, **không chọn bài**, hỏi "1 byte bằng bao nhiêu bit" → câu trả lời có dòng "Gia sư dùng bài: …".
2. **VPS:** chạy lại `setup.sh` (giữ `.env`) → 18 ca OK; kiểm `systemctl list-timers brain.timer brain-quick.timer` có cả hai.
   - `brain.timer` đang tắt từ lúc dọn dữ liệu giả: bật lại sau bài thi thật (`systemctl enable --now brain.timer`). Nếu bật ngay, báo cáo tối nay sẽ ghi "chưa đủ dữ liệu", không hại gì.
3. **HTTPS** (việc còn treo từ trước): bật Enforce HTTPS rồi bỏ `http://aihoctap.online` khỏi `ALLOWED_ORIGIN`.
4. **Thử trên điện thoại thật:**
   - Gửi link `https://aihoctap.online` qua Zalo, mở trong Zalo → thấy màn hình "Mở AI Học Tập bằng trình duyệt" → bấm Mở bằng Chrome (Android) / Safari (iPhone). Ghi lại máy nào mở được thẳng, máy nào phải theo hướng dẫn ⋯.
   - Trong Chrome: thấy gợi ý "Cài AI Học Tập lên máy" → Cài → biểu tượng mới trên màn hình.
5. Ghi kết quả vào `docs/handoff/antigravity-claude-zalo-cai-app-xong.md` (không ghi tên/mã học sinh, khóa).
