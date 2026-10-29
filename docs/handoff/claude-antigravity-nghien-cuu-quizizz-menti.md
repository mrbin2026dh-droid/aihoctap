# Claude → Antigravity: việc sáng 29/10 + nghiên cứu tính năng kiểu Quizizz / Mentimeter cho giáo viên

Mục tiêu của thầy: AI Học Tập **triển khai thật cho giáo viên trong trường và nhân rộng sau này**, không chỉ để dự thi.
Hai công cụ giáo viên dùng nhiều nhất trên lớp:
- **Quizizz:** trắc nghiệm, cả trên lớp lẫn giao về nhà.
- **Mentimeter:** hỏi đáp, thảo luận, câu trả lời mở, đám mây từ khóa.

Phần A làm trước, phần B làm sau khi xong phần A.

---

## PHẦN A — Việc sáng nay (ngày thi thật)
Làm đúng theo `docs/handoff/claude-antigravity-ra-soat-29-10.md`:
1. `git pull`.
2. VPS: chạy lại `setup.sh` (giữ `.env`), Bộ não **21 ca OK**.
3. **Không** deploy lại Worker.
4. Ghi kết quả vào `docs/handoff/antigravity-claude-ra-soat-xong.md`.

Việc của thầy (Antigravity không làm): mở khóa tên miền `https://aihoctap.online/*` cho khóa API Google, nhắc học sinh cập nhật app, giáo viên lớp đổi PIN dài.

---

## PHẦN B — Nghiên cứu Quizizz + Mentimeter (chỉ nghiên cứu, CHƯA viết code)

### B1. Nguyên tắc pháp lý — bắt buộc
Quizizz (nay là Wayground) và Mentimeter là **phần mềm thương mại có bản quyền**. Ứng dụng sẽ dùng chính thức trong trường và nhân rộng, nên phải sạch về bản quyền:
- **KHÔNG** dịch ngược, tải hay giải nén mã nguồn, tệp JS, API nội bộ của hai ứng dụng này.
- **KHÔNG** chép logo, tên, hình, âm thanh, giao diện y hệt, hay câu hỏi trong thư viện của họ.
- **ĐƯỢC** làm: đọc trang hướng dẫn công khai (Help Center), xem video giới thiệu, dùng thử bằng tài khoản giáo viên miễn phí, rồi **ghi lại tính năng bằng lời của mình**. Tính năng (ý tưởng) không có bản quyền; mã và thiết kế cụ thể thì có.
- **Mã nguồn mở trên GitHub:** dùng công cụ GitHub thầy đã cài để tìm các dự án mở tương tự.
  - Ghi rõ **giấy phép** từng dự án.
  - Chỉ đề xuất học hỏi hoặc dùng lại dự án MIT / Apache-2.0 / BSD (ghi nguồn).
  - Dự án GPL / AGPL thì chỉ tham khảo ý tưởng, **không chép mã** vào kho của thầy.
- Không đăng nhập bằng tài khoản thật của học sinh để thử. Không đưa dữ liệu học sinh lên hai nền tảng này.

### B2. Hiện trạng của mình (đọc mã trước khi so sánh)
Tiện ích → **Trò chơi câu hỏi** (`frontend/hoc/teacher-quiz.js`, `quiz-play.js`, nhánh Firebase `quiz*`) đã có:
- Giáo viên điều khiển phòng 6 số; học sinh lớp đó mở app là thấy lời mời.
- Câu hỏi: AI soạn theo bài, lấy từ đề thi thử, hoặc tự nhập.
- Máy chiếu hiện câu và đồng hồ; học sinh chọn trên điện thoại.
- Hết giờ thì hiện đáp án, biểu đồ, bảng xếp hạng (điểm = đúng + nhanh).
- Kết thúc: bục vinh danh, thống kê từng câu, AI nhận xét lớp (không gửi tên học sinh).
- An toàn: đáp án chỉ nằm trên máy giáo viên đến lúc công bố.

**Tức là phần "Kahoot / Quizizz trên lớp" đã có lõi.** Việc cần làm là tìm phần còn thiếu, không làm lại từ đầu.

### B3. Cần nghiên cứu và ghi lại
**Kiểu Quizizz** (so với Trò chơi câu hỏi hiện có):
- Chế độ **học sinh tự làm theo tốc độ riêng** và **giao về nhà có hạn chót** (khác chế độ giáo viên điều khiển từng câu).
- Loại câu hỏi:
  - nhiều đáp án đúng;
  - điền từ;
  - sắp xếp thứ tự;
  - nối cặp;
  - đúng/sai;
  - câu có hình.
