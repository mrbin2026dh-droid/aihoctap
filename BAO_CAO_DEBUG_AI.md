# BÁO CÁO DEBUG TÍNH NĂNG GIA SƯ AI (GEMINI LIVE VS SOCRATIC FALLBACK)

**Dự án**: `C:\Users\HPZBook\Desktop\AI AGENT SGK`  
**Thời gian thực hiện**: 23/10/2026  
**Mục tiêu**: Xác định bằng chứng thực nghiệm việc Gemini có thực sự tiếp nhận và trả lời câu hỏi hay hệ thống đang âm thầm sử dụng `socratic_fallback_reply`.

---

## 1. TỔNG QUAN & NGUYÊN NHÂN CỐT LÕI (ROOT CAUSE ANALYSIS)

### 1.1. Hiện trạng trước khi debug
- **Âm thầm nuốt lỗi (Silent Exception Swallowing)**: Trong hàm `chat_with_tutor` (`backend/agent.py`), khối lệnh gọi Google GenAI được bọc trong `try ... except Exception:`, khi có bất kỳ ngoại lệ nào xảy ra, hệ thống tự động trả về `socratic_fallback_reply(...)` mà không có bất kỳ dòng log nào ghi lại lỗi, mã lỗi hay nguồn sinh phản hồi.
- **Không phân biệt được nguồn phản hồi**: Cả luồng Gemini thật và luồng Socrates Fallback cục bộ đều trả về một chuỗi văn bản thuần túy (`str`). Phía frontend và backend hoàn toàn không có metadata chẩn đoán (`source`, `latency_ms`, `error_code`, `request_id`).
- **Lỗ hổng xử lý phản hồi rỗng**: Khi Gemini trả về `response.text` rỗng (`""` hoặc chỉ có khoảng trắng), hệ thống trước đây không coi đó là lỗi mà tiếp tục chạy qua bộ lọc và trả về chuỗi rỗng cho học sinh, không kích hoạt fallback.
- **Lỗi nghẽn tầng hợp đồng dữ liệu (Pydantic Contract 422)**: Khi học sinh mở Gia sư AI từ giao diện Dashboard, frontend gửi `active_tab: "dashboard"`. Trong khi đó, `ChatContext` trong `backend/contracts.py` chỉ chấp nhận `Literal["quiz", "theory"]`. Điều này khiến endpoint `/api/chat` trả về HTTP 422 Unprocessable Content, làm giao diện hiển thị thông báo lỗi mạng giả lập khiến người dùng lầm tưởng AI bị sập kết nối.

---

## 2. BẰNG CHỨNG TRƯỚC VÀ SAU KHI XỬ LÝ (BEFORE / AFTER EVIDENCE)

### 2.1. Kiểm tra cấu hình và môi trường thực tế
- **API Key**: **CÓ** (Đã nạp `GEMINI_API_KEY` từ `.env`, độ dài 39 ký tự, không rỗng, không phải key mẫu `YOUR_...`). *Tuyệt đối tuân thủ không in key ra log hoặc báo cáo*.
- **Model thực tế đang sử dụng**: `gemini-3.5-flash-lite` (nạp từ biến môi trường `GEMINI_MODEL`, fallback chuẩn `gemini-3.5-flash-lite`).
- **Phiên bản google-genai đang cài**: `google-genai == 2.23.0`.
- **Lệnh gọi Gemini thực tế**: **THÀNH CÔNG** (Kết nối trực tiếp tới máy chủ Google GenAI API thành công 100%, trả về phản hồi sư phạm Socrates đạt chuẩn).

### 2.2. So sánh mã nguồn trước và sau

#### Trước khi sửa (`backend/agent.py`):
```python
# CŨ: Không có log, không phân loại lỗi, nuốt exception, không bắt lỗi rỗng
if GEMINI_API_KEY and GEMINI_API_KEY.strip() and not GEMINI_API_KEY.startswith("YOUR_"):
    try:
        # ...
        response = client.models.generate_content(...)
        raw_text = response.text or ""
        return check_and_redact_answer_leak(raw_text, quiz_data=quiz_data, current_question_id=qid)
    except Exception:
        return socratic_fallback_reply(...)
return socratic_fallback_reply(...)
```

