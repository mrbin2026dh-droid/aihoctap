"""
Kiểm thử Unit & Integration: Data-driven Block Schema & Teacher Studio API
Tuân thủ Luật Proof-Driven & Zero-Trust (V3 Airtight Suite - 16 Tests):
1. Học sinh F12 không bao giờ thấy đáp án đúng hoặc giải thích.
2. Route giáo viên BẮT BUỘC xác thực Session Token Bearer, từ chối X-Teacher-PIN thô.
3. Brute-force rate limiting: Khóa 429 sau 5 lần thử sai mã PIN.
4. Draft Gating đồng nhất: 403 Forbidden trên /api/lesson, /api/chat, và /api/grade-quiz.
5. Bảo toàn Draft khi lưu: save-lesson CẤM tự ý xuất bản thành published.
6. Xuất bản bắt buộc giáo viên duyệt 100% câu hỏi (source: teacher_verified).
7. Kiểm chứng nguồn xác định PyMuPDF (Deterministic Grounding Verifier).
8. Sao lưu nguyên tử .bak độc lập và đa thế hệ.
9. Từ chối câu hỏi thiếu đáp án (không gán ngầm 'A').
10. N1: Lưu bài đã xuất bản với câu chưa duyệt tự động hạ về draft.
11. N2: Client không thể tự gắn source='teacher_verified' qua save-lesson.
12. N3: Đổi nội dung câu đã duyệt lập tức reset về generated & grounding_verified=False.
13. N5: Mã PIN chứa ký tự non-ASCII trả 401 an toàn, ghi nhận rate limit, không lỗi 500.
14. Động cơ Grounding phát hiện câu hỏi bịa đặt dùng từ vựng SGK.
15. Duyệt và hủy duyệt câu hỏi qua endpoint verify-quiz-item ghi audit log.
16. Tuyệt đối không làm biến đổi tệp sản xuất thật (0 mutation).
"""
import os
import json
import time
import shutil
import hashlib
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.server import app, TEACHER_PIN, FAILED_LOGIN_ATTEMPTS
from backend.contracts import LessonBlockPackageContract, QuizItemContract
import backend.grounding as grounding_module
from backend.grounding import CURRICULUM_DIR, save_lesson_blocks, load_lesson_data
from backend.grounding_verifier import verify_text_in_source, verify_quiz_item_grounding

client = TestClient(app)

REAL_CURRICULUM_DIR = Path(__file__).resolve().parent.parent / "data" / "curriculum"
REAL_BAI1_FILE = REAL_CURRICULUM_DIR / "tin6" / "bai1.blocks.json"
# Mốc SHA-256 cố định của bai1.blocks.json đã xác minh (V3 & D7 & V3-Sonnet):
# Tính ngày 2026-10-14 bằng lệnh: Get-FileHash data/curriculum/tin6/bai1.blocks.json -Algorithm SHA256
# Cập nhật mốc này sau khi giáo viên chính thức biên soạn và duyệt lại nội dung trên Teacher Studio.
EXPECTED_REAL_BAI1_SHA256 = "783bd8e637442af34465119503a53a318340f9ba1852e054c7ec4caa46db30ae"


@pytest.fixture(autouse=True)
def setup_isolated_curriculum(tmp_path, monkeypatch):
    """
    Cô lập hoàn toàn môi trường kiểm thử (Item 13 & 102 & C1):
    Mọi thao tác đọc/ghi file bài học trong test đều diễn ra trên tmp_path.
    Tuyệt đối không bao giờ ghi đè hay để lại file rác trong data/curriculum/.
    """
    test_curriculum = tmp_path / "curriculum"
    test_curriculum_tin6 = test_curriculum / "tin6"
    test_curriculum_tin6.mkdir(parents=True, exist_ok=True)

    # Nạp bản sao của bài 1 vào tmp_path và thiết lập published cho bài học trong sandbox
    real_bai1 = REAL_CURRICULUM_DIR / "tin6" / "bai1.blocks.json"
    if real_bai1.exists():
        with open(real_bai1, "r", encoding="utf-8") as f:
            b1 = json.load(f)
        b1["status"] = "published"
        for q in b1.get("quiz", []):
            q["source"] = "teacher_verified"
            q["verified_by"] = "teacher"
            q["verified_at"] = "2026-10-14T00:00:00Z"
        with open(test_curriculum_tin6 / "bai1.blocks.json", "w", encoding="utf-8") as f:
            json.dump(b1, f, ensure_ascii=False, indent=2)

    monkeypatch.setattr(grounding_module, "CURRICULUM_DIR", test_curriculum)
    import backend.server as server_module
    monkeypatch.setattr(server_module, "CURRICULUM_DIR", test_curriculum)
    yield test_curriculum


