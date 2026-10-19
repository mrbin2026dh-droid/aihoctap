# LỜI NHẮC (PROMPT) GỬI CLAUDE 3.5 SONNET: THẨM ĐỊNH PHÚC TRA VÒNG 9 (CẤP APPROVE CHÍNH THỨC)
## DỰ ÁN: SGK DATA STUDIO 2.0 (TKINTER + GEMINI VISION + PYMUPDF)

*(Hãy copy toàn bộ nội dung từ dưới đây và gửi trực tiếp cho Claude 3.5 Sonnet)*

---

Chào bạn Claude 3.5 Sonnet, tôi là Kỹ sư Trưởng hệ thống **AI SGK TIN HỌC THCS (`AI AGENT SGK`)**.

Tôi gửi bạn báo cáo giải trình và đối chiếu kỹ thuật theo đúng **3 Điều kiện để APPROVE** trong phán quyết Vòng 9 của bạn tại `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md`.

Mời bạn đọc trực tiếp báo cáo V9 tại:
`.kilo/plans/1791967657542-sonet-tkinter-remediation-resolution-v9.md`

### CÁC TỆP ĐỐI CHIẾU TRỰC TIẾP TRÊN ĐĨA (VÒNG 9):
1. **Điều kiện 1 (Ghi rõ cơ chế nạp `.env` & Bổ sung test không monkeypatch `load_dotenv` - P1-1)**:
   - `backend/extraction_engine.py`:
     + L233-238: Hàm nạp `.env` và `backend/.env` qua `dotenv.load_dotenv` nếu `api_key` rỗng.
     + L322-324: Đoạn kiểm tra `if not api_key` nằm trước lệnh `from google import genai` và `genai.Client`, trả về `(False, "Chưa cấu hình GEMINI_API_KEY trong tệp .env.", None)`.
   - `tests/test_extraction_engine.py`:
     + L540-564: Test mới `test_extract_and_structure_lesson_missing_key_in_real_env_file` chạy `dotenv.load_dotenv` THẬT (không monkeypatch), trỏ vào `.env` rỗng trong `tmp_path`, chứng minh trả lỗi trước khi khởi tạo client.
2. **Điều kiện 2 (Dán lại stdout pytest mới - P1-2)**:
   - Toàn văn stdout của `python -m pytest tests/ -q` (**158 passed, 2 warnings in 23.72s**) đã được dán nguyên văn trong báo cáo V9.
3. **Điều kiện 3 (Ghi rõ 16 ca là mẫu chọn lọc - P1-3)**:
   - Báo cáo V9 Mục 3 đã ghi nhận rõ: 16 ca (`tests/logs/gemini_live_eval.log`) là **mẫu chọn lọc đại diện** có rủi ro cao nhất thuộc đủ 9 nhóm tấn công sư phạm được gọi vào API thật của `gemini-3.5-flash-lite` (đạt 16/16 PASS, 0.00% rò rỉ). Bộ 100 ca đối kháng (`tests/test_adversarial_evals.py`) chạy trong CI/CD (158 passed) bằng mock và fallback rule-based.

---

### YÊU CẦU ĐỐI VỚI BẠN:
1. Đọc và đối chiếu trực tiếp các dòng mã nguồn và tệp kiểm thử nêu trên.
2. Ban hành phán quyết chính thức: cập nhật kết luận thẩm định vào `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md`. Cấp phán quyết **`[APPROVE]`**.
3. **[GỢI Ý MÃ NGUỒN & THƯ VIỆN OSS]**: Tiếp nối 3 hướng gợi ý kiến trúc rất hay của bạn ở Vòng 9 (Tách OCR cục bộ để bật lại `grounding_verifier`, kiểm định ngữ nghĩa Socratic bằng embedding/NLI n-gram, và bundle file phiên bản hóa cho Offline-first trường học), nhờ bạn phác thảo thêm một vài đoạn **code mẫu (code snippets) hoặc pseudo-code kiến trúc** minh họa cách cài đặt các tầng này trong Python/FastAPI để đội ngũ kỹ sư có thể tích hợp ngay trong các sprint tiếp theo.
