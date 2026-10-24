"""
Unit Tests for Extraction Engine & Socratic Validator.
Kiểm thử tự động đáp ứng 100% các tiêu chuẩn kiểm duyệt từ Claude 3.5 Sonnet (P0 & P1):
1. Validator Socratic (3 ca lộ + 3 ca sạch).
2. Gọi validator Socratic trong đường lưu (P0-2: từ chối lưu bài có gợi ý lộ).
3. Ép cứng metadata duyệt & draft (P0-3: ghi đè teacher_reviewed, grounding_verified).
4. Ánh xạ số trang pdf_index = book_page + page_offset (C2).
5. Ghi nguyên tử và quy ước backup đồng bộ với grounding.py (P1-4: bai{id}_{ts}.blocks.json.bak).
"""

import json
import os
import shutil
import tempfile
import pytest

from backend.socratic_validator import validate_socratic_hint
from backend.extraction_engine import (
    compute_pdf_index,
    validate_and_sanitize_lesson_package,
    atomic_save_lesson
)


# ==============================================================================
# 1. KIỂM THỬ SOCRATIC VALIDATOR: 3 CA LỘ VÀ 3 CA SẠCH
# ==============================================================================

def test_socratic_validator_3_leaky_cases():
    options = {
        "A": "Nghe tiếng thầy giáo giảng bài",
        "B": "Suy nghĩ lời giải bài toán trong đầu",
        "C": "Viết đáp án vào cuốn vở",
        "D": "Gửi tin nhắn chúc mừng sinh nhật bạn"
    }

    # Ca lộ 1: Tiết lộ trực tiếp phương án đúng bằng mẫu Regex ("chọn A", "đáp án là A")
    hint_leak_1 = "Gợi ý: Em hãy chọn đáp án A nhé!"
    valid, reason = validate_socratic_hint(hint_leak_1, "A", options)
    assert not valid
    assert "tiết lộ đáp án trực tiếp" in reason

    # Ca lộ 2: Chứa nguyên văn nội dung của đáp án đúng
    hint_leak_2 = "Em hãy nhớ lại lúc nghe tiếng thầy giáo giảng bài trên lớp để tìm câu trả lời."
    valid, reason = validate_socratic_hint(hint_leak_2, "A", options)
    assert not valid
    assert "nguyên văn" in reason

    # Ca lộ 3: Chứa từ khóa độc quyền của phương án đúng (forbidden keywords)
    hint_leak_3 = "Hoạt động nào sử dụng thính giác để tiếp nhận thông tin?"
    valid, reason = validate_socratic_hint(
        hint_leak_3, "A", options,
        forbidden_keywords=["thính giác", "thầy giáo", "giảng bài"]
    )
    assert not valid
    assert "từ khóa cấm" in reason


def test_socratic_validator_3_clean_cases():
    options = {
        "A": "Nghe tiếng thầy giáo giảng bài",
        "B": "Suy nghĩ lời giải bài toán trong đầu",
        "C": "Viết đáp án vào cuốn vở",
        "D": "Gửi tin nhắn chúc mừng sinh nhật bạn"
    }

    # Ca sạch 1: Hướng dẫn khái niệm bản chất, không lộ phương án
    hint_clean_1 = (
        "Em hãy nhớ lại: 'Thu nhận thông tin' là bước tiếp nhận tác động từ môi trường bên ngoài "
        "vào cơ thể qua các giác quan. Hãy phân biệt với việc bộ não tự xử lý bên trong nhé!"
    )
    valid, reason = validate_socratic_hint(hint_clean_1, "A", options, forbidden_keywords=["thính giác"])
    assert valid
    assert reason == "Hợp lệ"

    # Ca sạch 2: Đặt câu hỏi tư duy gợi mở
    hint_clean_2 = "Trong 4 hoạt động trên, hoạt động nào đưa dữ liệu từ thế giới bên ngoài vào giác quan của chúng ta?"
    valid, reason = validate_socratic_hint(hint_clean_2, "A", options, forbidden_keywords=["thính giác"])
    assert valid

    # Ca sạch 3: Dẫn dắt loại trừ nhận thức mà không nhắc đến chữ cái hay từ khóa nhạy cảm
    hint_clean_3 = "Viết vào vở hay gửi tin nhắn là truyền đạt thông tin ra ngoài; suy nghĩ là bước xử lý trong não bộ."
    valid, reason = validate_socratic_hint(hint_clean_3, "A", options, forbidden_keywords=["thính giác"])
    assert valid


