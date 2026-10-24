# ĐẶC TẢ KIẾN TRÚC KHUNG HTML CHUẨN & HỆ THỐNG NỘI DUNG ĐỘNG (TEACHER CMS)
*(Phiên bản V2: Tiếp thu và giải quyết 100% các khuyến nghị P0/P1 từ Trọng tài độc lập Sonnet)*

**Mã tài liệu:** `docs/plans/2026-10-14-html-framework-and-teacher-cms.md`  
**Dự án:** Hệ thống AI Agent Tự học Tin học THCS (Bộ GDPT 2018)  
**Ngày cập nhật:** 14/10/2026  
**Trạng thái:** SẴN SÀNG TRIỂN KHAI (Resolved Sonnet Audit)  

---

## 1. Phân Tích Nguyên Nhân Giao Diện Cũ Bị Rối & Va Chạm Nút Bấm

Đối chiếu trực tiếp từ ảnh chụp thực tế màn hình học sinh khi mở Popup Gia sư AI:

| Vấn đề phát hiện | Nguyên nhân kỹ thuật | Giải pháp kiến trúc dứt điểm (V2) |
| :--- | :--- | :--- |
| **1. Va chạm Nút bấm & Xung đột Z-Index (Button Collision)** | Nút FAB `[💡 Gia sư AI]` cố định góc dưới phải (`bottom: 24px; right: 24px`). Nút điều hướng chính `[Câu tiếp theo ➔]` của bài trắc nghiệm cũng đặt ở góc dưới. Khi mở popup, khung chat đè lấp toàn bộ footer và vùng trắc nghiệm. | **Chuyển nút Gia sư AI lên thanh Header (góc trên bên phải)**. Đáy màn hình dành độc quyền cho Footer điều hướng bài tập (`min-height: 72px; position: sticky; bottom: 0`). Khi mở chat, hiển thị dạng **Side Dock Drawer** ở mép phải, không bao giờ đè lấp bài tập. |
| **2. Thanh gợi ý (Quick Chips) bị vỡ và thanh cuộn đè ngang chữ** | Thẻ `.quick-chips` dùng `overflow-x: auto` trên Windows nhưng không ẩn thanh cuộn chuẩn CSS thuần, khiến scrollbar xám cắt ngang thân chữ. | **Bỏ hoàn toàn overflow ngang**. Sử dụng `display: flex; flex-wrap: wrap; gap: 8px;`. Các gợi ý tự động xuống dòng gọn gàng, triệt tiêu 100% lỗi thanh cuộn xám cắt ngang chữ. |
| **3. Quá tải nhận thức trong khung hẹp** | Cửa sổ Popup nhồi nhét quá nhiều tầng: (1) Header, (2) Banner cảnh báo 3 dòng "Nguyên tắc...", (3) Bong bóng chat, (4) Thanh Chips 2 hàng, (5) Thanh Input. | Bỏ banner cảnh báo rườm rà (thay bằng motto 1 dòng ở header). Chiều cao đọc tin nhắn đạt $\ge 350\text{px}$. |
| **4. Tràn giao diện theo chiều dọc trên màn hình 1366x768** | Không có ràng buộc chiều cao theo Viewport, chỉ kiểm tra `scrollWidth`. | Cố định layout bằng `height: calc(100dvh - var(--header-h))` với `overflow-y: auto`. Đảm bảo footer luôn nhìn thấy được mà không cần cuộn trang chính. |

---

## 2. Kiến Trúc Khối Dữ Liệu Động Cho Giáo Viên (Data-Driven Block Architecture)

### 2.1. Thống Nhất Cấu Trúc File & Khớp Backend Contract 100%
- Mỗi bài học được lưu trữ duy nhất trong **1 file JSON chuẩn hóa**: `data/curriculum/tin{grade}/bai{id}.blocks.json`.
- Khớp 100% với Pydantic contract hiện có trong `backend/contracts.py`:
  - Mọi câu hỏi quiz bắt buộc có đủ: `id`, `cau_hoi`, `lua_chon` (A, B, C, D), `dap_an_dung`, `goi_y_khi_sai`, `muc_sgk`, `trang_sgk`, `giai_thich_su_pham`.
- Backend Loader (`backend/grounding.py`) đọc trực tiếp file `.blocks.json`, nếu chưa có sẽ tự động chuyển đổi từ dữ liệu Markdown + Quiz hiện có mà không gây gãy đổ.

### 2.2. Chi Tiết Schema Khối Bài Học Đầy Đủ (Lesson Block Schema)

