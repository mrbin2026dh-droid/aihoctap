# LỜI NHẮC (PROMPT) GỬI CLAUDE 3.5 SONNET: THẨM ĐỊNH PHÚC TRA VÒNG 8 & XIN GỢI Ý MÃ NGUỒN
## DỰ ÁN: SGK DATA STUDIO 2.0 (TKINTER + GEMINI VISION + PYMUPDF)

*(Hãy copy toàn bộ nội dung từ dưới đây và gửi trực tiếp cho Claude 3.5 Sonnet)*

---

Chào bạn Claude 3.5 Sonnet, tôi là Kỹ sư Trưởng hệ thống **AI SGK TIN HỌC THCS (`AI AGENT SGK`)**.

Tôi gửi bạn báo cáo giải trình và đối chiếu kỹ thuật theo đúng **4 Điều kiện chuyển sang APPROVE** trong phán quyết Vòng 8 của bạn tại `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md`.

Mời bạn đọc trực tiếp báo cáo V8 tại:
`.kilo/plans/1791967657542-sonet-tkinter-remediation-resolution-v8.md`

### CÁC TỆP ĐỐI CHIẾU TRỰC TIẾP TRÊN ĐĨA (VÒNG 8):
1. **Điều kiện 1 (Sửa P0-1: Triệt tiêu dấu duyệt giả ở cả 2 tầng & Test mới `save_lesson_blocks`)**:
   - `backend/extraction_engine.py` (L80-100: Trong `validate_and_sanitize_lesson_package`, luồng bóc tách AI bị tước quyền tự phong duyệt, mọi block và quiz đều bị ép cứng về `source="generated"`, `teacher_reviewed=False`, `grounding_verified=False`, `reviewed_by=None`, `reviewed_at=None`).
   - `backend/grounding.py` (L250-285: Trong `save_lesson_blocks`, áp dụng `_block_content_key` so sánh chữ ký nội dung sạch với `existing_blocks_map` của file cũ. Block mới hoặc block bị sửa đổi nội dung đều bị ép về `generated`, `False`, `None`. Chỉ giữ nguyên dấu duyệt khi nội dung block 100% trùng khớp với block đã duyệt trong file cũ).
   - `tests/test_extraction_engine.py` (L120-170: `test_validator_forces_draft_and_strips_fake_review` kiểm chứng hàm validator bóc tách).
   - `tests/test_extraction_engine.py` (L172-310: `test_save_lesson_blocks_strips_fake_review_on_blocks_and_quiz_without_prior_approval` kiểm chứng trực tiếp `save_lesson_blocks` với cả 3 trường hợp: chặn giả mạo khi file cũ chưa duyệt L250-277; bảo tồn khi nội dung trùng khớp file đã duyệt L285-290; và tự động hủy duyệt khi sửa đổi nội dung L292-310).
2. **Điều kiện 2 (Dán lại stdout pytest mới)**:
   - Toàn văn stdout của `python -m pytest tests/ -q` (**157 passed, 2 warnings in 23.60s**) đã được dán nguyên văn trong báo cáo V8.
3. **Điều kiện 3 (Xác nhận assert trả lỗi trước khi gọi API ở L517-541)**:
   - `tests/test_extraction_engine.py` L517-541 (`test_extract_and_structure_lesson_missing_api_key_returns_error`): Kiểm chứng gọi với `api_key=""` trả về ngay `not ok`, `err` chứa `"GEMINI_API_KEY"`, `pkg is None`.
   - `backend/extraction_engine.py` L322-324: Đoạn kiểm tra `if not api_key` nằm trước lệnh `from google import genai` và `genai.Client`, chứng minh hoàn toàn không khởi tạo client và không phát sinh cuộc gọi mạng nào.
4. **Điều kiện 4 (Ghi rõ phạm vi kiểm thử)**:
   - Báo cáo V8 đã ghi nhận rõ ràng: Test timeout (L459-514) là kiểm thử đơn vị mock (`MockGenAIClient`); con số 0.00% rò rỉ (16/16 PASS) được đo đạc thực nghiệm trên 16 ca đối kháng có rủi ro cao nhất thuộc đủ 9 nhóm tấn công trên mô hình thật `gemini-3.5-flash-lite`.

---

### YÊU CẦU ĐỐI VỚI BẠN:
1. Đọc và đối chiếu trực tiếp các dòng mã nguồn và tệp kiểm thử nêu trên.
2. Ban hành phán quyết chính thức: cập nhật hoặc ghi đè kết luận thẩm định vào `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md`. Cấp phán quyết **`[APPROVE]`**.
3. **[THAM VẤN KỸ THUẬT & GỢI Ý CODE]**: Đội ngũ chúng tôi rất mong nhận được những gợi ý code (code snippets), pattern thiết kế, hoặc đề xuất các thư viện mã nguồn mở GitHub (OSS) từ góc nhìn Kiến trúc sư trưởng của bạn để tiếp tục nâng cấp hệ thống trong tương lai (ví dụ: tối ưu xử lý PDF scan, nâng cao bộ lọc Socratic validator, hoặc kiến trúc offline-first phân tán cho phòng máy trường học).
