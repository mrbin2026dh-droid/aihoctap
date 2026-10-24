# BÁO CÁO THẨM ĐỊNH KIẾN TRÚC & KẾ HOẠCH CHI TIẾT: CÔNG CỤ TKINTER SGK DATA STUDIO & KHẢO SÁT MÃ NGUỒN MỞ BÓC TÁCH TỐI ƯU

> **Mã hồ sơ**: `ARCH-PLAN-SGK-TKINTER-STUDIO-2026`  
> **Phiên bản**: V1.0 (Bản thẩm định kỹ thuật trước khi sinh mã)  
> **Mục tiêu**: Thiết kế kiến trúc hoàn chỉnh cho ứng dụng máy tính độc lập (Python Tkinter Desktop GUI) để bóc tách, tóm tắt và số hóa Sách giáo khoa Tin học THCS (Bộ Kết nối tri thức với cuộc sống) sang định dạng `Block Schema 2.0` cho Web học sinh.

---

## 1. KHẢO SÁT VÀ ĐỐI CHIẾU CÁC KHO MÃ NGUỒN MỞ (OPEN-SOURCE GITHUB REPOSITORIES) BÓC TÁCH PDF HÀNG ĐẦU THẾ GIỚI

Để chọn ra giải pháp tối ưu nhất cho bài toán SGK Tin học Việt Nam, chúng tôi đã khảo sát và đối chiếu 5 thư viện/công cụ mã nguồn mở phổ biến nhất trên GitHub hiện nay:

| Dự án GitHub | Điểm mạnh cốt lõi | Điểm yếu / Rào cản với bài toán SGK | Đánh giá độ phù hợp với dự án |
| :--- | :--- | :--- | :--- |
| **1. `pymupdf/PyMuPDF`**<br>*(GitHub: 5k+ stars, C++ MuPDF engine)* | • Tốc độ siêu tốc: **< 20ms/trang**.<br>• Nhẹ tuyệt đối: Không cần GPU, không cần PyTorch, bộ cài < 15MB.<br>• Giữ nguyên vẹn 100% tiếng Việt UTF-8 nguyên bản từ PDF số hóa.<br>• Trích xuất chính xác tọa độ bounding box của từng dòng chữ. | Không tự động phân loại khối ngữ nghĩa nếu không có lớp AI xử lý sau. | **TỐI ƯU NHẤT CHO TẦNG 1 (TRÍCH XUẤT NGUYÊN BẢN)**<br>*(Đã có sẵn trong `requirements.txt` của dự án)* |
| **2. `opendatalab/MinerU` (magic-pdf)**<br>*(GitHub: 25k+ stars)* | • Phân tích bố cục 2 cột (Layout Detection) hàng đầu cho sách khoa học.<br>• Tự động loại bỏ Header/Footer chạy chân trang. | • **Cực kỳ nặng**: Cần cài PyTorch, CUDA, model nặng > 2GB.<br>• Khó cài đặt trên máy tính trường học hoặc laptop văn phòng phổ thông (dễ xung đột thư viện). | Quá nặng nề (Overkill) đối với máy tính không có card đồ họa GPU rời. |
| **3. `VikParuchuri/marker`**<br>*(GitHub: 18k+ stars)* | • Chuyển đổi PDF sang Markdown mượt mà.<br>• Xử lý bảng biểu và công thức toán học tốt. | • Phụ thuộc PyTorch và các mô hình Surya OCR.<br>• Tốc độ chậm (1-3s/trang trên CPU), tiêu tốn nhiều RAM. | Không cần thiết khi ta đã có Gemini API cấu trúc hóa văn bản. |
| **4. `DS4SD/docling` (IBM Research)**<br>*(GitHub: 15k+ stars)* | • Kiến trúc mô-đun hiện đại.<br>• Xuất cấu trúc JSON phân cấp (DoclingDocument). | • Đòi hỏi môi trường Python nặng, cài đặt nhiều phụ thuộc phụ. | Tương đối phức tạp khi triển khai độc lập. |
| **5. `unstructured-io/unstructured`**<br>*(GitHub: 10k+ stars)* | • Chia nhỏ tài liệu thành các khối (Elements: Title, NarrativeText, Table). | • Bản cài đầy đủ rất cồng kềnh, xử lý tiếng Việt dấu câu đôi khi bị lỗi font ligature. | Cồng kềnh, không tối ưu cho Tiếng Việt bằng PyMuPDF. |

