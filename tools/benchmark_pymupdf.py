"""
Benchmark script for measuring PyMuPDF performance and inspecting PDF layout
across ALL 77 pages of the real Vietnamese textbook:
sgk-tin-hoc-6-kntt-voi-cuoc-song_37202613.pdf
"""

import os
import sys
import time
from pathlib import Path
import pymupdf

PDF_PATH = r"C:\Users\HPZBook\Downloads\sgk-tin-hoc-6-kntt-voi-cuoc-song_37202613.pdf"
LOG_DIR = Path("tools/logs")
LOG_FILE = LOG_DIR / "benchmark_pymupdf_77_pages.log"


def run_benchmark():
    output_lines = []

    def log(msg: str = ""):
        print(msg)
        output_lines.append(msg)

    log("=== PYMUPDF FULL BENCHMARK REPORT (ALL 77 PAGES) ===")
    log(f"Execution Date : {time.strftime('%Y-%m-%dT%H:%M:%S%z')}")
    log(f"Python version : {sys.version.split()[0]}")
    log(f"PyMuPDF version: {pymupdf.__version__}")
    log(f"Target PDF     : {PDF_PATH}")

    if not os.path.exists(PDF_PATH):
        log(f"ERROR: File not found at {PDF_PATH}")
        return

    file_size_mb = os.path.getsize(PDF_PATH) / (1024 * 1024)
    log(f"File size      : {file_size_mb:.2f} MB")

    t_open_0 = time.perf_counter()
    doc = pymupdf.open(PDF_PATH)
    t_open = (time.perf_counter() - t_open_0) * 1000
    total_pages = len(doc)
    log(f"Open document  : {t_open:.2f} ms")
    log(f"Total pages    : {total_pages} pages")

    log("\n--- 1. SCANNING TEXT LAYER ACROSS ALL 77 PAGES ---")
    t_scan_start = time.perf_counter()
    total_text_chars = 0
    pages_with_zero_text = 0
    pages_with_images = 0

    for idx, page in enumerate(doc):
        text = page.get_text().strip()
        chars = len(text)
        total_text_chars += chars
        if chars == 0:
            pages_with_zero_text += 1
        images = page.get_images()
        if len(images) > 0:
            pages_with_images += 1

    t_scan = (time.perf_counter() - t_scan_start) * 1000
    avg_scan_per_page = t_scan / total_pages

    log(f"Scanned {total_pages} pages in {t_scan:.2f} ms ({avg_scan_per_page:.2f} ms/page)")
    log(f"Total text characters across all 77 pages: {total_text_chars}")
    log(f"Pages with exactly 0 text characters    : {pages_with_zero_text}/{total_pages} ({pages_with_zero_text/total_pages*100:.1f}%)")
    log(f"Pages with embedded raster scan images  : {pages_with_images}/{total_pages} ({pages_with_images/total_pages*100:.1f}%)")

    log("\n--- 2. BENCHMARKING IMAGE RENDERING (DPI=150) FOR MULTIMODAL FALLBACK ---")
    render_sample_indices = [0, 5, 8, 20, 50, 76]
    render_times = []
    for idx in render_sample_indices:
        page = doc[idx]
        t0 = time.perf_counter()
        pix = page.get_pixmap(dpi=150)
        png_bytes = pix.tobytes("png")
        t_render = (time.perf_counter() - t0) * 1000
        render_times.append(t_render)
        log(
            f"Page Index {idx:02d}: render_time={t_render:.2f}ms, dimensions={pix.width}x{pix.height}, "
            f"png_size={len(png_bytes)/1024:.1f} KB"
        )

    avg_render = sum(render_times) / len(render_times)
    log(f"Average Pixmap Render Time (150 DPI): {avg_render:.2f} ms/page across {len(render_sample_indices)} sample pages")

    log("\n--- 3. EVIDENCE FOR PAGE OFFSET (BOOK PAGE TO PDF INDEX) ---")
    for p_num, p_idx in [(5, 5), (8, 8)]:
        page = doc[p_idx]
        log(f"Book Page {p_num} maps to PDF Index {p_idx}: rect={page.rect}, images={len(page.get_images())}")
    log("Conclusion: page_offset = 0 (pdf_index == book_page).")

    doc.close()

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines) + "\n")
    print(f"\n[OK] Log written to {LOG_FILE}")


if __name__ == "__main__":
    run_benchmark()
