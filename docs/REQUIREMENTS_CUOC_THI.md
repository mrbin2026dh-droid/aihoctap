# Yêu cầu cuộc thi Giáo viên sáng tạo ứng dụng AI 2026 và bảng nghiệm thu
Chủ dự án: người dùng. Mọi AI đọc tệp này trước khi làm tính năng. Người kiểm: Claude. Cập nhật lần cuối: 24/10/2026.

Ký hiệu: `[x]` Claude đã tự kiểm chứng THẬT · `[~]` có mã, mới kiểm bằng MOCK hoặc theo lời báo cáo, chưa tự kiểm THẬT · `[ ]` chưa có hoặc chưa đạt. Chỉ Claude được đổi `[~]` thành `[x]`.

## Nguyên tắc cố định
1. Giao diện đẹp, đúng chuẩn quốc tế (WCAG AA, nút >= 44px, mobile-first). Học sinh dùng điện thoại là chính. Hạn chế icon, câu chữ ngắn, không rườm rà.
2. PWA: cài lên màn hình chính, học ngoại tuyến, cập nhật phiên bản.
3. AI chỉ hoạt động khi có mạng, hướng dẫn và định hướng đánh giá, CẤM TUYỆT ĐỐI đưa đáp án (kể cả khi học sinh ép, lách luật).
4. Tính mở: thêm môn học mới bằng dữ liệu qua giao diện giáo viên, không sửa mã, không deploy lại.
5. Dữ liệu THẬT do người dùng tạo; AI hướng dẫn từng bước; cấm hardcode; báo cáo phân biệt THẬT/MOCK (AGENTS.md mục D).

## A. Học sinh
- [~] A1 Đăng nhập học sinh bằng mã + PIN do giáo viên cấp (ACCEPT mã; M1–M4 còn, chưa tự kiểm THẬT).
- [~] A2 Học lý thuyết.
- [~] A3 Bài tập vận dụng trắc nghiệm, chấm ở máy chủ, không lộ đáp án.
- [ ] A4 Đề thi thử do giáo viên giao: làm 1 lần, xếp hạng, đánh giá sau thi.
- [ ] A5 AI định hướng sau thi (điểm mạnh/yếu, ôn gì), không nêu đáp án.
- [ ] A6 Tải tài liệu giáo viên đăng, mở ngoại tuyến.
- [~] A7 Gia sư AI Socrates (cần bộ test đối kháng chứng minh không lộ đáp án).
- [ ] A9 Học sinh xem số lượt AI còn lại; hết lượt thì AI dừng với thông báo thân thiện.
- [~] A8 PWA cài đặt, ngoại tuyến, cập nhật.
## B. Giáo viên
- [~] B1 Đăng nhập giáo viên (route có; thiếu khóa thử sai, M1).
- [~] B2 Đăng bài học (route có, đáp án tách riêng; N1–N4 còn, chưa tự kiểm THẬT).
- [~] B3 Đăng tài liệu (route liên kết có; N4 còn; học sinh chưa có tab tài liệu).
- [ ] B4 Đăng và giao đề thi.
- [ ] B5 Quản lý tài khoản học sinh (tạo, đặt lại PIN, khóa/mở).
- [~] B6 Thống kê, báo cáo (route kết quả có; chưa có thống kê theo lớp/câu/chủ đề, xuất CSV).
- [ ] B7 Giáo viên đặt hạn mức AI (mặc định, theo lớp, theo học sinh), khóa/mở, cấp thêm lượt, xem thống kê và xuất CSV.
## C. Chung
- [~] C1 Tính mở nhiều môn không sửa mã (test MOCK thêm môn `toan9` đạt; N3 còn).
- [~] C2 Giao diện chuẩn quốc tế (bản hiện tại khá gọn; chưa đo WCAG, Lighthouse, điện thoại thật).
- [ ] C5 Nhiều khóa Gemini, cân bằng tải, hết hạn mức thì dừng và báo giáo viên (chưa có).
- [~] C3 Bảo mật, hạn mức và chi phí Gemini (L1–L5 ACCEPT; M1–M4 còn; người dùng đặt hạn mức khóa Gemini).
- [ ] C4 Kiểm thử cuối trên điện thoại thật và bản dùng thử cho ban giám khảo.

## Đặc tả chi tiết
`docs/plans/2026-10-24-contest-features-spec.md` (giai đoạn 1–4). Đã chốt: D1 tài liệu lưu ở Google Drive qua Worker; hạn mức Gemini dùng nhiều khóa, hết thì dừng và báo giáo viên (mục cuối đặc tả).

## Thứ tự làm
C3/A1 → B1–B2/C1 → A2–A3 → B3, A6 → B4, A4–A5 → B5–B6 → A7 → giao diện (ChatGPT) → A8, C2, C4.
