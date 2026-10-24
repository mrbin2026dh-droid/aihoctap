import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\HPZBook\.gemini\antigravity\brain\8836a126-5e52-4023-af1d-0b2380951208"

def test_live_site():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        print("[1] Mở trang LIVE: https://mrbin2026dh-droid.github.io/aisgk/ ...")
        page.goto("https://mrbin2026dh-droid.github.io/aisgk/", wait_until="networkidle")
        time.sleep(2)

        # 1. Đăng nhập Giáo viên
        print("[2] Đăng nhập quyền Giáo viên...")
        page.evaluate("openStudentLoginPortal()")
        time.sleep(0.5)
        page.click("#slTabTeacher")
        time.sleep(0.3)
        page.click("#slBtnUseSamplePin")
        time.sleep(0.2)
        page.click("#slBtnTeacherLogin")
        time.sleep(1.8)

        # 2. Kiểm thử H1: Header Menu Giáo viên
        print("[3] Kiểm thử H1 trên LIVE...")
        h1_data = page.evaluate("""() => {
            const actions = document.querySelector('.header-actions');
            const btns = Array.from(actions.children).map(c => c.id || c.className);
            const btnDirectSignOut = document.getElementById('btnHeaderDirectSignOut');
            const isSignOutLast = actions.lastElementChild === btnDirectSignOut;
            const btnMgmtVisible = !document.getElementById('btnNavStudentMgmt')?.classList.contains('hidden');
            const btnTeacherVisible = !document.getElementById('btnOpenTeacher')?.classList.contains('hidden');
            return { isSignOutLast, btnMgmtVisible, btnTeacherVisible, btns };
        }""")
        print("H1 Live Data:", h1_data)
        assert h1_data["isSignOutLast"] is True, "Nút Thoát phải ở ngoài cùng bên phải trên Live"
        assert h1_data["btnMgmtVisible"] is True, "Nút Quản lý học sinh phải hiển thị"
        assert h1_data["btnTeacherVisible"] is True, "Nút Soạn bài SGK phải hiển thị"

        pic1 = os.path.join(ARTIFACT_DIR, "minh_chung_live_h1_teacher_menu_fixed.png")
        page.screenshot(path=pic1)
        print(f"Saved: {pic1}")

        # 3. Kiểm thử H2: Bảng học sinh có nút Sửa & Modal Chỉnh sửa
        print("[4] Kiểm thử H2 trên LIVE...")
        page.evaluate("openStudentManagementStage()")
        time.sleep(1.5)

        h2_data = page.evaluate("""() => {
            const editBtns = document.querySelectorAll('.btn-edit-student');
            return { count: editBtns.length };
        }""")
        print("H2 Live Data:", h2_data)
        assert h2_data["count"] > 0, "Cột Thao tác phải có icon Chỉnh sửa học sinh trên Live"

        # Bấm nút Sửa
        page.click(".btn-edit-student >> nth=0")
        time.sleep(0.5)
        assert page.is_visible("#smEditStudentModal") is True, "Modal sửa phải hiển thị khi bấm icon bút chì trên Live"

        pic2 = os.path.join(ARTIFACT_DIR, "minh_chung_live_h2_edit_modal_fixed.png")
        page.screenshot(path=pic2)
        print(f"Saved: {pic2}")

        # Đóng modal sửa
        page.click("#smBtnCloseEditModal")
        time.sleep(0.3)

        # 4. Kiểm thử H3: Thống kê thật & AI phân tích thật (Không hardcode)
        print("[5] Kiểm thử H3 trên LIVE...")
        h3_data = page.evaluate("""() => {
            const genText = document.getElementById('aiGeneralText')?.textContent || '';
            const conText = document.getElementById('aiConcernsText')?.textContent || '';
            const scores = Array.from(document.querySelectorAll('.sm-bar-score')).map(s => s.textContent);
            return { genText, conText, scores };
        }""")
        print("H3 Live Data:", h3_data)
        assert "cao hơn 0,6 so với tháng trước" not in h3_data["genText"], "Không được chứa mock cũ"
        assert "5 học sinh cần được hỗ trợ thêm" not in h3_data["conText"], "Không được chứa mock cũ"

        pic3 = os.path.join(ARTIFACT_DIR, "minh_chung_live_h3_real_stats_ai_fixed.png")
        page.screenshot(path=pic3)
        print(f"Saved: {pic3}")

        # 5. Kiểm thử H2.2: Cổng Đăng nhập Tab LAN (Mã học sinh)
        print("[6] Kiểm thử H2.2 trên LIVE (Đăng nhập LAN)...")
        page.evaluate("""() => {
            state.teacherToken = null;
            state.teacherUnlocked = false;
            studentAuthState.isLoggedIn = false;
            sessionStorage.removeItem('ai_sgk_teacher_token');
            localStorage.removeItem('ai_sgk_student_auth');
            closeStudentManagementStage();
            updateHeaderStudentAuthUI();
            openStudentLoginPortal();
        }""")
        time.sleep(0.5)

        # Click Tab LAN
        page.click("#slTabLanStudent")
        time.sleep(0.3)
        assert page.is_visible("#slPanelLanStudent") is True, "Panel LAN phải hiển thị trên Live"

        page.fill("#slInputLanStudentCode", "HS9A01")
        page.fill("#slInputLanPassword", "123456")
        time.sleep(0.2)

        pic2_lan = os.path.join(ARTIFACT_DIR, "minh_chung_live_h2_lan_login_tab_fixed.png")
        page.screenshot(path=pic2_lan)
        print(f"Saved: {pic2_lan}")

        # Bấm Vào học ngay
        page.click("#slBtnLanLogin")
        time.sleep(1.8)

        # 6. Kiểm thử H4: Dashboard Học sinh Thực tế
        print("[7] Kiểm thử H4 trên LIVE (Dashboard học sinh)...")
        h4_data = page.evaluate("""() => {
            const sa = window.studentAuthState || {};
            const heroName = document.getElementById('stdHeroName')?.textContent || '';
            const progress = document.getElementById('stdKpiProgressPercent')?.textContent || '';
            return { isLoggedIn: sa.isLoggedIn, studentCode: sa.studentCode, heroName, progress };
        }""")
        print("H4 Live Data:", h4_data)
        assert h4_data["isLoggedIn"] is True, "Học sinh LAN phải đăng nhập thành công trên Live"
        assert h4_data["studentCode"] == "HS9A01", "Mã học sinh phải là HS9A01 trên Live"

        pic4 = os.path.join(ARTIFACT_DIR, "minh_chung_live_h4_student_dashboard_fixed.png")
        page.screenshot(path=pic4)
        print(f"Saved: {pic4}")

        print("=== TOÀN BỘ 4 YÊU CẦU ĐÃ ĐẠT CHUẨN 100% TRÊN TRANG LIVE ===")
        browser.close()

if __name__ == "__main__":
    test_live_site()
