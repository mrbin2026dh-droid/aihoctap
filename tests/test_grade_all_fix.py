"""A restored legacy all-grade profile cannot generate invalid API requests."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, show_lesson


def test_grade_all_fix(ui_page, live_server, teacher_pin):
    page = ui_page
    errors = []
    page.on("response", lambda r: errors.append(r.url) if r.status in (404,422,500) else None)
    teacher_login(page, teacher_pin)
    page.evaluate("""() => {const auth=JSON.parse(localStorage.getItem('ai_sgk_student_auth'));auth.grade='all';localStorage.setItem('ai_sgk_student_auth',JSON.stringify(auth));}""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("window.appState && typeof switchGrade === 'function'")
    show_lesson(page)
    page.evaluate("switchGrade('all')")
    assert page.evaluate("Number.isInteger(appState.grade) && appState.grade >= 6 && appState.grade <= 9")
    expect(page.locator("#theoryContent")).not_to_be_empty()
    response=page.context.request.post(live_server+'/api/chat',data={"grade":page.evaluate('appState.grade'),"lesson_id":1,"message":"Gợi ý bài học","history":[]})
    assert response.status == 200
    assert not errors, errors
    assert not page.page_errors
