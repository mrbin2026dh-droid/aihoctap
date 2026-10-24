import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\HPZBook\.gemini\antigravity\brain\8836a126-5e52-4023-af1d-0b2380951208"

def test_kpi_alignment():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Test trên màn hình chuẩn 1366x768 (laptop phổ biến phòng tin học)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("[1] Mở ứng dụng local http://localhost:8088/frontend/index.html...")
        page.goto("http://localhost:8088/frontend/index.html", wait_until="networkidle")
        time.sleep(1.0)

        # Chuyển sang View Dashboard
        page.evaluate("() => switchView('dashboard')")
        time.sleep(0.5)

        # 1. Trạng thái ĐÓNG Gia sư Socrates (Full Canvas view)
        print("[2] Kiểm tra 4 thẻ KPI khi ĐÓNG Socrates (Full Canvas trên 1366x768)...")
        page.evaluate("""() => {
            const workspace = document.getElementById('appWorkspace');
            if (workspace) workspace.classList.remove('tutor-open');
        }""")
        time.sleep(0.5)

        cards_info_closed = page.evaluate("""() => {
            const grid = document.querySelector('.std-kpi-grid');
            const gridRect = grid.getBoundingClientRect();
            const cards = Array.from(document.querySelectorAll('.std-kpi-card'));
            return {
                gridWidth: Math.round(gridRect.width),
                gridCols: window.getComputedStyle(grid).gridTemplateColumns,
                cards: cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const label = c.querySelector('.std-kpi-label');
                    const val = c.querySelector('.std-kpi-val');
                    const desc = c.querySelector('.std-kpi-desc');
                    return {
                        index: i,
                        top: Math.round(rect.top),
                        bottom: Math.round(rect.bottom),
                        left: Math.round(rect.left),
                        right: Math.round(rect.right),
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
        
        print("Tutor Closed Grid:", cards_info_closed["gridCols"])
        for c in cards_info_closed["cards"]:
            print(f"Card {c['index']}: w={c['width']}px, h={c['height']}px, top={c['top']}px, label='{c['labelText']}', labelOverflow={c['labelOverflow']}")

        # Kiểm tra chiều cao các thẻ đồng nhất
        heights_closed = [c["height"] for c in cards_info_closed["cards"]]
        assert max(heights_closed) - min(heights_closed) <= 2, f"Chiều cao các thẻ KPI phải đồng nhất! Hiện tại: {heights_closed}"
        assert min(heights_closed) >= 90, f"Chiều cao tối thiểu phải >= 90px! Hiện tại: {min(heights_closed)}"
        
        # Kiểm tra không có thẻ nào bị tràn chữ
        for c in cards_info_closed["cards"]:
            assert not c["labelOverflow"], f"Nhãn thẻ {c['index']} '{c['labelText']}' bị tràn/cắt chữ!"
            assert not c["valOverflow"], f"Giá trị thẻ {c['index']} bị tràn chữ!"

        # Kiểm tra gióng hàng ngang (baseline alignment)
        tops_closed = [c["top"] for c in cards_info_closed["cards"]]
        assert len(set(tops_closed)) == 1, f"Tất cả 4 thẻ khi không mở tutor phải nằm trên cùng một hàng ngang! Tops: {tops_closed}"

        # Chụp màn hình trạng thái 1
        pic_kpi_closed = os.path.join(ARTIFACT_DIR, "minh_chung_kpi_alignment_tutor_closed.png")
        page.screenshot(path=pic_kpi_closed)
        print(f"Saved: {pic_kpi_closed}")

        # 2. Mở Gia sư Socrates (.app-workspace.tutor-open) và đo đạc
        print("\n[3] Mở Gia sư Socrates và kiểm tra tính thích ứng của 4 thẻ KPI...")
        page.evaluate("""() => {
            const workspace = document.getElementById('appWorkspace');
            if (workspace) workspace.classList.add('tutor-open');
        }""")
        time.sleep(0.5)

        cards_info_tutor = page.evaluate("""() => {
            const container = document.querySelector('.focus-canvas') || document.querySelector('.main-content-area');
            const contRect = container ? container.getBoundingClientRect() : { right: window.innerWidth };
            const grid = document.querySelector('.std-kpi-grid');
            const gridRect = grid.getBoundingClientRect();
            const cards = Array.from(document.querySelectorAll('.std-kpi-card'));
            return {
                gridWidth: Math.round(gridRect.width),
                gridCols: window.getComputedStyle(grid).gridTemplateColumns,
                containerRight: Math.round(contRect.right),
                gridRight: Math.round(gridRect.right),
                cards: cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const label = c.querySelector('.std-kpi-label');
                    const val = c.querySelector('.std-kpi-val');
                    const desc = c.querySelector('.std-kpi-desc');
                    return {
                        index: i,
                        top: Math.round(rect.top),
                        bottom: Math.round(rect.bottom),
                        left: Math.round(rect.left),
                        right: Math.round(rect.right),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        labelOverflow: label ? label.scrollWidth > label.clientWidth : false,
                        valOverflow: val ? val.scrollWidth > val.clientWidth : false,
                        labelText: label ? label.textContent : '',
                        valText: val ? val.textContent : '',
                        isWithinContainer: rect.right <= contRect.right + 5
                    };
                })
            };
        }""")

        print("Tutor Open Grid:", cards_info_tutor["gridCols"])
        for c in cards_info_tutor["cards"]:
            print(f"Tutor Card {c['index']}: w={c['width']}px, h={c['height']}px, top={c['top']}px, inContainer={c['isWithinContainer']}")

        # Thẻ khi mở Socrates tự động chuyển thành lưới 2 cột cân xứng
        tutor_heights = [c["height"] for c in cards_info_tutor["cards"]]
        assert max(tutor_heights) - min(tutor_heights) <= 2, f"Chiều cao các thẻ khi mở Socrates phải đồng nhất! Hiện tại: {tutor_heights}"
        
        # Hàng 1 gồm Card 0 và 1, Hàng 2 gồm Card 2 và 3
        assert cards_info_tutor["cards"][0]["top"] == cards_info_tutor["cards"][1]["top"], "Hàng 1 phải gióng thẳng hàng!"
        assert cards_info_tutor["cards"][2]["top"] == cards_info_tutor["cards"][3]["top"], "Hàng 2 phải gióng thẳng hàng!"

        for c in cards_info_tutor["cards"]:
            assert c["isWithinContainer"], f"Thẻ {c['index']} bị tràn ra ngoài khung nhìn khi mở Socrates!"
            assert not c["labelOverflow"], f"Nhãn thẻ {c['index']} bị tràn chữ khi mở Socrates!"
            assert c["width"] >= 260, f"Độ rộng thẻ {c['index']} quá hẹp ({c['width']}px)!"

        # Chụp màn hình trạng thái 2 (Khi mở Socrates)
        pic_kpi_tutor = os.path.join(ARTIFACT_DIR, "minh_chung_kpi_alignment_tutor_open.png")
        page.screenshot(path=pic_kpi_tutor)
        print(f"Saved: {pic_kpi_tutor}")

        # 3. Test Mobile (375x812)
        print("\n[4] Kiểm tra giao diện Mobile (375x812)...")
        page.set_viewport_size({"width": 375, "height": 812})
        time.sleep(0.5)

        mobile_info = page.evaluate("""() => {
            const cards = Array.from(document.querySelectorAll('.std-kpi-card'));
            return {
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                cards: cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    return {
                        index: i,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    };
                })
            };
        }""")

        print(f"Mobile scrollWidth={mobile_info['scrollWidth']}, clientWidth={mobile_info['clientWidth']}")
        assert mobile_info["scrollWidth"] == mobile_info["clientWidth"], "Mobile không được có lỗi tràn ngang!"

        pic_mobile = os.path.join(ARTIFACT_DIR, "minh_chung_kpi_alignment_mobile.png")
        page.screenshot(path=pic_mobile)
        print(f"Saved: {pic_mobile}")

        # Kiểm tra console errors
        print(f"\nConsole errors ({len(console_errors)}):", console_errors)
        assert len(console_errors) == 0, f"Console F12 có lỗi: {console_errors}"

        browser.close()
        print("\n=== TOÀN BỘ KIỂM THỬ GIAO DIỆN KPI CARD ĐÃ PASS 100%! ===")

if __name__ == "__main__":
    test_kpi_alignment()
