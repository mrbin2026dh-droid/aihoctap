# KẾ HOẠCH NÂNG CẤP NÃO BỘ AGENT AI SOCRATES THẤU HIỂU NGỮ CẢNH (CONTEXT-AWARE SOCRATIC AGENT)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp Gia sư Socrates AI từ phản hồi tĩnh chung chung thành Động cơ Sư phạm Thấu hiểu Ngữ cảnh thời gian thực (Context-Aware Socratic Engine): Tự động nhận diện câu hỏi học sinh đang làm, phương án sai vừa chọn, phát hiện ngộ nhận và dẫn dắt tư duy từng bước bám sát SGK (Zero-Direct-Answer & Strict Grounding).

**Architecture:** Mở rộng Khế ước dữ liệu `ChatRequest` với `ChatContext` (Pydantic), thiết lập tầng phân tích ngộ nhận (Misconception Diagnostic Layer) và bộ định tuyến đa chế độ (Gemini 2.5 Flash Online + Deterministic Local Socratic Fallback Offline). Kết nối hai chiều với Frontend Khan-Focus Canvas qua SSE / JSON API.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, Google GenAI SDK (Gemini 2.5 Flash), Playwright, Pytest, Vanilla JS / CSS.

**Spec:** `docs/plans/2026-10-14-khan-focus-redesign.md` và `.stitch/DESIGN.md`.

---

## Global Constraints

- **Zero-Direct-Answer Invariant:** CẤM TUYỆT ĐỐI tiết lộ đáp án trực tiếp (ví dụ: "Chọn B", "Đáp án đúng là C", "Hãy chọn phương án A"), kể cả khi học sinh nài nỉ hoặc dùng prompt injection bẫy đáp án.
- **Strict Grounding:** Chỉ giải thích dựa trên nội dung SGK Tin học đã được duyệt (không bịa đặt kiến thức ngoài chương trình).
- **Zero-Crash Offline Resiliency:** Hoạt động 100% trong phòng máy LAN offline (Local Rule-based Socratic Engine) ngay cả khi không có GEMINI_API_KEY hoặc mất kết nối internet.
- **Preserve Curriculum Hash:** Không được phép ghi đè làm biến dạng mã băm của `data/curriculum/tin6/bai1.blocks.json`.
- **Zero-Leak Secret Hygiene:** Không in hoặc lưu mã PIN/Key bí mật ra màn hình stdout hay commit git.

---

## Review Focus (5 Trọng tâm Kiểm duyệt của Sonnet & Auditor)

1. **Rò rỉ đáp án khi có ngữ cảnh (Context Answer Leak):** Khi biết học sinh vừa chọn B sai và câu hỏi là câu 1, AI có vô tình nói "Vậy em hãy chọn A nhé" không? -> Kiểm duyệt bằng Regex Redaction Guardrail và Socratic Filter.
2. **Ảo giác khi học sinh hỏi ngoài SGK (Out-of-domain Hallucination):** Học sinh hỏi về "Python nâng cao" hay "Lập trình AI ChatGPT" trong bài Tin học 6 -> AI phải từ chối lịch sự và kéo học sinh về bài học.
3. **Mất kết nối mạng / Không có API Key (Offline Fallback Precision):** Khi offline, hệ thống phải trả lời đúng ngữ cảnh của từng câu hỏi (Câu 1, 2, 3, 4) chứ không trả lời chung chung.
4. **Hiệu năng và độ trễ (Latency & Non-blocking):** Phản hồi Socrates phải gửi về trong vòng < 1500ms (online) và < 50ms (offline local).
5. **Đo đạc tương thích giao diện (Zero-Overflow & Keyboard Accessibility):** Ngăn kéo Socrates mở mượt mà, đóng bằng nút ✕ hoặc phím `Esc`, không làm vỡ layout ở $1366 \times 768$.

---

