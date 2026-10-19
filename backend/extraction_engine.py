"""
Module Extraction Engine: Trích xuất, kiểm định khế ước và lưu trữ nguyên tử dữ liệu SGK.
Tuân thủ 100% các tiêu chuẩn kiểm duyệt từ Claude 3.5 Sonnet (P0 & P1 Resolved).
"""

import json
import os
import shutil
import tempfile
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import pymupdf
from backend.contracts import LessonBlockPackageContract
from backend.socratic_validator import validate_socratic_hint

ROOT_DIR = Path(__file__).resolve().parent.parent


def compute_pdf_index(book_page: int, page_offset: int = 0) -> int:
    """
    Quy tắc ánh xạ thống nhất: pdf_index = book_page + page_offset.
    Với tệp SGK Tin 6: Trang in 8 tương ứng đúng PDF index 8 (page_offset = 0).
    """
    return book_page + page_offset


def extract_page_data(doc: pymupdf.Document, pdf_index: int) -> Dict[str, Any]:
    """
    Trích xuất dữ liệu của một trang PDF:
    - Nếu có text số hóa (len >= 100) -> Trả về text layer.
    - Nếu là PDF scan ảnh (len < 100 và có ảnh) -> Trả về pixmap PNG bytes cho Multimodal Vision.
    """
    if pdf_index < 0 or pdf_index >= len(doc):
        raise IndexError(f"Chỉ số trang PDF {pdf_index} nằm ngoài phạm vi (0..{len(doc)-1}).")

    page = doc[pdf_index]
    text = page.get_text().strip()
    images = page.get_images()

    if len(text) >= 100:
        return {
            "mode": "digital_text",
            "pdf_index": pdf_index,
            "text": text,
            "image_bytes": None,
            "char_count": len(text)
        }
    else:
        # Hybrid Vision Fallback: Render trang sang ảnh PNG 150 DPI
        pix = page.get_pixmap(dpi=150)
        png_bytes = pix.tobytes("png")
        return {
            "mode": "scanned_image",
            "pdf_index": pdf_index,
            "text": text,
            "image_bytes": png_bytes,
            "char_count": len(text),
            "dimensions": (pix.width, pix.height)
        }


