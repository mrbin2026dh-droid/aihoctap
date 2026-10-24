# BẢN ĐẶC TẢ THIẾT KẾ & KẾ HOẠCH NÂNG CẤP GIAO DIỆN TỰ HỌC KHAN-FOCUS
*(Mô hình Khan Academy + Khanmigo Chuẩn Giáo Dục Ánh Sáng cho Phòng Máy THCS)*

**Đường dẫn tệp:** `.\docs\plans\2026-10-14-khan-focus-redesign.md`  
**Ngày lập:** 14/10/2026  
**Mục tiêu:** Tái cấu trúc giao diện hệ thống Web Tự học Tin học 6-9 dựa trên **Mô hình Hình 2 (Khan Academy)**: Loại bỏ sự phân mảnh của 3 cột hẹp, chuyển dịch 100% sang **Bảng màu Giáo dục Ánh sáng (Educational Light Theme)**, tối ưu cho học sinh THCS trong phòng máy LAN.

---

## 1. PHÂN TÍCH THẤT BẠI CỦA GIAO DIỆN HÌNH 1 VS TÍNH ƯU VIỆT CỦA HÌNH 2

### Nhược điểm của Hình 1 (3 Cột Cố Định Cạnh Nhau):
- **Phân mảnh không gian:** Chia màn hình thành 3 dải hẹp làm nội dung bị dồn cục, câu hỏi trắc nghiệm bị ép sát các lựa chọn A/B/C/D, tạo cảm giác ngột ngạt.
- **Xung đột nhận thức:** Học sinh nhìn thấy lý thuyết, 4 câu hỏi trắc nghiệm và khung chat cùng một lúc, không biết nên tập trung vào nhiệm vụ nào.

### Ưu điểm vượt trội của Hình 2 (Mô hình Khan Academy):
- **Cấu trúc Lộ trình Rõ Ràng (Left Roadmap Sidebar - 20%):** Học sinh biết mình đang ở đâu: *1. Đọc khái niệm -> 2. Luyện tập trắc nghiệm -> 3. Vận dụng -> 4. Ghi nhớ*.
- **Tập trung Cao Độ vào 1 Câu Hỏi (Central Focus Canvas - 52%):** 
  - Chỉ giải quyết **1 câu hỏi tại một thời điểm** kèm Thanh tiến trình ($25\% \rightarrow 50\% \rightarrow 75\% \rightarrow 100\%$).
  - Các lựa chọn A/B/C/D chiếm trọn chiều rộng thẻ, chiều cao nút $\ge 52\text{px}$, cực kỳ dễ click chuột.
  - Hộp phản hồi chữa bài xuất hiện ngay dưới câu hỏi, không che khuất màn hình.
- **Gia sư Socrates Linh Hoạt (Right Drawer - 28%):** Nằm gọn bên phải, có thể thu gọn hoặc mở rộng, tự động đọc ngữ cảnh câu hỏi học sinh đang làm để hỗ trợ khi cần.

---

## 2. CHUYỂN DỊCH BẢNG MÀU: TỪ "DARK GAMING" SANG "EDUCATIONAL LIGHT THEME"

Hình 2 trong bản mẫu trước đây đang dùng tông màu đen/tím tối (Dark Mode) vốn không phù hợp với ánh sáng lớp học. Kế hoạch này chuyển dịch sang bảng màu chuẩn Quốc tế:

| Thành phần | Màu cũ (Hình 2 - Dark Mode) | Màu MỚI (Chuẩn Giáo Dục Ánh Sáng) | Ý nghĩa Sư phạm |
| :--- | :--- | :--- | :--- |
| **Nền tổng thể** | Đen xì (`#0f172a`, `#020617`) | **Trắng ngà & Xám phấn (`#F8FAFC`, `#FFFFFF`)** | Mô phỏng trang vở học sinh, dịu mắt dưới đèn tuýp phòng máy. |
| **Thẻ câu hỏi** | Xanh đen tối | **Trắng tinh khôi (`#FFFFFF`), viền Slate-200** | Nổi bật giữa màn hình với bóng đổ nhẹ (`shadow-xs`). |
| **Màu chủ đạo** | Tím neon / Hồng tím | **Xanh lam học đường (Royal Blue `#2563EB`)** | Biểu tượng của tri thức, tin cậy và tư duy Tin học. |
| **Chữ hiển thị** | Xám mờ trên nền đen | **Đen than (`#0F172A`, `#1E293B`)** | Đạt độ tương phản cực đại **16:1 (WCAG AAA)**, cực kỳ rõ nét. |
| **Khi làm sai** | Đỏ thẫm dọa nạt (`#7F1D1D`) | **Cam hổ phách ấm (`#F59E0B`, `#FFFBEB`)** | Biểu tượng ngọn đèn 💡 khích lệ tư duy, triệt tiêu cảm giác sợ hãi. |
| **Khi làm đúng** | Xanh lá mờ | **Xanh ngọc lục bảo (`#059669`, `#ECFDF5`)** | Đem lại niềm vui và cảm giác thành tựu. |
| **Gia sư AI** | Tím phát sáng | **Xanh tím nhã nhặn (`#4F46E5`, `#EEF2FF`)** | Thân thiện như một người bạn đồng hành thông thái. |