- Yếu tố tạo hứng thú: chuỗi đúng liên tiếp, xem lại câu sai, làm lại để cải thiện điểm, nhạc nền (bật/tắt).
- Báo cáo cho giáo viên: theo từng em, theo từng câu; câu nhiều em sai nhất; xuất Excel.
- Ngân hàng câu hỏi: lưu, chia sẻ giữa giáo viên trong trường, nhập từ Excel/Word.

**Kiểu Mentimeter** (hiện chưa có):
- **Đám mây từ khóa:** học sinh gõ 1–3 từ, từ nhiều người gõ hiện to.
- **Câu trả lời mở:** học sinh gõ ý kiến, hiện dạng thẻ trên máy chiếu. Giáo viên duyệt hoặc ẩn trước khi hiện, rất quan trọng với học sinh THCS.
- Bình chọn một lựa chọn, thang điểm 1–5, xếp hạng mức độ ưu tiên.
- Hỏi đáp: học sinh đặt câu hỏi, các bạn bấm "cùng thắc mắc" để đẩy câu lên trên.
- Chế độ ẩn danh với bạn bè (giáo viên vẫn thấy tên, để kiểm soát lời lẽ).
- Trình chiếu nhiều "trang" liên tiếp trong một buổi.

**Điểm có thể làm khác và hay hơn** (tận dụng AI và Bộ não sẵn có):
- AI **gom nhóm câu trả lời mở** theo ý, tóm tắt "lớp đang nghĩ gì" và chỉ ra hiểu lầm.
- AI **lọc lời lẽ không phù hợp** trước khi hiện lên máy chiếu.
- Kết quả thảo luận và trắc nghiệm trên lớp chuyển vào Bộ não, thành dữ liệu cho hiểu lầm từng em và báo cáo tuần.

### B4. Sản phẩm cần nộp (một tệp, tiếng Việt, ngắn gọn)
`docs/nghien-cuu/quizizz-menti-tinh-nang.md` gồm:
1. **Bảng tính năng:** tính năng | Quizizz/Menti làm thế nào (mô tả bằng lời, kèm link trang hướng dẫn công khai) | mình đã có chưa | mức hữu ích trên lớp THCS (cao/vừa/thấp) | độ khó làm (S/M/L).
2. **Top 6 tính năng nên làm**, xếp theo thứ tự, có lý do (dạy thật trên lớp, mạng yếu, máy chiếu, điện thoại học sinh).
3. **Dự án mã nguồn mở:** tên | link | giấy phép | số sao | lần cập nhật cuối | học được gì | dùng lại được không.
4. **Đề xuất dữ liệu Firebase** cho chế độ Thảo luận, theo cách nhánh `quiz*` đang làm: phòng, trang, câu trả lời, duyệt, khóa điều khiển của giáo viên. Kèm luật bảo vệ sơ bộ.
5. **Cần gì để nhân rộng ra cả trường:**
   - nhiều giáo viên, mỗi giáo viên thấy lớp mình;
   - ngân hàng câu hỏi chung;
   - giới hạn lượt AI;
   - chi phí Firebase/Gemini ước tính cho 1 trường khoảng 1.000 học sinh (ghi rõ đâu là ước tính).
6. Ảnh chụp màn hình (nếu có) chỉ để trong máy, **không đưa lên kho công khai** (tránh vi phạm bản quyền hình ảnh).

**Không** sửa `frontend/`, `worker/`, Firebase, VPS trong phần B.

### B5. Sau khi có tệp nghiên cứu
1. Thầy đọc, chọn tính năng.
2. Claude viết mã. Làm **sau ngày 30/10** để không làm hỏng bản đang dự thi và đang thi thật.
3. Thứ tự dự kiến:
   - **Chế độ Thảo luận** (đám mây từ khóa, câu trả lời mở có duyệt, bình chọn, AI gom ý) gắn vào Tiện ích, dùng lại phòng 6 số và lời mời theo lớp;
   - sau đó **Giao về nhà tự làm** và **thêm loại câu hỏi** cho Trò chơi câu hỏi.

### B6. Báo cáo
Ghi `docs/handoff/antigravity-claude-nghien-cuu-xong.md`: đã đọc nguồn nào, tìm được dự án mở nào, những gì còn chưa chắc chắn. Không ghi mật khẩu, khóa, tên học sinh.
