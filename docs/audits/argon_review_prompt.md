# YÊU CẦU THẨM ĐỊNH CHUYÊN SÂU & TỐI ƯU HÓA MÃ NGUỒN (SENIOR EDTECH ARCHITECT & AUDITOR)

**Kính gửi Chuyên gia Thẩm định Argon 4.0 (Gemini 4 Extended Thinking Engine),**

Bạn đang đóng vai trò **Kiến trúc sư Trưởng EdTech & Chuyên gia Bảo mật Hệ thống AI Độc lập (Senior EdTech Architect & Security Auditor)** của Dự án **Số hóa Sách Giáo Khoa Tin học Việt Nam (AI Agent SGK)**.

Nhiệm vụ của bạn: Thẩm định mã nguồn, kiến trúc và bằng chứng kiểm thử của tính năng:
**"Context-Aware Socratic AI Agent & Khan-Focus Learning Stage" (Gia sư Socrates Đa Ngữ Cảnh cho Học sinh Lớp 6)**.

---

## I. TỔNG QUAN HỆ THỐNG & TRIẾT LÝ THIẾT KẾ
1. **Đối tượng học sinh**: Lớp 6 (11 - 12 tuổi), học Bài 1 "Thông tin và Dữ liệu" (SGK Tin học 6 Cánh Diều/Kết nối tri thức).
2. **Khế ước Sư phạm Tuyệt đối (Socratic Invariant)**:
   - AI Socrates **tuyệt đối không bao giờ được giải hộ hoặc đưa ra đáp án trực tiếp** (ví dụ: "chọn B", "đáp án là B", "chọn phương án C").
   - AI phải dẫn dắt bằng phương pháp Socrates: đặt câu hỏi gợi mở, phân tích tình huống thực tế (đèn giao thông, tiếng chuông báo thức, vật mang tin).
   - Tích hợp chốt chặn Redaction: Nếu câu trả lời vô tình chứa từ khóa lộ đáp án, hệ thống phải tự động che giấu hoặc thay bằng lời dẫn hướng.
3. **Mô hình Khung học tập Khan-Focus (Stage UI)**:
   - Chia 2 chặng: Chặng 1 Khám phá lý thuyết (Cards/Blocks chuẩn JSON) -> Chặng 2 Luyện tập trắc nghiệm từng câu một.
   - Khi học sinh chọn sai, nút "Nhờ Thầy Socrates gợi ý" tự động kích hoạt drawer chat và truyền bối cảnh: Mã câu hỏi (`tin6_b1_q1`), phương án học sinh vừa chọn, để AI phản hồi trúng đích mà học sinh không cần gõ lại đề bài.
4. **Hệ thống Quản trị Giáo viên (Teacher Studio)**:
   - Giáo viên nhập PIN xác thực qua Bearer Token (SHA-256 + Rate limit chống brute-force).
   - Chỉ xuất bản bài học khi 100% câu hỏi đã được giáo viên duyệt (`teacher_verified`).
   - Mọi thao tác lưu bài học đều được ghi log kiểm toán (`audit_log.jsonl`) và tạo backup nguyên tử (`.blocks.json.bak`).

---

## II. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (100% VERIFIED METRICS)
Hệ thống đã trải qua kiểm thử độc lập nghiêm ngặt:
1. **Pytest Unit & Contract Tests**: **30/30 PASSED** (100% trong 1.17s), gồm:
   - 4 tests chuyên biệt về ChatContext & Socratic Fallback (`tests/test_socratic_agent_context.py`).
   - 18 tests về Teacher API, Rate limiting, Token, Anti-Tamper, Grounding Verifier (`tests/test_block_schema_and_teacher_api.py`).
   - 8 tests về Guardrails và Endpoints (`tests/test_api_endpoints.py`, `tests/test_socratic_guardrails.py`).
2. **Playwright E2E Tests**:
   - `test_e2e_teacher_flow.py`: PASS 100% trên cổng 8001 (cách ly dữ liệu).
   - `test_live_e2e.py`: PASS 100% trên cổng 8000 (0 lỗi Console F12, Zero-Overflow ở 1366x768).
3. **Bảo toàn Hash SHA-256 Dữ liệu thật (`bai1.blocks.json`)**:
   - Hash trước test: `783BD8E637442AF34465119503A53A318340F9BA1852E054C7EC4CAA46DB30AE`
   - Hash sau test:   `783BD8E637442AF34465119503A53A318340F9BA1852E054C7EC4CAA46DB30AE`
   - Bất biến 100%, không bị ô nhiễm ngoài sandbox.
4. **Secret Hygiene & Linter**:
   - 0 mã PIN thô trong mã nguồn git-tracked.
   - Oxlint: 0 errors, 0 warnings trên toàn bộ frontend.

---

## III. MÃ NGUỒN CỐT LÕI ĐƯỢC ĐỆ TRÌNH THẨM ĐỊNH

