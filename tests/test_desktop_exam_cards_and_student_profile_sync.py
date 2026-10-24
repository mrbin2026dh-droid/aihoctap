"""Desktop cards and profile editing run against isolated roster-backed login."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, assert_no_overflow
from tests.exam_release_helpers import create_exam, open_hub


def test_desktop_layout_and_profile_sync(ui_page, live_server, teacher_pin):
    page = ui_page
    page.set_viewport_size({"width": 1440, "height": 900})
    create_exam(page, live_server, teacher_pin)
    student_login(page)
    open_hub(page)
    expect(page.locator("#studentExamClassPill")).to_contain_text("9A")
    card = page.locator("#examStudentGrid .exam-card-item").first
    expect(card).to_be_visible()
    expect(card.locator(".exam-card-tag")).to_contain_text("Khối")
    assert card.bounding_box()["width"] >= 340
    page.locator("#stdUserBadge").click()
    page.locator("#btnStdOpenEditProfile").click()
    expect(page.locator("#modalStudentEditProfile")).to_be_visible()
    expect(page.locator("#inputEditStudentGrade")).to_have_value("9")
    expect(page.locator("#inputEditStudentClass")).to_have_value("9A")
    page.locator("#inputEditStudentName").fill("Học sinh kiểm thử đã chỉnh sửa")
    page.locator("#inputEditStudentGrade").select_option("8")
    page.locator("#inputEditStudentClass").fill("8B")
    page.locator("#btnSaveEditProfile").click()
    expect(page.locator("#modalStudentEditProfile")).to_be_hidden()
    saved = page.evaluate("JSON.parse(localStorage.getItem('ai_sgk_student_auth'))")
    assert saved["studentName"] == "Học sinh kiểm thử đã chỉnh sửa"
    assert saved["grade"] == 8 and saved["classCode"] == "8B"
    expect(page.locator("#studentExamClassPill")).to_contain_text("8B")
    expect(page.locator("#stdUserRole")).to_contain_text("8B")
    expect(page.locator("#stdDropdownEmail")).to_contain_text("8B")
    assert_no_overflow(page)
    assert not page.page_errors
