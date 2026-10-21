"""
Test suite verifying:
- H1: Facebook login button, removed class input from Google tab, terms centered.
- H2: Tab 2 renamed to 'Mã HS', removed class/device code inputs, single 6-digit passcode input, button '🚀 Vào học', no long LAN disclaimer.
- H3: Teacher student edit modal: label 'Mã học sinh (6 chữ số) *' with 🎲 random generator button.
- 0 Console F12 errors.
"""
import pytest
from playwright.sync_api import sync_playwright

def test_auth_redesign_h1_h2_h3():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("dialog", lambda dialog: dialog.accept())

        # 1. Clear student auth from localStorage first
        page.goto("http://localhost:8000/")
        page.evaluate("() => { localStorage.removeItem('ai_sgk_student_auth'); }")
        page.reload()
        page.wait_for_selector("#studentLoginPortal", state="attached")

        # Ensure modal is visible
        is_portal_visible = page.is_visible("#studentLoginPortal")
        assert is_portal_visible, "Cổng đăng nhập phải hiển thị khi chưa có tài khoản lưu"

        # =====================================================================
        # H1: Google / Social Login Panel
        # =====================================================================
        # Verify Facebook button exists
        btn_fb = page.locator("#btnFacebookSignIn")
        assert btn_fb.count() == 1, "Nút Facebook Login (#btnFacebookSignIn) phải tồn tại"
        assert "Facebook" in btn_fb.inner_text(), "Nút Facebook phải có chữ Tiếp tục với Facebook"
        
        # Verify sl-facebook-svg exists inside
        fb_svg = page.locator("#btnFacebookSignIn svg")
        assert fb_svg.count() == 1, "Nút Facebook phải chứa icon SVG"

        # Verify class input was REMOVED from Google panel
        class_input = page.locator("#slPanelStudent #slInputGoogleClass, #slPanelStudent #slInputClassCode")
        assert class_input.count() == 0, "Ô nhập lớp học trong tab Google/Facebook phải được xóa bỏ"

        # Verify terms checkbox is centered
        chk_wrap = page.locator("#slPanelStudent .sl-checkbox-row")
        assert chk_wrap.count() == 1, "Checkbox điều khoản phải tồn tại"
        chk_align = page.evaluate("() => window.getComputedStyle(document.querySelector('#slPanelStudent .sl-checkbox-row')).justifyContent")
        assert chk_align == "center", f"Checkbox điều khoản phải căn giữa (justify-content: center), nhận được: {chk_align}"

        # =====================================================================
        # H2: Tab 2 (Mã HS 6 chữ số)
        # =====================================================================
        # Verify Tab 2 title is 'Mã HS' (not 'Mã HS (LAN)')
        tab_lan = page.locator("#slTabLanStudent")
        assert tab_lan.count() == 1, "Tab 2 phải tồn tại"
        tab_text = tab_lan.inner_text()
        assert "Mã HS" in tab_text and "LAN" not in tab_text, f"Tên Tab 2 phải là 'Mã HS' (không có chữ LAN), nhận được: '{tab_text}'"

        # Click Tab 2
        tab_lan.click()
        page.wait_for_timeout(300)

        # Verify old inputs (class, machine/student code) are REMOVED from Tab 2
        old_lan_class = page.locator("#slPanelLanStudent #slInputLanClass")
        assert old_lan_class.count() == 0, "Ô nhập lớp học trong Tab 2 phải được xóa bỏ"
        old_lan_code = page.locator("#slPanelLanStudent #slInputLanStudentCode")
        assert old_lan_code.count() == 0, "Ô nhập 'Mã học sinh / Số máy' trong Tab 2 phải được xóa bỏ"

        # Verify 6-digit passcode input exists
        input_passcode = page.locator("#slInputStudentPasscode")
        assert input_passcode.count() == 1, "Ô nhập Mã HS 6 chữ số (#slInputStudentPasscode) phải tồn tại"
        max_length = input_passcode.get_attribute("maxlength")
        assert max_length == "6", f"Mã HS phải có maxlength='6', nhận được: {max_length}"

        # Verify button text is '🚀 Vào học'
        btn_login = page.locator("#slBtnLanLogin")
        assert btn_login.count() == 1, "Nút đăng nhập Tab 2 phải tồn tại"
        assert "Vào học" in btn_login.inner_text(), "Nút đăng nhập Tab 2 phải có chữ 'Vào học'"

        # Verify disclaimer text about LAN without internet is REMOVED
        panel_text = page.locator("#slPanelLanStudent").inner_text()
        assert "không có kết nối Google" not in panel_text, "Đoạn chú thích LAN không kết nối Google phải được bỏ"

        # Test validation: empty passcode
        btn_login.click()
        msg_el = page.locator("#slLanAuthMsg")
        assert msg_el.is_visible(), "Thông báo lỗi phải hiển thị khi bỏ trống mã"
        assert "Vui lòng nhập Mã học sinh" in msg_el.inner_text()

        # Test validation: < 6 digits
        input_passcode.fill("123")
        btn_login.click()
        assert "đúng 6 chữ số" in msg_el.inner_text()

        # Test valid 6-digit login
        input_passcode.fill("654321")
        btn_login.click()
        page.wait_for_timeout(1000)

        # Modal should be closed now
        assert page.evaluate("() => document.getElementById('studentLoginPortal').classList.contains('hidden')"), "Cổng đăng nhập phải đóng sau khi đăng nhập thành công"

        # Check student header UI shows code or student name
        header_name = page.locator("#stdUserName").inner_text()
        assert "654321" in header_name or "Học sinh" in header_name, f"Header học sinh phải hiển thị mã hoặc tên: {header_name}"

        # =====================================================================
        # H3: Teacher Student Edit Modal (Mã HS 6 số & nút 🎲)
        # =====================================================================
        # Switch to teacher view
        page.evaluate("() => { state.teacherUnlocked = true; state.teacherToken = 'test_token'; if (typeof openStudentManagementStage === 'function') openStudentManagementStage(); }")
        page.wait_for_timeout(500)

        # Open edit modal
        page.evaluate("() => { if (typeof openEditStudentModal === 'function') openEditStudentModal({ uid: 'std_test', student_code: '112233', full_name: 'Test Student', grade: 9, class_code: '9A' }); }")
        page.wait_for_timeout(500)

        # Verify modal is visible
        modal_edit = page.locator("#smEditStudentModal")
        assert modal_edit.is_visible(), "Modal chỉnh sửa học sinh phải hiển thị"

        # Verify dice button exists
        btn_dice = page.locator("#btnGenEditCode")
        assert btn_dice.count() == 1, "Nút 🎲 (#btnGenEditCode) phải tồn tại"
        
        # Click dice button and verify 6-digit code is generated
        btn_dice.click()
        new_val = page.locator("#smEditStudentCode").input_value()
        assert len(new_val) == 6 and new_val.isdigit(), f"Nút 🎲 phải sinh mã gồm đúng 6 chữ số, nhận được: {new_val}"

        # =====================================================================
        # Viewport Zero-Overflow Verification (1920, 1366, 768, 375)
        # =====================================================================
        for width, height in [(1920, 1080), (1366, 768), (768, 1024), (375, 667)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)
            overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
            assert not overflow, f"Bẫy tràn ngang phát hiện tại độ phân giải {width}x{height}!"

        # =====================================================================
        # Console Error Check
        # =====================================================================
        # Filter out expected harmless external network warnings if any
        critical_errors = [e for e in console_errors if not ("favicon" in e or "Failed to load resource" in e)]
        assert len(critical_errors) == 0, f"Phát hiện lỗi Console F12: {critical_errors}"

        browser.close()
        print("✅ ALL TESTS PASSED: H1, H2, H3 and 0 Console Errors verified!")

if __name__ == "__main__":
    test_auth_redesign_h1_h2_h3()
