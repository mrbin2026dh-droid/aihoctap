import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np

user_img_path = r'~/.gemini/antigravity/brain/ee56ad5d-2891-40b4-8bc6-f63d704a189c/.user_uploaded/media_1792291549847_58489640.png'
user_img = Image.open(user_img_path).convert('RGB')
user_arr = np.array(user_img)

text = "Mỗi buổi sáng khi nghe chuông báo thức reo, hoạt động 'tai em nghe thấy tiếng chuông reo' thuộc bước nào trong quá trình xử lí thông tin của con người?"

fonts = ['Plus Jakarta Sans', 'Be Vietnam Pro', 'Segoe UI', 'Arial', 'Inter']

html_template = """<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<link rel='preconnect' href='https://fonts.googleapis.com'>
<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>
<link href='https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,600;0,700;0,800&family=Inter:wght@600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap' rel='stylesheet'>
<style>
  body {{ margin: 0; padding: 0; background: #111827; }}
  .box {{
    width: 1024px;
    height: 73px;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    color: #f8fafc;
    font-size: 20px;
    font-weight: 700;
    line-height: 29px;
  }}
</style>
</head>
<body>
  <div class='box' id='target'>{text}</div>
</body>
</html>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    for f in fonts:
        page = browser.new_page(viewport={'width': 1024, 'height': 73})
        html = html_template.format(text=text)
        html = html.replace('font-weight: 700;', f'font-family: "{f}", sans-serif; font-weight: 700;')
        page.set_content(html, wait_until='networkidle')
        page.wait_for_timeout(500)
        out_path = f'tests/artifacts_v2/font_test_{f.replace(" ", "_")}.png'
        page.screenshot(path=out_path)

        test_img = Image.open(out_path).convert('RGB')
        test_arr = np.array(test_img)
        diff = np.mean(np.abs(user_arr.astype(float) - test_arr.astype(float)))
        print(f"Font: {f:20s} -> MAE diff with user image: {diff:.2f}")
    browser.close()
