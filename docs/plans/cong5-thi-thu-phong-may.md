# Cổng 5 — Thi thử thật ở phòng máy (kịch bản cho giáo viên)
Soạn: Claude, 27/10/2026. Mục tiêu: một lớp thật (~30–40 em) làm một bài 15 phút trên hệ thống mới, đo trên mạng và máy của trường. Đây là bài **thử**, không lấy điểm thật.

## A. Trước buổi thi (làm trước ít nhất 1 ngày)
1. **Tài khoản học sinh — phải có ở CẢ HAI hệ thống, cùng mã và cùng PIN** (hiện học sinh đăng nhập hệ thống học trước, hệ thống thi đăng nhập theo cùng PIN):
   - Hệ thống học (trang giáo viên): lớp và học sinh đã có/được tạo như thường lệ.
   - Hệ thống thi: Sheet cấp phát → điền Mã HS, Họ tên, Lớp, Khối, PIN (cùng PIN với hệ thống học) → menu "Cấp phát tài khoản". Cột H phải ghi "Đã tạo mới"/"Đã đồng bộ" cho mọi em.
   - Đặt lại PIN cho em nào thì đặt ở **cả hai** nơi. Học sinh tự đổi PIN trong ứng dụng thì hệ thống tự đổi cả hai (bản mới, 27/10).
2. **Soạn đề**: trong file "So diem bai thi", nhân bản tab `DE_mau` → đổi tên `DE_thu-<lớp>`, sửa Mã đề (ví dụ `thu-9a-01`), Khối, giờ Mở/Đóng đúng tiết học (Đóng = Mở + 20 phút), 8–10 câu trắc nghiệm, Điểm thực hành 2 (một bài Excel nhỏ). Tích ô B9 → C9 phải hiện ✔.
3. **Thử trước bằng 1 tài khoản thử của chính thầy cô** (một học sinh "HS_THU" khối đó, có ở cả hai hệ thống): mở ứng dụng trên một máy phòng tin, đăng nhập, vào tab Thi → thấy đề khi đến giờ mở. Không thấy đề → tab Thi có dòng báo lý do; chụp lại gửi Claude.
4. **Chuẩn bị file thực hành** (một file Excel mẫu < 1 MB) để học sinh sửa rồi nộp.
5. In phiếu PIN cho học sinh (cột Mã HS + PIN trong Sheet cấp phát), cắt sẵn.

## B. Trong buổi thi (ghi vào phiếu theo dõi bên dưới)
1. Học sinh mở ứng dụng, đăng nhập. **Ghi thời gian** từ lúc thầy cô nói "đăng nhập" đến khi em cuối cùng vào được tab Thi.
2. Đến giờ mở: học sinh bấm vào đề, làm bài. Thử cố ý: 1 em tắt Wi-Fi 30 giây rồi bật lại khi đang làm (nháp phải còn); 1 em đóng trình duyệt không nộp (hệ thống phải tự nộp nháp khi đóng đề).
3. Học sinh nộp file Excel. Ghi: bao nhiêu em nộp được ngay, bao nhiêu em phải chờ "đang thử lại", em nào không nộp được (ghi mã và thông báo trên màn hình).
4. Không đổi máy giữa chừng. Máy dùng chung: em trước phải **Đăng xuất** trước khi em sau đăng nhập.

## C. Sau buổi thi (trong ngày)
1. Sau giờ đóng + 3 phút: mở file "So diem bai thi", tab `thu-9a-01` → đủ hàng cho mọi em đã vào thi; em đóng trình duyệt có trạng thái "Chờ chấm" và minh chứng ghi "HỆ THỐNG TỰ NỘP TỪ BÀI NHÁP CUỐI".
2. Mở thư mục Drive "Bai thi Tin hoc/<Lớp>" → mỗi em một thư mục, có file thực hành + phiếu minh chứng.
3. Gõ điểm thực hành cho vài em (cột F) → Tổng đổi theo.
4. Apps Script → **Executions** (Nhật ký thực thi): chụp trang tổng thời gian chạy hôm đó, đếm số lần lỗi (đỏ).
5. Gửi Claude: phiếu theo dõi + 3 ảnh (sổ điểm, thư mục Drive, Executions).

## Phiếu theo dõi (điền tay hoặc gõ lại)
| Mục | Kết quả |
|---|---|
| Lớp, số em có mặt, loại máy (máy bàn Windows / Chromebook / điện thoại), trình duyệt | |
| Mạng: Wi-Fi hay cáp, tốc độ đo được (fast.com) lúc bắt đầu | |
| Thời gian cả lớp đăng nhập xong (phút) / số em đăng nhập lỗi + thông báo lỗi | |
| Số em thấy đề đúng giờ / không thấy (thông báo trên tab Thi) | |
| Em tắt Wi-Fi: nháp còn không? nộp được không? | |
| Em đóng trình duyệt: có tự nộp từ nháp không? | |
| Nộp file: số em nộp ngay / phải chờ / không nộp được; lâu nhất bao lâu | |
| Sổ điểm đủ hàng? Minh chứng đủ? Gõ điểm thực hành cập nhật Tổng? | |
| Executions: tổng thời gian chạy, số lỗi | |
| Học sinh/giáo viên thấy khó ở đâu (ghi nguyên lời) | |

## Tiêu chí đạt Cổng 5
- 100% học sinh có mặt đăng nhập được và thấy đề (lỗi PIN đã được báo trên màn hình, không im lặng).
- 0 bài nộp bị mất; em đóng trình duyệt được tự nộp từ nháp.
- 0 file thực hành bị mất (em không nộp được phải thấy thông báo và còn file trên máy).
- Sổ điểm + minh chứng đầy đủ trong vòng 5 phút sau giờ đóng.
Đạt → Claude cho phép dùng cho bài kiểm tra thật (vẫn giữ đường Worker cũ làm dự phòng ít nhất 2 bài thật).
