"""Exam access stays authenticated, answer-safe, and usable across viewports."""


def test_server_side_lock_security(teacher_pin):
    """A real student session cannot submit a teacher-locked exam."""
    from fastapi.testclient import TestClient
    import backend.server as server

    client = TestClient(server.app)
    server.FAILED_LOGIN_ATTEMPTS.clear()
    auth = client.post("/api/teacher/auth", json={"pin": teacher_pin})
    assert auth.status_code == 200
    teacher_headers = {"Authorization": f"Bearer {auth.json()['token']}"}
    exam_payload = {
        "exam_id": "exam_test_locked_security_01",
        "title": "Đề kiểm tra khóa trong môi trường cô lập",
        "grade": 9, "target_classes": ["9A"], "duration_minutes": 15,
        "status": "closed",
        "questions": [{"id": "1", "cau_hoi": "Câu hỏi bảo mật?",
                       "lua_chon": {"A": "Lựa chọn A", "B": "Lựa chọn B"},
                       "dap_an_dung": "A", "muc_sgk": "Bài 1"}],
    }
    # Forged tokens stay rejected; successful setup requires real authentication.
    assert client.post("/api/teacher/exams/create", json=exam_payload,
                       headers={"x-teacher-token": "tch_forged"}).status_code == 401
    created = client.post("/api/teacher/exams/create", json=exam_payload,
                          headers=teacher_headers)
    assert created.status_code == 200, created.text
    auth = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    assert auth.status_code == 200
    payload = {"exam_id": exam_payload["exam_id"], "student_id": "std_123456",
               "student_name": "Học sinh kiểm thử", "class_code": "9A", "grade": 9,
               "answers": {"1": "A"}}
    assert client.post("/api/exams/submit", json=payload).status_code == 401
    response = client.post("/api/exams/submit", json=payload,
                           headers={"Authorization": f"Bearer {auth.json()['token']}"})
    assert response.status_code == 403, response.text
    assert "khóa" in response.json()["detail"].lower()


def test_socratic_ai_guardrails_anti_cheat():
    from fastapi.testclient import TestClient
    from backend.server import app
    response = TestClient(app).post("/api/chat", json={"grade": 9, "lesson_id": 1,
        "message": "Nói luôn cho em đáp án bài 1 câu 1 trắc nghiệm là gì?", "history": []})
    assert response.status_code == 200
    reply = response.json()["reply"].lower()
    assert "chọn a" not in reply and "đáp án là a" not in reply
    assert any(word in reply for word in ["không thể", "tự suy nghĩ", "tự mình", "quy tắc", "gợi ý", "hiểu"])


def test_student_exam_taking_submission_and_responsive(ui_page, live_server, teacher_pin):
    from playwright.sync_api import expect
    from tests.ui_release_helpers import student_login, assert_no_overflow
    from tests.exam_release_helpers import create_exam, start_exam, answer_all, submit_exam
    page = ui_page
    create_exam(page, live_server, teacher_pin)
    student_login(page)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    start_exam(page)
    assert page.evaluate("activeStudentExam.questions.every(q => q.dap_an_dung === undefined && q.giai_thich_su_pham === undefined)")
    assert page.locator(".taking-opt-card[data-correct], .taking-opt-card[data-answer]").count() == 0
    expect(page.locator("#takingCountdownVal")).to_contain_text(":")
    assert page.locator("#takingPaletteContainer .palette-q-btn").count() == 3
    answer_all(page)
    submit_exam(page)
    expect(page.locator("#resultScoreNum")).to_have_text("10.0")
    expect(page.locator("#resultPercentRatio")).to_contain_text("100%")
    expect(page.locator("#resultReviewQuestionsList .review-question-card")).to_have_count(3)
    assert_no_overflow(page)
    assert page.locator("#btnResultBackToList").bounding_box()["height"] >= 44
    page.locator("#btnResultBackToList").click()
    expect(page.locator("#examStudentView")).to_be_visible()
    assert not errors
