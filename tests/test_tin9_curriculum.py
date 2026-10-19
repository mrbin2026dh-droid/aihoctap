"""
Kiểm thử Unit & Integration: Chương trình Tin học 9 (Bài 1 đến Bài 5)
Tuân thủ Luật Proof-Driven & Zero-Guesswork:
1. Danh mục bài học V2 của Lớp 9 trả về đầy đủ các bài học với Chủ đề SGK chuẩn.
2. Bài 1 đến Bài 5 đạt trạng thái published, nội dung ngắn gọn, chính xác, dễ hiểu.
3. API /api/v2/lesson/9/{id} ẩn toàn bộ đáp án đúng và lời giải thích trước khi gửi cho học sinh.
4. Chấm điểm trắc nghiệm /api/grade-quiz hoạt động chính xác 100% cho cả 5 bài.
5. Gia sư Socrates AI phản hồi sư phạm chuẩn mực, phân tích 3 tầng gợi ý, tuyệt đối không lộ đáp án.
"""
import pytest
from fastapi.testclient import TestClient
from backend.server import app
from backend.grounding import load_lesson_v2_simple, list_available_lessons_v2, load_lesson_data
from backend.agent import chat_with_tutor, socratic_fallback_reply

client = TestClient(app)


def test_tin9_curriculum_list():
    """Kiểm tra danh mục bài học Tin học 9."""
    lessons = list_available_lessons_v2(9)
    assert len(lessons) >= 10, f"Mong muốn ít nhất 10 bài học, thực tế có {len(lessons)}"
    
    # Kiểm tra 10 bài đầu tiên đều đã xuất bản (published)
    published_lessons = {l["lesson_id"]: l for l in lessons if l["status"] == "published"}
    for lid in range(1, 11):
        assert lid in published_lessons, f"Bài {lid} chưa được xuất bản trong danh mục V2"
        assert published_lessons[lid]["quiz_count"] == 4
        assert published_lessons[lid]["ready"] is True


def test_tin9_api_curriculum_endpoint():
    """Kiểm tra endpoint API danh mục bài học Lớp 9."""
    res = client.get("/api/v2/curriculum/lessons/9")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["grade"] == 9
    assert data["total"] >= 10
    
    titles = [l["title"] for l in data["lessons"]]
    assert "Thế giới kĩ thuật số" in titles
    assert "Thông tin trong giải quyết vấn đề" in titles
    assert "Thực hành: Đánh giá chất lượng thông tin" in titles
    assert "Một số vấn đề pháp lí về sử dụng dịch vụ Internet" in titles
    assert "Tìm hiểu phần mềm mô phỏng" in titles
    assert "Thực hành: Khai thác phần mềm mô phỏng" in titles
    assert "Trình bày thông tin trong trao đổi và hợp tác" in titles
    assert "Thực hành: Sử dụng công cụ trực quan trình bày thông tin" in titles
    assert "Sử dụng công cụ xác thực dữ liệu và hàm điều kiện" in titles
    assert "Thực hành: Xử lý dữ liệu bảng tính nâng cao" in titles


