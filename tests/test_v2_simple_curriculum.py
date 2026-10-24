"""
Kiểm thử Unit & Integration: Kho Học liệu Tinh giản V2 & Gia sư Socrates
Tuân thủ Luật Proof-Driven & Zero-Guesswork:
1. Danh mục bài học V2 trả về đúng danh sách bài trong data/curriculum_v2_simple/tin6.
2. Học sinh lấy bài học V2 chỉ thấy câu hỏi trắc nghiệm an toàn (đã giấu dap_an_dung).
3. Chấm điểm trắc nghiệm V2 với header x-curriculum-version: v2 hoạt động chính xác.
4. Gia sư Socrates AI trả lời bám sát nội dung bài học V2 và không rò rỉ đáp án.
"""
import pytest
from fastapi.testclient import TestClient
from backend.server import app
from backend.grounding import load_lesson_v2_simple, list_available_lessons_v2

client = TestClient(app)


def test_list_available_lessons_v2():
    lessons = list_available_lessons_v2(6)
    assert len(lessons) >= 2
    l_ids = [l["lesson_id"] for l in lessons]
    assert 1 in l_ids
    assert 2 in l_ids


def test_api_v2_curriculum_lessons():
    res = client.get("/api/v2/curriculum/lessons/6")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["grade"] == 6
    assert data["total"] >= 2
    titles = [l["title"] for l in data["lessons"]]
    assert "Thông tin và dữ liệu" in titles
    assert "Xử lí thông tin" in titles


def test_api_v2_get_lesson_1():
    res = client.get("/api/v2/lesson/6/1")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["title"] == "Thông tin và dữ liệu"
    assert data["status"] == "published"
    assert len(data["quiz"]) == 4
    # Học sinh không thấy đáp án đúng
    for q in data["quiz"]:
        assert "dap_an_dung" not in q
        assert "giai_thich_su_pham" not in q
        assert "cau_hoi" in q
        assert len(q["lua_chon"]) == 4


def test_api_v2_get_lesson_2():
    res = client.get("/api/v2/lesson/6/2")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["title"] == "Xử lí thông tin"
    assert data["status"] == "published"
    assert len(data["quiz"]) == 4
    assert "Nhận → Nhớ → Nghĩ → Nói" in data["content_markdown"]


def test_api_v2_grade_quiz():
    # Bài 1: q1 đáp án là B
    res = client.post(
        "/api/grade-quiz",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 6,
            "lesson_id": 1,
            "answers": {"tin6_b1_q1": "B", "tin6_b1_q2": "A"}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    eval_data = data["evaluation"]
    details = eval_data.get("details") or eval_data.get("results")
    assert details is not None
    d_map = {item["id"]: item for item in details}
    assert d_map["tin6_b1_q1"]["is_correct"] is True
    assert d_map["tin6_b1_q2"]["is_correct"] is False


def test_api_v2_chat_with_socrates():
    res = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 6,
            "lesson_id": 1,
            "message": "Dữ liệu và thông tin khác nhau thế nào ạ?",
            "history": []
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "reply" in data
    assert len(data["reply"]) > 20

