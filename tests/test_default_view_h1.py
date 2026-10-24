"""Authenticated lesson entry and quiz/tutor navigation regression."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login

def test_default_view_matches_h1(ui_page, live_server):
    page = ui_page
    page.goto(live_server)
    student_login(page, '600001', 6)
    page.evaluate('switchView("theory")')
    expect(page.locator('#theoryView')).to_be_visible()
    expect(page.locator('#quizView')).to_be_hidden()
    expect(page.locator('.lesson-tree-item[data-lesson-id="1"] .section-subitem[data-section-id="sec-1"]')).to_have_class('section-subitem active')
    if not page.locator('#socratesPopupCard').evaluate("el => el.classList.contains('open')"):
        page.locator('#btnHeaderTutor').click()
    expect(page.locator('#btnHeaderTutor')).to_have_attribute('aria-expanded', 'true')
    page.locator('#btnGoToQuiz').click()
    expect(page.locator('#quizView')).to_be_visible()
    expect(page.locator('#theoryView')).to_be_hidden()
    page.locator('.lesson-tree-item[data-lesson-id="1"] .section-subitem[data-section-id="sec-1"]').click()
    expect(page.locator('#theoryView')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#btnHeaderTutor')).to_have_attribute('aria-expanded', 'false')
    page.locator('#btnHeaderTutor').click()
    expect(page.locator('#btnHeaderTutor')).to_have_attribute('aria-expanded', 'true')
