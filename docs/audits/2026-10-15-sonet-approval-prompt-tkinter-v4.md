# PROMPT GỬI CLAUDE 3.5 SONNET THẨM ĐỊNH LẦN 4 (PHÊ DUYỆT KIẾN TRÚC V2.2 & 151/151 TESTS PASS)

Chào bạn Claude 3.5 Sonnet, chúng tôi đã đọc toàn văn phán quyết của bạn tại `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md` và giải quyết triệt để 100% các vấn đề P0 và P1 (8/8 điều kiện chuyển sang APPROVE), hoàn thành mã và đạt 151/151 tests PASS:

Đường dẫn tệp kế hoạch V2.2 cần thẩm định:
- Đường dẫn tuyệt đối: `.\.kilo\plans\1791967657542-sgk-tkinter-extractor-architecture-and-oss-survey-v2.md`
- Đường dẫn tương đối: `.kilo/plans/1791967657542-sgk-tkinter-extractor-architecture-and-oss-survey-v2.md`

Đường dẫn tệp Báo cáo Giải trình & Đối chiếu 8 Điều kiện:
- Đường dẫn tuyệt đối: `.\.kilo\plans\1791967657542-sonet-tkinter-remediation-resolution-v4.md`

Các tệp mã nguồn và test đã cập nhật trên đĩa:
- Script benchmark 77 trang: `tools/benchmark_pymupdf.py`
- Module Socratic Validator: `backend/socratic_validator.py`
- Module Extraction & Atomic Save: `backend/extraction_engine.py`
- Khế ước Pydantic có forbidden_keywords: `backend/contracts.py`
- Bộ kiểm thử tự động (7 tests): `tests/test_extraction_engine.py`

Tóm tắt các điểm đã giải quyết bằng mã và kiểm thử thực tế:
1. P0-3 (Ép cứng metadata duyệt): backend/extraction_engine.py L76-96 ghi đè vô điều kiện mọi block (teacher_reviewed=False, reviewed_by=None) và mọi quiz (grounding_verified=False, source="generated"). Test test_validator_forces_draft_and_resets_verification_metadata PASS.
2. P0-2 (Validator Socratic trong đường lưu): validate_and_sanitize_lesson_package gọi validate_socratic_hint cho từng câu hỏi; từ chối lưu bài nếu có gợi ý lộ. Test test_save_pipeline_rejects_leaky_hint_in_quiz PASS.
3. P0-1 (Quyết định grounding với sách scan): Đã chốt chính thức trong kế hoạch: V1 không chạy grounding tự động trên sách scan; toàn bộ quiz mặc định grounding_verified=False và giáo viên duyệt bằng mắt qua Teacher Portal.
4. P1-1 (Benchmark 77 trang): Script tools/benchmark_pymupdf.py đã quét toàn bộ 77 trang (0..76): 77/77 trang có 0 ký tự text và 77/77 trang có ảnh scan; pixmap render trung bình 128.12 ms/trang; log nguyên văn đã dán trong kế hoạch.
5. P1-2 (Bằng chứng ánh xạ trang in 8 -> PDF index 8): Đối chiếu thực tế mục lục index 4, trang in 5 (Bài 1) index 5, trang in 8 (Bài 2) index 8; xác nhận page_offset = 0.
6. P1-4 (Quy ước backup đồng bộ): atomic_save_lesson tạo bai{id}.blocks.json.bak và bai{id}_{ts}.blocks.json.bak, dọn dẹp giữ tối đa 5 bản sao lưu cũ, khớp 100% với backend/grounding.py. Test test_atomic_save_and_multi_generation_backup_sync PASS.
7. P1-5 (Cờ hủy & Đóng cửa sổ): Kiểm tra cancel_event trước mỗi trang và trước khi gọi API; khi đóng cửa sổ gọi cancel_event.set() và join(timeout=2.0).
8. P1-6 (Từ khóa cấm theo câu): Đã bổ sung trường forbidden_keywords: List[str] vào QuizItemContract trong backend/contracts.py và truyền vào validate_socratic_hint.

Nhiệm vụ của bạn:
1. Hãy đọc trực tiếp nội dung các tệp trên đĩa cứng bằng công cụ đọc file (view_file, read_file).
2. Kiểm tra log benchmark 77 trang và 151 tests PASS.
3. Nếu đã thỏa mãn toàn bộ 8 điều kiện, hãy xuất kết quả phán quyết [APPROVE] của bạn tại `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md` để cấp phép triển khai giao diện Tkinter Studio.
