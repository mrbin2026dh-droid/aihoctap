"""
Module Grounding: Quản lý và trích xuất dữ liệu bài học SGK Tin học 6-9
Đảm bảo thông tin nạp vào Agent luôn bám sát 100% nội dung chương trình GDPT 2018.
"""
from pathlib import Path
import json
from typing import Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
CURRICULUM_DIR = BASE_DIR / "data" / "curriculum"


def get_lesson_files(grade: int, lesson_id: int) -> tuple[Optional[Path], Optional[Path]]:
    """Tìm đường dẫn file lý thuyết (.md) và file trắc nghiệm (.json) của bài học."""
    grade_dir = CURRICULUM_DIR / f"tin{grade}"
    if not grade_dir.exists():
        return None, None

    md_file = None
    json_file = None

    # Tìm file lý thuyết bài học theo lesson_id
    for f in grade_dir.glob(f"bai{lesson_id}_*.md"):
        md_file = f
        break

    # Tìm file trắc nghiệm bài học theo lesson_id
    for f in grade_dir.glob(f"bai{lesson_id}_*.json"):
        json_file = f
        break

    return md_file, json_file


def load_lesson_data(grade: int, lesson_id: int) -> Dict[str, Any]:
    """Tải toàn bộ nội dung lý thuyết và bộ trắc nghiệm của một bài học."""
    md_file, json_file = get_lesson_files(grade, lesson_id)
    
    if not md_file or not md_file.exists():
        raise FileNotFoundError(f"Không tìm thấy tài liệu lý thuyết cho Tin học {grade} - Bài {lesson_id}")

    with open(md_file, "r", encoding="utf-8") as f:
        markdown_content = f.read()

    quiz_data = []
    if json_file and json_file.exists():
        with open(json_file, "r", encoding="utf-8") as f:
            quiz_data = json.load(f)

    # Trích xuất tiêu đề bài học từ dòng đầu tiên
    title = f"Tin học {grade} - Bài {lesson_id}"
    for line in markdown_content.splitlines():
        if line.startswith("# "):
            title = line.replace("# ", "").strip()
            break

    return {
        "grade": grade,
        "lesson_id": lesson_id,
        "title": title,
        "content_markdown": markdown_content,
        "quiz": quiz_data
    }
