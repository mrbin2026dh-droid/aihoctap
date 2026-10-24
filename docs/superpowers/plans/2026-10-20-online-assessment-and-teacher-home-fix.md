# Kế Hoạch Triển Khai Menu Kiểm Tra Trắc Nghiệm & Vá Lỗi Giao Diện Giáo Viên

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vá lỗi điều hướng Trang chủ của Giáo viên (Hình 2) và xây dựng toàn diện phân hệ Menu Kiểm tra Trắc nghiệm (tải đề từ Excel, xuất file mẫu, phòng thi mobile responsive, AI nhận xét điểm yếu & đề xuất bài học SGK) và đồng bộ lên GitHub.

**Architecture:** Mở rộng Backend FastAPI với Pydantic contract cho Quản lý Đề kiểm tra (CRUD, Excel Import/Export qua openpyxl, AI Evaluation qua Gemini/Rule-based Scaffolding); bổ sung Sân khấu Kiểm tra (Exam Hub & Immersive Arena) trên Frontend tách bạch vai trò Giáo viên / Học sinh, responsive 100% trên thiết bị di động, tự động nộp bài và phân tích lỗ hổng kiến thức.

**Tech Stack:** FastAPI, Python Pydantic v2, openpyxl, Vanilla JavaScript (ES6+), HTML5 Canvas/CSS3 Flex & Grid Responsive, Playwright for E2E testing, Git & Alibaba Open-Code-Review.

