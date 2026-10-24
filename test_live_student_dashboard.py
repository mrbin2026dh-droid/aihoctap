import os
import sys
import time
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\HPZBook\.gemini\antigravity\brain\8836a126-5e52-4023-af1d-0b2380951208"

def test_live_student_dashboard():
    unique_num = int(time.time()) % 10000
    student_code = f"HS9ALIVE{unique_num:04d}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("[1] Mở trang LIVE: https://mrbin2026dh-droid.github.io/aisgk/ ...")
        page.goto("https://mrbin2026dh-droid.github.io/aisgk/", wait_until="networkidle")
        time.sleep(2.0)

        # 1. Đăng nhập học sinh LAN hoàn toàn mới trên Live
        print(f"[2] Đăng nhập tài khoản Học sinh LAN mới: {student_code} trên Live...")
        page.evaluate("""() => {
            localStorage.clear();
            sessionStorage.clear();
            studentAuthState.isLoggedIn = false;
            openStudentLoginPortal();
        }""")
        time.sleep(0.5)

        page.click("#slTabLanStudent")
        time.sleep(0.3)
        page.fill("#slInputLanStudentCode", student_code)
        page.fill("#slInputLanPassword", "123456")
        page.click("#slBtnLanLogin")
        time.sleep(1.8)

        # 2. Kiểm tra Dashboard ban đầu trên Live (Zero Mock, 0/17 bài)
        print("[3] Kiểm tra Dashboard ban đầu trên Live (Zero Mock, 0/17 bài)...")
        init_data = page.evaluate("""() => {
            return {
                heroName: document.getElementById('stdHeroName')?.textContent,
                progressPercent: document.getElementById('stdKpiProgressPercent')?.textContent,
                lessonsRatio: document.getElementById('stdKpiLessonsRatio')?.textContent,
                completedVal: document.getElementById('stdKpiCompletedVal')?.textContent,
                scoreVal: document.getElementById('stdKpiScoreVal')?.textContent,
                streakVal: document.getElementById('stdKpiStreakVal')?.textContent,
                continueNextText: document.getElementById('stdContinueNextText')?.textContent,
                continueBarVal: document.getElementById('stdContinueBarVal')?.textContent,
                taskSubtitle: document.getElementById('stdTaskSubtitle')?.textContent,
                theoryStatus: document.getElementById('stdTaskTheoryStatus')?.textContent,
                quizStatus: document.getElementById('stdTaskQuizStatus')?.textContent,
                practiceStatus: document.getElementById('stdTaskPracticeStatus')?.textContent,
                achieve1Status: document.getElementById('achieveFirstLessonStatus')?.textContent,
                isAchieve1Locked: document.getElementById('achieveFirstLesson')?.classList.contains('locked'),
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth
            };
        }""")
        print("Initial Live Dashboard Data:", init_data)

        # Assertions khoa học
        assert init_data["progressPercent"] == "0%", "Tiến độ ban đầu phải là 0%"
        assert "0/17" in init_data["lessonsRatio"], f"Tổng số bài phải là 17, hiện tại: {init_data['lessonsRatio']}"
        assert init_data["completedVal"] == "0/17", f"Bài hoàn thành ban đầu phải là 0/17, hiện tại: {init_data['completedVal']}"
        assert init_data["scoreVal"] == "--", "Điểm số khi chưa làm bài phải là --"
        assert init_data["streakVal"] == "0 ngày", f"Chuỗi ngày khi chưa học phải là 0 ngày, hiện tại: {init_data['streakVal']}"
        assert "Bài 1" in init_data["continueNextText"], f"Bài tiếp theo ban đầu phải là Bài 1, hiện tại: {init_data['continueNextText']}"
        assert "Bài 1" in init_data["taskSubtitle"], f"Nhiệm vụ ban đầu phải theo Bài 1, hiện tại: {init_data['taskSubtitle']}"
        assert "Chưa học" in init_data["theoryStatus"], f"Lý thuyết phải là Chưa học, hiện tại: {init_data['theoryStatus']}"
        assert "Chưa làm" in init_data["quizStatus"], f"Quiz phải là Chưa làm, hiện tại: {init_data['quizStatus']}"
        assert init_data["isAchieve1Locked"] is True, "Huy hiệu đầu tiên phải ở trạng thái khóa khi chưa hoàn thành bài nào"
        assert init_data["scrollWidth"] == init_data["clientWidth"], "Không được có lỗi tràn ngang trên Desktop!"

        pic_init = os.path.join(ARTIFACT_DIR, "minh_chung_live_dashboard_redesign_clean.png")
        page.screenshot(path=pic_init)
        print(f"Saved: {pic_init}")

        # 3. Bấm 'Vào học ngay' trên thẻ Tiếp tục bài học
        print("[4] Bấm 'Vào học ngay' trên thẻ Tiếp tục bài học trên Live...")
        page.click("#btnStdContinueStudy")
        time.sleep(1.2)

        is_theory_active = page.evaluate("() => document.getElementById('theoryView')?.classList.contains('active')")
        assert is_theory_active is True, "Nút Vào học ngay phải chuyển vào màn hình đọc lý thuyết SGK"

        # 4. Chuyển sang làm bài Luyện tập trắc nghiệm và hoàn thành bài tập thật
        print("[5] Chuyển sang bài Quiz và nộp bài thật trên Live...")
        page.click("#btnGoToQuiz")
        time.sleep(1.2)

        # Trả lời tất cả các câu hỏi trắc nghiệm
        for q_idx in range(4):
            page.wait_for_selector(".option-btn", timeout=5000)
            page.click(".option-btn >> nth=0")
            time.sleep(0.3)
            page.click("#btnActionQuestion")
            time.sleep(0.6)
            page.click("#btnActionQuestion")
            time.sleep(0.6)

        time.sleep(1.0)
        is_completion_active = page.evaluate("() => document.getElementById('completionCard')?.classList.contains('active')")
        print(f"Completion screen active on Live: {is_completion_active}")

        # 5. Quay trở lại Dashboard và kiểm tra số liệu ĐÃ CẬP NHẬT THẬT 100% trên Live
        print("[6] Quay lại Dashboard và kiểm tra số liệu đã cập nhật thật trên Live...")
        page.evaluate("switchView('dashboard')")
        time.sleep(1.5)

        after_data = page.evaluate("""() => {
            return {
                progressPercent: document.getElementById('stdKpiProgressPercent')?.textContent,
                lessonsRatio: document.getElementById('stdKpiLessonsRatio')?.textContent,
                completedVal: document.getElementById('stdKpiCompletedVal')?.textContent,
                scoreVal: document.getElementById('stdKpiScoreVal')?.textContent,
                streakVal: document.getElementById('stdKpiStreakVal')?.textContent,
                continueNextText: document.getElementById('stdContinueNextText')?.textContent,
                taskSubtitle: document.getElementById('stdTaskSubtitle')?.textContent,
                achieve1Status: document.getElementById('achieveFirstLessonStatus')?.textContent,
                isAchieve1Unlocked: document.getElementById('achieveFirstLesson')?.classList.contains('unlocked')
            };
        }""")
        print("Updated Live Dashboard Data (Real Student Progress):", after_data)

        # Assertions sau khi làm bài thật trên Live
        assert after_data["progressPercent"] != "0%", "Tiến độ phải tăng lên sau khi hoàn thành bài!"
        assert after_data["completedVal"] == "1/17", f"Bài hoàn thành phải là 1/17 sau khi làm bài, hiện tại: {after_data['completedVal']}"
        assert after_data["scoreVal"] != "--", "Điểm số phải được tính toán thật từ bài quiz!"
        assert after_data["streakVal"] == "1 ngày", f"Chuỗi ngày phải cập nhật thành 1 ngày sau khi học hôm nay, hiện tại: {after_data['streakVal']}"
        assert "Bài 2" in after_data["continueNextText"], f"Sau khi xong Bài 1, thẻ bài tiếp theo phải tự động gợi ý Bài 2, hiện tại: {after_data['continueNextText']}"
        assert "Bài 2" in after_data["taskSubtitle"], f"Sau khi xong Bài 1, nhiệm vụ phải chuyển sang Bài 2, hiện tại: {after_data['taskSubtitle']}"
        assert after_data["isAchieve1Unlocked"] is True, "Huy hiệu Bước chân đầu tiên phải được MỞ KHÓA thật!"

        pic_updated = os.path.join(ARTIFACT_DIR, "minh_chung_live_dashboard_redesign_progress.png")
        page.screenshot(path=pic_updated)
        print(f"Saved: {pic_updated}")

        # 6. Kiểm tra Responsive Mobile trên Live (375x667)
        print("[7] Kiểm tra Responsive trên Mobile (375x667) trên Live...")
        page.set_viewport_size({"width": 375, "height": 667})
        time.sleep(1.0)

        mobile_data = page.evaluate("""() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth
            };
        }""")
        print("Mobile Live Data:", mobile_data)
        assert mobile_data["scrollWidth"] == mobile_data["clientWidth"], f"Mobile không được có lỗi tràn ngang! scrollWidth={mobile_data['scrollWidth']}, clientWidth={mobile_data['clientWidth']}"

        pic_mobile = os.path.join(ARTIFACT_DIR, "minh_chung_live_dashboard_redesign_mobile.png")
        page.screenshot(path=pic_mobile)
        print(f"Saved: {pic_mobile}")

        real_errors = [e for e in console_errors if "Failed to load resource" not in e and "501" not in e and "404" not in e]
        assert len(real_errors) == 0, f"Phát hiện lỗi F12 Console: {real_errors}"

        # Dọn dẹp bản ghi test trên Firebase
        try:
            req = urllib.request.Request(
                f"https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app/students/9A/lan_9A_{student_code.lower()}.json",
                method="DELETE"
            )
            urllib.request.urlopen(req)
        except Exception:
            pass

        print("=== TOÀN BỘ KIỂM THỬ TRÊN TRANG LIVE GITHUB PAGES ĐÃ ĐẠT CHUẨN 100% ===")
        browser.close()

if __name__ == "__main__":
    test_live_student_dashboard()
