"""Teacher and student exchange real HTTP results without shared browser state."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, student_login
from tests.exam_release_helpers import create_exam, start_exam, answer_all, submit_exam


def test_teacher_receives_student_result_across_isolated_contexts(ui_page, live_server, teacher_pin):
    teacher = ui_page
    exam = create_exam(teacher, live_server, teacher_pin)
    teacher_login(teacher, teacher_pin)
    browser = teacher.context.browser
    context = browser.new_context(base_url=live_server, viewport={"width": 1366, "height": 768})
    context.route("https://**/*", lambda route: route.fulfill(status=200, body="", content_type="application/javascript"))
    context.add_init_script("delete window.BroadcastChannel;")
    try:
        student = context.new_page()
        student.goto(live_server, wait_until="domcontentloaded")
        student_login(student)
        student_token = student.evaluate("studentAuthState.token")
        denied = context.request.get(live_server + f"/api/teacher/exams/{exam['exam_id']}/results",
                                     headers={"Authorization": "Bearer " + student_token})
        assert denied.status == 401
        start_exam(student)
        answer_all(student)
        submit_exam(student)
        expect(student.locator("#resultScoreNum")).to_have_text("10.0")
        teacher.locator("#btnNavExamHub").click()
        teacher.locator("#examTeacherGrid .exam-card-item").filter(has_text=exam["title"]).locator(".btn-exam-sm-results").click()
        expect(teacher.locator("#teacherResultsTableBody tr")).to_have_count(1)
        expect(teacher.locator("#teacherResultsTableBody")).to_contain_text("123456")
        expect(teacher.locator("#teacherResultsTableBody")).to_contain_text("10")
        assert teacher.evaluate("state.teacherUnlocked") is True
        assert student.evaluate("state.teacherUnlocked") is False
    finally:
        context.close()