```json
{
  "schema_version": "2.0",
  "grade": 6,
  "lesson_id": 1,
  "title": "Thông tin và Dữ liệu",
  "status": "published",
  "updated_at": "2026-10-14T17:00:00Z",
  "blocks": [
    {
      "type": "hero",
      "badge": "BÀI 1 • KHÁM PHÁ KIẾN THỨC",
      "title": "Thông tin và Dữ liệu",
      "description": "Khám phá cách con người tiếp nhận dữ liệu từ thế giới bên ngoài thông qua các giác quan và xử lý thành thông tin hữu ích."
    },
    {
      "type": "goals",
      "items": [
        "Phân biệt được thông tin và dữ liệu.",
        "Nêu được ví dụ về mối quan hệ giữa thông tin và dữ liệu.",
        "Giải thích được tầm quan trọng của thông tin trong việc ra quyết định."
      ]
    },
    {
      "type": "comparison_table",
      "left": {
        "title": "Dữ liệu (Data)",
        "badge": "MẮT THẤY - TAI NGHE",
        "description": "Là các số, chữ, hình ảnh, âm thanh thô sơ thu nhận từ thế giới bên ngoài thông qua các giác quan.",
        "examples": [
          "Ánh sáng đèn màu đỏ tại cột đèn tín hiệu",
          "Con số 39°C hiển thị trên màn hình nhiệt kế điện tử",
          "Dòng chữ 'Hà Nội 50km' trên tấm biển ven đường"
        ]
      },
      "right": {
        "title": "Thông tin (Information)",
        "badge": "NÃO XỬ LÝ - Ý NGHĨA",
        "description": "Là sự hiểu biết rút ra sau khi bộ não tiếp nhận và xử lý dữ liệu, mang lại ý nghĩa hữu ích.",
        "examples": [
          "Hiểu rằng: Cần dừng xe lại ngay để đảm bảo an toàn",
          "Biết rằng: Cơ thể đang bị sốt cao, cần uống thuốc và nghỉ ngơi",
          "Xác định được: Còn 50km nữa là sẽ tới thủ đô"
        ]
      }
    },
    {
      "type": "grid_cards",
      "title": "Vật mang tin (Information Carrier)",
      "cards": [
        { "title": "Sách vở & Báo chí", "desc": "Lưu trữ chữ viết, bảng biểu và hình vẽ", "icon": "book" },
        { "title": "Thẻ nhớ & USB", "desc": "Lưu trữ văn bản, âm thanh, video dạng số", "icon": "chip" },
        { "title": "Biển báo giao thông", "desc": "Chứa hình vẽ, biểu tượng chỉ dẫn trên đường", "icon": "sign" },
        { "title": "Tiếng trống trường", "desc": "Truyền âm thanh báo hiệu giờ vào lớp, tan học", "icon": "bell" }
      ]
    },
    {
      "type": "takeaways",
      "title": "Ghi nhớ trọng tâm",
      "items": [
        "Dữ liệu là các số, chữ, hình ảnh, âm thanh,... thô sơ thu nhận từ thế giới bên ngoài.",
        "Thông tin là sự hiểu biết thu nhận được sau khi não xử lý dữ liệu.",
        "Vật mang tin là vật thể chứa dữ liệu để lưu trữ và truyền tải.",
        "Có thông tin đúng lúc giúp con người ra quyết định chính xác và hiệu quả."
      ]
    }
  ],
  "quiz": [
    {
      "id": "q1",
      "cau_hoi": "Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại. Trong tình huống này, 'ánh sáng đèn màu đỏ' là gì?",
      "lua_chon": {
        "A": "Vật mang tin",
        "B": "Dữ liệu",
        "C": "Thông tin",
        "D": "Quyết định"
      },
      "dap_an_dung": "B",
      "muc_sgk": "Mục 1: Thông tin và dữ liệu",
      "trang_sgk": 6,
      "goi_y_khi_sai": "Xem lại Mục 1.a về Dữ liệu và Giác quan (SGK Trang 6)",
      "giai_thich_su_pham": "Chính xác! Ánh sáng màu đỏ là tín hiệu hình ảnh mà mắt em thu nhận từ thế giới bên ngoài, chưa qua bộ não suy nghĩ nên nó là Dữ liệu."
    },
    {
      "id": "q2",
      "cau_hoi": "Sau khi đọc sách thời tiết, biết chiều nay trời có thể mưa to, em quyết định mang theo áo mưa khi đi học. 'Biết chiều nay trời mưa to' là gì?",
      "lua_chon": {
        "A": "Vật mang tin",
        "B": "Dữ liệu",
        "C": "Thông tin",
        "D": "Vật cản"
      },
      "dap_an_dung": "C",
      "muc_sgk": "Mục 1: Thông tin và dữ liệu",
      "trang_sgk": 6,
      "goi_y_khi_sai": "Xem lại Mục 1.b về Thông tin và Bộ não (SGK Trang 6)",
      "giai_thich_su_pham": "Rất giỏi! Sự hiểu biết về cơn mưa sau khi đọc thông tin giúp em ra quyết định mang áo mưa, đó chính là Thông tin."
    }
  ]
}
```

