"""Changing lesson aborts pending chat and rejects stale output/history."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, show_lesson


def test_chat_abort_controller_on_switch_lesson(ui_page, teacher_pin):
    page = ui_page
    teacher_login(page, teacher_pin)
    show_lesson(page)
    page.evaluate("openPopup()")
    paused = []
    page.route("**/api/chat", lambda route: paused.append(route))
    page.locator("#chatInput").fill("Câu hỏi đang gửi")
    page.locator("#btnSendChat").click()
    page.wait_for_function("appState.isChatSubmitting && !!appState.activeChatAbortController")
    assert len(paused) == 1
    page.evaluate("window.pendingController = appState.activeChatAbortController")
    page.evaluate("switchToLesson(2)")
    assert page.evaluate("pendingController.signal.aborted")
    page.wait_for_function("!appState.isChatSubmitting && appState.activeChatAbortController === null")
    paused[0].fulfill(status=200, content_type="application/json", body='{"reply":"STALE_LESSON_SENTINEL","request_id":"stale"}')
    expect(page.locator("#chatInput")).to_be_enabled()
    assert page.evaluate("!appState.chatHistory.some(h => h.content.includes('STALE_LESSON_SENTINEL'))")
    assert "STALE_LESSON_SENTINEL" not in page.locator("#chatMessages").inner_text()
    assert not page.page_errors
