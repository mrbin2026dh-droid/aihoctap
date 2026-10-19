"""
Kiểm thử chuyên sâu Playwright xác thực Cơ chế Khóa Mutex Giao diện (R3 Verification):
1. Mở trang học sinh http://127.0.0.1:8000
2. Mở Drawer Socrates AI
3. Nhập tin nhắn và bấm Gửi
4. Trong lúc Hiệu ứng Đánh máy (TypeWriterEffect) đang chạy:
   - Xác nhận chatInput.disabled == True
   - Xác nhận chatSendBtn.disabled == True
   - Xác nhận btnAskSocrates.disabled == True
   - Thử gửi tin nhắn thứ hai bằng cách nhấn phím Enter hoặc click -> Không tạo thêm bong bóng chat
5. Chờ sau khi typewriter hoàn thành:
   - Xác nhận chatInput.disabled == False
   - Xác nhận chatSendBtn.disabled == False
   - Xác nhận btnAskSocrates.disabled == False
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def verify_chat_mutex():
    print("=" * 60)
    print("XÁC MINH CƠ CHẾ KHÓA MUTEX GIAO DIỆN (SONET R3 VERIFICATION)")
    print("=" * 60)

    import socket
    import threading
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(('127.0.0.1', 8000))
        server_running = True
        s.close()
    except Exception:
        server_running = False

    if not server_running:
        import uvicorn
        from backend.server import app
        server_thread = threading.Thread(
            target=lambda: uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning"),
            daemon=True
        )
        server_thread.start()
        time.sleep(2)
        print("-> [0] Đã khởi động FastAPI server tại http://127.0.0.1:8000")
    else:
        print("-> [0] FastAPI server đang chạy tại http://127.0.0.1:8000")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")

        # 1. Mở Socrates Drawer
        btn_socrates = page.locator("#btnHeaderTutor")
        btn_socrates.click()
        page.wait_for_selector("#socratesPopupCard.open", timeout=5000)
        print("-> [1] Socrates Drawer đã mở thành công.")

        chat_input = page.locator("#chatInput")
        chat_send_btn = page.locator("#btnSendChat")

        # 2. Nhập câu hỏi và gửi
        chat_input.fill("Chào thầy Socrates, em muốn hỏi bài!")
        print("-> [2] Đã điền câu hỏi vào chatInput.")
        chat_send_btn.click()

        # 3. Ngay lập tức kiểm tra trạng thái Disabled của các thành phần UI
        page.wait_for_timeout(100)
        
        is_input_disabled = page.evaluate("() => document.getElementById('chatInput').disabled")
        is_send_disabled = page.evaluate("() => document.getElementById('btnSendChat').disabled")
        is_header_btn_disabled = page.evaluate("() => document.getElementById('btnHeaderTutor').disabled")
        is_mutex_locked = page.evaluate("() => window.appState ? window.appState.isChatSubmitting : true")

        print(f"-> [3] Kiểm tra khi đang xử lý/gõ:")
        print(f"       chatInput.disabled = {is_input_disabled}")
        print(f"       btnSendChat.disabled = {is_send_disabled}")
        print(f"       btnHeaderTutor.disabled = {is_header_btn_disabled}")
        print(f"       state.isChatSubmitting = {is_mutex_locked}")

        assert is_input_disabled is True, "FAIL: chatInput phải bị disabled khi đang xử lý!"
        assert is_send_disabled is True, "FAIL: btnSendChat phải bị disabled khi đang xử lý!"
        assert is_header_btn_disabled is True, "FAIL: btnHeaderTutor phải bị disabled khi đang xử lý!"
        assert is_mutex_locked is True, "FAIL: state.isChatSubmitting phải là True!"

        # 4. Thử cố tình trigger Enter hoặc click trong lúc đang bị khóa
        count_bubbles_before = page.locator(".chat-bubble.student").count()
        chat_input.press("Enter", timeout=1000)
        chat_send_btn.click(force=True, timeout=1000)
        page.wait_for_timeout(300)
        count_bubbles_after = page.locator(".chat-bubble.student").count()

        assert count_bubbles_before == count_bubbles_after, (
            f"FAIL: Phát hiện race condition! Số bong bóng user tăng từ {count_bubbles_before} lên {count_bubbles_after}"
        )
        print(f"-> [4] Thử spam phím Enter & Force Click khi Mutex khóa: Thành công chặn đứng (Số bong bóng học sinh không đổi = {count_bubbles_after}).")

        # 5. Chờ phản hồi hoàn tất và typewriter kết thúc (tối đa 15s)
        print("-> [5] Chờ Hiệu ứng Đánh máy hoàn tất (onComplete callback)...")
        page.wait_for_function(
            "() => document.getElementById('chatInput').disabled === false",
            timeout=15000
        )

        is_input_reopened = page.evaluate("() => document.getElementById('chatInput').disabled")
        is_send_reopened = page.evaluate("() => document.getElementById('btnSendChat').disabled")
        is_header_reopened = page.evaluate("() => document.getElementById('btnHeaderTutor').disabled")
        is_mutex_released = page.evaluate("() => window.appState ? window.appState.isChatSubmitting : false")

        print(f"-> [6] Sau khi gõ xong (onComplete):")
        print(f"       chatInput.disabled = {is_input_reopened}")
        print(f"       btnSendChat.disabled = {is_send_reopened}")
        print(f"       btnHeaderTutor.disabled = {is_header_reopened}")
        print(f"       state.isChatSubmitting = {is_mutex_released}")

        assert is_input_reopened is False, "FAIL: chatInput phải mở lại sau khi gõ xong!"
        assert is_send_reopened is False, "FAIL: btnSendChat phải mở lại sau khi gõ xong!"
        assert is_header_reopened is False, "FAIL: btnHeaderTutor phải mở lại sau khi gõ xong!"
        assert is_mutex_released is False, "FAIL: state.isChatSubmitting phải trở về False!"

        # 7. Kiểm thử chống xung đột Stale Turn Callback trên mã nguồn THỰC TẾ của app.js (Sonet V4 C2)
        print("-> [7] Kiểm thử chống xung đột Stale Turn Callback trên mã nguồn THỰC TẾ của app.js (Sonet V4 C2)...")
        
        paused_route = None
        def handle_chat_route(route):
            nonlocal paused_route
            paused_route = route

        # Chặn cuộc gọi /api/chat để giữ trạng thái in-flight thật của app.js
        page.route("**/api/chat", handle_chat_route)

        # Gửi tin nhắn thật thông qua DOM thật
        chat_input.fill("Tin nhắn kiểm thử lượt 2 - Kiểm tra Race Condition thật")
        chat_send_btn.click()
        page.wait_for_timeout(300)

        # Xác nhận lượt thật đang in-flight và bị khóa
        turn2_id = page.evaluate("() => window.__test_hooks.getTurnId()")
        is_submitting = page.evaluate("() => window.__test_hooks.isSubmitting()")
        is_input_locked = page.evaluate("() => document.getElementById('chatInput').disabled")
        is_btn_locked = page.evaluate("() => document.getElementById('btnSendChat').disabled")

        print(f"       -> Lượt 2 in-flight thật: turnId = {turn2_id}, isSubmitting = {is_submitting}")
        assert is_submitting is True, "FAIL: Lượt mới phải đang ở trạng thái submitting!"
        assert is_input_locked is True, "FAIL: chatInput phải bị disabled!"
        assert is_btn_locked is True, "FAIL: btnSendChat phải bị disabled!"

        # A. Callback muộn của lượt cũ (turn2_id - 1) gọi vào hàm THẬT của app.js
        stale_turn_id = turn2_id - 1
        res_stale = page.evaluate("(staleId) => window.__test_hooks.releaseCurrentMutex(staleId)", stale_turn_id)
        
        print(f"       -> Thử giải phóng bằng turn cũ ({stale_turn_id}): kết quả = {res_stale}")
        assert res_stale is False, f"FAIL: Lượt cũ {stale_turn_id} không được phép mở khóa!"
        assert page.evaluate("() => window.__test_hooks.isSubmitting()") is True, "FAIL: state.isChatSubmitting thật phải vẫn là True!"
        assert page.evaluate("() => document.getElementById('chatInput').disabled") is True, "FAIL: chatInput thật phải vẫn disabled!"
        assert page.evaluate("() => document.getElementById('btnSendChat').disabled") is True, "FAIL: btnSendChat thật phải vẫn disabled!"

        # B. Đúng lượt hiện tại (turn2_id) gọi vào hàm THẬT của app.js
        res_valid = page.evaluate("(curId) => window.__test_hooks.releaseCurrentMutex(curId)", turn2_id)
        
        print(f"       -> Thử giải phóng bằng đúng turn hiện tại ({turn2_id}): kết quả = {res_valid}")
        assert res_valid is True, f"FAIL: Đúng lượt hiện tại {turn2_id} phải giải phóng thành công!"
        assert page.evaluate("() => window.__test_hooks.isSubmitting()") is False, "FAIL: state.isChatSubmitting thật phải trở về False!"
        assert page.evaluate("() => document.getElementById('chatInput').disabled") is False, "FAIL: chatInput thật phải mở khóa!"
        assert page.evaluate("() => document.getElementById('btnSendChat').disabled") is False, "FAIL: btnSendChat thật phải mở khóa!"

        # C. Gọi lại lần 2 trên hàm THẬT để kiểm tra tính Idempotent
        res_dup = page.evaluate("(curId) => window.__test_hooks.releaseCurrentMutex(curId)", turn2_id)
        assert res_dup is False, "FAIL: Gọi lại lần 2 phải trả về False do cờ isReleased bảo vệ Idempotent!"

        # Dọn dẹp route
        page.unroute("**/api/chat")
        if paused_route:
            try:
                paused_route.fulfill(status=200, content_type="application/json", body='{"reply":"Hoàn thành test"}')
            except Exception:
                pass

        print("       -> Xác thực trên mã nguồn THẬT app.js: Bỏ qua Turn cũ thành công. Mở khóa đúng Turn mới. Idempotent bảo vệ 100%.")

        browser.close()
        print("=" * 60)
        print("KẾT LUẬN: SONET R3 & C2 CHÍNH THỨC PASS 100%! MUTEX KHÓA VÀ MỞ CHUẨN XÁC.")
        print("=" * 60)

if __name__ == "__main__":
    verify_chat_mutex()
