# 01 — Nguồn lựa chọn và kết quả phải nhất quán

Mẫu đề xuất, chưa áp dụng. frontend/app.js: hai chỗ đang đọc state.answers (nút giải thích và sendChatMessage) phải đọc nguồn quiz thật:

```javascript
const choice = state.userSelections?.[qid] ?? null;
// Trong sendChatMessage, dùng tên biến studentChoice tương ứng.
```

Chỉ gắn qid khi active_tab=quiz hoặc yêu cầu gợi ý có ngữ cảnh quiz tường minh. Dashboard/theory không mang câu cũ; giữ đúng active_tab, không ép quiz để che lỗi contract.

backend/agent.py: thêm helper dùng chung cho fallback và Gemini; import ChatContext và các typing hiện có. Thay toàn bộ nhánh quay lại client_is_correct/client_eval.

```python
from backend.contracts import ChatContext

def trusted_context(context, quiz_data):
    ctx = context.model_copy(deep=True) if context else ChatContext()
    ctx.is_correct = None
    question = next(
        (q for q in (quiz_data or [])
         if q.get('id') == ctx.current_question_id), None)
    if ctx.active_tab != 'quiz' or question is None:
        ctx.current_question_id = None
        ctx.student_choice = None
        return ctx, None
    choices = question.get('lua_chon', {})
    correct = str(question.get('dap_an_dung') or '').strip().upper()
    choice = ctx.student_choice
    if choice not in choices:
        ctx.student_choice = None
    elif correct in choices:
        ctx.is_correct = choice == correct
    return ctx, question
```

Tích hợp sau khi nạp quiz_data, trước mọi nhánh/prompt trong CẢ hai hàm:

```python
context, current_question = trusted_context(context, quiz_data)
qid = context.current_question_id
choice = context.student_choice
authoritative_is_correct = context.is_correct
```

Không dùng client_eval khi is_correct=None. Không có qid/choice hợp lệ thì trạng thái phải là chưa xác minh. Không gửi correct hoặc cả ngân hàng đáp án sang frontend.

Test: sai+true không khen; đúng+false vẫn thẩm định đúng; thiếu choice+true, qid lạ+true, quiz rỗng+true đều không khen. Assert payload UI chọn B thực sự gửi B. Dùng khóa lua_chon đúng schema; test mới hiện dùng cac_lua_chon sai.
