import os
import sys
import json
import time

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from playwright.sync_api import sync_playwright

def test_desktop_layout_and_profile_sync():
    print("=== STARTING PLAYWRIGHT AUTOMATED TEST ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        
        # Pre-seed localStorage with logged in student in class 9A
        auth_data = {
            "isLoggedIn": True,
            "uid": "std_e2e_desktop_01",
            "studentName": "Trần Văn An",
            "studentEmail": "an.tran@thcs.edu.vn",
            "studentCode": "HS009",
            "classCode": "9A",
            "grade": 9,
            "isBlocked": False
        }
        init_script = f"""
            localStorage.setItem('ai_sgk_student_auth', JSON.stringify({json.dumps(auth_data)}));
        """
        context.add_init_script(init_script)

        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda resp: print(f"HTTP {resp.status}: {resp.url}") if resp.status >= 400 else None)

        # 1. Open app on localhost:8000/
        page.goto("http://localhost:8000/")
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # 2. Click exam hub on header
        print("Clicking #btnNavExamHub...")
        page.locator("#btnNavExamHub").click()
        page.wait_for_selector("#studentExamClassPill", state="visible", timeout=10000)
        time.sleep(1)

        # 3. Check studentExamClassPill text
        pill_text = page.locator("#studentExamClassPill").inner_text()
        print(f"Pill text: '{pill_text}'")
        assert "9A" in pill_text, f"Expected 9A in pill text, got '{pill_text}'"

        # 4. Verify Desktop Exam Card Layout
        cards = page.locator(".exam-card-item")
        card_count = cards.count()
        print(f"Rendered student exam cards: {card_count}")
        if card_count > 0:
            first_card = cards.first
            # Check card tag
            tag_text = first_card.locator(".exam-card-tag").inner_text()
            print(f"Exam card tag: '{tag_text}'")
            assert "Khối" in tag_text, f"Expected 'Khối' in tag text, got '{tag_text}'"

            # Check card width on desktop
            box = first_card.bounding_box()
            print(f"First card width: {box['width']}px, height: {box['height']}px")
            assert box["width"] >= 340, f"Card should be at least 340px on desktop, got {box['width']}"

            # Check action buttons layout
            review_btn = first_card.locator(".btn-exam-review")
            if review_btn.count() > 0:
                rev_text = review_btn.inner_text().strip()
                print(f"Review button text: '{rev_text}'")
                assert "Xem lại bài làm" in rev_text
                assert len(rev_text) < 30, f"Review button text is too long: '{rev_text}'"

        # 5. Check zero horizontal scroll overflow on 1440px desktop
        is_overflowing = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
        print(f"Desktop horizontal overflow: {is_overflowing}")
        assert not is_overflowing, "Page has horizontal scroll overflow on desktop!"

        # 6. Test User Dropdown & Open Edit Profile Modal
        user_badge = page.locator("#stdUserBadge")
        user_badge.click()
        time.sleep(0.4)

        btn_open_profile = page.locator("#btnStdOpenEditProfile")
        assert btn_open_profile.is_visible(), "Edit profile button in dropdown must be visible"
        btn_open_profile.click()
        time.sleep(0.5)

        # 7. Verify Modal is Open and Fields are populated
        assert not page.locator("#modalStudentEditProfile").evaluate("el => el.classList.contains('hidden')"), "Modal should not be hidden"

        name_val = page.locator("#inputEditStudentName").input_value()
        grade_val = page.locator("#inputEditStudentGrade").input_value()
        class_val = page.locator("#inputEditStudentClass").input_value()
        print(f"Modal initial values - Name: '{name_val}', Grade: '{grade_val}', Class: '{class_val}'")
        assert name_val == "Trần Văn An"
        assert grade_val == "9"
        assert class_val == "9A"

        # 8. Modify Name, Grade, and Class (e.g. to Khối 8, Lớp 8B)
        page.locator("#inputEditStudentName").fill("Nguyễn Hoàng Nam")
        page.locator("#inputEditStudentGrade").select_option("8")
        page.locator("#inputEditStudentClass").fill("8B")

        # 9. Click Save Changes
        page.locator("#btnSaveEditProfile").click()
        time.sleep(1.2)

        # 10. Verify Modal Closed & LocalStorage Updated
        saved_auth = page.evaluate("() => JSON.parse(localStorage.getItem('ai_sgk_student_auth'))")
        print(f"Saved auth state: {saved_auth}")
        assert saved_auth["studentName"] == "Nguyễn Hoàng Nam", f"Expected new name, got {saved_auth['studentName']}"
        assert saved_auth["classCode"] == "8B", f"Expected classCode 8B, got {saved_auth['classCode']}"
        assert saved_auth["grade"] == 8, f"Expected grade 8, got {saved_auth['grade']}"

        # 11. Verify UI Updated with Real Information (NOT hardcoded 9A)
        new_pill_text = page.locator("#studentExamClassPill").inner_text()
        print(f"Updated pill text: '{new_pill_text}'")
        assert "8B" in new_pill_text, f"Expected 8B in pill, got '{new_pill_text}'"
        assert "Khối 8" in new_pill_text, f"Expected Khối 8 in pill, got '{new_pill_text}'"

        # Check role in dropdown/badge
        std_role = page.locator("#stdUserRole").inner_text()
        print(f"User role text: '{std_role}'")
        assert "8B" in std_role, f"Expected 8B in role, got '{std_role}'"

        # Check dropdown email text
        dd_email = page.locator("#stdDropdownEmail").inner_text()
        print(f"Dropdown email text: '{dd_email}'")
        assert "8B" in dd_email, f"Expected 8B in dropdown email, got '{dd_email}'"

        # 12. Verify 0 Console F12 Errors
        filtered_errors = [e for e in console_errors if not "favicon" in e.lower()]
        print(f"Console errors count: {len(filtered_errors)}")
        if filtered_errors:
            print("Errors:", filtered_errors)
        assert len(filtered_errors) == 0, f"Found console errors: {filtered_errors}"

        browser.close()
        print("=== TEST PASSED 100% WITH ZERO ERRORS ===")

if __name__ == "__main__":
    test_desktop_layout_and_profile_sync()
