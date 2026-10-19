# KẾ HOẠCH TRIỂN KHAI: MÀN HÌNH QUẢN LÝ HỌC SINH & GEMINI AI PHÂN TÍCH SƯ PHẠM
> **Mã kế hoạch:** `PLN-2026-10-19-STUDENT-MANAGEMENT-DASHBOARD`  
> **Trạng thái:** Sẵn sàng thực thi (Ready for Implementation)  
> **Phạm vi trọng tâm:** Hoàn thiện trọn vẹn **Bước 3 (Giao diện Frontend Dashboard)** và **Bước 4 (Backend API Gemini Phân tích Sư phạm)** trước, tạo nền tảng vững chắc để nối tiếp Bước 1 & 2 (Firebase Google Login & Firestore).

---

## 🎯 MỤC TIÊU CỐT LÕI
1. **Giao diện (Frontend - Bước 3)**: Xây dựng màn hình **Quản lý học sinh** theo bố cục tinh hoa của **Hình 2** (kết hợp Sidebar thống nhất của **Hình 1**), bao gồm:
   - 5 Thẻ KPI: Sĩ số (35 em), Đã hoàn thành (28 em - 80%), Điểm trung bình (8,4/10), **Học sinh tiến bộ (30 em - 86%)**, Cần hỗ trợ thêm (5 em - 14%).
   - Biểu đồ Donut tiến độ học tập (Canvas/SVG thuần, không tải thư viện ngoài).
   - Biểu đồ Cột mức độ thành thạo theo 5 chủ đề Tin học THCS.
   - Khối **"Nhận xét & gợi ý từ AI" (AI Pedagogical Insights)** với hiệu ứng lấp lánh và nút cập nhật tức thì.
   - Bảng danh sách học sinh có **ma trận icon trực quan 5 chủ đề** (Tick xanh / Chấm than vàng / Gạch xám), tìm kiếm, bộ lọc và xuất báo cáo CSV.
2. **Hệ thống & AI (Backend - Bước 4)**: 
   - Xây dựng Khế ước Pydantic Contract Type-Safe chặt chẽ (`backend/contracts.py`).
   - Cung cấp API `/api/teacher/students-overview/{grade}/{class_name}` trả về dữ liệu lớp học có cấu trúc chuẩn.
   - Tích hợp Gemini AI (`/api/teacher/analyze-class`) tự động phân tích ma trận điểm của lớp, phát hiện học sinh yếu và xuất ra 3 gợi ý sư phạm hành động cụ thể cho giáo viên.
3. **Kiến trúc Tương thích Tương lai (Data Adapter Pattern)**:
   - Tách biệt tầng hiển thị với nguồn dữ liệu qua giao diện `StudentDataAdapter`.
   - Giai đoạn hiện tại (Bước 3 & 4): Chạy qua `LocalMockStudentAdapter` (dữ liệu mẫu 35 học sinh lớp 9A sống động, chuẩn xác 100% như ảnh mẫu).
   - Giai đoạn tiếp theo (Bước 1 & 2): Chỉ cần hoán đổi sang `FirestoreStudentAdapter` mà không phải sửa lại bất kỳ dòng mã HTML/CSS/UI nào!

---

## 🛠 DANH MỤC CÁC TỆP THAY ĐỔI & TẠO MỚI

| Thao tác | Đường dẫn tệp | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Sửa đổi** | `backend/contracts.py` | Bổ sung Pydantic models: `StudentOverviewItem`, `ClassKPIMetrics`, `ClassAnalyticsResponse`, `AIPedagogicalAdviceRequest/Response` |
| **Sửa đổi** | `backend/server.py` | Bổ sung 2 endpoint API: `/api/teacher/students-overview/...` và `/api/teacher/analyze-class` |
| **Sửa đổi** | `backend/agent.py` | Bổ sung hàm `analyze_class_pedagogy()` sử dụng Google Gemini SDK với Prompt Sư phạm THCS |
| **Tạo mới** | `tests/test_student_analytics.py` | Unit test cho Contract và API phân tích số liệu lớp học |
| **Sửa đổi** | `frontend/index.html` | Bổ sung nút Sidebar "Quản lý học sinh" và cấu trúc HTML của Stage Dashboard |
| **Sửa đổi** | `frontend/style.css` | Bổ sung toàn bộ style giao diện Dashboard, Card KPI, Biểu đồ, Ma trận icon và Bảng học sinh |
| **Sửa đổi** | `frontend/app.js` | Lập trình Data Adapter, Render biểu đồ SVG/Canvas, Tương tác bảng và Gọi API Gemini AI |
| **Tạo mới** | `tests/test_dashboard_e2e.py` | Test E2E tự động bằng Playwright: Kiểm tra 0 lỗi Console F12, không tràn ngang và tương tác mượt mà |

