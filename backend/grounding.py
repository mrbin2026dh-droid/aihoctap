"""
Module Grounding: Quản lý và trích xuất dữ liệu bài học SGK Tin học 6-9
Hỗ trợ kiến trúc khối dữ liệu động (Data-driven Block Architecture) và đảm bảo an toàn ghi nguyên tử.
"""
from pathlib import Path
import json
import os
import shutil
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional, List

from backend.contracts import LessonBlockPackageContract

BASE_DIR = Path(__file__).resolve().parent.parent
CURRICULUM_DIR = Path(os.getenv("CURRICULUM_DIR_OVERRIDE") or (BASE_DIR / "data" / "curriculum"))
CURRICULUM_V2_DIR = Path(os.getenv("CURRICULUM_V2_DIR_OVERRIDE") or (BASE_DIR / "data" / "curriculum_v2_simple"))


def load_lesson_v2_simple(grade: int, lesson_id: int) -> Optional[Dict[str, Any]]:
    """Tải bài học tinh giản chuẩn từ data/curriculum_v2_simple/tin{grade}/bai{lesson_id}.json."""
    grade_dir = CURRICULUM_V2_DIR / f"tin{grade}"
    if not grade_dir.exists():
        return None
    file_path = grade_dir / f"bai{lesson_id}.json"
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {
            "grade": data.get("grade", grade),
            "lesson_id": data.get("lesson_id", lesson_id),
            "title": data.get("title", f"Bài {lesson_id}"),
            "status": data.get("status", "published"),
            "blocks": data.get("blocks", []),
            "content_markdown": data.get("content_markdown", ""),
            "quiz": data.get("quiz", []),
            "schema_version": data.get("schema_version", "3.0_clean")
        }
    except Exception as e:
        print(f"Lỗi khi đọc file V2 {file_path}: {e}")
        return None


def list_available_lessons_v2(grade: int) -> List[Dict[str, Any]]:
    """Liệt kê danh sách bài học có trong kho V2 tinh giản kèm Chủ đề SGK."""
    grade_dir = CURRICULUM_V2_DIR / f"tin{grade}"
    existing_map = {}
    if grade_dir.exists():
        for f in sorted(grade_dir.glob("bai*.json")):
            try:
                with open(f, "r", encoding="utf-8") as jf:
                    d = json.load(jf)
                lid = d.get("lesson_id")
                if lid is not None:
                    existing_map[int(lid)] = {
                        "lesson_id": int(lid),
                        "title": d.get("title", f.stem),
                        "status": d.get("status", "published"),
                        "quiz_count": len(d.get("quiz", [])),
                        "ready": True
                    }
            except Exception:
                continue

    # Đọc Mục lục SGK từ TOC cache nếu có
    toc_dir = BASE_DIR / "data" / "toc_cache"
    toc_items = []
    if toc_dir.exists():
        exact_toc = toc_dir / f"sgk-tin-hoc-{grade}-kntt-voi-cuoc-song.json"
        if exact_toc.exists():
            toc_file = exact_toc
        else:
            candidates = sorted(toc_dir.glob(f"sgk-tin-hoc-{grade}*.json"))
            toc_file = candidates[0] if candidates else None

        if toc_file and toc_file.exists():
            try:
                with open(toc_file, "r", encoding="utf-8") as f:
                    toc_items = json.load(f)
            except Exception:
                toc_items = []

    lessons = []
    seen_ids = set()
    if toc_items:
        for it in toc_items:
            lid = int(it.get("lesson_id", 0))
            seen_ids.add(lid)
            if lid in existing_map:
                item_data = dict(existing_map[lid])
                item_data["topic"] = it.get("topic", "")
                item_data["start_page"] = it.get("start_page", 0)
                item_data["end_page"] = it.get("end_page", 0)
                lessons.append(item_data)
            else:
                lessons.append({
                    "lesson_id": lid,
                    "title": it.get("title", f"Bài {lid}"),
                    "status": "draft",
                    "quiz_count": 0,
                    "ready": False,
                    "topic": it.get("topic", ""),
                    "start_page": it.get("start_page", 0),
                    "end_page": it.get("end_page", 0)
                })

    # Thêm các bài có trong thư mục nhưng không nằm trong TOC
    for lid, d in existing_map.items():
        if lid not in seen_ids:
            lessons.append(d)

    lessons.sort(key=lambda x: x["lesson_id"] if x.get("lesson_id") is not None else 999)
    return lessons