## Chi tiết các Nhiệm vụ Triển khai (Bite-Sized Tasks)

### Task 1: Mở rộng Hợp đồng Khế ước `ChatContext` trong `backend/contracts.py`

**Files:**
- Modify: `backend/contracts.py`
- Modify: `backend/server.py`
- Test: `tests/test_socratic_agent_context.py`

**Mô tả:**
Định nghĩa `ChatContext` bọc trong `ChatRequest`:
```python
class ChatContext(BaseModel):
    current_question_id: Optional[str] = None       # Ví dụ: "tin6_b1_q1"
    student_choice: Optional[str] = None            # Ví dụ: "A", "B", "C", "D"
    is_correct: Optional[bool] = None               # False nếu vừa làm sai
    last_action: Optional[str] = None               # "request_hint" | "ask_question" | "general_help"
    active_tab: Optional[str] = "quiz"              # "quiz" | "theory"
```

- [ ] **Step 1:** Viết test `test_chat_request_schema_with_context` trong `tests/test_socratic_agent_context.py` kiểm tra schema hợp lệ và từ chối context sai định dạng.
- [ ] **Step 2:** Chạy pytest xác nhận test fail.
- [ ] **Step 3:** Thêm `ChatContext` vào `backend/contracts.py` và cập nhật `ChatRequest` trong `backend/server.py`.
- [ ] **Step 4:** Chạy lại pytest xác nhận test pass.

---

### Task 2: Nâng cấp Động cơ Sư phạm Socrates Thấu hiểu Ngữ cảnh trong `backend/agent.py`

**Files:**
- Modify: `backend/agent.py`
- Test: `tests/test_socratic_agent_context.py`

**Mô tả:**
1. Hàm `chat_with_tutor()` tiếp nhận `context: Optional[ChatContext] = None`.
2. Nếu có `context.current_question_id`:
   - Trích xuất câu hỏi, các lựa chọn, mục SGK, trang SGK, và gợi ý khi sai từ dữ liệu bài học.
   - Bổ sung chỉ dẫn sư phạm cụ thể vào `system_instruction` cho Gemini Flash 2.5:
     *"Học sinh đang làm câu hỏi: '{cau_hoi}'. Học sinh vừa chọn: '{student_choice}' (Chưa chính xác). Nhiệm vụ: Hãy chỉ ra điểm học sinh có thể đang nhầm lẫn giữa Dữ liệu và Thông tin, dẫn chiếu Mục '{muc_sgk}', đặt 1 câu hỏi gợi mở, TUYỆT ĐỐI KHÔNG NÓI ĐÁP ÁN ĐÚNG."*
3. Nâng cấp `socratic_fallback_reply()` (Chế độ Cục bộ Offline):
   - Xây dựng phản hồi sư phạm chuẩn mực cho cả 4 câu hỏi trong Ngân hàng Trắc nghiệm Bài 1 Tin học 6 khi học sinh yêu cầu gợi ý cho từng câu.
4. Tăng cường `check_and_redact_answer_leak()`:
   - Quét bổ sung các mẫu rò rỉ ngầm (ví dụ: *"đáp án không phải là B mà là..."*, *"em nên chọn phương án..."*).

- [ ] **Step 1:** Viết các test case trong `tests/test_socratic_agent_context.py`:
  - `test_context_aware_hint_for_specific_question`
  - `test_socratic_engine_refuses_leak_with_context`
  - `test_offline_fallback_handles_all_four_questions_with_context`
- [ ] **Step 2:** Chạy pytest xác nhận các test fail.
- [ ] **Step 3:** Viết mã logic trong `backend/agent.py`.
- [ ] **Step 4:** Chạy pytest xác nhận tất cả các test mới pass 100%.

---

### Task 3: Tích hợp Ngữ cảnh Frontend Tự Động trong `frontend/app.js`

**Files:**
- Modify: `frontend/app.js`
- Modify: `frontend/index.html`
- Test: `tests/test_e2e_socratic_context.py`

