"""Mobile login, tutor dialog and forward question guards with real auth."""
import re
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, assert_no_overflow
from tests.exam_release_helpers import create_exam, start_exam


def test_h1_forward_lock_and_h2_to_h5_features(ui_page, live_server, teacher_pin):
    page = ui_page
    page.set_viewport_size({"width": 390, "height": 844})
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    # PIN behavior is deliberately unchanged; inspect no secret or sample control.
    page.locator("#slTabTeacher").click()
    expect(page.locator(".sl-quick-pin-row")).to_have_count(0)
    assert teacher_pin not in page.locator("#studentLoginPortal").inner_text()
    create_exam(page, live_server, teacher_pin)
    student_login(page)
    page.evaluate("openPopup()")
    expect(page.locator("#socratesPopupCard")).to_be_visible()
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    page.locator("#btnClosePopup").click()
    start_exam(page)
    page.locator("#btnTakingNextQ").click()
    expect(page.locator("#takingQCurrentIndex")).to_contain_text("Câu 1")
    expect(page.locator("#examToastAlert")).to_contain_text("chọn đáp án")
    second = page.locator("#takingPaletteContainer .palette-q-btn").nth(1)
    expect(second).to_have_class(re.compile("palette-q-locked"))
    second.click()
    expect(page.locator("#takingQCurrentIndex")).to_contain_text("Câu 1")
    page.locator(".taking-opt-card").first.click()
    page.locator("#btnTakingNextQ").click()
    expect(page.locator("#takingQCurrentIndex")).to_contain_text("Câu 2")
    page.locator("#btnTakingNextQ").click()
    expect(page.locator("#takingQCurrentIndex")).to_contain_text("Câu 2")
    page.locator("#btnTakingPrevQ").click()
    expect(page.locator("#takingQCurrentIndex")).to_contain_text("Câu 1")
    assert_no_overflow(page)
