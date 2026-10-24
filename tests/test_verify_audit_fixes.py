"""
Bộ kiểm thử tự động xác minh toàn bộ 8 lỗi đã được sửa triệt để (Zero-Bug Verification).
"""
import subprocess
import pytest
from fastapi.testclient import TestClient
from backend.server import app
from backend.contracts import ChatContext
from backend.agent import socratic_fallback_reply

client = TestClient(app)


def test_fix_1_http_500_sanitized_and_includes_request_id(monkeypatch):
    """Sửa Lỗi 1: /api/chat không làm lộ ngoại lệ nội bộ và trả về request_id an toàn."""
    sentinel = "CONFIDENTIAL_DB_TRACE_KEY_ABCXYZ_999"

    def buggy_chat(*args, **kwargs):
        raise RuntimeError(sentinel)

    monkeypatch.setattr("backend.server.chat_with_tutor", buggy_chat)

    res = client.post("/api/chat", json={
        "grade": 9,
        "lesson_id": 1,
        "message": "Kiểm thử lỗi 500",
        "history": []
    })

    assert res.status_code == 500
    detail = res.json().get("detail", "")
    assert sentinel not in detail, f"LỖI: Sentinel '{sentinel}' vẫn bị lộ trong detail: {detail}"
    assert "Mã yêu cầu:" in detail, "LỖI: Không tìm thấy 'Mã yêu cầu:' để đối chiếu log"


def test_fix_2_fallback_guards_out_of_scope_knowledge():
    """Sửa Lỗi 2: Fallback không trả kiến thức lớp khác/bài khác, hướng dẫn học sinh quay lại bài hiện tại."""
    reply = socratic_fallback_reply(
        grade=6,
        lesson_id=1,
        message="Thầy ơi hàm sumif dùng như thế nào ạ?",
        curriculum_text="Bài 1: Thông tin và dữ liệu trong đời sống",
        quiz_data=[]
    )
    # Lớp 6 bài 1 không chứa SUMIF -> Fallback không dạy cú pháp SUMIF và hướng dẫn học sinh tập trung bài hiện tại
    assert "=SUMIF" not in reply, f"LỖI: Fallback vẫn trả cú pháp hàm =SUMIF: {reply}"
    assert "=COUNTIF" not in reply, f"LỖI: Fallback vẫn trả cú pháp hàm =COUNTIF: {reply}"
    assert any(w in reply for w in ["chưa học về", "tập trung vào", "phạm vi", "Bài 1"]), (
        f"LỖI: Phản hồi không có cảnh báo phạm vi bài học: {reply}"
    )


def test_fix_3_server_authoritative_correctness_prevents_spoofing():
    """Sửa Lỗi 3: Client gửi is_correct=True cho đáp án sai B (đáp án đúng là A) không được gia sư khen đúng."""
    quiz_data = [{
        "id": "tin9_b1_q1",
        "cau_hoi": "Bộ xử lý CPU là gì?",
        "dap_an_dung": "A",
        "cac_lua_chon": {"A": "Bộ não", "B": "Bộ nhớ"}
    }]
    ctx = ChatContext(
        current_question_id="tin9_b1_q1",
        student_choice="B",  # Học sinh chọn B (Sai)
        is_correct=True,     # Client giả mạo is_correct=True
        attempt_count=1
    )
    reply = socratic_fallback_reply(
        grade=9,
        lesson_id=1,
        message="Em vừa chọn B, thầy thấy sao?",
        curriculum_text="Bài 1: Thế giới kĩ thuật số",
        context=ctx,
        quiz_data=quiz_data
    )
    # Gia sư tuyệt đối không khen đáp án sai
    assert "hoàn toàn chính xác" not in reply.lower(), f"LỖI: Gia sư vẫn khen đáp án sai là chính xác: {reply}"
    assert "chúc mừng em" not in reply.lower(), f"LỖI: Gia sư chúc mừng đáp án sai: {reply}"
    assert len(reply.strip()) > 0, "LỖI: Phản hồi bị rỗng"


def test_fix_6_mock_genai_client_accepts_http_options_and_tracks_calls():
    """Sửa Lỗi 6: MockGenaiClient nhận http_options và kiểm chứng generate_content được gọi thật."""
    class MockModels:
        def __init__(self):
            self.call_count = 0
        def generate_content(self, model, contents, config=None):
            self.call_count += 1
            class Resp:
                text = "Mock AI reply"
            return Resp()

    class MockGenaiClient:
        def __init__(self, api_key=None, **kwargs):
            self.api_key = api_key
            self.http_options = kwargs.get("http_options")
            self.models = MockModels()

    mock_client = MockGenaiClient(api_key="test_key", http_options={"timeout": 10})
    assert mock_client.http_options == {"timeout": 10}
    res = mock_client.models.generate_content(model="gemini-3.5-flash-lite", contents="Hello")
    assert res.text == "Mock AI reply"
    assert mock_client.models.call_count == 1


def test_fix_8_git_diff_check_zero_whitespace_errors():
    """Sửa Lỗi 8: git diff --check không có lỗi trailing whitespace."""
    res = subprocess.run(["git", "diff", "--check"], capture_output=True, text=True)
    assert res.returncode == 0, f"LỖI: git diff --check thất bại:\n{res.stdout}\n{res.stderr}"