---

## 📋 LỘ TRÌNH THỰC HIỆN TỪNG BƯỚC CHI TIẾT (TASK BREAKDOWN)

### GIAI ĐOẠN 1: BACKEND CONTRACTS & GEMINI PEDAGOGICAL AI (BƯỚC 4)

#### Task 1: Định nghĩa Khế ước Pydantic & Kho Dữ liệu Mẫu (Data Contracts)
- [ ] **Step 1.1**: Viết failing test `tests/test_student_analytics.py` kiểm tra các schema `StudentOverviewItem`, `ClassAnalyticsResponse`.
- [ ] **Step 1.2**: Trong `backend/contracts.py`, bổ sung các Pydantic class:
  ```python
  class TopicMasteryStatus(BaseModel):
      topic_id: str
      topic_name: str
      score: float
      status: Literal["mastered", "warning", "not_started"]  # Tương ứng tick xanh, chấm than vàng, gạch xám

  class StudentOverviewItem(BaseModel):
      id: str
      student_code: str
      full_name: str
      avatar_url: Optional[str] = None
      progress_percent: int
      average_score: float
      topics: List[TopicMasteryStatus]
      status: Literal["completed", "learning", "needs_support"]

  class ClassKPIMetrics(BaseModel):
      total_students: int
      completed_count: int
      completed_percent: float
      average_score: float
      score_delta_month: float
      improved_count: int
      improved_percent: float
      needs_support_count: int
      needs_support_percent: float

  class ClassAnalyticsResponse(BaseModel):
      grade: int
      class_name: str
      semester: str
      kpi: ClassKPIMetrics
      topic_averages: Dict[str, float]
      donut_progress: Dict[str, int]
      students: List[StudentOverviewItem]
  ```
- [ ] **Step 1.3**: Chạy test `pytest tests/test_student_analytics.py` $\rightarrow$ Đảm bảo PASS 100%.

#### Task 2: Xây dựng AI Pedagogical Engine với Google Gemini
- [ ] **Step 2.1**: Trong `backend/agent.py`, cài đặt hàm `analyze_class_pedagogy(class_data: ClassAnalyticsResponse) -> Dict[str, Any]`.
  - Thiết lập System Prompt sư phạm chuẩn:
    - *Vai trò:* Cố vấn Sư phạm Tin học THCS cao cấp.
    - *Nhiệm vụ:* Đọc toàn bộ bảng số liệu KPI và ma trận điểm theo 5 chủ đề.
    - *Đầu ra JSON định dạng:*
      1. `general_assessment`: Nhận xét tổng quan tiến độ và điểm trung bình so với kỳ trước.
      2. `critical_concerns`: Cảnh báo cụ thể số học sinh cần hỗ trợ và chủ đề có tỷ lệ điểm dưới 8.0.
      3. `actionable_recommendations`: 3 hành động sư phạm cụ thể (ví dụ: tổ chức mini-quiz, giao bài tập bổ trợ, chia nhóm học sinh khá kèm học sinh yếu).
- [ ] **Step 2.2**: Thêm Fallback dự phòng thông minh (Rule-based pedagogical generator) phòng trường hợp mạng offline hoặc không có API key.
- [ ] **Step 2.3**: Viết Unit test `test_gemini_pedagogy` kiểm tra đầu ra JSON hợp lệ.

