"""Create, edit and publish an actual exam with the teacher controls."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, student_login, assert_no_overflow
from tests.exam_release_helpers import answer_all, submit_exam, open_hub


def test_playwright_real_exam_crud_and_student_flow(ui_page, live_server, teacher_pin):
    page = ui_page
    teacher_login(page, teacher_pin)
    page.locator("#btnNavExamHub").click()
    page.locator("#btnExamCreateManual").click()
    page.locator("#examFormTitle").fill("Khảo sát Tin học 9 E2E")
    page.select_option("#examFormGrade", "9")
    page.select_option("#examFormClass", "9A")
    page.locator("#btnModalAddQuestion").click()
    page.locator("#qEditorContent").fill("Thiết bị nào có bộ xử lí?")
    for letter, text in zip("ABCD", ["Máy tính", "Thước kẻ", "Bút chì", "Quyển vở"]):
        page.locator("#qEditorOpt" + letter).fill(text)
    page.select_option("#qEditorCorrect", "A")
    page.locator("#qEditorTopic").fill("Bài 1: Thiết bị có gắn bộ xử lí")
    page.locator("#qEditorExpl").fill("Máy tính có bộ xử lí.")
    page.locator("#btnSaveQToExam").click()
    expect(page.locator("#modalQuestionsList .preview-q-card")).to_have_count(1)
    page.locator("#modalQuestionsList .btn-exam-sm-edit").click()
    expect(page.locator("#qEditorContent")).to_have_value("Thiết bị nào có bộ xử lí?")
    page.locator("#btnCancelEditQ").click()
    page.locator("#btnExamSaveAndPublish").click()
    expect(page.locator("#examTeacherGrid")).to_contain_text("Khảo sát Tin học 9 E2E")
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    student = page
    student_login(student)
    student.set_viewport_size({"width": 375, "height": 667})
    open_hub(student)
    student.locator("#examStudentGrid .btn-exam-primary").first.click()
    expect(student.locator("#takingQSectionBadge")).to_be_visible()
    expect(student.locator("#takingOptionsContainer .taking-opt-card")).to_have_count(4)
    answer_all(student)
    submit_exam(student)
    expect(student.locator("#resultReviewQuestionsList .review-question-card")).to_have_count(1)
    assert_no_overflow(student)
