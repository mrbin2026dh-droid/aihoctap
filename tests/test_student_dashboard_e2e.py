"""Teacher analytics reflects the actual HTTP roster, search and responsive layout."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, show_lesson, assert_no_overflow

def test_student_dashboard_e2e_playwright(ui_page, live_server, teacher_pin):
    page = ui_page
    page.goto(live_server)
    teacher_login(page, teacher_pin)
    expect(page.locator('#focusCanvas')).to_be_hidden()
    expect(page.locator('#kpiTotalStudents')).to_have_text('2')
    expect(page.locator('#kpiCompletedCount')).to_have_text('0')
    rows = page.locator('#smStudentTableBody tr')
    expect(rows).to_have_count(2)
    expect(page.locator('#smStudentTableBody')).to_contain_text('Nguyễn Minh Khang')
    expect(page.locator('#smStudentTableBody')).to_contain_text('Trần Thị Mai')
    page.locator('#smSearchInput').fill('Trần Thị Mai')
    expect(rows).to_have_count(1)
    page.locator('#smSearchInput').fill('')
    page.locator('#smStatusFilter').select_option('needs_support')
    expect(page.locator('#smStudentTableBody')).not_to_contain_text('Nguyễn Minh Khang')
    page.locator('#smStatusFilter').select_option('all')
    expect(rows).to_have_count(2)
    page.locator('#smStudentTableBody tr:first-child .btn-view-student').click()
    expect(page.locator('#smStudentDetailModal')).to_be_visible()
    expect(page.locator('#smModalStudentName')).to_have_text('Nguyễn Minh Khang')
    page.locator('#smBtnCloseModal').click()
    expect(page.locator('#smStudentDetailModal')).to_be_hidden()
    assert_no_overflow(page)
    page.set_viewport_size({'width':1366,'height':768})
    page.locator('#smBtnBackToLesson').click()
    expect(page.locator('#studentManagementStage')).to_be_hidden()
    expect(page.locator('#focusCanvas')).to_be_visible()
    assert not page.page_errors
