# HỒ SƠ THẨM ĐỊNH KIẾN TRÚC GỬI CLAUDE 3.5 SONNET: CÔNG CỤ ĐỘC LẬP TKINTER SGK DATA STUDIO & ĐƯỜNG ỐNG BÓC TÁCH DỮ LIỆU SÁCH GIÁO KHOA TIN HỌC

*(Bạn chỉ cần copy toàn bộ nội dung từ khung bên dưới và gửi cho Claude 3.5 Sonnet để nhận phán quyết thẩm định kiến trúc độc lập)*

---

```markdown
Chào bạn Sonnet, tôi là Kỹ sư Trưởng hệ thống **AI SGK TIN HỌC THCS (`AI AGENT SGK`)**.

Sau khi hệ thống hoàn tất xuất sắc toàn bộ các điều kiện nghiệm thu ở Phán quyết V4 (144/144 tests Pytest PASS, Playwright Live UI Mutex PASS, Gemini Live API đạt 0.00% rò rỉ), chúng tôi bước sang **Giai đoạn 6: Mở rộng dữ liệu SGK (Scale Curriculum Pipeline)**.

### BỐI CẢNH VÀ BÀI TOÁN MỚI
Hiện tại hệ thống mới chỉ có Bài 1 Lớp 6 (`tin6/bai1.blocks.json`). Chúng tôi cần số hóa toàn bộ các bài học tiếp theo (Bài 2, 3, 4...) của khối 6, 7, 8, 9 từ bộ sách giáo khoa **"Kết nối tri thức với cuộc sống"** (đã có đầy đủ file PDF gốc).

Chúng tôi đưa ra quyết định kiến trúc: **Xây dựng một Ứng dụng Máy tính Độc lập (Desktop GUI bằng Python Tkinter - `tools/sgk_studio_gui.py`)** để bóc tách, tóm tắt và kiểm định dữ liệu SGK trước khi xuất sang định dạng `Block Schema 2.0` cho Web học sinh.

### 2 RÀNG BUỘC KỸ THUẬT ĐẶC THÙ ĐƯỢC XÁC LẬP
1. **Chỉ bóc tách phần chữ (Text-Only), KHÔNG bóc tách ảnh**: Bỏ qua các ảnh chụp/ảnh vẽ trong PDF để giảm 90% độ phức tạp, triệt tiêu lỗi vỡ hạt hay nặng dung lượng. Giao diện Web học sinh sẽ dùng Icon Vector SVG và các Khối UI hiện đại thay thế ảnh scan.
2. **Khế ước Trung thực Sư phạm (The Grounding Invariant)**: SGK in của học sinh **hoàn toàn không in đáp án đúng hay giải thích bài tập trắc nghiệm**. Do đó:
   - Câu hỏi và phương án A, B, C, D được trích xuất từ sách và đối chiếu với trang PDF gốc (`grounding_verified: bool` $\ge 80\%$).
   - Đáp án đúng, giải thích khi đúng (`giai_thich_su_pham`) và gợi ý tư duy khi sai (`goi_y_khi_sai` chuẩn Socrates không lộ đáp án) do AI sinh ra (`source: "generated"`), lưu ở trạng thái `draft` và cần Giáo viên phê duyệt.

Chúng tôi gửi bạn toàn bộ bản thiết kế kiến trúc chi tiết dưới đây để bạn thẩm định và chỉ ra các rủi ro kỹ thuật tiềm ẩn trước khi chúng tôi viết code:

---

# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC TKINTER SGK DATA STUDIO & PIPELINE BÓC TÁCH

## 1. KHẢO SÁT & SO SÁNH CÁC MÃ NGUỒN MỞ GITHUB BÓC TÁCH PDF

Chúng tôi đã khảo sát 5 dự án mã nguồn mở phổ biến:
- **`pymupdf/PyMuPDF` (`fitz`)** (5k+ stars): Engine C++ MuPDF. Siêu nhanh (< 20ms/trang), cực nhẹ (không GPU, không PyTorch, < 15MB), lấy 100% text UTF-8 tiếng Việt nguyên bản từ PDF số hóa.
- **`opendatalab/MinerU` (magic-pdf)** (25k+ stars): Chuyên bố cục đa cột, nhưng quá nặng (PyTorch, CUDA, model > 2GB), dễ xung đột môi trường.
- **`VikParuchuri/marker`** (18k+ stars) & **`DS4SD/docling`** (15k+ stars): Tốt cho Markdown nhưng phụ thuộc Deep Learning OCR, chậm và nặng trên máy tính trường học.
- **`unstructured-io/unstructured`** (10k+ stars): Cồng kềnh, xử lý ligature tiếng Việt chưa tối ưu.

**Lựa chọn của chúng tôi: Đường ống Hybrid 3 Tầng**:
- **Tầng 1 (Trích xuất thô tốc độ cao)**: `PyMuPDF` (`fitz`) trích xuất text từng trang sách trong vài mili-giây.
- **Tầng 2 (Tái cấu trúc sư phạm & Tóm tắt Khái niệm)**: Google Gemini API (`gemini-3-flash-preview` / `gemini-flash-lite-latest`) với System Prompt Pydantic để sắp xếp lại trật tự đọc 2 cột, tóm tắt các mục thành Khối Hero, Bảng so sánh 2 cột (`comparison_table`), Thẻ quy trình (`grid_cards`), Hộp ghi nhớ (`takeaways`) và Giàn giáo Socrates 3 tầng.
- **Tầng 3 (Kiểm chứng nguồn)**: Module `backend/grounding_verifier.py` (SequenceMatcher $\ge 80\%$) xác minh câu hỏi trắc nghiệm có đúng trong sách hay không.

---

## 2. THIẾT KẾ ỨNG DỤNG DESKTOP TKINTER (`tools/sgk_studio_gui.py`)

### 2.1. Kiến trúc Đa luồng (Multi-threading Model) Chống Đơ Giao diện
- Giao diện Tkinter chạy trên Main Thread.
- Thao tác đọc PDF và gọi Gemini API chạy trên **Worker Thread** riêng biệt (`threading.Thread`).
- Giao tiếp luồng an toàn: Worker Thread đẩy tiến độ và kết quả vào `queue.Queue()`, Main Thread dùng `root.after(100, check_queue)` để cập nhật thanh tiến trình (Progress Bar) và khung xem trước $\to$ **Triệt tiêu hoàn toàn lỗi `"Not Responding"`**.

### 2.2. Bố cục Giao diện Tkinter (Wireframe)
- **Vùng 1 (Cấu hình Nguồn)**: Nút chọn file PDF qua `filedialog.askopenfilename()`, chọn Khối lớp (6-9), nhập Số bài, Tiêu đề, Trang bắt đầu - kết thúc.
- **Vùng 2 (Điều khiển)**: Nút "🚀 Bắt đầu Bóc tách", Thanh tiến trình (`ttk.Progressbar`), Nhãn trạng thái thời gian thực.
- **Vùng 3 (Xem trước 2 Tab)**:
  - Tab 1 (`ttk.Treeview`): Xem cấu trúc các Khối (Hero, Goals, Comparison, Cards, Takeaways, Quiz 4 câu).
  - Tab 2 (`ScrolledText`): Xem mã JSON thô `Block Schema 2.0`, cho phép sửa tay trực tiếp.
- **Vùng 4 (Lưu & Xuất bản)**:
  - Nút "💾 Lưu vào Web học tập" $\to$ Tự động ghi vào `data/curriculum/tin{grade}/bai{id}.blocks.json`.
  - Tự động tạo bản sao lưu an toàn `.bak` trước khi ghi đè.

---

## 3. KHẾ ƯỚC DỮ LIỆU ĐÍCH (`Block Schema 2.0`)

Mỗi bài học được xuất ra cấu trúc:
```json
{
  "schema_version": "2.0",
  "grade": 6,
  "lesson_id": 2,
  "title": "Xử lý thông tin",
  "status": "draft",
  "source_file": "Tin6_KetNoiTriThuc.pdf",
  "extracted_pages": [8, 9, 10, 11],
  "updated_at": "2026-10-15T12:00:00Z",
  "blocks": [
    { "type": "hero", "badge": "BÀI 2 • QUY TRÌNH THÔNG TIN", "title": "Xử lý thông tin", "description": "..." },
    { "type": "goals", "items": ["Nêu được...", "Giải thích được...", "Nhận biết được..."] },
    { "type": "grid_cards", "title": "4 bước xử lý thông tin", "cards": [...] },
    { "type": "takeaways", "title": "Ghi nhớ trọng tâm", "items": [...] }
  ],
  "quiz": [
    {
      "id": "tin6_b2_q1",
      "cau_hoi": "Hoạt động nào sau đây thuộc bước 'Thu nhận thông tin' của con người?",
      "lua_chon": { "A": "Nghe tiếng thầy giáo...", "B": "Suy nghĩ...", "C": "Viết...", "D": "Gửi..." },
      "dap_an_dung": "A",
      "muc_sgk": "Mục 1: Xử lý thông tin",
      "trang_sgk": 8,
      "giai_thich_su_pham": "Chính xác! Tai nghe tiếng giảng bài là...",
      "goi_y_khi_sai": "Thu nhận thông tin là việc chúng ta tiếp nhận qua giác quan...",
      "source": "generated",
      "grounding_verified": true,
      "verified_by": null,
      "verified_at": null
    }
  ]
}
```

---

## 4. HỆ THỐNG CHỐT CHẶN AN TOÀN (ZERO-BUG GATEKEEPERS)
1. **Gatekeeper 1 (File & Page Bounds)**: Kiểm tra đuôi `.pdf`, kiểm tra trang bắt đầu $\le$ trang kết thúc $\le$ tổng số trang PDF.
2. **Gatekeeper 2 (Thread Safety)**: Cấm tuyệt đối gọi trực tiếp các phương thức widget Tkinter từ Worker Thread; bắt buộc chuyển qua `queue.Queue` và `root.after`.
3. **Gatekeeper 3 (Atomic Backup)**: Tự động tạo bản sao lưu `baiX_timestamp.blocks.json.bak` trước khi ghi đè bài cũ.
4. **Gatekeeper 4 (Deterministic Grounding)**: So khớp câu hỏi với văn bản trang sách PDF gốc qua SequenceMatcher $\ge 80\%$, chống AI bịa câu hỏi ngoài sách.
5. **Gatekeeper 5 (Data Validation)**: Xác thực JSON đầu ra bằng Pydantic model trước khi cho phép bấm nút Lưu.

---

### CÂU HỎI XIN PHÁN QUYẾT & THẨM ĐỊNH TỪ CLAUDE 3.5 SONNET:

Kính gửi Kiến trúc sư **Claude 3.5 Sonnet**, xin nhờ bạn thẩm định các khía cạnh kỹ thuật sau:
1. **Đánh giá Kiến trúc Tổng thể**: Việc tách một ứng dụng Desktop Tkinter độc lập để bóc tách/chuẩn bị dữ liệu thay vì nhồi nhét vào Web server chính có phải là quyết định đúng đắn theo Best Practices không?
2. **Góc khuất rủi ro khi dùng PyMuPDF bóc tách SGK tiếng Việt**: Khi trích xuất văn bản từ PDF SGK tiếng Việt bằng `PyMuPDF`, có những cạm bẫy nào cần lưu ý (ví dụ: ngắt dòng giữa chừng làm đứt từ ghép tiếng Việt, xử lý bảng/cột bị đảo lộn thứ tự đọc, ký tự Unicode tổ hợp vs dựng sẵn)? Cách khắc phục tối ưu nhất ở tầng Prompt Gemini là gì?
3. **Độ an toàn của mô hình Đa luồng Tkinter (Tkinter Threading)**: Cơ chế `queue.Queue` + `root.after` đã đủ triệt để để loại bỏ 100% nguy cơ treo UI và crash trên Windows chưa? Cần lưu ý gì khi người dùng tắt cửa sổ đột ngột (Window Close / `WM_DELETE_WINDOW`) trong lúc Worker Thread đang gọi API?
4. **Bảo toàn Khế ước Grounding**: Với việc sinh tự động `goi_y_khi_sai` theo phương pháp Socrates, làm thế nào để đảm bảo 100% LLM không vô tình nhét đáp án A/B/C/D vào phần gợi ý khi sinh hàng loạt các bài mới?
5. **Phán quyết**: Bạn có phê duyệt kế hoạch kiến trúc này để đội ngũ bắt đầu viết mã nguồn không? Có điều chỉnh hoặc bổ sung nào cần thực hiện trước?
```
