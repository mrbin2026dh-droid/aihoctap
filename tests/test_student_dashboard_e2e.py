"""
E2E Test Suite: Quản lý Học sinh & AI Sư phạm Dashboard
Kiểm thử tự động bằng Playwright:
1. Đa độ phân giải: Desktop (1920x1080), iPad/Tablet (768x1024), Mobile Phone (375x667).
2. Đo đạc tràn ngang: document.body.scrollWidth === window.innerWidth (Zero-Overflow).
3. 0 lỗi F12 Console.
4. Kiểm thử các tương tác: Mở dashboard, KPI metrics, Donut chart, Bar chart, tìm kiếm, lọc trạng thái, modal chi tiết, gọi AI phân tích và quay lại bài học.
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


def test_student_dashboard_e2e_playwright():
    port = int(os.getenv("PORT", 8000))
    url = f"http://127.0.0.1:{port}"
    console_errors = []

    print("=" * 70)
    print("BẮT ĐẦU E2E TEST: DASHBOARD QUẢN LÝ HỌC SINH & GEMINI AI SƯ PHẠM")
    print(f"URL kiểm thử: {url}")
    print("=" * 70)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # Bắt lỗi Console F12
        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(f"[pageerror] {str(exc)}"))

        # 1. Truy cập trang web
        print("\n[1/7] Điều hướng đến trang web...")
        page.goto(url, wait_until="networkidle", timeout=15000)
        time.sleep(1)

        # 2. Bấm nút "Quản lý học sinh" trên Header
        print("[2/7] Mở sân khấu Quản lý học sinh...")
        btn_nav = page.locator("#btnNavStudentMgmt")
        assert btn_nav.is_visible(), "Nút #btnNavStudentMgmt phải hiển thị trên Header"
        btn_nav.click()
        time.sleep(0.5)

        # Kiểm tra sân khấu Quản lý học sinh hiển thị, focusCanvas bị ẩn
        stage = page.locator("#studentManagementStage")
        canvas = page.locator("#focusCanvas")
        assert stage.is_visible(), "Sân khấu #studentManagementStage phải hiển thị"
        assert not canvas.is_visible(), "Sân khấu học tập #focusCanvas phải bị ẩn"
        assert "active" in (btn_nav.get_attribute("class") or ""), "Nút #btnNavStudentMgmt phải có class 'active'"

        # 3. Kiểm tra 5 Thẻ KPI Metrics
        print("[3/7] Kiểm tra số liệu 5 thẻ KPI...")
        total_students = page.locator("#kpiTotalStudents").inner_text().strip()
        comp_count = page.locator("#kpiCompletedCount").inner_text().strip()
        avg_score = page.locator("#kpiAverageScore").inner_text().strip()
        imp_count = page.locator("#kpiImprovedCount").inner_text().strip()
        need_count = page.locator("#kpiNeedsSupportCount").inner_text().strip()

        print(f"  + Sĩ số: {total_students} em")
        print(f"  + Đã hoàn thành: {comp_count} em")
        print(f"  + Điểm trung bình: {avg_score}")
        print(f"  + Học sinh tiến bộ: {imp_count} em")
        print(f"  + Cần hỗ trợ: {need_count} em")

        assert total_students == "35", f"Sĩ số phải là 35, nhận được {total_students}"
        assert comp_count == "28", f"Số hoàn thành phải là 28, nhận được {comp_count}"
        assert "8,4" in avg_score or "8.4" in avg_score, f"Điểm TB phải là 8,4, nhận được {avg_score}"
        assert imp_count == "30", f"Tiến bộ phải là 30, nhận được {imp_count}"
        assert need_count == "5", f"Cần hỗ trợ phải là 5, nhận được {need_count}"

        # 4. Kiểm tra Biểu đồ Donut, Cột và Khối AI Insights
        print("[4/7] Kiểm tra Biểu đồ Donut, Bar Chart và Khối AI Insights...")
        donut_svg = page.locator("#smDonutChart svg")
        assert donut_svg.count() >= 1, "Biểu đồ Donut SVG phải được render"

        bar_rows = page.locator("#smTopicBarChart .sm-bar-row")
        assert bar_rows.count() == 5, f"Biểu đồ cột phải có đúng 5 chủ đề, nhận được {bar_rows.count()}"

        ai_general = page.locator("#aiGeneralText").inner_text().strip()
        assert len(ai_general) > 10, "Khối AI phải hiển thị nhận xét tổng quan"
        print(f"  + Nhận xét AI: {ai_general[:60]}...")

        # 5. Kiểm tra Bảng Danh sách Học sinh & Tương tác Lọc/Tìm kiếm
        print("[5/7] Kiểm tra Bảng danh sách học sinh, Bộ lọc và Popup chi tiết...")
        rows = page.locator("#smStudentTableBody tr")
        assert rows.count() == 35, f"Bảng phải hiển thị đủ 35 học sinh, nhận được {rows.count()}"

        # Tìm kiếm học sinh "Lê Khánh Chi"
        search_input = page.locator("#smSearchInput")
        search_input.fill("Lê Khánh Chi")
        time.sleep(0.3)
        assert rows.count() == 1, f"Tìm kiếm 'Lê Khánh Chi' phải ra 1 dòng, nhận được {rows.count()}"

        # Xóa tìm kiếm và lọc trạng thái "Cần hỗ trợ"
        search_input.fill("")
        time.sleep(0.2)
        status_filter = page.locator("#smStatusFilter")
        status_filter.select_option("needs_support")
        time.sleep(0.3)
        assert rows.count() == 5, f"Lọc 'needs_support' phải ra đúng 5 học sinh, nhận được {rows.count()}"
        status_filter.select_option("all")
        time.sleep(0.2)
        assert rows.count() == 35, "Đặt lại 'Tất cả trạng thái' phải ra đủ 35 học sinh"

        # Mở popup chi tiết học sinh đầu tiên
        first_view_btn = page.locator("#smStudentTableBody tr:first-child .btn-view-student")
        first_view_btn.click()
        time.sleep(0.3)
        modal = page.locator("#smStudentDetailModal")
        assert modal.is_visible(), "Modal chi tiết học sinh phải mở"
        modal_name = page.locator("#smModalStudentName").inner_text().strip()
        assert modal_name == "Nguyễn Minh Anh", f"Tên học sinh trong modal phải là 'Nguyễn Minh Anh', nhận được {modal_name}"

        # Đóng modal
        page.locator("#smBtnCloseModal").click()
        time.sleep(0.3)
        assert not modal.is_visible(), "Modal phải được đóng sau khi bấm nút ✕"

        # 6. Kiểm tra Nút Quay lại học bài
        print("[6/7] Kiểm tra Nút quay lại sân khấu học tập...")
        btn_back = page.locator("#smBtnBackToLesson")
        btn_back.click()
        time.sleep(0.3)
        assert not stage.is_visible(), "Sân khấu Quản lý học sinh phải bị ẩn sau khi bấm Quay lại"
        assert canvas.is_visible(), "Sân khấu học tập #focusCanvas phải hiển thị trở lại"

        # 7. Kiểm tra Bố cục Responsive & Zero-Overflow trên 3 màn hình (Desktop, iPad, Mobile)
        print("[7/7] Đo đạc Bố cục Responsive & Zero-Overflow ngang...")
        # Mở lại màn hình quản lý
        btn_nav.click()
        time.sleep(0.3)

        viewports = [
            ("Desktop Màn hình lớn", 1920, 1080),
            ("Laptop / Màn hình nhỏ", 1366, 768),
            ("iPad / Máy tính bảng", 768, 1024),
            ("Điện thoại di động (Mobile)", 375, 667)
        ]

        for name, w, h in viewports:
            page.set_viewport_size({"width": w, "height": h})
            time.sleep(0.4)
            scroll_w = page.evaluate("() => document.body.scrollWidth")
            client_w = page.evaluate("() => document.documentElement.clientWidth")
            print(f"  + [{name} {w}x{h}]: scrollWidth={scroll_w}px, clientWidth={client_w}px")
            assert scroll_w <= client_w + 1, f"Lỗi tràn ngang (Horizontal Overflow) trên {name}: scrollWidth ({scroll_w}) > clientWidth ({client_w})"

        # Kiểm tra F12 Console Errors
        print("\nKiểm tra lỗi Console F12:")
        if console_errors:
            print("❌ Phát hiện lỗi Console:")
            for err in console_errors:
                print(f"   {err}")
        else:
            print("✅ Console hoàn toàn sạch sẽ (0 error).")

        assert len(console_errors) == 0, f"Phát hiện {len(console_errors)} lỗi Console F12"

        browser.close()

    print("\n" + "=" * 70)
    print("🎉 TẤT CẢ CÁC BƯỚC E2E TEST ĐÃ ĐẠT KẾT QUẢ PASS 100%!")
    print("=" * 70)


if __name__ == "__main__":
    test_student_dashboard_e2e_playwright()