def get_authenticated_teacher_token() -> str:
    """Helper cấp session token giáo viên hợp lệ."""
    FAILED_LOGIN_ATTEMPTS.clear()
    res = client.post("/api/teacher/auth", json={"pin": TEACHER_PIN})
    assert res.status_code == 200
    return res.json()["token"]


def test_student_api_strips_quiz_answers_and_exposes_blocks():
    """1. Học sinh truy cập API bài học chỉ nhận safe quiz và danh sách blocks."""
    res = client.get("/api/lesson/6/1")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "blocks" in data
    assert len(data["blocks"]) > 0
    assert len(data["quiz"]) > 0

    # Tuyệt đối không lộ 'dap_an_dung' và 'giai_thich_su_pham'
    for q in data["quiz"]:
        assert "dap_an_dung" not in q
        assert "giai_thich_su_pham" not in q
        assert "id" in q
        assert "cau_hoi" in q
        assert "lua_chon" in q


def test_teacher_api_rejects_raw_pin_and_requires_bearer_token():
    """2. Từ chối header X-Teacher-PIN thô (P0-1 & P0-6); bắt buộc session token hợp lệ."""
    # 1. Gọi với PIN thô trong header -> Phải bị từ chối 401
    res_raw_pin = client.get("/api/teacher/lesson/6/1", headers={"X-Teacher-PIN": TEACHER_PIN})
    assert res_raw_pin.status_code == 401

    # 2. Gọi không có auth -> 401
    res_no_auth = client.get("/api/teacher/lesson/6/1")
    assert res_no_auth.status_code == 401

    # 3. Gọi với Bearer Token hợp lệ -> 200 OK
    token = get_authenticated_teacher_token()
    res_ok = client.get(
        "/api/teacher/lesson/6/1",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_ok.status_code == 200
    teacher_data = res_ok.json()["data"]
    assert "quiz" in teacher_data
    assert "dap_an_dung" in teacher_data["quiz"][0]
    assert "giai_thich_su_pham" in teacher_data["quiz"][0]


def test_teacher_auth_brute_force_rate_limiting():
    """3. Kiểm tra chống Brute-Force: 5 lần sai trả 401, lần thứ 6 trả 429 Too Many Requests (P1-9)."""
    FAILED_LOGIN_ATTEMPTS.clear()

    # 5 lần thử sai mã PIN liên tiếp
    for _ in range(5):
        res = client.post("/api/teacher/auth", json={"pin": "wrong_pin_xyz"})
        assert res.status_code == 401

    # Lần thứ 6 -> Bị chặn 429
    res_blocked = client.post("/api/teacher/auth", json={"pin": "wrong_pin_xyz"})
    assert res_blocked.status_code == 429
    assert "Quá nhiều lần thử sai" in res_blocked.json()["detail"]

    FAILED_LOGIN_ATTEMPTS.clear()


def test_draft_lesson_gating_across_all_student_endpoints():
    """4. Bài học ở trạng thái 'draft' thì học sinh bị 403 trên cả 3 route: /api/lesson, /api/chat, /api/grade-quiz (Lỗ hổng B)."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 88

    draft_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài test Draft Gating Toàn diện",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Test", "description": "Draft Lesson", "badge": "DRAFT"}],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi nháp bí mật?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích nháp bí mật",
            "goi_y_khi_sai": "Gợi ý khi học sinh chọn sai",
            "source": "generated",
            "grounding_verified": False
        }]
    }

    save_lesson_blocks(6, test_lesson_id, draft_payload)

    # 1. Học sinh gọi GET /api/lesson -> Phải bị 403
    res_lesson = client.get(f"/api/lesson/6/{test_lesson_id}")
    assert res_lesson.status_code == 403

    # 2. Học sinh gọi POST /api/chat trên bài draft -> Phải bị 403 (Lỗ hổng B)
    res_chat = client.post("/api/chat", json={
        "grade": 6,
        "lesson_id": test_lesson_id,
        "message": "Cho em hỏi bài nháp này với",
        "history": []
    })
    assert res_chat.status_code == 403

    # 3. Học sinh gọi POST /api/grade-quiz trên bài draft -> Phải bị 403 (Lỗ hổng B)
    res_grade = client.post("/api/grade-quiz", json={
        "grade": 6,
        "lesson_id": test_lesson_id,
        "answers": {f"tin6_b{test_lesson_id}_q1": "A"}
    })
    assert res_grade.status_code == 403

    # 4. Giáo viên gọi GET /api/teacher/lesson với Token -> Được phép đọc 200 OK
    res_teacher = client.get(
        f"/api/teacher/lesson/6/{test_lesson_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_teacher.status_code == 200
    assert res_teacher.json()["data"]["status"] == "draft"


def test_save_lesson_preserves_draft_status_no_auto_publish():
    """5. Lưu bài nháp qua save-lesson BẮT BUỘC bảo toàn status 'draft', CẤM tự ý xuất bản (Lỗ hổng A)."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 89

    initial_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài kiểm tra lưu nháp",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Test", "description": "Lưu nháp"}],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi test lưu?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "B",
            "giai_thich_su_pham": "Giải thích test",
            "goi_y_khi_sai": "Gợi ý test",
            "source": "generated",
            "grounding_verified": False
        }]
    }

    save_lesson_blocks(6, test_lesson_id, initial_payload)

    edit_payload = dict(initial_payload)
    edit_payload["title"] = "Bài kiểm tra lưu nháp (Đã sửa)"
    edit_payload["status"] = "published"  # Thử gửi published lén từ client

    save_res = client.post(
        "/api/teacher/save-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json=edit_payload
    )
    assert save_res.status_code == 200

    saved_data = load_lesson_data(6, test_lesson_id)
    assert saved_data["status"] == "draft", "Lỗ hổng A: save-lesson đã tự ý đổi status sang published!"
    assert client.get(f"/api/lesson/6/{test_lesson_id}").status_code == 403


