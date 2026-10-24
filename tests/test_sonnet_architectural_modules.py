"""
Kiểm thử đơn vị cho 3 tầng kiến trúc mở rộng do Claude 3.5 Sonnet đề xuất:
1. backend/ocr_layer.py
2. backend/socratic_semantic.py
3. backend/bundle.py
"""
import pytest
from pathlib import Path
import json

def test_ocr_layer_empty_and_fallback():
    from backend.ocr_layer import ocr_page_png, page_text, OcrLine
    assert ocr_page_png(b"") == []

    # Test page_text filter
    sample_lines = [
        OcrLine(text="Dòng 1", bbox=(0, 0, 10, 10), confidence=0.9),
        OcrLine(text="Dòng 2 nhiễu", bbox=(0, 0, 10, 10), confidence=0.3),
        OcrLine(text="Dòng 3", bbox=(0, 0, 10, 10), confidence=0.8)
    ]
    extracted = page_text(sample_lines, min_conf=0.6)
    assert "Dòng 1" in extracted
    assert "Dòng 3" in extracted
    assert "Dòng 2 nhiễu" not in extracted


def test_socratic_semantic_advisor():
    from backend.socratic_semantic import semantic_leak_score, flag_for_review

    # Ca 1: Gợi ý chứa y hệt đáp án -> score = 1.0, flag = True
    assert semantic_leak_score("Đáp án chính là Dữ liệu nhé em", "Dữ liệu") == 1.0
    assert flag_for_review("Đáp án chính là Dữ liệu nhé em", "Dữ liệu") is True

    # Ca 2: Gợi ý sư phạm gợi mở tốt -> score thấp, flag = False
    clean_hint = "Em hãy quan sát đèn tín hiệu giao thông xem màu sắc của nó mang lại điều gì cho người đi đường?"
    score_clean = semantic_leak_score(clean_hint, "Bộ nhớ trong")
    assert score_clean < 0.50
    assert flag_for_review(clean_hint, "Bộ nhớ trong", threshold=0.75) is False

    # Ca 3: Chuỗi rỗng an toàn
    assert semantic_leak_score("", "Đáp án") == 0.0
    assert semantic_leak_score("Gợi ý", "") == 0.0


def test_offline_bundle_build_and_verify(tmp_path):
    from backend.bundle import build_bundle, verify_bundle

    curriculum_dir = tmp_path / "curriculum"
    tin6_dir = curriculum_dir / "tin6"
    tin6_dir.mkdir(parents=True)

    # Tạo 1 bài mẫu
    b1_file = tin6_dir / "bai1.blocks.json"
    b1_file.write_text(json.dumps({
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 1,
        "title": "Bài 1",
        "status": "published"
    }, ensure_ascii=False), encoding="utf-8")

    out_zip = tmp_path / "sgk_offline_v2.zip"

    # Đóng gói bundle
    manifest = build_bundle(curriculum_dir, out_zip, version="2.0.0")
    assert manifest["version"] == "2.0.0"
    assert manifest["file_count"] == 1
    assert "tin6/bai1.blocks.json" in manifest["files"]
    assert out_zip.exists()

    # Xác minh tính toàn vẹn gói zip
    assert verify_bundle(out_zip) is True

    # Giả lập sửa đổi trái phép tệp zip (tamper detection)
    corrupted_zip = tmp_path / "corrupted.zip"
    corrupted_zip.write_bytes(b"PK\x03\x04fake_corrupted_data")
    assert verify_bundle(corrupted_zip) is False
