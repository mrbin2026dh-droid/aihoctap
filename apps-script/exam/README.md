# Apps Script đường thi Firebase (Cổng 3)
Một dự án Apps Script **gắn với Google Sheet sổ điểm** (Sheet → Tiện ích mở rộng → Apps Script), dán `Code.gs` và `appsscript.json`.

## Cài đặt (một lần, tài khoản chủ dự án Firebase)
1. Project Settings → Script properties:
   - `FIREBASE_API_KEY` = khóa API web (giống `FB_CONFIG.apiKey` trong `frontend/hoc/fb.js`)
   - `DB_URL` = `https://day-hoc-tuong-tac-7ee69-default-rtdb.asia-southeast1.firebasedatabase.app`
   - `GRADEBOOK_ID` = ID của chính Sheet này (đoạn giữa `/d/` và `/edit` trong URL)
   - `DRIVE_ROOT_ID` (tùy chọn) = ID thư mục Drive gốc; bỏ trống thì tự tạo "Bai thi Tin hoc"
2. Chạy `setup()` một lần (cấp quyền) → tạo trigger `tick` mỗi phút + `onGradebookEdit`.
3. Deploy → New deployment → Web app → Execute as **Me** → Who has access **Anyone** → chép URL `/exec`.
4. Dán URL vào `FB_CONFIG.appsScriptUrl` trong `frontend/hoc/fb.js`, chạy `python3 tools/package_student_pwa.py --stamp`, commit.

## Phát hành đề (giáo viên)
Tạo một tab theo mẫu, rồi menu **📝 Bài thi (Firebase) → Phát hành đề từ tab này**:

| | A | B |
|---|---|---|
| 1 | Mã đề | `gk1-tin9` |
| 2 | Tiêu đề | Kiểm tra giữa kỳ Tin 9 |
| 3 | Khối | 9 |
| 4 | Số phút | 45 |
| 5 | Mở lúc | 28/10/2026 07:30 |
| 6 | Đóng lúc | 28/10/2026 09:00 |
| 7 | Số lượt | 1 |
| 8 | Điểm thực hành tối đa | 6 (0 nếu không có) |

Hàng 10 là tiêu đề cột: `Mã câu | Loại (choice/text) | Câu hỏi | A | B | C | D | Đáp án | Điểm | Chủ đề`; từ hàng 11 mỗi hàng một câu.
Đáp án nằm ở `exam_secrets` (học sinh không đọc được). Câu hỏi chỉ đọc được trong khung Mở–Đóng và đúng khối.

## Diễn biến một kỳ thi
- Học sinh nộp → `grade_my_attempt` chấm ngay, chỉ trả **điểm tổng** (không trả đúng/sai từng câu).
- Trigger mỗi phút chấm bù bài chưa có điểm (khi web app bận).
- Sau giờ đóng + 2 phút: ai có phiên mà chưa nộp → **tự nộp bài nháp cuối** (`auto_from_draft: true`); ghi chi tiết đúng/sai + đáp án vào `results`; tạo `minh-chung_{đề}.txt` trong `Bai thi Tin hoc/{Lớp}/{Họ tên - Mã}/`; ghi một hàng vào tab sổ điểm tên = mã đề.
- Giáo viên gõ **Thực hành** (cột F) / **Nhận xét** (cột G) → tổng điểm + `results` + file minh chứng tự cập nhật.
- File thực hành: .xlsx/.pptx/.docx/.pdf ≤ 10 MB, trong giờ thi đến 10 phút sau giờ đóng; nộp lại thì file cũ vào thùng rác (khôi phục được 30 ngày).

## Giới hạn cần biết (tài khoản Google thường)
30 lượt chạy web app đồng thời (học sinh tự thử lại có giãn cách), 6 phút mỗi lần chạy (trigger tự dừng ở 4,5 phút và làm tiếp lần sau), tổng thời gian trigger/ngày có hạn — trigger thoát ngay khi không có đề đang mở.
