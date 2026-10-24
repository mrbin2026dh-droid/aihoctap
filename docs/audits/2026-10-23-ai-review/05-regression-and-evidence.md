# 05 — Các test còn thiếu và điều kiện đóng lỗi

Không đổi test chỉ để né FAIL. Chuyển test_reproduce_audit_bugs.py từ khẳng định lỗ hổng đang tồn tại sang khẳng định hành vi an toàn; lưu bằng chứng lỗi cũ trong hồ sơ. Test mock trong test_verify_audit_fixes.py hiện chỉ tự gọi mock, không chứng minh ứng dụng dùng mock. Adversarial đã cải thiện call_count: giữ lại.

Mẫu regression cho ca chưa sửa (dùng imports hiện có):

```python
@pytest.mark.parametrize('qid,choice', [
    ('missing_qid', 'B'), ('tin9_b1_q1', None)])
def test_no_client_correctness_when_unverified(qid, choice):
    quiz = [{
        'id': 'tin9_b1_q1', 'cau_hoi': 'Vai trò xử lí?',
        'lua_chon': {'A': 'CPU', 'B': 'Màn hình'},
        'dap_an_dung': 'A'}]
    ctx = ChatContext(current_question_id=qid,
                      student_choice=choice, is_correct=True)
    reply = socratic_fallback_reply(
        9, 1, 'Thầy nhận xét giúp em', 'Nội dung CPU',
        context=ctx, quiz_data=quiz)
    assert 'chúc mừng' not in reply.lower()
    assert 'hoàn toàn chính xác' not in reply.lower()
```

Thêm: CPU sai màn hình -> gợi ý nói đúng hạn chế màn hình; xin đáp án CPU -> không có Dữ liệu/Thông tin; lớp 9 bài 1 SUMIF -> không có cú pháp SUMIF; mock Gemini prompt không tin true khi thiếu choice; capture câu hỏi thực.

Transport: dashboard/theory/quiz + payload đúng; 422/429/500; reply rỗng; Gemini timeout/fallback; source log khớp request_id. Tách mock và live.

Cancellation: test đổi bài hiện có chỉ kiểm in-flight; chưa bao phủ watchdog 30s, đổi view, giai đoạn typewriter, lỗi cũ quay lại sau lượt mới. switchView hiện chưa tăng chatTurnId; các timer typewriter/watchdog chưa có cleanup chung. Test clock/timer quyết định, assert DOM lẫn history; bổ sung invalidation/cleanup cho mọi pha khi test chứng minh lỗi.

F12: không tái sử dụng cổng 8000 chỉ vì có socket mở. Khởi động server fixture cổng riêng với dữ liệu tạm, không gọi Firebase production, teardown sạch. Không lưu headers/token vào artifact.

Report: helper _is_concept_in_scope được nhắc nhưng chưa có trong mã. Thiếu file log gốc làm hạn chế đối chiếu b67c69a3; một dòng trích trong báo cáo chưa đủ để xác minh độc lập.

Nghiệm thu: bộ regression xanh, các ca LIVE-01..03 chạy lại, có log source/request_id/revision; gate thiếu ghi BLOCKED. Không commit/push/deploy trước kiểm định độc lập.
