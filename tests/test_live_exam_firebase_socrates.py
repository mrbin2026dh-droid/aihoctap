"""Local exam results and pedagogy work when cloud services are unavailable."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, teacher_login
from tests.exam_release_helpers import create_exam, start_exam, answer_all, submit_exam


def test_live_exam_socrates_firebase(ui_page, live_server, teacher_pin):
    page = ui_page
    exam = create_exam(page, live_server, teacher_pin)
    create_exam(page, live_server, teacher_pin, exam_id="exam_grade6", grade=6)
    assert page.evaluate("escapeHtml(0)") == "0"
    exams9 = page.evaluate("getTeacherExamsForGrade(9)")
    exams6 = page.evaluate("getTeacherExamsForGrade(6)")
    assert [e["exam_id"] for e in exams9] == [exam["exam_id"]]
    assert [e["exam_id"] for e in exams6] == ["exam_grade6"]
    student_login(page)
    start_exam(page)
    answer_all(page, option=1)
    submit_exam(page)
    expect(page.locator("#resultScoreNum")).to_have_text("0.0")
    expect(page.locator("#examSuccessAlert")).to_contain_text("Đã nộp bài thành công")
    assert len(page.locator("#resultAIFeedbackText").inner_text()) > 30
    expect(page.locator("#resultRecommendList .recommendation-item").first).to_be_visible()
    assert "Em đã làm rất tốt, không có chủ đề nào cần phải ôn lại gấp" not in page.locator("#resultRecommendList").inner_html()
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    teacher_login(page, teacher_pin)
    page.locator("#btnNavExamHub").click()
    page.locator("#examTeacherGrid .exam-card-item").filter(has_text=exam["title"]).locator(".btn-exam-sm-results").click()
    expect(page.locator("#teacherResultsTableBody tr")).to_have_count(1)
    cells = page.locator("#teacherResultsTableBody tr td")
    assert "0" in cells.nth(3).inner_text()
    assert "/ 10" in cells.nth(3).inner_text()
    page.evaluate("openStudentManagementStage()")
    expect(page.locator("#studentManagementStage")).to_be_visible()
    bars = page.locator("#smTopicBarChart .sm-bar-row")
    expect(bars.first).to_be_visible()
    exam_bar = bars.filter(has_text=exam["title"])
    expect(exam_bar).to_have_count(1)
    expect(exam_bar.locator(".sm-bar-score")).to_have_text("0/10")
