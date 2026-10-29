"""Xử lý chữ tiếng Việt: chuẩn hóa, so khớp mờ (kiểm bằng chứng AI trích), nhận bài vô nghĩa."""
from __future__ import annotations
import re
import unicodedata
from difflib import SequenceMatcher


def norm(s: str) -> str:
    """Chữ thường, bỏ dấu câu thừa, gộp khoảng trắng. GIỮ dấu tiếng Việt (NFC)."""
    s = unicodedata.normalize("NFC", str(s or "")).lower()
    s = re.sub(r"[“”\"'`´‘’]", "", s)
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def fold(s: str) -> str:
    """Bỏ dấu tiếng Việt (học sinh gõ không dấu vẫn so khớp được)."""
    s = unicodedata.normalize("NFD", norm(s)).replace("đ", "d")
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def is_junk(answer: str) -> bool:
    """Chỉ có ký tự lặp ("AAAAAAA", "......."): giống Worker isJunkAnswer."""
    x = re.sub(r"\s+", "", str(answer or "")).lower()
    if len(x) < 8:
        return False
    return len(set(x)) <= 3 or not re.search(r"\w", x)


def evidence_found(answer: str, quote: str, threshold: float = 0.8) -> bool:
    """Câu AI trích có thật sự nằm trong bài làm không (cho phép sai khác nhỏ: dấu câu, dấu thanh, lỗi gõ)."""
    q, a = fold(quote), fold(answer)
    if not q or len(q) < 3:
        return False
    if q in a:
        return True
    if len(q) > len(a) + 5:
        return False
    best = 0.0
    w = len(q)
    step = max(1, w // 6)
    for i in range(0, max(1, len(a) - w + 1), step):
        r = SequenceMatcher(None, q, a[i:i + w + 4]).ratio()
        if r > best:
            best = r
            if best >= threshold:
                return True
    return best >= threshold


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, fold(a)[:600], fold(b)[:600]).ratio()


def round_q(x: float) -> float:
    """Làm tròn 0,25 điểm như app."""
    return round(round(float(x) * 4) / 4, 2)
