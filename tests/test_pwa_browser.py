"""Real isolated HTTP/browser checks for the student PWA (no cloud writes)."""

from urllib.request import urlopen

import pytest
from playwright.sync_api import expect, sync_playwright


@pytest.fixture(autouse=True)
def isolated_pwa_store(tmp_path, monkeypatch, global_test_isolation):
    """Every browser uses a disposable DB and cannot write a cloud backend."""
    monkeypatch.setenv("PWA_DATABASE_PATH", str(tmp_path / "student-pwa.sqlite3"))
    monkeypatch.setenv("PWA_STORAGE_BACKEND", "sqlite")
    monkeypatch.delenv("RENDER", raising=False)


@pytest.fixture
def pwa_browser(live_server, teacher_pin):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        student = browser.new_context(
            base_url=live_server, viewport={"width": 390, "height": 844}
        )
        teacher = browser.new_context(base_url=live_server)
        for context in (student, teacher):
            context.add_init_script("delete window.BroadcastChannel;")
            context.route("https://**/*", lambda route: route.abort())
        response = teacher.request.post("/api/teacher/auth", data={"pin": teacher_pin})
        assert response.ok, response.text()
        token = response.json()["token"]
        teacher.set_extra_http_headers({"Authorization": f"Bearer {token}"})
        page = student.new_page()
        errors = []
        requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("request", lambda request: requests.append(request.url))
        try:
            yield page, student, teacher, errors, requests
        finally:
            teacher.close()
            student.close()
            browser.close()


def publish(teacher, *, title="Phân số", body="Nội dung phiên bản một.", correct="B"):
    document = {
        "subject_id": "toan",
        "subject_name": "Toán học",
        "grade": 9,
        "lesson_id": "bai-1",
        "title": title,
        "content_markdown": body,
        "questions": [
            {
                "id": "q1", "prompt": "Hai cộng ba bằng bao nhiêu?", "kind": "choice",
                "options": {"A": "Bốn", "B": "Năm"}, "correct_answer": correct,
                "hint": "Em hãy đếm thêm ba đơn vị từ hai.",
            },
            {
                "id": "q2", "prompt": "Em giải thích cách đếm của mình.", "kind": "text",
                "options": {}, "correct_answer": "", "hint": "Viết bằng lời của em.",
            },
        ],
    }
    response = teacher.request.post("/api/pwa/teacher/publish", data=document)
    assert response.ok, response.text()
    return response.json()


def login(page, code="123456"):
    page.get_by_role("button", name="Đăng nhập", exact=True).click()
    page.get_by_label("Mã học sinh", exact=True).fill(code)
    page.get_by_role("button", name="Vào học", exact=True).click()
    expect(page.get_by_role("button", name="Đăng nhập", exact=True)).to_be_hidden()


def open_math_lesson(page):
    page.locator('[data-course-id="toan-9"]').first.click()
    page.locator('[data-lesson-id="bai-1"]').first.click()
    expect(page.locator("#lesson-content")).to_contain_text("Nội dung phiên bản")


def exercise(page):
    page.get_by_role("button", name="Làm bài tập", exact=True).click()
    expect(page.locator("#question-form")).to_be_visible()


def wait_for_saved_draft(page):
    expect(page.locator("#draft-status")).to_contain_text("Đã lưu")


def test_student_pwa_entry_is_served(live_server):
    """A missing student entry must fail before any PWA behavior is claimed."""
    with urlopen(f"{live_server}/hoc/") as response:
        assert response.status == 200
        assert b'manifest' in response.read()


def test_teacher_publication_reaches_student_without_reinstall(pwa_browser):
    page, _, teacher, errors, requests = pwa_browser
    page.goto("/hoc/")
    publish(teacher)
    page.bring_to_front()
    # Production refresh must also recover missed foreground revision events.
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(page.locator('#courses [data-course-id="toan-9"]')).to_be_visible(timeout=65000)
    open_math_lesson(page)
    assert not any("/api/chat" in url or "generativelanguage" in url for url in requests)
    assert errors == []


