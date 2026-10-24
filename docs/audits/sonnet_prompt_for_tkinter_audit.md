# LỜI NHẮC (PROMPT) GỬI CLAUDE 3.5 SONNET: THẨM ĐỊNH TỆP KIẾN TRÚC TKINTER SGK DATA STUDIO

*(Bạn chỉ cần copy toàn bộ đoạn ngắn bên dưới và gửi cho Claude 3.5 Sonnet)*

---

Chào bạn Sonnet, tôi gửi bạn tệp hồ sơ đặc tả kiến trúc cần thẩm định độc lập:

### 📁 ĐƯỜNG DẪN TỆP CẦN ĐỌC:
- **Đường dẫn tuyệt đối**: `.\.kilo\plans\1791967657542-sgk-tkinter-extractor-architecture-and-oss-survey.md`
- **Đường dẫn tương đối**: `.kilo/plans/1791967657542-sgk-tkinter-extractor-architecture-and-oss-survey.md` (hoặc `docs/plans/2026-10-15-sgk-tkinter-extractor-architecture-and-oss-survey.md`)

---

### 📋 NHIỆM VỤ THẨM ĐỊNH CỦA BẠN:
1. Hãy dùng công cụ đọc file (`view_file` / `read_file`) để đọc trực tiếp toàn văn nội dung tệp `.md` trên đĩa cứng theo đường dẫn ở trên.
2. Thẩm định độc lập 5 trọng tâm kiến trúc:
   - **Khảo sát OSS**: Đánh giá giải pháp Hybrid: `PyMuPDF` (text-only, siêu tốc < 20ms, zero-GPU) kết hợp `Gemini Structured Outputs` so với các thư viện nặng (`MinerU`, `Marker`, `Docling`).
   - **Kiến trúc Tkinter**: Mô hình Đa luồng (`Worker Thread` + `queue.Queue` + `root.after`) chống đơ UI Windows.
   - **Bố cục & Tính năng**: Hộp thoại Windows chọn PDF, chọn trang, 2 Tab xem trước (Treeview & JSON Editor), nút xuất 1-click vào Web.
   - **Khế ước & Sư phạm**: Đảm bảo Block Schema 2.0 và Giàn giáo Socrates 3 tầng (tuyệt đối không lộ đáp án trong `goi_y_khi_sai`).
   - **Chốt chặn an toàn**: File bounds, atomic `.bak` backup, deterministic grounding $\ge 80\%$.
3. **Ban hành phán quyết**:
   - Vui lòng ghi kết quả thẩm định và các điều kiện/khuyến nghị chi tiết của bạn vào một tệp markdown tại đường dẫn:  
     👉 **`.kilo/plans/1791967657542-sonet-tkinter-extractor-verdict.md`**

Sau khi bạn hoàn thành và xuất file phán quyết `.md`, Antigravity sẽ tự động đọc lại tệp của bạn để phân tích và điều chỉnh kế hoạch/mã nguồn trước khi bàn giao!
