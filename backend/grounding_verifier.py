"""
Module Grounding Verifier: Động cơ Kiểm chứng Nguồn Xác định (Deterministic Grounding Engine)
Tuân thủ Nguyên tắc Zero-Hallucination & Zero-Guesswork:
1. Sử dụng PyMuPDF (fitz) trích xuất text nguyên bản từng trang sách SGK.
2. Chuẩn hóa chuỗi (Unicode NFC, hạ chữ thường, làm sạch khoảng trắng dư thừa).
3. Sử dụng giải thuật so khớp xác định (Exact / SequenceMatcher) để kiểm tra:
   - Câu hỏi và 4 lựa chọn (A, B, C, D) CÓ thực sự tồn tại trong trang SGK được trích dẫn hay không.
4. Tự động tính toán và gán nhãn `grounding_verified: bool` ở tầng server (CẤM client tự bịa).
5. Phân định nguồn: SGK không in đáp án và giải thích -> bắt buộc `source: "generated"` hoặc `"teacher_verified"`.
"""
import re
import difflib
import unicodedata
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


def normalize_vietnamese_text(text: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt: Unicode NFC, bỏ dấu câu và khoảng trắng thừa."""
    if not text:
        return ""
    # 1. Chuẩn hóa dạng dựng sẵn Unicode NFC
    normalized = unicodedata.normalize("NFC", text.strip().lower())
    # 2. Thay thế ký tự đặc biệt bằng dấu cách
    cleaned = re.sub(r"[^\w\s]", " ", normalized)
    # 3. Thu gọn các khoảng trắng liền kề
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_text_by_page_from_pdf(pdf_path: str) -> Dict[int, str]:
    """Trích xuất text từng trang từ tệp PDF bằng PyMuPDF."""
    if not fitz:
        raise RuntimeError("Thư viện PyMuPDF (fitz) chưa được cài đặt trong môi trường!")
    
    path_obj = Path(pdf_path)
    if not path_obj.exists():
        raise FileNotFoundError(f"Không tìm thấy tệp PDF tại: {pdf_path}")

    doc = fitz.open(str(path_obj))
    pages_dict: Dict[int, str] = {}
    
    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        page = doc[page_idx]
        raw_text = page.get_text("text") or ""
        pages_dict[page_num] = raw_text

    doc.close()
    return pages_dict


def verify_text_in_source(needle: str, haystack: str, similarity_threshold: float = 0.80) -> bool:
    """
    Kiểm chứng chuỗi needle có nằm trong văn bản nguồn haystack hay không.
    Sử dụng kết hợp Exact substring check và SequenceMatcher cửa sổ trượt (Sliding Window).
    Ngưỡng mặc định similarity_threshold = 0.80 thống nhất cho cả đề bài và phương án.
    """
    norm_needle = normalize_vietnamese_text(needle)
    norm_haystack = normalize_vietnamese_text(haystack)

    if not norm_needle or not norm_haystack:
        return False

    # 1. Kiểm tra bao hàm chính xác sau khi chuẩn hóa
    if norm_needle in norm_haystack:
        return True

    # 2. Kiểm tra cửa sổ trượt với độ dài tương đương
    needle_words = norm_needle.split()
    haystack_words = norm_haystack.split()
    n_len = len(needle_words)

    if n_len == 0 or len(haystack_words) < n_len:
        matcher = difflib.SequenceMatcher(None, norm_needle, norm_haystack)
        return matcher.ratio() >= similarity_threshold

    for i in range(0, len(haystack_words) - n_len + 1, max(1, n_len // 3)):
        window = " ".join(haystack_words[i : i + n_len])
        ratio = difflib.SequenceMatcher(None, norm_needle, window).ratio()
        if ratio >= similarity_threshold:
            return True

    return False


def verify_quiz_item_grounding(
    quiz_item: Dict[str, Any], 
    pages_text_map: Dict[int, str]
) -> Dict[str, Any]:
    """
    Kiểm chứng độ tin cậy nguồn gốc của một câu hỏi trắc nghiệm SGK.
    Phạm vi:
      - Chỉ câu hỏi (cau_hoi) và các phương án (lua_chon) được so khớp với văn bản SGK.
      - SGK in không có đáp án đúng hay giải thích; các trường đó do AI sinh hoặc giáo viên duyệt.
    Ngưỡng:
      - cau_hoi >= 0.80
      - lua_chon >= 0.80 (toàn bộ 100% số lựa chọn phải khớp trang SGK - A4/Q2a)
    """
    verified_item = dict(quiz_item)
    trang_sgk = verified_item.get("trang_sgk", 0)
    
    # Nếu không chỉ định trang hoặc trang không có trong dữ liệu bóc tách
    if trang_sgk not in pages_text_map:
        verified_item["grounding_verified"] = False
        return verified_item

    page_content = pages_text_map[trang_sgk]
    
    # 1. Kiểm tra đề bài câu hỏi (ngưỡng thống nhất 0.80)
    cau_hoi = verified_item.get("cau_hoi", "")
    cau_hoi_matched = verify_text_in_source(cau_hoi, page_content, similarity_threshold=0.80)

    # 2. Kiểm tra các lựa chọn (ngưỡng thống nhất 0.80)
    lua_chon = verified_item.get("lua_chon") or {}
    options_matched = 0
    total_options = len(lua_chon)
    
    for key, opt_text in lua_chon.items():
        if verify_text_in_source(opt_text, page_content, similarity_threshold=0.80):
            options_matched += 1

    # Đạt grounding khi câu hỏi khớp và toàn bộ 100% lựa chọn khớp với trang SGK (A4/Q2a)
    is_grounded = cau_hoi_matched and total_options > 0 and options_matched == total_options
    verified_item["grounding_verified"] = is_grounded
    
    return verified_item