@pytest.mark.parametrize("lesson_id, expected_title, expected_keyword", [
    (1, "Thế giới kĩ thuật số", "Bộ xử lí thông tin (CPU)"),
    (2, "Thông tin trong giải quyết vấn đề", "MỚI - ĐÚNG - ĐỦ - DÙNG ĐƯỢC"),
    (3, "Thực hành: Đánh giá chất lượng thông tin", "Quy trình 3 bước thực hành chuẩn"),
    (4, "Một số vấn đề pháp lí về sử dụng dịch vụ Internet", "Rác thải điện tử"),
    (5, "Tìm hiểu phần mềm mô phỏng", "PhET Interactive Simulations"),
    (6, "Thực hành: Khai thác phần mềm mô phỏng", "Quy trình 4 bước chuẩn mực"),
    (7, "Trình bày thông tin trong trao đổi và hợp tác", "Sơ đồ tư duy (Mindmap)"),
    (8, "Thực hành: Sử dụng công cụ trực quan trình bày thông tin", "Quy tắc bố cục bài trình chiếu 5 trang"),
    (9, "Sử dụng công cụ xác thực dữ liệu và hàm điều kiện", "Data Validation"),
    (10, "Thực hành: Xử lý dữ liệu bảng tính nâng cao", "COUNTIF"),
])
def test_tin9_lesson_content_and_safe_quiz(lesson_id, expected_title, expected_keyword):
    """Kiểm tra nội dung lý thuyết và tính bảo mật của bộ câu hỏi trắc nghiệm từng bài."""
    res = client.get(f"/api/v2/lesson/9/{lesson_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["grade"] == 9
    assert data["lesson_id"] == lesson_id
    assert data["title"] == expected_title
    assert data["status"] == "published"
    assert expected_keyword in data["content_markdown"]
    
    # Kiểm tra an toàn: Tuyệt đối không để lộ đáp án đúng và giải thích
    assert len(data["quiz"]) == 4
    for q in data["quiz"]:
        assert "dap_an_dung" not in q, f"Lộ đáp án đúng ở câu {q.get('id')}"
        assert "giai_thich_su_pham" not in q, f"Lộ giải thích sư phạm ở câu {q.get('id')}"
        assert "cau_hoi" in q and len(q["cau_hoi"]) > 10
        assert "lua_chon" in q and len(q["lua_chon"]) == 4
        for opt in ["A", "B", "C", "D"]:
            assert opt in q["lua_chon"]


def test_tin9_grade_quiz_all_correct():
    """Kiểm tra chấm điểm trắc nghiệm bài 1 đến bài 10 đạt 10/10 khi chọn đúng."""
    key_map = {
        1: {"tin9_b1_q1": "A", "tin9_b1_q2": "B", "tin9_b1_q3": "A", "tin9_b1_q4": "C"},
        2: {"tin9_b2_q1": "A", "tin9_b2_q2": "A", "tin9_b2_q3": "A", "tin9_b2_q4": "A"},
        3: {"tin9_b3_q1": "B", "tin9_b3_q2": "A", "tin9_b3_q3": "B", "tin9_b3_q4": "A"},
        4: {"tin9_b4_q1": "B", "tin9_b4_q2": "B", "tin9_b4_q3": "A", "tin9_b4_q4": "A"},
        5: {"tin9_b5_q1": "A", "tin9_b5_q2": "A", "tin9_b5_q3": "A", "tin9_b5_q4": "A"},
        6: {"tin9_b6_q1": "B", "tin9_b6_q2": "A", "tin9_b6_q3": "B", "tin9_b6_q4": "B"},
        7: {"tin9_b7_q1": "A", "tin9_b7_q2": "B", "tin9_b7_q3": "C", "tin9_b7_q4": "A"},
        8: {"tin9_b8_q1": "A", "tin9_b8_q2": "B", "tin9_b8_q3": "C", "tin9_b8_q4": "B"},
        9: {"tin9_b9_q1": "B", "tin9_b9_q2": "B", "tin9_b9_q3": "C", "tin9_b9_q4": "B"},
        10: {"tin9_b10_q1": "B", "tin9_b10_q2": "B", "tin9_b10_q3": "B", "tin9_b10_q4": "B"},
    }
    
    for lid, answers in key_map.items():
        res = client.post(
            "/api/grade-quiz",
            headers={"x-curriculum-version": "v2"},
            json={
                "grade": 9,
                "lesson_id": lid,
                "answers": answers
            }
        )
        assert res.status_code == 200, f"Lỗi chấm điểm bài {lid}: {res.text}"
        data = res.json()
        assert data["success"] is True
        eval_data = data["evaluation"]
        assert eval_data["score"] == 10.0
        assert eval_data["correct_count"] == 4
        assert eval_data["total_questions"] == 4


def test_tin9_grade_quiz_partial_wrong():
    """Kiểm tra phản hồi sư phạm khi học sinh làm sai."""
    res = client.post(
        "/api/grade-quiz",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 1,
            "answers": {
                "tin9_b1_q1": "B",  # Sai (Đúng là A: CPU)
                "tin9_b1_q2": "B",  # Đúng
                "tin9_b1_q3": "C",  # Sai (Đúng là A: Giao thông)
                "tin9_b1_q4": "C"   # Đúng
            }
        }
    )
    assert res.status_code == 200
    data = res.json()
    eval_data = data["evaluation"]
    assert eval_data["score"] == 5.0
    assert eval_data["correct_count"] == 2
    
    details = {item["id"]: item for item in eval_data["details"]}
    assert details["tin9_b1_q1"]["is_correct"] is False
    assert "bộ não" in details["tin9_b1_q1"]["feedback"].lower()
    assert details["tin9_b1_q2"]["is_correct"] is True