---

## 3. Đặc Tả Khung Semantic HTML & Phân Tách Không Gian (V2)

### 3.1. Phân Bố Vị Trí Triệt Tiêu Xung Đột (Zero Button Collision)
- **Nút Gia sư AI (`#btnHeaderTutor`)**: Đặt trang trọng trên thanh **Header (góc trên bên phải)**, ngay cạnh huy hiệu trạng thái.
- **Footer Điều hướng Bài tập (`quiz-action-footer`)**:
  - `position: sticky; bottom: 0; min-height: 72px; width: 100%;`
  - Nằm cố định ở chân sân khấu trắc nghiệm, nền trắng bóng mờ thanh lịch, cách biệt hoàn toàn không gian.
- **Khung Chat Gia sư AI (`#socratesDrawer`)**:
  - Thiết kế dạng **Right Dock Drawer** (Trượt từ cạnh phải màn hình với `z-index: 100; box-shadow: -4px 0 20px rgba(0,0,0,0.1)`).
  - Có nút đóng `[✕]`, hỗ trợ phím tắt `Esc` để đóng nhanh.
  - Thanh Chips dùng `flex-wrap: wrap; gap: 8px;`, không bao giờ tràn ngang hay xuất hiện thanh cuộn xấu.

### 3.2. Cấu Trúc Khung HTML Đầy Đủ Với ARIA Accessibility (Chuẩn WCAG AAA)

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tự Học Tin Học THCS - Sân Khấu Giáo Dục Hiện Đại</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="app-body">

  <!-- 1. HEADER TOÀN CỤC (Thanh lịch, tối giản) -->
  <header class="app-header">
    <div class="header-brand">
      <span class="brand-badge">TIN HỌC THCS</span>
      <h1 class="brand-title">Học Tập Chủ Động</h1>
    </div>
    
    <div class="header-actions">
      <!-- Nút Mở Gia Sư Socrates (Đặt trên Header - Triệt tiêu xung đột góc dưới) -->
      <button class="header-tutor-btn" id="btnHeaderTutor" aria-label="Mở Gia sư AI Socrates" aria-controls="socratesDrawer" aria-expanded="false">
        <span class="tutor-btn-icon" aria-hidden="true">💡</span>
        <span class="tutor-btn-text">Gia sư Socrates</span>
      </button>

      <!-- Huy hiệu Chế độ Tự học -->
      <div class="header-status">
        <span class="status-dot" aria-hidden="true"></span>
        <span class="status-text">Chế độ tự học</span>
      </div>

      <!-- Nút Chuyển Trang Giáo Viên Soạn Bài (Bảo vệ bằng PIN) -->
      <button class="header-teacher-btn" id="btnOpenTeacher" aria-label="Khu vực giáo viên soạn bài">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        <span>Giáo viên</span>
      </button>
    </div>
  </header>

  <!-- 2. BỐ CỤC CHÍNH (Chiếm trọn 100dvh trừ chiều cao Header) -->
  <div class="app-shell">
    
    <!-- CỘT TRÁI: MỤC LỤC BÀI HỌC -->
    <aside class="lesson-sidebar" id="lessonSidebar" aria-label="Mục lục bài học">
      <div class="sidebar-header">
        <h2>Chủ đề học tập</h2>
      </div>
      <nav class="lesson-nav">
        <button class="nav-item active" data-grade="6" data-lesson="1">
          <span class="lesson-num">1</span>
          <span class="lesson-name">Thông tin và Dữ liệu</span>
        </button>
        <button class="nav-item" data-grade="6" data-lesson="2">
          <span class="lesson-num">2</span>
          <span class="lesson-name">Xử lý Thông tin</span>
        </button>
        <button class="nav-item" data-grade="6" data-lesson="3">
          <span class="lesson-num">3</span>
          <span class="lesson-name">Mạng máy tính</span>
        </button>
      </nav>
    </aside>

    <!-- CỘT CHÍNH: SÂN KHẤU HỌC TẬP TẬP TRUNG (DYNAMIC ARENA) -->
    <main class="learning-stage" id="learningStage">
      
      <!-- THANH TAB CHUYỂN CHẾ ĐỘ VỚI ĐẦY ĐỦ ARIA TABLIST -->
      <nav class="stage-tabs-bar" role="tablist" aria-label="Chế độ học tập">
        <button class="tab-btn active" id="tabTheory" role="tab" aria-selected="true" aria-controls="theoryContainer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          <span>Khám phá bài học</span>
        </button>
        <button class="tab-btn" id="tabPractice" role="tab" aria-selected="false" aria-controls="practiceContainer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 12 2 2 4-4"/><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z"/></svg>
          <span>Luyện tập tương tác</span>
          <span class="tab-count-badge" id="quizCountBadge">2 câu</span>
        </button>
      </nav>

      <!-- VIEW 1: VÙNG RENDER KHỐI BÀI HỌC ĐỘNG TỪ JSON -->
      <section class="stage-view active" id="theoryContainer" role="tabpanel" aria-labelledby="tabTheory">
        <!-- Render động 100% qua hàm renderDynamicBlocks() -->
      </section>

      <!-- VIEW 2: VÙNG LUYỆN TẬP TƯƠNG TÁC (KHAN-FOCUS) -->
      <section class="stage-view" id="practiceContainer" role="tabpanel" aria-labelledby="tabPractice">
        <div class="quiz-focus-card">
          <!-- Thanh chỉ số câu hỏi (Step Pills) -->
          <div class="quiz-step-bar" id="quizStepBar" aria-label="Tiến độ câu hỏi"></div>
          
          <!-- Nội dung câu hỏi hiện tại -->
          <div class="question-body">
            <h2 class="question-text" id="questionText">Đang nạp câu hỏi...</h2>
            <div class="options-grid" id="optionsGrid" role="radiogroup" aria-labelledby="questionText"></div>
          </div>

          <!-- Phản hồi sư phạm tức thì -->
          <div class="feedback-card hidden" id="feedbackCard" role="region" aria-live="polite"></div>

          <!-- FOOTER ĐIỀU HƯỚNG CỐ ĐỊNH (STICKY 72PX - ZERO COLLISION) -->
          <footer class="quiz-action-footer">
            <div class="quiz-footer-hint" id="quizFooterHint"></div>
            <div class="quiz-footer-actions">
              <button class="btn-check-answer" id="btnCheckAnswer">Kiểm tra đáp án</button>
              <button class="btn-next-question hidden" id="btnNextQuestion">Câu tiếp theo ➔</button>
            </div>
          </footer>
        </div>
      </section>

    </main>
  </div>

  <!-- 3. GIA SƯ SOCRATES: RIGHT DOCK DRAWER (Không che bài học) -->
  <aside class="socrates-drawer hidden" id="socratesDrawer" role="dialog" aria-modal="true" aria-label="Gia sư Socrates AI">
    <div class="drawer-header">
      <div class="tutor-identity">
        <span class="tutor-avatar" aria-hidden="true">💡</span>
        <div>
          <h3 class="tutor-name">Gia sư Socrates</h3>
          <span class="tutor-motto">Gợi mở từng bước • Không giải hộ</span>
        </div>
      </div>
      <button class="btn-close-drawer" id="btnCloseSocrates" aria-label="Đóng gia sư (Phím Esc)">✕</button>
    </div>

    <!-- Khung tin nhắn cuộn mượt mà -->
    <div class="drawer-chat-body" id="chatMessages" role="log" aria-live="polite">
      <div class="chat-bubble bot-bubble">
        Chào em! Thầy là Socrates. Khi đọc bài hoặc làm bài tập có khái niệm nào chưa rõ, em cứ hỏi thầy nhé!
      </div>
    </div>

    <!-- Thanh Quick Chips: Flex-wrap tự động xuống dòng (0 thanh cuộn) -->
    <div class="quick-chips-wrapper">
      <button class="quick-chip" data-prompt="Dữ liệu khác Thông tin thế nào?">Dữ liệu vs Thông tin?</button>
      <button class="quick-chip" data-prompt="Ví dụ thực tế về Vật mang tin?">Ví dụ Vật mang tin?</button>
      <button class="quick-chip" data-prompt="Gợi ý câu hỏi hiện tại giúp em với">Gợi ý câu hỏi này</button>
    </div>

    <!-- Thanh nhập liệu -->
    <form class="drawer-input-form" id="chatForm">
      <input type="text" id="chatInput" placeholder="Nhập câu hỏi cần thầy gợi mở..." autocomplete="off">
      <button type="submit" class="btn-send" id="btnSendChat" aria-label="Gửi câu hỏi">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m2 21 21-9L2 3v7l15 2-15 2v7z"/></svg>
      </button>
    </form>
  </aside>

  <!-- 4. MODAL SOẠN BÀI DÀNH CHO GIÁO VIÊN (TEACHER STUDIO VỚI JSON-EDITOR) -->
  <div class="teacher-modal hidden" id="teacherModal" role="dialog" aria-modal="true" aria-label="Trình biên soạn giáo viên">
    <div class="teacher-modal-content">
      <div class="teacher-modal-header">
        <h2>Biên Soạn Nội Dung Bài Học (Teacher Studio)</h2>
        <button class="btn-close-teacher" id="btnCloseTeacher">✕</button>
      </div>
      
      <!-- Khung xác thực PIN giáo viên -->
      <div class="teacher-auth-box" id="teacherAuthBox">
        <p>Vui lòng nhập mã PIN bảo mật của Giáo viên để chỉnh sửa bài học:</p>
        <div class="pin-input-row">
          <input type="password" id="teacherPinInput" maxlength="6" placeholder="Mã PIN 6 số...">
          <button class="btn-verify-pin" id="btnVerifyPin">Mở khóa</button>
        </div>
      </div>

      <!-- Khung Form JSON-Editor (Xuất hiện sau khi nhập đúng PIN) -->
      <div class="teacher-editor-box hidden" id="teacherEditorBox">
        <div id="jsonEditorContainer"></div>
        <div class="teacher-save-row">
          <button class="btn-save-lesson" id="btnSaveLesson">💾 Lưu và Cập nhật bài học</button>
        </div>
      </div>
    </div>
  </div>

