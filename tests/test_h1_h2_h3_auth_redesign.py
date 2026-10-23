"""Social and code login validation plus teacher student-edit code generation."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, teacher_login, assert_no_overflow

def test_auth_redesign_h1_h2_h3(ui_page, live_server, teacher_pin):
    page = ui_page
    page.goto(live_server)
    expect(page.locator('#btnFacebookSignIn')).to_contain_text('Facebook')
    assert page.locator('#btnFacebookSignIn svg').count() == 1
    assert page.locator('#slPanelStudent #slInputClassCode').count() == 0
    page.locator('#slTabLanStudent').click()
    expect(page.locator('#slTabLanStudent')).to_contain_text('Mã HS')
    expect(page.locator('#slInputStudentPasscode')).to_have_attribute('maxlength', '6')
    page.locator('#slBtnLanLogin').click()
    expect(page.locator('#slLanAuthMsg')).to_contain_text('Vui lòng nhập Mã học sinh')
    page.locator('#slInputStudentPasscode').fill('123')
    page.locator('#slBtnLanLogin').click()
    expect(page.locator('#slLanAuthMsg')).to_contain_text('đúng 6 chữ số')
    student_login(page)
    teacher_login(page, teacher_pin)
    page.evaluate("openEditStudentModal({uid:'std_123456',student_code:'123456',full_name:'Test Student',grade:9,class_code:'9A'})")
    expect(page.locator('#smEditStudentModal')).to_be_visible()
    page.locator('#btnGenEditCode').click()
    code = page.locator('#smEditStudentCode').input_value()
    assert len(code) == 6 and code.isdigit()
    assert_no_overflow(page)
