"""Authenticated teacher-to-mobile-student exam pipeline."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, student_login, assert_no_overflow
from tests.exam_release_helpers import create_exam, start_exam, answer_all, submit_exam


def test_full_exam_pipeline(ui_page, live_server, teacher_pin):
    page = ui_page
    exam = create_exam(page, live_server, teacher_pin)
    teacher_login(page, teacher_pin)
    page.locator("#btnNavExamHub").click()
    expect(page.locator("#examTeacherGrid")).to_contain_text(exam["title"])
    # Clear both browser stores before a real student login.
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    student = page
    student_login(student)
    student.set_viewport_size({"width": 375, "height": 667})
    start_exam(student)
    assert student.locator(".taking-opt-card").first.bounding_box()["height"] >= 44
    expect(student.locator("#takingCountdownVal")).to_contain_text(":")
    answer_all(student)
    submit_exam(student)
    expect(student.locator("#resultScoreNum")).to_have_text("10.0")
    assert len(student.locator("#resultAIFeedbackText").inner_text()) > 30
    assert_no_overflow(student)
