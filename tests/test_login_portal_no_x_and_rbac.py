import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_login_portal_no_x_and_rbac():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        alerts = []
        page.on("dialog", lambda dialog: (alerts.append(dialog.message), dialog.accept()))

        print("\n[BƯỚC 1] Tải trang chủ với phiên sạch...")
        page.goto(BASE_URL, wait_until="networkidle")

        # 1. Kiểm tra Cổng đăng nhập hiển thị
        portal_visible = page.is_visible("#studentLoginPortal")
        print("Cổng đăng nhập hiển thị:", portal_visible)
        assert portal_visible, "Cổng đăng nhập phải hiển thị khi chưa đăng nhập!"

        # 2. Kiểm tra Nút 'X' đã bị XÓA HOÀN TOÀN
        close_btn_count = page.locator("#btnCloseLoginPortal, .sl-auth-close-btn").count()
        print(f"Số lượng nút 'X' (btnCloseLoginPortal) trên DOM: {close_btn_count}")
        assert close_btn_count == 0, "Nút 'X' bắt buộc phải bị XÓA HẲN khỏi giao diện!"

        # 3. Kiểm tra các nút Giáo viên trên Header bị ẩn hoàn toàn đối với khách
        btn_mgmt_visible = page.locator("#btnNavStudentMgmt").is_visible()
        btn_teacher_visible = page.locator("#btnOpenTeacher").is_visible()
        print(f"Nút Quản lý học sinh visible: {btn_mgmt_visible} | Nút Soạn bài visible: {btn_teacher_visible}")
        assert not btn_mgmt_visible, "Nút Quản lý học sinh phải bị ẨN khi chưa đăng nhập!"
        assert not btn_teacher_visible, "Nút Soạn bài phải bị ẨN khi chưa đăng nhập!"

        # 4. Thử cố tình gọi openStudentManagementStage() khi chưa có quyền
        print("\n[BƯỚC 2] Thử gọi trái phép openStudentManagementStage()...")
        page.evaluate("() => openStudentManagementStage()")
        page.wait_for_timeout(300)

        mgmt_stage_visible = page.locator("#studentManagementStage").is_visible()
        print("Sân khấu Quản lý học sinh có bị lộ không:", mgmt_stage_visible)
        assert not mgmt_stage_visible, "Sân khấu Quản lý học sinh KHÔNG ĐƯỢC PHÉP mở khi chưa xác thực Giáo viên!"
        assert len(alerts) > 0, "Hệ thống phải bật cảnh báo từ chối truy cập RBAC!"
        print(f"Cảnh báo chặn đứng RBAC: '{alerts[-1]}'")

        # 5. Đăng nhập Giáo viên bằng mã PIN
        print("\n[BƯỚC 3] Đăng nhập quyền Giáo viên...")
        page.click("#slTabTeacher")
        page.wait_for_timeout(200)
        page.fill("#slTeacherPinInput", "Tch-8b6657ed96b64ad2")
        page.wait_for_timeout(100)
        page.click("#slBtnTeacherLogin")

        # Đợi chuyển vào sân khấu Quản lý học sinh
        page.wait_for_selector("#studentManagementStage:not(.hidden)", timeout=8000)
        mgmt_stage_after_login = page.locator("#studentManagementStage").is_visible()
        print("Sân khấu Quản lý học sinh sau khi đăng nhập Giáo viên:", mgmt_stage_after_login)
        assert mgmt_stage_after_login, "Giáo viên sau khi nhập PIN phải mở được Quản lý học sinh!"

        # 6. Đóng phiên Giáo viên
        print("\n[BƯỚC 4] Đóng phiên Giáo viên...")
        page.evaluate("() => handleTeacherLogout()")
        page.wait_for_timeout(300)

        mgmt_stage_after_logout = page.locator("#studentManagementStage").is_visible()
        print("Sân khấu Quản lý học sinh sau khi thoát:", mgmt_stage_after_logout)
        assert not mgmt_stage_after_logout, "Sân khấu Quản lý học sinh phải được đóng ngay lập tức!"

        browser.close()
        print("\n✅ KIỂM THỬ XÓA NÚT X & KHÓA CHẶT RBAC ĐÃ PASS 100%!")

if __name__ == "__main__":
    test_login_portal_no_x_and_rbac()