#### Sau khi sửa (`backend/agent.py`):
```python
# MỚI: Bổ sung log chẩn đoán chuẩn hóa, bắt lỗi rỗng, phân loại 7 nhóm lỗi
def classify_gemini_error(err: Exception) -> str:
    err_str = str(err).lower()
    err_cls = err.__class__.__name__
    if "empty_response" in err_str:
        return "EMPTY_RESPONSE"
    if "not found" in err_str or "not_found" in err_str or "invalid model" in err_str:
        return "INVALID_MODEL"
    if "api_key_invalid" in err_str or "permission_denied" in err_str or "401" in err_str or "403" in err_str:
        return "AUTHENTICATION_ERROR"
    if "resource_exhausted" in err_str or "quota" in err_str or "429" in err_str:
        return "QUOTA_EXCEEDED"
    if "timeout" in err_str or "timed out" in err_str or "deadline_exceeded" in err_str:
        return "TIMEOUT"
    return f"OTHER_ERROR:{err_cls}"

# Trong chat_with_tutor:
raw_text = (response.text or "").strip()
if not raw_text:
    raise ValueError("EMPTY_RESPONSE: Gemini returned empty or whitespace-only content")

log_msg = (
    f"[TUTOR_DIAGNOSTIC] request_id={req_id} grade={grade} lesson_id={lesson_id} "
    f"sgk_len={sgk_len} model={actual_model} latency_ms={latency_ms} "
    f"source=gemini error_code=NONE"
)
print(log_msg)
logger.info(log_msg)
```

---

## 3. DANH SÁCH TỆP ĐÃ SỬA ĐỔI

1. `backend/agent.py`:
   - Bổ sung hàm `classify_gemini_error` và `sanitize_error_detail` (loại bỏ key/token nhạy cảm khỏi log).
   - Thêm bộ đo độ trễ `latency_ms` và sinh/nhận `request_id`.
   - Bắt buộc kiểm tra `not raw_text`: nếu Gemini trả nội dung rỗng thì ném `ValueError("EMPTY_RESPONSE...")` để chuyển sang fallback, không chấp nhận câu trả lời rỗng.
   - Thêm định dạng log chẩn đoán chuẩn hóa: `[TUTOR_DIAGNOSTIC] request_id=... grade=... lesson_id=... sgk_len=... model=... latency_ms=... source=... error_code=...`.
   - Giữ nguyên toàn bộ các thay đổi chưa commit trước đó.

2. `backend/server.py`:
   - Sinh `request_id = str(uuid.uuid4())[:8]` cho mỗi lượt gọi `/api/chat`.
   - Truyền `request_id` vào `chat_with_tutor`.
   - Bổ sung `request_id` vào payload phản hồi của endpoint `/api/chat` để phục vụ đối chiếu Network F12.
   - Tuyệt đối không trả chi tiết lỗi nội bộ hay stack trace ra giao diện học sinh.

3. `backend/contracts.py`:
   - Cập nhật trường `active_tab` trong `ChatContext` mở rộng nhận `Literal["quiz", "theory", "dashboard", "exam"]`.
   - Thêm validator `normalize_active_tab` tự động chuẩn hóa về `"quiz"` nếu gặp giá trị lạ, triệt tiêu hoàn toàn lỗi HTTP 422 khi học sinh mở chat từ Dashboard.

4. `tests/test_browser_f12_chat.py`:
   - Kịch bản kiểm thử tự động Playwright headless mô phỏng F12 Network, kiểm tra payload, HTTP status, DOM bubble và trạng thái ô nhập liệu.

---

## 4. KẾT QUẢ KIỂM THỬ 6 CA LOCAL (MỤC 4)

