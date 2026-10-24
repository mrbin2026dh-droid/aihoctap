"""Student-facing navigation must expose real actions without hidden prerequisites."""
from playwright.sync_api import expect
from tests.test_pwa_browser import (
    isolated_pwa_store, pwa_browser, publish, login, open_math_lesson,
    exercise, wait_for_saved_draft,
)


def test_lesson_list_is_visible_without_an_extra_subject_click(pwa_browser):
    page, _, teacher, _, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    expect(page.locator('#lesson-list [data-course-id="toan-9"][data-lesson-id="bai-1"]')).to_be_visible()
    expect(page.locator('#catalog-summary')).to_contain_text('bài')


def test_resume_returns_to_saved_answers_and_practice_tab_is_active(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('textarea[name="q2"]').fill('Keep this explanation in my draft.')
    wait_for_saved_draft(page)
    page.get_by_role('button', name='Về danh sách', exact=True).click()
    page.get_by_role('button', name='Tiếp tục bài đang học', exact=True).click()
    expect(page.locator('textarea[name="q2"]')).to_have_value('Keep this explanation in my draft.')
    expect(page.locator('[data-tab="practice"]')).to_have_attribute('aria-current', 'page')
    assert errors == []


def test_guest_answers_are_not_lost_when_login_is_required_to_submit(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    open_math_lesson(page)
    exercise(page)
    page.locator('input[name="q1"][value="B"]').check()
    page.locator('textarea[name="q2"]').fill('My guest explanation must survive sign in.')
    page.get_by_role('button', name='Nộp bài', exact=True).click()
    page.get_by_label('Mã học sinh', exact=True).fill('123456')
    page.get_by_role('button', name='Vào học', exact=True).click()
    expect(page.locator('#login')).to_be_hidden()
    expect(page.locator('textarea[name="q2"]')).to_have_value('My guest explanation must survive sign in.')
    expect(page.locator('input[name="q1"][value="B"]')).to_be_checked()
    assert errors == []


def test_initial_catalog_failure_has_a_working_retry(pwa_browser):
    page, _, teacher, _, _ = pwa_browser
    publish(teacher)
    page.route('**/api/pwa/catalog', lambda route: route.fulfill(status=503, json={'detail':'Synthetic unavailable catalog'}))
    page.goto('/hoc/')
    expect(page.locator('#catalog-view')).to_contain_text('Chưa tải được danh mục')
    expect(page.get_by_role('button', name='Thử tải lại', exact=True)).to_be_visible()
    page.unroute('**/api/pwa/catalog')
    page.get_by_role('button', name='Thử tải lại', exact=True).click()
    expect(page.locator('#lesson-list [data-course-id="toan-9"][data-lesson-id="bai-1"]')).to_be_visible()


def test_submitted_answer_counter_stays_complete_after_reload(pwa_browser):
    page, _, teacher, _, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('input[name="q1"][value="B"]').check()
    page.locator('textarea[name="q2"]').fill('Both answers remain present after submission.')
    page.get_by_role('button', name='Nộp bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Đã nộp')
    expect(page.locator('#answer-count')).to_contain_text('2/2')
    page.reload()
    expect(page.locator('#answer-count')).to_contain_text('2/2')
