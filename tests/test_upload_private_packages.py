#!/usr/bin/env python3
"""
Unit tests for tools/upload_private_packages.py (K2)
Verifies:
1. is_valid_id enforces ^[A-Za-z0-9_-]{1,64}$ strictly (rejection of unicode, spaces, traversal characters).
2. build_private_packages skips unresolvable files and warns.
3. Fallback from invalid subject ("Tin học 6") to valid path directory ("tin6").
4. Generates standard packages with package_id "${course_id}:${lesson_id}".
"""

import os
import sys
import json
import shutil
import tempfile
import unittest
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.upload_private_packages import (
    ID_PATTERN,
    is_valid_id,
    build_private_packages
)

class TestUploadPrivatePackages(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="test_packages_")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_id_validation_regex(self):
        """Test strict adherence to ^[A-Za-z0-9_-]{1,64}$."""
        valid_ids = ["tin6", "tin9", "bai1", "exam_tin6_15p_b1_b2", "1", "10", "q_01", "a-b_c"]
        for vid in valid_ids:
            self.assertTrue(is_valid_id(vid), f"Expected '{vid}' to be valid")

        invalid_ids = [
            "Tin học 6",     # Spaces and unicode
            "tin 6",         # Spaces
            "tin/6",         # Slashes (traversal)
            "tin:6",         # Colon (delimiter)
            "../tin6",       # Path traversal
            "",              # Empty
            None,            # None
            "a" * 65,        # Length > 64
            "bài_1",         # Vietnamese diacritics
            "test?query=1"   # Query parameters
        ]
        for ivid in invalid_ids:
            self.assertFalse(is_valid_id(ivid), f"Expected '{ivid}' to be invalid")

    def test_build_packages_with_path_fallback(self):
        """Test invalid subject 'Tin học 6' falls back to valid parent folder 'tin6'."""
        tin6_dir = os.path.join(self.test_dir, "tin6")
        os.makedirs(tin6_dir, exist_ok=True)
        file_path = os.path.join(tin6_dir, "bai1.json")

        sample_data = {
            "subject": "Tin học 6",  # Invalid ID -> must be rejected as course_id
            "lesson_id": 1,
            "title": "Bài 1",
            "quiz": [
                {"id": "q1", "correct_answer": "A"},
                {"id": "q2", "correct_answer": "B"}
            ]
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sample_data, f)

        packages = build_private_packages(self.test_dir)
        self.assertGreater(len(packages), 0, "Packages must be built")

        # Verify course_id is derived from folder 'tin6'
        pkg_keys = [p["package_id"] for p in packages]
        self.assertIn("tin6:1", pkg_keys)
        self.assertIn("tin6:bai1", pkg_keys)  # Alias from filename stem

        pkg = next(p for p in packages if p["package_id"] == "tin6:1")
        self.assertEqual(pkg["course_id"], "tin6")
        self.assertEqual(pkg["lesson_id"], "1")
        self.assertEqual(pkg["total_questions"], 2)
        self.assertEqual(pkg["questions"][0]["id"], "q1")
        self.assertEqual(pkg["questions"][0]["correct_answer"], "A")

    def test_build_packages_skips_invalid_ids(self):
        """Test files with unresolvable course_id or lesson_id are cleanly skipped."""
        invalid_dir = os.path.join(self.test_dir, "Thư mục có dấu")
        os.makedirs(invalid_dir, exist_ok=True)
        file_path = os.path.join(invalid_dir, "tập tin có dấu.json")

        sample_data = {
            "subject": "Tin học",
            "quiz": [{"id": "q1", "correct_answer": "A"}]
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sample_data, f)

        packages = build_private_packages(self.test_dir)
        self.assertEqual(len(packages), 0, "Invalid files must be skipped without crashing")

    def test_build_packages_filters_invalid_question_ids(self):
        """Test questions with invalid IDs (traversal, spaces) are ignored."""
        tin9_dir = os.path.join(self.test_dir, "tin9")
        os.makedirs(tin9_dir, exist_ok=True)
        file_path = os.path.join(tin9_dir, "bai2.json")

        sample_data = {
            "course_id": "tin9",
            "lesson_id": "bai2",
            "quiz": [
                {"id": "valid_q1", "correct_answer": "C"},
                {"id": "../invalid_traversal", "correct_answer": "D"},
                {"id": "invalid question id", "correct_answer": "A"},
                {"id": "valid_q2", "correct_answer": "B"}
            ]
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sample_data, f)

        packages = build_private_packages(self.test_dir)
        self.assertEqual(len(packages), 1)
        pkg = packages[0]
        self.assertEqual(pkg["total_questions"], 2)
        extracted_qids = [q["id"] for q in pkg["questions"]]
        self.assertEqual(extracted_qids, ["valid_q1", "valid_q2"])

if __name__ == "__main__":
    unittest.main()