def test_tin9_socratic_tutor_chat():
    """Kiểm tra Gia sư Socrates AI hướng dẫn sư phạm không lộ đáp án."""
    # 1. Học sinh đòi đáp án trực tiếp
    res = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 1,
            "message": "Nói luôn cho em đáp án câu 1 là gì đi thầy?",
            "history": []
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    reply = data["reply"].lower()
    assert any(p in reply for p in [
        "không thể đưa ra đáp án",
        "không thể chọn hộ",
        "tự mình suy nghĩ",
        "giúp em tự hiểu",
        "quy tắc học tập",
        "tự tin chọn"
    ]), f"Phản hồi không mang tính từ chối sư phạm: {reply}"
    assert "chọn a" not in reply
    assert "đáp án là a" not in reply

    # 2. Học sinh hỏi về khái niệm CPU
    res2 = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 1,
            "message": "Bộ vi xử lí CPU có vai trò gì vậy thầy?",
            "history": []
        }
    )
    assert res2.status_code == 200
    assert "bộ não" in res2.json()["reply"].lower()

    # 3. Học sinh hỏi về 4 tiêu chí đánh giá thông tin
    res3 = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 2,
            "message": "Thầy ơi có những tiêu chí nào để đánh giá chất lượng thông tin ạ?",
            "history": []
        }
    )
    assert res3.status_code == 200
    r3_text = res3.json()["reply"]
    assert "mới" in r3_text.lower()
    assert ("đúng" in r3_text.lower() or "chính xác" in r3_text.lower())
    assert "đủ" in r3_text.lower()

    # 4. Học sinh hỏi về Sơ đồ tư duy (Bài 7 & 8)
    res4 = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 7,
            "message": "Sơ đồ tư duy Mindmap giúp ích gì trong việc trình bày bài học vậy thầy?",
            "history": []
        }
    )
    assert res4.status_code == 200
    r4_text = res4.json()["reply"].lower()
    assert "trực quan" in r4_text or "sơ đồ tư duy" in r4_text or "nhánh" in r4_text

    # 5. Học sinh hỏi về Data Validation & hàm IF (Bài 9)
    res5 = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 9,
            "message": "Công cụ Data Validation và hàm IF dùng để làm gì vậy thầy?",
            "history": []
        }
    )
    assert res5.status_code == 200
    r5_text = res5.json()["reply"].lower()
    assert "data validation" in r5_text or "xác thực" in r5_text or "hàm if" in r5_text

    # 6. Học sinh hỏi về hàm COUNTIF & SUMIF (Bài 10)
    res6 = client.post(
        "/api/chat",
        headers={"x-curriculum-version": "v2"},
        json={
            "grade": 9,
            "lesson_id": 10,
            "message": "Làm sao để đếm số học sinh đạt điểm giỏi bằng hàm COUNTIF ạ?",
            "history": []
        }
    )
    assert res6.status_code == 200
    r6_text = res6.json()["reply"].lower()
    assert "countif" in r6_text or "đếm" in r6_text
