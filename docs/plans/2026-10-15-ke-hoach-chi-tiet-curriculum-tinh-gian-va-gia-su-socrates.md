# KẾ HOẠCH CHI TIẾT: XÂY DỰNG HỌC LIỆU TINH GIẢN & VẬN HÀNH TRÁI TIM GIA SƯ AI SOCRATES (TIN HỌC 6)

- **Mục tiêu tối thượng**: Chuyển đổi toàn bộ 17 bài Tin học 6 sang định dạng **Tinh giản - Dễ hiểu như ảnh chụp VietJack**, đồng thời giữ vững và phát huy **Trái tim Gia sư AI Socrates** (tương tác trực tiếp, gợi mở tư duy, không giải hộ).
- **Nguyên tắc an toàn**: Bảo toàn 100% hệ thống và dữ liệu hiện tại, thực hiện trên thư mục độc lập mới `data/curriculum_v2_simple/tin6/`, kiểm định chắc chắn từng bài trước khi áp dụng.

---

## I. TẦM NHÌN: VÌ SAO GIA SƯ SOCRATES LÀ "TRÁI TIM" CỦA ỨNG DỤNG?

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ỨNG DỤNG GIA SƯ AI TIN HỌC THCS                      │
├───────────────────────────────────┬────────────────────────────────────┤
│   CÁC TRANG WEB THÔNG THƯỜNG      │      ỨNG DỤNG CỦA CHÚNG TA         │
│   (VietJack, Loigiaihay...)       │   (Sân khấu Tự học + Socrates AI)  │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Là trang web đọc thụ động.      │ • Sân khấu trực quan, tương tác.   │
│ • Học sinh đọc không hiểu -> bí.  │ • Học sinh kêu "e ko biết" ->      │
│ • Bài tập chỉ có đáp án giải sẵn, │   Gia sư Socrates xuất hiện động   │
│   học sinh dễ chép lời giải đối   │   viên, lấy ví dụ thực tế đời sống,│
│   phó, không hiểu bản chất.       │   dẫn dắt từng bước TỰ TÌM RA ĐÁP  │
│                                   │   ÁN mà KHÔNG GIẢI HỘ (Anti-Leak). │
└───────────────────────────────────┴────────────────────────────────────┘
```

> **Khẳng định cốt lõi**: Lý thuyết tóm tắt dễ hiểu là **nguyên liệu nền tảng**, còn **Gia sư Socrates mới chính là linh hồn và điểm độc quyền** tạo nên sự khác biệt hoàn toàn so với mọi cuốn sách in hay trang web tĩnh trên thị trường!

---

## II. ĐỊNH DẠNG BÀI HỌC TINH GIẢN MỚI (THE CLEAN LESSON CONTRACT)

Để triệt tiêu hoàn toàn lỗi hardcode và phục vụ hoàn hảo cho Gia sư Socrates, mỗi bài học trong `data/curriculum_v2_simple/tin6/baiX.json` sẽ có cấu trúc 2 phần tối giản:

```json
{
  "schema_version": "3.0_clean",
  "grade": 6,
  "lesson_id": 1,
  "title": "Thông tin và dữ liệu",
  
  "theory_markdown": "### 1. Thông tin và dữ liệu\n- **Thông tin** là những gì đem lại hiểu biết cho con người...\n*Ví dụ: Hành động khi nhìn thấy đèn tín hiệu,...*\n- **Dữ liệu** được ghi lên vật mang tin...\n*Ví dụ: Màu sắc của đèn tín hiệu,...*\n\n**Lưu ý:**\n- Thông tin là cái chứa trong dữ liệu.\n- Thông tin = Dữ liệu + Não xử lí.\n\n### 2. Tầm quan trọng của thông tin\n- Thông tin đem lại hiểu biết...",

  "quiz": [
    {
      "id": "tin6_b1_q1",
      "section_ref": "Mục 1: Thông tin và dữ liệu",
      "cau_hoi": "Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại. Trong tình huống này, 'màu sắc đèn đỏ' là gì?",
      "lua_chon": {
        "A": "Vật mang tin",
        "B": "Dữ liệu",
        "C": "Thông tin",
        "D": "Quyết định"
      },
      "dap_an_dung": "B",
      "giai_thich_su_pham": "Chính xác! Màu sắc ánh sáng đỏ là tín hiệu hình ảnh mắt em thu nhận trực tiếp từ bên ngoài, chưa qua suy nghĩ nên là Dữ liệu.",
      "goi_y_khi_sai": "Em hãy nhớ lại Lưu ý ở Mục 1: Thứ mà mắt nhìn thấy trực tiếp chưa qua suy nghĩ thì gọi là gì?",
      "forbidden_keywords": ["Dữ liệu", "đáp án B"]
    }
  ]
}
```

### 3 ưu điểm vượt trội của định dạng này:
1. **Lý thuyết dạng Markdown sạch**: Học sinh đọc một mạch từ trên xuống dưới đúng 2 phút, có in đậm, in nghiêng ví dụ, bảng biểu rõ ràng y hệt ảnh chụp của bạn.
2. **Giao diện Web không bao giờ bị hardcode**: Web chỉ việc nạp văn bản Markdown và render ra, 0% dòng chữ thừa của Bài 1.
3. **Cung cấp Grounding hoàn hảo cho Gia sư Socrates**:
   - Khi học sinh hỏi bài $\to$ Socrates đọc thẳng văn bản `theory_markdown` của đúng bài đó.
   - Khi học sinh làm sai câu trắc nghiệm $\to$ Socrates biết câu đó thuộc `section_ref` nào, dùng đúng `goi_y_khi_sai` và tuyệt đối không nói các từ trong `forbidden_keywords`.

---

## III. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC (STEP-BY-STEP ROADMAP)

### BƯỚC 1: XÂY DỰNG MẪU BÀI 1 & BÀI 2 TRONG THƯ MỤC MỚI (`curriculum_v2_simple`)
- Không vội làm 17 bài. Tạo trước 2 bài mẫu:
  - `data/curriculum_v2_simple/tin6/bai1.json` (Thông tin và dữ liệu - chuẩn y ảnh 1).
  - `data/curriculum_v2_simple/tin6/bai2.json` (Xử lí thông tin - chuẩn ví dụ 4 bước: Nhận $\to$ Nhớ $\to$ Nghĩ $\to$ Nói).
- Kiểm tra đối chiếu từng câu chữ, đảm bảo:
  - Ngôn từ lớp 6 đọc là hiểu ngay.
  - Có ví dụ thực tế cụ thể.
  - Có câu hỏi trắc nghiệm gắn liền với lý thuyết.

### BƯỚC 2: KẾT NỐI VỚI TRÁI TIM GIA SƯ SOCRATES & GIAO DIỆN XEM TRƯỚC
- Cấu hình endpoint API riêng hoặc cơ chế chuyển đổi nhẹ nhàng để Web đọc từ thư mục mới này.
- Dọn dẹp sạch sẽ hàm render Markdown trên giao diện Web (loại bỏ mọi thẻ hardcode).
- **Thử nghiệm tương tác với Gia sư Socrates**:
  - Mở Bài 1: Hỏi Socrates câu hỏi khó $\to$ Xem Socrates có trả lời ấm áp, gợi mở như trong ảnh bạn vừa chụp không.
  - Thử gõ: *"e ko biết"* $\to$ Xem Socrates có dùng ví dụ đời thường của Bài 1/Bài 2 để giảng giải không.

### BƯỚC 3: MỜI BẠN NGHIỆM THU TẬN MẮT
- Mời bạn mở Web lên, trực tiếp đọc thử Bài 1 và Bài 2 mới.
- Trực tiếp chat thử với Gia sư Socrates.
- Bạn thấy thật sự ưng ý, chất lượng đạt 10/10 thì mới chuyển sang Bước 4.

### BƯỚC 4: NHÂN RỘNG TOÀN BỘ 17 BÀI CÒN LẠI CỦA LỚP 6
- Danh sách 17 bài được lập trình tuần tự:
  - Bài 3: Thông tin trong máy tính (có Bảng đơn vị đo Bit, Byte, KB, MB, GB, TB như ảnh 2).
  - Bài 4: Mạng máy tính.
  - Bài 5: Internet.
  - ...
  - Bài 17: Chương trình máy tính.
- Toàn bộ 17 bài đều được lưu độc lập trong `data/curriculum_v2_simple/tin6/`, bảo đảm dữ liệu cũ vẫn nguyên vẹn 100%.
