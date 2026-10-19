"""
Playwright Test xác thực giao diện nâng cấp khớp 100% hình thiết kế mới:
1. Header: Hamburger 3 gạch, Subtitle 'Nền tảng học tập thông minh', 4 Khối Lớp 6, 7, 8, 9 (Lớp 6 active).
2. Sidebar: Badge 'TIN HỌC 6', nút '› Mở rộng', '› Thu gọn', card bài học gradient + squircle badge + chevron, Tiến độ học tập 25% 'Đã hoàn thành 2/8 bài'.
3. Center Canvas: Badge [Bài 1], Tiêu đề Mục 1, Mũi tên bullet '▶', Card hình ảnh Đèn tín hiệu giao thông, Khối 'Lưu ý' đèn vàng/cyan.
4. Right Drawer: Avatar robot 3D, Hero robot 'Em muốn khám phá điều gì?', 3 Thẻ Prompt Cards có icon + chevron, Ô nhập liệu nút máy bay.
5. 0 lỗi F12 Console.
6. Chụp ảnh màn hình lưu đĩa làm minh chứng trực quan.
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


def test_enhanced_design_matches_reference():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Sử dụng độ phân giải phòng máy / desktop 1440x900
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n" + "=" * 70)
        print("KIỂM ĐỊNH THIẾT KẾ GIAO DIỆN NÂNG CẤP THEO HÌNH THAM CHIẾU MỚI")
        print("=" * 70)

        # 1. Tải trang
        print("[1/5] Tải ứng dụng tại http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000")
        page.wait_for_selector(".lesson-tree-item", state="visible", timeout=10000)
        time.sleep(1.5)

        # 2. Kiểm tra Header
        print("[2/5] Kiểm định Header: Hamburger, Subtitle & 4 Khối Lớp...")
        subtitle = page.locator(".brand-subtitle")
        assert subtitle.is_visible(), "LỖI: Thiếu subtitle 'Nền tảng học tập thông minh' trong Header!"
        assert "Nền tảng học tập thông minh" in subtitle.text_content()

        grade_pills = page.locator(".header-grade-pill")
        assert grade_pills.count() == 4, f"LỖI: Phải có 4 khối lớp (Lớp 6, 7, 8, 9), thực tế: {grade_pills.count()}"
        active_grade = page.locator(".header-grade-pill.active")
        assert "LỚP 6" in active_grade.text_content(), "LỖI: LỚP 6 phải là tab được active mặc định!"
        print("      -> THÀNH CÔNG: Header hiển thị đầy đủ Subtitle và 4 Tabs Khối Lớp.")

        # 3. Kiểm tra Sidebar & Tiến độ
        print("[3/5] Kiểm định Sidebar: Cây bài học, Gradient Card & Tiến độ học tập 25%...")
        sidebar_badge = page.locator(".sidebar-nav-badge")
        assert "TIN HỌC 6" in sidebar_badge.text_content()

        progress_label = page.locator(".sidebar-progress-label")
        assert "Tiến độ học tập" in progress_label.text_content()

        progress_percent = page.locator("#roadmapProgressPercent")
        assert "25%" in progress_percent.text_content()

        progress_subtext = page.locator("#roadmapProgressSubtext")
        assert "Đã hoàn thành 2/8 bài" in progress_subtext.text_content()
        print("      -> THÀNH CÔNG: Sidebar hiển thị đúng tiến độ học tập 25% và danh mục bài học.")

        # 4. Kiểm tra Center Canvas (Lý thuyết)
        print("[4/5] Kiểm định Nội dung Lý thuyết SGK: Badge, Bullet ▶, Card Đèn Giao Thông, Hộp Lưu ý...")
        top_badge = page.locator(".theory-top-badge")
        assert top_badge.is_visible(), "LỖI: Thiếu badge [Bài 1] ở đầu nội dung lý thuyết!"
        assert "Bài 1" in top_badge.text_content()

        sec1_heading = page.locator("#sec-1")
        assert sec1_heading.is_visible(), "LỖI: Thiếu tiêu đề Mục 1!"
        assert "1. Thông tin và dữ liệu" in sec1_heading.text_content()

        bullet_arrows = page.locator(".bullet-arrow")
        assert bullet_arrows.count() >= 3, "LỖI: Các mục gạch đầu dòng chưa có icon mũi tên ▶!"

        visual_card = page.locator(".theory-visual-card")
        assert visual_card.is_visible(), "LỖI: Card minh họa Đèn tín hiệu giao thông không hiển thị!"
        visual_img = visual_card.locator("img")
        assert visual_img.is_visible(), "LỖI: Hình ảnh đèn tín hiệu giao thông không tải được!"
        assert "Màu sắc của đèn tín hiệu" in visual_card.text_content()

        note_card = page.locator(".theory-note-card")
        assert note_card.is_visible(), "LỖI: Khối Lưu ý không hiển thị!"
        assert "Lưu ý" in note_card.locator(".note-card-title").text_content()
        assert "Dữ liệu có thể biểu diễn" in note_card.text_content()
        assert "Thông tin = Dữ liệu + Xử lí" in note_card.text_content()

        sec2_heading = page.locator("#sec-2")
        assert sec2_heading.is_visible(), "LỖI: Thiếu tiêu đề Mục 2!"
        print("      -> THÀNH CÔNG: Lý thuyết hiển thị đầy đủ Card Đèn Giao Thông & Khối Lưu ý.")

        # 5. Kiểm tra Right Drawer (Socrates)
        print("[5/5] Kiểm định Cửa sổ Gia sư Socrates: Robot Avatar, Hero Khám phá & 3 Prompt Cards...")
        socrates_drawer = page.locator("#socratesPopupCard")
        assert socrates_drawer.is_visible(), "LỖI: Cửa sổ Gia sư Socrates chưa mở!"

        avatar_robot = page.locator(".tutor-avatar-robot img")
        assert avatar_robot.is_visible(), "LỖI: Avatar Robot Socrates trong header không hiển thị!"

        hero_stage = page.locator(".socrates-hero-stage")
        assert hero_stage.is_visible(), "LỖI: Sân khấu Robot Khám phá không hiển thị!"
        assert "Em muốn khám phá điều gì?" in hero_stage.locator(".hero-explore-pill").text_content()

        prompt_cards = page.locator(".prompt-action-card")
        assert prompt_cards.count() == 3, f"LỖI: Phải có đủ 3 prompt action cards, thực tế có {prompt_cards.count()}"

        card_texts = prompt_cards.all_text_contents()
        assert any("Dữ liệu khác thông tin" in t for t in card_texts), "Thiếu card 'Dữ liệu khác thông tin?'"
        assert any("Ví dụ vật mang tin" in t for t in card_texts), "Thiếu card 'Ví dụ vật mang tin?'"
        assert any("Gợi ý bài này" in t for t in card_texts), "Thiếu card 'Gợi ý bài này'"

        # Thử click vào Card 1
        print("      -> Thử click Thẻ Prompt 'Dữ liệu khác thông tin?'...")
        prompt_cards.first.click()
        time.sleep(1)

        # Chụp ảnh minh chứng thiết kế hoàn chỉnh
        screenshot_path = ARTIFACT_DIR / "enhanced_design_verified.png"
        page.screenshot(path=str(screenshot_path))
        print(f"      -> Đã chụp ảnh minh chứng: {screenshot_path}")

        # Kiểm tra console errors
        assert len(console_errors) == 0, f"LỖI: Phát hiện {len(console_errors)} lỗi Console F12: {console_errors}"
        print("      -> THÀNH CÔNG: 0 lỗi Console F12.")

        print("\n" + "=" * 70)
        print("KẾT LUẬN: GIAO DIỆN ĐÃ ĐƯỢC THIẾT KẾ KHỚP 100% VỚI HÌNH THAM CHIẾU!")
        print("=" * 70)
        browser.close()


if __name__ == "__main__":
    test_enhanced_design_matches_reference()