#### Task 3: Cung cấp API Endpoints trong `backend/server.py`
- [ ] **Step 3.1**: Đăng ký endpoint `GET /api/teacher/students-overview/{grade}/{class_name}`:
  - Trả về dữ liệu `ClassAnalyticsResponse` của lớp 9A (35 học sinh, số liệu trùng khớp 100% Hình 2).
- [ ] **Step 3.2**: Đăng ký endpoint `POST /api/teacher/analyze-class`:
  - Tiếp nhận yêu cầu phân tích, gọi `analyze_class_pedagogy()` và trả về lời khuyên sư phạm.
- [ ] **Step 3.3**: Chạy `pytest tests/test_student_analytics.py` xác minh cả 2 endpoint hoạt động chuẩn xác với mã HTTP 200.

---

### GIAI ĐOẠN 2: THIẾT KẾ & TÍCH HỢP GIAO DIỆN FRONTEND (BƯỚC 3)

#### Task 4: Cấu trúc Khung HTML & Hệ thống Icon SVG (No External Heavy Libs)
- [ ] **Step 4.1**: Trong `frontend/index.html`, tại thanh Header/Sidebar:
  - Thêm nút điều hướng `Quản lý học sinh` có icon nhóm người (`👥`).
- [ ] **Step 4.2**: Tạo vùng hiển thị độc lập `<section id="studentManagementStage" class="student-management-stage" hidden>` chứa:
  1. **Thanh Toolbar đỉnh**: Dropdown Lớp (9A, 9B, 9C), Dropdown Học kỳ, Nút "Xuất báo cáo".
  2. **Grid 5 Thẻ KPI**: Thiết kế thẻ bo góc squircle, icon nền màu tương phản cao, badge % tăng trưởng.
  3. **Hàng Biểu đồ & AI Insights (3 cột)**:
     - Cột 1: Khối "Tiến độ học tập của lớp" (Donut Chart SVG hiển thị 80% Hoàn thành, 3 màu phân đoạn).
     - Cột 2: Khối "Kết quả luyện tập theo chủ đề" (Bar Chart SVG trực quan cho 5 chủ đề từ 0-10).
     - Cột 3: Khối "Nhận xét & gợi ý từ AI" (Biểu tượng sao lấp lánh AI, 3 đoạn nội dung có icon trạng thái, nút "Làm mới gợi ý").
  4. **Bảng Danh sách Học sinh**:
     - Thanh tìm kiếm theo tên hoặc mã HS, Bộ lọc trạng thái (Hoàn thành, Đang học, Cần hỗ trợ).
     - Bảng dữ liệu có ảnh đại diện, thanh tiến độ, điểm trung bình, cụm 5 icon chủ đề ma trận, nhãn trạng thái và cột Thao tác (icon mắt xem chi tiết, icon biểu đồ).
  5. **Modal Chi tiết Học sinh**: Hộp thoại popup khi bấm xem từng học sinh để xem chi tiết lịch sử học tập và điểm từng bài.

#### Task 5: CSS Tinh tế, Đạt chuẩn WCAG AAA & Zero-Overflow
- [ ] **Step 5.1**: Trong `frontend/style.css`, áp dụng bảng màu Dark Navy Slate hiện đại (`#0F172A`, `#1E293B`, `#334155`) khớp 100% với giao diện hiện tại của ứng dụng.
- [ ] **Step 5.2**: Đảm bảo tiêu chuẩn kiểm thử Rule 3:
  - Tỷ lệ tương phản chữ $\ge 7:1$ (WCAG AAA).
  - Điểm chạm phím tương tác $\ge 44\text{px}$.
  - Thiết kế thích ứng (Responsive): Hỗ trợ mượt mà từ màn hình lớn $1920 \times 1080$ đến màn hình phòng máy trường học $1366 \times 768$ (tự động chuyển dạng thẻ cuộn ngang nếu bảng quá rộng, không làm vỡ layout chính).

#### Task 6: Lập trình JavaScript Engine & Data Adapter Pattern
- [ ] **Step 6.1**: Trong `frontend/app.js`, định nghĩa tầng `StudentDataAdapter`:
  ```javascript
  class StudentDataAdapter {
    async getClassOverview(grade, className) { ... }
    async getAIPedagogicalAdvice(classData) { ... }
    async exportReportCSV(grade, className) { ... }
  }
  ```