---

## 3. THIẾT KẾ CHI TIẾT TỪNG PHÂN VÙNG GIAO DIỆN

### Phân vùng 1: Thanh Điều Hướng Lộ Trình (Left Sidebar - 20%)
- Hiển thị danh mục 4 chặng:
  - Chặng 1: *Đọc: Khái niệm cơ bản* (Icon tích xanh khi hoàn thành).
  - Chặng 2: *Luyện tập: Trắc nghiệm nhận thức* (Đang kích hoạt).
  - Chặng 3: *Vận dụng: Xử lý tình huống*.
  - Chặng 4: *Ghi nhớ trọng tâm bài học*.
- Có hộp "Mẹo tự học": Nhắc nhở học sinh không sợ chọn sai.

### Phân vùng 2: Đấu Trường Tập Trung (Central Focus Canvas - 52%)
- **Thanh tiến độ (Progress Tracker):** Hiển thị `CÂU HỎI X / 4` và thanh màu xanh lam mở rộng dần.
- **Thẻ câu hỏi chính:**
  - Nhãn phân loại bài học (ví dụ: `Khái niệm Dữ liệu & Thông tin`).
  - Tiêu đề câu hỏi: Cỡ chữ $18\text{px}$, đậm rõ ràng.
  - 4 Nút lựa chọn A, B, C, D: Kích thước lớn, khoảng cách đệm $16\text{px}$, hover có viền xanh nhẹ.
- **Hộp Sư phạm Socrates khi chọn chưa đúng:**
  - Nền vàng cam nhạt (`bg-amber-50`), viền cam ấm (`border-amber-200`).
  - Lời dẫn: *"Chưa chính xác rồi em! Hãy cùng suy nghĩ thêm một chút nhé..."*
  - Gợi ý tư duy dẫn chiếu SGK: *"👉 Xem lại Mục 1.a (SGK Trang 6)"*.
  - Nút bấm: *"Nhờ Thầy Socrates giải thích vì sao câu này chưa đúng"*.
- **Thanh điều hướng câu hỏi:** Nút *"Câu trước"*, *"Câu tiếp theo"* hoặc *"Xem kết quả tổng kết"*.

### Phân vùng 3: Gia Sư Socrates (Right Drawer - 28%)
- Header: Tên Gia sư Socrates, nhãn *"Chỉ gợi mở, không giải hộ"*, nút thu gọn/mở rộng.
- Khung trò chuyện thông minh: Tự động bắt tín hiệu câu hỏi học sinh đang làm để đưa ra lời gợi ý tương ứng.
- Các nút hỏi nhanh (Quick Chips): *"💡 Cho em ví dụ đời sống?", "📦 Phân biệt Dữ liệu và Vật mang tin?"*.
- Ô nhập chat: Cho phép học sinh gõ bất kỳ thắc mắc nào.

---

## 4. RÀNG BUỘC KỸ THUẬT & AN TOÀN PHÒNG MÁY LAN

1. **Hiệu năng phòng máy 18 máy:** Toàn bộ CSS/JS tải cục bộ, không dùng tài nguyên nặng, thời gian tải trang $< 500\text{ms}$.
2. **Bảo mật đề thi & chống gian lận:** API `/api/lesson/6/1` tuyệt đối giấu trường `dap_an_dung` để học sinh bấm F12 không xem trộm được đáp án.
3. **An toàn mã nguồn (Zero XSS):** Toàn bộ nội dung động render qua `DOMPurify.sanitize()` tuân thủ 100% Alibaba Open-Code-Review.
4. **Không lỗi tràn ngang:** Kiểm tra `scrollWidth === clientWidth` trên mọi độ phân giải máy trạm ($1366 \times 768$ và $1920 \times 1080$).
