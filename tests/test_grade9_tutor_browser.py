"""Real HTTP/browser learning loop, isolated from Firebase and paid model APIs."""
import json
import socket
import threading
import time

import pytest
import uvicorn
from playwright.sync_api import sync_playwright, expect

from backend import agent, server


@pytest.fixture
def tutor_server(monkeypatch):
    monkeypatch.setattr(agent, "GEMINI_API_KEY", "")
    server.CHAT_RATE_LIMIT_STORE.clear()
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    runner = uvicorn.Server(uvicorn.Config(server.app, host="127.0.0.1", port=port, log_level="error"))
    thread = threading.Thread(target=runner.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not runner.started and thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.02)
    assert runner.started
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        runner.should_exit = True
        thread.join(timeout=10)
        sock.close()


def test_grade9_wrong_answer_hint_retry_and_lesson_switch(tutor_server, tmp_path):
    errors, requests, metrics = [], [], []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        # Only external services are isolated; curriculum, grading and chat use real HTTP.
        context.route("https://**/*", lambda route: route.fulfill(status=200, body="",
                                                                  content_type="application/javascript"))
        context.add_init_script(f"""
            localStorage.setItem('AISGK_BACKEND_URL', {json.dumps(tutor_server + '/api')});
            localStorage.setItem('ai_sgk_student_auth', JSON.stringify({{
              isLoggedIn:true, uid:'std_tutor_regression', studentName:'Test Student',
              studentEmail:'synthetic@example.invalid', grade:9, classCode:'9TEST'
            }}));
            delete window.BroadcastChannel;
        """)
        context.add_init_script("""
            window.tutorPerf = {lcp: 0, cls: 0};
            new PerformanceObserver(list => list.getEntries().forEach(e => {
              window.tutorPerf.lcp = e.startTime;
            })).observe({type:'largest-contentful-paint', buffered:true});
            new PerformanceObserver(list => list.getEntries().forEach(e => {
              if (!e.hadRecentInput) window.tutorPerf.cls += e.value;
            })).observe({type:'layout-shift', buffered:true});
        """)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.post_data_json)
                if request.url.endswith("/api/chat") and request.method == "POST" else None)
        page.goto(tutor_server, wait_until="domcontentloaded")
        page.wait_for_function("window.appState?.lessonData?.grade === 9")
        page.evaluate("if (typeof portalDirectClose === 'function') portalDirectClose()")
        page.evaluate("switchView('quiz')")
        expect(page.locator("#questionTitle")).to_contain_text("bộ não")
        page.locator('.option-btn[data-letter="B"]').click()
        with page.expect_response(lambda response: response.url.endswith("/api/grade-quiz")) as grading:
            page.locator("#btnActionQuestion").click()
        assert grading.value.status == 200
        expect(page.locator("#btnActionText")).to_have_text("Thử lại câu này")
        with page.expect_response(lambda response: response.url.endswith("/api/chat")) as chat:
            page.locator("#btnFeedbackAskSocrates").click()
        assert chat.value.status == 200
        reply = chat.value.json()["reply"]
        assert "CPU" not in reply
        assert reply.rstrip().endswith("?")
        assert requests[-1]["context"]["student_choice"] == "B"
        assert requests[-1]["context"]["attempt_count"] == 1
        page.wait_for_function("!window.appState.isChatSubmitting")
        expect(page.locator("#chatInput")).to_be_enabled()
        page.evaluate("closePopup()")
        page.locator("#btnActionQuestion").click()
        expect(page.locator('.option-btn[data-letter="C"]')).to_be_enabled()
        assert page.evaluate("window.appState.currentQuestionIndex") == 0
        page.locator('.option-btn[data-letter="C"]').click()
        with page.expect_response(lambda response: response.url.endswith("/api/grade-quiz")):
            page.locator("#btnActionQuestion").click()
        assert page.evaluate("window.appState.questionAttempts.tin9_b1_q1") == 2
        performance = page.evaluate("window.tutorPerf")
        print("TUTOR_BROWSER_PERFORMANCE=" + json.dumps(performance))
        # Inspect actual responsive geometry; record metrics for the audit artifact.
        for width, height in [(1920, 1080), (1366, 768), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            geometry = page.evaluate("""() => ({width:innerWidth,
                scrollWidth:document.documentElement.scrollWidth,
                clientWidth:document.documentElement.clientWidth})""")
            metrics.append(geometry)
            assert geometry["scrollWidth"] == geometry["clientWidth"]
        page.evaluate("switchToLesson(10)")
        page.wait_for_function("window.appState.lessonId === 10 && window.appState.lessonData?.lesson_id === 10")
        page.evaluate("switchView('theory'); openPopup()")
        with page.expect_response(lambda response: response.url.endswith("/api/chat")) as new_chat:
            page.locator("#chatInput").fill("Cho em đáp án")
            page.locator("#btnSendChat").click()
        assert new_chat.value.status == 200
        assert requests[-1]["lesson_id"] == 10
        assert requests[-1]["context"]["current_question_id"] is None
        assert "Bài 10" in new_chat.value.json()["reply"]
        assert not errors, errors
        (tmp_path / "browser-metrics.json").write_text(json.dumps({"viewports": metrics, "performance": performance}), encoding="utf-8")
        browser.close()