def test_publish_requires_all_quiz_teacher_verified():
    """6. Xuất bản bài học BẮT BUỘC 100% câu hỏi trắc nghiệm phải có source=='teacher_verified' (Lỗ hổng C & P0-C)."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 90

    lesson_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài kiểm tra điều kiện xuất bản",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Test", "description": "Điều kiện xuất bản"}],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi chưa duyệt?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "C",
            "giai_thich_su_pham": "Giải thích câu hỏi",
            "goi_y_khi_sai": "Gợi ý câu hỏi",
            "source": "generated",  # Chưa duyệt
            "grounding_verified": False
        }]
    }

    save_lesson_blocks(6, test_lesson_id, lesson_payload)

    # 1. Thử xuất bản khi câu hỏi vẫn mang source='generated' -> Phải bị từ chối 422
    pub_fail = client.post(
        "/api/teacher/publish-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json={"grade": 6, "lesson_id": test_lesson_id}
    )
    assert pub_fail.status_code == 422
    assert "chưa được Giáo viên duyệt" in pub_fail.json()["detail"]

    # 2. Giáo viên duyệt câu hỏi qua API /api/teacher/verify-quiz-item
    verify_res = client.post(
        "/api/teacher/verify-quiz-item",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "grade": 6,
            "lesson_id": test_lesson_id,
            "quiz_id": f"tin6_b{test_lesson_id}_q1",
            "action": "verify"
        }
    )
    assert verify_res.status_code == 200

    data_after_verify = load_lesson_data(6, test_lesson_id)
    assert data_after_verify["quiz"][0]["source"] == "teacher_verified"
    assert data_after_verify["quiz"][0]["verified_by"] == "teacher"

    # 3. Xuất bản lại -> Thành công 200 OK!
    pub_ok = client.post(
        "/api/teacher/publish-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json={"grade": 6, "lesson_id": test_lesson_id}
    )
    assert pub_ok.status_code == 200

    # Học sinh bây giờ có thể truy cập bài học (200 OK)
    student_res = client.get(f"/api/lesson/6/{test_lesson_id}")
    assert student_res.status_code == 200
    assert student_res.json()["status"] == "published"


def test_atomic_backup_file_creation_isolated():
    """7. Kiểm tra sao lưu nguyên tử .bak khi cập nhật trên bài học độc lập (P0-6 & P1-13)."""
    test_lesson_id = 91
    payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài test Backup",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Bản 1", "description": "Mô tả 1"}],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi test?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích test",
            "goi_y_khi_sai": "Gợi ý test",
            "source": "generated",
            "grounding_verified": False
        }]
    }

    # Lần 1: Lưu lần đầu -> Chưa có file cũ nên backup_created = False
    res1 = save_lesson_blocks(6, test_lesson_id, payload)
    assert res1["success"] is True
    assert res1["backup_created"] is False

    # Lần 2: Sửa và lưu đè -> Phải tạo ra file .bak thực sự!
    payload["title"] = "Bài test Backup (Bản 2)"
    res2 = save_lesson_blocks(6, test_lesson_id, payload)
    assert res2["success"] is True
    assert res2["backup_created"] is True


def test_refusal_of_missing_quiz_answer_no_silent_default():
    """8. Từ chối câu hỏi thiếu đáp án, cấm gán ngầm 'A' (P0-7)."""
    bad_payload = {
        "grade": 6,
        "lesson_id": 92,
        "title": "Test Missing Answer",
        "blocks": [],
        "quiz": [{
            "id": "tin6_b92_q1",
            "cau_hoi": "Câu hỏi không có đáp án?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": ""  # Thiếu đáp án
        }]
    }
    with pytest.raises(ValueError, match="chưa được chọn đáp án đúng"):
        save_lesson_blocks(6, 92, bad_payload)


def test_deterministic_grounding_verifier_module():
    """9. Kiểm tra động cơ kiểm chứng nguồn xác định PyMuPDF (Deterministic Grounding P0-3/P0-8)."""
    sample_page_text = """
    BÀI 1: THÔNG TIN VÀ DỮ LIỆU
    1. Thông tin và dữ liệu
    Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại.
    Ánh sáng màu đỏ là dữ liệu thu nhận qua thị giác.
    Sự hiểu biết phải dừng xe lại là thông tin.
    Vật mang tin là vật thể chứa dữ liệu như sách báo, thẻ nhớ, biển báo.
    Dựa vào thông tin thu nhận được, người tham gia giao thông đưa ra quyết định dừng xe lại trước vạch dừng.
    """

    grounded_item = {
        "id": "test_q1",
        "cau_hoi": "Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại. Trong tình huống này, ánh sáng đèn màu đỏ là gì?",
        "lua_chon": {"A": "Vật mang tin", "B": "Dữ liệu", "C": "Thông tin", "D": "Quyết định"},
        "dap_an_dung": "B",
        "trang_sgk": 6,
        "giai_thich_su_pham": "Giải thích",
        "goi_y_khi_sai": "Gợi ý"
    }
    res_grounded = verify_quiz_item_grounding(grounded_item, {6: sample_page_text})
    assert res_grounded["grounding_verified"] is True

    hallucinated_item = {
        "id": "test_q_fake",
        "cau_hoi": "Theo thuyết lượng tử ánh sáng của Albert Einstein năm 1905, photon có khối lượng nghỉ bằng bao nhiêu?",
        "lua_chon": {"A": "0", "B": "1", "C": "2", "D": "3"},
        "dap_an_dung": "A",
        "trang_sgk": 6,
        "giai_thich_su_pham": "Giải thích",
        "goi_y_khi_sai": "Gợi ý"
    }
    res_fake = verify_quiz_item_grounding(hallucinated_item, {6: sample_page_text})
    assert res_fake["grounding_verified"] is False


def test_published_lesson_saving_unverified_quiz_demotes_to_draft():
    """10 (N1). Lưu bài đã xuất bản kèm câu hỏi chưa duyệt BẮT BUỘC tự động hạ status về 'draft'."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 93

    # Khởi tạo bài học đã xuất bản thành công với 1 câu đã duyệt
    initial_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài đã xuất bản chuẩn",
        "status": "published",
        "blocks": [{"type": "hero", "title": "Bản Published", "description": "Mô tả bài published"}],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi đã duyệt chuẩn?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích chuẩn",
            "goi_y_khi_sai": "Gợi ý chuẩn",
            "source": "teacher_verified",
            "grounding_verified": False,
            "verified_by": "teacher"
        }]
    }
    save_lesson_blocks(6, test_lesson_id, initial_payload, allow_publish=True)
    assert load_lesson_data(6, test_lesson_id)["status"] == "published"
    assert client.get(f"/api/lesson/6/{test_lesson_id}").status_code == 200

    # Giáo viên thêm câu hỏi mới (chưa duyệt) và bấm lưu thay đổi
    updated_payload = dict(initial_payload)
    updated_payload["quiz"] = list(initial_payload["quiz"]) + [{
        "id": f"tin6_b{test_lesson_id}_q2",
        "cau_hoi": "Câu hỏi mới toanh chưa được duyệt?",
        "lua_chon": {"A": "Đúng", "B": "Sai", "C": "Có thể", "D": "Không rõ"},
        "dap_an_dung": "A",
        "giai_thich_su_pham": "Giải thích sơ sài",
        "goi_y_khi_sai": "Gợi ý sơ sài",
        "source": "generated",
        "grounding_verified": False
    }]

    save_res = client.post(
        "/api/teacher/save-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json=updated_payload
    )
    assert save_res.status_code == 200

    # Khóa cứng N1: Status BẮT BUỘC bị hạ xuống 'draft'!
    saved_data = load_lesson_data(6, test_lesson_id)
    assert saved_data["status"] == "draft", "N1 Vi phạm: Bài có câu chưa duyệt vẫn giữ status published!"

    # Học sinh lập tức bị chặn 403 Forbidden
    res_student = client.get(f"/api/lesson/6/{test_lesson_id}")
    assert res_student.status_code == 403