### 1. Khế ước Pydantic (`backend/contracts.py`):
```python
class ChatContext(BaseModel):
    """Ngữ cảnh học tập thời gian thực của học sinh khi trò chuyện với Gia sư Socrates."""
    current_question_id: Optional[str] = Field(default=None, description="Mã câu hỏi trắc nghiệm hiện tại")
    student_choice: Optional[str] = Field(default=None, description="Lựa chọn vừa chọn của học sinh (A, B, C, D)")
    is_correct: Optional[bool] = Field(default=None, description="Kết quả chấm phương án vừa chọn")
    last_action: Optional[str] = Field(default=None, description="Hành động gần nhất")
    active_tab: Optional[str] = Field(default="quiz", description="Tab đang mở: quiz hoặc theory")

class ChatRequest(BaseModel):
    grade: int = Field(..., ge=6, le=9)
    lesson_id: int = Field(..., ge=1)
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[ChatContext] = Field(default=None, description="Ngữ cảnh học tập hiện tại")
    history: List[Dict[str, str]] = Field(default_factory=list)
```

### 2. Logic Sư phạm & Guardrail Chống lộ Đáp án (`backend/agent.py`):
```python
def check_and_redact_answer_leak(reply_text: str) -> str:
    patterns = [
        r"(?:đáp án|câu trả lời|phương án|kết quả)(?:\s+đúng|\s+chính xác)?(?:\s+là|\s*:)\s*([A-D])\b",
        r"(?:hãy chọn|chọn ngay|em chọn|chọn đáp án)\s+([A-D])\b",
        r"\b(?:chọn|chọn câu)\s+([A-D])\s*(?:nhé|nha|đi em|nào)",
    ]
    redacted = reply_text
    for pat in patterns:
        if re.search(pat, redacted, flags=re.IGNORECASE):
            redacted = re.sub(
                pat,
                "hãy suy nghĩ xem bản chất khái niệm trong SGK là gì",
                redacted,
                flags=re.IGNORECASE
            )
    return redacted

def socratic_fallback_reply(grade: int, lesson_id: int, message: str, context: Optional[Any] = None) -> str:
    # 1. Phát hiện học sinh vòi đáp án
    # 2. Xử lý ngữ cảnh từng câu hỏi (tin6_b1_q1 đến tin6_b1_q4)
    # 3. Phân biệt Dữ liệu vs Thông tin vs Vật mang tin
    ...
```

### 3. Frontend Tự động tiêm Bối cảnh (`frontend/app.js`):
```javascript
// Gửi Tin nhắn Hỏi Gia sư Socrates (Typewriter Streaming & Context-Aware)
async function sendChatMessage(messageText, customContext = null) {
  let contextPayload = null;
  if (customContext) {
    contextPayload = customContext;
  } else if (state.lessonData && state.lessonData.quiz && state.lessonData.quiz[state.currentQuestionIndex]) {
    const currentQ = state.lessonData.quiz[state.currentQuestionIndex];
    const qid = currentQ.id;
    const studentChoice = state.answers ? state.answers[qid] : null;
    const evalState = state.evaluatedQuestions ? state.evaluatedQuestions[qid] : null;
    contextPayload = {
      current_question_id: qid,
      student_choice: studentChoice || null,
      is_correct: evalState ? evalState.is_correct : null,
      active_tab: state.activeTab || "quiz",
      last_action: evalState ? "submitted_answer" : "viewing_question"
    };
  }

  const payload = {
    grade: state.grade,
    lesson_id: state.lessonId,
    message: messageText,
    context: contextPayload,
    history: state.chatHistory.slice(-4)
  };
  ...
}
```

---

## IV. CÁC CÂU HỎI & YÊU CẦU ĐÁNH GIÁ CỦA CHUYÊN GIA ARGON 4.0
Nhờ Argon 4.0 thực hiện phân tích sâu theo 4 phần:

1. **Thẩm định Kỹ thuật & Khuyết tật Tiềm ẩn (Technical Vulnerability & Edge Cases)**:
   - Có điểm nghẽn (race condition), khả năng tấn công bypass prompt injection, hoặc lỗ hổng nào trong luồng dữ liệu trên không?
   - Bộ Regex Redaction có khả năng bị vượt qua bởi các biến thể khéo léo của học sinh không?

2. **Thẩm định Sư phạm EdTech (Pedagogical & UX Impact)**:
   - Các gợi ý Socratic đối với học sinh lớp 6 có thực sự tự nhiên, kích thích tư duy phản biện (Critical Thinking) mà không gây nản chí không?
   - Cơ chế tự động đưa context khi bấm nút "Gợi ý" có điểm gì cần tinh chỉnh để học sinh cảm thấy được cá nhân hóa cao hơn?

3. **Đề xuất Đoạn Code Tối ưu Cụ thể (Concrete Code Improvements)**:
   - Hãy viết ra các đoạn code cải tiến cụ thể (cho `agent.py`, `contracts.py` hoặc `app.js`) để Antigravity có thể tích hợp trực tiếp ngay lập tức.

4. **Kết luận Nghiệm thu (Final Audit Verdict)**:
   - Đưa ra quyết định chính thức: `[APPROVED]` hoặc `[REVISION_REQUIRED]`.
