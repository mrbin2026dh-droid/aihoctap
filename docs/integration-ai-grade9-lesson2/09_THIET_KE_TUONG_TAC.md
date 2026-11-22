# 09. Thiết kế tương tác theo thực tế lớp học (chốt từng hoạt động với giáo viên)

## Điều kiện thực tế (giáo viên xác nhận 22/11/2026)
- Trường không đủ máy: **2–3 học sinh ngồi chung một máy tính**.
- **Mỗi máy chỉ một em đăng nhập** (tài khoản của em đó), cả 2–3 em cùng bàn và làm trên máy; không đăng nhập nhiều tài khoản, không dùng tài khoản của bạn.
- **Các bạn ngồi cùng máy về nhà làm phiếu bổ sung**: đăng nhập tài khoản của mình, vào Học AI, làm bài của mình. Học liệu giáo viên đã mở cho lớp vẫn thấy; phần nhóm thì nhập số nhóm để xem và đóng góp; có thể làm tiếp nhiều lần, máy tự lưu.
- Trang giáo viên tách hai trạng thái để theo dõi: "làm trên lớp" (bài có cập nhật trong giờ học) và "làm ở nhà".
- Mục đích của màn học sinh: **làm trước, xem phản hồi sau** (có giải thích, lấy từ PL9.2.9). Phần tự kiểm không quyết định mức Đạt/Khá/Tốt; mức này do giáo viên chọn.

## Hoạt động 1. Tin tuyển dụng năm 2035 (5 phút) — ĐÃ CHỐT
Mục đích: tạo mốc "lúc đầu em chọn…" để cuối bài (HĐ 4) từng em tự so. Không có đúng sai. Thẻ 7–9 là việc máy làm tốt hơn người; học sinh không được biết điều này trước HĐ 4.

| Bước | Giáo viên | Trên máy (2–3 em) |
|---|---|---|
| B1 (1') | Chiếu tin tuyển dụng, đọc to; nói "không có đúng sai" | 9 thẻ + câu hỏi "Tin chỉ được ghi 3 yêu cầu: em chọn 3 thẻ nào, vì sao?" + dòng "Không có lựa chọn đúng sai" |
| B2 (2') | Không gợi ý | Các em cùng máy bàn, em đăng nhập chọn 3 thẻ và ghi lí do, bấm **Chốt** (khóa, không sửa được). Bạn cùng máy về nhà tự chọn và ghi lí do trên tài khoản của mình |
| B3 (1') | Chiếu **biểu đồ cả lớp** trên trang giáo viên (đếm theo bài đã chốt, tự đánh sao 3 thẻ nhiều nhất); mời một máy chọn khác số đông bảo vệ lựa chọn | Học sinh xem trên màn chiếu của giáo viên |
| B4 (1') | Chưa nói đúng sai; nêu câu hỏi lớn; hẹn cuối bài | Máy ghi "Cuối bài các em sẽ xem lại lựa chọn này" |

Đã làm (22/11): chọn ngay trên 9 thẻ, hướng dẫn 3 bước, nút Chốt; biểu đồ lớp trên trang giáo viên. Không hiện câu hỏi thảo luận của giáo viên cho học sinh.

## Hoạt động 2.1. Sáu tình huống, sáu năng lực (16 phút) — ĐÃ CHỐT, ĐÃ LÀM
- Làm **theo máy**, không chia nhóm 5–6, không có thư kí (lớp 45 em).
- Bước 1, Thẻ năng lực: máy chọn một năng lực, viết "cần hơn khi có AI vì…" và một ví dụ.
- Bước 2, Sáu tình huống: mỗi tình huống là một thẻ, đề nằm ngay trên ô trả lời.
  - Học sinh chọn năng lực, ghi "em sẽ làm gì", rồi bấm **Kiểm tra**. Máy chủ chỉ trả giải thích (lấy từ PL9.2.9 mục 2) sau khi học sinh đã lưu câu trả lời; câu trả lời lần đầu được giữ để giáo viên xem.
  - Tình huống 1 có thêm phần bấm vào cụm từ AI viết sai.
  - Ô tự chấm ● ◐ ○ hiện sau khi kiểm tra.
- Bước 3, Mạnh nhất, yếu nhất: kèm minh chứng.
- Trang giáo viên có bảng "lần đầu các máy chọn năng lực nào" cho từng tình huống, để chọn tình huống cần giảng thêm.
- Câu hỏi thảo luận của giáo viên đã chuyển sang gói đáp án, không hiện cho học sinh.
- Giáo viên phải **nhập lại** `ai9_bai2.json` và `ai9_bai2.dapan.json` (gói đáp án nay có phần `kiem`).

## Hoạt động 2.2 — chưa phân tích

## 22/11/2026: VIẾT LẠI TOÀN BỘ BÀI THEO YCCĐ (giáo viên duyệt)
- Giáo viên nhận xét các tình huống trong giáo án gốc khó hiểu với học sinh lớp 9 và với cả giáo viên. Giáo viên yêu cầu viết lại, chỉ cần đúng 4 yêu cầu cần đạt.
- Gói mới: `data/phieu/ai9_b2.json`, mã bài `ai9_b2`. Gói cũ chuyển thành dữ liệu test `tests/fixtures/phieu_ai9_bai2_cu.json`.
- Năm phần và phần cuối:
  - Phần 1 (khởi động): xếp 8 việc vào "Máy, AI làm tốt" hay "Người vẫn phải làm".
  - Phần 2 (9.A3.1): 6 tình huống, chọn A/B/C "em nên làm gì", rồi máy gọi tên năng lực.
  - Phần 3 (9.A3.2): phân biệt mục tiêu rõ ràng hay chưa rõ, viết mục tiêu 4 phần, lưu bản đầu, tự kiểm tra rồi sửa.
  - Phần 4 (9.A3.4): chọn một trong 6 nghề, xếp 4 việc máy/người, viết thay đổi và kĩ năng.
  - Phần 5 (9.A3.3): bấm câu AI gợi ý sai (luộc bánh 30 phút), viết sở thích.
  - Cuối bài: tự đánh giá rồi nộp.
- Nguyên tắc: học sinh làm trước, bấm Kiểm tra mới thấy đúng hay sai và giải thích dưới từng câu. Đáp án chỉ nằm trong `ai9_b2.dapan.json`; tệp này bị .gitignore chặn và giáo viên tự nhập qua trang giáo viên. Mức Đạt/Khá/Tốt do giáo viên chọn theo các câu tự viết.
- Nội dung đã duyệt (có đáp án, không lên Git): `data/phieu/ai9_bai2.duyet.md`.

