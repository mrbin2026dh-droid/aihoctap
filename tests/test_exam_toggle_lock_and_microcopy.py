"""Teacher locks are persisted and prevent student access, then reopen safely."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, student_login
from tests.exam_release_helpers import create_exam, open_hub


def test_exam_toggle_lock_and_microcopy(ui_page, live_server, teacher_pin):
    page = ui_page
    exam = create_exam(page, live_server, teacher_pin)
    teacher_login(page, teacher_pin)
    open_hub(page)
    expect(page.locator("#examTeacherView .exam-heading")).to_contain_text("Quản lý bài kiểm tra")
    assert len(page.locator("#examTeacherView .exam-subheading").inner_text().split()) <= 12
    toggle = page.locator("#examTeacherGrid .exam-switch-toggle input").first
    expect(toggle).to_be_checked()
    with page.expect_response(lambda r: "/status" in r.url and r.request.method == "PATCH") as changed:
        page.locator("#examTeacherGrid .exam-switch-toggle").first.click()
    assert changed.value.ok
    expect(toggle).not_to_be_checked()
    assert page.request.get(f"{live_server}/api/exams/{exam['exam_id']}").status == 404
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    student_login(page)
    open_hub(page)
    expect(page.locator("#examStudentGrid .exam-status-pill.closed")).to_be_visible()
    expect(page.locator("#examStudentGrid .btn-exam-disabled")).to_be_visible()
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    teacher_login(page, teacher_pin)
    open_hub(page)
    with page.expect_response(lambda r: "/status" in r.url and r.request.method == "PATCH") as changed:
        page.locator("#examTeacherGrid .exam-switch-toggle").first.click()
    assert changed.value.ok
    expect(toggle).to_be_checked()
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    student_login(page)
    open_hub(page)
    expect(page.locator("#examStudentView .exam-heading")).to_contain_text("Bài kiểm tra của em")
    assert len(page.locator("#examStudentView .exam-subheading").inner_text().split()) <= 12
    expect(page.locator("#examStudentGrid .btn-exam-primary")).to_be_visible()
    assert not page.page_errors