- [ ] **Step 6.2**: Viết bộ dựng đồ họa thuần (Pure Canvas/SVG Renderers) cho Donut Chart và Bar Chart mà không cần nạp thêm thư viện ngoài (Chart.js / D3.js) nhằm bảo vệ tốc độ tải trang cực nhanh.
- [ ] **Step 6.3**: Viết logic lọc và tìm kiếm thời gian thực (Debounced Search) cho bảng học sinh.
- [ ] **Step 6.4**: Kết nối sự kiện bấm nút "Làm mới gợi ý AI" $\rightarrow$ Hiển thị spinner tải mượt mà $\rightarrow$ Gọi API `/api/teacher/analyze-class` $\rightarrow$ Cập nhật nội dung khối AI.

---

### GIAI ĐOẠN 3: KIỂM THỬ TOÀN DIỆN ZERO-BUG & NGHIỆM THU (GATEKEEPER)

#### Task 7: Kiểm thử Tự động Playwright & Đo lường Định lượng
- [ ] **Step 7.1**: Tạo kịch bản kiểm thử tự động `tests/test_student_dashboard_e2e.py`:
  - Khởi động server Web.
  - Dùng Playwright mở trình duyệt, đăng nhập giáo viên, bấm vào mục "Quản lý học sinh".
  - Kiểm tra 5 thẻ KPI hiển thị đầy đủ số liệu (35 em, 80%, 8.4, 86%, 14%).
  - Kiểm tra đồ thị Donut và đồ thị Cột render đúng các thẻ SVG/Canvas.
  - Kiểm tra bấm nút "Làm mới gợi ý AI" nhận được phản hồi thành công và hiển thị văn bản sư phạm.
  - Kiểm tra tìm kiếm học sinh: gõ "Minh Anh" $\rightarrow$ Bảng chỉ còn 1 dòng của em Minh Anh.
  - Đo đạc Console F12: Xác nhận **0 Errors, 0 Warnings**.
  - Đo đạc Layout: Xác nhận `document.body.scrollWidth === window.innerWidth` trên cả 2 độ phân giải $1920 \times 1080$ và $1366 \times 768$.
- [ ] **Step 7.2**: Chạy kiểm duyệt cú pháp mã nguồn bằng Alibaba Open-Code-Review (`ocr`) để đảm bảo không vi phạm anti-pattern nào.

---

### GIAI ĐOẠN 4: KẾT NỐI BƯỚC 1 & 2 (FIREBASE GOOGLE SIGN-IN & FIRESTORE)
*Sau khi Bước 3 và 4 đã chạy mượt mà 100% trên môi trường Web, chúng ta sẽ thực hiện chuyển đổi dữ liệu thật:*
- [ ] **Step 8.1**: Hướng dẫn giáo viên tạo dự án Firebase miễn phí và dán `firebaseConfig`.
- [ ] **Step 8.2**: Kích hoạt nút `[ G Đăng nhập bằng Google ]` trên giao diện học sinh.
- [ ] **Step 8.3**: Triển khai `FirestoreStudentAdapter` để tự động ghi điểm làm bài trắc nghiệm của học sinh lên Firebase Firestore theo thời gian thực.
- [ ] **Step 8.4**: Dashboard của giáo viên tự động đọc bảng điểm thật từ Firestore thay thế dữ liệu mẫu.

---

## 🔒 TIÊU CHÍ NGHIỆM THU ĐẠT CHUẨN (DEFINITION OF DONE)
1. Màn hình Quản lý học sinh mở lên mượt mà dưới 300ms, không lag giật.
2. 5 Thẻ KPI, 2 Biểu đồ và Khối AI gợi ý hiển thị chuẩn xác, đẹp mắt như Hình 2.
3. Bảng học sinh lọc và tìm kiếm tức thì.
4. Gemini AI phân tích sư phạm trả về lời nhận xét thực tế, mang tính giáo dục THCS cao.
5. 100% các bài test (Pytest & Playwright E2E) đều đạt **PASS (Green)**.
