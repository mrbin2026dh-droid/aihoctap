"""Exam fixtures created through authenticated HTTP, with no school data writes."""
from playwright.sync_api import expect


def teacher_headers(page, base_url, pin):
    response = page.request.post(f"{base_url}/api/teacher/auth", data={"pin": pin})
    assert response.ok, response.text()
    return {"Authorization": "Bearer " + response.json()["token"]}


def create_exam(page, base_url, pin, exam_id="exam_release", grade=9, status="published"):
    payload = {"exam_id": exam_id, "title": "Đề kiểm tra độc lập lớp " + str(grade),
               "grade": grade, "target_classes": [str(grade) + "A"],
               "duration_minutes": 15, "status": status,
               "questions": [{"id": "q" + str(i), "cau_hoi": "Thiết bị nào có gắn bộ xử lí?",
                              "lua_chon": {"A": "Máy tính", "B": "Quyển vở", "C": "Bút chì", "D": "Thước kẻ"},
                              "dap_an_dung": "A", "muc_sgk": "Bài 1: Thiết bị có gắn bộ xử lí",
                              "giai_thich_su_pham": "Máy tính có bộ xử lí."} for i in range(1, 4)]}
    response = page.request.post(f"{base_url}/api/teacher/exams/create", data=payload,
                                 headers=teacher_headers(page, base_url, pin))
    assert response.ok, response.text()
    return payload


def open_hub(page):
    if "open" in (page.locator("#socratesPopupCard").get_attribute("class") or ""):
        page.locator("#btnClosePopup").click()
    page.locator("#btnNavExamHub").click()


def start_exam(page):
    open_hub(page)
    page.locator("#examStudentGrid .btn-exam-primary").first.click()
    expect(page.locator("#examTakingView")).to_be_visible()


def answer_all(page, option=0):
    count = page.locator("#takingPaletteContainer .palette-q-btn").count()
    # Drive each question with the same controls used by students.
    for index in range(count):
        page.locator("#takingOptionsContainer .taking-opt-card").nth(option).click()
        if index < count - 1:
            page.locator("#btnTakingNextQ").click()
    expect(page.locator("#takingAnsweredCount")).to_contain_text(str(count) + "/" + str(count))


def submit_exam(page):
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#btnTakingSubmitExam").click()
    expect(page.locator("#examResultView")).to_be_visible()
