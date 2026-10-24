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
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        for attempt in range(1, max_retries + 1):
            print(f"\n[Lần thử {attempt}/{max_retries}] Tải trang live với timestamp cache bust...")
            cache_bust_url = f"{LIVE_URL}?v={int(time.time())}"
            page.goto(cache_bust_url, wait_until="networkidle")
            time.sleep(2.0)

            # Chuyển sang Dashboard view
            page.evaluate("() => switchView('dashboard')")
            time.sleep(0.5)

            # Kiểm tra xem mã mới đã có .std-kpi-body chưa (thay cho .std-kpi-header-row)
            has_new_kpi = page.evaluate("() => document.querySelector('.std-kpi-body') !== null")
            if not has_new_kpi:
                print("Chưa thấy markup mới (.std-kpi-body). GitHub Pages đang deploy. Đợi 10s...")
                time.sleep(10)
                continue
            
            print("ĐÃ PHÁT HIỆN MARKUP MỚI TRÊN LIVE! TIẾN HÀNH ĐO ĐẠC...")

            # 1. Trạng thái ĐÓNG Gia sư Socrates (Full Canvas view)
            page.evaluate("""() => {
                const workspace = document.getElementById('appWorkspace');
                if (workspace) workspace.classList.remove('tutor-open');
            }""")
            time.sleep(0.5)

            cards_closed = page.evaluate("""() => {
                const cards = Array.from(document.querySelectorAll('.std-kpi-card'));
                return cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const label = c.querySelector('.std-kpi-label');
                    const val = c.querySelector('.std-kpi-val');
                    return {
                        index: i,
                        top: Math.round(rect.top),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        labelOverflow: label ? label.scrollWidth > label.clientWidth : false,
                        valOverflow: val ? val.scrollWidth > val.clientWidth : false,
                        labelText: label ? label.textContent : '',
                        valText: val ? val.textContent : ''
                    };
                });
            }""")

            print("Live Closed Socrates Cards:")
            for c in cards_closed:
                print(f"Card {c['index']}: w={c['width']}px, h={c['height']}px, top={c['top']}px, label='{c['labelText']}', overflow={c['labelOverflow']}")

            heights = [c["height"] for c in cards_closed]
            assert max(heights) - min(heights) <= 2, f"Chiều cao các thẻ trên Live phải đồng nhất! Hiện tại: {heights}"
            tops = [c["top"] for c in cards_closed]
            assert len(set(tops)) == 1, f"Tất cả 4 thẻ phải cùng 1 hàng ngang khi đóng Socrates! Tops: {tops}"

            pic_live_closed = os.path.join(ARTIFACT_DIR, "minh_chung_live_kpi_alignment_closed.png")
            page.screenshot(path=pic_live_closed)
            print(f"Saved: {pic_live_closed}")

            # 2. Trạng thái MỞ Gia sư Socrates (Tutor Open)
            page.evaluate("""() => {
                const workspace = document.getElementById('appWorkspace');
                if (workspace) workspace.classList.add('tutor-open');
            }""")
            time.sleep(0.5)

            cards_tutor = page.evaluate("""() => {
                const container = document.querySelector('.focus-canvas') || document.querySelector('.main-content-area');
                const contRect = container ? container.getBoundingClientRect() : { right: window.innerWidth };
                const cards = Array.from(document.querySelectorAll('.std-kpi-card'));
                return cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const label = c.querySelector('.std-kpi-label');
                    return {
                        index: i,
                        top: Math.round(rect.top),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        labelOverflow: label ? label.scrollWidth > label.clientWidth : false,
                        isWithinContainer: rect.right <= contRect.right + 5
                    };
                });
            }""")

            print("Live Open Socrates Cards:")
            for c in cards_tutor:
                print(f"Tutor Card {c['index']}: w={c['width']}px, h={c['height']}px, top={c['top']}px, inContainer={c['isWithinContainer']}")

            t_heights = [c["height"] for c in cards_tutor]
            assert max(t_heights) - min(t_heights) <= 2, f"Chiều cao các thẻ khi mở Socrates phải đồng nhất! Hiện tại: {t_heights}"
            for c in cards_tutor:
                assert c["isWithinContainer"], f"Thẻ {c['index']} bị tràn khỏi khung nhìn trên Live!"
                assert not c["labelOverflow"], f"Nhãn thẻ {c['index']} bị tràn chữ!"

            pic_live_tutor = os.path.join(ARTIFACT_DIR, "minh_chung_live_kpi_alignment_tutor_open.png")
            page.screenshot(path=pic_live_tutor)
            print(f"Saved: {pic_live_tutor}")

            # 3. Trạng thái Mobile (375x812)
            page.set_viewport_size({"width": 375, "height": 812})
            time.sleep(0.5)

            mobile_sw = page.evaluate("() => document.documentElement.scrollWidth")
            mobile_cw = page.evaluate("() => document.documentElement.clientWidth")
            print(f"Live Mobile scrollWidth={mobile_sw}, clientWidth={mobile_cw}")
            assert mobile_sw == mobile_cw, "Mobile không được có lỗi tràn ngang trên Live!"

            pic_live_mobile = os.path.join(ARTIFACT_DIR, "minh_chung_live_kpi_alignment_mobile.png")
            page.screenshot(path=pic_live_mobile)
            print(f"Saved: {pic_live_mobile}")

            print("\n=== TOÀN BỘ KIỂM THỬ TRÊN LIVE PRODUCTION ĐÃ PASS 100%! ===")
            browser.close()
            return True

        browser.close()
        raise TimeoutError("GitHub Pages chưa hoàn tất deploy bản mới sau nhiều lần thử.")

if __name__ == "__main__":
    test_live()
