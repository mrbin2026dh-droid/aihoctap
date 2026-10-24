import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\HPZBook\.gemini\antigravity\brain\8836a126-5e52-4023-af1d-0b2380951208"

def test_mobile():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Bắt đầu với Mobile viewport 375x812 (iPhone X/12/13/14)
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("[1] Mở trang local http://localhost:8088/frontend/index.html ...")
        page.goto("http://localhost:8088/frontend/index.html", wait_until="networkidle")
        time.sleep(1.0)

        # Chuyển sang View Dashboard
        page.evaluate("() => switchView('dashboard')")
        time.sleep(0.5)

        # 1. Xác minh H2: Icon Robot đã bị xóa hoàn toàn khỏi Hero banner
        print("\n[2] Kiểm tra xóa icon Robot theo yêu cầu H2...")
        icon_exists = page.evaluate("""() => {
            const wrap = document.querySelector('.std-hero-avatar-wrap');
            const icon = document.querySelector('.std-hero-robot-icon');
            const heroText = document.querySelector('.std-hero-banner')?.innerText || '';
            return {
                wrapExists: wrap !== null,
                iconExists: icon !== null,
                hasRobotEmoji: heroText.includes('🤖')
            };
        }""")
        print("Robot Icon Check:", icon_exists)
        assert not icon_exists["wrapExists"], "Khối .std-hero-avatar-wrap phải bị xóa hoàn toàn!"
        assert not icon_exists["iconExists"], "Icon robot .std-hero-robot-icon phải bị xóa hoàn toàn!"
        assert not icon_exists["hasRobotEmoji"], "Emoji 🤖 không được còn xuất hiện trong Hero banner!"

        # 2. Xác minh H1: Giao diện Responsive trên Mobile (375x812)
        print("\n[3] Kiểm tra giao diện Responsive trên Mobile (375x812)...")
        mobile_data = page.evaluate("""() => {
            const banner = document.querySelector('.std-hero-banner');
            const decor = document.querySelector('.std-hero-tech-decor');
            const grid = document.querySelector('.std-kpi-grid');
            const cards = Array.from(document.querySelectorAll('.std-kpi-card'));
            
            const bannerRect = banner ? banner.getBoundingClientRect() : null;
            const decorStyle = decor ? window.getComputedStyle(decor).display : 'none';
            const gridCols = grid ? window.getComputedStyle(grid).gridTemplateColumns : '';

            return {
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                bannerHeight: bannerRect ? Math.round(bannerRect.height) : 0,
                decorDisplay: decorStyle,
                gridCols: gridCols,
                cards: cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const label = c.querySelector('.std-kpi-label');
                    const val = c.querySelector('.std-kpi-val');
                    const desc = c.querySelector('.std-kpi-desc');
                    return {
                        index: i,
                        top: Math.round(rect.top),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        labelOverflow: label ? label.scrollWidth > label.clientWidth : false,
                        valOverflow: val ? val.scrollWidth > val.clientWidth : false,
                        descOverflow: desc ? desc.scrollWidth > desc.clientWidth : false,
                        labelText: label ? label.textContent : '',
                        valText: val ? val.textContent : '',
                        descText: desc ? desc.textContent : ''
                    };
                })
            };
        }""")

        print(f"Mobile Banner Height: {mobile_data['bannerHeight']}px (gọn gàng, không bị chiếm diện tích)")
        print(f"Mobile Tech Decor Display: {mobile_data['decorDisplay']} (đã ẩn decor thừa)")
        print(f"Mobile Grid Columns: {mobile_data['gridCols']}")
        print(f"Mobile scrollWidth={mobile_data['scrollWidth']}, clientWidth={mobile_data['clientWidth']}")

        assert mobile_data["scrollWidth"] == mobile_data["clientWidth"], "Không được có tràn ngang trên mobile!"
        assert mobile_data["decorDisplay"] == "none", "Decor laptop phải được ẩn trên mobile để tối ưu không gian!"
        assert mobile_data["bannerHeight"] <= 100, f"Chiều cao banner trên mobile phải <= 100px, hiện tại: {mobile_data['bannerHeight']}px"
        assert len(mobile_data["cards"]) == 4, "Phải có đủ 4 thẻ KPI"

        # Kiểm tra từng thẻ KPI trên mobile
        for c in mobile_data["cards"]:
            print(f"Mobile Card {c['index']}: w={c['width']}px, h={c['height']}px, label='{c['labelText']}', desc='{c['descText']}'")
            assert c["width"] >= 300, f"Thẻ {c['index']} phải rộng >= 300px trên màn hình 375px (1 cột)!"
            assert not c["labelOverflow"], f"Nhãn thẻ {c['index']} bị cắt chữ!"
            assert not c["valOverflow"], f"Giá trị thẻ {c['index']} bị cắt chữ!"
            assert not c["descOverflow"], f"Chú thích thẻ {c['index']} bị cắt chữ!"

        # Chụp màn hình Mobile
        pic_mobile = os.path.join(ARTIFACT_DIR, "minh_chung_responsive_mobile_375.png")
        page.screenshot(path=pic_mobile)
        print(f"Saved: {pic_mobile}")

        # 3. Kiểm tra trên màn hình phổ biến khác: 412x915 (Samsung Galaxy S20/S22 Ultra)
        print("\n[4] Kiểm tra trên màn hình 412x915 (Samsung Galaxy)...")
        page.set_viewport_size({"width": 412, "height": 915})
        time.sleep(0.3)
        sw412 = page.evaluate("() => document.documentElement.scrollWidth")
        cw412 = page.evaluate("() => document.documentElement.clientWidth")
        assert sw412 == cw412, "Không được tràn ngang trên màn hình 412px!"

        pic_mobile_412 = os.path.join(ARTIFACT_DIR, "minh_chung_responsive_mobile_412.png")
        page.screenshot(path=pic_mobile_412)
        print(f"Saved: {pic_mobile_412}")

        # 4. Kiểm tra Desktop 1366x768 (Laptop)
        print("\n[5] Kiểm tra Desktop 1366x768...")
        page.set_viewport_size({"width": 1366, "height": 768})
        time.sleep(0.5)

        desktop_data = page.evaluate("""() => {
            const decor = document.querySelector('.std-hero-tech-decor');
            const grid = document.querySelector('.std-kpi-grid');
            return {
                decorDisplay: decor ? window.getComputedStyle(decor).display : 'none',
                gridCols: grid ? window.getComputedStyle(grid).gridTemplateColumns : ''
            };
        }""")
        print("Desktop Decor Display:", desktop_data["decorDisplay"])
        print("Desktop Grid Cols:", desktop_data["gridCols"])
        assert desktop_data["decorDisplay"] != "none", "Trên desktop decor laptop phải hiển thị bình thường!"

        pic_desktop = os.path.join(ARTIFACT_DIR, "minh_chung_desktop_no_icon.png")
        page.screenshot(path=pic_desktop)
        print(f"Saved: {pic_desktop}")

        # 5. Console errors
        print(f"\nConsole Errors ({len(console_errors)}):", console_errors)
        assert len(console_errors) == 0, f"Console F12 có lỗi: {console_errors}"

        browser.close()
        print("\n=== TOÀN BỘ KIỂM THỬ LOCAL PASS 100%! ===")

if __name__ == "__main__":
    test_mobile()
