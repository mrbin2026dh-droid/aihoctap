# Bàn giao cho Antigravity: Worker mới (xóa thống kê bài kiểm tra)

Claude đã thêm `DELETE /api/pwa/teacher/exams/{exam_id}/results` (xóa attempts, attempt_details, exam_sessions của đề và reset bộ đếm lượt trong Durable Object `/reset-exam-submissions`).
Giao diện giáo viên: nút icon thùng rác cạnh "Xuất Excel", icon hóa nút thao tác, trình sửa câu hỏi trực tiếp (frontend, tự cập nhật qua GitHub Pages).

## Việc cần làm (trên máy PC)
1. `git pull` rồi `npx wrangler deploy` trong thư mục `worker` (hoặc cấu hình hiện có). Không cần đổi `database.rules.json`.
2. Ghi ID phiên bản Worker mới vào `aisgk.md`.
3. Smoke test: đăng nhập giáo viên → Kiểm tra → Thống kê một đề thử → bấm icon thùng rác → xác nhận → số bài nộp về 0; học sinh làm lại được đề.
