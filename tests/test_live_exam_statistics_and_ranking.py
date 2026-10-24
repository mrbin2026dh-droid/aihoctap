"""Exam completion, ranking and history derive from an actual submitted attempt."""
from playwright.sync_api import expect
from tests.ui_release_helpers import student_login, assert_no_overflow
from tests.exam_release_helpers import create_exam, start_exam, answer_all, submit_exam


def test_live_exam_statistics_and_ranking(ui_page, live_server, teacher_pin):
    page = ui_page
    exam = create_exam(page, live_server, teacher_pin)
    student_login(page)
    start_exam(page)
    answer_all(page)
    submit_exam(page)
    page.locator("#btnResultBackToList").click()
    expect(page.locator("#kpiStudentCompletedExams")).to_have_text("1/1")
    assert float(page.locator("#kpiStudentAvgScore").inner_text()) == 10
    expect(page.locator("#kpiStudentClassRank")).to_have_text("#--")
    expect(page.locator("#kpiStudentTotalInClass")).to_contain_text("Chưa đủ dữ liệu xếp hạng")
    expect(page.locator("#examStudentGrid .exam-completed-badge")).to_have_count(1)
    page.locator("#examStudentGrid .btn-exam-review").click()
    expect(page.locator("#examResultView")).to_be_visible()
    expect(page.locator("#resultScoreNum")).to_have_text("10.0")
    page.locator("#btnResultBackToList").click()
    page.locator("#tabBtnLeaderboard").click()
    expect(page.locator("#tabStudentLeaderboard")).to_be_visible()
    expect(page.locator("#leaderboardPodium .podium-card")).to_have_count(0)
    expect(page.locator("#tableStudentLeaderboard tbody")).to_contain_text("Chưa có dữ liệu xếp hạng")
    page.locator("#tabBtnHistory").click()
    expect(page.locator("#studentExamHistoryList .exam-history-item")).to_have_count(1)
    expect(page.locator("#studentExamHistoryList")).to_contain_text(exam["title"])
    expect(page.locator("#studentSocratesSummaryBox")).to_be_visible()
    assert_no_overflow(page)
    assert not page.page_errors