**Mô tả:**
1. Trong `frontend/app.js`: Khi gửi yêu cầu chat tới `/api/chat`:
   - Tự động đóng gói ngữ cảnh hiện tại:
     ```javascript
     const currentQ = (state.lessonData && state.lessonData.quiz) 
       ? state.lessonData.quiz[state.currentQuestionIndex] 
       : null;
     const qid = currentQ ? currentQ.id : null;
     const studentChoice = state.userSelections[qid] || null;
     const evalInfo = state.evaluatedQuestions[qid] || null;
     
     const payload = {
       grade: state.grade,
       lesson_id: state.lessonId,
       message: userMessage,
       history: state.chatHistory,
       context: {
         current_question_id: qid,
         student_choice: studentChoice,
         is_correct: evalInfo ? evalInfo.is_correct : null,
         active_tab: state.activeTab
       }
     };
     ```
2. Thêm nút kích hoạt nhanh trong hộp phản hồi khi học sinh làm sai:
   - Nút: *"💡 Nhờ Thầy Socrates gợi ý câu này"* -> Tự động mở Socrates Drawer và gửi tin nhắn xin gợi ý kèm ngữ cảnh câu hỏi.
3. Cập nhật các Chips gợi ý câu hỏi nhanh (Prompt Chips) thay đổi động theo câu hỏi hiện tại:
   - *"Tại sao câu này em chọn sai?"*
   - *"Gợi ý giúp em Câu {X}"*
   - *"Ví dụ thực tế cho câu này"*

- [ ] **Step 1:** Viết test Playwright E2E `tests/test_e2e_socratic_context.py`:
  - Mở trang chủ -> Chọn sai Câu 1 -> Bấm nút nhờ Socrates gợi ý -> Drawer mở ra -> Nhận câu trả lời gợi ý đúng bản chất câu 1 không lộ đáp án.
- [ ] **Step 2:** Chạy test Playwright xác nhận fail khi chưa kết nối frontend.
- [ ] **Step 3:** Triển khai logic trong `frontend/app.js` và `frontend/index.html`.
- [ ] **Step 4:** Chạy lại test Playwright xác nhận pass 100% không lỗi Console F12.

---

### Task 4: Kiểm duyệt Toàn diện (Zero-Bug & Alibaba OCR Gatekeeper) và Biên soạn Báo cáo Thẩm định cho Sonnet

**Files:**
- Create: `.kilo/plans/1791967657542-socratic-agent-audit-proof.md`
- Target: `.kilo/plans/1791967657542-socratic-agent-verdict.md` (Do Claude Sonnet xuất bản)

**Mô tả:**
1. Chạy toàn bộ bộ test hồi quy:
   - `python -m pytest tests/ -v` (toàn bộ các test cũ + test mới).
   - Kiểm tra Oxlint: `npx oxlint --ignore-path .gitignore`.
   - Kiểm tra E2E Teacher Studio + E2E Khan-Focus + E2E Socrates Context.
2. Kiểm tra bất biến dữ liệu thật `bai1.blocks.json` không bị rác.
3. Xuất file bằng chứng thực thi nguyên văn `.kilo/plans/1791967657542-socratic-agent-audit-proof.md` với đầy đủ timestamp, tiền tố `tests/<file>.py::<hàm> PASSED`, số lượng byte tệp và hash đối chiếu.
4. Chuẩn bị prompt chuẩn mực để người dùng gửi Sonnet thẩm định độc lập.

- [ ] **Step 1:** Chạy toàn bộ bộ kiểm thử tự động và đo đạc số liệu thật.
- [ ] **Step 2:** Ghi nhận bằng chứng thực tế vào file `.kilo/plans/`.
- [ ] **Step 3:** Báo cáo hoàn tất và bàn giao prompt cho Claude 3.5 Sonnet duyệt.
