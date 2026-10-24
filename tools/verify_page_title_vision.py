"""
Script doc tieu de trang in bang Gemini Multimodal Vision tu anh raster (P0-C & P1-D Resolved).
1. Trich xuat anh raster 150 DPI tu trang PDF index 5 (Bai 1) va index 8 (Bai 2).
2. Luu anh mau xuong dia cung: tools/logs/page_05_sample.png va tools/logs/page_08_sample.png.
3. Goi Gemini Vision (gemini-3.5-flash-lite) voi HttpOptions(timeout=30000).
4. Luu toan van prompt, timestamp va phan hoi vao tools/logs/verify_page_title_vision.log.
"""

import os
import sys
import time
from datetime import datetime
from pathlib import Path
import dotenv
import pymupdf

# Thiet lap UTF-8 cho console Windows
sys.stdout.reconfigure(encoding="utf-8")

# Nap bien moi truong
dotenv.load_dotenv(".env")
dotenv.load_dotenv("backend/.env")

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
PDF_PATH = r"sgk-sample.pdf"
LOG_DIR = Path("tools/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "verify_page_title_vision.log"


def main():
    if not os.path.exists(PDF_PATH):
        print(f"[LOI] Khong tim thay tep PDF tai: {PDF_PATH}")
        sys.exit(1)

    if not API_KEY:
        print("[LOI] Chua co GEMINI_API_KEY trong .env")
        sys.exit(1)

    from google import genai
    from google.genai import types

    http_opts = types.HttpOptions(timeout=30000)
    client = genai.Client(api_key=API_KEY, http_options=http_opts)

    doc = pymupdf.open(PDF_PATH)
    test_pages = [
        {
            "pdf_index": 5,
            "description": "Trang in 5 (Bài 1)",
            "sample_png": LOG_DIR / "page_05_sample.png",
            "prompt": "Đọc tiêu đề bài học lớn nhất trên trang này, chỉ in ra tiêu đề không thêm giải thích."
        },
        {
            "pdf_index": 8,
            "description": "Trang in 8 (Bài 2)",
            "sample_png": LOG_DIR / "page_08_sample.png",
            "prompt": "Đọc tiêu đề bài học lớn nhất trên trang này, chỉ in ra tiêu đề không thêm giải thích."
        },
        {
            "pdf_index": 10,
            "description": "Trang in 10 (Mục 2 & Hình 1.2)",
            "sample_png": LOG_DIR / "page_10_sample.png",
            "prompt": "Đọc tiêu đề mục chính và tên Hình có trên trang này (ví dụ Hình 1.x)."
        }
    ]

    log_lines = []
    log_lines.append("=== GEMINI MULTIMODAL VISION PAGE TITLE VERIFICATION REPORT ===")
    log_lines.append(f"Timestamp   : {datetime.now().isoformat()}")
    log_lines.append(f"Target PDF  : {PDF_PATH}")
    log_lines.append(f"Model       : {MODEL_NAME}")
    log_lines.append(f"Timeout     : 30000 ms (HttpOptions)")
    log_lines.append("-" * 65)

    print("\n--- BAT DAU THAM DINH TIEU DE TRANG BANG GEMINI VISION ---")

    for tp in test_pages:
        idx = tp["pdf_index"]
        page = doc[idx]
        pix = page.get_pixmap(dpi=150)
        pix.save(str(tp["sample_png"]))
        png_bytes = pix.tobytes("png")

        prompt = tp["prompt"]
        img_part = types.Part.from_bytes(data=png_bytes, mime_type="image/png")

        t0 = time.time()
        resp = client.models.generate_content(
            model=MODEL_NAME,
            contents=[img_part, prompt],
            config=types.GenerateContentConfig(
                temperature=0.0,
                http_options=http_opts
            )
        )
        latency_ms = (time.time() - t0) * 1000
        verbatim_text = resp.text.strip() if resp.text else ""

        print(f"Trang PDF Index {idx:02d} ({tp['description']}):")
        print(f"  Anh raster  : {tp['sample_png']} ({pix.width}x{pix.height}, {len(png_bytes)/1024:.1f} KB)")
        print(f"  Latency     : {latency_ms:.1f} ms")
        print(f"  Tieu de doc : {verbatim_text}")
        print()

        log_lines.append(f"PDF Index {idx:02d} ({tp['description']}):")
        log_lines.append(f"  Sample Image: {tp['sample_png'].name} ({pix.width}x{pix.height})")
        log_lines.append(f"  Latency     : {latency_ms:.1f} ms")
        log_lines.append(f"  Prompt      : {prompt}")
        log_lines.append(f"  Response    : {verbatim_text}")
        log_lines.append("-" * 65)

    doc.close()

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines) + "\n")

    print(f"-> Da ghi toan van nhat ky vao: {LOG_FILE}")


if __name__ == "__main__":
    main()