| STT | Tên ca kiểm thử | Loại kiểm thử | Nguồn phản hồi (`source`) | Mã lỗi (`error_code`) | Thời gian xử lý | Kết quả & Bằng chứng sư phạm |
|---|---|---|---|---|---|---|
| **Ca 1** | Câu hỏi đúng nội dung bài (Hỏi về vai trò CPU) | **Gọi Gemini Thật** (Live) | `gemini` | `NONE` | 7,269.49 ms | **PASS**: Gemini giải thích CPU như bộ não điều khiển thiết bị, dùng phương pháp gợi mở Socrates, bám sát SGK Tin 9 Bài 1. |
| **Ca 2** | Câu hỏi tiếp nối cần nhớ ngữ cảnh trước ("Bộ vi xử lý đó có tự quyết định được không?") | **Gọi Gemini Thật** (Live) | `gemini` | `NONE` | 11,038.17 ms | **PASS**: Gemini ghi nhớ đại từ thay thế ("bộ vi xử lý đó" = CPU ở lượt trước), tiếp tục mạch hội thoại sư phạm. |
| **Ca 3** | Yêu cầu cung cấp đáp án trực tiếp ("Cho em đáp án A, B, C hay D câu 1") | **Gọi Gemini Thật** (Live) | `gemini` | `NONE` | 7,561.87 ms | **PASS**: Vành đai chặn rò rỉ hoạt động hoàn hảo; Gemini từ chối tiết lộ chữ cái đáp án, chuyển sang câu hỏi gợi ý tư duy. |
| **Ca 4** | Câu hỏi ngoài bài học ("Hướng dẫn nấu món bún chả") | **Gọi Gemini Thật** (Live) | `gemini` | `NONE` | 23,537.89 ms | **PASS**: Kích hoạt nguyên tắc Strict Grounding: từ chối lịch sự và nhắc học sinh quay lại nội dung bài học Tin học 9. |
| **Ca 5A** | Lỗi thiếu API Key (`GEMINI_API_KEY = None`) | **Kịch bản Fallback** | `local_fallback` | `MISSING_CONFIG` | 0.01 ms | **PASS**: Tự động chuyển sang động cơ Socrates cục bộ ngay lập tức, trả lời an toàn, không báo lỗi ra ngoài. |
| **Ca 5B** | Lỗi model không tồn tại (`invalid-model-name-for-testing`) | **Gọi Gemini Thật** (Lỗi mạng) | `local_fallback` | `INVALID_MODEL` | 1,430.19 ms | **PASS**: Bắt được `ClientError 404`, phân loại chính xác `INVALID_MODEL`, tự động fallback sang Socrates cục bộ. |
| **Ca 6** | Gemini trả nội dung rỗng (`response.text = '   '`) | **Kiểm thử Mock** | `local_fallback` | `EMPTY_RESPONSE` | 0.37 ms | **PASS**: Nhận diện chuỗi rỗng là lỗi, không coi là thành công, tự động kích hoạt fallback Socrates có nội dung đầy đủ. |

---

## 5. KẾT QUẢ KIỂM THỬ TRÊN TRÌNH DUYỆT THẬT (F12 NETWORK - MỤC 5)

Kiểm thử được thực hiện bằng trình duyệt tự động Playwright (Chromium) tương tác trực tiếp trên máy chủ Web `http://127.0.0.1:8000`.

### 5.1. Dữ liệu gói tin F12 Network
- **URL**: `POST http://127.0.0.1:8000/api/chat`
- **Request Payload**:
  ```json
  {
    "grade": 9,
    "lesson_id": 1,
    "message": "Thầy ơi cho em hỏi CPU có vai trò gì trong máy tính ạ?",
    "context": {
      "current_question_id": "tin9_b1_q1",
      "student_choice": null,
      "is_correct": null,
      "active_tab": "dashboard",
      "last_action": "viewing_question",
      "attempt_count": 1
    },
    "history": []
  }
  ```
- **HTTP Status**: `200 OK`
- **Response Body**:
  ```json
  {
    "success": true,
    "reply": "Chào em! Câu hỏi của em rất hay và chạm ngay vào cốt lõi của bài học hôm nay đấy. \n\nĐể hiểu về vai trò của **CPU (bộ xử lí thông tin)**, em hãy thử nghĩ đến cơ thể con người chúng ta nhé. Theo em, bộ phận nào trên cơ thể đóng vai trò suy nghĩ, ra lệnh cho tay chân hoạt động và xử lí mọi thông tin từ mắt, tai?... \n\nChính xác, đó là **bộ não** của chúng ta phải không nào? \n\nTrong một thiết bị kĩ thuật số (như máy tính hay điện thoại), CPU chính là **\"bộ não\"** đó em ạ. Dựa vào kiến thức trong bài học, theo em CPU làm nhiệm vụ gì để giúp chiếc máy tính hay các thiết bị thông minh có thể hoạt động được? Em thử suy nghĩ và chia sẻ cho Thầy/Cô biết nhé!",
    "request_id": "5cec6041"
  }
  ```

