"""Browser tests for Student PWA Online Socratic AI Tutor."""
import pytest
from playwright.sync_api import expect
from tests.test_pwa_browser import (
    pwa_browser,
    isolated_pwa_store,
    publish,
    open_math_lesson,
    exercise,
)



def test_tutor_dialog_interaction_online(pwa_browser):
    page, student, teacher, errors, requests = pwa_browser
    publish(teacher, title="Phân số và Phép chia", body="Nội dung phiên bản một. Phân số chỉ một phần của đơn vị.")

    page.goto("/hoc/")
    open_math_lesson(page)

    ask_button = page.locator("#ask-tutor")
    expect(ask_button).to_be_visible()
    expect(ask_button).to_be_enabled()

    # Open Tutor Dialog
    ask_button.click()
    dialog = page.locator("#tutor-dialog")
    expect(dialog).to_be_visible()
    expect(page.locator("#tutor-title")).to_contain_text("Gia sư Tin học AI")
    expect(page.locator("#tutor-messages")).to_contain_text("Chào em")

    # Send a question
    tutor_input = page.locator("#tutor-input")
    tutor_input.fill("Em chưa hiểu bài này, thầy giải thích giúp em?")
    page.locator("#tutor-submit").click()

    # Verify message sent and reply appears
    expect(page.locator("#tutor-messages")).to_contain_text("Em chưa hiểu bài này")
    expect(page.locator("#tutor-messages .tutor-bot").last).to_be_visible()

    # Close dialog
    page.locator("#close-tutor").click()
    expect(dialog).to_be_hidden()
    assert not errors, f"Console or page errors: {errors}"


def test_tutor_button_on_exercise_question(pwa_browser):
    page, student, teacher, errors, requests = pwa_browser
    publish(teacher, title="Bài tập Phân số")

    page.goto("/hoc/")
    open_math_lesson(page)
    exercise(page)

    q_tutor_btn = page.locator(".question-tutor-btn").first
    expect(q_tutor_btn).to_be_visible()
    q_tutor_btn.click()

    dialog = page.locator("#tutor-dialog")
    expect(dialog).to_be_visible()
    expect(page.locator("#tutor-context-note")).to_contain_text("Đang hướng dẫn câu")

    page.locator("#close-tutor").click()
    expect(dialog).to_be_hidden()


def test_tutor_offline_status_handling(pwa_browser):
    page, student, teacher, errors, requests = pwa_browser
    publish(teacher, title="Bài học Offline")

    page.goto("/hoc/")
    open_math_lesson(page)

    # Simulate offline mode
    student.set_offline(True)
    page.evaluate("window.dispatchEvent(new Event('offline'))")

    ask_button = page.locator("#ask-tutor")
    expect(ask_button).to_be_disabled()

    # Re-enable online mode
    student.set_offline(False)
    page.evaluate("window.dispatchEvent(new Event('online'))")
    expect(ask_button).to_be_enabled()
