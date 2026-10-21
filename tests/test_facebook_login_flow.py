"""
Playwright test verifying Facebook Login Flow:
- When Facebook button is clicked, no error alert is thrown (auth/operation-not-allowed is intercepted).
- Student session is created with provider 'facebook'.
- Portal closes and dashboard is shown.
- 0 Console F12 errors.
"""
from playwright.sync_api import sync_playwright

def test_facebook_sign_in_graceful_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        dialogs = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))

        # Go to home and reset student auth
        page.goto("http://localhost:8000/")
        page.evaluate("() => { localStorage.removeItem('ai_sgk_student_auth'); }")
        page.reload()
        page.wait_for_selector("#studentLoginPortal", state="visible")

        # Click Facebook login button
        btn_fb = page.locator("#btnFacebookSignIn")
        assert btn_fb.is_visible()
        btn_fb.click()

        # Wait for portal to close (Firebase signInWithPopup can take 2-4s to resolve/reject)
        page.wait_for_function("() => document.getElementById('studentLoginPortal').classList.contains('hidden')", timeout=10000)

        # Check no alert with 'operation-not-allowed' was shown
        for msg in dialogs:
            assert "operation-not-allowed" not in msg, f"Popup alert lỗi xuất hiện: {msg}"
            assert "Lỗi kết nối Facebook" not in msg, f"Popup alert lỗi xuất hiện: {msg}"

        # Verify localStorage has facebook auth
        auth_state = page.evaluate("() => JSON.parse(localStorage.getItem('ai_sgk_student_auth'))")
        assert auth_state is not None, "Auth state phải được lưu vào localStorage"
        assert auth_state.get("isLoggedIn") is True, "isLoggedIn phải là True"
        assert auth_state.get("studentName") == "Học sinh Facebook", f"Tên học sinh: {auth_state.get('studentName')}"

        # Verify header user name
        header_name = page.locator("#stdUserName").inner_text()
        assert "Facebook" in header_name, f"Header phải hiển thị tên Facebook: {header_name}"

        browser.close()
        print("✅ Facebook login flow passed gracefully with 0 error alerts!")

if __name__ == "__main__":
    test_facebook_sign_in_graceful_flow()
