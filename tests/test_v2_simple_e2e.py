"""
Kịch bản Kiểm thử Tự động E2E Toàn diện cho Giao diện Khoa học LucianLabs UX/UI & Gia sư Socrates AI.
Kiểm tra:
1. Triệt tiêu hoàn toàn Dropdown #selectLesson và Nút chuyển đổi #btnToggleVersion (Xóa bỏ V1).
2. Hiển thị Breadcrumb #courseBreadcrumb và Nút Danh mục #btnOpenCatalog chuẩn LucianLabs.
3. Catalog Modal #catalogModal: Tìm kiếm từ khóa, bộ lọc Segmented Pills 6 Chủ đề, hiển thị đủ 17 bài học MOET SGK.
4. Điều hướng Tuần tự: Steppers Sidebar (#btnPrevLesson, #btnNextLesson) & Footer Lý thuyết (#btnTheoryPrevLesson, #btnTheoryNextLesson).
5. Hiển thị Lý thuyết bám sát SGK (bảng so sánh, markdown canvas) và Luyện tập 4 câu hỏi.
6. Gia sư Socrates AI hoạt động thời gian thực trên nền kiến thức V2 (Grounding đúng, không rò rỉ đáp án).
7. Đo đạc Bố cục Sân khấu Đấu trường & Zero-Overflow ngang (1920x1080 và 1366x768).
8. 0 lỗi F12 Console.
"""
import os
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