def test_save_lesson_cannot_inject_teacher_verified_source():
    """11 (N2). Client không thể tự khai source='teacher_verified' trong save-lesson để vượt gate xuất bản."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 94

    malicious_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài thử hack verify",
        "status": "draft",
        "blocks": [],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi cố tình gửi source teacher_verified?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích",
            "goi_y_khi_sai": "Gợi ý",
            "source": "teacher_verified",  # Khai khống từ client
            "grounding_verified": True
        }]
    }

    save_res = client.post(
        "/api/teacher/save-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json=malicious_payload
    )
    assert save_res.status_code == 200

    # Server phải ép về 'generated' và grounding_verified=False
    saved_data = load_lesson_data(6, test_lesson_id)
    assert saved_data["quiz"][0]["source"] == "generated", "N2 Vi phạm: Server cho phép client tự khai source teacher_verified!"
    assert saved_data["quiz"][0]["grounding_verified"] is False

    # Thử xuất bản ngay sau đó -> Phải bị từ chối 422!
    pub_res = client.post(
        "/api/teacher/publish-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json={"grade": 6, "lesson_id": test_lesson_id}
    )
    assert pub_res.status_code == 422


def test_modifying_verified_quiz_content_resets_verification_status():
    """12 (N3). Thay đổi nội dung câu hỏi (cau_hoi, lua_chon, dap_an_dung) lập tức hủy duyệt (ép về generated)."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 95

    # 1. Tạo bài với câu hỏi đã duyệt
    initial_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài kiểm tra trôi duyệt",
        "status": "draft",
        "blocks": [],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Đề bài gốc đã được duyệt?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích",
            "goi_y_khi_sai": "Gợi ý",
            "source": "teacher_verified",
            "grounding_verified": True,
            "verified_by": "teacher",
            "verified_at": "2026-10-14T10:00:00"
        }]
    }
    save_lesson_blocks(6, test_lesson_id, initial_payload)

    # 2. Sửa đáp án đúng từ 'A' sang 'B' và lưu qua save-lesson
    tampered_payload = dict(initial_payload)
    tampered_payload["quiz"] = [{
        "id": f"tin6_b{test_lesson_id}_q1",
        "cau_hoi": "Đề bài gốc đã được duyệt?",
        "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
        "dap_an_dung": "B",  # Thay đổi đáp án!
        "giai_thich_su_pham": "Giải thích",
        "goi_y_khi_sai": "Gợi ý"
    }]

    save_res = client.post(
        "/api/teacher/save-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json=tampered_payload
    )
    assert save_res.status_code == 200

    # Server phải hủy bỏ teacher_verified và grounding_verified vì nội dung đã bị trôi!
    saved_data = load_lesson_data(6, test_lesson_id)
    item = saved_data["quiz"][0]
    assert item["source"] == "generated", "N3 Vi phạm: Sửa đáp án câu đã duyệt nhưng source không bị reset!"
    assert item["grounding_verified"] is False
    assert item["verified_by"] is None
    assert item["verified_at"] is None


