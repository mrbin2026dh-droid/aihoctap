import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from tests.test_browser_f12_chat import ensure_server_running


def test_chat_abort_controller_on_switch_lesson():
    """Kiểm thử Bug 4: Chuyển bài học khi chat đang in-flight phải abort fetch và không ghi đè lịch sử."""
    server_ok = ensure_server_running("127.0.0.1", 8000)
    assert server_ok, "FAIL: Server 8000 chưa sẵn sàng"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Giữ lại route /api/chat để giả lập request in-flight
        paused_routes = []
        def handle_chat_route(route):
            paused_routes.append(route)

        page.route("**/api/chat", handle_chat_route)

        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        page.evaluate("if (typeof portalDirectClose === 'function') portalDirectClose();")
        page.wait_for_timeout(300)

        # 1. Gửi tin nhắn chat
        chat_input = page.locator("#chatInput")
        chat_input.fill("Câu hỏi này đang được gửi đi...")
        btn_send = page.locator("#btnSendChat")
        btn_send.click()

        page.wait_for_timeout(200)

        # Xác nhận in-flight và abort controller đã được kích hoạt
        is_submitting = page.evaluate("() => window.appState.isChatSubmitting")
        has_abort_ctrl = page.evaluate("() => window.appState.activeChatAbortController !== null")
        is_aborted_initially = page.evaluate("() => window.appState.activeChatAbortController ? window.appState.activeChatAbortController.signal.aborted : null")

        assert is_submitting is True, "FAIL: isChatSubmitting phải là True khi in-flight"
        assert has_abort_ctrl is True, "FAIL: activeChatAbortController phải tồn tại"
        assert is_aborted_initially is False, "FAIL: AbortController chưa được phép abort khi đang gửi"
        assert len(paused_routes) == 1, "FAIL: Request /api/chat phải được bắt trong paused_routes"

        # 2. Học sinh chuyển sang bài học khác (switchToLesson)
        print("-> Chuyển sang Bài 2 khi fetch đang in-flight...")
        page.evaluate("() => switchToLesson(2)")
        page.wait_for_timeout(200)

        # Xác nhận AbortController đã bị abort và Mutex đã được giải phóng
        is_aborted_after = page.evaluate("() => window.appState.activeChatAbortController === null")
        is_submitting_after = page.evaluate("() => window.appState.isChatSubmitting")
        is_input_disabled = page.evaluate("() => document.getElementById('chatInput').disabled")

        assert is_aborted_after is True, "FAIL: activeChatAbortController phải được dọn dẹp (null)"
        assert is_submitting_after is False, "FAIL: isChatSubmitting phải trở về False"
        assert is_input_disabled is False, "FAIL: chatInput phải được mở lại để học sinh học bài mới"

        # 3. Giả lập phản hồi cũ của Bài 1 quay về sau khi đã đổi bài
        print("-> Giả lập backend trả về kết quả cũ sau khi đã chuyển sang bài 2...")
        paused_routes[0].fulfill(
            status=200,
            content_type="application/json",
            body='{"reply": "Phản hồi cũ của Bài 1 không được phép xuất hiện ở Bài 2", "request_id": "req_stale_1"}'
        )
        page.wait_for_timeout(400)

        # Xác minh phản hồi cũ KHÔNG được ghi vào chatHistory của bài mới
        chat_history = page.evaluate("() => window.appState.chatHistory")
        history_contents = [m.get("content", "") for m in chat_history]
        assert not any("Phản hồi cũ của Bài 1" in c for c in history_contents), (
            f"FAIL: Phản hồi cũ bị rò rỉ vào lịch sử chat của bài mới! History: {chat_history}"
        )

        browser.close()
    print("XÁC NHẬN CHỐNG STALE RESPONSE TRÊN APP.JS: PASS 100%")


if __name__ == "__main__":
    test_chat_abort_controller_on_switch_lesson()
