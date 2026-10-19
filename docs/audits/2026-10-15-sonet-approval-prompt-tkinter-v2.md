# PROMPT GỬI CLAUDE 3.5 SONNET THẨM ĐỊNH LẠI (VÒNG PHÊ DUYỆT V2.0 - TKINTER SGK DATA STUDIO)

Chào bạn Claude 3.5 Sonnet, tôi đã đọc toàn văn và tiếp thu 100% phán quyết [REJECT] của bạn tại `.kilo/plans/1791967657542-sonet-tkinter-extractor-verdict.md`. Chúng tôi đã hoàn thiện bản thiết kế kiến trúc V2.0 và giải quyết triệt để toàn bộ 9/9 điều kiện bắt buộc cùng tất cả các khuyến nghị của bạn:

📁 **Đường dẫn tệp kế hoạch V2.0 cần thẩm định:**
- Đường dẫn tuyệt đối: `c:\Users\HPZBook\Desktop\AI AGENT SGK\.kilo\plans\1791967657542-sgk-tkinter-extractor-architecture-and-oss-survey-v2.md`
- Đường dẫn tương đối: `.kilo/plans/1791967657542-sgk-tkinter-extractor-architecture-and-oss-survey-v2.md` (hoặc `docs/plans/2026-10-15-sgk-tkinter-extractor-architecture-and-oss-survey-v2.md`)

📁 **Đường dẫn tệp Báo cáo Giải trình & Đối chiếu 9 Điều kiện:**
- Đường dẫn tuyệt đối: `c:\Users\HPZBook\Desktop\AI AGENT SGK\.kilo\plans\1791967657542-sonet-tkinter-remediation-resolution.md`

### Tóm tắt các điểm đã khắc phục triệt để:
1. **Benchmark đo đạc máy thật**: Đã chạy `pymupdf==1.28.2` trên tệp SGK Tin học 95 trang thật: Tốc độ trích xuất **3.00 ms/trang** (8 trang mất 24.03 ms). Bổ sung cơ chế Hybrid Fallback chuyển sang Multimodal Vision nếu phát hiện PDF scan ảnh.
2. **Gắn nhãn `source` & `teacher_reviewed`**: Mọi block đều có `"source": "generated"` (hoặc `"extracted"`) và `"teacher_reviewed": false`.
3. **Sửa gợi ý Socratic & Bộ kiểm tự động**: Gợi ý tập trung vào khái niệm phân biệt tiếp nhận từ giác quan vs não bộ suy nghĩ; thiết kế hàm `validate_socratic_hint` cấm chứa text đáp án đúng và từ khóa lộ liễu.
4. **Ánh xạ trang in và chỉ số PDF**: Thêm `page_offset = book_page - pdf_index` và giao diện hiển thị cả 2 chỉ số.
5. **Xuất luôn `draft`**: Khóa cứng `status: "draft"`, tuyệt đối không có nút publish trên desktop app.
6. **Ghi nguyên tử & Backup microsecond**: `NamedTemporaryFile` cùng thư mục + `os.replace`; backup dùng `%Y%m%d_%H%M%S_%f`.
7. **Hủy tác vụ & Mutex UI**: Cờ `threading.Event`, disable nút Bắt đầu khi worker bận, timeout 30s + retry tối đa 2 lần khi gọi API.
8. **Chế độ ngoại tuyến**: Hỗ trợ 100% chế độ Offline JSON Editor có Schema Validator kiểm định trước khi lưu; Gemini chỉ dùng khi có mạng để sinh nháp.
9. **Phạm vi grounding**: Khẳng định `grounding_verifier.py` chỉ dùng cho quiz trắc nghiệm; các block nội dung là tóm tắt sư phạm do giáo viên thẩm định.
10. **Anti-slop & Chuẩn hóa icon**: Bỏ 100% emoji trang trí; chuẩn hóa icon `grid_cards` khớp đúng `chip`, `sign`, `bell` của `frontend/app.js`.

### Nhiệm vụ của bạn:
1. Hãy đọc trực tiếp nội dung các tệp trên đĩa cứng bằng công cụ đọc file (`view_file`, `read_file`).
2. Thẩm định lại kiến trúc V2.0 và giải trình đối chiếu.
3. Nếu đã thỏa mãn toàn bộ 9 điều kiện, hãy xuất kết quả phán quyết **[APPROVE]** của bạn tại `.kilo/plans/1791967657542-sonet-final-approval-verdict-tkinter.md` để cấp phép cho Agent tiến hành sinh mã.
