import os
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

FRONTEND_PATH = Path(__file__).resolve().parent.parent / "frontend" / "index.html"
FILE_URL = FRONTEND_PATH.as_uri()

def test_teacher_home_navigation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        
        # 1. Truy cập trang web cục bộ
        page.goto(FILE_URL, wait_until="networkidle")
        time.sleep(1)

        # 2. Giả lập học sinh 'Mr KhangKhoi' đã đăng nhập trước đó
        page.evaluate("""() => {
            window.studentAuthState.isLoggedIn = true;
            window.studentAuthState.uid = "std_khangkhoi_999";
            window.studentAuthState.studentName = "Mr KhangKhoi";
            window.studentAuthState.classCode = "9A";
            window.studentAuthState.grade = 9;
            localStorage.setItem("ai_sgk_student_auth", JSON.stringify(window.studentAuthState));
            updateHeaderStudentAuthUI();
            switchView("dashboard");
        }""")
        time.sleep(0.5)

        # 3. Đăng nhập Giáo viên qua Modal
        page.evaluate("openStudentLoginPortal()")
        time.sleep(0.3)
        page.click("#slTabTeacher")
        time.sleep(0.2)
        page.click("#slBtnUseSamplePin")
        time.sleep(0.2)
        page.click("#slBtnTeacherLogin")
        time.sleep(1.0)

        # 4. Giáo viên bấm nút [Trang chủ] (#btnNavDashboard)
        page.click("#btnNavDashboard")
        time.sleep(0.5)

        # 5. Kiểm tra kết quả: Khi là giáo viên, không được hiển thị dashboard của học sinh
        result = page.evaluate("""() => {
            const studentDashboard = document.getElementById("dashboardView");
            const studentMgmtStage = document.getElementById("studentManagementStage");
            const isStudentDashActive = studentDashboard && studentDashboard.classList.contains("active");
            const isTeacherMgmtVisible = studentMgmtStage && !studentMgmtStage.classList.contains("hidden");
            const heroName = document.getElementById("stdHeroName")?.textContent || "";
            const authUid = window.studentAuthState?.uid;
            const isTeacher = !!(window.state?.teacherUnlocked && window.state?.teacherToken);
            return {
                isStudentDashActive,
                isTeacherMgmtVisible,
                heroName,
                authUid,
                isTeacher
            };
        }""")

        print("Kết quả điều hướng Trang chủ khi là Giáo viên:", result)
        browser.close()

        # Khẳng định chuẩn: Giáo viên click Trang chủ KHÔNG ĐƯỢC kích hoạt dashboard học sinh
        assert result["isTeacher"] is True, "Phải xác thực quyền Giáo viên"
        assert result["isStudentDashActive"] is False, "Lỗi Hình 2: Giáo viên không được thấy Sân khấu Dashboard học sinh!"
        assert result["isTeacherMgmtVisible"] is True, "Giáo viên bấm Trang chủ phải hiển thị Sân khấu Quản lý Sư phạm!"
        assert result["authUid"] != "std_khangkhoi_999", "Lỗi Hình 2: Rò rỉ UID học sinh cũ sau khi đăng nhập giáo viên!"

if __name__ == "__main__":
    test_teacher_home_navigation()
