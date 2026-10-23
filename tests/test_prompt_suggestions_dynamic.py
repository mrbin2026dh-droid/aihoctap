"""Prompt suggestions follow grade, lesson and current quiz question."""
import re
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, show_lesson

def test_dynamic_prompt_suggestions(ui_page, live_server, teacher_pin):
    page = ui_page
    page.goto(live_server + '/?grade=9&lesson=6')
    teacher_login(page, teacher_pin)
    show_lesson(page)
    page.evaluate('switchGrade(9)')
    page.evaluate('switchToLesson(6)')
    page.evaluate('switchView("theory")')
    cards = page.locator('#promptActionCards .prompt-action-card')
    assert cards.count() == 3
    expect(cards.nth(0)).to_contain_text('Quy trình 4 bước mô phỏng?')
    expect(cards.nth(1)).to_contain_text('Thực hành PhET mạch điện?')
    expect(cards.nth(2)).to_contain_text('Gợi ý bài học này')
    page.locator('#stepItemQuiz').click()
    expect(cards.nth(2)).to_contain_text('Gợi ý Câu 1')
    page.locator('#btnHeaderTutor').click()
    expect(page.locator('#socratesPopupCard')).to_have_class(re.compile(r'.*\bopen\b.*'))
    # A student may navigate only to unlocked questions; verify the first hint request.
    with page.expect_request('**/api/chat') as request_info:
        cards.nth(0).click()
    payload = request_info.value.post_data_json
    assert 'quy trình 4 bước' in payload['message'].lower()
    assert payload['grade'] == 9
    expect(page.locator('#chatMessages .chat-bubble.student').last).to_contain_text('quy trình 4 bước')
    page.evaluate('switchGrade(6)')
    expect(cards.nth(0)).to_contain_text('Dữ liệu khác thông tin?')
    expect(cards.nth(1)).to_contain_text('Ví dụ vật mang tin?')
    assert not page.page_errors