def test_teacher_auth_non_ascii_pin_returns_401_and_increments_rate_limit():
    """13 (N5). Nhập mã PIN có ký tự non-ASCII trả về 401 an toàn, ghi nhận rate limit, không gây 500 TypeError."""
    FAILED_LOGIN_ATTEMPTS.clear()

    # Gửi chuỗi non-ASCII có dấu tiếng Việt
    res = client.post("/api/teacher/auth", json={"pin": "PIN-non-ascii-àéïõ123"})
    assert res.status_code == 401
    assert "không chính xác" in res.json()["detail"]

    # Đảm bảo lần thử này được tính vào bộ đếm rate limit
    ip = "testclient"
    attempts = FAILED_LOGIN_ATTEMPTS.get(ip, [])
    assert len(attempts) >= 1, "N5 Vi phạm: Lần thử PIN non-ASCII không được ghi nhận vào FAILED_LOGIN_ATTEMPTS!"

    FAILED_LOGIN_ATTEMPTS.clear()


def test_verify_quiz_item_grounding_rewritten_hallucination():
    """14 (Item 81 & 133). Kiểm chứng câu hỏi mượn từ vựng SGK nhưng mang nội dung bịa đặt / sai sự thật."""
    sample_text = """
    BÀI 1: THÔNG TIN VÀ DỮ LIỆU
    Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại.
    Ánh sáng màu đỏ là dữ liệu. Sự hiểu biết phải dừng xe lại là thông tin.
    """

    # Câu hỏi chứa từ khóa "thông tin", "dữ liệu" nhưng bịa đặt phương án sai lệch hoàn toàn
    rewritten_fake_item = {
        "id": "q_rewritten",
        "cau_hoi": "Theo bài học về thông tin và dữ liệu, phi hành gia bay lên trăng tròn bằng phương tiện gì?",
        "lua_chon": {
            "A": "Tên lửa Saturn",
            "B": "Khinh khí cầu",
            "C": "Thảm bay aladdin",
            "D": "Máy bay trực thăng"
        },
        "dap_an_dung": "A",
        "trang_sgk": 6,
        "giai_thich_su_pham": "Giải thích",
        "goi_y_khi_sai": "Gợi ý"
    }

    res = verify_quiz_item_grounding(rewritten_fake_item, {6: sample_text})
    assert res["grounding_verified"] is False, "Grounding Verifier không phát hiện được câu hỏi mượn từ vựng nhưng lạc đề!"


