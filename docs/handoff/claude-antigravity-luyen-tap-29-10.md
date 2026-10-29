# Claude → Antigravity: làm lại "Luyện tập trên lớp" kiểu Kahoot/Quizizz + sửa lỗi treo (29/10 chiều)

## 1. Lỗi thầy gặp: bấm "Trình chiếu" là treo (màn hình xanh)
- **Nguyên nhân:** nút "Trình chiếu" của giáo viên có lớp CSS `qz-play`, trùng tên với khung chơi toàn màn hình của học sinh (`.qz-play{position:fixed;inset:0}` trong `styles.css`). Trang giáo viên nạp cả `styles.css`, nên nút phình ra phủ kín màn hình.
- **Đã sửa:** viết lại cả hai phía.
  - Học sinh dùng tiền tố `lt-` (luyện tập).
  - Giáo viên dùng `qz-open`, không còn trùng.
  - Kiểm thử mới kiểm nút "Mở luyện tập" không phủ màn hình.

## 2. "Not secure" (H1)
Claude kiểm bằng trình duyệt sạch: `http://aihoctap.online/teacher.html` **tự chuyển sang https** (GitHub trả 301). Trang mới cũng có đoạn tự chuyển https.
Máy thầy vẫn hiện "Not secure" vì Chrome đang giữ **bản trang cũ** của địa chỉ `http://` (từ trước khi bật HTTPS). Bản cũ chưa có đoạn tự chuyển, mã nguồn không với tới được.

Cách xử lý dứt điểm trên máy thầy:
1. `chrome://settings/content/all` → tìm `aihoctap.online` → **Xóa dữ liệu**.
2. `chrome://settings/security` → bật **Luôn dùng kết nối an toàn**.
3. Mở `https://aihoctap.online/teacher.html`. Nếu đã cài app từ bản http thì gỡ và cài lại.

## 3. Luồng mới (Claude đã viết + kiểm thử, đã đẩy)
**Giáo viên → Tiện ích → Luyện tập trên lớp**
- **Tạo bộ câu hỏi:**
  - AI soạn theo bài (phải duyệt từng câu);
  - **tải file Excel** (có "Tải file mẫu"; nhận cả file mẫu đề thi, chỉ lấy câu trắc nghiệm; báo dòng lỗi);
  - lấy từ đề thi thử, hoặc tự nhập.
- **Chọn một hoặc nhiều lớp**, có nút chọn / bỏ chọn tất cả.
- **Lưu:** trên máy + **đồng bộ Firebase** tại `quiz_bo/{mã 64 ký tự băm từ tài khoản}`, để soạn ở nhà, mở ở máy chiếu trên lớp. Thẻ bộ câu hỏi có nút **Mở luyện tập**, biểu tượng **Sửa**, **Xóa** (có xác nhận, xóa cả trên mạng).
- **Mở luyện tập** → phòng chờ: mã 6 số, tên từng học sinh vào phòng, "Bắt đầu" chỉ bật khi có ít nhất 1 em.
- **Mỗi câu:**
  - 4 ô màu có hình ▲ ◆ ● ■, đồng hồ vòng tròn, số em đã trả lời;
  - nút **Tạm dừng / Tiếp tục**: thời gian tạm dừng không tính vào giờ làm bài, máy chủ chặn trả lời khi đang tạm dừng;
  - nút **Hiện đáp án** và **Kết thúc**.
- **Công bố:** đáp án, số em chọn từng phương án, bảng xếp hạng (có "lên N hạng").
- **Kết thúc** (hết câu hoặc kết thúc sớm có xác nhận):
  - bục vinh danh;
  - **danh hiệu**: Quán quân, Chính xác nhất, Nhanh như chớp, Chuỗi đúng dài nhất;
  - bảng xếp hạng đầy đủ, thống kê từng câu;
  - AI phân tích lớp (không gửi tên), tải CSV, lịch sử buổi luyện tập.
- **Điểm:** công thức Kahoot công bố tại support.kahoot.com "How points work": `round((1 − (thời gian trả lời / thời gian câu)/2) × 1000)`. Đúng ngay được 1000, đúng sát giờ 500, sai 0. Chuỗi đúng chỉ hiển thị và trao danh hiệu, không cộng điểm (không có nguồn chính thức).

**Học sinh → mục Luyện tập** (đã **bỏ** danh sách luyện tập cũ; luyện tập theo bài vẫn ở trong từng bài học)
- Chưa có buổi: "Chưa có buổi luyện tập".
- Thầy cô mở: hiện thẻ "Đang mở phòng · Mã phòng · Vào phòng". Ở mục khác có thông báo nhỏ "Vào phòng".
- Phòng chờ (tên, số bạn đã vào) → câu hỏi (4 ô màu có hình, đồng hồ) → "Chính xác! +950 điểm / Chưa đúng, đáp án ◆ B / Em chưa trả lời", chuỗi đúng, hạng → "Tạm dừng" → kết thúc: hạng ("Quán quân!"), điểm, số câu đúng, danh hiệu của em, bục vinh danh, lời khích lệ.

**Tệp:**
- mới `frontend/hoc/quiz-core.js` (lõi thuần: điểm, chấm cả lớp, xếp hạng, danh hiệu, đọc Excel);
- viết lại `teacher-quiz.js`, `quiz-play.js`;
- sửa `teacher.html`, `teacher.css`, `index.html`, `styles.css`, `app.js` (mục Luyện tập);
- thêm `quiz-core.js` vào `sw.js` và `tools/package_student_pwa.py`;
- luật Firebase thêm nhánh `quiz_bo`.

**Kiểm thử:**
- `test_quiz_core` 15 ca;
- `test_quiz_live` 44 ca: 1 giáo viên + 2 học sinh khác lớp, Excel, AI, nhiều lớp, đồng bộ, tạm dừng/tiếp tục, chặn trả lời khi tạm dừng, hiện đáp án sớm, kết thúc sớm, danh hiệu, xóa.

## 4. Antigravity làm
1. `git pull`.
2. **Luật Firebase:** dán `spike/step0/database.rules.ai-sgk-final.json` (thêm `quiz_bo`) → Publish.
   - Chưa đăng luật thì bộ câu hỏi vẫn lưu trên máy, chỉ chưa đồng bộ; thẻ ghi rõ "đang lưu trên máy này".
3. Không cần deploy Worker cho phần này.
4. **Thử thật trên https** (1 máy giáo viên, 2 điện thoại tài khoản học sinh giả "[THỬ]" ở 2 lớp):
   - tạo bộ 3 câu → Mở luyện tập → 2 em vào phòng;
   - chơi hết: có tạm dừng / tiếp tục, kết thúc sớm.
   - Ghi máy nào trễ, chữ nào bị cắt.
5. (Tùy chọn, nếu thầy muốn so sánh thêm) Dùng công cụ GitHub tìm dự án mã nguồn mở kiểu Kahoot (ghi giấy phép), so với luồng trên, ghi khác biệt đáng học vào `docs/nghien-cuu/quizizz-menti-tinh-nang.md`. **Không chép mã / giao diện của Kahoot, Quizizz.**
6. Ghi kết quả `docs/handoff/antigravity-claude-luyen-tap-xong.md`. Không ghi tên/mã học sinh thật.
