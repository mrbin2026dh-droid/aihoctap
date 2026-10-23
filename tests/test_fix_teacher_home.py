"""Switching from student to teacher clears the student's home identity."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, teacher_login

def test_teacher_home_navigation(ui_page, live_server, teacher_pin):
    page = ui_page
    page.goto(live_server)
    student_login(page)
    old_uid = page.evaluate('studentAuthState.uid')
    teacher_login(page, teacher_pin)
    page.locator('#btnNavDashboard').click()
    expect(page.locator('#dashboardView')).to_be_hidden()
    expect(page.locator('#studentManagementStage')).to_be_visible()
    assert page.evaluate('studentAuthState.uid') != old_uid
    assert page.evaluate('Boolean(state.teacherToken && state.teacherUnlocked)')
