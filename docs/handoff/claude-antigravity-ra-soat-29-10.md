# Claude → Antigravity: rà soát toàn hệ thống sáng 29/10 (ngày thi thật)

## 1. Claude đã sửa (đã đẩy GitHub; Pages tự phát hành)
- **Bỏ thẻ `Content-Security-Policy: upgrade-insecure-requests`** (Antigravity thêm tối 28/10).
  - Lý do: thẻ này làm hỏng 4 bộ kiểm thử giao diện (trang chạy http trong kiểm thử, mọi tệp JS bị nâng sang https nên không nạp được).
  - Trang thật không cần thẻ này: GitHub Pages đã bắt HTTPS, ứng dụng không nạp tệp http nào.
  - Đoạn script chuyển sang https vẫn giữ, nhưng chỉ chạy trên `aihoctap.online` (không đụng máy khác, máy kiểm thử).
- **Trực tuyến:**
  - Khi khóa Google chặn tên miền (lỗi `identitytoolkit 403` hiện tại), học sinh đăng nhập qua Worker trước đây **mất hẳn** trạng thái trực tuyến và không đếm phút. Nay app tự chuyển sang chế độ nhanh (không cần vé).
  - Mở lại app sau khi đã nộp bài: chuyển về "Đang học", không kẹt "Đã nộp" (trước đây kẹt thì không đếm phút học).
  - Trang giáo viên: màn hình Thi và Tài khoản cùng nghe trạng thái trực tuyến. Trước đây có thể mở 2 kết nối chồng nhau; nay chỉ giữ 1 kết nối, màn hình mở sau nhường màn hình mở trước.
- **Kiểm lại điểm thi (mới):** điểm do máy học sinh tự tính rồi gửi lên Firebase, nên một em rành kỹ thuật có thể sửa điểm.
  - Trang giáo viên → Thi → bài thi: hệ thống tự tính lại điểm từ câu trả lời + đáp án trong đề.
  - Bài nào không khớp hiện **"⚠ tính lại x/y"** màu đỏ, ở cả bảng kết quả và cột "Đã nộp".
- **Bộ não:** 3 ngày đầu đo thời gian học, báo cáo ghi "không học trên app từ 29/10 (ngày bắt đầu đo)" thay vì "7 ngày qua", để không kết luận sai. Thẻ "Chưa học 7 ngày" trên trang Tài khoản đổi chữ tương tự.
- **Giao diện học sinh:** sửa 2 lỗi chuẩn giao diện:
  - logo trên điện thoại hẹp hơn vùng chạm 44px;
  - dòng "© 2026" chữ 14px (dưới mức tối thiểu).
- **Kiểm thử:**
  - Mới: `test_check_score` 8 ca; Bộ não 21 ca.
  - Sửa `test_presence_ui` theo hành vi mới; `test_teacher_shell` chờ ô tìm kiếm vẽ xong rồi mới đo nút (trước đó lúc đạt lúc không).
  - Chạy lại toàn bộ: các bộ chính đều đạt (xem mục 3).
- **Đã thử trực tiếp trên aihoctap.online:**
  - Luật `thoi_gian` chạy đúng: cộng 1 phút được, nhảy số bị chặn. Ghi thử vào ngày giả 2000-01-01 rồi đã xóa.
  - Bản mới đã nằm sẵn trong bộ nhớ app, chờ học sinh bấm cập nhật.

## 2. Việc còn lại
1. **THẦY làm (Antigravity không có quyền):** Google Cloud Console → khóa API web dự án `ai-sgk-tinhoc` → Website restrictions → thêm `https://aihoctap.online/*` → Save. Hôm nay 6:30 kiểm trên trang thật **vẫn bị chặn**.
2. **Trước giờ thi:**
   - Học sinh mở app, thấy thông báo cập nhật thì bấm Cập nhật (hoặc đóng app mở lại).
   - Giáo viên lớp nên đổi PIN thành mật khẩu dài ≥ 10 ký tự có chữ và số (xem mục 4).
3. **Antigravity:** không cần deploy Worker. Chỉ `git pull`, chạy lại `setup.sh` trên VPS (Bộ não 21 ca) và ghi kết quả vào `docs/handoff/antigravity-claude-ra-soat-xong.md`.

## 3. Kết quả chạy lại toàn bộ kiểm thử
- Đạt:
  - giáo viên (shell, thi 136, kết quả, tổng quan, hiệu quả, điều hướng điện thoại);
  - học sinh (thi Firebase, thi Sheet, tự luận, trò chơi 30, trực tuyến, cài app, loading, trợ giúp, chuẩn giao diện 0 vi phạm);
  - Worker (gate, guardrails, đa tên miền, phạm vi giáo viên, AI chấm 19, AI giáo viên 22);
  - Bộ não 21; kiểm điểm 8.
- Không chạy được, **không phải lỗi hôm nay**, là kiểm thử cũ của hệ thống trước đây:
  - `test_decuong_tin8_tin9_e2e`: thiếu tệp `scratch/` không có trong kho.
  - `audit_settings_behavior`: kịch bản dò giao diện kiểu cũ, không phải bộ kiểm thử.

## 4. Giới hạn kiến trúc (ghi trung thực, làm sau cuộc thi)
Thi nhanh qua Firebase để học sinh không phải chờ, đổi lại máy học sinh đọc/ghi thẳng Firebase không qua máy chủ. Hệ quả:
| Điểm yếu | Mức | Hôm nay làm gì | Sau cuộc thi |
|---|---|---|---|
| `thi_hs`, `thi_gv` đọc công khai, kèm mã băm `sha256(mã:PIN)`; PIN 6 số dò ra trong vài giây | Cao (nhất là tài khoản giáo viên) | Giáo viên đổi PIN dài có chữ; học sinh không đổi kịp thì chấp nhận | Đăng nhập kiểm ở Worker, đóng quyền đọc 2 nhánh này |
| `thi_de` đọc công khai, có đáp án; em biết đường dẫn Firebase thì xem được | Trung bình (cần biết kỹ thuật) | Thi có giám sát; đã ghi ở mục II báo cáo minh chứng | Chấm ở Worker, đề gửi xuống không kèm đáp án |
| Điểm tự tính trên máy học sinh | Trung bình | **Đã có cảnh báo "⚠ tính lại"** | Chấm ở Worker |
| Không có vé: một em có thể nộp thay bạn chưa nộp | Thấp | Giáo viên bấm "Cho thi lại" cho em bị nộp thay | Ghi bài nộp kèm vé học sinh |
| `presence`, `thoi_gian` ghi không cần vé; em rành kỹ thuật có thể cộng phút giả (tối đa 1440 phút/ngày) | Thấp | Số phút là số tham khảo | Ghi kèm vé, giới hạn tốc độ |
