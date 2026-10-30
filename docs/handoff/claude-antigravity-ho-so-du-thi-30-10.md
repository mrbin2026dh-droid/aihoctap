# Claude → Antigravity: cập nhật Trợ giúp nhanh + phán quyết Bảng thi đua (30/10/2026 chiều)

## Phán quyết `antigravity-claude-thi-dua-xong.md`: ĐẠT phần emulator và deploy Pages; CHƯA thử thật
- Đạt: emulator `THI DUA RULES OK` (14/14), `THI THAT RULES OK`, rules-merged 69, rules 45. Pages lên `?v=20261030c`.
- `rules-thi-fast.test.mjs` có 1 ca lỗi là đúng: ca đó ghi `thi_nop` thi thật không đổi trạng thái, luật mới chặn có chủ đích (đã thay bằng `rules-thi-that.test.mjs`).
- **Chưa xong (cần thầy):** đăng luật lên Firebase Console và cập nhật Apps Script. Chưa đăng luật thì Bảng thi đua và Thi thật báo lỗi khi lưu trên bản thật.

## Việc mới
- `frontend/hoc/help-faq.js`: viết lại khung Trợ giúp nhanh đúng tính năng hiện có (Luyện tập trực tiếp + Bảng thi đua, Thảo luận, Thi thật theo ca, Gia sư phạm vi bài, AI có trách nhiệm) và thêm nhóm **Phát triển** (dự kiến: mở rộng môn, quản lý nhiều bộ, báo cáo học kỳ, phụ huynh; ghi rõ "dự kiến").
- `tests/test_help_widget.cjs`: kiểm 5 nhóm và nhóm Phát triển (32/32 PASS). `sw.js` đã đóng dấu lại; PWA P1–P7 và chuẩn UI học sinh PASS.
- `docs/du-thi/Kich-ban-video-AI-Hoc-Tap.docx`: kịch bản video 5 phút (8 cảnh, khoảng 490 từ lời thoại), danh sách cảnh quay, 8 câu hỏi Ban giám khảo.

## Việc của Antigravity
1. `git pull`, deploy Pages. Mở https://aihoctap.online → Trợ giúp nhanh → có 5 nhóm, nhóm Phát triển trả lời được. Chụp ảnh ở khổ điện thoại.
2. Hỗ trợ thầy (thầy tự đăng nhập, không gõ mật khẩu hộ):
   - Đăng luật Firebase.
   - Cập nhật Apps Script (handoff thi thật bước 3 và 5).
   - Thử 2 buổi Bảng thi đua bằng `tests/sim/auto_students_quiz_live.cjs`.
   - Chụp ảnh thật cho slide và poster theo danh sách trong tài liệu "Hồ sơ dự thi AI Học Tập – phân tích và bộ prompt".
3. Báo cáo `docs/handoff/antigravity-claude-ho-so-du-thi-xong.md`; ghi rõ phần nào trên bản thật, phần nào giả lập. Commit, push, cập nhật `aisgk.md`.
