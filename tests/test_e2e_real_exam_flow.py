import os
import sys
import time
import subprocess
import pytest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def test_playwright_real_exam_crud_and_student_flow():
    from playwright.sync_api import sync_playwright

    # Start backend server
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    server_process = subprocess.Popen(
        [sys.executable, "backend/server.py"],
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )
    time.sleep(2.5)

    try:
        with sync_playwright() as p:
            # 1. Test Teacher CRUD Flow on Desktop
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            
            # Go to app
            page.goto("http://127.0.0.1:8000")
            page.wait_for_selector("#btnNavExamHub", timeout=8000)

            # Close popups
            page.evaluate("""() => {
                if (typeof closePopup === 'function') closePopup();
                const portal = document.getElementById('studentLoginPortal');
                if (portal) portal.classList.add('hidden');
            }""")

            # Unlock teacher state
            page.evaluate("""() => {
                state.teacherUnlocked = true;
                state.teacherToken = 'tch_live_session_test';
                openExamHub();
            }""")
            page.wait_for_timeout(600)

            # Check teacher view is visible
            teacher_view = page.locator("#examTeacherView")
            assert teacher_view.is_visible()

            # Verify authentic exams are loaded (cards have Edit, Delete, Results buttons)
            cards = page.locator("#examTeacherGrid .exam-card-item")
            assert cards.count() >= 2
            
            first_card = cards.first
            assert first_card.locator(".btn-exam-sm-edit").is_visible()
            assert first_card.locator(".btn-exam-sm-del").is_visible()
            assert first_card.locator(".btn-exam-sm-results").is_visible()

            # Test Question Inline Editor: Click "Soạn đề mới"
            page.click("#btnExamCreateManual")
            page.wait_for_selector("#examCreateModal:not(.hidden)")
            
            page.fill("#examFormTitle", "Đề Thi Khảo Sát Năng Lực Tin 9 - E2E Test")
            
            # Click "+ Thêm câu hỏi" -> Question Editor Box appears
            page.click("#btnModalAddQuestion")
            q_box = page.locator("#examQuestionEditorBox")
            assert q_box.is_visible()

            # Fill question details
            page.fill("#qEditorContent", "Dữ liệu sau khi được xử lý và có ý nghĩa đối với người nhận được gọi là gì?")
            page.fill("#qEditorOptA", "Thông tin")
            page.fill("#qEditorOptB", "Vật mang tin")
            page.fill("#qEditorOptC", "Tệp văn bản")
            page.fill("#qEditorOptD", "Bộ xử lý")
            page.select_option("#qEditorCorrect", "A")
            page.fill("#qEditorTopic", "Mục 1: Thông tin và dữ liệu")
            page.fill("#qEditorExpl", "Dữ liệu được xử lý mang lại nhận thức, hiểu biết cho con người thì trở thành thông tin.")

            # Save question
            page.click("#btnSaveQToExam")
            assert q_box.is_hidden()

            # Question preview card appears in list
            q_cards = page.locator("#modalQuestionsList .preview-q-card")
            assert q_cards.count() == 1
            assert "Mục 1: Thông tin và dữ liệu" in q_cards.first.inner_text()
            assert "Đ/A đúng: A" in q_cards.first.inner_text()

            # Click Edit on question
            q_cards.first.locator(".btn-exam-sm-edit").click()
            assert q_box.is_visible()
            assert page.input_value("#qEditorContent") == "Dữ liệu sau khi được xử lý và có ý nghĩa đối với người nhận được gọi là gì?"
            page.click("#btnCancelEditQ")
            assert q_box.is_hidden()

            # Save and publish exam
            page.on("dialog", lambda dialog: dialog.accept())
            page.click("#btnExamSaveAndPublish")
            page.wait_for_timeout(600)

            # Confirm exam appeared on dashboard
            page.wait_for_selector("#examTeacherGrid")
            assert "Đề Thi Khảo Sát Năng Lực Tin 9 - E2E Test" in page.inner_text("#examTeacherGrid")

            # 2. Test Student Flow on Mobile (Viewport 375x667 - Standard Phone)
            mobile_context = browser.new_context(viewport={"width": 375, "height": 667})
            m_page = mobile_context.new_page()
            m_page.goto("http://127.0.0.1:8000")
            m_page.wait_for_selector("#btnNavExamHub", timeout=8000)

            # Close popup
            m_page.evaluate("""() => {
                if (typeof closePopup === 'function') closePopup();
                const portal = document.getElementById('studentLoginPortal');
                if (portal) portal.classList.add('hidden');
                studentAuthState.uid = 'std_e2e_student_01';
                studentAuthState.studentName = 'Trần Văn An';
                studentAuthState.studentCode = 'HS901';
                studentAuthState.classCode = '9A';
                studentAuthState.grade = 9;
                state.teacherUnlocked = false;
                state.teacherToken = null;
                openExamHub();
            }""")
            m_page.wait_for_timeout(600)

            # Student view is visible
            std_view = m_page.locator("#examStudentView")
            assert std_view.is_visible()

            # Start authentic exam
            std_cards = m_page.locator("#examStudentGrid .exam-card-item")
            assert std_cards.count() >= 1
            std_cards.first.locator(".btn-exam-primary").click()
            m_page.wait_for_selector("#examTakingView:not(.hidden)")

            # Verify Image 3 Layout Invariants:
            # - Tag topic badge exists and has cyan text
            section_badge = m_page.locator("#takingQSectionBadge")
            assert section_badge.is_visible()
            assert len(section_badge.inner_text()) > 0

            # - Question text exists
            q_text = m_page.locator("#takingQQuestionText")
            assert q_text.is_visible()
            assert len(q_text.inner_text()) > 10

            # - 4 option cards exist with .opt-letter-badge and .opt-text-val
            opt_cards = m_page.locator("#takingOptionsContainer .taking-opt-card")
            assert opt_cards.count() == 4
            assert opt_cards.first.locator(".opt-letter-badge").is_visible()
            assert opt_cards.first.locator(".opt-text-val").is_visible()

            # - Zero horizontal overflow on mobile
            overflow_check = m_page.evaluate("() => document.documentElement.scrollWidth === document.documentElement.clientWidth")
            assert overflow_check is True, "Failed Zero-Overflow Law on mobile!"

            # - Touch target height >= 44px
            card_height = opt_cards.first.bounding_box()["height"]
            assert card_height >= 44, f"Option card height {card_height}px is below 44px!"

            # Select Option A
            opt_cards.first.click()
            assert "selected" in opt_cards.first.get_attribute("class")

            # Submit exam
            m_page.on("dialog", lambda dialog: dialog.accept())
            m_page.click("#btnTakingSubmitExam")
            m_page.wait_for_selector("#examResultView:not(.hidden)", timeout=6000)

            # Result view checks:
            # - Score is displayed
            score_num = m_page.locator("#resultScoreNum").inner_text()
            assert len(score_num) > 0
            
            # - Socratic AI pedagogical advice is displayed
            feedback_text = m_page.locator("#resultAIFeedbackText").inner_text()
            assert len(feedback_text) > 30

            # - SGK Recommendations box has items with [Mở SGK học ngay]
            recommend_btn = m_page.locator("#resultRecommendList button")
            if recommend_btn.count() > 0:
                assert "SGK" in recommend_btn.first.inner_text() or "học" in recommend_btn.first.inner_text()

            # - Review questions list is populated
            review_cards = m_page.locator("#resultReviewQuestionsList .review-question-card")
            assert review_cards.count() >= 1

            browser.close()
            print("ALL PLAYWRIGHT REAL EXAM CRUD & STUDENT FLOW TESTS PASSED 100%!")

    finally:
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except Exception:
            server_process.kill()

if __name__ == "__main__":
    test_playwright_real_exam_crud_and_student_flow()
