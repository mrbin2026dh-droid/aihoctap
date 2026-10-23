"""Real isolated HTTP chat request/response and unlocked input after rendering."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, show_lesson


def test_browser_f12_chat(ui_page):
    page = ui_page
    student_login(page)
    show_lesson(page)
    page.evaluate("openPopup()")
    page.locator("#chatInput").fill("CPU có vai trò gì trong bài học?")
    with page.expect_response("**/api/chat") as response:
        page.locator("#btnSendChat").click()
    assert response.value.status == 200
    body = response.value.json()
    assert body["request_id"] and body["reply"]
    payload = response.value.request.post_data_json
    assert payload["grade"] == 9
    assert payload["context"]["active_tab"] == "theory"
    page.wait_for_function("!appState.isChatSubmitting")
    expect(page.locator("#chatInput")).to_be_enabled()
    expect(page.locator("#chatMessages .chat-bubble.assistant").last).not_to_be_empty()
    assert not page.page_errors
