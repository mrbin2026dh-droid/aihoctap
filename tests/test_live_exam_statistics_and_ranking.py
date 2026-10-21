"""
Test E2E Live Kiểm thử Toàn diện: Hệ thống Thống kê, Xếp hạng & Lời khuyên Socrates AI
- Đọc dữ liệu thật 100% từ Firebase Realtime Database
- 4 Thẻ KPI: Đã hoàn thành (%), Điểm TB thi, Thứ hạng lớp (#Rank), Tỷ lệ câu đúng
- Bảng xếp hạng lớp (Podium Top 3 + Bảng chi tiết điểm, thời gian nộp, độ chính xác)
- Lịch sử bài làm & Phân tích AI Socrates (Nhận xét thông minh, Chủ đề cần cải thiện)
- Responsive layout không tràn ngang (Zero-Overflow Law)
"""

import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("APP_URL", "http://127.0.0.1:8000")


def test_live_exam_statistics_and_ranking():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("dialog", lambda dialog: dialog.accept())

        print("\n[BƯỚC 1] Tải ứng dụng và thiết lập học sinh Mr KhangKhoi (có dữ liệu thi thật trên Firebase)...")
        page.goto(BASE_URL, wait_until="networkidle")

        # Thiết lập học sinh thật đã có bài thi trong Firebase: xXIgILG2iOMXEoH0lZ6rf38DYnF2 (Mr KhangKhoi)
        page.evaluate("""() => {
            studentAuthState.isLoggedIn = true;
            studentAuthState.uid = 'xXIgILG2iOMXEoH0lZ6rf38DYnF2';
            studentAuthState.studentName = 'Mr KhangKhoi';
            studentAuthState.studentCode = 'MRHATRONGKHOI.DH';
            studentAuthState.classCode = '9A';
            studentAuthState.grade = 9;
            localStorage.setItem('ai_sgk_student_auth', JSON.stringify(studentAuthState));
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
        }""")

        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=8000)
        page.wait_for_selector("#examStudentGrid .exam-card-item", timeout=10000)

        print("\n[BƯỚC 2] Kiểm tra Dải thẻ KPI Thống kê cá nhân của học sinh...")
        kpi_bar = page.locator("#studentExamKpiBar")
        assert kpi_bar.is_visible(), "Dải thẻ KPI cá nhân #studentExamKpiBar phải hiển thị!"

        # Chờ giá trị KPI nạp xong từ Firebase
        page.wait_for_function("() => document.getElementById('kpiStudentCompletedExams')?.textContent !== '0/0'", timeout=10000)

        completed_val = page.locator("#kpiStudentCompletedExams").text_content()
        avg_score_val = page.locator("#kpiStudentAvgScore").text_content()
        rank_val = page.locator("#kpiStudentClassRank").text_content()
        correct_rate_val = page.locator("#kpiStudentCorrectRate").text_content()

        print(f"  + Số bài đã làm: {completed_val}")
        print(f"  + Điểm TB thi: {avg_score_val}")
        print(f"  + Thứ hạng lớp: {rank_val}")
        print(f"  + Tỷ lệ câu đúng: {correct_rate_val}")

        assert "/" in completed_val and int(completed_val.split("/")[0]) >= 1, f"Số bài đã làm phải là >= 1, nhận được: {completed_val}"
        assert float(avg_score_val) > 0, f"Điểm TB thi phải lớn hơn 0 từ Firebase, nhận được: {avg_score_val}"
        assert "#" in rank_val, f"Thứ hạng lớp phải có định dạng #Rank, nhận được: {rank_val}"

        print("\n[BƯỚC 3] Kiểm tra Thẻ bài thi hiển thị trạng thái '✔ Đã hoàn thành'...")
        completed_badges = page.locator("#examStudentGrid .exam-completed-badge")
        print(f"  + Số thẻ đề thi có badge đã làm: {completed_badges.count()}")
        assert completed_badges.count() >= 1, "Phải có ít nhất 1 đề thi hiển thị badge đã hoàn thành!"

        # Kiểm tra nút Xem lại bài làm
        btn_review = page.locator("#examStudentGrid button:has-text('Xem lại bài làm')").first
        assert btn_review.is_visible(), "Nút 'Xem lại bài làm & Lời khuyên AI' phải hiển thị trên thẻ đề thi đã nộp!"

        print("\n[BƯỚC 4] Bấm 'Xem lại bài làm' -> Mở Sân khấu Kết quả & Lời khuyên AI Socrates...")
        btn_review.click()
        page.wait_for_selector("#examResultView:not(.hidden)", timeout=6000)
        
        result_score = page.locator("#resultScoreNum").text_content()
        print(f"  + Điểm số hiển thị trong kết quả: {result_score}")
        assert float(result_score) > 0, f"Điểm số phải phản ánh điểm thật từ Firebase, nhận được: {result_score}"

        # Bấm quay lại danh sách bài kiểm tra
        page.click("#btnResultBackToList")
        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=6000)

        print("\n[BƯỚC 5] Kiểm tra Chuyển Tab sang Bảng xếp hạng lớp (Class Leaderboard)...")
        tab_leaderboard = page.locator("#tabBtnLeaderboard")
        assert tab_leaderboard.is_visible(), "Nút chuyển Tab Bảng xếp hạng lớp phải hiển thị!"
        tab_leaderboard.click()
        page.wait_for_selector("#tabStudentLeaderboard:not(.hidden)", timeout=6000)

        # Kiểm tra Top 3 Podium
        podium_wrap = page.locator("#leaderboardPodium")
        assert podium_wrap.is_visible(), "Khu vực Bục vinh danh Podium Top 3 phải hiển thị!"
        
        podium_cards = page.locator("#leaderboardPodium .podium-card")
        print(f"  + Số vị trí vinh danh trên Podium: {podium_cards.count()}")
        assert podium_cards.count() >= 1, "Phải có ít nhất 1 vị trí Top được vinh danh trên Podium!"

        # Kiểm tra Bảng xếp hạng chi tiết
        tbody = page.locator("#tableStudentLeaderboard tbody tr")
        print(f"  + Số học sinh trong bảng tổng sắp: {tbody.count()}")
        assert tbody.count() >= 1, "Bảng xếp hạng lớp phải có ít nhất 1 học sinh tham gia!"

        print("\n[BƯỚC 6] Kiểm tra Chuyển Tab sang Lịch sử bài làm & Phân tích AI Socrates...")
        tab_history = page.locator("#tabBtnHistory")
        assert tab_history.is_visible(), "Nút chuyển Tab Lịch sử bài làm phải hiển thị!"
        tab_history.click()
        page.wait_for_selector("#tabStudentExamHistory:not(.hidden)", timeout=6000)

        history_items = page.locator("#studentExamHistoryList .exam-history-item")
        print(f"  + Số bài kiểm tra trong Lịch sử cá nhân: {history_items.count()}")
        assert history_items.count() >= 1, "Lịch sử bài thi phải hiển thị bài đã nộp!"

        # Kiểm tra Lời khuyên Socrates AI
        socrates_box = page.locator("#studentSocratesSummaryBox")
        assert socrates_box.is_visible(), "Khung Lời khuyên sư phạm Socrates AI phải hiển thị!"
        print(f"  + Nội dung lời khuyên AI: {socrates_box.text_content()[:80]}...")

        print("\n[BƯỚC 7] Kiểm tra Bất biến Layout không tràn màn hình (Zero-Overflow Law)...")
        for width in [1920, 1366, 768, 375]:
            page.set_viewport_size({"width": width, "height": 800})
            page.wait_for_timeout(300)
            is_overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
            print(f"  + Viewport {width}px: {'Tràn ngang ❌' if is_overflow else 'Không tràn ✅'}")
            assert not is_overflow, f"Phát hiện tràn ngang (Horizontal Overflow) ở độ rộng {width}px!"

        print("\n[BƯỚC 8] Kiểm tra Console F12...")
        real_errors = [e for e in console_errors if "favicon" not in e and "livereload" not in e]
        print(f"  + Số lỗi Console F12: {len(real_errors)}")
        assert len(real_errors) == 0, f"Console F12 có lỗi: {real_errors}"

        print("\n🎉 KIỂM THỬ THÀNH CÔNG: TÍNH NĂNG THỐNG KÊ & XẾP HẠNG FIREBASE ĐẠT 100%!")
        browser.close()


if __name__ == "__main__":
    test_live_exam_statistics_and_ranking()
