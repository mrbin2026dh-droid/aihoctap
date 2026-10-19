"""
Module TOC Manager: Quản lý, trích xuất và lưu bộ nhớ đệm (Cache) Mục lục SGK động.
Giải quyết bài toán tổng quát cho mọi cuốn sách (Lớp 6, 7, 8, 9, các bộ sách khác nhau)
mà không cần hardcode vào mã nguồn.

Kiến trúc 3 tầng:
1. Đọc Bookmarks/Outlines điện tử nhúng sẵn (0ms, 0 token).
2. Đọc Cache cục bộ từ data/toc_cache/ (0ms).
3. Tự động nhận diện trang Mục lục và gọi Gemini Vision trích xuất 1 lần duy nhất, lưu Cache dùng vĩnh viễn.
"""

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import pymupdf

ROOT_DIR = Path(__file__).resolve().parent.parent
TOC_CACHE_DIR = ROOT_DIR / "data" / "toc_cache"
TOC_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def compute_pdf_hash(pdf_path: str) -> str:
    """Tính mã băm MD5 dựa trên tên tệp và kích thước tệp để làm khóa cache nhẹ."""
    p = Path(pdf_path)
    stat = p.stat()
    raw = f"{p.name}_{stat.st_size}_{stat.st_mtime}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def get_cache_path(pdf_path: str) -> Path:
    stem = Path(pdf_path).stem
    clean_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", stem)[:40]
    h = compute_pdf_hash(pdf_path)
    return TOC_CACHE_DIR / f"{clean_stem}_{h}.json"


def load_cached_toc(pdf_path: str) -> Optional[List[Dict[str, Any]]]:
    """Tải mục lục từ file cache cục bộ nếu đã từng quét."""
    cache_file = get_cache_path(pdf_path)
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            return None
    return None


def save_cached_toc(pdf_path: str, toc_data: List[Dict[str, Any]]) -> str:
    """Lưu danh mục bài học vào file cache cục bộ."""
    cache_file = get_cache_path(pdf_path)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(toc_data, f, ensure_ascii=False, indent=2)
    return str(cache_file)


def extract_embedded_toc(doc: pymupdf.Document) -> Optional[List[Dict[str, Any]]]:
    """
    Tầng 1: Kiểm tra xem tệp PDF có mục lục điện tử (PDF Outlines) nhúng sẵn hay không.
    Trả về danh sách bài học nếu trích xuất được.
    """
    try:
        raw_toc = doc.get_toc() # [[lvl, title, page_no], ...]
        if not raw_toc:
            return None

        lessons = []
        for item in raw_toc:
            lvl, title, page = item[0], item[1].strip(), item[2]
            match = re.search(r"Bài\s+(\d+)[\.:\s\-]+(.+)", title, re.IGNORECASE)
            if match:
                lid = int(match.group(1))
                lesson_title = match.group(2).strip()
                lessons.append({
                    "lesson_id": lid,
                    "title": lesson_title,
                    "start_page": page,
                    "end_page": page,
                    "topic": ""
                })

        # Suy luận end_page cho từng bài
        for i in range(len(lessons)):
            if i + 1 < len(lessons):
                lessons[i]["end_page"] = max(lessons[i]["start_page"], lessons[i+1]["start_page"] - 1)
            else:
                lessons[i]["end_page"] = lessons[i]["start_page"] + 3

        if len(lessons) >= 3:
            return lessons
    except Exception:
        pass
    return None