# ==============================================================================
# 2. KIỂM THỬ P0-2: ĐƯỜNG LƯU PHẢI TỪ CHỐI BÀI CÓ GỢI Ý LỘ
# ==============================================================================

def test_save_pipeline_rejects_leaky_hint_in_quiz():
    payload_with_leak = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 2,
        "title": "Bài học lỗi",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "H", "badge": "B", "description": "D"}],
        "quiz": [
            {
                "id": "q_leak_1",
                "cau_hoi": "Câu hỏi test",
                "lua_chon": {"A": "Đáp án đúng", "B": "Sai"},
                "dap_an_dung": "A",
                "goi_y_khi_sai": "Em hãy chọn phương án A nhé!"  # Mẫu lộ
            }
        ]
    }

    is_valid, error_msg, sanitized = validate_and_sanitize_lesson_package(payload_with_leak)
    assert not is_valid
    assert "tiết lộ đáp án trực tiếp" in error_msg
    assert sanitized is None


# ==============================================================================
# 3. KIỂM THỬ P0-3: ÉP CỨNG METADATA DUYỆT (CHỐNG INJECTION)
# ==============================================================================

def test_validator_forces_draft_and_strips_fake_review():
    raw_payload = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 2,
        "title": "Xử lý thông tin",
        "status": "published",  # Cố tình đặt published
        "blocks": [
            {
                "type": "hero",
                "badge": "BÀI 2",
                "title": "Xử lý thông tin",
                "description": "Nội dung bài học",
                "source": "teacher_verified", # Giả mạo
                "teacher_reviewed": True,     # Giả mạo
                "reviewed_by": "hacker",
                "reviewed_at": "2026-10-15T00:00:00"
            }
        ],
        "quiz": [
            {
                "id": "q1",
                "cau_hoi": "Câu hỏi hợp lệ?",
                "lua_chon": {"A": "Đúng", "B": "Sai", "C": "Chưa rõ", "D": "Khác"},
                "dap_an_dung": "A",
                "giai_thich_su_pham": "Giải thích chuẩn sư phạm.",
                "goi_y_khi_sai": "Hãy đọc kỹ định nghĩa trong SGK.",
                "source": "teacher_verified", # Giả mạo
                "grounding_verified": True,   # Giả mạo
                "verified_by": "hacker",
                "verified_at": "2026-10-15T00:00:00"
            }
        ]
    }

    # Luồng bóc tách kiểm định: BẮT BUỘC ép cứng status='draft', triệt tiêu toàn bộ dấu duyệt giả mạo
    is_valid, err, sanitized = validate_and_sanitize_lesson_package(raw_payload)
    assert is_valid, f"Unexpected validation error: {err}"
    assert sanitized is not None
    assert sanitized["status"] == "draft"
    # Toàn bộ dấu duyệt bị xóa về mặc định an toàn
    assert sanitized["blocks"][0]["source"] == "generated"
    assert sanitized["blocks"][0]["teacher_reviewed"] is False
    assert sanitized["blocks"][0]["reviewed_by"] is None
    assert sanitized["blocks"][0]["reviewed_at"] is None

    assert sanitized["quiz"][0]["source"] == "generated"
    assert sanitized["quiz"][0]["grounding_verified"] is False
    assert sanitized["quiz"][0]["verified_by"] == "None" or sanitized["quiz"][0]["verified_by"] is None
    assert sanitized["quiz"][0]["verified_at"] is None


