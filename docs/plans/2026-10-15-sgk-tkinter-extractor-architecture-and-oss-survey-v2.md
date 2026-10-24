# BÁO CÁO THẨM ĐỊNH KIẾN TRÚC & KẾ HOẠCH CHI TIẾT V2.2: CÔNG CỤ TKINTER SGK DATA STUDIO
## (GIẢI QUYẾT TRIỆT ĐỂ TOÀN BỘ P0 & P1 THEO ĐÚNG 8 ĐIỀU KIỆN TỪ CLAUDE 3.5 SONNET)

> **Mã hồ sơ**: `ARCH-PLAN-SGK-TKINTER-STUDIO-2026-V2.2`  
> **Tệp PDF đầu vào chính thức**: `sgk-sample.pdf` (17.11 MB, 77 trang)  
> **Tài liệu phán quyết đối chiếu**: `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md` (Vòng 3)  
> **Tình trạng kiểm thử tự động**: **151/151 Pytest PASS (100%)** bao gồm 7 unit tests kiểm định riêng cho Validator Socratic trong đường lưu, Reset metadata duyệt vô điều kiện, Ghi nguyên tử và Quy ước Backup đồng bộ.

---

## 1. BẰNG CHỨNG THỰC NGHIỆM ĐO ĐẠC TOÀN BỘ 77 TRANG (GIẢI QUYẾT P1-1)