def test_downloaded_lesson_opens_after_closing_page_offline(pwa_browser):
    page, student, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto("/hoc/")
    login(page)
    open_math_lesson(page)
    page.get_by_role("button", name="Tải bài", exact=True).click()
    expect(page.locator("#status")).to_contain_text("Đã tải")
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    page.close()
    student.set_offline(True)
    offline_page = student.new_page()
    offline_page.goto("/hoc/")
    offline_page.get_by_role("button", name="Đã tải", exact=True).click()
    offline_page.locator('#downloads [data-lesson-id="bai-1"]').first.click()
    expect(offline_page.locator("#lesson-content")).to_contain_text("Nội dung phiên bản một.")
    assert errors == []


def test_draft_survives_reload_and_new_content_does_not_replace_active_attempt(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    catalog = publish(teacher)
    course = next(course for course in catalog["courses"] if course["id"] == "toan-9")
    first_version = course["lessons"][0]["version"]
    page.goto("/hoc/")
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('#question-form input[name="q1"][value="B"]').check()
    page.locator('#question-form textarea[name="q2"]').fill("Em đếm ba, bốn, năm.")
    wait_for_saved_draft(page)
    publish(teacher, body="Nội dung phiên bản hai.", correct="A")
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(page.locator('#question-form textarea[name="q2"]')).to_have_value("Em đếm ba, bốn, năm.")
    page.reload()
    expect(page.locator('#question-form textarea[name="q2"]')).to_have_value("Em đếm ba, bốn, năm.")
    expect(page.locator('#question-form input[name="q1"][value="B"]')).to_be_checked()
    with page.expect_response(lambda response: "/api/pwa/attempts" in response.url and response.request.method == "POST") as submitted:
        page.get_by_role("button", name="Nộp bài", exact=True).click()
    acknowledgment = submitted.value.json()
    assert submitted.value.ok, acknowledgment
    assert acknowledgment["version"] == first_version
    assert acknowledgment["correct"] == 1
    assert acknowledgment["needs_review"]
    expect(page.locator("#status")).to_contain_text("Đã nộp")
    assert errors == []


def test_offline_submission_stays_queued_until_real_server_ack(pwa_browser):
    page, student, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto("/hoc/")
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('#question-form input[name="q1"][value="B"]').check()
    page.locator('#question-form textarea[name="q2"]').fill("Em đếm từng đơn vị.")
    wait_for_saved_draft(page)
    student.set_offline(True)
    page.get_by_role("button", name="Nộp bài", exact=True).click()
    expect(page.locator("#status")).to_contain_text("Chờ")
    assert "Đã nộp" not in page.locator("#status").inner_text()
    student.set_offline(False)
    page.evaluate("window.dispatchEvent(new Event('online'))")
    expect(page.locator("#status")).to_contain_text("Đã nộp", timeout=15000)
    # Retry/reconnect must not create a second grading record.
    page.evaluate("window.dispatchEvent(new Event('online'))")
    response = teacher.request.get("/api/pwa/teacher/results")
    assert response.ok, response.text()
    results = response.json()
    assert len(results["attempts"]) == 1
    assert errors == []


def test_student_layout_keyboard_and_no_chat_network(pwa_browser):
    page, _, teacher, errors, requests = pwa_browser
    publish(teacher)
    page.goto("/hoc/")
    open_math_lesson(page)
    for width, height in [(360, 740), (390, 844), (412, 915), (1366, 768), (1920, 1080)]:
        page.set_viewport_size({"width": width, "height": height})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement !== document.body")
    assert page.locator('textarea[placeholder*="hỏi"], [aria-label*="chatbot"]').count() == 0
    assert not any("/api/chat" in url or "generativelanguage" in url for url in requests)
    assert errors == []
