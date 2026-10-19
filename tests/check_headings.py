import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    page.goto('http://127.0.0.1:8000', wait_until='networkidle')
    page.wait_for_timeout(1000)

    # Click lesson 3 on curriculum tree
    item3 = page.locator('.lesson-tree-item[data-lesson-id="3"]')
    if item3.count() > 0:
        item3.click()
        page.wait_for_timeout(1200)

    # Check computed style of questionTitle and optionText
    data = page.evaluate("""() => {
        const qTitle = document.getElementById('questionTitle');
        const optText = document.querySelector('.option-text');
        const badge = document.getElementById('sgkSourceBadge');

        const sTitle = qTitle ? window.getComputedStyle(qTitle) : null;
        const sOpt = optText ? window.getComputedStyle(optText) : null;
        const sBadge = badge ? window.getComputedStyle(badge) : null;

        return {
            qTitleText: qTitle ? qTitle.innerText : null,
            qTitleFont: sTitle ? sTitle.fontFamily : null,
            qTitleWeight: sTitle ? sTitle.fontWeight : null,
            qTitleLetterSpacing: sTitle ? sTitle.letterSpacing : null,
            qTitleLineHeight: sTitle ? sTitle.lineHeight : null,
            optFont: sOpt ? sOpt.fontFamily : null,
            optLetterSpacing: sOpt ? sOpt.letterSpacing : null,
            badgeText: badge ? badge.innerText : null,
            badgeFont: sBadge ? sBadge.fontFamily : null
        };
    }""")

    page.screenshot(path='tests/artifacts_v2/font_bai3_verified.png')
    browser.close()

print(json.dumps(data, indent=2, ensure_ascii=False))
