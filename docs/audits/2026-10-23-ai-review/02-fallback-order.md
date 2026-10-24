# 02 — Sửa LIVE-02/03 ngay tại fallback

Mẫu đề xuất, chưa áp dụng. Vị trí: socratic_fallback_reply sau trusted_context (01), TRƯỚC nhánh từ khóa CPU/SUMIF và lời từ chối cũ.

```python
asks_answer = any(t in msg_lower for t in
    ('đáp án', 'chọn câu nào', 'giải hộ', 'a hay b', 'c hay d'))
asks_hint = asks_answer or any(t in msg_lower for t in
    ('gợi ý', 'câu này', 'ở câu', 'giải thích'))
asks_hint = asks_hint or (
    context.last_action == 'ask_hint_after_wrong_answer')

if current_question and asks_hint:
    guide = QUESTION_SCAFFOLDING.get(qid, {})
    by_choice = guide.get('tier2_by_choice', {})
    hint = guide.get('default')
    if context.is_correct is False and choice in by_choice:
        hint = by_choice[choice]
    if not hint:
        hint = ('Em hãy xác định nhiệm vụ mà câu hỏi yêu cầu, '
                'rồi đối chiếu mục SGK của câu này nhé.')
    prefix = 'Thầy sẽ gợi ý để em tự chọn. ' if asks_answer else ''
    return check_and_redact_answer_leak(
        prefix + hint, quiz_data=quiz_data, current_question_id=qid)
```

Nếu xin đáp án mà không có câu hợp lệ: hỏi học sinh nêu câu đang làm; bỏ mẫu Dữ liệu/Thông tin cố định. Đừng biến mọi câu hỏi khái niệm thành hint chỉ vì qid tồn tại.

Giàn giáo tin9_b1_q1 hiện có default/tier3 nhắc CPU, dễ nói thẳng phương án đúng. Thay bằng gợi mở theo nhiệm vụ, ví dụ:

```python
QUESTION_SCAFFOLDING['tin9_b1_q1']['default'] = (
    'Em hãy phân biệt xử lí, hiển thị và cấp điện. '
    'Nhiệm vụ nào cần thực hiện câu lệnh?')
QUESTION_SCAFFOLDING['tin9_b1_q1']['tier3'] = (
    'Màn hình đưa kết quả ra ngoài. '
    'Bộ phận nào tính toán trước khi có kết quả đó?')
```

Không sửa/xóa dữ liệu đề thi. Các hint khác phải kiểm tra tương tự; regex không bảo đảm chặn mọi cách nói lộ nội dung.

Giữ chặn SUMIF ngoài bài, nhưng không coi một từ xuất hiện trong SGK là bằng chứng đủ để dạy toàn chủ đề. Ưu tiên nội dung/metadata bài đã duyệt. Test cả lớp 9 bài 1 hỏi SUMIF, không chỉ lớp 6.

Fallback không có LLM: không bịa khả năng nhớ hội thoại. Câu tiếp nối chưa rõ thiết bị phải hỏi lại cụ thể. Gemini giữ hội thoại theo 03.