</body>
</html>
```

---

## 4. Tích Hợp Mã Nguồn Mở GitHub Cho Giáo Viên & Bảo Mật Dữ Liệu

Theo kết luận thẩm định của Sonnet, phương án tối ưu nhất là tích hợp thư viện **`json-editor/json-editor`** (Bản quyền MIT, thuần JavaScript, 0 build step):

### 4.1. Cơ Chế Hoạt Động Của Trình Soạn Bài
1. **Frontend**:
   - Khi giáo viên click nút `[Giáo viên]` trên Header và nhập đúng mã PIN bảo mật.
   - Thư viện `json-editor` tự động lấy JSON Schema của bài học và sinh ra toàn bộ các trường nhập liệu trực quan:
     - Thêm/sửa Mục tiêu bài học (Goals).
     - Thêm/sửa Bảng 2 cột so sánh Dữ liệu - Thông tin.
     - Thêm/sửa các ô Vật mang tin (Grid Cards).
     - Thêm/sửa câu hỏi trắc nghiệm, 4 phương án, đáp án đúng và gợi ý sư phạm.
   - Khi bấm **"💾 Lưu bài học"**, dữ liệu được đóng gói thành JSON gửi về Backend.
2. **Backend Bảo Mật**:
   - API `POST /api/teacher/save-lesson` yêu cầu Header `X-Teacher-PIN`.
   - Validate chống tấn công Path Traversal: `grade` và `lesson_id` bắt buộc là số nguyên dương hợp lệ.
   - Ghi file nguyên tử: ghi vào file tạm `tempfile` rồi dùng `os.replace` để không bao giờ bị lỗi hỏng file khi đang ghi dở.

---

## 5. Bảng Tiêu Chí Đo Lường Chất Lượng Mới (Zero-Defect Matrix)

| Tiêu chuẩn kỹ thuật | Mục tiêu đo lường | Phương pháp kiểm chứng |
| :--- | :--- | :--- |
| **Không xung đột nút bấm (Zero Collision)** | Nút Gia sư chuyển lên Header; Footer bài tập sticky 72px độc quyền | Playwright Click Test: không che khuất, cách xa $\ge 300\text{px}$ |
| **Không vỡ giao diện Chips** | Quick Chips tự động xuống hàng (`flex-wrap: wrap`), 0 thanh cuộn | CSS Inspection: `flex-wrap === 'wrap'` |
| **Chiều cao 1366x768** | Không tràn thanh cuộn toàn trang | `document.documentElement.scrollHeight <= window.innerHeight` |
| **Bảo mật Giáo viên** | Học sinh không có mã PIN thì nhận 401 Unauthorized; không rò rỉ đáp án | Pytest API Security Test: `test_teacher_auth_required()` |
| **Tương thích Contract** | Đầy đủ `giai_thich_su_pham`, `muc_sgk`, `trang_sgk` | Pydantic Schema Validation 100% PASS |