def get_lesson_blocks_file(grade: int, lesson_id: int) -> Optional[Path]:
    """Tìm file bài học định dạng khối (.blocks.json)."""
    grade_dir = CURRICULUM_DIR / f"tin{grade}"
    if not grade_dir.exists():
        return None
    
    # Ưu tiên đúng định dạng chuẩn: bai{id}.blocks.json
    exact_file = grade_dir / f"bai{lesson_id}.blocks.json"
    if exact_file.exists():
        return exact_file
        
    # Chỉ khớp đúng bai{id}.blocks.json hoặc bai{id}_{ts}.blocks.json (không khớp tiền tố bai10 khi tìm bai1)
    candidates = sorted(
        p for p in grade_dir.glob(f"bai{lesson_id}_*.blocks.json")
        if p.name[len(f"bai{lesson_id}_"):].split(".")[0].replace("_", "").isdigit()
    )
    if candidates:
        return candidates[0]
        
    return None


def get_lesson_files(grade: int, lesson_id: int) -> tuple[Optional[Path], Optional[Path]]:
    """Tìm đường dẫn file lý thuyết (.md) và file trắc nghiệm (_quiz.json) của bài học (Legacy fallback)."""
    grade_dir = CURRICULUM_DIR / f"tin{grade}"
    if not grade_dir.exists():
        return None, None

    md_file = None
    json_file = None

    for f in grade_dir.glob(f"bai{lesson_id}_*.md"):
        md_file = f
        break

    for f in grade_dir.glob(f"bai{lesson_id}_quiz.json"):
        json_file = f
        break

    return md_file, json_file


def blocks_to_markdown(title: str, blocks: list) -> str:
    """Tự động tổng hợp Markdown từ các khối để AI Grounding tra cứu khi cần."""
    md_lines = [f"# {title}", ""]
    for b in blocks:
        b_type = b.get("type", "")
        if b_type == "hero":
            desc = b.get("description", "")
            if desc:
                md_lines.append(desc)
                md_lines.append("")
        elif b_type == "goals":
            md_lines.append("## Mục tiêu bài học")
            for item in b.get("items", []):
                md_lines.append(f"- {item}")
            md_lines.append("")
        elif b_type == "comparison_table":
            md_lines.append("## Phân biệt Dữ liệu và Thông tin")
            left = b.get("left", {})
            right = b.get("right", {})
            md_lines.append(f"### {left.get('title', 'Dữ liệu')}: {left.get('description', '')}")
            md_lines.append(f"### {right.get('title', 'Thông tin')}: {right.get('description', '')}")
            md_lines.append("")
        elif b_type == "grid_cards":
            md_lines.append(f"## {b.get('title', 'Vật mang tin')}")
            for card in b.get("cards", []):
                md_lines.append(f"- **{card.get('title')}:** {card.get('desc')}")
            md_lines.append("")
        elif b_type == "takeaways":
            md_lines.append(f"## {b.get('title', 'Ghi nhớ trọng tâm')}")
            for item in b.get("items", []):
                md_lines.append(f"- {item}")
            md_lines.append("")
    return "\n".join(md_lines)


