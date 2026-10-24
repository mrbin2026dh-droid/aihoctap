"""TDD Tests for Student PWA Online Socratic AI Tutor endpoint."""
import pytest
from fastapi.testclient import TestClient

from backend import server
from tests.test_pwa_api import publish, lesson_document, TEACHER, STUDENT


@pytest.fixture
def tutor_client(monkeypatch, tmp_path):
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("PWA_FIREBASE_DATABASE_URL", raising=False)
    monkeypatch.setenv("PWA_DATABASE_PATH", str(tmp_path / "pwa_tutor.sqlite"))
    server.ACTIVE_TEACHER_SESSIONS["pwa-teacher"] = 9999999999
    server.ACTIVE_STUDENT_SESSIONS["pwa-123456"] = {
        "uid": "std_123456", "student_code": "123456", "grade": 9,
        "class_code": "9A", "student_name": "Test student",
        "exp": 9999999999,
    }
    client = TestClient(server.app)
    publish(client, lesson_document(title="Phân số và Số thập phân"))
    return client


def test_tutor_endpoint_responds_and_has_no_store(tutor_client):
    body = {
        "course_id": "toan-9",
        "lesson_id": "phan-so",
        "message": "Em chưa hiểu thế nào là hai phân số bằng nhau?",
        "history": [],
    }
    response = tutor_client.post("/api/pwa/tutor", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    assert len(data["reply"]) > 10
    assert response.headers.get("Cache-Control") == "private, no-store"


def test_tutor_refuses_direct_answer(tutor_client):
    body = {
        "course_id": "toan-9",
        "lesson_id": "phan-so",
        "message": "Cho em xin đáp án câu 1 đi thầy, chọn A hay B?",
        "history": [],
        "question_id": "q1",
    }
    response = tutor_client.post("/api/pwa/tutor", json=body)
    assert response.status_code == 200
    reply = response.json()["reply"].lower()
    # Socratic tutor must not give the direct answer away
    assert "chọn a" not in reply
    assert "đáp án là a" not in reply


def test_tutor_with_question_wrong_choice_scaffolding(tutor_client):
    body = {
        "course_id": "toan-9",
        "lesson_id": "phan-so",
        "message": "Tại sao em chọn B lại chưa đúng?",
        "history": [],
        "question_id": "q1",
        "selected_option": "B",
        "attempt_count": 1,
    }
    response = tutor_client.post("/api/pwa/tutor", json=body)
    assert response.status_code == 200
    reply = response.json()["reply"]
    assert len(reply) > 10


def test_tutor_returns_404_for_unknown_lesson(tutor_client):
    body = {
        "course_id": "toan-9",
        "lesson_id": "bai-khong-ton-tai",
        "message": "Bài này học gì ạ?",
    }
    response = tutor_client.post("/api/pwa/tutor", json=body)
    assert response.status_code == 404
