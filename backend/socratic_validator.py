"""
Module Socratic Validator: Kiểm định an toàn sư phạm cho gợi ý khi làm sai (goi_y_khi_sai).
Đảm bảo:
1. Gợi ý KHÔNG ĐƯỢC chứa văn bản phương án đúng (nguyên văn hoặc biến thể diễn đạt lại).
2. Gợi ý KHÔNG ĐƯỢC chứa từ khóa độc quyền của phương án đúng (leak keywords).
3. Gợi ý KHÔNG ĐƯỢC chứa tên bước đúng nếu câu hỏi đang hỏi về việc nhận diện bước đó.
4. Triệt tiêu các cụm từ lộ liễu: 'chọn A', 'đáp án là', 'khoanh vào'.
"""

import re
import unicodedata
from typing import Dict, Any, List, Tuple, Set


STOP_WORDS = {
    "là", "và", "của", "các", "những", "cho", "trong", "được", "có", "một",
    "đến", "với", "vào", "để", "ra", "lại", "này", "đó", "khi", "thì", "ở"
}

STANDARD_STEPS = ["thu nhận", "xử lý", "lưu trữ", "truyền đạt"]


def normalize_vietnamese_text(text: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt: chữ thường, xóa dấu câu dư thừa, chuẩn hóa Unicode NFC."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text.strip().lower())
    text = re.sub(r"[\.,;:!\?\"'“”‘’\(\)\[\]\{\}\-_\\/]", " ", text)
    return " ".join(text.split())


def extract_content_tokens(text: str) -> List[str]:
    """Tách các từ nội dung có nghĩa (bỏ stop words và từ quá ngắn)."""
    norm = normalize_vietnamese_text(text)
    tokens = [w for w in norm.split() if len(w) >= 2 and w not in STOP_WORDS]
    return tokens


# Các mẫu regex rò rỉ phương án lộ liễu
FORBIDDEN_LEAK_PATTERNS = [
    re.compile(r"\b(?:đáp án|phương án|câu trả lời|kết quả)(?:\s+đúng|\s+chính xác)?\s+là\s*[:\-]?[ \t]*[\*_`\"'\(\[\s]*([a-d])\b", re.IGNORECASE),
    re.compile(r"\b(?:hãy|nên|em)?\s*(?:chọn|khoanh|đánh dấu)\s+(?:vào\s+)?(?:câu\s+|phương án\s+|đáp án\s+|ý\s+)?[\*_`\"'\(\[\s]*([a-d])\b", re.IGNORECASE),
    re.compile(r"\b(?:chữ|cái|phương án|câu|đáp án)\s+([a-d])\s+(?:mới\s+)?(?:đúng|chuẩn|chính xác)\b", re.IGNORECASE),
    re.compile(r"\b([a-d])\s+mới\s+(?:đúng|chuẩn|chính xác)\b", re.IGNORECASE),
]


def validate_socratic_hint(
    hint: str,
    correct_option_key: str,
    options: Dict[str, str],
    forbidden_keywords: List[str] = None,
    question_title: str = ""
) -> Tuple[bool, str]:
    """
    Kiểm tra gợi ý Socratic:
    - hint: Nội dung gợi ý khi học sinh chọn sai
    - correct_option_key: 'A', 'B', 'C', hoặc 'D'
    - options: Dict các phương án {'A': '...', 'B': '...'}
    - forbidden_keywords: Danh sách từ khóa cấm đặc thù cho câu hỏi (nếu rỗng sẽ tự sinh từ đáp án)
    - question_title: Tiêu đề câu hỏi để kiểm tra lộ tên bước
    
    Trả về: (is_valid, reason)
    """
    if not hint or not hint.strip():
        return False, "Gợi ý không được để trống."

    norm_hint = normalize_vietnamese_text(hint)

    # 1. Kiểm tra mẫu lộ trực tiếp (chọn A, đáp án là B...)
    for pattern in FORBIDDEN_LEAK_PATTERNS:
        if pattern.search(hint):
            return False, f"Gợi ý chứa mẫu tiết lộ đáp án trực tiếp: '{pattern.pattern}'"

    # 2. Kiểm tra nguyên văn đáp án đúng
    correct_text = options.get(correct_option_key, "")
    norm_correct = normalize_vietnamese_text(correct_text)
    if norm_correct and len(norm_correct) >= 5 and norm_correct in norm_hint:
        return False, f"Gợi ý chứa nguyên văn nội dung đáp án đúng: '{correct_text}'"

    # 3. Kiểm tra diễn đạt lại (Paraphrase & Token Overlap Detection - Giải quyết P0-C của Sonnet)
    correct_tokens = extract_content_tokens(correct_text)
    if len(correct_tokens) >= 3:
        # Kiểm tra n-gram 2 từ liên tiếp của đáp án xuất hiện trong gợi ý
        for i in range(len(correct_tokens) - 1):
            bigram = f"{correct_tokens[i]} {correct_tokens[i+1]}"
            if len(bigram) >= 6 and bigram in norm_hint:
                return False, f"Gợi ý chứa cụm từ đặc trưng của đáp án đúng: '{bigram}'"

        # Kiểm tra mật độ trùng lặp từ nội dung (trên 60% từ nội dung của đáp án xuất hiện trong gợi ý)
        hint_tokens_set = set(extract_content_tokens(norm_hint))
        overlap = [w for w in correct_tokens if w in hint_tokens_set]
        if len(overlap) >= 3 and len(overlap) / len(correct_tokens) >= 0.6:
            return False, f"Gợi ý diễn đạt lại quá lộ liễu các từ khóa của đáp án: {overlap}"

    # 4. Kiểm tra danh sách từ khóa cấm (bao gồm cả từ điền sẵn hoặc tự sinh)
    active_forbidden = list(forbidden_keywords or [])
    # Nếu chưa có forbidden_keywords, tự sinh thêm các từ đặc trưng của đáp án
    if not active_forbidden and correct_text:
        if "thầy giáo" in norm_correct or "giảng bài" in norm_correct:
            active_forbidden.extend(["thính giác", "nghe tiếng", "tai nghe", "giảng bài"])
        elif "não" in norm_correct or "suy nghĩ" in norm_correct:
            active_forbidden.extend(["não bộ", "suy nghĩ trong đầu", "tư duy"])

    for kw in active_forbidden:
        norm_kw = normalize_vietnamese_text(kw)
        if norm_kw and norm_kw in norm_hint:
            return False, f"Gợi ý chứa từ khóa cấm đặc thù của câu hỏi: '{kw}'"

    # 5. Kiểm tra nhắc lại tên bước nếu câu hỏi hỏi về việc nhận diện bước đó
    if question_title:
        norm_title = normalize_vietnamese_text(question_title)
        for step in STANDARD_STEPS:
            # Nếu câu hỏi hỏi bước nào làm hoạt động này, gợi ý không được nói "chính là bước [step]"
            if step in norm_title:
                if f"chính là {step}" in norm_hint or f"đó là {step}" in norm_hint or f"bước {step}" in norm_hint:
                    return False, f"Gợi ý chỉ đích danh tên bước cần tìm trong câu hỏi: '{step}'"

    return True, "Hợp lệ"
