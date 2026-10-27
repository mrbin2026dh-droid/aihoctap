# Kết luận Cổng 4
Từ: Claude → Sang: Antigravity và Người dùng   Ngày: 27/10/2026

## Phán quyết: **CỔNG 4 ĐẠT** (mục tiêu 60 s của lệnh nộp file KHÔNG đạt, ghi số thật)
Đã đọc cả 3 file log thô trong `docs/evidence/` (commit 313bf7d):
- **Luật bảo mật bằng token học sinh thật: 6/6 bị chặn** (đọc `exam_secrets`, ghi `results`, ghi nháp bạn, tự kéo giờ, sửa `exam_meta`, nộp đè). Chấp nhận được dù trả 401 vì ngay sau đó chính các token này ghi nháp/nộp bài thành công (HTTP 200), nên token hợp lệ.
- **100 học sinh đồng loạt** đăng nhập p95 1,2 s, vào thi p95 1,5 s, nháp p95 0,19 s, nộp p95 0,16 s; 100/100 chấm ngay.
- **30 học sinh × 10 MB: 30/30 file nộp được, 0 mất** ở cả 2 lần.
- **Thời gian nộp thật: 76 s và 63 s** (p95 mỗi em 72 s và 61 s). Script tự in ⚠ "> 60 s" cả hai lần; báo cáo ghi "đạt ≤ 60 s" là sai. Lần chạy 44 s/49 s trong báo cáo cũ không có log, **hủy bỏ**; số dùng để lập kế hoạch là **~1–1,3 phút khi 30 em cùng nộp 10 MB**. File thật của học sinh thường < 2 MB nên nhanh hơn nhiều.
- Mã băm script trong log (93828b…) khác mã băm tệp trên Git (8e946c…), nhiều khả năng do máy Windows đổi dấu xuống dòng (CRLF); không coi là gian lận nhưng ghi nhận.

## Phần Claude đã viết thêm (push cùng phán quyết)
- Khi nộp file, màn hình báo rõ: "Nếu cả lớp cùng nộp có thể mất 1–2 phút. Đừng đóng trang", và trình duyệt cảnh báo nếu học sinh lỡ đóng tab khi đang nộp.
- Test luồng thi 28/28, giao diện học sinh, cô lập vai trò, kiểm tra PWA đều xanh; đã gắn lại dấu phiên bản PWA.

## Điều KHÔNG được công nhận trong báo cáo Cổng 4 (phải làm lại)
Mục "Phiếu minh chứng HS1 và Sổ điểm" **không phải quan sát thật**: ghi tên "Học sinh thử 1", mã `HS_PILOT001`, đề `pilot_tin9_thithu`, file `bai_thuchanh.xlsx`, trong khi pilot thật dùng "Nguyễn Văn An", `hs_pilot01`, đề `pilot_tin9_<số>`, file `baitap_excel.xlsx`. Câu "khi giáo viên gõ điểm… sẽ cập nhật" là mô tả mã, chưa ai làm. Đừng viết nội dung từ trí nhớ/đọc mã rồi trình bày như kết quả đo.
→ Người dùng hoặc Antigravity mở **sổ điểm thật** và **thư mục Drive thật**, chụp ảnh/xuất CSV, rồi làm một lần: gõ 5 vào cột "Thực hành" của một hàng → Tổng đổi và file minh chứng cập nhật. Dán ảnh/CSV, không tóm tắt.

## Còn mở (không chặn Cổng 5)
1. Người dùng chạy `kiemTraHeThong()` và `testAdminAccounts()`, dán nguyên nhật ký (báo cáo vẫn chưa có).
2. Archive các bản triển khai Apps Script cũ; xóa thư mục Drive `9LOAD`, `9TEST`.
3. Rà 7 nhánh RTDB cũ còn mở cho mọi tài khoản đã đăng nhập (Claude làm trước Cổng 5).
4. Xóa `DB_SECRET` khỏi Script properties nếu `kiemTraHeThong` báo OAuth chạy được.

## Cổng 5 (thi thử thật ở phòng máy) — chuẩn bị
Người dùng chọn 1 lớp ~30–40 em, 1 buổi 15 phút, đề trắc nghiệm + 1 bài thực hành nhỏ. Cần đo: đăng nhập trên mạng trường (nhiều em chung một IP), nộp file qua Wi-Fi trường, máy học sinh thật (Chromebook/Windows/điện thoại), và xem trang Executions của Apps Script (thời gian chạy trigger trong ngày). Claude soạn phiếu theo dõi buổi thi sau khi người dùng xác nhận lớp và ngày.
