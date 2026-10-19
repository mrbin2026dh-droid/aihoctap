"""
Playwright Test xác thực giao diện mặc định chuẩn H1:
1. Mở trang: Mặc định là Lý thuyết SGK (#theoryView có class 'active'), Quiz view KHÔNG active.
2. Mục 1 ("1. Thông tin và dữ liệu") trên cây mục lục sidebar có class 'active'.
3. Khung Gia sư Socrates (#socratesPopupCard) mở sẵn mặc định (có class 'open'), workspace có class 'tutor-open', nút header có class 'active' & aria-expanded='true'.
4. Bấm nút "Bắt đầu Luyện tập" (#btnGoToQuiz): Chuyển sang #quizView mượt mà.
5. Bấm lại Mục 1 trên sidebar: Chuyển lại #theoryView.
6. Chụp ảnh màn hình lưu vào Artifact Directory làm minh chứng khách quan.
7. 0 lỗi F12 Console.
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_DIR = Path(r"C:\Users\HPZBook\.gemini\antigravity\brain\ee56ad5d-2891-40b4-8bc6-f63d704a189c")
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def test_default_view_matches_h1():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Độ phân giải màn hình chuẩn 1440x900
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n" + "=" * 65)
        print("KIỂM ĐỊNH GIAO DIỆN MẶC ĐỊNH CHUẨN H1 KHI MỞ TRANG")
        print("=" * 65)

        # 1. Tải trang
        print("[1/6] Mở trang http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000")
        page.wait_for_selector(".lesson-tree-item", state="visible", timeout=10000)
        time.sleep(1.5)

        # 2. Kiểm tra Lý thuyết hiển thị mặc định
        print("[2/6] Kiểm tra View mặc định là Lý thuyết (#theoryView)...")
        theory_view = page.locator("#theoryView")
        quiz_view = page.locator("#quizView")

        assert theory_view.is_visible(), "LỖI: #theoryView không hiển thị mặc định!"
        assert "active" in (theory_view.get_attribute("class") or ""), "LỖI: #theoryView không có class 'active'!"
        assert not quiz_view.is_visible(), "LỖI: #quizView vẫn hiển thị (đang bị lỗi như H2)!"
        assert "active" not in (quiz_view.get_attribute("class") or ""), "LỖI: #quizView vẫn chứa class 'active'!"
        print("      -> THÀNH CÔNG: #theoryView đang active và hiển thị, #quizView ẩn.")

        # 3. Kiểm tra Mục 1 đang active trên Sidebar
        print("[3/6] Kiểm tra Mục 1 ('1. Thông tin và dữ liệu') active trên Sidebar...")
        sec1_subitem = page.locator(".lesson-tree-item[data-lesson-id='1'] .section-subitem[data-section-id='sec-1']")
        assert sec1_subitem.is_visible(), "LỖI: Không tìm thấy Mục 1 trong sidebar!"
        assert "active" in (sec1_subitem.get_attribute("class") or ""), "LỖI: Mục 1 không có class 'active' trên sidebar!"
        print("      -> THÀNH CÔNG: Mục 1 ('1. Thông tin và dữ liệu') đang ở trạng thái active.")

        # 4. Kiểm tra Gia sư Socrates mở sẵn mặc định
        print("[4/6] Kiểm tra Gia sư Socrates AI mở sẵn mặc định...")
        socrates_card = page.locator("#socratesPopupCard")
        workspace = page.locator(".app-workspace")
        btn_header_tutor = page.locator("#btnHeaderTutor")

        assert socrates_card.is_visible(), "LỖI: Cửa sổ Gia sư Socrates không mở mặc định!"
        assert "open" in (socrates_card.get_attribute("class") or ""), "LỖI: #socratesPopupCard thiếu class 'open'!"
        assert "tutor-open" in (workspace.get_attribute("class") or ""), "LỖI: .app-workspace thiếu class 'tutor-open'!"
        assert "active" in (btn_header_tutor.get_attribute("class") or ""), "LỖI: #btnHeaderTutor thiếu class 'active'!"
        assert btn_header_tutor.get_attribute("aria-expanded") == "true", "LỖI: #btnHeaderTutor aria-expanded != 'true'!"
        print("      -> THÀNH CÔNG: Gia sư Socrates dock bên phải mở sẵn kèm đầy đủ class trạng thái.")

        # Chụp ảnh minh chứng giao diện mặc định
        screenshot_path = ARTIFACT_DIR / "h1_default_view_verified.png"
        page.screenshot(path=str(screenshot_path))
        print(f"      -> Đã chụp ảnh minh chứng: {screenshot_path}")

        # 5. Kiểm tra chuyển sang Quiz khi bấm "Bắt đầu Luyện tập"
        print("[5/6] Kiểm tra nút 'Bắt đầu Luyện tập' (#btnGoToQuiz)...")
        btn_goto_quiz = page.locator("#btnGoToQuiz")
        assert btn_goto_quiz.is_visible(), "LỖI: Không thấy nút #btnGoToQuiz!"
        btn_goto_quiz.click()
        time.sleep(0.5)

        assert quiz_view.is_visible(), "LỖI: Bấm #btnGoToQuiz nhưng #quizView không hiển thị!"
        assert "active" in (quiz_view.get_attribute("class") or ""), "LỖI: #quizView thiếu class 'active'!"
        assert not theory_view.is_visible(), "LỖI: #theoryView vẫn hiển thị khi chuyển sang quiz!"
        print("      -> THÀNH CÔNG: Chuyển đổi sang Quiz View hoạt động trơn tru.")

        # Chuyển lại Lý thuyết qua sidebar
        print("      -> Bấm lại Mục 1 trên sidebar để quay về Lý thuyết...")
        sec1_subitem.click()
        time.sleep(0.5)
        assert theory_view.is_visible(), "LỖI: Bấm lại Mục 1 không quay lại #theoryView!"

        # 6. Kiểm tra đóng mở Socrates
        print("[6/6] Kiểm tra đóng/mở Gia sư Socrates...")
        page.keyboard.press("Escape")
        time.sleep(0.3)
        assert "open" not in (socrates_card.get_attribute("class") or ""), "LỖI: Phím Esc không đóng được Socrates!"
        assert "tutor-open" not in (workspace.get_attribute("class") or ""), "LỖI: Workspace vẫn giữ class 'tutor-open'!"

        btn_header_tutor.click()
        time.sleep(0.3)
        assert "open" in (socrates_card.get_attribute("class") or ""), "LỖI: Bấm #btnHeaderTutor không mở lại Socrates!"
        print("      -> THÀNH CÔNG: Đóng/Mở Gia sư Socrates tương tác hoàn hảo.")

        # Kiểm tra console errors
        assert len(console_errors) == 0, f"LỖI: Phát hiện {len(console_errors)} lỗi console: {console_errors}"
        print("      -> THÀNH CÔNG: 0 lỗi Console F12.")

        print("\n" + "=" * 65)
        print("KẾT LUẬN: GIAO DIỆN MẶC ĐỊNH 100% KHỚP VỚI HÌNH H1!")
        print("=" * 65)
        browser.close()


if __name__ == "__main__":
    test_default_view_matches_h1()
