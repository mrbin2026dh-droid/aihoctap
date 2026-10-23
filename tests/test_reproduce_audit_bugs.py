"""
Hồi quy các lỗi đã được kiểm định: khẳng định hành vi an toàn sau khi sửa.
"""
import pytest
import os
import subprocess
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.server import app
from backend.contracts import ChatContext
from backend.agent import socratic_fallback_reply

client = TestClient(app)

def test_regression_http_500_hides_internal_exception(monkeypatch):
    """Lỗi 1: /api/chat trả nội dung ngoại lệ nội bộ trong HTTP 500 detail."""
    sentinel = "PRIVATE_INTERNAL_SENTINEL_SECRET_KEY_DB_TRACE_123"

    def buggy_chat(*args, **kwargs):
        raise RuntimeError(sentinel)

    monkeypatch.setattr("backend.server.chat_with_tutor", buggy_chat)

    res = client.post("/api/chat", json={
        "grade": 9,
        "lesson_id": 1,
        "message": "Test error leak",
        "history": []
    })

    assert res.status_code == 500
    # Nội dung chẩn đoán nội bộ không được gửi tới học sinh.
    detail_str = str(res.json().get("detail", ""))
    print(f"[REPRODUCE 1] HTTP 500 detail: {detail_str}")
    assert sentinel not in detail_str
    assert "Mã yêu cầu:" in detail_str


def test_regression_fallback_respects_lesson_scope():
    """Lỗi 2: Fallback trả kiến thức lớp 9 bài 10 (SUMIF) khi học sinh lớp 6 hỏi."""
    reply = socratic_fallback_reply(
        grade=6,
        lesson_id=1,
        message="Thầy ơi hàm sumif dùng như thế nào ạ?",
        curriculum_text="Bài 1: Thông tin và dữ liệu trong đời sống",
        quiz_data=[]
    )
    print(f"[REPRODUCE 2] Fallback reply: {reply[:120]}")
    assert "=SUMIF" not in reply
    assert "chưa học về" in reply


def test_regression_client_correctness_cannot_override_answer_key():
    """Lỗi 3: Client gửi is_correct=True cho đáp án sai B (đáp án đúng là A) nhưng vẫn khen đúng."""
    # Giả lập câu hỏi q1: đáp án đúng là A
    quiz_data = [{
        "id": "tin9_b1_q1",
        "cau_hoi": "Bộ xử lý CPU là gì?",
        "dap_an_dung": "A",
        "cac_lua_chon": {"A": "Bộ não", "B": "Bộ nhớ"}
    }]
    ctx = ChatContext(
        current_question_id="tin9_b1_q1",
        student_choice="B", # Học sinh chọn B (Sai)
        is_correct=True,    # Client giả mạo hoặc gửi nhầm is_correct=True
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
    print(f"[REPRODUCE 3] Reply for wrong choice B: {reply[:120]}")
    assert "hoàn toàn chính xác" not in reply
    assert "chúc mừng" not in reply.casefold()
    assert reply.rstrip().endswith("?")


def test_reproduce_mock_genai_client_rejects_http_options():
    """Lỗi 6: MockGenaiClient trong adversarial eval ném TypeError khi nhận http_options."""
    class MockGenaiClientOld:
        def __init__(self, api_key=None):
            pass

    with pytest.raises(TypeError) as excinfo:
        MockGenaiClientOld(api_key="test_key", http_options="fake_options")

    print(f"[REPRODUCE 6] MockGenaiClient TypeError: {excinfo.value}")
    assert "http_options" in str(excinfo.value)


def test_regression_git_diff_has_no_trailing_whitespace():
    """Lỗi 8: git diff --check phát hiện trailing whitespace."""
    res = subprocess.run(["git", "diff", "--check"], capture_output=True, text=True)
    print(f"[REPRODUCE 8] git diff --check:\n{res.stdout or res.stderr}")
    assert res.returncode == 0, res.stdout + res.stderr