**Spec:** [bao_cao_phan_tich_va_de_xuat_menu_kiem_tra.md](file:///~/.gemini/antigravity/brain/9c43807f-2e07-4689-8680-2d26e4b6e48d/bao_cao_phan_tich_va_de_xuat_menu_kiem_tra.md)

---

## Global Constraints

- **Zero-Vision Prompt Law**: Không nạp ảnh chụp màn hình vào prompt của LLM. Mọi kiểm thử giao diện đo bằng thông số thật (`scrollWidth === clientWidth`, DOM assertion, console errors = 0).
- **Zero-Guesswork / Zero-Mock**: Dữ liệu đề kiểm tra, bài nộp, và phân tích AI phải lưu trữ thật trên máy chủ (`data/exams/` và file JSON hợp lệ), không mock tạm bợ trong RAM.
- **Mobile Responsive Invariant**: Giao diện phòng thi phải hoạt động hoàn hảo trên viewport di động (360px - 414px) với chiều cao tối ưu $\ge 85\text{vh}$, phím bấm $\ge 44\text{px}$, độ tương phản WCAG AAA ($\ge 7:1$).
- **Clean State & RBAC**: Giáo viên và Học sinh phải có không gian trạng thái độc lập; chuyển đổi vai trò phải dọn sạch UID/tiến trình cũ.

## Review Focus

1. **Khắc phục lỗi Hình 2**: Giáo viên bấm `[Trang chủ]` phải về trung tâm điều hành của giáo viên, không còn hiển thị nhiệm vụ học sinh.
2. **Import/Export Excel**: File Excel mẫu tiếng Việt có dấu, khi giáo viên tải lên phải parse đúng các cột câu hỏi, phương án A-D, đáp án đúng, mục SGK.
3. **Phòng thi Học sinh**: Tương thích hoàn toàn điện thoại di động, đồng hồ đếm ngược chạy mượt mà, lưu bài tạm thời tránh mất khi mất kết nối, tự động nộp bài khi hết giờ.
4. **AI Nhận xét & Đề xuất bài học**: Phân tích đúng các câu sai, chỉ rõ khái niệm yếu và hiển thị liên kết trực tiếp tới mục bài học SGK cần ôn luyện.
5. **Đồng bộ GitHub**: Vượt qua git pre-commit hook Alibaba OCR và đẩy lên branch `main`.

---

## Các Nhiệm Vụ Triển Khai (Tasks)

### Task 1: Vá Lỗi Điều Hướng Trang Chủ & Dọn Dẹp Session Giáo Viên (Fix Hình 2)
**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/index.html`
- Test: `tests/test_fix_teacher_home.py`

**Steps:**
- [ ] 1.1 Viết kịch bản test Playwright `tests/test_fix_teacher_home.py` kiểm tra: Đăng nhập học sinh -> Đăng nhập giáo viên -> Bấm `[Trang chủ]` -> Đảm bảo KHÔNG xuất hiện "Nhiệm vụ của em" hay "Chào [Tên học sinh]".
- [ ] 1.2 Trong `frontend/app.js`: Sửa hàm `handleTeacherPinLogin()` để dọn sạch `studentAuthState.uid`, `studentAuthState.studentCode`, đặt `studentAuthState.uid = "teacher_session"`.
- [ ] 1.3 Trong `frontend/app.js`: Cập nhật sự kiện click của `#btnNavDashboard` và hàm `switchView("dashboard")`: nếu `state.isTeacher` hoặc `state.teacherUnlocked`, điều hướng về Sân khấu Quản lý Sư phạm (`openStudentManagementStage()`) thay vì `#dashboardView` của học sinh.
- [ ] 1.4 Chạy `tests/test_fix_teacher_home.py` xác nhận PASS 100%.

---

### Task 2: Xây Dựng Backend API Quản Lý Đề Kiểm Tra & Xử Lý File Excel
**Files:**
- Create: `backend/exam_service.py`
- Modify: `backend/server.py`
- Modify: `requirements.txt`
- Test: `tests/test_exam_backend.py`

**Steps:**
- [ ] 2.1 Viết test unit `tests/test_exam_backend.py` kiểm thử các endpoint:
  - `GET /api/exams/template`: Xuất file Excel mẫu `.xlsx`.
  - `POST /api/teacher/exams/upload-excel`: Tải lên file Excel câu hỏi và sinh bài kiểm tra.
  - `POST /api/teacher/exams/create`: Tạo bài kiểm tra thủ công.
  - `GET /api/exams/list`: Lấy danh sách đề kiểm tra theo khối/lớp.
  - `POST /api/exams/submit`: Nộp bài thi và nhận kết quả phân tích AI sư phạm.
- [ ] 2.2 Tạo `backend/exam_service.py`:
  - Định nghĩa Pydantic models: `QuestionItem`, `ExamCreateRequest`, `ExamSubmissionRequest`, `AIEvaluationResult`.
  - Hàm sinh file Excel mẫu chuẩn (`export_exam_template_excel`).
  - Hàm đọc và bóc tách file Excel tải lên (`parse_exam_excel_file`).
  - Hàm lưu trữ và quản lý đề kiểm tra trong thư mục `data/exams/`.
  - Hàm chấm điểm và sinh nhận xét AI Socrates: phát hiện điểm yếu theo từng mục SGK và đề xuất bài học tương ứng.
- [ ] 2.3 Tích hợp các route mới vào `backend/server.py`. Thêm `openpyxl` vào `requirements.txt`.
- [ ] 2.4 Chạy test `tests/test_exam_backend.py` xác nhận PASS 100%.

---

### Task 3: Xây Dựng Giao Diện Menu Kiểm Tra & Phân Hệ Giáo Viên (Tải Excel, Tạo Đề)
**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Modify: `frontend/app.js`
- Test: `tests/test_teacher_exam_ui.py`

**Steps:**
- [ ] 3.1 Bổ sung nút `[📝 Kiểm tra]` trên Header và mục `📋 Bài kiểm tra` trên Sidebar của `frontend/index.html`.
- [ ] 3.2 Xây dựng Modal / Sân khấu Quản lý Đề Kiểm tra cho Giáo viên:
  - Danh sách các bài kiểm tra đã tạo kèm trạng thái (Đang mở, Đã đóng).
  - Form tạo bài kiểm tra: Tiêu đề, chọn khối 6-9, lớp target (9A, 9B, Tất cả), thời gian làm bài (phút), ngày giờ.
  - Nút **"Tải file mẫu Excel"** (`/api/exams/template`).
  - Khối **"Tải lên đề thi từ Excel"** (kéo thả file hoặc chọn file `.xlsx`, tự động xem trước danh sách câu hỏi trước khi lưu).
- [ ] 3.3 Thêm CSS trong `frontend/style.css` chuẩn Design System (Dark Navy / Cyan / Amber).
- [ ] 3.4 Viết logic xử lý sự kiện trong `frontend/app.js`: tải danh sách đề, tải file mẫu, upload file Excel, lưu đề mới.
- [ ] 3.5 Chạy test xác nhận giáo viên có thể tạo đề và import Excel thành công.

---

### Task 4: Xây Dựng Phòng Thi Học Sinh (Mobile Responsive & AI Diagnostic)
**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Modify: `frontend/app.js`
- Test: `tests/test_student_exam_mobile.py`

**Steps:**
- [ ] 4.1 Xây dựng Sân khấu Làm bài kiểm tra cho Học sinh (`#examStage`):
  - Thanh tiêu đề: Tên bài thi, Lớp, Đồng hồ đếm ngược thời gian thực (Countdown Timer).
  - Bảng ma trận điều hướng câu hỏi (1..N) hỗ trợ cuộn mượt mà trên mobile.
  - Thẻ câu hỏi trung tâm: Font chữ to rõ, 4 nút lựa chọn A-B-C-D dạng card chạm $\ge 48\text{px}$, không vỡ layout trên màn hình 360px - 414px.
  - Nút "Nộp bài" với hộp thoại xác nhận báo rõ số câu đã làm / câu chưa làm.
- [ ] 4.2 Cơ chế tự động lưu đáp án tạm (Local Auto-Save) và Tự động nộp khi hết giờ.
- [ ] 4.3 Màn hình Kết quả & Phân tích Sư phạm AI:
  - Hiển thị Điểm số, Số câu đúng/sai, Thời gian làm bài.
  - Khối **Nhận xét AI Socrates**: Phân tích từng câu sai, phát hiện khái niệm còn hổng (ví dụ: *chưa phân biệt được Dữ liệu và Vật mang tin*).
  - Khối **Đề xuất ôn tập SGK**: Danh sách các bài học / mục kiến thức cụ thể kèm nút **[📖 Mở bài học để ôn lại ngay]** (nhấp vào tự động mở bài học đó trên ứng dụng).
- [ ] 4.4 Viết CSS responsive mobile cực chuẩn: `@media (max-width: 768px)` và `@media (max-width: 480px)` đảm bảo `scrollWidth === clientWidth` (0 tràn ngang).
- [ ] 4.5 Viết test Playwright `tests/test_student_exam_mobile.py` giả lập viewport mobile ($375 \times 667$ và $414 \times 896$), kiểm tra toàn bộ luồng làm bài -> nộp bài -> nhận kết quả AI -> mở bài học đề xuất.

---

### Task 5: Rà Soát Mã Nguồn, Kiểm Tra Toàn Diện & Đẩy Lên GitHub
**Files:**
- Test: `tests/test_live_all_4.py` và các file test liên quan
- Git Commit & Push

**Steps:**
- [ ] 5.1 Kiểm tra chất lượng mã nguồn bằng Alibaba Open-Code-Review hook.
- [ ] 5.2 Khởi chạy server kiểm thử E2E tổng hợp (Dual-context Teacher & Student).
- [ ] 5.3 `git add .` và `git commit -m "feat: Tich hop Menu Kiem tra trac nghiem, Upload Excel, AI Diagnostic va fix loi Trang chu Giao vien"`
- [ ] 5.4 `git push origin main` và xác nhận commit đã lên GitHub thành công.
