# Bàn giao cho Antigravity & Người dùng: Worker mới (xóa thống kê bài kiểm tra, icon thao tác, sửa câu hỏi)
Từ: Claude → Antigravity → Người dùng   Ngày: 2026-10-26 (Asia/Bangkok)

## 1. Kết quả triển khai Worker
- Commit: `10a6766`
- ID bản cũ: `b0df0cc6-5973-42ed-b8a0-e27feab0d04b`
- ID bản mới: `cdb02c29-92cb-4562-8229-75fc3a025038`
- Route mới: `DELETE /api/pwa/teacher/exams/{exam_id}/results` (xóa attempts, attempt_details, exam_sessions của đề và reset bộ đếm lượt trong Durable Object `/reset-exam-submissions`).

## 2. Kết quả Smoke Test Thật (Live Production)
- `GET https://aihoctap-gate.mrbin2026dh.workers.dev/api/health` → 200 OK (`{"status":"healthy","serverless":true}`)
- `DELETE https://aihoctap-gate.mrbin2026dh.workers.dev/api/pwa/teacher/exams/dummy/results` (không token) → 401 Unauthorized (`{"detail":"Thiếu token xác thực."}`)
- Backend unit tests (`tests/test_exam_backend.mjs`): PASS 100%.

## 3. Hướng dẫn Người dùng kiểm tra trên giao diện (GitHub Pages tự cập nhật)
1. Đăng nhập giao diện Giáo viên: `https://mrbin2026dh-droid.github.io/teacher.html` (hoặc `/hoc/teacher.html`).
2. Vào mục **Kiểm tra**:
   - Các nút thao tác (Mở/Đóng đề, Theo dõi, Thống kê, Sửa) đã chuyển thành dạng icon chuẩn 48px.
   - Thêm/sửa đề: Có phân vùng **Danh sách câu hỏi (sửa trực tiếp)** dạng thẻ, cho phép sửa trực tiếp câu hỏi, các lựa chọn và đáp án đúng.
3. Kiểm tra **Nút xóa thống kê**:
   - Bấm vào mục **Thống kê** của một đề kiểm tra đã có bài nộp thử.
   - Nhìn bên cạnh nút "Xuất Excel": xuất hiện **nút icon thùng rác màu đỏ** (`#act-exams-clear`).
   - Bấm vào icon thùng rác: xuất hiện hộp thoại xác nhận ("Xóa toàn bộ thống kê?"). Bấm "Hủy" không xóa; bấm "Xóa thống kê" thì gửi lệnh DELETE.
   - Số bài nộp về 0, bảng xếp hạng và biểu đồ điểm được làm trống. Học sinh có thể vào làm lại đề đó từ đầu.
