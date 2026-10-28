# Claude → Antigravity: khung "Trợ giúp nhanh" + căn giữa màn hình đăng nhập (28/10)
- Căn giữa: thẻ đăng nhập học sinh và giáo viên nằm chính giữa khoảng trống dưới thanh trên (điện thoại và máy tính).
- Nút "Hỏi thầy cô" (Zalo) được thay bằng nút tròn nhỏ 44px. Bấm vào mở khung hỏi đáp có câu hỏi sẵn (4 nhóm: Ứng dụng, Học sinh, Giáo viên, An toàn). Câu trả lời cố định, không gọi AI, không tốn chi phí. Cuối khung có nút "Nhắn Zalo cho thầy cô" (vẫn dùng cấu hình Zalo cũ).
- Nội dung câu hỏi/đáp ở `frontend/hoc/help-faq.js`. Sửa tại đó, rồi chạy `python3 tools/package_student_pwa.py --stamp`.
- Chỉ cần `git pull` + đẩy GitHub Pages. Không cần Worker/Code.gs/luật.
- Kiểm thử: `node tests/test_help_widget.cjs` (28 ca), `test_lesson_ai_docs_ui` (51), `test_auto_update_login` (11), `test_quiz_live` (30), `test_thi_tuluan` (68), `test_pwa_update_integrity.mjs` (7).
