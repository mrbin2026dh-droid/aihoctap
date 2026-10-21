import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_live_exam_socrates_firebase():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("dialog", lambda dialog: dialog.accept())

        print("\n[BƯỚC 1] Tải trang chủ ứng dụng...")
        page.goto(BASE_URL, wait_until="networkidle")

        # 1. Kiểm tra escapeHtml(0)
        esc_test = page.evaluate("() => ({ zero: escapeHtml(0), str0: escapeHtml('0'), empty: escapeHtml(''), undef: escapeHtml(undefined) })")
        print("Kiểm tra escapeHtml:", esc_test)
        assert esc_test["zero"] == "0", "escapeHtml(0) must return '0', not empty string!"
        assert esc_test["str0"] == "0", "escapeHtml('0') must return '0'"
        assert esc_test["empty"] == "", "escapeHtml('') must return ''"
        assert esc_test["undef"] == "", "escapeHtml(undefined) must return ''"

        # 2. Kiểm tra getTeacherExamsForGrade (Lấy đúng tiêu đề do giáo viên tạo, cấm Hardcode)
        exams_g9 = page.evaluate("async () => await getTeacherExamsForGrade(9)")
        print(f"Bài kiểm tra Lớp 9 do GV tạo ({len(exams_g9)} bài):", [e.get("title") for e in exams_g9])
        assert len(exams_g9) >= 1, "Phải lấy được các bài kiểm tra do giáo viên tạo!"
        assert all(len(e.get("title", "").strip()) > 0 for e in exams_g9), "Mỗi bài kiểm tra phải có tiêu đề do GV tạo!"

        exams_g6 = page.evaluate("async () => await getTeacherExamsForGrade(6)")
        print(f"Bài kiểm tra Lớp 6 do GV tạo ({len(exams_g6)} bài):", [e.get("title") for e in exams_g6])
        assert len(exams_g6) >= 1, "Phải lấy được các bài kiểm tra Khối 6 do GV tạo!"

        # 3. Mở Trung tâm Bài kiểm tra (Exam Hub) với tư cách Học sinh
        print("\n[BƯỚC 2] Mở Trung tâm bài kiểm tra học sinh...")
        page.evaluate("""() => {
            studentAuthState.isLoggedIn = true;
            studentAuthState.uid = 'std_e2e_student_01';
            studentAuthState.studentName = 'Trần Văn An';
            studentAuthState.studentCode = 'HS9A99';
            studentAuthState.classCode = '9A';
            studentAuthState.grade = 9;
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
        }""")
        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=6000)
        page.wait_for_selector("#examStudentGrid .exam-card-item", timeout=10000)

        # Kiểm tra danh sách bài kiểm tra học sinh
        student_cards = page.locator("#examStudentGrid .exam-card-item")
        print("Số bài kiểm tra hiển thị cho học sinh:", student_cards.count())
        assert student_cards.count() >= 1, "Phải có ít nhất 1 bài kiểm tra hiển thị cho học sinh!"

        # 4. Học sinh nhấn "Vào làm bài ngay"
        print("\n[BƯỚC 3] Học sinh vào làm bài thi...")
        first_start_btn = student_cards.first.locator("button.btn-exam-primary")
        first_start_btn.click()
        page.wait_for_selector("#examTakingView:not(.hidden)", timeout=6000)

        # Trả lời câu 1 (chọn sai hoặc đúng)
        page.wait_for_selector(".taking-opt-card", timeout=8000)
        options = page.locator(".taking-opt-card")
        if options.count() > 0:
            options.first.click()

        # Nộp bài
        print("\n[BƯỚC 4] Nộp bài và kích hoạt Gia sư AI Socrates...")
        page.click("#btnTakingSubmitExam")
        page.wait_for_selector("#examResultView:not(.hidden)", timeout=8000)

        # 5. Xác minh Giao diện Kết quả Học sinh
        score_num = page.inner_text("#resultScoreNum").strip()
        correct_count = page.inner_text("#resultCorrectCount").strip()
        percent_ratio = page.inner_text("#resultPercentRatio").strip()
        ai_feedback = page.inner_text("#resultAIFeedbackText").strip()

        print(f"Điểm số: {score_num} | Số câu đúng: {correct_count} | Tỷ lệ: {percent_ratio}")
        print("Nhận xét AI Socrates:", ai_feedback[:120], "...")

        assert score_num != "", "Điểm số không được rỗng!"
        assert "/" in correct_count and not correct_count.startswith("✔ /"), f"Số câu đúng không được thiếu số trước dấu gạch chéo: {correct_count}"
        assert "%" in percent_ratio, "Phải có tỷ lệ %"

        # Kiểm tra banner thông báo
        alert_text = page.inner_text("#examSuccessAlert").strip()
        print("Banner thông báo:", alert_text)
        assert "Đã nộp bài thành công" in alert_text, "Phải có thông báo nộp bài thành công!"

        # Kiểm tra đề xuất SGK
        recommend_items = page.locator("#resultRecommendList .recommendation-item")
        rec_count = recommend_items.count()
        print(f"Số lượng đề xuất ôn tập SGK: {rec_count}")
        if float(score_num) < 9.0:
            # Không được xuất hiện dòng chúc mừng vô lý khi điểm thấp
            rec_html = page.inner_html("#resultRecommendList")
            assert "Em đã làm rất tốt, không có chủ đề nào cần phải ôn lại gấp" not in rec_html, "Không được xuất hiện lời chúc mừng sai khi điểm thấp!"
            assert rec_count >= 1, "Điểm dưới 9 phải có ít nhất 1 mục đề xuất ôn lại!"
            # Kiểm tra nút Mở SGK
            sgk_btn = recommend_items.first.locator("button")
            assert sgk_btn.is_visible(), "Phải có nút Mở SGK học ngay!"

        # 6. Đăng nhập Giáo viên và kiểm tra Bảng Điểm & Thống kê
        print("\n[BƯỚC 5] Đăng nhập chế độ Giáo viên...")
        page.evaluate("""() => {
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_9a';
            openExamHub();
        }""")
        page.wait_for_selector("#examTeacherView:not(.hidden)", timeout=6000)
        page.wait_for_selector("#examTeacherGrid .exam-card-item", timeout=10000)

        teacher_cards = page.locator("#examTeacherGrid .exam-card-item")
        print(f"Số bài kiểm tra trong phân hệ giáo viên: {teacher_cards.count()}")
        assert teacher_cards.count() >= 1

        # Mở Bảng điểm của bài kiểm tra đầu tiên
        print("\n[BƯỚC 6] Mở Bảng Điểm kiểm tra của Giáo viên...")
        btn_results = teacher_cards.first.locator(".btn-exam-sm-results")
        btn_results_text = btn_results.inner_text().strip()
        print(f"Nút bảng điểm: '{btn_results_text}'")
        assert "Bảng điểm ()" not in btn_results_text, "Nút bảng điểm không được bị rỗng số!"

        btn_results.click()
        page.wait_for_selector("#examTeacherResultsModal:not(.hidden)", timeout=6000)
        page.wait_for_selector("#teacherResultsTableBody tr td strong", timeout=10000)

        # Kiểm tra 4 thẻ thống kê
        total_sub = page.inner_text("#statTotalSubmissions").strip()
        avg_score = page.inner_text("#statAvgScore").strip()
        pass_rate = page.inner_text("#statPassRate").strip()
        max_score = page.inner_text("#statMaxScore").strip()
        print(f"Thống kê tổng hợp: Số bài={total_sub}, Điểm TB={avg_score}, Tỷ lệ đạt={pass_rate}, Điểm cao nhất={max_score}")
        assert total_sub != "0", "Phải ghi nhận được bài nộp vừa thực hiện!"

        # Kiểm tra bảng học sinh nộp bài
        table_rows = page.locator("#teacherResultsTableBody tr")
        print(f"Số dòng kết quả học sinh: {table_rows.count()}")
        assert table_rows.count() >= 1

        first_row_cells = table_rows.first.locator("td")
        rank_val = first_row_cells.nth(0).inner_text().strip()
        student_val = first_row_cells.nth(1).inner_text().strip()
        class_val = first_row_cells.nth(2).inner_text().strip()
        score_val = first_row_cells.nth(3).inner_text().strip()
        correct_val = first_row_cells.nth(4).inner_text().strip()

        print(f"Dòng 1: Hạng={rank_val} | Học sinh={student_val[:20]} | Lớp={class_val} | Điểm={score_val} | Đúng={correct_val}")

        assert score_val != "/ 10" and not score_val.startswith("/"), f"Lỗi hiển thị điểm trống: '{score_val}'"
        assert correct_val != "/5" and not correct_val.startswith("/"), f"Lỗi hiển thị số câu đúng trống: '{correct_val}'"
        assert "/ 10" in score_val, "Điểm số phải có thang / 10"

        # 7. Kiểm tra Bảng điều khiển Quản lý học sinh & Biểu đồ bài kiểm tra do GV tạo
        print("\n[BƯỚC 7] Mở Bảng điều khiển Quản lý học sinh...")
        page.evaluate("() => openStudentManagementStage()")
        page.wait_for_selector("#studentManagementStage:not(.hidden)", timeout=6000)
        page.wait_for_selector("#smTopicBarChart .sm-bar-row", timeout=10000)

        # Kiểm tra biểu đồ thanh theo bài kiểm tra của giáo viên
        topic_bars = page.locator("#smTopicBarChart .sm-bar-row")
        print(f"Số lượng thanh bài kiểm tra của giáo viên trong biểu đồ: {topic_bars.count()}")
        assert topic_bars.count() >= 1, "Biểu đồ phải hiển thị các bài kiểm tra do giáo viên tạo!"

        first_topic_name = topic_bars.first.locator(".sm-bar-label").inner_text().strip()
        print(f"Tiêu đề bài kiểm tra đầu tiên của GV: '{first_topic_name}'")
        assert len(first_topic_name) > 0, f"Tiêu đề bài kiểm tra phải là do giáo viên tạo! Nhận được: {first_topic_name}"

        browser.close()
        print("\n✅ TOÀN BỘ 7 BƯỚC TEST ZERO-BUG ĐÃ PASS 100%!")

if __name__ == "__main__":
    test_live_exam_socrates_firebase()
