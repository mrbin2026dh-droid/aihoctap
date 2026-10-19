import sys, shutil
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

artifact_dir = Path("C:/Users/HPZBook/.gemini/antigravity/brain/ee56ad5d-2891-40b4-8bc6-f63d704a189c")
artifact_dir.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    page.goto("http://127.0.0.1:8000", wait_until="networkidle")
    page.wait_for_timeout(1000)

    # Click lesson 2 on curriculum tree
    item2 = page.locator('.lesson-tree-item[data-lesson-id="2"]')
    if item2.count() > 0:
        item2.click()
        page.wait_for_timeout(1200)

    # Capture the question card area specifically
    qcard = page.locator(".question-card")
    if qcard.count() > 0:
        out_card = artifact_dir / "question_card_fixed.png"
        qcard.screenshot(path=str(out_card))
        print(f"Captured: {out_card}")

    # Capture full page view
    out_full = artifact_dir / "font_fix_verified_live.png"
    page.screenshot(path=str(out_full))
    print(f"Captured: {out_full}")
    browser.close()

# Copy comparison image
comp_src = Path("tests/artifacts_v2/font_proof_comparison.png")
if comp_src.exists():
    out_comp = artifact_dir / "font_proof_comparison.png"
    shutil.copy(comp_src, out_comp)
    print(f"Copied: {out_comp}")