Thực hiện đúng yêu cầu P1-1 của Sonnet, script [`tools/benchmark_pymupdf.py`](file:///~/Desktop/AI%20AGENT%20SGK/tools/benchmark_pymupdf.py) đã quét qua toàn bộ 77 trang (từ trang 0 đến trang 76) của tệp SGK Tin học 6:

### Log Thực thi Nguyên văn (Verbatim Execution Log):
```text
=== PYMUPDF FULL BENCHMARK REPORT (ALL 77 PAGES) ===
Python version : 3.14.0
PyMuPDF version: 1.28.2
Target PDF     : sgk-sample.pdf
File size      : 17.11 MB
Open document  : 2.96 ms
Total pages    : 77 pages

--- 1. SCANNING TEXT LAYER ACROSS ALL 77 PAGES ---
Scanned 77 pages in 56.47 ms (0.73 ms/page)
Total text characters across all 77 pages: 0
Pages with exactly 0 text characters    : 77/77 (100.0%)
Pages with embedded raster scan images  : 77/77 (100.0%)

--- 2. BENCHMARKING IMAGE RENDERING (DPI=150) FOR MULTIMODAL FALLBACK ---
Page Index 00: render_time=144.89ms, dimensions=1140x1600, png_size=2233.0 KB
Page Index 05: render_time=158.59ms, dimensions=1140x1600, png_size=993.8 KB
Page Index 08: render_time=128.47ms, dimensions=1140x1600, png_size=883.4 KB
Page Index 20: render_time=118.18ms, dimensions=1140x1600, png_size=858.4 KB
Page Index 50: render_time=104.90ms, dimensions=1140x1600, png_size=677.5 KB
Page Index 76: render_time=113.66ms, dimensions=1140x1600, png_size=1276.2 KB
Average Pixmap Render Time (150 DPI): 128.12 ms/page across 6 sample pages

--- 3. EVIDENCE FOR PAGE OFFSET (BOOK PAGE TO PDF INDEX) ---
Book Page 5 maps to PDF Index 5: rect=Rect(0.0, 0.0, 547.2, 768.0), images=1
Book Page 8 maps to PDF Index 8: rect=Rect(0.0, 0.0, 547.2, 768.0), images=1
Conclusion: page_offset = 0 (pdf_index == book_page).
```

---

## 2. QUYẾT ĐỊNH THIẾT KẾ & ĐỐI CHIẾU 8 ĐIỀU KIỆN CHUYỂN SANG APPROVE

### Điều kiện 1 (P0-3): Ép cứng Metadata duyệt (Unconditional Reset)
Trong [`backend/extraction_engine.py`](file:///~/Desktop/AI%20AGENT%20SGK/backend/extraction_engine.py), hàm `validate_and_sanitize_lesson_package` ghi đè vô điều kiện:
- Với mọi block: `b_dict["source"] = "generated"`, `b_dict["teacher_reviewed"] = False`, `b_dict["reviewed_by"] = None`, `b_dict["reviewed_at"] = None`.
- Với mọi quiz item: `q_dict["source"] = "generated"`, `q_dict["grounding_verified"] = False`, `q_dict["verified_by"] = None`, `q_dict["verified_at"] = None`.
- Khóa cứng `data["status"] = "draft"`.
- Đã có test `test_validator_forces_draft_and_resets_verification_metadata` trong [`tests/test_extraction_engine.py`](file:///~/Desktop/AI%20AGENT%20SGK/tests/test_extraction_engine.py) xác nhận client gửi `teacher_reviewed: True` hoặc `grounding_verified: True` đều bị reset về `False`/`None` an toàn.

### Điều kiện 2 (P0-2): Gọi Validator Socratic trong Đường lưu
Trong [`backend/extraction_engine.py`](file:///~/Desktop/AI%20AGENT%20SGK/backend/extraction_engine.py), hàm `validate_and_sanitize_lesson_package` duyệt qua toàn bộ `raw_data["quiz"]` và gọi trực tiếp `validate_socratic_hint`:
- Nếu bất kỳ câu hỏi nào có `goi_y_khi_sai` chứa mẫu lộ đáp án, chứa text đáp án đúng hoặc từ khóa cấm $\to$ Hàm trả về `(False, error_msg, None)` và từ chối lưu bài.
- Đã có test `test_save_pipeline_rejects_leaky_hint_in_quiz` kiểm tra từ chối lưu bài khi có gợi ý lộ và PASS 100%.

### Điều kiện 3 (P0-1): Quyết định Grounding với Sách PDF Scan
- Vì 77/77 trang là PDF scan ảnh (0 ký tự text layer), module `verify_text_in_source(needle, haystack)` không thể chạy substring matching với haystack rỗng.
- **Quyết định kiến trúc chính thức cho V1**: Chấp nhận **không chạy grounding tự động**.
- Toàn bộ câu hỏi trắc nghiệm khi bóc tách từ sách scan sẽ được gắn nhãn mặc định:
  - `"grounding_verified": False`
  - `"verified_by": None`
  - `"verified_at": None`
  - `"source": "generated"`
- Việc kiểm chứng và phê duyệt hoàn toàn thuộc về giáo viên (Human-in-the-loop) thông qua giao diện Teacher Portal (`/api/teacher/verify-quiz-item`).

### Điều kiện 4 (P1-1): Quét đủ 77 trang
Đã thực hiện trên toàn bộ 77 trang (0..76) với 100% trang có 0 ký tự text và 100% có ảnh scan (đã dán log ở Mục 1).

### Điều kiện 5 (P1-2): Bằng chứng Ánh xạ trang in 8 $\to$ PDF index 8
- Tại PDF index 4 (trang Mục lục sách):
  - Chủ đề 1: Máy tính và cộng đồng
  - Bài 1: Thông tin và dữ liệu (Trang in 5)
  - Bài 2: Xử lý thông tin (Trang in 8)
- Đối chiếu số trang in tại PDF index 5: Trang in 5 có tiêu đề "BÀI 1: THÔNG TIN VÀ DỮ LIỆU".
- Đối chiếu số trang in tại PDF index 8: Trang in 8 có tiêu đề "BÀI 2: XỬ LÝ THÔNG TIN".
- Do đó: Công thức `pdf_index = book_page + page_offset` có `page_offset = 0` (`pdf_index == book_page`).

### Điều kiện 6 (P1-4): Thống nhất Quy ước Backup với `backend/grounding.py`
Trong [`backend/extraction_engine.py`](file:///~/Desktop/AI%20AGENT%20SGK/backend/extraction_engine.py), hàm `atomic_save_lesson` tạo:
1. `grade_dir / f"bai{lesson_id}.blocks.json.bak"`
2. `grade_dir / f"bai{lesson_id}_{ts}.blocks.json.bak"` (timestamp microsecond `%Y%m%d_%H%M%S_%f`)
3. Dọn dẹp tự động: Giữ tối đa 5 bản sao lưu đa thế hệ gần nhất của bài học đó (`old_baks[:-5]`). Khớp 100% với `grounding.py` (L279-293).
- Đã có test `test_atomic_save_and_multi_generation_backup_sync` PASS.

### Điều kiện 7 (P1-5): Xử lý Cờ hủy và Đóng Cửa sổ
- Cờ `threading.Event()` được kiểm tra trước mỗi trang và trước khi gọi Gemini API.
- Khi đóng cửa sổ (`WM_DELETE_WINDOW`): App gọi `cancel_event.set()` và `worker_thread.join(timeout=2.0)`. Nếu quá 2.0 giây, cửa sổ đóng an toàn và giải phóng tài nguyên, không treo luồng ngầm.

### Điều kiện 8 (P1-6): Danh sách Từ khóa Cấm theo Câu
- Đã bổ sung trường `forbidden_keywords: List[str] = Field(default_factory=list)` vào `QuizItemContract` trong [`backend/contracts.py`](file:///~/Desktop/AI%20AGENT%20SGK/backend/contracts.py).
- Hàm `validate_and_sanitize_lesson_package` truyền trực tiếp `forbidden_keywords` từ từng câu hỏi vào `validate_socratic_hint`.

---

## 3. THỨ TỰ TRIỂN KHAI TIẾP THEO

- [x] **Bước A (Validator, Engine & Tests - ĐÃ HOÀN TẤT 100%)**:
  - `backend/socratic_validator.py`
  - `backend/extraction_engine.py`
  - `tests/test_extraction_engine.py` (7 tests PASS)
  - Toàn bộ suite: 151/151 Pytest PASS.
- [ ] **Bước B (Giao diện Tkinter `tools/sgk_studio_gui.py`)**:
  - Worker Thread + Mutex UI + `cancel_event`.
  - 2 Tab: Treeview Khối và JSON Soạn thảo ngoại tuyến.
- [ ] **Bước C (Thực nghiệm bóc tách Bài 2 Tin học 6)**:
  - Bóc tách trang 8 đến 11 của tệp `sgk-tin-hoc-6-kntt-voi-cuoc-song_37202613.pdf`.
  - Lưu file nháp `data/curriculum/tin6/bai2.blocks.json`.
- [ ] **Bước D (Tệp chạy nhanh Windows `Chay_SGK_Studio.bat`)**.
