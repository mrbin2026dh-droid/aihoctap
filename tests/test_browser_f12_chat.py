import json
import time
import sys
import socket
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import pytest

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def ensure_server_running(host="127.0.0.1", port=8000):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        pass

    import uvicorn
    from backend.server import app

    server_thread = threading.Thread(
        target=lambda: uvicorn.run(app, host=host, port=port, log_level="warning"),
        daemon=True
    )
    server_thread.start()

    for _ in range(30):
        time.sleep(0.2)
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((host, port))
            s.close()
            return True
        except Exception:
            continue
    return False


def test_browser_f12_chat():
    """Kiểm thử trình duyệt thật F12 Network và DOM cho tính năng Gia sư Socrates (Mục 5)."""
    print("=== BẮT ĐẦU KIỂM THỬ TRÌNH DUYỆT (MỤC 5) ===")

    server_ok = ensure_server_running("127.0.0.1", 8000)
    assert server_ok, "FAIL: Không thể kết nối hoặc khởi động FastAPI server tại 127.0.0.1:8000"

    chat_network_events = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})

        # Nạp sẵn phiên học sinh vào localStorage để vượt qua cổng đăng nhập
        context.add_init_script("""
        localStorage.setItem('ai_sgk_student_auth', JSON.stringify({
            isLoggedIn: true,
            uid: 'std_e2e_student_01',
            studentName: 'Học sinh E2E',
            studentEmail: 'e2e@student.edu.vn',
            grade: 9,
            classCode: '9A1'
        }));
        """)

        page = context.new_page()

        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser Error] {err}"))

        # Giám sát Network F12
        def on_request(request):
            print(f"[F12 Any Request] {request.method} {request.url}")
            if "/api/chat" in request.url:
                chat_network_events.append({
                    "type": "REQUEST",
                    "url": request.url,
                    "method": request.method,
                    "headers": dict(request.headers),
                    "post_data": request.post_data
                })
                print(f"[F12 Network -> Request] {request.method} {request.url}")

        def on_response(response):
            if "/api/chat" in response.url:
                try:
                    body = response.json()
                except Exception:
                    body = response.text()
                chat_network_events.append({
                    "type": "RESPONSE",
                    "url": response.url,
                    "status": response.status,
                    "status_text": response.status_text,
                    "headers": dict(response.headers),
                    "body": body
                })
                print(f"[F12 Network <- Response] Status: {response.status} {response.status_text}")

        page.on("request", on_request)
        page.on("response", on_response)

        # 1. Truy cập trang web
        print("1. Đang mở http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Đảm bảo đóng cổng đăng nhập nếu còn hiển thị
        page.evaluate("if (typeof portalDirectClose === 'function') portalDirectClose();")
        page.wait_for_timeout(500)

        # Đảm bảo khung chat mở
        drawer = page.locator("#socratesPopupCard")
        if not drawer.is_visible():
            btn = page.locator("#btnHeaderTutor")
            if btn.is_visible():
                btn.click()
                page.wait_for_timeout(500)

        # 2. Nhập câu hỏi vào ô chat
        test_question = "Thầy ơi cho em hỏi CPU có vai trò gì trong máy tính ạ?"
        print(f"2. Nhập câu hỏi: \"{test_question}\"")
        chat_input = page.locator("#chatInput")
        chat_input.fill(test_question)

        # 3. Gửi câu hỏi
        print("3. Bấm nút gửi câu hỏi...")
        btn_send = page.locator("#btnSendChat")
        btn_send.click()

        # 4. Chờ response của /api/chat xuất hiện trong chat_network_events
        print("4. Đang chờ phản hồi /api/chat...")
        for _ in range(70):
            if any(e["type"] == "RESPONSE" for e in chat_network_events):
                break
            page.wait_for_timeout(500)

        # Xác thực mạng F12: Phải bắt được cả request và response
        req_events = [e for e in chat_network_events if e["type"] == "REQUEST"]
        res_events = [e for e in chat_network_events if e["type"] == "RESPONSE"]

        assert len(req_events) > 0, "FAIL: Không bắt được gói tin Request /api/chat trong Network F12"
        assert len(res_events) > 0, "FAIL: Không bắt được gói tin Response /api/chat trong Network F12"

        latest_req = req_events[-1]
        latest_res = res_events[-1]

        # Kiểm tra payload
        assert latest_req["method"] == "POST", "FAIL: Phương thức request phải là POST"
        assert latest_req["post_data"] is not None, "FAIL: Request payload bị rỗng"
        payload_data = json.loads(latest_req["post_data"])
        assert payload_data.get("grade") == 9, "FAIL: Grade trong payload không đúng"
        assert payload_data.get("message") == test_question, "FAIL: Message trong payload không khớp"

        # Kiểm tra HTTP status và Response body
        assert latest_res["status"] == 200, f"FAIL: Response status {latest_res['status']} != 200"
        res_body = latest_res["body"]
        assert isinstance(res_body, dict), "FAIL: Response body phải là JSON object"
        assert "reply" in res_body, "FAIL: Response body thiếu trường 'reply'"
        assert len(res_body["reply"].strip()) > 0, "FAIL: Phản hồi AI bị rỗng"
        assert "request_id" in res_body, "FAIL: Response body thiếu trường 'request_id'"

        # 5. Chờ hiệu ứng đánh máy hoàn tất và ô nhập được mở lại (Không nuốt lỗi)
        print("5. Chờ hiệu ứng đánh máy hoàn tất và ô nhập mở lại...")
        page.wait_for_function("() => !document.getElementById('chatInput').disabled", timeout=30000)

        is_disabled_after = chat_input.is_disabled()
        assert is_disabled_after is False, "FAIL: Ô nhập liệu chatInput không được mở lại sau khi phản hồi hoàn tất"

        # 6. Kiểm tra bong bóng chat hiển thị đầy đủ
        bubbles = page.locator(".chat-bubble.assistant").all_text_contents()
        assert len(bubbles) > 0, "FAIL: Không có bong bóng phản hồi assistant nào trong DOM"
        last_reply = bubbles[-1].strip()
        assert len(last_reply) > 0, "FAIL: Nội dung bong bóng chat của gia sư bị rỗng"
        print(f"6. Nội dung bong bóng chat hiển thị: \"{last_reply[:150]}...\"")

        browser.close()

    print("\n=================================================================")
    print("TỔNG KẾT KIỂM THỬ TRÌNH DUYỆT F12: PASS 100%")
    print("=================================================================")


if __name__ == "__main__":
    test_browser_f12_chat()
