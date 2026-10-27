# Hướng dẫn giáo viên: tổ chức bài kiểm tra trên hệ thống thi mới
Soạn: Claude, 27/10/2026. Dành cho thầy cô, không cần biết lập trình. Mỗi phần làm theo đúng thứ tự.

Hệ thống gồm 3 chỗ thầy cô dùng:
- **Trang giáo viên** (ứng dụng): quản lý học sinh của hệ thống học.
- **Sheet cấp phát** (Google Sheet có menu "🤖 Quản trị Học sinh (AI SGK)"): tạo tài khoản thi.
- **File "So diem bai thi"** (Google Sheet): soạn đề (tab `DE_…`) và xem điểm (tab tên = mã đề).
Bài làm, file thực hành và phiếu minh chứng nằm ở Google Drive, thư mục **Bai thi Tin hoc / Lớp / Họ tên - Mã**.

---

## Phần 1. Cài đặt một lần (đã xong ngày 27/10/2026)
Đã đạt: `kiemTraHeThong()` ĐẠT TOÀN BỘ (OAuth, không còn DB_SECRET), `thuSoDiem()` ĐẠT TOÀN BỘ.
Mỗi khi Claude báo "có Code.gs mới": mở dự án Apps Script chấm thi → dán `apps-script/exam/Code.gs` → Lưu → **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (địa chỉ /exec giữ nguyên) → chạy `kiemTraHeThong` xem dòng cuối "ĐẠT TOÀN BỘ".
Với dự án cấp phát: dán `apps-script/provisioning/Code.gs` → Lưu (không cần Deploy).

## Phần 2. Tài khoản học sinh (mỗi lớp một lần)
Học sinh phải có tài khoản ở **cả hệ thống học và hệ thống thi, cùng Mã học sinh và cùng PIN**.
1. Trang giáo viên → mục tài khoản → **1. Tải file mẫu**. Điền **một** danh sách theo mẫu: `Mã học sinh | Họ và tên | Khối | Lớp | Mã PIN`.
   - **Bắt buộc tự điền Mã học sinh và Mã PIN** (không để trống — để trống mỗi hệ thống sẽ tự sinh khác nhau).
   - Mã: 3–20 ký tự chữ thường không dấu, số, `-`, `_` (ví dụ `hs9a01`). PIN: 6 chữ số trở lên, định dạng ô là Văn bản.
2. Trang giáo viên → **2. Thêm từ Excel** → chọn file → xem trước → nhập.
3. Sheet cấp phát: dán **nguyên** 5 cột đó (cả dòng tiêu đề) vào cột A–E → menu **🤖 Quản trị Học sinh (AI SGK) → 1. Cấp phát tài khoản (Toàn bộ danh sách)**. Sheet tự nhận thứ tự cột Khối/Lớp theo dòng tiêu đề. Cột H phải ghi "Đã tạo mới" hoặc "Đã đồng bộ" cho mọi dòng; dòng "LỖI: …" thì sửa rồi chạy lại (chỉ chạy lại dòng lỗi).
4. Lần đầu đăng nhập, ứng dụng yêu cầu học sinh đổi PIN → **hệ thống tự đổi PIN ở cả hai nơi**. Nếu màn hình báo "CHƯA đổi được PIN hệ thống thi", em đó cần thầy cô đặt lại PIN (bước 5).
5. Đặt lại PIN cho một em (quên PIN): đặt **cùng một PIN mới** ở trang giáo viên **và** Sheet cấp phát (chọn dòng của em → menu "2. Đặt lại mã PIN cho dòng đang chọn").

## Phần 3. Soạn và phát hành đề
1. Mở file **So diem bai thi** → chuột phải tab `DE_mau` → **Nhân bản** → đổi tên tab thành `DE_<tên dễ nhớ>` (phải bắt đầu bằng `DE_`).
2. Điền cột B, hàng 1–8:
   | Hàng | Ý nghĩa | Ví dụ |
   |---|---|---|
   | 1 Mã đề | chữ không dấu, số, `-`, `_`; **mỗi bài một mã mới** | `gk1-tin9a` |
   | 2 Tiêu đề | học sinh nhìn thấy | Kiểm tra giữa kỳ I – Tin 9 |
   | 3 Khối | 6, 7, 8, 9 | 9 |
   | 4 Số phút | thời gian làm từ lúc em bấm vào đề | 45 |
   | 5 Mở lúc | giờ Việt Nam, dạng `ngày/tháng/năm giờ:phút` | 28/10/2026 07:30 |
   | 6 Đóng lúc | sau giờ này không vào được nữa | 28/10/2026 08:30 |
   | 7 Số lượt | 1 (thi thật) hoặc 2 | 1 |
   | 8 Điểm thực hành tối đa | 0 nếu không có bài thực hành | 3 |
3. Từ hàng 11, mỗi hàng một câu: `Mã câu | Loại | Câu hỏi | A | B | C | D | Đáp án | Điểm | Chủ đề`.
   - Loại `choice` (trắc nghiệm, Đáp án là A/B/C/D) hoặc `text` (tự luận ngắn, thầy cô chấm; ô Đáp án là gợi ý chấm).
   - Tổng điểm trắc nghiệm + Điểm thực hành nên bằng 10.
