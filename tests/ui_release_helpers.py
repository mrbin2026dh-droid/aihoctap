"""Real HTTP login helpers for the isolated browser regression server."""
from playwright.sync_api import expect


def teacher_login(page, pin):
    if not page.locator('#studentLoginPortal').is_visible():
        page.evaluate('openStudentLoginPortal()')
    page.locator('#slTabTeacher').click()
    page.locator('#slTeacherPinInput').fill(pin)
    page.locator('#slBtnTeacherLogin').click()
    expect(page.locator('#studentLoginPortal')).to_be_hidden()
    expect(page.locator('#studentManagementStage')).to_be_visible()


def student_login(page, code='123456', grade=9):
    page.locator('#slTabLanStudent').click()
    page.locator(f'#slLanGradeSelector [data-grade="{grade}"]').click()
    page.locator('#slInputStudentPasscode').fill(code)
    page.locator('#slBtnLanLogin').click()
    expect(page.locator('#studentLoginPortal')).to_be_hidden()
    expect(page.locator('#dashboardView')).to_be_visible()
    page.wait_for_function('(grade) => appState.grade === grade && studentAuthState.grade === grade', arg=grade)


def show_lesson(page):
    page.evaluate('closeStudentManagementStage(); switchView("theory")')
    expect(page.locator('#theoryView')).to_be_visible()


def assert_no_overflow(page):
    for width, height in [(1920, 1080), (1366, 768), (768, 1024), (375, 667)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
