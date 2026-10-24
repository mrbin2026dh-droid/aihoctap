"""Teacher curriculum browsing and grade9 lesson9 quiz rendering."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, show_lesson

def test_live_browser_tin9(ui_page, live_server, teacher_pin):
    page = ui_page
    page.goto(live_server)
    teacher_login(page, teacher_pin)
    show_lesson(page)
    pill = page.locator('#roadmapSidebar .header-grade-pill[data-grade="9"]')
    page.evaluate('switchGrade(9)')
    expect(pill).to_have_class('header-grade-pill active')
    expect(page.locator('.sidebar-nav-badge')).to_contain_text('TIN HỌC 9')
    expect(page.locator('#theoryContent')).to_contain_text('Thế giới kĩ thuật số')
    tree = page.locator('#curriculumTreeContainer')
    for title in ['Thông tin trong giải quyết vấn đề','Tìm hiểu phần mềm mô phỏng','Thực hành: Khai thác phần mềm mô phỏng','Sử dụng công cụ xác thực dữ liệu và hàm điều kiện']:
        expect(tree).to_contain_text(title)
    page.locator('.lesson-tree-header[data-lesson-id="9"]').first.click()
    expect(page.locator('#theoryContent')).to_contain_text('xác thực dữ liệu', ignore_case=True)
    page.locator('.lesson-tree-item[data-lesson-id="9"] .section-subitem[data-type="quiz"]').click()
    expect(page.locator('#quizView')).to_be_visible()
    assert page.locator('.option-btn').count() == 4
    assert not page.page_errors