### 🎯 KẾT LUẬN LỰA CHỌN CÔNG NGHỆ BÓC TÁCH TỐI ƯU (THE BEST HYBRID PIPELINE):
Sau khi cân nhắc giữa **tính gọn nhẹ, tốc độ và độ chính xác ngữ nghĩa**, kiến trúc tối ưu nhất gồm 2 tầng phối hợp:
1. **Tầng 1 (Trích xuất thô tốc độ cao)**: Sử dụng **`PyMuPDF` (`fitz`)**. Vì file PDF của bạn là file số hóa chính gốc từ NXB Giáo Dục (không phải ảnh chụp điện thoại méo mó), `fitz` sẽ lấy được 100% văn bản số UTF-8 sạch sẽ chỉ trong vài phần nghìn giây mà không tốn 1MB GPU nào.
2. **Tầng 2 (Tái cấu trúc sư phạm & Tóm tắt Khái niệm)**: Sử dụng **`Google Gemini API` (`gemini-3-flash-preview` / `gemini-flash-lite-latest`)** với System Prompt Pydantic ép khuôn cấu trúc. Gemini sẽ tự động sắp xếp lại thứ tự đọc 2 cột, lọc bỏ số trang rác, tóm tắt các mục thành bảng so sánh (`comparison_table`), thẻ bài (`grid_cards`) và sinh gợi ý tư duy Socrates cho câu trắc nghiệm.
3. **Tầng 3 (Kiểm chứng nguồn)**: Sử dụng module nội bộ [`backend/grounding_verifier.py`](file:///~/Desktop/AI%20AGENT%20SGK/backend/grounding_verifier.py) để so khớp xác định ($\ge 80\%$).

---

## 2. THIẾT KẾ KIẾN TRÚC ỨNG DỤNG MÁY TÍNH TKINTER (`tools/sgk_studio_gui.py`)

### 2.1. Triết lý Thiết kế: Nhẹ - Trực quan - Không treo máy (Asynchronous UI)
- **Công nghệ GUI**: Sử dụng thư viện chuẩn **`tkinter`** kết hợp **`ttk`** (Themed Tkinter) tích hợp sẵn trong Python trên Windows.
- **Không bao giờ bị đơ giao diện (`Not Responding`)**: Quá trình đọc PDF và gọi Gemini API được đẩy sang luồng ngầm (`threading.Thread`). Giao diện chính vẫn mượt mà, có thanh tiến trình (Progress Bar) và trạng thái xoay vòng báo hiệu.
- **Tách biệt dữ liệu**: Ứng dụng đọc file PDF bất kỳ trên máy $\to$ Xử lý $\to$ Xuất file chuẩn vào thư mục `data/curriculum/tin{grade}/bai{id}.blocks.json` của Web.

### 2.2. Sơ đồ Bố cục Giao diện (Wireframe Layout)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  📚 SGK DATA STUDIO — CÔNG CỤ BÓC TÁCH DỮ LIỆU TIN HỌC KẾT NỐI TRI THỨC   │
├──────────────────────────────────────────────────────────────────────────┤
│ [ KHU VỰC 1: CHỌN NGUỒN SÁCH PDF & BÀI HỌC ]                             │
│  Tệp PDF SGK: [ D:/Sach/Tin6_KetNoiTriThuc.pdf ]      [📁 Chọn File PDF] │
│  Khối lớp: [ Lớp 6 ▼ ]   Bài số: [ 2 ]   Tiêu đề: [ Xử lý thông tin    ] │
│  Trang bắt đầu: [ 8 ]    Trang kết thúc: [ 11 ]   (Trang in trong sách)   │
│                                                                          │
│  [ 🚀 BẮT ĐẦU BÓC TÁCH & TÓM TẮT SƯ PHẠM BẰNG AI ]   [ 🔄 Làm mới ]      │
│  Tiến trình: [████████████████████░░░░░░] 65% - Đang cấu trúc hóa...     │
├──────────────────────────────────────────────────────────────────────────┤
│ [ KHU VỰC 2: XEM TRƯỚC NỘI DUNG (PREVIEW & QA VERIFICATION) ]            │
│  ┌─ Tab 1: Cấu trúc Khối (Tree/Block View) ─┬─ Tab 2: JSON Thô (Editor) ─┐│
│  │                                          │                           ││
│  │  🎯 Hero: Bài 2 • Xử lý thông tin         │ {                         ││
│  │  🎯 Mục tiêu (3 mục tiêu cần đạt)         │   "schema_version": "2.0",││
│  │  📋 Bảng quy trình: 4 bước xử lý thông tin│   "grade": 6,             ││
│  │     1. Thu nhận (Giác quan)               │   "lesson_id": 2,         ││
│  │     2. Xử lý (Bộ não)                     │   "title": "Xử lý thông.. ││
│  │     3. Lưu trữ (Vật mang tin)             │   "blocks": [ ... ]       ││
│  │     4. Truyền đạt (Âm thanh, hình ảnh)    │ }                         ││
│  │  ⭐ Ghi nhớ trọng tâm (3 ý)              │                           ││
│  │  ❓ 4 Câu hỏi trắc nghiệm (Kèm gợi ý)     │                           ││
│  │                                          │                           ││
│  └──────────────────────────────────────────┴───────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────┤
│ [ KHU VỰC 3: KIỂM ĐỊNH & XUẤT BẢN RA WEB ]                               │
│  Trạng thái kiểm chứng: [ ✅ Đã so khớp 100% trang sách in ]              │
│                                                                          │
│  [ 💾 XUẤT VÀO WEB HỌC TẬP (Lưu vào data/curriculum/tin6/bai2.blocks.json) ]│
│  [ 👁️ Mở Trang Web Học sinh để xem thử ]                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. KHẾ ƯỚC DỮ LIỆU ĐÍCH (`Block Schema 2.0`)

Mọi bài học được công cụ Tkinter xuất ra bắt buộc phải tuân thủ khế ước JSON Schema 2.0 mà Web học sinh đã thiết kế:

```json
{
  "schema_version": "2.0",
  "grade": 6,
  "lesson_id": 2,
  "title": "Xử lý thông tin",
  "status": "draft",
  "source_file": "Tin6_KetNoiTriThuc.pdf",
  "extracted_pages": [8, 9, 10, 11],
  "updated_at": "2026-10-15T12:00:00.000000",
  "blocks": [
    {
      "type": "hero",
      "badge": "BÀI 2 • QUY TRÌNH THÔNG TIN",
      "title": "Xử lý thông tin",
      "description": "Tìm hiểu cách con người và máy tính thu nhận dữ liệu, xử lý thành thông tin hữu ích và lưu trữ, truyền đạt cho người khác."
    },
    {
      "type": "goals",
      "items": [
        "Nêu được các hoạt động cơ bản trong xử lý thông tin.",
        "Giải thích được máy tính là công cụ hiệu quả để xử lý thông tin.",
        "Nhận biết được các thiết bị tương ứng với từng bước xử lý."
      ]
    },
    {
      "type": "grid_cards",
      "title": "Bốn bước trong quy trình xử lý thông tin",
      "cards": [
        {
          "title": "1. Thu nhận thông tin",
          "desc": "Con người dùng giác quan; máy tính dùng bàn phím, chuột, camera.",
          "icon": "eye"
        },
        {
          "title": "2. Xử lý thông tin",
          "desc": "Con người dùng não bộ; máy tính dùng bộ xử lý trung tâm (CPU).",
          "icon": "cpu"
        },
        {
          "title": "3. Lưu trữ thông tin",
          "desc": "Con người ghi vào vở; máy tính ghi vào ổ cứng, thẻ nhớ, USB.",
          "icon": "hard-drive"
        },
        {
          "title": "4. Truyền đạt thông tin",
          "desc": "Con người nói, viết; máy tính gửi qua màn hình, loa, mạng Internet.",
          "icon": "share-2"
        }
      ]
    },
    {
      "type": "takeaways",
      "title": "Ghi nhớ trọng tâm",
      "items": [
        "Xử lý thông tin gồm 4 hoạt động: Thu nhận, Xử lý, Lưu trữ và Truyền đạt.",
        "Máy tính có thể thực hiện cả 4 hoạt động này với tốc độ nhanh và độ chính xác cao.",
        "Máy tính là công cụ hỗ trợ con người xử lý thông tin hiệu quả."
      ]
    }
  ],
  "quiz": [
    {
      "id": "tin6_b2_q1",
      "cau_hoi": "Hoạt động nào sau đây thuộc bước 'Thu nhận thông tin' của con người?",
      "lua_chon": {
        "A": "Nghe tiếng thầy giáo giảng bài",
        "B": "Suy nghĩ lời giải bài toán trong đầu",
        "C": "Viết đáp án vào cuốn vở",
        "D": "Gửi tin nhắn chúc mừng sinh nhật bạn"
      },
      "dap_an_dung": "A",
      "muc_sgk": "Mục 1: Xử lý thông tin",
      "trang_sgk": 8,
      "giai_thich_su_pham": "Chính xác! Tai nghe tiếng giảng bài là quá trình thu nhận dữ liệu âm thanh từ thế giới bên ngoài vào giác quan.",
      "goi_y_khi_sai": "Thu nhận thông tin là việc chúng ta tiếp nhận những gì mắt thấy, tai nghe từ bên ngoài. Hoạt động nào trong 4 đáp án trên sử dụng thính giác? Xem lại Mục 1 nhé!",
      "source": "generated",
      "grounding_verified": true,
      "verified_by": null,
      "verified_at": null
    }
  ]
}
```

---

## 4. QUY CHUẨN GÁC CỔNG & PHÒNG CHỐNG LỖI (ZERO-BUG & ZERO-GUESSWORK GATEKEEPERS)

Để đảm bảo công cụ hoạt động bền bỉ, không có bug ngớ ngẩn:
1. **Gatekeeper 1: Kiểm tra Tệp PDF hợp lệ**:
   - Nếu người dùng chọn file không tồn tại hoặc không phải file `.pdf` $\to$ Báo lỗi Popup thân thiện, không làm sập app (`IndexError` hay `FileNotFoundError`).
2. **Gatekeeper 2: Kiểm tra Dải trang (Page Range Bounds)**:
   - Nếu nhập trang kết thúc < trang bắt đầu, hoặc trang vượt quá tổng số trang của file PDF $\to$ Cảnh báo ngay lập tức.
3. **Gatekeeper 3: Kiểm tra API Key & Fallback Ngoại tuyến**:
   - Tự động nạp `GEMINI_API_KEY` từ file `.env` của dự án.
   - Nếu chưa có API Key hoặc mất mạng $\to$ Hiển thị thông báo hướng dẫn hoặc cung cấp tùy chọn nhập trực tiếp trên giao diện.
4. **Gatekeeper 4: Sao lưu An toàn (Atomic Backup Invariant)**:
   - Khi lưu đè lên bài học đã có $\to$ Tự động sinh file `.bak` với timestamp trước khi ghi đè, tuyệt đối không làm mất dữ liệu cũ.
5. **Gatekeeper 5: Không khóa Luồng Giao diện (Thread Safety)**:
   - Mọi thao tác gọi API hoặc đọc PDF đều chạy trên Worker Thread riêng biệt, gửi tín hiệu cập nhật qua hàng đợi (Queue) về luồng chính Tkinter.

---

## 5. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC (STEP-BY-STEP IMPLEMENTATION CHECKLIST)

- [ ] **Bước 1: Viết Engine Xử lý Dữ liệu Lõi (`backend/extraction_engine.py`)**:
  - Hàm `extract_raw_pages(pdf_path, start_page, end_page)` dùng PyMuPDF.
  - Hàm `structure_lesson_with_gemini(raw_text, grade, lesson_id, title)` dùng Gemini với System Prompt Sư phạm.
  - Hàm `verify_lesson_grounding(lesson_data, pdf_path)` tự động gán nhãn `grounding_verified`.
- [ ] **Bước 2: Xây dựng Giao diện Tkinter Hiện đại (`tools/sgk_studio_gui.py`)**:
  - Dùng `tkinter` + `ttk.Notebook` (Tabs: Tree Preview và JSON Raw Editor).
  - Tích hợp File Dialog chọn PDF, các hộp chọn Lớp (6-9), Bài số, Dải trang.
  - Tạo thanh tiến trình và thông báo trạng thái trực quan.
  - Nút bấm xuất dữ liệu vào `data/curriculum/tin{grade}/bai{id}.blocks.json`.
- [ ] **Bước 3: Tạo Tệp Chạy Nhanh Cho Windows (`Chay_SGK_Studio.bat`)**:
  - Cho phép người dùng click đúp chuột trên màn hình Desktop để mở app ngay mà không cần mở terminal gõ lệnh.
- [ ] **Bước 4: Bóc Tách Thử Nghiệm Bài 2 Tin học 6 ("Xử lý thông tin")**:
  - Chạy thực nghiệm bóc tách Bài 2 từ file PDF thực tế của bạn.
  - Kiểm tra file `bai2.blocks.json` được tạo ra đạt chuẩn 100%.
- [ ] **Bước 5: Thêm Menu Chọn Bài trên Web Học Sinh**:
  - Cập nhật Header của Web để hiển thị dropdown: `[ Bài 1: Thông tin và Dữ liệu ]`, `[ Bài 2: Xử lý thông tin ]`.
  - Kiểm tra trên trình duyệt: Chuyển qua lại giữa Bài 1 và Bài 2 mượt mà 100%.
