import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\HPZBook\.gemini\antigravity\brain\8836a126-5e52-4023-af1d-0b2380951208"
LIVE_URL = "https://mrbin2026dh-droid.github.io/aisgk/"

def test_live():
    print(f"Bắt đầu kiểm tra Live URL: {LIVE_URL} ...")
    max_retries = 8

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile viewport 375x812
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        for attempt in range(1, max_retries + 1):
            print(f"\n[Lần thử {attempt}/{max_retries}] Tải trang live với timestamp cache bust...")
            cache_bust_url = f"{LIVE_URL}?v={int(time.time())}"
            page.goto(cache_bust_url, wait_until="networkidle")
            time.sleep(2.0)

            # Chuyển sang View Dashboard
            page.evaluate("() => switchView('dashboard')")
            time.sleep(0.5)

            # Kiểm tra xem icon robot đã bị xóa trên live chưa
            icon_check = page.evaluate("""() => {
                const wrap = document.querySelector('.std-hero-avatar-wrap');
                const heroText = document.querySelector('.std-hero-banner')?.innerText || '';
                return {
                    wrapExists: wrap !== null,
                    hasRobot: heroText.includes('🤖')
                };
            }""")

            if icon_check["wrapExists"] or icon_check["hasRobot"]:
                print("Chưa thấy bản cập nhật xóa icon robot trên Live. Đợi 10s...")
                time.sleep(10)
                continue

            print("XÁC NHẬN: ICON ROBOT ĐÃ BIẾN MẤT TRÊN LIVE!")

            # Kiểm tra responsive mobile trên Live
            live_mobile = page.evaluate("""() => {
                const banner = document.querySelector('.std-hero-banner');
                const decor = document.querySelector('.std-hero-tech-decor');
                const grid = document.querySelector('.std-kpi-grid');
                const cards = Array.from(document.querySelectorAll('.std-kpi-card'));

                const decorDisplay = decor ? window.getComputedStyle(decor).display : 'none';
                const gridCols = grid ? window.getComputedStyle(grid).gridTemplateColumns : '';

                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    clientWidth: document.documentElement.clientWidth,
                    decorDisplay: decorDisplay,
                    gridCols: gridCols,
                    cards: cards.map((c, i) => {
                        const rect = c.getBoundingClientRect();
                        const label = c.querySelector('.std-kpi-label');
                        const val = c.querySelector('.std-kpi-val');
                        const desc = c.querySelector('.std-kpi-desc');
                        return {
                            index: i,
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

            print("Live Mobile Decor Display:", live_mobile["decorDisplay"])
            print("Live Mobile Grid Columns:", live_mobile["gridCols"])
            print(f"Live Mobile scrollWidth={live_mobile['scrollWidth']}, clientWidth={live_mobile['clientWidth']}")

            assert live_mobile["decorDisplay"] == "none", "Decor laptop phải ẩn trên mobile live!"
            assert live_mobile["scrollWidth"] == live_mobile["clientWidth"], "Không được tràn ngang trên mobile live!"

            for c in live_mobile["cards"]:
                print(f"Live Mobile Card {c['index']}: w={c['width']}px, h={c['height']}px, label='{c['labelText']}', desc='{c['descText']}'")
                assert c["width"] >= 300, f"Thẻ {c['index']} phải full-width (>= 300px) trên mobile!"
                assert not c["labelOverflow"], f"Nhãn thẻ {c['index']} bị cắt chữ trên live!"
                assert not c["descOverflow"], f"Chú thích thẻ {c['index']} bị cắt chữ trên live!"

            pic_live_mobile = os.path.join(ARTIFACT_DIR, "minh_chung_live_mobile_redesign_pass.png")
            page.screenshot(path=pic_live_mobile)
            print(f"Saved: {pic_live_mobile}")

            # Chuyển sang Desktop 1366x768 để chụp minh chứng desktop
            page.set_viewport_size({"width": 1366, "height": 768})
            time.sleep(0.5)
            pic_live_desktop = os.path.join(ARTIFACT_DIR, "minh_chung_live_desktop_no_icon_pass.png")
            page.screenshot(path=pic_live_desktop)
            print(f"Saved: {pic_live_desktop}")

            assert len(console_errors) == 0, f"F12 console errors trên live: {console_errors}"
            print("\n=== TOÀN BỘ KIỂM THỬ TRÊN LIVE PRODUCTION ĐÃ PASS 100%! ===")
            browser.close()
            return True

        browser.close()
        raise TimeoutError("GitHub Pages chưa hoàn tất deploy sau nhiều lần thử.")

if __name__ == "__main__":
    test_live()