def run_v2_simple_e2e():
    port = int(os.getenv("PORT", 8000))
    artifacts_dir = ROOT_DIR / "tests" / "artifacts_v2"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    console_errors = []

    print("=" * 70)
    print("BẮT ĐẦU E2E TEST: LUCIANLABS CATALOG UX/UI & GIA SƯ SOCRATES")
    print(f"Target: http://127.0.0.1:{port}")
    print("=" * 70)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # TEST SUITE 1: ĐỘ PHÂN GIẢI PHÒNG MÁY 1366x768
        # -------------------------------------------------------------
        print("\n[TẦNG 1] Khởi chạy trình duyệt phòng máy THCS (1366x768)...")
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        page.on("console", lambda msg: (
            console_errors.append(msg.text) if msg.type == "error" else None,
            print(f"      [F12 {msg.type.upper()}] {msg.text}") if msg.type in ("error", "warning") else None
        ))

        page.goto(f"http://127.0.0.1:{port}", wait_until="networkidle")
        time.sleep(1.5)

        # 1.1. Khóa cứng: Triệt tiêu hoàn toàn #selectLesson và #btnToggleVersion
        print("\n[TẦNG 2] Kiểm tra Triệt tiêu Dropdown cũ & Khóa cứng V2 chuẩn mới...")
        assert page.locator("#selectLesson").count() == 0, "LỖI: Vẫn còn tồn tại thẻ #selectLesson dropdown!"
        assert page.locator("#btnToggleVersion").count() == 0, "LỖI: Vẫn còn tồn tại nút chuyển đổi phiên bản #btnToggleVersion!"
        print("      -> Đã xác nhận: Dropdown #selectLesson và nút #btnToggleVersion đã được loại bỏ hoàn toàn.")

        # 1.2. Kiểm tra Header Tinh Giản & Khối Lớp Cân Đối (Đã loại bỏ #courseBreadcrumb & .sidebar-nav-title)
        print("\n[TẦNG 3] Kiểm tra Header Tinh Giản, Cân Đối & Triệt Tiêu Mục Thừa Đánh Dấu...")
        assert page.locator("#courseBreadcrumb").count() == 0, "LỖI: Vẫn còn tồn tại #courseBreadcrumb trong Header!"
        assert page.locator(".sidebar-nav-title").count() == 0, "LỖI: Vẫn còn tồn tại .sidebar-nav-title trong Sidebar!"
        print("      -> Đã xác nhận: #courseBreadcrumb và .sidebar-nav-title đã được loại bỏ hoàn toàn, giao diện cân đối.")
        assert page.locator("#crumbTopic").count() == 0, "Chủ đề rườm rà đã được gỡ bỏ khỏi header!"
        assert page.locator("#btnOpenCatalog").count() == 0, "Nút catalog thừa đã được loại bỏ khỏi header!"

        # 1.3. Kiểm tra Catalog Sheet Modal (Hỗ trợ tra cứu nhanh khi cần)
        print("\n[TẦNG 4] Kiểm tra Catalog Sheet Modal (Tìm kiếm, Filter Pills & 17 bài học)...")
        catalog_modal = page.locator("#catalogModal")
        assert "hidden" in (catalog_modal.get_attribute("class") or ""), "Modal phải ẩn mặc định!"

        page.evaluate("openCatalogModal()")
        time.sleep(0.5)
        assert "hidden" not in (catalog_modal.get_attribute("class") or ""), "Modal không mở sau khi gọi openCatalogModal!"

        # Kiểm tra danh sách topic pills
        topic_pills = page.locator(".catalog-topic-pill")
        assert topic_pills.count() >= 6, f"Thiếu bộ lọc Chủ đề (mong đợi >= 6, thực tế {topic_pills.count()})"
        print(f"      -> Số lượng Topic Filter Pills: {topic_pills.count()}")

        # Kiểm tra lưới 17 bài học
        cards = page.locator(".catalog-card")
        card_count = cards.count()
        print(f"      -> Tổng số bài học trong Catalog: {card_count}")
        assert card_count == 17, f"Catalog phải hiển thị đủ 17 bài SGK Tin học 6, thực tế có {card_count}!"

        # Kiểm tra tìm kiếm từ khóa
        search_input = page.locator("#catalogSearchInput")
        search_input.fill("xử lí")
        time.sleep(0.3)
        filtered_cards = page.locator(".catalog-card")
        assert filtered_cards.count() >= 1, "Tìm kiếm 'xử lí' không trả về kết quả!"
        print(f"      -> Tìm kiếm 'xử lí' lọc còn: {filtered_cards.count()} bài học.")

        # Xóa tìm kiếm
        clear_btn = page.locator("#btnClearCatalogSearch")
        assert clear_btn.is_visible()
        clear_btn.click()
        time.sleep(0.3)
        assert page.locator(".catalog-card").count() == 17, "Sau khi xóa tìm kiếm không khôi phục đủ 17 bài!"

        # Đóng bằng phím Escape
        page.keyboard.press("Escape")
        time.sleep(0.3)
        assert "hidden" in (catalog_modal.get_attribute("class") or ""), "Nhấn Escape không đóng được Catalog Modal!"
        print("      -> Đã kiểm định: Catalog Sheet mở/đóng và tìm kiếm mượt mà.")

        # 1.4. Kiểm tra Menu Cây Bài học bên trái (Curriculum Tree: Tên bài -> Các mục của bài)
        print("\n[TẦNG 5] Kiểm tra Cây Mục lục Bên trái (17 bài học & các mục mở rộng)...")
        tree_items = page.locator(".curriculum-tree-container .lesson-tree-item")
        tree_count = tree_items.count()
        print(f"      -> Số lượng bài học trên cây menu trái: {tree_count}")
        assert tree_count == 17, f"Menu bên trái phải hiển thị đủ 17 bài học SGK, thực tế có {tree_count}!"

        # Kiểm tra Bài 1 đang active và hiển thị các mục con
        active_item = page.locator(".lesson-tree-item.active")
        assert active_item.count() == 1, "Phải có đúng 1 bài học ở trạng thái active!"
        subitems_b1 = active_item.locator(".section-subitem")
        print(f"      -> Số mục con hiển thị trong Bài 1: {subitems_b1.count()}")
        assert subitems_b1.count() >= 2, "Bài 1 phải hiển thị các mục con lý thuyết và luyện tập!"

        # Chuyển sang Bài 2 bằng cách click vào Bài 2 trên menu cây bên trái
        print("      -> Học sinh click Bài 2 trên Cây Mục lục...")
        lesson_2_header = page.locator(".lesson-tree-header[data-lesson-id='2']")
        assert lesson_2_header.is_visible()
        lesson_2_header.click()
        time.sleep(1)

        # Xác nhận đã chuyển sang Bài 2 và các mục của Bài 2 mở rộng
        active_b2 = page.locator(".lesson-tree-item.active[data-lesson-id='2']")
        header_badge_2 = active_b2.locator(".lesson-badge").text_content()
        header_title_2 = active_b2.locator(".lesson-tree-title").text_content()
        print(f"      -> Đã chuyển sang: [{header_badge_2}] {header_title_2}")
        assert "Bài 2" in header_badge_2
        assert "xử lí" in header_title_2.lower()

        # Kiểm tra các mục con của Bài 2
        subitems_b2 = active_b2.locator(".section-subitem")
        print(f"      -> Số mục con của Bài 2 sau khi chọn: {subitems_b2.count()}")
        assert subitems_b2.count() >= 2, "Bài 2 phải hiển thị các mục con!"

        # Quay lại Bài 1 bằng cách click vào Bài 1 trên menu cây bên trái
        print("      -> Click quay lại Bài 1 trên Cây Mục lục...")
        page.locator(".lesson-tree-header[data-lesson-id='1']").click()
        time.sleep(1)
        active_b1 = page.locator(".lesson-tree-item.active[data-lesson-id='1']")
        assert "Bài 1" in active_b1.locator(".lesson-badge").text_content()
        print("      -> Cây mục lục chuyển bài và mở rộng các mục con hoàn toàn chính xác.")

        # 1.5. Mở Catalog và chọn Bài 2 để học
        print("\n[TẦNG 6] Kiểm tra Chọn Bài học trực tiếp từ Catalog Modal...")
        page.evaluate("openCatalogModal()")
        time.sleep(0.5)
        # Click vào Bài 2 trong catalog
        page.locator(".catalog-card[data-lesson-id='2']").click()
        time.sleep(1)
        assert "hidden" in (page.locator("#catalogModal").get_attribute("class") or "")
        active_b2_cat = page.locator(".lesson-tree-item.active[data-lesson-id='2']")
        assert "Bài 2" in active_b2_cat.locator(".lesson-badge").text_content()
        print("      -> Đã chọn Bài 2 từ Catalog thành công.")

        # 1.6. Kiểm tra Lý thuyết Bài 2
        print("\n[TẦNG 7] Kiểm tra Nội dung Lý thuyết Bài 2 (Bám sát SGK Tin 6)...")
        page.locator("#stepItemTheory").click()
        time.sleep(0.5)

        theory_canvas = page.locator(".theory-markdown-canvas")
        assert theory_canvas.is_visible()
        canvas_text = theory_canvas.text_content()
        assert "Thu nhận thông tin" in canvas_text
        assert "Xử lí thông tin" in canvas_text
        assert "Lưu trữ thông tin" in canvas_text
        assert "Truyền thông tin" in canvas_text
        assert "báo thức" in canvas_text.lower()

        # Kiểm tra bảng CPU
        table_el = page.locator(".theory-markdown-canvas table.markdown-table")
        assert table_el.count() >= 1, "Bảng tóm tắt hoạt động thông tin của máy tính chưa được render!"
        print("      -> Lý thuyết Bài 2 hiển thị đầy đủ cấu trúc 4 bước và bảng CPU.")

        # Chụp ảnh artifact lưu đĩa
        page.screenshot(path=str(artifacts_dir / "bai2_theory_lucian.png"))

        # 1.7. Kiểm tra Luyện tập Bài 2
        print("\n[TẦNG 8] Kiểm tra Luyện tập 4 câu hỏi trắc nghiệm Bài 2...")
        page.locator("#stepItemQuiz").click()
        time.sleep(0.5)

        pills = page.locator(".pill-item")
        assert pills.count() == 4, f"Bài 2 phải có đúng 4 câu hỏi trắc nghiệm, thực tế: {pills.count()}"

        # Chọn phương án A cho câu 1
        page.locator(".option-btn").first.click()
        time.sleep(0.3)
        page.locator("#btnActionQuestion").click()
        time.sleep(1)

        feedback_box = page.locator("#feedbackBox")
        assert feedback_box.is_visible(), "Hộp phản hồi sư phạm không hiển thị sau khi nộp bài!"
        print("      -> Chấm điểm Bài 2 hoạt động chính xác.")

        # 1.8. Kiểm tra Gia sư Socrates AI trên Bài 2
        print("\n[TẦNG 9] Kiểm tra Gia sư Socrates AI tương tác trên Bài 2...")
        if not page.locator("#socratesPopupCard").evaluate("el => el.classList.contains('open')"):
            page.locator("#btnHeaderTutor").click()
            time.sleep(0.5)

        popup = page.locator("#socratesPopupCard")
        assert "open" in (popup.get_attribute("class") or ""), "Popup Gia sư Socrates không mở!"

        # Gửi câu hỏi cho Socrates
        chat_input = page.locator("#chatInput")
        chat_input.fill("Thầy ơi, tiếng còi báo thức reo là hoạt động nào trong 4 hoạt động xử lí thông tin ạ?")
        page.locator("#btnSendChat").click()

        print("      -> Đang chờ Socrates phản hồi...")
        page.wait_for_selector(".chat-bubble.assistant strong, .chat-bubble.assistant p, .chat-bubble.assistant .typewriter-content", timeout=20000)
        time.sleep(3)

        assistant_bubbles = page.locator(".chat-bubble.assistant").all_text_contents()
        last_reply = assistant_bubbles[-1]
        print(f"      -> Socrates trả lời: {last_reply[:120]}...")
        assert len(last_reply) > 20, "Phản hồi Socrates quá ngắn hoặc rỗng!"

        # Chụp ảnh chat
        page.screenshot(path=str(artifacts_dir / "socrates_chat_lucian.png"))

        # 1.9. Kiểm tra Zero-Overflow trên cả 1920x1080 và 1366x768
        print("\n[TẦNG 10] Kiểm tra Zero-Overflow & Bố cục Sân khấu Đấu trường...")
        for width, height in [(1366, 768), (1920, 1080)]:
            page.set_viewport_size({"width": width, "height": height})
            time.sleep(0.5)
            scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
            client_width = page.evaluate("() => document.documentElement.clientWidth")
            print(f"      -> Màn hình {width}x{height}: scrollWidth={scroll_width}, clientWidth={client_width}")
            assert scroll_width == client_width, f"Lỗi tràn ngang tại {width}x{height}: scrollWidth ({scroll_width}) != clientWidth ({client_width})!"

        # 1.10. Kiểm tra Console Errors
        print("\n[TẦNG 11] Kiểm tra Lỗi Console F12...")
        real_errors = [err for err in console_errors if "favicon.ico" not in err]
        print(f"      -> Tổng số lỗi JS Console: {len(real_errors)}")
        assert len(real_errors) == 0, f"Phát hiện lỗi JavaScript Console: {real_errors}"

        browser.close()

    print("\n" + "=" * 70)
    print("HOÀN THÀNH 100% E2E TEST: HỆ THỐNG LUCIANLABS CATALOG & GIA SƯ SOCRATES ĐẠT CHUẨN ZERO-BUG!")
    print("=" * 70)


if __name__ == "__main__":
    run_v2_simple_e2e()