### 5.2. Đối chiếu nhật ký Backend (Backend Log Corroboration)
Dòng log backend tương ứng với cùng lượt gọi:
```text
[TUTOR_DIAGNOSTIC] request_id=5cec6041 grade=9 lesson_id=1 sgk_len=1495 model=gemini-3.5-flash-lite latency_ms=6330.45 source=gemini error_code=NONE
INFO: 127.0.0.1:65008 - "POST /api/chat HTTP/1.1" 200 OK
```

### 5.3. Xác minh giao diện người dùng (UI Verification)
1. **Khóa chống gửi đúp (Mutex Lock)**: Ô nhập `#chatInput` và nút gửi `#btnSendChat` chuyển sang trạng thái `disabled = true` ngay khi bấm gửi câu hỏi.
2. **Hiệu ứng đánh máy (Typewriter Effect)**: Nội dung phản hồi của Gemini hiển thị mượt mà từng từ trong bong bóng chat `.chat-bubble.assistant`.
3. **Mở lại ô nhập liệu (Unlock)**: Sau khi hoàn thành gõ chữ, ô nhập `#chatInput` tự động mở lại (`disabled = false`), nút bấm gửi sẵn sàng và con trỏ tự động focus để học sinh nhập câu hỏi tiếp theo.

---

## 6. PHÂN BIỆT RÕ RÀNG GIỮA TEST MOCK VÀ KẾT NỐI GEMINI THẬT (MỤC 6)

1. **Chứng minh Kết nối AI Thật (Real Gemini Live Verified)**:
   - Các ca kiểm thử Ca 1, Ca 2, Ca 3, Ca 4 và kiểm thử Trình duyệt F12 **100% sử dụng kết nối Gemini Live thật** với API Key thực tế và model `gemini-3.5-flash-lite`.
   - Minh chứng định lượng: Thời gian xử lý dao động từ $6.3\text{s}$ đến $23.5\text{s}$ (đặc trưng của việc gửi prompt qua internet đến hạ tầng Google GenAI và sinh suy luận), nội dung câu trả lời được sinh ngữ động, khác biệt hoàn toàn với các mẫu câu hardcoded trong `socratic_fallback_reply`.
   - Nhật ký backend ghi nhận rõ: `source=gemini error_code=NONE`.

2. **Các ca sử dụng Test Mock / Giả lập**:
   - **Ca 5A**: Tạm thời cô lập biến môi trường `GEMINI_API_KEY` về `None` để kiểm chứng luồng ngắt khi thiếu key -> Xác nhận fallback kích hoạt đúng, ghi log `source=local_fallback error_code=MISSING_CONFIG`.
   - **Ca 6**: Sử dụng `unittest.mock.MagicMock` giả lập trường hợp hiếm gặp khi API trả về chuỗi rỗng (`response.text = '   '`) -> Xác nhận hệ thống chặn đứng lỗi rỗng và tự động kích hoạt fallback có nghĩa.

3. **Phần còn chưa xác minh (Pending Verification)**:
   - Chưa kiểm thử trường hợp mạng bị đứt giữa chừng đúng vào thời điểm Google GenAI đang truyền luồng dữ liệu (socket reset đột ngột).
   - Chưa đo đạc hạn ngạch tài khoản Google Cloud khi có đồng thời trên 50 học sinh cùng chat trong 1 giây (Rate Limit Concurrency).

---

## 7. KẾT LUẬN & CAM KẾT VẬN HÀNH

- **Kết luận**: Tính năng Gia sư AI **thực sự hoạt động với Gemini Live** khi có cấu hình API Key hợp lệ và không bị rơi vào `socratic_fallback_reply` trong điều kiện hoạt động bình thường.
- Đã vá triệt để lỗi 422 contract của `active_tab`, đảm bảo Gia sư AI hoạt động ổn định trên cả tab Lý thuyết, Trắc nghiệm và Dashboard.
- **Cam kết tuân thủ**: Toàn bộ các thay đổi được giữ nguyên trong working tree, không tự ý commit, push, merge hoặc deploy.
