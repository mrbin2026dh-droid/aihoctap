from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np

html = """<!DOCTYPE html>
<html>
<body style='margin:0; padding:0; background:#111827; color:#fff;'>
  <div style='font-family: "Segoe UI", sans-serif; font-size: 20px; font-weight: 700; line-height: 29px; width: 200px;'>Mỗi buổi</div>
</body>
</html>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 200, 'height': 50})
    page.set_content(html)
    page.screenshot(path='tests/artifacts_v2/segoe_test.png')
    browser.close()

img = Image.open('tests/artifacts_v2/segoe_test.png').convert('L')
arr = np.array(img)
col_diff = (arr > 100).sum(axis=0)
cols = np.where(col_diff > 0)[0]
print('Segoe UI text spans from', cols[0], 'to', cols[-1])

# Also let's compare with Be Vietnam Pro
html_bvp = """<!DOCTYPE html>
<html>
<head>
<link rel='preconnect' href='https://fonts.googleapis.com'>
<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>
<link href='https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@700&display=swap' rel='stylesheet'>
</head>
<body style='margin:0; padding:0; background:#111827; color:#fff;'>
  <div style='font-family: "Be Vietnam Pro", sans-serif; font-size: 20px; font-weight: 700; line-height: 29px; width: 200px;'>Mỗi buổi</div>
</body>
</html>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 200, 'height': 50})
    page.set_content(html_bvp, wait_until='networkidle')
    page.screenshot(path='tests/artifacts_v2/bvp_test.png')
    browser.close()

img_bvp = Image.open('tests/artifacts_v2/bvp_test.png').convert('L')
arr_bvp = np.array(img_bvp)
cols_bvp = np.where((arr_bvp > 100).sum(axis=0) > 0)[0]
print('Be Vietnam Pro text spans from', cols_bvp[0], 'to', cols_bvp[-1])