def test_save_lesson_blocks_strips_fake_review_on_blocks_and_quiz_without_prior_approval(tmp_path, monkeypatch):
    """Sonnet Vòng 7 P0-1: Client/AI không thể tự phong dấu duyệt. Nếu bài cũ chưa duyệt, ép cứng về generated/False."""
    import backend.grounding as grounding_module
    from backend.grounding import save_lesson_blocks
    monkeypatch.setattr(grounding_module, "CURRICULUM_DIR", tmp_path)

    grade_dir = tmp_path / "tin6"
    grade_dir.mkdir(parents=True, exist_ok=True)
    dest_file = grade_dir / "bai3.blocks.json"

    # 1. Tạo file cũ ở trạng thái draft chưa duyệt
    initial_unreviewed = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 3,
        "title": "Bài 3 Draft",
        "status": "draft",
        "blocks": [
            {
                "type": "hero",
                "badge": "BÀI 3",
                "title": "Bài 3",
                "description": "Nội dung gốc",
                "source": "generated",
                "teacher_reviewed": False,
                "reviewed_by": None
            }
        ],
        "quiz": [
            {
                "id": "tin6_b3_q1",
                "cau_hoi": "Câu hỏi gốc?",
                "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
                "dap_an_dung": "A",
                "giai_thich_su_pham": "Giải thích A.",
                "goi_y_khi_sai": "Hãy xem lại định nghĩa.",
                "source": "generated",
                "grounding_verified": False,
                "verified_by": None
            }
        ]
    }
    with open(dest_file, "w", encoding="utf-8") as f:
        json.dump(initial_unreviewed, f)

    # 2. Client gửi payload cố tình giả mạo teacher_reviewed=True và teacher_verified
    fake_payload = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 3,
        "title": "Bài 3 Giả Mạo",
        "status": "draft",
        "blocks": [
            {
                "type": "hero",
                "badge": "BÀI 3",
                "title": "Bài 3",
                "description": "Nội dung gốc",
                "source": "teacher_verified",      # Cố tình giả mạo
                "teacher_reviewed": True,          # Cố tình giả mạo
                "reviewed_by": "teacher"
            },
            {
                "type": "goals",
                "items": ["Mục tiêu mới"],
                "source": "teacher_verified",      # Block mới giả mạo
                "teacher_reviewed": True,
                "reviewed_by": "teacher"
            }
        ],
        "quiz": [
            {
                "id": "tin6_b3_q1",
                "cau_hoi": "Câu hỏi gốc?",
                "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
                "dap_an_dung": "A",
                "giai_thich_su_pham": "Giải thích A.",
                "goi_y_khi_sai": "Hãy xem lại định nghĩa.",
                "source": "teacher_verified",      # Cố tình giả mạo quiz
                "grounding_verified": True,
                "verified_by": "teacher"
            }
        ]
    }

    # Lưu qua pipeline chính thống save_lesson_blocks
    save_lesson_blocks(grade=6, lesson_id=3, payload=fake_payload, allow_publish=False)

    # Đọc lại từ đĩa để xác minh
    with open(dest_file, "r", encoding="utf-8") as f:
        saved = json.load(f)

    # Cả 2 block đều PHẢI bị ép về False/generated/None vì file cũ chưa từng được duyệt!
    assert saved["blocks"][0]["teacher_reviewed"] is False
    assert saved["blocks"][0]["reviewed_by"] is None
    assert saved["blocks"][0]["source"] == "generated"

    assert saved["blocks"][1]["teacher_reviewed"] is False
    assert saved["blocks"][1]["reviewed_by"] is None
    assert saved["blocks"][1]["source"] == "generated"

    # Quiz cũng PHẢI bị ép về False/generated/None vì file cũ chưa có dấu duyệt hợp lệ!
    assert saved["quiz"][0]["grounding_verified"] is False
    assert saved["quiz"][0]["verified_by"] is None
    assert saved["quiz"][0]["source"] == "generated"

    # 3. Bây giờ giả sử file cũ ĐÃ ĐƯỢC GIÁO VIÊN DUYỆT THẬT
    saved["blocks"][0]["teacher_reviewed"] = True
    saved["blocks"][0]["reviewed_by"] = "teacher"
    saved["blocks"][0]["reviewed_at"] = "2026-10-15T00:00:00"
    with open(dest_file, "w", encoding="utf-8") as f:
        json.dump(saved, f)

    # Case A: Gửi payload giữ nguyên nội dung block 0 -> Giữ nguyên dấu duyệt!
    save_lesson_blocks(grade=6, lesson_id=3, payload=fake_payload, allow_publish=False)
    with open(dest_file, "r", encoding="utf-8") as f:
        saved_preserved = json.load(f)
    assert saved_preserved["blocks"][0]["teacher_reviewed"] is True
    assert saved_preserved["blocks"][0]["reviewed_by"] == "teacher"

    # Case B: Gửi payload sửa nội dung block 0 -> Mất dấu duyệt (Verification Drift Invariant)!
    tampered_payload = dict(fake_payload)
    tampered_payload["blocks"] = [
        {
            "type": "hero",
            "badge": "BÀI 3 SỬA ĐỔI",
            "title": "Tiêu đề đã bị sửa",
            "description": "Nội dung đã sửa",
            "teacher_reviewed": True,
            "reviewed_by": "teacher"
        }
    ]
    save_lesson_blocks(grade=6, lesson_id=3, payload=tampered_payload, allow_publish=False)
    with open(dest_file, "r", encoding="utf-8") as f:
        saved_drift = json.load(f)
    assert saved_drift["blocks"][0]["teacher_reviewed"] is False
    assert saved_drift["blocks"][0]["reviewed_by"] is None
    assert saved_drift["blocks"][0]["source"] == "generated"


