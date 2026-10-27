# Hoàn thiện hệ thống thi — việc của người dùng
Từ: Claude → Sang: Người dùng   Ngày: 27/10/2026

## Kiểm định báo cáo Antigravity (antigravity-claude-kiem-dinh-apps-script-cong5.md): ĐẠT
kiemTraHeThong ĐẠT TOÀN BỘ bằng OAuth; load_gate4 5 HS đạt (log docs/evidence, lần chạy đầu lỗi do token quản trị hết hạn, lần sau đạt); Pages mang dấu SW `b8619930…` khớp mã. Theo yêu cầu người dùng, từ nay không chờ Antigravity kiểm thử: người dùng dùng thật và báo lỗi.

## Claude đã viết thêm (commit này)
1. **Gia hạn khi đang thi**: tab `DE_…` cho đổi Tiêu đề, Số phút, Đóng lúc, Số lượt khi đã có học sinh vào; câu hỏi/đáp án/khối/điểm vẫn khóa; đề đã chốt thì khóa hết.
2. **Một danh sách cho cả hai hệ thống**: Sheet cấp phát nhận luôn mẫu Excel của trang giáo viên (thứ tự Khối/Lớp theo dòng tiêu đề).
3. **Hướng dẫn giáo viên đầy đủ**: `docs/huong-dan-giao-vien-thi-firebase.md` (tài khoản, soạn đề, trong giờ thi + bảng xử lý sự cố, chấm điểm, giới hạn).
4. Test giả lập Apps Script 35 ca đạt; PWA không đổi.

## Người dùng làm
1. Dán `apps-script/exam/Code.gs` mới → Lưu → **Deploy New version** → chạy `kiemTraHeThong` (dòng cuối ĐẠT TOÀN BỘ).
2. Dán `apps-script/provisioning/Code.gs` mới vào dự án cấp phát → Lưu.
3. Mở ứng dụng cũ (Dạy học tương tác) bằng tài khoản giáo viên cũ, xác nhận còn chạy (luật mới đã publish).
4. Đọc `docs/huong-dan-giao-vien-thi-firebase.md`, rồi làm thi thử theo `docs/plans/cong5-thi-thu-phong-may.md`.
5. Gặp lỗi: gửi Claude thời điểm, mã đề, mã học sinh (không gửi PIN), ảnh màn hình, nội dung ô C9.
