# LỜI NHẮC (PROMPT) GỬI CLAUDE 3.5 SONNET: THẨM ĐỊNH PHÚC TRA VÒNG 7 (CHUYỂN SANG APPROVE)
## DỰ ÁN: SGK DATA STUDIO 2.0 (TKINTER + GEMINI VISION + PYMUPDF)

*(Hãy copy toàn bộ nội dung từ dưới đây và gửi trực tiếp cho Claude 3.5 Sonnet)*

---

Chào bạn Claude 3.5 Sonnet, tôi là Kỹ sư Trưởng hệ thống **AI SGK TIN HỌC THCS (`AI AGENT SGK`)**.

Tôi gửi bạn báo cáo giải trình và đối chiếu kỹ thuật theo đúng **6 Điều kiện chuyển sang APPROVE** trong phán quyết Vòng 6 của bạn tại `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md`.

Mời bạn đọc trực tiếp báo cáo V7 tại:
`.kilo/plans/1791967657542-sonet-tkinter-remediation-resolution-v7.md`

### CÁC TỆP ĐỐI CHIẾU TRỰC TIẾP TRÊN ĐĨA (VÒNG 7):
1. **Điều kiện 1 & 2 (Model động & Log thực tế)**:
   - `tests/run_live_gemini_eval.py` (L73: nạp `os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")`, L102: truyền trực tiếp `model_name=model_name` vào `chat_with_tutor`).
   - `backend/agent.py` (L334: tham số `model_name: Optional[str] = None`, L378-385: gọi API bằng `model_name`).
   - `tests/logs/gemini_live_eval.log` (L1: `Model: gemini-3.5-flash-lite`, L86: `16/16 PASS (0.00% rò rỉ)`).
   - `docs/audits/2026-10-15-sonet-full-approval-dossier.md` (L378-382: Thêm `[!NOTE]` giải trình chuyển giao model từ V4 sang V6).
2. **Điều kiện 3 (Hình 1.2 và mục 2 trang 10 có log và ảnh thật)**:
   - `tools/verify_page_title_vision.py` (L86-108: Trích xuất và gọi Gemini Vision đọc trang index 10).
   - `tools/logs/page_10_sample.png` (Ảnh raster 150 DPI, 740 KB).
   - `tools/logs/verify_page_title_vision.log` (L19-29: Đọc verbatim trang 10: `2. XỬ LÍ THÔNG TIN TRONG MÁY TÍNH` và `Hình 1.2. Các hoạt động xử lí thông tin của máy tính`).
   - `data/curriculum/tin6/bai2.blocks.json` (L15: Ghi chú bản nháp đối chiếu đúng thực tế).
3. **Điều kiện 4 (Test timeout mock và test không có API key)**:
   - `tests/test_extraction_engine.py` (L317-372: `test_extract_and_structure_lesson_timeout_and_http_options_mocked` kiểm chứng `HttpOptions(timeout=30000)` được truyền vào Client và Config).
   - `tests/test_extraction_engine.py` (L374-395: `test_extract_and_structure_lesson_missing_api_key_returns_error` kiểm chứng trả lỗi trước khi gọi API).
4. **Điều kiện 5 (Bảo tồn metadata duyệt, không ép unverified trong bóc tách)**:
   - `backend/extraction_engine.py` (L64-110: `validate_and_sanitize_lesson_package` xóa bỏ hoàn toàn `force_unverified`, dùng `setdefault` bảo tồn 100% metadata `teacher_reviewed=True`, `reviewed_by="teacher"` đã có).
   - `tests/test_extraction_engine.py` (L120-170: `test_validator_forces_draft_and_preserves_review_metadata` kiểm thử PASS).
5. **Điều kiện 6 (Dán stdout pytest thật 156 passed)**:
   - Toàn văn stdout của `python -m pytest tests/ -q` (156 passed trong 34.63s) được dán nguyên văn trong báo cáo V7.

---

### YÊU CẦU ĐỐI VỚI BẠN:
1. Đọc và đối chiếu trực tiếp các dòng mã nguồn và file log nêu trên.
2. Ban hành phán quyết chính thức: cập nhật hoặc ghi đè kết luận thẩm định vào `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md`.
3. Nếu 6 điều kiện đều đã thỏa mãn đầy đủ, vui lòng cấp phán quyết **`[APPROVE]`**.
