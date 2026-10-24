"""Required login portal, responsive layout and real student sign-in."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, assert_no_overflow

def test_student_login_portal_and_responsive(ui_page, live_server):
    page = ui_page
    page.goto(live_server)
    expect(page.locator('#studentLoginPortal')).to_be_visible()
    expect(page.locator('.sl-auth-title')).to_have_text('Đăng nhập')
    expect(page.locator('.sl-auth-card')).to_be_visible()
    assert page.locator('#slRoleTabs [role=tab]').count() == 3
    expect(page.locator('#btnGoogleSignIn')).to_contain_text('Tiếp tục với Google')
    assert page.locator('#slPanelStudent #slInputClassCode').count() == 0
    expect(page.locator('#slChkAgreeTerms')).to_be_checked()
    assert_no_overflow(page)
    page.set_viewport_size({'width':1366,'height':768})
    student_login(page)
    assert page.evaluate('Boolean(studentAuthState.token)')
    page.evaluate('openStudentLoginPortal()')
    expect(page.locator('#studentLoginPortal')).to_be_visible()
