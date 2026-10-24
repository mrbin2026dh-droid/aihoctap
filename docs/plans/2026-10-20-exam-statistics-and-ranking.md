# Kế Hoạch Hiện Thực Hóa: Thống Kê & Xếp Hạng Bài Kiểm Tra Thực Tế Từ Firebase

> **Ngày lập kế hoạch**: 20/10/2026  
> **Mục tiêu**: Xây dựng hệ thống Thống kê và Bảng xếp hạng bài kiểm tra học sinh khoa học, hiện đại, chuẩn EdTech SaaS 2026. Toàn bộ dữ liệu được đọc và đồng bộ 100% từ Firebase Realtime Database (`exams`, `exam_submissions`, `students/{classCode}`).  
> **Phạm vi**: Giao diện Học sinh (`#examStudentView`), Sân khấu Kết quả (`#examResultView`), Giao diện Giáo viên (`#examTeacherView` & `#examTeacherResultsModal`), Backend Exam Service.

---

## 1. Kiến Trúc Dữ Liệu Thực Tế (Firebase Realtime Database)

- `exams/{exam_id}`: Thông tin đề thi (tiêu đề, khối lớp, lớp áp dụng, thời gian, câu hỏi).
- `exam_submissions/{exam_id}/{student_id}`:
  - `student_id`, `student_name`, `student_code`, `class_code`
  - `score`, `correct_count`, `total_questions`, `percentage`, `time_spent`, `submitted_at`
  - `answers`: `{ [q_id]: chosen_option }`
  - `evaluation`: `{ socratic_advice, weak_topics, recommended_lessons, details }`
- `students/{class_code}/{student_id}`:
  - `full_name`, `student_code`, `email`, `avatar`, `grade`, `class_code`
  - `exams/{exam_id}`: `{ exam_id, exam_title, score, correct_count, total_questions, submitted_at }`

---

## 2. Danh Sách Nhiệm Vụ Chi Tiết (Bite-Sized Tasks)

### Nhiệm Vụ 1: Hợp Đồng Dữ Liệu & Hàm Đọc Firebase (Backend & Frontend Data Contract)
- **Tệp**: `frontend/app.js`
- **Nội dung**:
  1. Thêm `fetchStudentExamSubmissions(studentId, classCode)`: Đọc tất cả bài kiểm tra mà học sinh này đã làm từ Firebase.
  2. Thêm `fetchClassLeaderboardData(classCode, examId)`: Đọc và tính toán bảng xếp hạng lớp từ `exam_submissions` và `students/{classCode}`.
  3. Thêm hàm tính toán KPI bài kiểm tra của học sinh: tổng số bài được giao, số bài đã làm, điểm trung bình thi, thứ hạng lớp, tỷ lệ đạt.

### Nhiệm Vụ 2: Thiết Kế Giao Diện Sân Khấu Học Sinh (`frontend/index.html` & `frontend/style.css`)
- **Tệp**: `frontend/index.html`, `frontend/style.css`
- **Nội dung**:
  1. Thêm thanh KPI cá nhân (`.student-exam-kpi-bar`): 4 thẻ chỉ số (Số bài đã làm, Điểm TB, Thứ hạng lớp, Tỷ lệ đúng).
  2. Thêm thanh chuyển Tab (`.student-exam-tabs`):
     - Tab 1: Đề thi của lớp (`#tabStudentExamsList`)
     - Tab 2: Bảng xếp hạng lớp (`#tabStudentLeaderboard`)
     - Tab 3: Lịch sử & Phân tích AI Socrates (`#tabStudentExamHistory`)
  3. Thiết kế Podium Top 3 (Bục vinh danh 🥇 🥈 🥉) và Bảng xếp hạng toàn lớp chuẩn Responsive không tràn ngang.
  4. Nâng cấp thẻ đề thi (`.exam-card-item`): Hiển thị trạng thái "✔ Đã hoàn thành (Điểm số)" kèm nút "👁 Xem lại bài làm & Lời khuyên AI" và "🔄 Làm lại".

### Nhiệm Vụ 3: Triển Khai Logic Render Phía Học Sinh (`frontend/app.js`)
- **Tệp**: `frontend/app.js`
- **Nội dung**:
  1. Nâng cấp `loadStudentExams()`: Tải song song danh sách đề thi và lịch sử bài nộp của học sinh từ Firebase.
  2. Triển khai `renderStudentExamKPIs()`: Cập nhật 4 chỉ số thực tế.
  3. Triển khai `renderStudentExamCards()`: Phân biệt đề đã làm và chưa làm; gắn sự kiện xem lại bài làm cũ mở lại `#examResultView` với dữ liệu thực từ Firebase.
  4. Triển khai `renderClassLeaderboard(examIdFilter)`: Render bục Top 3 và bảng xếp hạng lớp, gắn highlight dòng học sinh hiện tại.
  5. Triển khai `renderStudentExamHistory()`: Render lịch sử thi và các lỗ hổng kiến thức AI Socrates chẩn đoán.

### Nhiệm Vụ 4: Nâng Cấp Thống Kê & Bảng Điểm Phía Giáo Viên (`frontend/app.js` & `frontend/index.html`)
- **Tệp**: `frontend/app.js`, `frontend/index.html`
- **Nội dung**:
  1. Thêm phổ điểm mini (Biểu đồ phân loại điểm: Giỏi / Khá / TB / Yếu).
  2. Bổ sung nút "🔍 Chi tiết" trong bảng điểm kết quả giáo viên để xem lại đáp án học sinh chọn và nhận xét Socrates.
  3. Thêm nút "📥 Xuất Excel / In bảng điểm" cho giáo viên.

### Nhiệm Vụ 5: Kiểm Thử Tự Động & Thẩm Định Zero-Bug (TDD / Playwright / Oxlint)
- **Tệp**: `tests/test_live_exam_statistics_and_ranking.py`
- **Nội dung**:
  1. Kiểm thử Playwright: Đăng nhập học sinh lớp 9A (học sinh `Mr KhangKhoi`).
  2. Xác minh dữ liệu KPI hiển thị đúng điểm số thật từ Firebase (ví dụ: điểm 2.5 từ bài test đã làm).
  3. Xác minh Tab Bảng xếp hạng lớp hiển thị đúng thứ hạng từ Firebase RTDB.
  4. Kiểm tra đa độ phân giải 1920x1080 và 1366x768, đảm bảo 0 horizontal overflow (`scrollWidth === clientWidth`) và Console 0 error.
  5. Chạy Alibaba OCR Auditor và Oxlint.

### Nhiệm Vụ 6: Đồng Bộ Lên Nhánh `gh-pages` (Cấm push lên `main`)
- **Nội dung**:
  1. Đồng bộ mã nguồn sang worktree `gh-pages`.
  2. Commit với thông điệp chuẩn Conventional Commits.
  3. Push lên `origin gh-pages`.
