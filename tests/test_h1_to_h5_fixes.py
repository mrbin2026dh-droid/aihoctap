import sys
import io
import time
import pytest
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_h1_forward_lock_and_h2_to_h5_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}) # Mobile viewport
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n[TEST H4 & H5] Kiểm tra Màn hình Đăng nhập Mobile & Mã PIN Giáo viên...")
        page.goto(f"{BASE_URL}/index.html", wait_until="networkidle")
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        page.reload(wait_until="networkidle")
        page.wait_for_selector("#studentLoginPortal", state="attached")

        # Mở cổng đăng nhập nếu chưa hiện
        page.evaluate("() => { if (typeof openStudentLoginPortal === 'function') openStudentLoginPortal(); }")
        time.sleep(0.5)

        # 1. Kiểm tra H4: Modal Đăng nhập trên Mobile không bị tràn ngang
        overflow_login = page.evaluate("""() => {
            const el = document.querySelector('.sl-auth-card');
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        }""")
        assert not overflow_login, "Bị tràn ngang trên màn hình đăng nhập mobile!"
        print("  ✔ [H4 PASS] Modal Đăng nhập hiển thị vừa vặn, không tràn ngang trên mobile (390x844).")

        # 2. Kiểm tra H5: Đã xóa bỏ hoàn toàn phần hardcode mã PIN mặc định
        page.click("#slTabTeacher")
        time.sleep(0.3)
        sample_pin_box = page.locator(".sl-quick-pin-row")
        assert sample_pin_box.count() == 0, "Khối hiển thị mã PIN mặc định .sl-quick-pin-row vẫn còn tồn tại!"
        sample_code = page.locator("text='Tch-8b6657ed96b64ad2'")
        assert sample_code.count() == 0, "Mã PIN mặc định vẫn bị lộ trên giao diện giáo viên!"
        print("  ✔ [H5 PASS] Phần hiển thị mã PIN mặc định đã được xóa sạch 100% khỏi giao diện.")

        # 3. Đăng nhập quyền Giáo viên bằng mã PIN chuẩn
        page.fill("#slTeacherPinInput", "Tch-8b6657ed96b64ad2")
        page.click("#slBtnTeacherLogin")
        time.sleep(1.0)

        # Kiểm tra đã đăng nhập thành công
        user_name = page.locator("#stdUserName").text_content()
        assert "Giáo viên" in user_name, f"Đăng nhập Giáo viên thất bại: {user_name}"
        print(f"  ✔ [H5 PASS] Đăng nhập Giáo viên thành công: {user_name}")

        # 4. Kiểm tra H5: Tính năng Đổi mã PIN Giáo viên
        print("\n[TEST H5] Kiểm tra tính năng Đổi mã PIN Giáo viên bảo mật...")
        page.click("#stdUserBadge")
        time.sleep(0.3)
        btn_change_pin = page.locator("#btnStdTeacherChangePin")
        assert btn_change_pin.is_visible(), "Nút 'Đổi mã PIN Giáo viên' không xuất hiện trong dropdown menu!"
        btn_change_pin.click()
        time.sleep(0.5)

        modal_pin = page.locator("#modalTeacherChangePin")
        assert modal_pin.is_visible(), "Modal Đổi mã PIN Giáo viên không hiển thị!"

        # Thử đổi với mã PIN hiện tại sai
        page.fill("#inputCurTeacherPin", "SaiPin123")
        page.fill("#inputNewTeacherPin", "GiaoVienMoi2026")
        page.fill("#inputConfirmTeacherPin", "GiaoVienMoi2026")
        page.click("#btnSubmitChangeTeacherPin")
        time.sleep(0.5)

        err_msg = page.locator("#msgTeacherChangePin").text_content()
        assert "không chính xác" in err_msg, f"Không báo lỗi khi nhập sai PIN hiện tại: {err_msg}"
        print("  ✔ [H5 PASS] Chặn đổi PIN khi nhập sai PIN hiện tại thành công.")

        # Đổi thành công với mã PIN hiện tại đúng
        page.fill("#inputCurTeacherPin", "Tch-8b6657ed96b64ad2")
        page.fill("#inputNewTeacherPin", "GiaoVienMoi2026")
        page.fill("#inputConfirmTeacherPin", "GiaoVienMoi2026")
        page.click("#btnSubmitChangeTeacherPin")
        time.sleep(1.8)

        # Modal tự động đóng sau khi đổi thành công
        assert modal_pin.is_hidden() or not modal_pin.is_visible(), "Modal đổi PIN không tự động đóng sau khi thành công!"
        print("  ✔ [H5 PASS] Đổi mã PIN Giáo viên thành công sang mã mới an toàn.")

        # 5. Kiểm tra H3: Popup Socrates AI trên Mobile
        print("\n[TEST H3] Kiểm tra Popup Socrates AI trên Mobile...")
        # Đóng dropdown nếu còn mở
        page.evaluate("() => { const d = document.getElementById('stdUserDropdown'); if(d) d.classList.add('hidden'); }")
        # Mở popup Socrates
        page.evaluate("() => openPopup()")
        time.sleep(0.5)
        popup = page.locator("#socratesPopupCard")
        assert popup.is_visible(), "Popup Socrates không mở được!"

        # Kiểm tra không bị tràn màn hình
        overflow_socrates = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
        assert not overflow_socrates, "Socrates popup bị tràn ngang trên mobile!"

        # Đóng popup bằng nút X
        page.click("#btnClosePopup")
        time.sleep(0.3)
        assert not popup.is_visible() or popup.evaluate("el => !el.classList.contains('open')"), "Nút đóng Socrates popup không hoạt động!"
        print("  ✔ [H3 PASS] Popup Socrates AI trên mobile hiển thị chuẩn, không tràn ngang và đóng mở mượt mà.")

        # 6. Kiểm tra H1 & H2: Mở bài thi và kiểm tra logic khóa chuyển câu
        print("\n[TEST H1 & H2] Kiểm tra Logic Khóa Chuyển Câu & Responsive Bài Thi Mobile...")
        page.evaluate("""() => {
            if (typeof handleTeacherLogout === 'function') handleTeacherLogout();
            studentAuthState.isLoggedIn = true;
            studentAuthState.uid = 'std_e2e_student_01';
            studentAuthState.studentName = 'Học sinh kiểm thử';
            studentAuthState.studentCode = '123456';
            studentAuthState.classCode = '9A';
            studentAuthState.grade = 9;
            localStorage.setItem('ai_sgk_student_auth', JSON.stringify(studentAuthState));
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
        }""")
        time.sleep(2.0)

        # Bấm nút Vào làm bài ngay
        start_btn = page.locator("#examStudentGrid .btn-exam-primary, #examStudentGrid .btn-exam-retake").first
        start_btn.click()
        time.sleep(1.5)

        # Đang ở Câu 1 / 10
        q_index_text = page.locator("#takingQCurrentIndex").text_content()
        assert "Câu 1" in q_index_text, f"Không ở câu 1: {q_index_text}"

        # Kiểm tra H2: Responsive dòng số câu và badge SGK trên mobile
        index_white_space = page.evaluate("() => window.getComputedStyle(document.getElementById('takingQCurrentIndex')).whiteSpace")
        assert "nowrap" in index_white_space, f"takingQCurrentIndex không có nowrap: {index_white_space}"
        overflow_taking = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
        assert not overflow_taking, "Màn hình làm bài thi bị tràn ngang trên mobile!"
        print("  ✔ [H2 PASS] Màn hình thi trên mobile chuẩn responsive: Không gãy dòng 'Câu 1 / 10', 0 tràn ngang.")

        # Kiểm tra H1: Nút Câu tiếp theo phải bị DISABLED khi chưa chọn đáp án
        btn_next = page.locator("#btnTakingNextQ")
        assert btn_next.is_disabled(), "Nút 'Câu tiếp theo' không bị disable khi chưa chọn đáp án!"
        print("  ✔ [H1 PASS] Nút 'Câu tiếp theo' bị vô hiệu hóa khi câu hiện tại chưa có đáp án.")

        # Kiểm tra H1: Bấm nút Câu 2 trên Palette câu hỏi không cho chuyển
        palette_btn_2 = page.locator(".palette-q-btn:has-text('2')")
        assert "palette-q-locked" in palette_btn_2.get_attribute("class"), "Nút câu 2 trên palette không có class palette-q-locked!"
        palette_btn_2.click()
        time.sleep(0.3)

        # Vẫn phải ở Câu 1
        q_index_after_click = page.locator("#takingQCurrentIndex").text_content()
        assert "Câu 1" in q_index_after_click, f"Bị nhảy sang câu khác khi chưa trả lời: {q_index_after_click}"

        # Kiểm tra Toast thông báo xuất hiện
        toast = page.locator("#examToastAlert")
        assert toast.is_visible() and "Em vui lòng chọn đáp án" in toast.text_content(), "Toast cảnh báo không hiển thị!"
        print("  ✔ [H1 PASS] Bấm câu 2 trên Palette bị chặn đứng và Toast cảnh báo xuất hiện chuẩn xác.")

        # Học sinh chọn đáp án cho Câu 1
        page.locator(".taking-opt-card").first.click()
        time.sleep(0.3)

        # Bây giờ nút Tiếp theo phải được ENABLE
        assert not btn_next.is_disabled(), "Nút 'Câu tiếp theo' vẫn bị disabled sau khi đã chọn đáp án!"
        print("  ✔ [H1 PASS] Nút 'Câu tiếp theo' được kích hoạt ngay khi học sinh chọn đáp án.")

        # Bấm Câu tiếp theo để chuyển sang Câu 2
        btn_next.click()
        time.sleep(0.5)

        q2_index_text = page.locator("#takingQCurrentIndex").text_content()
        assert "Câu 2" in q2_index_text, f"Không chuyển được sang Câu 2: {q2_index_text}"
        print("  ✔ [H1 PASS] Chuyển sang Câu 2 thành công sau khi đã hoàn thành Câu 1.")

        # Ở Câu 2: Nút Tiếp theo lại phải bị DISABLED vì Câu 2 chưa có đáp án!
        assert btn_next.is_disabled(), "Ở Câu 2 nút Tiếp theo không bị disabled khi chưa chọn đáp án!"
        print("  ✔ [H1 PASS] Ở Câu 2, nút Tiếp theo tự động khóa lại cho đến khi học sinh chọn đáp án.")

        # Học sinh có quyền quay lại Câu 1 (bằng nút Câu trước hoặc nút 1 trên Palette)
        btn_prev = page.locator("#btnTakingPrevQ")
        btn_prev.click()
        time.sleep(0.3)
        q1_back_text = page.locator("#takingQCurrentIndex").text_content()
        assert "Câu 1" in q1_back_text, f"Không quay lại được Câu 1: {q1_back_text}"
        print("  ✔ [H1 PASS] Học sinh quay lại xem và sửa câu 1 thành công.")

        # 7. Kiểm tra Console Errors
        filtered_errors = [e for e in console_errors if not any(ign in e for ign in ["favicon", "404", "ERR_FILE_NOT_FOUND"])]
        assert len(filtered_errors) == 0, f"Console F12 có lỗi: {filtered_errors}"
        print("  ✔ Console F12 sạch 100% không có lỗi Uncaught Exception.")

        browser.close()
        print("\n🎉 TẤT CẢ 5 HẠNG MỤC H1, H2, H3, H4, H5 ĐỀU ĐẠT CHUẨN HOÀN HẢO 100%!")

if __name__ == "__main__":
    test_h1_forward_lock_and_h2_to_h5_features()