def test_verify_quiz_item_grounding_rejects_plausible_wrong_options():
    """14b (A4/Q2a). Câu hỏi đúng đề bài SGK nhưng các phương án sai/không có trong trang: phải bị từ chối."""
    sample_text = """
    BÀI 1: THÔNG TIN VÀ DỮ LIỆU
    Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại.
    Ánh sáng màu đỏ là dữ liệu thu nhận qua thị giác.
    Sự hiểu biết phải dừng xe lại là thông tin.
    """
    item = {
        "id": "q_plausible",
        "cau_hoi": "Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại. Ánh sáng màu đỏ là gì?",
        "lua_chon": {
            "A": "Vật mang tin",
            "B": "Dữ liệu",
            "C": "Phần mềm điều khiển đèn",
            "D": "Hệ thống camera giám sát"
        },
        "dap_an_dung": "B",
        "trang_sgk": 6,
        "giai_thich_su_pham": "Giải thích",
        "goi_y_khi_sai": "Gợi ý"
    }
    res = verify_quiz_item_grounding(item, {6: sample_text})
    assert res["grounding_verified"] is False, "A4: Grounding Verifier phải từ chối khi phương án không khớp 100% văn bản SGK!"


def test_teacher_verify_and_unverify_quiz_item_actions():
    """15 (N2 Audit). Endpoint verify-quiz-item hỗ trợ cả verify và unverify kèm audit log đầy đủ."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 96

    payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài test Verify Actions",
        "status": "draft",
        "blocks": [],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi test duyệt và hủy duyệt?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích",
            "goi_y_khi_sai": "Gợi ý",
            "source": "generated",
            "grounding_verified": False
        }]
    }
    save_lesson_blocks(6, test_lesson_id, payload)

    # 1. Duyệt (verify)
    res_v = client.post(
        "/api/teacher/verify-quiz-item",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "grade": 6,
            "lesson_id": test_lesson_id,
            "quiz_id": f"tin6_b{test_lesson_id}_q1",
            "action": "verify"
        }
    )
    assert res_v.status_code == 200
    assert res_v.json()["source"] == "teacher_verified"
    data_v = load_lesson_data(6, test_lesson_id)
    assert data_v["quiz"][0]["source"] == "teacher_verified"
    assert data_v["quiz"][0]["verified_by"] == "teacher"
    assert data_v["quiz"][0]["verified_at"] is not None

    # 2. Hủy duyệt (unverify)
    res_u = client.post(
        "/api/teacher/verify-quiz-item",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "grade": 6,
            "lesson_id": test_lesson_id,
            "quiz_id": f"tin6_b{test_lesson_id}_q1",
            "action": "unverify"
        }
    )
    assert res_u.status_code == 200
    assert res_u.json()["source"] == "generated"
    data_u = load_lesson_data(6, test_lesson_id)
    assert data_u["quiz"][0]["source"] == "generated"
    assert data_u["quiz"][0]["verified_by"] is None
    assert data_u["quiz"][0]["verified_at"] is None


def test_verified_quiz_item_invalid_verified_by_rejected(tmp_path):
    """17 (B1 Invariant). Dữ liệu cũ trên đĩa có source=teacher_verified nhưng verified_by không hợp lệ phải bị từ chối."""
    test_lesson_id = 97
    payload_bad = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài test B1",
        "status": "draft",
        "blocks": [],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi có dấu duyệt giả mạo?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích",
            "goi_y_khi_sai": "Gợi ý",
            "source": "teacher_verified",
            "grounding_verified": False,
            "verified_by": "hacker",  # Không phải 'teacher'
            "verified_at": "2026-10-14T00:00:00Z"
        }]
    }
    # Ghi trực tiếp tệp giả mạo vào thư mục bài học trong sandbox
    tampered_file = tmp_path / "curriculum" / "tin6" / f"bai{test_lesson_id}.blocks.json"
    with open(tampered_file, "w", encoding="utf-8") as f:
        json.dump(payload_bad, f, ensure_ascii=False)

    # Khi lưu đè qua save_lesson_blocks, server phát hiện old_item có verified_by không hợp lệ -> ném ValueError!
    with pytest.raises(ValueError, match="dấu duyệt không hợp lệ"):
        save_lesson_blocks(6, test_lesson_id, payload_bad)


def test_verify_quiz_item_writes_isolated_audit_log(tmp_path):
    """18 (B3 Invariant). Mỗi thao tác verify/unverify phải ghi một dòng audit log riêng biệt."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 98

    payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài test B3 Audit",
        "status": "draft",
        "blocks": [],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Câu hỏi test audit log?",
            "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Giải thích",
            "goi_y_khi_sai": "Gợi ý",
            "source": "generated",
            "grounding_verified": False
        }]
    }
    save_lesson_blocks(6, test_lesson_id, payload)

    # Gọi verify API
    res = client.post(
        "/api/teacher/verify-quiz-item",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "grade": 6,
            "lesson_id": test_lesson_id,
            "quiz_id": f"tin6_b{test_lesson_id}_q1",
            "action": "verify"
        }
    )
    assert res.status_code == 200

    # Kiểm tra file audit_log.jsonl được tạo trong tmp_path
    audit_file = tmp_path / "curriculum" / "tin6" / "audit_log.jsonl"
    assert audit_file.exists(), "B3 Vi phạm: Không tìm thấy tệp audit_log.jsonl!"

    with open(audit_file, "r", encoding="utf-8") as af:
        lines = [json.loads(line) for line in af if line.strip()]

    assert len(lines) >= 1
    last_log = lines[-1]
    assert last_log["quiz_id"] == f"tin6_b{test_lesson_id}_q1"
    assert last_log["action"] == "verify"
    assert last_log["verified_by"] == "teacher"
    assert "token" not in last_log
    assert "pin" not in last_log


