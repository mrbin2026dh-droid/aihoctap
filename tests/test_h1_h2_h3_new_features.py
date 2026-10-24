"""Complete-before-submit guards and the local PDF document viewer."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, teacher_login, assert_no_overflow
from tests.exam_release_helpers import create_exam, start_exam, answer_all, submit_exam


def test_h1_h2_h3_comprehensive(ui_page, live_server, teacher_pin):
    page = ui_page
    create_exam(page, live_server, teacher_pin)
    student_login(page)
    page.locator("#btnNavExamHub").click()
    page.locator("#tabBtnDocuments").click()
    expect(page.locator("#studentDocumentsGrid .doc-card-item").first).to_be_visible()
    page.locator("#studentDocumentsGrid .btn-doc-view").first.click()
    expect(page.locator("#modalPdfViewer")).to_be_visible()
    assert ".pdf" in page.locator("#pdfViewerIframe").get_attribute("src")
    page.keyboard.press("Escape")
    expect(page.locator("#modalPdfViewer")).to_be_hidden()
    page.locator("#tabBtnExamsList").click()
    page.locator("#examStudentGrid .btn-exam-primary").first.click()
    page.locator("#btnTakingNextQ").click()
    expect(page.locator("#examToastAlert")).to_contain_text("chọn đáp án")
    expect(page.locator("#takingQCurrentIndex")).to_contain_text("Câu 1")
    page.locator(".taking-opt-card").first.click()
    dialogs = []
    page.once("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    page.locator("#btnTakingSubmitExam").click()
    expect(page.locator("#examTakingView")).to_be_visible()
    expect(page.locator("#examToastAlert")).to_contain_text("chưa làm hết")
    assert dialogs
    answer_all(page)
    submit_exam(page)
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.reload()
    teacher_login(page, teacher_pin)
    page.locator("#btnNavExamHub").click()
    page.locator("#btnTeacherOpenUploadDoc").click()
    expect(page.locator("#modalTeacherUploadDoc")).to_be_visible()
    page.locator("#inputDocTitle").fill("Đề cương Tin học 9")
    page.keyboard.press("Escape")
    expect(page.locator("#modalTeacherUploadDoc")).to_be_hidden()
    assert_no_overflow(page)
