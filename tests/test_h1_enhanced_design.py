"""Lesson structure, honest progress and contextual tutor cards."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login

def test_enhanced_design_matches_reference(ui_page, live_server):
    page = ui_page
    page.goto(live_server)
    student_login(page, '600001', 6)
    page.evaluate('switchView("theory")')
    expect(page.locator('.brand-subtitle')).to_contain_text('Nền tảng học tập thông minh')
    assert page.locator('#roadmapSidebar .header-grade-pill').count() == 4
    expect(page.locator('.sidebar-nav-badge')).to_contain_text('TIN HỌC 6')
    expect(page.locator('#roadmapProgressPercent')).to_have_text('0%')
    expect(page.locator('#roadmapProgressSubtext')).to_contain_text('Đã làm đúng 0/')
    expect(page.locator('.theory-top-badge')).to_contain_text('Bài 1')
    expect(page.locator('#sec-1')).to_contain_text('Thông tin và dữ liệu')
    expect(page.locator('.theory-visual-card')).to_be_visible()
    expect(page.locator('.theory-note-card')).to_contain_text('Dữ liệu')
    cards = page.locator('#promptActionCards .prompt-action-card')
    assert cards.count() == 3
    expect(cards.nth(0)).to_contain_text('Dữ liệu khác thông tin')
    expect(cards.nth(1)).to_contain_text('Ví dụ vật mang tin')
    expect(cards.nth(2)).to_contain_text('Gợi ý bài học này')