def test_real_curriculum_bai1_hash_unmodified_after_suite():
    """16 (A1, A2, D7). Hash SHA-256 của dữ liệu thật phải khớp mốc cố định đã ghi trong test."""
    assert REAL_BAI1_FILE.exists(), "Tệp bài học chính thức không tồn tại!"
    current_hash = hashlib.sha256(REAL_BAI1_FILE.read_bytes()).hexdigest()
    assert current_hash == EXPECTED_REAL_BAI1_SHA256, (
        f"Dữ liệu thật bai1.blocks.json đã thay đổi (hash hiện tại: {current_hash} != {EXPECTED_REAL_BAI1_SHA256}). "
        "Nếu cố ý sửa, cập nhật EXPECTED_REAL_BAI1_SHA256 sau khi giáo viên duyệt."
    )

    with open(REAL_BAI1_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    data = json.loads(content)
    assert data["grade"] == 6
    assert data["lesson_id"] == 1
    assert data["status"] in ("draft", "published"), "A1: Bài 1 dữ liệu thật phải mang status 'draft' hoặc 'published'!"
    for q in data["quiz"]:
        assert q["source"] in ("generated", "teacher_verified"), f"Câu hỏi {q['id']} có source không hợp lệ!"


def test_teacher_save_lesson_rejects_leaky_socratic_hint_with_422():
    """Sonnet Condition 2: Payload qua API /api/teacher/save-lesson với gợi ý lộ đáp án BẮT BUỘC bị 422."""
    token = get_authenticated_teacher_token()
    test_lesson_id = 93

    leaky_payload = {
        "grade": 6,
        "lesson_id": test_lesson_id,
        "title": "Bài test Socratic Leak qua API",
        "status": "draft",
        "blocks": [{"type": "hero", "title": "Test", "description": "Desc"}],
        "quiz": [{
            "id": f"tin6_b{test_lesson_id}_q1",
            "cau_hoi": "Hoạt động nào sau đây thuộc bước thu nhận?",
            "lua_chon": {"A": "Nghe giảng bài", "B": "Nghĩ bài toán", "C": "Viết", "D": "Gửi"},
            "dap_an_dung": "A",
            "giai_thich_su_pham": "Chính xác!",
            "goi_y_khi_sai": "Em hãy chọn đáp án A nhé!",  # Gợi ý lộ đáp án
            "forbidden_keywords": ["nghe giảng"]
        }]
    }

    res = client.post(
        "/api/teacher/save-lesson",
        headers={"Authorization": f"Bearer {token}"},
        json=leaky_payload
    )
    assert res.status_code == 422
    assert "tiết lộ đáp án trực tiếp" in res.json()["detail"]


def test_get_curriculum_lessons_dynamic_endpoint(tmp_path):
    """Kiểm tra API /api/curriculum/lessons/{grade} quét đúng danh mục bài học động."""
    res = client.get("/api/curriculum/lessons/6")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["grade"] == 6
    lesson_ids = [l["lesson_id"] for l in data["lessons"]]
    assert 1 in lesson_ids

    # Tạo thêm bài 2 nháp trong tmp_path cô lập
    grade_dir = tmp_path / "curriculum" / "tin6"
    bai2_file = grade_dir / "bai2.blocks.json"
    bai2_file.write_text(json.dumps({
        "schema_version": "2.0",
        "grade": 6,
        "lesson_id": 2,
        "title": "Xử lí thông tin",
        "status": "draft",
        "blocks": [],
        "quiz": []
    }, ensure_ascii=False), encoding="utf-8")

    res2 = client.get("/api/curriculum/lessons/6")
    assert res2.status_code == 200
    data2 = res2.json()
    lesson_ids2 = [l["lesson_id"] for l in data2["lessons"]]
    assert 1 in lesson_ids2
    assert 2 in lesson_ids2
    bai2 = next(l for l in data2["lessons"] if l["lesson_id"] == 2)
    assert bai2["status"] == "draft"

