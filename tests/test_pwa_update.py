"""A real service worker update must wait while a student has an unfinished draft."""
from pathlib import Path

from playwright.sync_api import expect
from starlette.responses import Response
from starlette.staticfiles import StaticFiles

from tests.test_pwa_browser import (
    exercise, isolated_pwa_store, login, open_math_lesson, publish, pwa_browser,
    wait_for_saved_draft,
)


def test_new_service_worker_waits_for_active_answers(pwa_browser, monkeypatch):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('input[name="q1"][value="B"]').check()
    page.locator('textarea[name="q2"]').fill('Draft must survive a service worker update.')
    wait_for_saved_draft(page)
    page.evaluate('navigator.serviceWorker.ready.then(() => true)')
    page.wait_for_function('navigator.serviceWorker.controller !== null')

    original = StaticFiles.get_response
    source = (Path(__file__).resolve().parents[1] / 'frontend/hoc/sw.js').read_text(encoding='utf-8')
    source = source.replace('aisgk-student-shell-', 'aisgk-student-shell-test-update-', 1)

    async def serve_updated_worker(self, path, scope):
        if path.replace('\\', '/').endswith('hoc/sw.js'):
            return Response(source, media_type='application/javascript', headers={'Cache-Control': 'no-store'})
        return await original(self, path, scope)

    monkeypatch.setattr(StaticFiles, 'get_response', serve_updated_worker)
    page.evaluate('navigator.serviceWorker.getRegistration().then(registration => registration.update())')
    expect(page.locator('#update-notice')).to_be_visible()
    page.get_by_role('button', name='Cập nhật khi sẵn sàng', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Hoàn thành bài đang làm')
    expect(page.locator('textarea[name="q2"]')).to_have_value('Draft must survive a service worker update.')
    assert page.evaluate('navigator.serviceWorker.getRegistration().then(registration => Boolean(registration.waiting))')
    if page.locator('#msg-dialog[open]').count():
        page.locator('#msg-ok').click()
    page.get_by_role('button', name='Nộp bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Đã nộp')
    with page.expect_navigation():
        page.get_by_role('button', name='Cập nhật khi sẵn sàng', exact=True).click()
    expect(page.locator('textarea[name="q2"]')).to_have_value('Draft must survive a service worker update.')
    assert errors == []
