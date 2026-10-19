"""
Module Socratic Semantic Advisor: Lớp kiểm định ngữ nghĩa mềm (Semantic Leak Advisor).
Hiện thực hóa kiến trúc đề xuất bởi Claude 3.5 Sonnet (Vòng 10).
Hỗ trợ đo độ tương đồng ngữ nghĩa giữa gợi ý Socratic và nội dung đáp án đúng,
gắn cờ cảnh báo 'needs_teacher_check' cho giáo viên mà không tự ý chặn cứng.
"""
import re
import difflib
from typing import Set

def _tokenize_vietnamese(text: str) -> Set[str]:
    """Tách từ đơn giản cho tiếng Việt, chuẩn hóa chữ thường và loại bỏ dấu câu."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower(), flags=re.UNICODE)
    words = cleaned.split()
    return {w for w in words if len(w) > 1}

def semantic_leak_score(hint: str, correct_text: str) -> float:
    """
    Tính điểm tương đồng ngữ nghĩa trong khoảng 0.0 .. 1.0 giữa gợi ý và đáp án đúng.
    Kết hợp Jaccard Similarity của tập từ khóa và SequenceMatcher của chuỗi.
    """
    if not hint or not correct_text:
        return 0.0

    hint_clean = hint.strip().lower()
    target_clean = correct_text.strip().lower()

    if target_clean in hint_clean:
        return 1.0

    # 1. Jaccard Index trên tập từ
    hint_tokens = _tokenize_vietnamese(hint_clean)
    target_tokens = _tokenize_vietnamese(target_clean)

    if not hint_tokens or not target_tokens:
        jaccard = 0.0
    else:
        intersection = hint_tokens.intersection(target_tokens)
        union = hint_tokens.union(target_tokens)
        jaccard = len(intersection) / len(union)

    # 2. Sequence Matcher trên chuỗi con dài nhất
    seq_ratio = difflib.SequenceMatcher(None, hint_clean, target_clean).ratio()

    # Trọng số: 60% Jaccard (nội dung khái niệm) + 40% SequenceMatcher (cấu trúc ngữ pháp)
    combined_score = (jaccard * 0.6) + (seq_ratio * 0.4)
    return min(max(combined_score, 0.0), 1.0)

def flag_for_review(hint: str, correct_text: str, threshold: float = 0.75) -> bool:
    """
    Xác định xem gợi ý có cần gắn cờ 'needs_teacher_check' để giáo viên thẩm định không.
    Trả về True nếu độ tương đồng ngữ nghĩa vượt ngưỡng cảnh báo.
    """
    score = semantic_leak_score(hint, correct_text)
    return score >= threshold