4. **Tích ô B9** → chờ 2–5 giây → ô C9 hiện:
   - `✔ Đã phát hành …` — xong. Ô tích tự bỏ.
   - `✘ Chưa phát hành: …` — đọc lý do (sai định dạng ngày giờ, đáp án không có trong phương án, mã đề sai…), sửa, tích lại.
5. Sửa đề: sửa ô rồi tích B9 lại. **Khi đã có học sinh vào thi**, chỉ đổi được Tiêu đề, Số phút, Đóng lúc, Số lượt (để gia hạn); câu hỏi, đáp án, điểm bị khóa để không làm sai điểm.
6. Đáp án không bao giờ gửi về máy học sinh; câu hỏi chỉ hiện trong khung Mở–Đóng và đúng khối.

## Phần 4. Trong giờ kiểm tra
1. Học sinh mở ứng dụng → Đăng nhập → tab **Thi** → bấm đề khi đến giờ mở → làm → **Nộp bài** → thấy điểm trắc nghiệm ngay (có khi hiện "Đã nhận bài, điểm sẽ có sau" — bình thường, hệ thống chấm bù trong 1–2 phút).
2. Có bài thực hành: làm trên Excel/Word/PowerPoint, lưu file, bấm **Chọn file và nộp** (.xlsx, .pptx, .docx, .pdf, tối đa 10 MB). Cả lớp nộp cùng lúc có thể mất 1–2 phút: dặn em **không đóng trang** khi đang nộp. Nộp được đến 10 phút sau giờ đóng; nộp lại thì file mới thay file cũ.
3. Máy dùng chung: em trước bấm **Đăng xuất** trước khi em sau đăng nhập.
4. Sự cố thường gặp:
   | Hiện tượng | Xử lý |
   |---|---|
   | Em không thấy đề, tab Thi có dòng "Chưa vào được hệ thống thi mới" | PIN hai hệ thống lệch → đặt lại cùng PIN ở hai nơi (Phần 2 bước 5), em đăng xuất rồi đăng nhập lại |
   | Em không thấy đề, không có dòng báo | Kiểm tra Khối của em đúng khối của đề; đã đến giờ Mở chưa; C9 có ✔ chưa |
   | Mất mạng giữa chừng | Bài nháp tự lưu trên máy và hệ thống; có mạng lại em làm tiếp, nộp bình thường |
   | Máy hỏng | Em đăng nhập máy khác, bấm lại đề: làm tiếp từ nháp, đồng hồ vẫn chạy theo giờ bắt đầu |
   | Cả phòng mất mạng lâu | Sửa **Số phút** và **Đóng lúc** trong tab `DE_…`, tích B9 (C9 ghi "Đã cập nhật … (đề đang thi)"); dặn học sinh **bấm vào đề lại** để nhận giờ mới |
   | Nộp file báo "Chưa nộp được file sau nhiều lần thử" | File vẫn ở máy em; bấm nộp lại sau 1 phút. Vẫn lỗi: chép file vào USB nộp tay, ghi lại mã em |
   | Em quên bấm Nộp / đóng trình duyệt | Không cần làm gì: 2 phút sau giờ đóng hệ thống tự nộp bài nháp cuối |

## Phần 5. Sau giờ kiểm tra
1. Khoảng 3 phút sau giờ đóng, file **So diem bai thi** có tab tên = mã đề, mỗi em đã vào thi một hàng: Trắc nghiệm, Tổng, Trạng thái, link File thực hành, link Minh chứng.
2. Chấm thực hành: gõ điểm vào cột **Thực hành (GV nhập)**, nhận xét vào cột **Nhận xét** → Tổng, trạng thái "Đã chấm", phiếu minh chứng và điểm học sinh thấy tự cập nhật. Dán cả cột điểm cùng lúc cũng được. Điểm quá mức cho phép → ô tô đỏ, không lưu.
3. Phiếu minh chứng (`minh-chung_<mã đề>.txt` trong thư mục từng em): câu hỏi, em chọn gì, đáp án đúng, giờ bắt đầu/nộp, ghi chú nếu hệ thống tự nộp từ nháp. Drive giữ lịch sử phiên bản khi điểm thay đổi.
4. Học sinh xem được điểm của mình trong tab Thi.
5. Không xóa tab `DE_…` hay tab điểm của đề cũ; muốn gọn thì ẩn tab.

## Phần 6. Giới hạn cần biết
- Đã đo thật: 100 học sinh vào thi cùng lúc ổn định; 30 em nộp file 10 MB cùng lúc mất khoảng 1–1,3 phút, không mất file. File thật thường < 2 MB nên nhanh hơn.
- Wi-Fi trường là điểm chưa đo: lần thi thử đầu tiên ở phòng máy (kịch bản `docs/plans/cong5-thi-thu-phong-may.md`) sẽ cho biết.
- Thời gian chạy tự động của Google Apps Script mỗi ngày có hạn; sau buổi thi xem Apps Script → **Executions** nếu thấy chậm bất thường.
- Đường thi cũ (Worker) vẫn giữ nguyên làm dự phòng.

## Báo lỗi cho Claude
Gửi: thời điểm, mã đề, mã học sinh (không gửi PIN), ảnh màn hình học sinh, nội dung ô C9 hoặc dòng sổ điểm liên quan. Claude phân loại và sửa.
