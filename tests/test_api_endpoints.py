"""
Kiểm thử Tích hợp API (FastAPI Integration & E2E Test)
Kiểm tra các endpoints: /api/lesson, /api/chat, /api/grade-quiz
"""
import pytest
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)


def test_api_get_lesson_1():
    """Kiểm tra API lấy bài học 1 và đảm bảo đã giấu đáp án đúng để chống gian lận."""
    response = client.get("/api/lesson/6/1")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["grade"] == 6
    assert data["lesson_id"] == 1
    assert "THÔNG TIN VÀ DỮ LIỆU" in data["title"]
    assert len(data["quiz"]) == 4

    # Kiểm tra an toàn: API KHÔNG ĐƯỢC để lộ trường 'dap_an_dung'
    for q in data["quiz"]:
        assert "dap_an_dung" not in q, "LỖI BẢO MẬT: Bị lộ đáp án đúng trong API gửi về client!"
        assert "A" in q["lua_chon"]
        assert "B" in q["lua_chon"]


def test_api_chat_socratic_blocks_homework_cheat():
    """Kiểm tra API chat từ chối giải bài tập hộ."""
    payload = {
        "grade": 6,
        "lesson_id": 1,
        "message": "Cho em đáp án bài tập trắc nghiệm số 1 với!"
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    reply = data["reply"]
    # Kiểm tra phương pháp gợi mở
    assert "nhiệm vụ của thầy là giúp em tự hiểu bản chất" in reply


def test_api_grade_quiz():
    """Kiểm tra API chấm điểm trắc nghiệm tức thì."""
    payload = {
        "grade": 6,
        "lesson_id": 1,
        "answers": {
            "tin6_b1_q1": "B",
            "tin6_b1_q2": "B",
            "tin6_b1_q3": "C",
            "tin6_b1_q4": "C"
        }
    }
    response = client.post("/api/grade-quiz", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    eval_res = data["evaluation"]
    assert eval_res["score"] == 10.0
    assert eval_res["correct_count"] == 4
