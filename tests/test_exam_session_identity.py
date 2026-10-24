"""Submission identity is derived entirely from the authenticated session."""
from fastapi.testclient import TestClient
import backend.server as server
from backend.exam_service import ExamModel, create_or_update_exam


def test_submission_replaces_claimed_student_code(teacher_pin):
    client = TestClient(server.app)
    create_or_update_exam(ExamModel(exam_id="exam_identity", title="Identity", grade=9,
        target_classes=["9A"], questions=[{"id":"1", "cau_hoi":"Question?",
        "lua_chon":{"A":"One", "B":"Two"}, "dap_an_dung":"A"}]))
    login = client.post("/api/student/lan-login", json={"student_code":"123456", "grade":9})
    assert login.status_code == 200
    response = client.post("/api/exams/submit", headers={"Authorization":"Bearer " + login.json()["token"]},
        json={"exam_id":"exam_identity", "student_id":"std_forged", "student_name":"Forged",
              "student_code":"112233", "class_code":"9B", "grade":6, "answers":{"1":"A"}})
    assert response.status_code == 200, response.text
    auth = client.post("/api/teacher/auth", json={"pin":teacher_pin})
    result = client.get("/api/teacher/exams/exam_identity/results",
                        headers={"Authorization":"Bearer " + auth.json()["token"]})
    assert result.status_code == 200
    submission = result.json()["submissions"][0]
    assert submission["student_id"] == "std_123456"
    assert submission["student_code"] == "123456"
    assert submission["student_name"] != "Forged"
    assert submission["class_code"] == "9A"
    assert submission["grade"] == 9


def test_submission_requires_trusted_class_and_grade(monkeypatch):
    client = TestClient(server.app)
    for session in [
        {"uid": "firebase_verified", "student_name": "Verified", "grade": 9},
        {"uid": "firebase_verified", "student_name": "Verified", "class_code": "9A"},
    ]:
        monkeypatch.setattr(server, "verify_student_session", lambda *args, _session=session: _session)
        response = client.post("/api/exams/submit", json={"exam_id":"exam_identity",
            "student_id":"firebase_verified", "student_name":"Claimed", "student_code":"112233",
            "class_code":"9A", "grade":9, "answers":{"1":"A"}})
        assert response.status_code == 403, response.text
        assert "lớp" in response.json()["detail"].lower()
