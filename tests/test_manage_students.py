#!/usr/bin/env python3
"""
Unit tests for tools/manage_students.py (L1/L2, M4)
"""

import unittest
from tools.manage_students import is_valid_id, hash_pin_pbkdf2, create_student_auth_record, generate_secure_pin, DEFAULT_DATABASE_URL

class TestManageStudents(unittest.TestCase):
    def test_id_validation(self):
        self.assertTrue(is_valid_id("hs01"))
        self.assertTrue(is_valid_id("123456"))
        self.assertTrue(is_valid_id("student_9a-01"))
        self.assertFalse(is_valid_id("../traversal"))
        self.assertFalse(is_valid_id("has space"))
        self.assertFalse(is_valid_id("special@char"))
        self.assertFalse(is_valid_id(""))
        self.assertFalse(is_valid_id("a" * 65)) # max 64

    def test_pin_pbkdf2_derivation(self):
        salt = "0123456789abcdef0123456789abcdef"
        pin = "123456"
        h1 = hash_pin_pbkdf2(pin, salt)
        h2 = hash_pin_pbkdf2(pin, salt)
        self.assertEqual(len(h1), 64)
        self.assertEqual(h1, h2) # Deterministic
        self.assertNotEqual(h1, hash_pin_pbkdf2("654321", salt))

    def test_create_student_auth_record_manual_pin(self):
        rec = create_student_auth_record("hs01", "Nguyễn Văn A", 9, "9A", "123456")
        self.assertEqual(rec["student_id"], "hs01")
        self.assertEqual(rec["name"], "Nguyễn Văn A")
        self.assertEqual(rec["grade"], 9)
        self.assertEqual(rec["class_code"], "9A")
        self.assertEqual(rec["raw_pin"], "123456")
        self.assertEqual(len(rec["salt"]), 32)
        self.assertEqual(len(rec["pin_hash"]), 64)

    def test_create_student_auth_record_auto_pin(self):
        # M4: Auto-generate 6-digit secure PIN when pin argument is None
        rec = create_student_auth_record("hs02", "Trần Thị B", 6, "6B")
        self.assertEqual(len(rec["raw_pin"]), 6)
        self.assertTrue(rec["raw_pin"].isdigit())
        self.assertEqual(len(rec["pin_hash"]), 64)

    def test_invalid_student_record(self):
        with self.assertRaises(ValueError):
            create_student_auth_record("../bad", "Test", 9, "9A", "123456")
        # M3: PIN minimum length is 6
        with self.assertRaises(ValueError):
            create_student_auth_record("hs01", "Test", 9, "9A", "12345") # 5 chars -> fail

    def test_no_hardcoded_database_url(self):
        # M4: Ensure DEFAULT_DATABASE_URL does not contain hardcoded production URL
        self.assertNotIn("asia-southeast1.firebasedatabase.app", DEFAULT_DATABASE_URL)

if __name__ == "__main__":
    unittest.main()
