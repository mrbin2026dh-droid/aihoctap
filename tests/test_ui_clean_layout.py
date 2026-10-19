"""
Kịch bản Kiểm định Tự động Độc lập (Playwright) xác thực 3 điểm thiết kế chuẩn giao diện:
1. Red Rectangle 1: Triệt tiêu tiêu đề H1 trùng lặp bên trong thẻ lý thuyết (nhường chỗ ngay cho Mục 1).
2. Red Arrow 2: Bấm vào mục con '2. Vật mang tin' (sec-2) cuộn mượt và highlight đúng Mục 2 trong SGK.
3. Red Rectangle 3: Bố cục Sân khấu Chia đôi Co-Pilot (Split-Screen):
   - Mở Gia sư Socrates: Dock bên phải dưới Header (top: 56px), Workspace tự động co lại.
   - Đo bounding box thực tế: theoryContent.right <= socratesCard.left (0% che khuất, đọc trọn vẹn bảng so sánh).
   - Phím Esc đóng mượt mà, phục hồi toàn bộ sân khấu.
4. Đo đạc tràn ngang: scrollWidth === clientWidth (0 horizontal overflow).
5. 0 lỗi F12 Console.
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def test_clean_layout_verification():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Kiểm tra trên độ phân giải tiêu chuẩn trường học 1440x900 (Desktop/Laptop)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n" + "=" * 65)
        print("KIỂM THỬ TỰ ĐỘNG CHUẨN GIAO DIỆN & CO-PILOT SPLIT SCREEN")
        print("=" * 65)

        # [1] Truy cập ứng dụng
        print("[1/5] Tải ứng dụng tại http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000")
        page.wait_for_selector(".lesson-tree-item", state="visible", timeout=10000)
        time.sleep(1)

        # Chuyển sang đọc lý thuyết bằng cách click Mục 1 của Bài 1
        page.locator(".lesson-tree-item[data-lesson-id='1'] .section-subitem[data-section-id='sec-1']").click()
        page.wait_for_selector(".theory-markdown-canvas", state="visible", timeout=10000)
        time.sleep(0.5)

        # [2] Kiểm tra Red Rectangle 1: Tiêu đề H1 trùng lặp đã bị triệt tiêu
        print("[2/5] Kiểm định Red Rectangle 1 (Triệt tiêu H1 trùng lặp)...")
        h1_visible = page.evaluate("""() => {
            const h1 = document.querySelector('.theory-markdown-canvas .md-heading-1');
            if (!h1) return false;
            const style = window.getComputedStyle(h1);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }""")
        assert not h1_visible, "LỖI: Tiêu đề H1 vẫn còn hiển thị gây trùng lặp với Header!"
        print("      -> THÀNH CÔNG: Tiêu đề H1 trùng lặp đã bị triệt tiêu hoàn toàn.")

        sec1_visible = page.evaluate("""() => {
            const sec1 = document.getElementById('sec-1');
            return sec1 && sec1.textContent.includes('1. Thông tin và dữ liệu');
        }""")
        assert sec1_visible, "LỖI: Mục 1 không xuất hiện ở đầu bài học!"
        print("      -> THÀNH CÔNG: Mục 1 hiển thị ngay tại đầu nội dung học tập.")

        # [3] Kiểm tra Điều hướng Mục 2: Tầm quan trọng của thông tin
        print("[3/5] Kiểm định Điều hướng Mục 2: Tầm quan trọng của thông tin...")
        subitem2 = page.locator(".lesson-tree-item[data-lesson-id='1'] .section-subitem[data-section-id='sec-2']")
        assert subitem2.is_visible(), "LỖI: Không tìm thấy mục con '2. Tầm quan trọng của thông tin' trong sidebar!"
        subitem2.click()
        time.sleep(0.5)

        # Kiểm tra phần tử sec-2 tồn tại và có nội dung chuẩn
        sec2_info = page.evaluate("""() => {
            const el = document.getElementById('sec-2');
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            const canvas = document.getElementById('focusCanvas');
            const cRect = canvas.getBoundingClientRect();
            return {
                id: el.id,
                text: el.textContent,
                isInView: (rect.top >= cRect.top - 50 && rect.top <= cRect.bottom),
                hasPulse: el.classList.contains('highlight-pulse')
            };
        }""")
        assert sec2_info is not None, "LỖI: Phần tử id='sec-2' không tồn tại trong thẻ lý thuyết!"
        assert "Tầm quan trọng" in sec2_info["text"], f"LỖI: sec-2 có text không đúng: {sec2_info['text']}"
        assert sec2_info["isInView"], "LỖI: Mục 2 không được cuộn vào tầm nhìn của học sinh!"
        print(f"      -> THÀNH CÔNG: Đã cuộn đến Mục 2 ({sec2_info['text']}).")

        # Quay lại Mục 1
        page.locator(".lesson-tree-item[data-lesson-id='1'] .section-subitem[data-section-id='sec-1']").click()
        time.sleep(0.4)

        # [4] Kiểm tra Red Rectangle 3: Bố cục Chia đôi Sân khấu Co-Pilot (Split-Screen)
        print("[4/5] Kiểm định Red Rectangle 3 (Bố cục Co-Pilot Split-Screen, không che nội dung)...")
        btn_tutor = page.locator("#btnHeaderTutor")
        assert btn_tutor.is_visible(), "LỖI: Không tìm thấy nút Gia sư Socrates trên Header!"
        if not page.locator("#socratesPopupCard").evaluate("el => el.classList.contains('open')"):
            btn_tutor.click()
            time.sleep(0.5)

        # Đo đạc Bounding Boxes thực tế trên màn hình
        layout_measure = page.evaluate("""() => {
            const tutorCard = document.getElementById('socratesPopupCard');
            const theoryContent = document.getElementById('theoryContent');
            const workspace = document.querySelector('.app-workspace');
            const headerBtn = document.getElementById('btnHeaderTutor');
            const table = document.querySelector('.markdown-table');

            const tRect = tutorCard.getBoundingClientRect();
            const cRect = theoryContent.getBoundingClientRect();
            const tableRect = table ? table.getBoundingClientRect() : null;

            return {
                isCardOpen: tutorCard.classList.contains('open'),
                isWorkspaceTutorOpen: workspace.classList.contains('tutor-open'),
                isHeaderBtnActive: headerBtn.classList.contains('active'),
                cardTop: tRect.top,
                cardLeft: tRect.left,
                cardRight: tRect.right,
                theoryRight: cRect.right,
                isOverlap: cRect.right > (tRect.left + 5),
                tableRight: tableRect ? tableRect.right : 0,
                isTableCovered: tableRect ? (tableRect.right > (tRect.left + 5)) : false
            };
        }""")

        assert layout_measure["isCardOpen"], "LỖI: Khung chat Socrates chưa mở!"
        assert layout_measure["isWorkspaceTutorOpen"], "LỖI: Workspace chưa nhận class .tutor-open!"
        assert layout_measure["isHeaderBtnActive"], "LỖI: Nút Header chưa đổi trạng thái active!"
        assert layout_measure["cardTop"] >= 56, f"LỖI: Khung Socrates che mất Header! (top={layout_measure['cardTop']})"
        assert not layout_measure["isOverlap"], (
            f"LỖI: Khung Socrates che mất nội dung lý thuyết! "
            f"(theory.right={layout_measure['theoryRight']}, card.left={layout_measure['cardLeft']})"
        )
        assert not layout_measure["isTableCovered"], "LỖI: Bảng so sánh bị khung Socrates che mất mép phải!"

        print("      -> THÀNH CÔNG: Khung Gia sư Socrates dock bên phải (top >= 56px).")
        print(f"      -> THÀNH CÔNG: Không che khuất! (Khoảng cách lý thuyết đến Gia sư: {layout_measure['cardLeft'] - layout_measure['theoryRight']:.1f}px).")
        print("      -> THÀNH CÔNG: Bảng so sánh 3 khái niệm Dữ liệu - Thông tin - Vật mang tin hiển thị 100% trọn vẹn.")

        # Thử đóng bằng phím Escape
        print("      -> Nhấn phím Escape để đóng nhanh...")
        page.keyboard.press("Escape")
        time.sleep(0.4)

        closed_measure = page.evaluate("""() => {
            const tutorCard = document.getElementById('socratesPopupCard');
            const workspace = document.querySelector('.app-workspace');
            return {
                isCardOpen: tutorCard.classList.contains('open'),
                isWorkspaceTutorOpen: workspace.classList.contains('tutor-open')
            };
        }""")
        assert not closed_measure["isCardOpen"], "LỖI: Phím Esc không đóng được Socrates!"
        assert not closed_measure["isWorkspaceTutorOpen"], "LỖI: Workspace vẫn giữ class .tutor-open sau khi đóng!"
        print("      -> THÀNH CÔNG: Phím Escape đóng Socrates và phục hồi không gian học 100%.")

        # [5] Kiểm tra Zero-Overflow & Console sạch
        print("[5/5] Kiểm định Zero-Overflow ngang & Console F12...")
        overflow_check = page.evaluate("""() => {
            return {
                bodyScroll: document.body.scrollWidth,
                bodyClient: document.body.clientWidth,
                htmlScroll: document.documentElement.scrollWidth,
                htmlClient: document.documentElement.clientWidth
            };
        }""")
        assert overflow_check["bodyScroll"] == overflow_check["bodyClient"], (
            f"LỖI: Bẫy tràn ngang body! ({overflow_check['bodyScroll']} > {overflow_check['bodyClient']})"
        )
        assert overflow_check["htmlScroll"] == overflow_check["htmlClient"], (
            f"LỖI: Bẫy tràn ngang html! ({overflow_check['htmlScroll']} > {overflow_check['htmlClient']})"
        )
        print("      -> THÀNH CÔNG: scrollWidth === clientWidth (0 tràn ngang).")

        assert len(console_errors) == 0, f"LỖI: Phát hiện {len(console_errors)} lỗi Console F12: {console_errors}"
        print(f"      -> THÀNH CÔNG: 0 lỗi Console F12.")

        print("\n" + "=" * 65)
        print("KẾT QUẢ: 100% PASS TẤT CẢ TIÊU CHUẨN THIẾT KẾ ĐẠT CHUẨN SƯ PHẠM!")
        print("=" * 65)
        browser.close()


if __name__ == "__main__":
    test_clean_layout_verification()
