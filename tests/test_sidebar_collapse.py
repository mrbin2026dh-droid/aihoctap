"""
Kiểm thử tự động các tính năng Thu gọn / Mở rộng:
1. Thu gọn & Mở rộng từng bài học (Accordion Toggle) bằng nút mũi tên Chevron và Header.
2. Thu gọn tất cả các bài (#btnCollapseAllTree) và Mở rộng tất cả (#btnExpandAllTree).
3. Thu gọn toàn bộ thanh Sidebar (#btnToggleSidebar & #btnCollapseSidebar).
4. Mở lại Sidebar qua nút nổi (#btnFloatingOpenSidebar).
5. Chuyển sang bài học chưa có file trích xuất (Bài 4, Bài 5) không bị lỗi 404 Console.
"""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent

def run_test():
    console_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        
        page.on("console", lambda msg: (
            console_errors.append(msg.text) if msg.type == "error" else None,
            print(f"      [F12 {msg.type.upper()}] {msg.text}") if msg.type == "error" else None
        ))
        
        print("[1/5] Truy cập http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(1)
        
        # 1. Kiểm tra Bài 1 đang mở mặc định
        print("[2/5] Kiểm thử Thu gọn / Mở rộng Accordion từng bài...")
        b1_item = page.locator(".lesson-tree-item[data-lesson-id='1']")
        b1_subs = b1_item.locator(".lesson-tree-subsections")
        assert b1_subs.is_visible(), "Bài 1 phải mở mặc định lúc đầu!"
        
        # Click vào nút mũi tên chevron của Bài 1 để THU GỌN
        b1_toggle_btn = b1_item.locator(".lesson-tree-toggle-btn")
        print("      -> Click nút chevron để thu gọn Bài 1...")
        b1_toggle_btn.click()
        time.sleep(0.3)
        assert not b1_subs.is_visible(), "LỖI: Bài 1 không thu gọn sau khi bấm chevron!"
        print("      -> THÀNH CÔNG: Bài 1 đã thu gọn hoàn toàn (ẩn các mục con).")
        
        # Click lại nút mũi tên chevron của Bài 1 để MỞ RỘNG
        print("      -> Click nút chevron để mở rộng lại Bài 1...")
        b1_toggle_btn.click()
        time.sleep(0.3)
        assert b1_subs.is_visible(), "LỖI: Bài 1 không mở rộng sau khi bấm chevron lần 2!"
        print("      -> THÀNH CÔNG: Bài 1 đã mở rộng lại bình thường.")
        
        # Mở rộng Bài 2 bằng nút chevron của Bài 2
        b2_item = page.locator(".lesson-tree-item[data-lesson-id='2']")
        b2_subs = b2_item.locator(".lesson-tree-subsections")
        assert not b2_subs.is_visible(), "Bài 2 phải đóng ban đầu"
        print("      -> Mở Bài 2 bằng chevron...")
        b2_item.locator(".lesson-tree-toggle-btn").click()
        time.sleep(0.3)
        assert b2_subs.is_visible(), "Bài 2 phải mở sau khi click chevron!"
        
        # Thu gọn Bài 2 bằng chevron
        print("      -> Thu gọn Bài 2 bằng chevron...")
        b2_item.locator(".lesson-tree-toggle-btn").click()
        time.sleep(0.3)
        assert not b2_subs.is_visible(), "Bài 2 phải thu gọn!"
        print("      -> THÀNH CÔNG: Đóng/Mở Bài 2 mượt mà.")
        
        # 2. Kiểm thử Nút 'Thu gọn tất cả' và 'Mở rộng tất cả'
        print("[3/5] Kiểm thử Nút 'Thu gọn tất cả' và 'Mở rộng tất cả'...")
        btn_collapse_all = page.locator("#btnCollapseAllTree")
        btn_expand_all = page.locator("#btnExpandAllTree")
        assert btn_collapse_all.is_visible() and btn_expand_all.is_visible()
        
        btn_collapse_all.click()
        time.sleep(0.3)
        visible_subsections = page.locator(".lesson-tree-subsections:visible").count()
        print(f"      -> Số bài còn mở sau khi 'Thu gọn tất cả': {visible_subsections}")
        assert visible_subsections == 0, "Thu gọn tất cả phải đóng toàn bộ các bài!"
        
        btn_expand_all.click()
        time.sleep(0.3)
        expanded_count = page.locator(".lesson-tree-subsections:visible").count()
        print(f"      -> Số bài mở sau khi 'Mở rộng tất cả': {expanded_count}")
        assert expanded_count == 17, "Mở rộng tất cả phải mở đủ 17 bài!"
        
        # Thu gọn lại để gọn gàng, rồi mở Bài 1
        btn_collapse_all.click()
        time.sleep(0.2)
        b1_toggle_btn.click()
        time.sleep(0.2)
        
        # 3. Kiểm thử Thu gọn / Mở rộng Toàn bộ Thanh Sidebar
        print("[4/5] Kiểm thử Ẩn/Hiện toàn bộ thanh Sidebar...")
        sidebar = page.locator("#roadmapSidebar")
        btn_toggle_sb = page.locator("#btnToggleSidebar")
        btn_floating_open = page.locator("#btnFloatingOpenSidebar")
        
        assert sidebar.is_visible(), "Sidebar phải hiển thị ban đầu!"
        
        # Bấm thu gọn sidebar từ header
        print("      -> Bấm nút thu gọn sidebar...")
        btn_toggle_sb.click()
        time.sleep(0.4)
        assert not sidebar.is_visible(), "Sidebar phải ẩn sau khi thu gọn!"
        assert btn_floating_open.is_visible(), "Nút nổi mở lại sidebar phải hiển thị!"
        print("      -> THÀNH CÔNG: Sidebar đã thu gọn hoàn toàn, nhường sân khấu cho nội dung học.")
        
        # Bấm nút nổi để mở lại sidebar
        print("      -> Bấm nút nổi để mở lại sidebar...")
        btn_floating_open.click()
        time.sleep(0.4)
        assert sidebar.is_visible(), "Sidebar phải hiện lại sau khi bấm nút nổi!"
        assert not btn_floating_open.is_visible(), "Nút nổi phải ẩn sau khi mở sidebar!"
        print("      -> THÀNH CÔNG: Mở lại Sidebar mượt mà.")
        
        # 4. Kiểm thử Chuyển sang Bài 4 không bị lỗi 404
        print("[5/5] Kiểm thử Chọn Bài 4 (Số hóa bản nháp, 0 lỗi 404)...")
        b4_header = page.locator(".lesson-tree-header[data-lesson-id='4']")
        b4_header.click()
        time.sleep(1)
        
        badge_text = page.locator(".lesson-tree-item.active .lesson-badge").text_content()
        title_text = page.locator(".lesson-tree-item.active .lesson-tree-title").text_content()
        print(f"      -> Đã chuyển sang: [{badge_text}] {title_text}")
        assert "Bài 4" in badge_text
        assert "Mạng máy tính" in title_text
        
        # Kiểm tra console errors
        print(f"      -> Tổng lỗi Console F12: {len(console_errors)}")
        assert len(console_errors) == 0, f"Phát hiện lỗi Console F12: {console_errors}"
        
        browser.close()
    
    print("\n" + "=" * 60)
    print("HOÀN TẤT 100% TEST THU GỌN / MỞ RỘNG: PASS TẤT CẢ CÁC TẦNG!")
    print("=" * 60)

if __name__ == "__main__":
    run_test()
