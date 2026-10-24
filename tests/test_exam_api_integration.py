import os
import sys
import io
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from backend.server import app, TEACHER_PIN, FAILED_LOGIN_ATTEMPTS

client = TestClient(app)


def get_teacher_headers():
    FAILED_LOGIN_ATTEMPTS.clear()
    res = client.post("/api/teacher/auth", json={"pin": TEACHER_PIN})
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def get_student_headers():
    res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_api_exam_template():
    response = client.get("/api/exams/template")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(response.content) > 1000

    headers = get_teacher_headers()
    # Dùng chính file tải về để test upload-excel
    files = {
        "file": ("Mau_De_Kiem_Tra.xlsx", response.content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }
    upload_res = client.post("/api/teacher/exams/upload-excel", headers=headers, files=files)
    assert upload_res.status_code == 200
    data = upload_res.json()
    assert data["success"] is True
    assert data["total_questions"] >= 2
    assert len(data["questions"]) >= 2


def test_api_create_and_submit_exam():
    teacher_headers = get_teacher_headers()
    # 1. Tạo bài kiểm tra
    exam_payload = {
        "exam_id": "exam_api_test_01",
        "title": "Kiểm tra 15 phút - Tin học 9",
        "grade": 9,
        "target_classes": ["9A", "9B"],
        "duration_minutes": 15,
        "status": "published",
        "questions": [
            {
                "id": "q1",
                "cau_hoi": "Bộ phận nào là bộ não của máy tính?",
                "lua_chon": {"A": "CPU", "B": "RAM", "C": "Màn hình", "D": "Bàn phím"},
                "dap_an_dung": "A",
                "muc_sgk": "Mục 1: Thiết bị có gắn bộ xử lí",
                "giai_thich_su_pham": "CPU là khối điều khiển và tính toán trung tâm."
            },
            {
                "id": "q2",
                "cau_hoi": "Đâu là vật mang tin?",
                "lua_chon": {"A": "Ý nghĩ trong đầu", "B": "Vở ghi bài", "C": "Ánh sáng đỏ", "D": "Tiếng còi"},
                "dap_an_dung": "B",
                "muc_sgk": "Mục 2: Vật mang tin",
                "giai_thich_su_pham": "Vở ghi là vật thể vật lý chứa dữ liệu."
            }
        ]
    }

    create_res = client.post("/api/teacher/exams/create", headers=teacher_headers, json=exam_payload)
    assert create_res.status_code == 200
    assert create_res.json()["success"] is True

    # 2. Lấy danh sách đề
    list_res = client.get("/api/exams/list?grade=9&class_code=9A")
    assert list_res.status_code == 200
    exams = list_res.json()["exams"]
    assert any(e["exam_id"] == "exam_api_test_01" for e in exams)

    # 3. Học sinh lấy chi tiết đề (không có đáp án đúng)
    get_res = client.get("/api/exams/exam_api_test_01")
    assert get_res.status_code == 200
    exam_detail = get_res.json()["exam"]
    assert "dap_an_dung" not in exam_detail["questions"][0]

    # 4. Học sinh nộp bài với token xác thực
    student_headers = get_student_headers()
    sub_payload = {
        "exam_id": "exam_api_test_01",
        "student_id": "std_minhkhang_01",
        "student_name": "Nguyễn Minh Khang",
        "class_code": "9A",
        "grade": 9,
        "answers": {
            "q1": "A",
            "q2": "A"  # Chọn sai
        }
    }
    sub_res = client.post("/api/exams/submit", headers=student_headers, json=sub_payload)
    assert sub_res.status_code == 200
    result = sub_res.json()["evaluation"]
    assert result["score"] == 5.0
    assert result["correct_count"] == 1
    assert "ai_evaluation" in result
    assert len(result["ai_evaluation"]["recommendations"]) >= 1

    # 5. Giáo viên xóa đề kiểm tra
    del_res = client.delete("/api/teacher/exams/exam_api_test_01", headers=teacher_headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    print("ALL EXAM API INTEGRATION TESTS PASSED!")


if __name__ == "__main__":
    test_api_exam_template()
    test_api_create_and_submit_exam()
