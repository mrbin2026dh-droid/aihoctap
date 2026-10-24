"""Reload clears legacy result caches once, preserving learning and future attempts."""
from playwright.sync_api import expect


def test_exam_result_reset_is_once_only_in_real_browser(ui_page):
    page = ui_page
    page.evaluate("""() => {
      localStorage.removeItem('ai_sgk_exam_results_cleanup');
      localStorage.setItem('AISGK_SUBMISSIONS', '[{"exam_id":"old_test"}]');
      localStorage.setItem('aisgk_offline_submissions', '[{"exam_id":"old_pending"}]');
      localStorage.setItem('ai_sgk_student_auth', JSON.stringify({isLoggedIn:false,grade:9,uid:'cleanup_fixture'}));
      localStorage.setItem('ai_sgk_student_progress_cleanup_fixture_g9', 'preserved-learning');
      localStorage.setItem('AISGK_CUSTOM_EXAMS', '[]');
    }""")
    profile = page.evaluate("localStorage.getItem('ai_sgk_student_auth')")
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#studentLoginPortal')).to_be_visible()
    assert page.evaluate("localStorage.getItem('AISGK_SUBMISSIONS')") is None
    assert page.evaluate("localStorage.getItem('aisgk_offline_submissions')") is None
    assert page.evaluate("localStorage.getItem('ai_sgk_student_auth')") == profile
    assert page.evaluate("localStorage.getItem('ai_sgk_student_progress_cleanup_fixture_g9')") == 'preserved-learning'
    assert page.evaluate("localStorage.getItem('AISGK_CUSTOM_EXAMS')") == '[]'
    page.evaluate("localStorage.setItem('AISGK_SUBMISSIONS','[{\"exam_id\":\"new_exam\"}]')")
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#studentLoginPortal')).to_be_visible()
    assert page.evaluate("JSON.parse(localStorage.getItem('AISGK_SUBMISSIONS'))[0].exam_id") == 'new_exam'
    assert not page.page_errors
