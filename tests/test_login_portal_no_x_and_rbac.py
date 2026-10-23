"""Anonymous visitors cannot bypass teacher access restrictions."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login

def test_login_portal_no_x_and_rbac(ui_page, live_server, teacher_pin):
    page = ui_page
    alerts = []
    page.on('dialog', lambda dialog: (alerts.append(dialog.message), dialog.accept()))
    page.goto(live_server)
    expect(page.locator('#studentLoginPortal')).to_be_visible()
    assert page.locator('#btnCloseLoginPortal, .sl-auth-close-btn').count() == 0
    expect(page.locator('#btnNavStudentMgmt')).to_be_hidden()
    expect(page.locator('#btnOpenTeacher')).to_be_hidden()
    page.evaluate('openStudentManagementStage()')
    expect(page.locator('#studentManagementStage')).to_be_hidden()
    assert alerts
    teacher_login(page, teacher_pin)
    page.evaluate('handleTeacherLogout()')
    expect(page.locator('#studentManagementStage')).to_be_hidden()
