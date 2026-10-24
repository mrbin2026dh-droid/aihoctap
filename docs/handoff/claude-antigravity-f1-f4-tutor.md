# Bàn giao: Claude → Antigravity (sửa F1–F4 gia sư AI)
Đọc `docs/audits/2026-10-24-e1e5-n1n7-verdict.md`. Quy trình chuẩn: context7, TDD FAIL-first, oxlint, node --check, bằng chứng vào log. Không deploy.

1. F1 Chính sách thang gợi ý: không liệt kê đầy đủ tập đáp án, không đưa cặp nhị phân, không nhắc lại định nghĩa chứa từ khóa đáp án; hỏi ngược dẫn dắt. Thêm vào system prompt + test ngữ nghĩa cho các ca adv_v2_001/010/014/023/027/040/041.
2. F2 Lọc đầu ra phía server: lấy text đáp án đúng (options công khai + chữ cái từ `packages_private`), KHÔNG đưa vào ngữ cảnh model; nếu câu trả lời chứa text đáp án đúng thì sinh lại 1 lần, vẫn lỗi thì trả gợi ý chung. Đáp án không được vào log.
3. F3 Bỏ câu mở đầu tiếng Anh; trả lời tiếng Việt; khi từ chối lạc đề không chèn trước nội dung đúng chủ đề.
4. F4 Gắn nguồn (`real_gemini`/`rule_fallback`) theo nhóm trong báo cáo; báo cáo số thật (vd 47+1), không ghi "48/48 Gemini".
5. Chạy lại eval live (cần khóa Gemini của người dùng, không in khóa), ghi log, rồi trả Claude xem ngữ nghĩa từng câu.
Sau ACCEPT mới làm tiếp hàng đợi `claude-antigravity-queue.md`.