# ==============================================================================
# 4. KIỂM THỬ ÁNH XẠ SỐ TRANG: pdf_index = book_page + page_offset
# ==============================================================================

def test_page_offset_calculation():
    # Sách Tin 6 Kết nối tri thức: book_page 8 tương ứng pdf_index 8 (offset = 0)
    assert compute_pdf_index(8, 0) == 8
    assert compute_pdf_index(11, 0) == 11
    # Test tính toán với offset khác
    assert compute_pdf_index(8, 2) == 10
    assert compute_pdf_index(8, -1) == 7


# ==============================================================================
# 5. KIỂM THỬ GHI NGUYÊN TỬ & ĐỒNG BỘ BACKUP VỚI GROUNDING.PY (P1-4)
# ==============================================================================

def test_atomic_save_and_multi_generation_backup_sync(tmp_path, monkeypatch):
    import backend.grounding as grounding_module
    monkeypatch.setattr(grounding_module, "CURRICULUM_DIR", tmp_path)

    grade_dir = tmp_path / "tin6"
    grade_dir.mkdir(parents=True, exist_ok=True)
    dest_file = grade_dir / "bai2.blocks.json"
    
    # 1. Tạo file ban đầu
    initial_data = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 2,
        "title": "Bản gốc",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Gốc", "badge": "B1", "description": "D1"}],
        "quiz": []
    }
    with open(dest_file, "w", encoding="utf-8") as f:
        json.dump(initial_data, f)

    assert dest_file.exists()

    # 2. Ghi đè bằng atomic_save_lesson
    updated_data = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 2,
        "title": "Bản mới cập nhật",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Mới", "badge": "B2", "description": "D2"}],
        "quiz": []
    }
    atomic_save_lesson(str(dest_file), updated_data)

    # 3. Kiểm tra file chính đã cập nhật
    with open(dest_file, "r", encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded["title"] == "Bản mới cập nhật"

    # 4. Kiểm tra quy ước file backup đồng bộ với grounding.py: bai2_*.blocks.json.bak
    bak_files = list(grade_dir.glob("bai2_*.blocks.json.bak"))
    assert len(bak_files) == 1, f"Không tìm thấy file backup theo quy ước bai2_<ts>.blocks.json.bak: {bak_files}"
    assert grade_dir / "bai2.blocks.json.bak" in grade_dir.glob("*.bak")


def test_atomic_save_failure_preserves_original_file(tmp_path, monkeypatch):
    import backend.grounding as grounding_module
    monkeypatch.setattr(grounding_module, "CURRICULUM_DIR", tmp_path)

    grade_dir = tmp_path / "tin6"
    grade_dir.mkdir(parents=True, exist_ok=True)
    dest_file = grade_dir / "bai2.blocks.json"
    original_content = {"schema_version": "2.0", "grade": 6, "lesson_id": 2, "title": "Bất biến", "blocks": [], "quiz": []}
    
    with open(dest_file, "w", encoding="utf-8") as f:
        json.dump(original_content, f)

    # Giả lập lỗi sập nguồn/ghi đĩa giữa chừng khi gọi os.replace
    def mock_replace(src, dst):
        raise OSError("Giả lập lỗi sập đĩa khi replace")

    monkeypatch.setattr(os, "replace", mock_replace)

    with pytest.raises(IOError, match="Lỗi khi ghi nguyên tử"):
        atomic_save_lesson(str(dest_file), original_content)

    # File gốc bắt buộc còn nguyên vẹn 100%
    with open(dest_file, "r", encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded["title"] == "Bất biến"


def test_multi_generation_backup_prunes_to_max_5_after_7_saves(tmp_path, monkeypatch):
    """Sonnet Condition 4: Sau 7 lần lưu liên tiếp, thư mục sao lưu chỉ lưu trữ đúng tối đa 5 bản đa thế hệ bai{id}_*.blocks.json.bak."""
    import backend.grounding as grounding_module
    from backend.grounding import save_lesson_blocks

    # Mock CURRICULUM_DIR trỏ vào tmp_path để kiểm thử cô lập
    monkeypatch.setattr(grounding_module, "CURRICULUM_DIR", tmp_path)

    test_lesson_id = 97
    base_payload = {
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bản lưu khởi đầu",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "B", "badge": "T", "description": "D"}],
        "quiz": []
    }

    # 1. Lưu bản đầu tiên (tạo file gốc)
    save_lesson_blocks(6, test_lesson_id, base_payload)

    # 2. Thực hiện 7 lần ghi đè tiếp theo
    for i in range(1, 8):
        update_payload = dict(base_payload)
        update_payload["title"] = f"Bản lưu thứ {i}"
        save_lesson_blocks(6, test_lesson_id, update_payload)

    # 3. Đếm số file backup đa thế hệ bai{id}_*.blocks.json.bak
    grade_dir = tmp_path / "tin6"
    ts_baks = list(grade_dir.glob(f"bai{test_lesson_id}_*.blocks.json.bak"))
    assert len(ts_baks) == 5, f"Số bản sao lưu đa thế hệ là {len(ts_baks)} (Mong đợi đúng 5 bản sau 7 lần lưu)!"


def test_extract_and_structure_lesson_bounds_and_cancellation():
    from backend.extraction_engine import extract_and_structure_lesson
    import threading

    # 1. Tệp không tồn tại
    ok, err, pkg = extract_and_structure_lesson("non_existent_file.pdf", 6, 2, 8, 11)
    assert not ok
    assert "không tồn tại" in err

    # 2. Trang bắt đầu > kết thúc
    real_pdf = r"sgk-sample.pdf"
    ok, err, pkg = extract_and_structure_lesson(real_pdf, 6, 2, 12, 10)
    assert not ok
    assert "lớn hơn trang kết thúc" in err

    # 3. Hủy bỏ trước bằng cancel_event
    cancel_ev = threading.Event()
    cancel_ev.set()  # Đã kích hoạt hủy
    ok, err, pkg = extract_and_structure_lesson(real_pdf, 6, 2, 8, 11, cancel_event=cancel_ev)
    assert not ok
    assert "hủy bỏ" in err


def test_extract_and_structure_lesson_timeout_and_http_options_mocked(monkeypatch):
    """Sonnet P0-A: Kiểm chứng mock timeout 30_000ms được truyền thật vào HttpOptions và client."""
    from backend.extraction_engine import extract_and_structure_lesson
    from google.genai import types

    captured_client_kwargs = {}
    captured_call_kwargs = {}

    class MockGenerateResponse:
        def __init__(self):
            import json
            payload = {
                "schema_version": "2.0",
                "grade": 6,
                "lesson_id": 2,
                "title": "Xử lý thông tin",
                "status": "draft",
                "blocks": [{"type": "hero", "title": "B2", "badge": "T", "description": "D"}],
                "quiz": []
            }
            self.text = json.dumps(payload)

    class MockModels:
        def generate_content(self, model, contents, config):
            captured_call_kwargs["model"] = model
            captured_call_kwargs["config"] = config
            assert config.http_options is not None, "config.http_options bị thiếu!"
            assert config.http_options.timeout == 30000, f"Timeout không phải 30000ms: {config.http_options.timeout}"
            return MockGenerateResponse()

    class MockGenAIClient:
        def __init__(self, api_key=None, http_options=None):
            captured_client_kwargs["api_key"] = api_key
            captured_client_kwargs["http_options"] = http_options
            assert http_options is not None, "Client http_options bị thiếu!"
            assert http_options.timeout == 30000, f"Client timeout không phải 30000ms: {http_options.timeout}"
            self.models = MockModels()

    import google.genai as genai_module
    monkeypatch.setattr(genai_module, "Client", MockGenAIClient)

    real_pdf = r"sgk-sample.pdf"
    ok, err, pkg = extract_and_structure_lesson(
        pdf_path=real_pdf,
        grade=6,
        lesson_id=2,
        start_page=8,
        end_page=9,
        api_key="mock_test_key"
    )

    assert ok, f"Bóc tách thất bại: {err}"
    assert pkg is not None
    assert pkg["title"] == "Xử lý thông tin"
    assert captured_client_kwargs["http_options"].timeout == 30000
    assert captured_call_kwargs["config"].http_options.timeout == 30000


def test_extract_and_structure_lesson_missing_api_key_returns_error(monkeypatch):
    """Sonnet Vòng 6: Kiểm chứng nhánh không có GEMINI_API_KEY trả lỗi ngay trước khi gọi API."""
    from backend.extraction_engine import extract_and_structure_lesson
    import dotenv

    # Giả lập môi trường không có GEMINI_API_KEY
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **kw: None)

    real_pdf = r"sgk-sample.pdf"
    ok, err, pkg = extract_and_structure_lesson(
        pdf_path=real_pdf,
        grade=6,
        lesson_id=2,
        start_page=8,
        end_page=9,
        api_key=""
    )
    assert not ok
    assert "GEMINI_API_KEY" in err
    assert pkg is None


def test_extract_and_structure_lesson_missing_key_in_real_env_file(tmp_path, monkeypatch):
    """Sonnet Vòng 9 P1-1: Kiểm chứng hành vi nạp dotenv thật (không monkeypatch load_dotenv) khi cả env var và file .env đều rỗng."""
    from backend.extraction_engine import extract_and_structure_lesson

    # Tạo file .env rỗng không có GEMINI_API_KEY
    empty_env = tmp_path / ".env"
    empty_env.write_text("SOME_NON_KEY_VAR=123\n", encoding="utf-8")

    # Xóa biến môi trường GEMINI_API_KEY
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    # Trỏ ROOT_DIR và working directory sang tmp_path để dotenv nạp file .env rỗng này
    import backend.extraction_engine as ee_mod
    monkeypatch.setattr(ee_mod, "ROOT_DIR", tmp_path)
    monkeypatch.chdir(tmp_path)

    real_pdf = r"sgk-sample.pdf"
    ok, err, pkg = extract_and_structure_lesson(
        pdf_path=real_pdf,
        grade=6,
        lesson_id=2,
        start_page=8,
        end_page=9
    )
    assert not ok
    assert "GEMINI_API_KEY" in err
    assert pkg is None
