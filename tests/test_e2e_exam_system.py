import os
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000"

def test_full_exam_pipeline():
    with sync_playwright() as p:
        # ====================================================================
        # PHẦN 1: GIÁO VIÊN TẠO ĐỀ KIỂM TRA & XUẤT FILE MẪU EXCEL
        # ====================================================================
        browser = p.chromium.launch(headless=True)
        teacher_page = browser.new_page(viewport={"width": 1366, "height": 768})

        print("\n[BƯỚC 1] Giáo viên đăng nhập hệ thống...")
        teacher_page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)

        # Đăng nhập Giáo viên
        teacher_page.evaluate("openStudentLoginPortal()")
        time.sleep(0.3)
        teacher_page.click("#slTabTeacher")
        time.sleep(0.2)
        teacher_page.click("#slBtnUseSamplePin")
        time.sleep(0.2)
        teacher_page.click("#slBtnTeacherLogin")
        time.sleep(1.2)

        # Mở Menu Bài kiểm tra
        print("[BƯỚC 2] Giáo viên mở Menu Bài kiểm tra...")
        teacher_page.click("#btnNavExamHub")
        time.sleep(0.8)

        # Kiểm tra hiển thị phân hệ giáo viên
        is_teacher_view = teacher_page.evaluate("""() => {
            const tv = document.getElementById("examTeacherView");
            return tv && !tv.classList.contains("hidden");
        }""")
        assert is_teacher_view is True, "Giao diện quản trị bài kiểm tra của Giáo viên phải hiển thị!"

        # Giáo viên mở modal soạn đề và tạo đề kiểm tra 15 phút
        print("[BƯỚC 3] Giáo viên tạo đề kiểm tra mới...")
        teacher_page.click("#btnExamCreateManual")
        time.sleep(0.5)

        teacher_page.fill("#examFormTitle", "Kiểm tra 15 phút - Bài 1 & 2 (Tin học 9)")
        teacher_page.select_option("#examFormGrade", "9")
        teacher_page.select_option("#examFormClass", "9A")
        teacher_page.fill("#examFormDuration", "15")

        # Thêm 2 câu hỏi mẫu vào đề
        teacher_page.click("#btnModalAddQuestion")
        time.sleep(0.2)
        teacher_page.click("#btnModalAddQuestion")
        time.sleep(0.2)

        # Đăng bài kiểm tra
        teacher_page.click("#btnExamSaveAndPublish")
        time.sleep(1.2)

        print("[BƯỚC 4] Xác nhận bài kiểm tra xuất hiện trong danh sách Giáo viên...")
        exam_cards_count = teacher_page.evaluate("""() => {
            return document.querySelectorAll("#examTeacherGrid .exam-card-item").length;
        }""")
        assert exam_cards_count >= 1, "Phải có ít nhất 1 bài kiểm tra hiển thị!"

        # ====================================================================
        # PHẦN 2: HỌC SINH LÀM BÀI TRÊN THIẾT BỊ DI ĐỘNG (MOBILE VIEWPORT 375x667)
        # ====================================================================
        print("\n[BƯỚC 5] Học sinh truy cập trên thiết bị Di động (Mobile 375x667)...")
        mobile_context = browser.new_context(
            viewport={"width": 375, "height": 667},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
        )
        student_page = mobile_context.new_page()
        student_page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)

        # Giả lập học sinh 9A đăng nhập
        student_page.evaluate("""() => {
            window.studentAuthState.isLoggedIn = true;
            window.studentAuthState.uid = "std_mobile_9a_001";
            window.studentAuthState.studentName = "Trần Hoàng Nam";
            window.studentAuthState.studentCode = "HS0912";
            window.studentAuthState.classCode = "9A";
            window.studentAuthState.grade = 9;
            localStorage.setItem("ai_sgk_student_auth", JSON.stringify(window.studentAuthState));
            updateHeaderStudentAuthUI();
            if (typeof portalDirectClose === "function") portalDirectClose();
        }""")
        time.sleep(0.5)

        # Học sinh bấm nút Menu [Kiểm tra]
        print("[BƯỚC 6] Học sinh mở Menu Kiểm tra trên di động...")
        student_page.click("#btnNavExamHub")
        time.sleep(1)

        # Kiểm tra giao diện học sinh hiển thị đề thi
        has_student_exam = student_page.evaluate("""() => {
            const sv = document.getElementById("examStudentView");
            const cards = document.querySelectorAll("#examStudentGrid .exam-card-item");
            return sv && !sv.classList.contains("hidden") && cards.length >= 1;
        }""")
        assert has_student_exam is True, "Học sinh 9A phải thấy danh sách bài kiểm tra!"

        # Bắt đầu làm bài
        print("[BƯỚC 7] Học sinh bấm [Bắt đầu làm bài]...")
        start_btn = student_page.locator("#examStudentGrid .btn-exam-primary").first
        start_btn.click()
        time.sleep(1)

        # Đo đạc thông số kỹ thuật Mobile Responsive (Zero-Overflow Law)
        print("[BƯỚC 8] Đo đạc chuẩn Mobile Responsive & Chống tràn ngang...")
        mobile_metrics = student_page.evaluate("""() => {
            const takingStage = document.getElementById("examTakingView");
            const scrollW = document.body.scrollWidth;
            const clientW = document.body.clientWidth;
            const timerVal = document.getElementById("takingCountdownVal")?.textContent || "";
            const optCards = Array.from(document.querySelectorAll(".taking-opt-card"));
            const minCardH = Math.min(...optCards.map(c => c.offsetHeight));
            return {
                isTakingVisible: takingStage && !takingStage.classList.contains("hidden"),
                scrollWidth: scrollW,
                clientWidth: clientW,
                hasZeroOverflow: (scrollW === clientW),
                timerVal: timerVal,
                minTouchTargetHeight: minCardH,
                totalOptions: optCards.length
            };
        }""")
        print("Thông số đo đạc trên Mobile:", mobile_metrics)

        assert mobile_metrics["isTakingVisible"] is True, "Phòng thi phải mở ra cho học sinh!"
        assert mobile_metrics["hasZeroOverflow"] is True, f"Bị tràn ngang trên mobile! scrollWidth={mobile_metrics['scrollWidth']} != clientWidth={mobile_metrics['clientWidth']}"
        assert mobile_metrics["minTouchTargetHeight"] >= 44, f"Điểm chạm lựa chọn phải >= 44px! Thực tế: {mobile_metrics['minTouchTargetHeight']}px"
        assert len(mobile_metrics["timerVal"]) > 0, "Đồng hồ đếm ngược phải hiển thị!"

        # Chọn phương án A cho câu 1
        print("[BƯỚC 9] Chọn phương án trả lời...")
        student_page.locator(".taking-opt-card").first.click()
        time.sleep(0.3)

        # Chuyển sang câu 2
        student_page.click("#btnTakingNextQ")
        time.sleep(0.3)
        # Chọn phương án B cho câu 2
        student_page.locator(".taking-opt-card").nth(1).click()
        time.sleep(0.3)

        # Nộp bài thi (tự động chấp nhận confirm dialog)
        print("[BƯỚC 10] Học sinh nộp bài thi...")
        student_page.on("dialog", lambda dialog: dialog.accept())
        student_page.click("#btnTakingSubmitExam")
        time.sleep(2)

        # Kiểm tra màn hình kết quả & AI Socrates
        print("[BƯỚC 11] Kiểm tra Màn hình Kết quả & Đánh giá AI Socrates...")
        result_metrics = student_page.evaluate("""() => {
            const resView = document.getElementById("examResultView");
            const scoreNum = document.getElementById("resultScoreNum")?.textContent;
            const aiText = document.getElementById("resultAIFeedbackText")?.textContent || "";
            const recommendItems = document.querySelectorAll("#resultRecommendList .recommend-item");
            return {
                isResultVisible: resView && !resView.classList.contains("hidden"),
                score: scoreNum,
                hasAIFeedback: aiText.length > 10,
                recommendCount: recommendItems.length
            };
        }""")
        print("Kết quả chấm thi & AI Sư phạm:", result_metrics)

        assert result_metrics["isResultVisible"] is True, "Màn hình kết quả phải hiển thị sau khi nộp bài!"
        assert result_metrics["hasAIFeedback"] is True, "AI Socrates phải có nhận xét sư phạm chi tiết!"

        # Kiểm tra nút [Mở bài học để ôn lại ngay]
        if result_metrics["recommendCount"] > 0:
            print("[BƯỚC 12] Kiểm tra tính năng Đề xuất SGK...")
            btn_open_sgk = student_page.locator(".btn-open-sgk-topic").first
            btn_open_sgk.click()
            time.sleep(1)

            is_in_theory = student_page.evaluate("""() => {
                const theoryView = document.getElementById("theoryView");
                return theoryView && theoryView.classList.contains("active");
            }""")
            assert is_in_theory is True, "Bấm đề xuất SGK phải mở ngay bài học tương ứng!"
            print("Đã mở đúng bài học SGK từ đề xuất của AI!")

        print("\nALL E2E PLAYWRIGHT TESTS PASSED 100%!")
        browser.close()

if __name__ == "__main__":
    test_full_exam_pipeline()