def scan_toc_with_ai(
    pdf_path: str,
    api_key: Optional[str] = None,
    on_progress: Optional[Callable[[str, float], None]] = None,
    cancel_event: Optional[Any] = None
) -> Tuple[bool, Optional[str], List[Dict[str, Any]]]:
    """
    Tầng 2: Dò tìm trang Mục lục trong các trang ứng viên (Trang 2-5 và 3 trang cuối),
    sau đó gọi Gemini Vision để trích xuất thành danh sách bài học có cấu trúc JSON.
    """
    if not os.path.exists(pdf_path):
        return False, f"Tệp không tồn tại: {pdf_path}", []

    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    if total_pages < 2:
        return False, "Tệp PDF quá ngắn (dưới 2 trang).", []

    # 1. Danh sách các trang ứng viên thường chứa Mục lục
    candidate_indices = []
    # Các trang đầu (index 1 đến min(5, total_pages - 1))
    for idx in range(1, min(6, total_pages)):
        candidate_indices.append(idx)
    # Các trang cuối (total_pages - 4 đến total_pages - 1)
    for idx in range(max(1, total_pages - 4), total_pages):
        if idx not in candidate_indices:
            candidate_indices.append(idx)

    # 2. Chuẩn bị Gemini Client
    if not api_key:
        import dotenv
        dotenv.load_dotenv(ROOT_DIR / ".env")
        dotenv.load_dotenv(".env")
        api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return False, "Thiếu GEMINI_API_KEY trong tệp .env.", []

    from google import genai
    from google.genai import types

    http_opts = types.HttpOptions(timeout=25000)
    client = genai.Client(api_key=api_key, http_options=http_opts)

    models_to_try = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"]

    if on_progress:
        on_progress("Đang tìm trang Mục lục trong tài liệu PDF...", 0.2)

    target_toc_page_idx = None
    target_png_bytes = None

    # Quét nhanh từng trang ứng viên xem có tiêu đề 'MỤC LỤC'
    for c_idx in candidate_indices:
        if cancel_event and cancel_event.is_set():
            return False, "Tiến trình đã bị người dùng hủy.", []

        page = doc[c_idx]
        txt = page.get_text().upper()
        if "MỤC LỤC" in txt or "MUC LUC" in txt:
            target_toc_page_idx = c_idx
            pix = page.get_pixmap(dpi=150)
            target_png_bytes = pix.tobytes("png")
            break

    # Nếu là PDF ảnh scan không có text layer, kiểm tra qua ảnh (ưu tiên trang 3, 4 hoặc trang áp chót)
    if target_toc_page_idx is None:
        # Trong SGK Việt Nam mới, trang 4 thường là trang Mục lục
        preferred_indices = [4, 3, 2, total_pages - 2, total_pages - 1]
        for p_idx in preferred_indices:
            if 0 <= p_idx < total_pages:
                target_toc_page_idx = p_idx
                pix = doc[p_idx].get_pixmap(dpi=150)
                target_png_bytes = pix.tobytes("png")
                break

    if not target_png_bytes:
        return False, "Không xác định được trang Mục lục trong tệp PDF.", []

    if on_progress:
        on_progress(f"Đang bóc tách danh mục bài học từ trang PDF index {target_toc_page_idx}...", 0.5)

    prompt = """
Hãy đọc kỹ trang ảnh này (đây là trang MỤC LỤC của Sách giáo khoa).
Nhiệm vụ: Trích xuất toàn bộ danh sách Bài học và Dải trang in tương ứng thành định dạng JSON hợp lệ.

Yêu cầu xuất ra JSON duy nhất (không giải thích thêm):
[
  {
    "lesson_id": 1,
    "title": "Tên bài học 1",
    "start_page": 5,
    "end_page": 7,
    "topic": "Tên chủ đề nếu có"
  },
  {
    "lesson_id": 2,
    "title": "Tên bài học 2",
    "start_page": 8,
    "end_page": 11,
    "topic": "Tên chủ đề nếu có"
  }
]

Quy tắc tính end_page: Nếu mục lục ghi Bài 1 ở trang 5, Bài 2 ở trang 8 thì end_page của Bài 1 là 7. Bài cuối cùng cho end_page = start_page + 3.
"""

    raw_text = None
    last_err = None

    for m in models_to_try:
        if cancel_event and cancel_event.is_set():
            return False, "Tiến trình đã bị người dùng hủy.", []
        try:
            resp = client.models.generate_content(
                model=m,
                contents=[
                    types.Part.from_bytes(data=target_png_bytes, mime_type="image/png"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    http_options=http_opts
                )
            )
            raw_text = resp.text.strip()
            if raw_text:
                break
        except Exception as e:
            last_err = str(e)
            time.sleep(1.0)

    if not raw_text:
        return False, f"Lỗi gọi AI bóc tách Mục lục: {last_err}", []

    try:
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0]
        parsed = json.loads(cleaned.strip())
        if isinstance(parsed, list) and len(parsed) > 0:
            # Lưu cache dùng vĩnh viễn
            save_cached_toc(pdf_path, parsed)
            if on_progress:
                on_progress("Bóc tách mục lục thành công và đã lưu cache!", 1.0)
            return True, None, parsed
    except Exception as e:
        return False, f"Dữ liệu mục lục AI trả về không đúng cấu trúc: {e}", []

    return False, "Không trích xuất được danh sách bài học hợp lệ.", []


def get_or_scan_pdf_toc(
    pdf_path: str,
    api_key: Optional[str] = None,
    on_progress: Optional[Callable[[str, float], None]] = None,
    cancel_event: Optional[Any] = None
) -> Tuple[bool, Optional[str], List[Dict[str, Any]]]:
    """
    Hàm giao diện chính tích hợp cả 3 tầng:
    1. Trả về ngay nếu có Cache (0ms).
    2. Trả về ngay nếu có Bookmarks nhúng (0ms).
    3. Quét thông minh qua AI (1 lần duy nhất).
    """
    if not pdf_path or not os.path.exists(pdf_path):
        return False, "Tệp PDF không tồn tại.", []

    # Tầng 2: Check Cache
    cached = load_cached_toc(pdf_path)
    if cached:
        return True, "Loaded from cache", cached

    # Tầng 1: Check Bookmarks
    try:
        doc = pymupdf.open(pdf_path)
        embedded = extract_embedded_toc(doc)
        doc.close()
        if embedded:
            save_cached_toc(pdf_path, embedded)
            return True, "Loaded from embedded PDF bookmarks", embedded
    except Exception:
        pass

    # Tầng 3: Scan AI
    return scan_toc_with_ai(
        pdf_path=pdf_path,
        api_key=api_key,
        on_progress=on_progress,
        cancel_event=cancel_event
    )