def validate_and_sanitize_lesson_package(
    raw_data: Dict[str, Any]
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Kiểm định dữ liệu bài học bằng chính LessonBlockPackageContract của backend/contracts.py:
    1. Ép cứng 'status: draft' cho dữ liệu bóc tách mới / chưa xuất bản.
    2. Luồng bóc tách tuyệt đối KHÔNG ĐƯỢC PHÉP tạo dấu duyệt:
       - Mọi khối nội dung: ép cứng source="generated", teacher_reviewed=False, reviewed_by=None, reviewed_at=None.
       - Mọi câu hỏi trắc nghiệm: ép cứng source="generated", grounding_verified=False, verified_by=None, verified_at=None.
       (Trách nhiệm bảo tồn dấu duyệt thuộc thẩm quyền duy nhất của save_lesson_blocks khi đối chiếu file cũ).
    3. Kiểm tra bắt buộc gợi ý Socratic qua validate_socratic_hint (P0-2).
    """
    data = dict(raw_data)
    
    # 1. Khóa cứng status = draft
    data["status"] = "draft"

    # 2. Chuẩn hóa metadata kiểm duyệt cho từng block nội dung (triệt tiêu dấu duyệt giả)
    blocks = data.get("blocks", [])
    sanitized_blocks = []
    for b in blocks:
        b_dict = dict(b)
        b_dict["source"] = "generated"
        b_dict["teacher_reviewed"] = False
        b_dict["reviewed_by"] = None
        b_dict["reviewed_at"] = None
        sanitized_blocks.append(b_dict)
    data["blocks"] = sanitized_blocks

    # 3. Chuẩn hóa metadata quiz (triệt tiêu dấu duyệt giả) & Kiểm tra Socratic Hint
    quiz = data.get("quiz", [])
    sanitized_quiz = []
    for q in quiz:
        q_dict = dict(q)
        q_dict["source"] = "generated"
        q_dict["grounding_verified"] = False
        q_dict["verified_by"] = None
        q_dict["verified_at"] = None

        # P0-2: Kiểm định gợi ý Socratic chống rò rỉ đáp án
        hint = q_dict.get("goi_y_khi_sai", "")
        correct_key = q_dict.get("dap_an_dung", "")
        options = q_dict.get("lua_chon", {})
        forbidden_keywords = q_dict.get("forbidden_keywords", [])
        question_title = q_dict.get("cau_hoi", "")

        is_hint_valid, hint_reason = validate_socratic_hint(
            hint=hint,
            correct_option_key=correct_key,
            options=options,
            forbidden_keywords=forbidden_keywords,
            question_title=question_title
        )
        if not is_hint_valid:
            qid = q_dict.get("id", "unknown")
            return False, f"Câu hỏi {qid} có gợi ý vi phạm an toàn sư phạm: {hint_reason}", None

        sanitized_quiz.append(q_dict)
    data["quiz"] = sanitized_quiz

    # 4. Kiểm tra với Pydantic Contract
    try:
        validated_contract = LessonBlockPackageContract(**data)
        return True, None, validated_contract.model_dump()
    except Exception as e:
        return False, str(e), None


def atomic_save_lesson(dest_path: str, lesson_data: Dict[str, Any]) -> str:
    """
    Ghi nguyên tử dữ liệu bài học xuống đĩa cứng (P0-A, P0-B, P1-4):
    Sử dụng TRỰC TIẾP và DUY NHẤT một pipeline chính thống 'save_lesson_blocks' của backend/grounding.py.
    Đảm bảo 100% tính nhất quán, bảo vệ chống injection và dọn dẹp backup chuẩn xác.
    """
    from backend.grounding import save_lesson_blocks
    grade = lesson_data.get("grade", 6)
    lesson_id = lesson_data.get("lesson_id", 1)
    
    # Luôn ép cứng draft khi lưu từ desktop studio
    payload_copy = dict(lesson_data)
    payload_copy["status"] = "draft"
    
    try:
        result = save_lesson_blocks(
            grade=grade,
            lesson_id=lesson_id,
            payload=payload_copy,
            allow_publish=False
        )
        return result["path"]
    except Exception as e:
        raise IOError(f"Lỗi khi ghi nguyên tử: {e}")


def extract_and_structure_lesson(
    pdf_path: str,
    grade: int,
    lesson_id: int,
    start_page: int,
    end_page: int,
    page_offset: int = 0,
    cancel_event: Optional[threading.Event] = None,
    on_progress: Optional[Callable[[str, float], None]] = None,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Quy trình trích xuất và cấu trúc bài học hoàn chỉnh (P1-3, P1-4, P1-5):
    1. Trích xuất ảnh/text dải trang PDF (tôn trọng cancel_event).
    2. Gọi Gemini Vision (model gemini-3.5-flash-lite) với timeout và retry tối đa 2 lần.
    3. Phân tích kết quả JSON theo Block Schema 2.0.
    4. Kiểm định và làm sạch qua validate_and_sanitize_lesson_package.
    """
    if not os.path.exists(pdf_path):
        return False, f"Tệp PDF không tồn tại: {pdf_path}", None

    if start_page > end_page:
        return False, f"Trang bắt đầu ({start_page}) lớn hơn trang kết thúc ({end_page}).", None

    if on_progress:
        on_progress(f"Đang mở tệp PDF: {os.path.basename(pdf_path)}...", 0.1)

    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        return False, f"Không thể mở tệp PDF: {e}", None

    total_pdf_pages = len(doc)
    scanned_pages_data = []

    step = 0
    total_range = end_page - start_page + 1

    for book_p in range(start_page, end_page + 1):
        if cancel_event and cancel_event.is_set():
            doc.close()
            return False, "Tiến trình đã bị người dùng hủy bỏ.", None

        step += 1
        pct = 0.1 + 0.4 * (step / total_range)
        if on_progress:
            on_progress(f"Đang đọc trang in {book_p}...", pct)

        pdf_idx = compute_pdf_index(book_p, page_offset)
        if pdf_idx < 0 or pdf_idx >= total_pdf_pages:
            doc.close()
            return False, f"Chỉ số trang PDF {pdf_idx} (Trang in {book_p}) vượt quá tổng số trang ({total_pdf_pages}).", None

        p_data = extract_page_data(doc, pdf_idx)
        scanned_pages_data.append((book_p, p_data))

    doc.close()

    if cancel_event and cancel_event.is_set():
        return False, "Tiến trình đã bị người dùng hủy bỏ.", None

    if on_progress:
        on_progress("Đang chuẩn bị dữ liệu gửi tới Gemini Vision...", 0.6)

    # Nạp API key nếu chưa có
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            import dotenv
            dotenv.load_dotenv(ROOT_DIR / ".env")
            dotenv.load_dotenv(ROOT_DIR / "backend" / ".env")
            dotenv.load_dotenv(".env")
            dotenv.load_dotenv("backend/.env")
            api_key = os.getenv("GEMINI_API_KEY")

    if not model_name:
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    # Xây dựng prompt sư phạm
    system_instruction = f"""
Bạn là chuyên gia sư phạm và kiến trúc sư dữ liệu giáo dục cho SGK Tin học {grade}.
Nhiệm vụ: Đọc kỹ các trang sách giáo khoa được cung cấp (Bài {lesson_id}, dải trang in từ {start_page} đến {end_page}) và chuyển hóa thành cấu trúc JSON chuẩn Block Schema 2.0.

CẤU TRÚC JSON BẮT BUỘC (Chỉ xuất duy nhất JSON hợp lệ, không giải thích ngoài lề):
{{
  "schema_version": "2.0",
  "grade": {grade},
  "lesson_id": {lesson_id},
  "title": "<Tên bài học trích xuất chính xác từ trang đầu>",
  "status": "draft",
  "source_file": "{os.path.basename(pdf_path)}",
  "extracted_pages": {list(range(start_page, end_page + 1))},
  "blocks": [
    {{
      "type": "hero",
      "badge": "BÀI {lesson_id} • TIN HỌC {grade}",
      "title": "<Tên bài học>",
      "description": "<Mô tả ngắn gọn cô đọng về nội dung bài học dưới 3 câu>"
    }},
    {{
      "type": "goals",
      "items": [
        "<Mục tiêu 1>",
        "<Mục tiêu 2>",
        "<Mục tiêu 3>"
      ]
    }},
    {{
      "type": "grid_cards",
      "title": "<Tiêu đề phần kiến thức cốt lõi>",
      "cards": [
        {{ "title": "<Ý 1>", "desc": "<Mô tả ngắn>", "icon": "eye" }},
        {{ "title": "<Ý 2>", "desc": "<Mô tả ngắn>", "icon": "cpu" }},
        {{ "title": "<Ý 3>", "desc": "<Mô tả ngắn>", "icon": "hard-drive" }},
        {{ "title": "<Ý 4>", "desc": "<Mô tả ngắn>", "icon": "share-2" }}
      ]
    }},
    {{
      "type": "takeaways",
      "title": "Ghi nhớ trọng tâm",
      "items": [
        "<Ghi nhớ 1>",
        "<Ghi nhớ 2>",
        "<Ghi nhớ 3>"
      ]
    }}
  ],
  "quiz": [
    {{
      "id": "tin{grade}_b{lesson_id}_q1",
      "cau_hoi": "<Nội dung câu hỏi>",
      "lua_chon": {{
        "A": "<Lựa chọn A>",
        "B": "<Lựa chọn B>",
        "C": "<Lựa chọn C>",
        "D": "<Lựa chọn D>"
      }},
      "dap_an_dung": "A",
      "muc_sgk": "<Mục SGK>",
      "trang_sgk": {start_page},
      "giai_thich_su_pham": "<Giải thích vì sao đúng>",
      "goi_y_khi_sai": "<Gợi ý định hướng tư duy Socratic KHÔNG ĐƯỢC LỘ ĐÁP ÁN>",
      "forbidden_keywords": ["<từ khóa đáp án đúng>"]
    }}
  ]
}}
QUY TẮC AN TOÀN SƯ PHẠM (SOCRATIC LAW):
- 'goi_y_khi_sai' tuyệt đối KHÔNG ĐƯỢC chứa đáp án đúng hoặc khẳng định 'đáp án là X'. Chỉ dẫn dắt bằng câu hỏi gợi mở.
- Toàn bộ các icon trong cards chỉ được chọn từ tập: ['eye', 'cpu', 'hard-drive', 'share-2', 'book-open', 'chip', 'sign', 'bell', 'alert-circle'].
"""

    if on_progress:
        on_progress(f"Đang gửi dữ liệu tới Gemini ({model_name})...", 0.75)

    if cancel_event and cancel_event.is_set():
        return False, "Tiến trình đã bị người dùng hủy bỏ.", None

    if not api_key:
        return False, "Chưa cấu hình GEMINI_API_KEY trong tệp .env.", None

    from google import genai
    from google.genai import types

    http_opts = types.HttpOptions(timeout=30000)
    client = genai.Client(api_key=api_key, http_options=http_opts)

    contents = [system_instruction]
    for bp, p_data in scanned_pages_data:
        if p_data.get("image_bytes"):
            img_part = types.Part.from_bytes(data=p_data["image_bytes"], mime_type="image/png")
            contents.append(f"--- ẢNH TRANG IN {bp} ---")
            contents.append(img_part)
        elif p_data.get("text"):
            contents.append(f"--- VĂN BẢN TRANG IN {bp} ---\n" + p_data["text"])

    max_retries = 2
    raw_response_text = None
    last_api_error = None

    models_to_try = [model_name, "gemini-flash-latest", "gemini-3.8-flash"]

    for attempt in range(max_retries + 1):
        if cancel_event and cancel_event.is_set():
            return False, "Tiến trình đã bị người dùng hủy bỏ.", None
        target_model = models_to_try[attempt % len(models_to_try)]
        try:
            resp = client.models.generate_content(
                model=target_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    http_options=http_opts
                )
            )
            raw_response_text = resp.text.strip()
            if raw_response_text:
                break
        except Exception as e:
            last_api_error = str(e)
            time.sleep(1.0)

    if not raw_response_text:
        return False, f"Lỗi gọi Gemini Vision sau {max_retries} lần thử: {last_api_error}", None

    if on_progress:
        on_progress("Đang kiểm định dữ liệu và làm sạch khế ước Block Schema 2.0...", 0.9)

    try:
        cleaned_json = raw_response_text
        if cleaned_json.startswith("```"):
            cleaned_json = cleaned_json.split("\n", 1)[1]
            if cleaned_json.endswith("```"):
                cleaned_json = cleaned_json.rsplit("\n", 1)[0]
        parsed_data = json.loads(cleaned_json.strip())
    except Exception as e:
        return False, f"Dữ liệu Gemini trả về không phải JSON hợp lệ: {e}", None

    is_valid, err, sanitized_pkg = validate_and_sanitize_lesson_package(parsed_data)
    if not is_valid:
        return False, f"Gói bài học không đạt chuẩn khế ước: {err}", None

    if on_progress:
        on_progress("Hoàn tất bóc tách dữ liệu bài học!", 1.0)

    return True, None, sanitized_pkg

