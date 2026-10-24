"""
Kiểm thử Unit: Dynamic TOC Manager (Quản lý Mục lục Động 3 Tầng cho SGK 6, 7, 8, 9).
"""

import json
import os
import tempfile
from pathlib import Path
import pytest
import pymupdf

from backend.toc_manager import (
    compute_pdf_hash,
    get_cache_path,
    save_cached_toc,
    load_cached_toc,
    extract_embedded_toc,
    get_or_scan_pdf_toc
)


def test_pdf_hash_and_cache_path(tmp_path):
    dummy_pdf = tmp_path / "dummy_sgk_tin7.pdf"
    dummy_pdf.write_bytes(b"%PDF-1.4 dummy content")

    h = compute_pdf_hash(str(dummy_pdf))
    assert isinstance(h, str)
    assert len(h) > 0

    cache_p = get_cache_path(str(dummy_pdf))
    assert "dummy_sgk_tin7" in cache_p.name
    assert cache_p.suffix == ".json"


def test_save_and_load_cache(tmp_path):
    dummy_pdf = tmp_path / "dummy_tin8.pdf"
    dummy_pdf.write_bytes(b"%PDF-1.4 dummy content")

    sample_toc = [
        {"lesson_id": 1, "title": "Lược sử công cụ tính toán", "start_page": 5, "end_page": 9, "topic": "Chủ đề 1"},
        {"lesson_id": 2, "title": "Thông tin trong môi trường số", "start_page": 10, "end_page": 14, "topic": "Chủ đề 1"}
    ]

    saved_path = save_cached_toc(str(dummy_pdf), sample_toc)
    assert os.path.exists(saved_path)

    loaded = load_cached_toc(str(dummy_pdf))
    assert loaded is not None
    assert len(loaded) == 2
    assert loaded[0]["title"] == "Lược sử công cụ tính toán"
    assert loaded[1]["start_page"] == 10

    # Cleanup
    if os.path.exists(saved_path):
        os.remove(saved_path)


def test_extract_embedded_toc_empty(tmp_path):
    # Tạo PDF rỗng không có TOC
    dummy_pdf = tmp_path / "empty.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.save(str(dummy_pdf))
    doc.close()

    doc2 = pymupdf.open(str(dummy_pdf))
    res = extract_embedded_toc(doc2)
    doc2.close()
    assert res is None


def test_get_or_scan_pdf_toc_nonexistent():
    ok, err, items = get_or_scan_pdf_toc("path/to/nonexistent_book.pdf")
    assert ok is False
    assert "không tồn tại" in err