def load_lesson_data(grade: int, lesson_id: int) -> Dict[str, Any]:
    """Tải toàn bộ nội dung khối bài học và bộ trắc nghiệm."""
    # 1. Ưu tiên nạp từ file Blocks JSON chuẩn
    blocks_file = get_lesson_blocks_file(grade, lesson_id)
    if blocks_file and blocks_file.exists():
        with open(blocks_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        validated_pkg = LessonBlockPackageContract(**raw_data)
        content_md = blocks_to_markdown(validated_pkg.title, validated_pkg.blocks)
        return {
            "grade": validated_pkg.grade,
            "lesson_id": validated_pkg.lesson_id,
            "title": validated_pkg.title,
            "blocks": validated_pkg.blocks,
            "quiz": [q.model_dump() for q in validated_pkg.quiz],
            "content_markdown": content_md,
            "schema_version": validated_pkg.schema_version,
            "status": validated_pkg.status
        }

    # 2. Fallback sang file Markdown và Quiz Legacy
    md_file, json_file = get_lesson_files(grade, lesson_id)
    if not md_file or not md_file.exists():
        raise FileNotFoundError(f"Không tìm thấy tài liệu bài học cho Tin học {grade} - Bài {lesson_id}")

    with open(md_file, "r", encoding="utf-8") as f:
        markdown_content = f.read()

    quiz_data = []
    if json_file and json_file.exists():
        with open(json_file, "r", encoding="utf-8") as f:
            quiz_data = json.load(f)

    title = f"Tin học {grade} - Bài {lesson_id}"
    for line in markdown_content.splitlines():
        if line.startswith("# "):
            title = line.replace("# ", "").strip()
            break

    return {
        "grade": grade,
        "lesson_id": lesson_id,
        "title": title,
        "blocks": [],
        "content_markdown": markdown_content,
        "quiz": quiz_data
    }


def list_available_lessons(grade: int) -> List[Dict[str, Any]]:
    """Quét và trả về danh sách toàn bộ các bài học hiện có trong khối lớp."""
    grade_dir = CURRICULUM_DIR / f"tin{grade}"
    if not grade_dir.exists():
        return []

    lessons = []
    # Quét tất cả các file bai*.blocks.json chuẩn (bỏ qua file backup .bak)
    for p in grade_dir.glob("bai*.blocks.json"):
        if p.name.endswith(".bak"):
            continue
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            l_id = data.get("lesson_id")
            if l_id is None:
                continue
            lessons.append({
                "grade": grade,
                "lesson_id": int(l_id),
                "title": data.get("title", f"Bài {l_id}"),
                "status": data.get("status", "draft"),
                "quiz_count": len(data.get("quiz", [])),
                "blocks_count": len(data.get("blocks", [])),
                "extracted_pages": data.get("extracted_pages", []),
                "updated_at": data.get("updated_at")
            })
        except Exception:
            continue

    # Sắp xếp theo lesson_id tăng dần
    lessons.sort(key=lambda x: x["lesson_id"])
    return lessons


def save_lesson_blocks(
    grade: int, 
    lesson_id: int, 
    payload: Dict[str, Any], 
    allow_publish: bool = False,
    verified_quiz_id: Optional[str] = None,
    unverify_quiz_id: Optional[str] = None
) -> Dict[str, Any]:
    """Lưu bài học định dạng khối một cách an toàn và nguyên tử (Atomic Write)."""
    # 1. Chống Path Traversal: Kiểm tra kiểu số nguyên nghiêm ngặt
    if not isinstance(grade, int) or grade < 6 or grade > 9:
        raise ValueError("Khối lớp không hợp lệ (Bắt buộc từ 6 đến 9)")
    if not isinstance(lesson_id, int) or lesson_id < 1 or lesson_id > 100:
        raise ValueError("Mã bài học không hợp lệ (Bắt buộc là số nguyên dương)")

    # 2. Xử lý hợp nhất câu hỏi trắc nghiệm phòng vệ (Defensive Quiz Merging)
    existing_data = None
    try:
        existing_data = load_lesson_data(grade, lesson_id)
    except Exception:
        existing_data = None

    existing_quiz_map = {}
    if existing_data and "quiz" in existing_data:
        existing_quiz_map = {q["id"]: q for q in existing_data["quiz"]}

    incoming_quiz = payload.get("quiz") or []
    if not incoming_quiz and existing_data:
        payload["quiz"] = existing_data["quiz"]
    else:
        merged_quiz = []
        for q in incoming_quiz:
            q_copy = dict(q)
            q_id = q_copy.get("id")
            old_item = existing_quiz_map.get(q_id)

            # Khôi phục từ bản cũ nếu bản mới chỉ gửi thiếu
            if (not q_copy.get("dap_an_dung") or q_copy.get("dap_an_dung") not in ["A", "B", "C", "D"]) and old_item:
                q_copy["dap_an_dung"] = old_item.get("dap_an_dung")
            if not q_copy.get("giai_thich_su_pham") and old_item:
                q_copy["giai_thich_su_pham"] = old_item.get("giai_thich_su_pham", "")
            if not q_copy.get("goi_y_khi_sai") and old_item:
                q_copy["goi_y_khi_sai"] = old_item.get("goi_y_khi_sai", "")

            # Khóa cứng P0-7: Tuyệt đối KHÔNG gán mặc định 'A'. Nếu vẫn thiếu đáp án, báo lỗi!
            if not q_copy.get("dap_an_dung") or q_copy.get("dap_an_dung") not in ["A", "B", "C", "D"]:
                raise ValueError(f"Câu hỏi '{q_id}' chưa được chọn đáp án đúng (Bắt buộc là A, B, C hoặc D)")

            # Khóa cứng N2 & N3: Server kiểm soát source, grounding_verified và triệt tiêu Trôi Duyệt (Verification Drift Invariant)
            if verified_quiz_id and q_id == verified_quiz_id:
                # Chỉ khi gọi qua luồng verify_quiz_item mới được cấp 'teacher_verified'
                q_copy["source"] = "teacher_verified"
                q_copy["verified_by"] = "teacher"
                q_copy["verified_at"] = datetime.now().isoformat()
                # grounding_verified giữ nguyên hoặc false
                q_copy["grounding_verified"] = old_item.get("grounding_verified", False) if old_item else False
            elif unverify_quiz_id and q_id == unverify_quiz_id:
                # Bỏ duyệt
                q_copy["source"] = "generated"
                q_copy["grounding_verified"] = False
                q_copy["verified_by"] = None
                q_copy["verified_at"] = None
            elif old_item:
                # Kiểm tra trôi nội dung (N3): Nếu đề bài, lựa chọn hoặc đáp án đúng thay đổi -> Hủy bỏ duyệt!
                content_changed = (
                    q_copy.get("cau_hoi", "").strip() != old_item.get("cau_hoi", "").strip() or
                    q_copy.get("lua_chon") != old_item.get("lua_chon") or
                    q_copy.get("dap_an_dung") != old_item.get("dap_an_dung")
                )
                if content_changed:
                    # N3: Bị sửa đổi nội dung -> ép về 'generated', xóa cờ verified
                    q_copy["source"] = "generated"
                    q_copy["grounding_verified"] = False
                    q_copy["verified_by"] = None
                    q_copy["verified_at"] = None
                else:
                    # B1 Invariant: Xác thực verified_by hợp lệ nếu câu hỏi có source == teacher_verified
                    if old_item.get("source") == "teacher_verified" and old_item.get("verified_by") != "teacher":
                        raise ValueError(f"Câu hỏi '{q_id}' có dấu duyệt không hợp lệ (verified_by)")
                    # Giữ nguyên trạng thái đã lưu trước đó; CẤM client tự phong 'teacher_verified' (N2)
                    q_copy["source"] = old_item.get("source", "generated")
                    q_copy["grounding_verified"] = old_item.get("grounding_verified", False)
                    q_copy["verified_by"] = old_item.get("verified_by")
                    q_copy["verified_at"] = old_item.get("verified_at")
            else:
                # Câu hỏi mới toanh từ client -> Mặc định là 'generated', chưa duyệt (N2)
                q_copy["source"] = "generated"
                q_copy["grounding_verified"] = False
                q_copy["verified_by"] = None
                q_copy["verified_at"] = None

            merged_quiz.append(q_copy)
        payload["quiz"] = merged_quiz

    # Khóa cứng P0-2: Kiểm định gợi ý Socratic chống rò rỉ đáp án cho mọi câu hỏi
    from backend.socratic_validator import validate_socratic_hint
    for q_check in payload.get("quiz", []):
        hint = q_check.get("goi_y_khi_sai", "")
        c_key = q_check.get("dap_an_dung", "")
        opts = q_check.get("lua_chon", {})
        f_kws = q_check.get("forbidden_keywords", [])
        q_title = q_check.get("cau_hoi", "")
        is_h_valid, h_reason = validate_socratic_hint(hint, c_key, opts, f_kws, q_title)
        if not is_h_valid:
            raise ValueError(f"Câu hỏi '{q_check.get('id')}': {h_reason}")

    # Khóa cứng P0-1: Triệt tiêu trôi duyệt và giả mạo dấu duyệt khối nội dung (Block Verification Drift Invariant)
    def _block_content_key(b_item: dict) -> str:
        clean_content = {
            k: v for k, v in b_item.items()
            if k not in ("source", "teacher_reviewed", "reviewed_by", "reviewed_at")
        }
        return json.dumps(clean_content, sort_keys=True, ensure_ascii=False)

    existing_blocks_map = {}
    if existing_data and "blocks" in existing_data:
        for old_b in existing_data.get("blocks", []):
            if isinstance(old_b, dict) and old_b.get("teacher_reviewed") is True and old_b.get("reviewed_by") == "teacher":
                existing_blocks_map[_block_content_key(old_b)] = old_b

    sanitized_blocks = []
    for b in payload.get("blocks", []):
        b_dict = dict(b)
        b_key = _block_content_key(b_dict)
        matched_old_b = existing_blocks_map.get(b_key)
        
        if matched_old_b:
            # Nội dung block y hệt bản cũ đã duyệt bởi giáo viên -> Bảo tồn metadata duyệt
            b_dict["source"] = matched_old_b.get("source", "generated")
            b_dict["teacher_reviewed"] = True
            b_dict["reviewed_by"] = matched_old_b.get("reviewed_by", "teacher")
            b_dict["reviewed_at"] = matched_old_b.get("reviewed_at")
        else:
            # Block mới hoặc đã bị sửa nội dung -> Ép về generated, hủy mọi dấu duyệt giả mạo
            b_dict["source"] = "generated"
            b_dict["teacher_reviewed"] = False
            b_dict["reviewed_by"] = None
            b_dict["reviewed_at"] = None
        sanitized_blocks.append(b_dict)
    payload["blocks"] = sanitized_blocks

    # 3. Kiểm chứng hình thức với Pydantic Contract
    payload["grade"] = grade
    payload["lesson_id"] = lesson_id
    if not payload.get("updated_at"):
        payload["updated_at"] = datetime.now().isoformat()

    # Khóa cứng N1: Nếu lưu bài đang 'published' nhưng có câu hỏi chưa duyệt (source != 'teacher_verified')
    # -> BẮT BUỘC tự động hạ về 'draft' (Demote to Draft Invariant) để tuyệt đối không lọt câu chưa duyệt lên học sinh!
    if allow_publish:
        target_status = "published"
    else:
        existing_status = existing_data.get("status", "draft") if existing_data else "draft"
        if existing_status == "published":
            has_unverified_quiz = any(
                q.get("source") != "teacher_verified"
                for q in payload.get("quiz", [])
            )
            if has_unverified_quiz:
                target_status = "draft"
            else:
                target_status = "published"
        else:
            target_status = "draft"

    payload["status"] = target_status

    validated = LessonBlockPackageContract(**payload)

    # 4. Ghi file nguyên tử và sao lưu bản cũ đa thế hệ (Multi-generation Backup Invariant P0-6 & Item 14 & A3)
    grade_dir = CURRICULUM_DIR / f"tin{grade}"
    grade_dir.mkdir(parents=True, exist_ok=True)
    target_file = grade_dir / f"bai{lesson_id}.blocks.json"

    backup_created = False
    if target_file.exists():
        backup_file = grade_dir / f"bai{lesson_id}.blocks.json.bak"
        shutil.copy2(target_file, backup_file)
        backup_created = backup_file.exists()

        # Bản sao lưu đa thế hệ có timestamp microsecond chống ghi đè cùng giây (A3)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        ts_backup_file = grade_dir / f"bai{lesson_id}_{ts}.blocks.json.bak"
        shutil.copy2(target_file, ts_backup_file)

        # Giữ tối đa 5 bản sao lưu đa thế hệ gần nhất của ĐÚNG bài học này (A3 & D3)
        old_baks = sorted(
            (p for p in grade_dir.glob(f"bai{lesson_id}_*.blocks.json.bak")
             if p.name[len(f"bai{lesson_id}_"):].split(".")[0].replace("_", "").isdigit()),
            key=lambda p: p.name,  # Tên chứa timestamp YYYYMMDD_HHMMSS_ffffff: sắp theo tên là theo thời gian
        )
        for b in old_baks[:-5]:
            try:
                b.unlink()
            except OSError:
                pass

    with tempfile.NamedTemporaryFile("w", dir=str(grade_dir), delete=False, encoding="utf-8") as tf:
        json.dump(validated.model_dump(), tf, ensure_ascii=False, indent=2)
        tf.flush()
        os.fsync(tf.fileno())
        temp_name = tf.name

    os.replace(temp_name, str(target_file))

    return {
        "success": True,
        "message": f"Đã lưu thành công bài học Tin {grade} - Bài {lesson_id}",
        "path": str(target_file),
        "backup_created": backup_created,
        "status": target_status
    }


def get_class_analytics_data(grade: int, class_name: str) -> Any:
    """
    Cung cấp dữ liệu phân tích số liệu lớp học chuẩn hóa theo khế ước ClassAnalyticsResponse.
    Phục vụ Teacher Analytics Dashboard (Sẵn sàng hoán đổi sang Cloud Firestore).
    """
    from backend.contracts import (
        ClassAnalyticsResponse,
        ClassKPIMetrics,
        StudentOverviewItem,
        TopicMasteryStatus
    )

    topics_meta = [
        ("the_gioi_ki_thuat_so", "Thế giới kĩ thuật số"),
        ("thong_tin_giai_quyet_van_de", "Thông tin trong giải quyết vấn đề"),
        ("danh_gia_chat_luong_thong_tin", "Đánh giá chất lượng thông tin"),
        ("su_dung_dich_vu_internet", "Sử dụng dịch vụ Internet"),
        ("phan_mem_ma_nguon_mo", "Phần mềm mã nguồn mở")
    ]

    names = [
        ("Nguyễn Minh Anh", "HS001", 100, 9.2, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Trần Gia Bảo", "HS002", 92, 8.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Lê Khánh Chi", "HS003", 71, 7.8, "needs_support", ["mastered", "mastered", "warning", "not_started", "not_started"]),
        ("Phạm Đức Duy", "HS004", 100, 9.0, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Hoàng Ngọc Hà", "HS005", 57, 7.2, "needs_support", ["mastered", "mastered", "warning", "warning", "not_started"]),
        ("Vũ Hải Đăng", "HS006", 100, 8.8, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Đỗ Thùy Linh", "HS007", 100, 9.4, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Bùi Anh Tuấn", "HS008", 88, 8.2, "completed", ["mastered", "mastered", "warning", "mastered", "mastered"]),
        ("Đặng Quang Huy", "HS009", 50, 6.5, "needs_support", ["warning", "warning", "warning", "mastered", "not_started"]),
        ("Ngô Khánh Linh", "HS010", 100, 8.9, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Dương Quốc Bảo", "HS011", 100, 8.5, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Lý Thu Thảo", "HS012", 100, 9.1, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Tạ Minh Khôi", "HS013", 100, 8.7, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Phan Thanh Trúc", "HS014", 60, 6.8, "needs_support", ["warning", "mastered", "warning", "not_started", "not_started"]),
        ("Hồ Văn Nam", "HS015", 100, 8.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Mai Phương Thảo", "HS016", 100, 9.3, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Đinh Trọng Nghĩa", "HS017", 90, 8.0, "completed", ["mastered", "warning", "mastered", "mastered", "mastered"]),
        ("Lâm Gia Hưng", "HS018", 100, 8.8, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Võ Quỳnh Như", "HS019", 100, 9.5, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Trịnh Bá Kiên", "HS020", 45, 6.0, "needs_support", ["warning", "warning", "warning", "warning", "not_started"]),
        ("Nguyễn Lan Hương", "HS021", 100, 9.0, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Trần Thanh Tùng", "HS022", 100, 8.4, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Lê Bảo Ngọc", "HS023", 100, 9.2, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Phạm Thùy Trang", "HS024", 100, 8.7, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Hoàng Minh Triết", "HS025", 92, 8.1, "completed", ["mastered", "mastered", "warning", "mastered", "mastered"]),
        ("Vũ Cẩm Ly", "HS026", 100, 8.9, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Đỗ Nhật Nam", "HS027", 100, 8.3, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Bùi Yến Nhi", "HS028", 100, 9.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Đặng Tiến Đạt", "HS029", 95, 8.0, "completed", ["mastered", "warning", "mastered", "mastered", "mastered"]),
        ("Ngô Gia Khiêm", "HS030", 100, 8.8, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Cao Thái Sơn", "HS031", 100, 8.5, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Lương Mỹ Hạnh", "HS032", 100, 9.0, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Chu Đình Trọng", "HS033", 100, 8.6, "completed", ["mastered", "mastered", "mastered", "mastered", "mastered"]),
        ("Nghiêm Xuân Tú", "HS034", 15, 4.5, "learning", ["warning", "not_started", "not_started", "not_started", "not_started"]),
        ("Dương Thùy Chi", "HS035", 15, 5.0, "learning", ["warning", "not_started", "not_started", "not_started", "not_started"]),
    ]

    students: List[StudentOverviewItem] = []
    for full_name, code, progress, score, status, topic_states in names:
        student_topics = []
        for (tid, tname), tstate in zip(topics_meta, topic_states):
            t_score = score if tstate == "mastered" else (score - 2.0 if tstate == "warning" else 0.0)
            t_score = max(0.0, min(10.0, round(t_score, 1)))
            student_topics.append(TopicMasteryStatus(
                topic_id=tid,
                topic_name=tname,
                score=t_score,
                status=tstate
            ))
        students.append(StudentOverviewItem(
            id=f"hs-{code.lower()}",
            student_code=code,
            full_name=full_name,
            progress_percent=progress,
            average_score=score,
            topics=student_topics,
            status=status
        ))

    kpi = ClassKPIMetrics(
        total_students=35,
        completed_count=28,
        completed_percent=80.0,
        average_score=8.4,
        score_delta_month=0.6,
        improved_count=30,
        improved_percent=86.0,
        needs_support_count=5,
        needs_support_percent=14.0
    )

    topic_averages = {
        "the_gioi_ki_thuat_so": 8.6,
        "thong_tin_giai_quyet_van_de": 8.1,
        "danh_gia_chat_luong_thong_tin": 7.8,
        "su_dung_dich_vu_internet": 8.5,
        "phan_mem_ma_nguon_mo": 8.9
    }

    donut = {
        "completed": 28,
        "learning": 5,
        "not_started": 2
    }

    return ClassAnalyticsResponse(
        grade=grade,
        class_name=class_name,
        semester="Học kì I (2026 - 2027)",
        kpi=kpi,
        topic_averages=topic_averages,
        donut_progress=donut,
        students=students
    )

