import os
import sys
import json
import io
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.exam_service import (
    export_exam_template_excel,
    parse_exam_excel_file,
    create_or_update_exam,
    list_exams,
    get_exam,
    grade_exam_submission,
    QuestionItem,
    ExamModel
)

def test_export_template_excel():
    excel_bytes = export_exam_template_excel()
    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 1000

    # Parse lại chính file template vừa sinh để xác minh tính tương thích 2 chiều
    questions = parse_exam_excel_file(excel_bytes)
    assert len(questions) >= 2
    q1 = questions[0]
    assert q1.cau_hoi != ""
    assert "A" in q1.lua_chon and "B" in q1.lua_chon
    assert q1.dap_an_dung in ["A", "B", "C", "D"]
    assert q1.muc_sgk is not None

def test_create_and_list_exam():
    test_questions = [
        QuestionItem(
            id="q_test_1",
            cau_hoi="CPU là gì?",
            lua_chon={"A": "Bộ xử lý trung tâm", "B": "Màn hình", "C": "Bàn phím", "D": "Chuột"},
            dap_an_dung="A",
            muc_sgk="Mục 1: Thiết bị có gắn bộ xử lí",
            giai_thich_su_pham="CPU là bộ não của máy tính"
        ),
        QuestionItem(
            id="q_test_2",
            cau_hoi="Thông tin khác Dữ liệu ở điểm nào?",
            lua_chon={"A": "Không khác", "B": "Thông tin là ý nghĩa rút ra", "C": "Dữ liệu sinh ra từ thông tin", "D": "Là một"},
            dap_an_dung="B",
            muc_sgk="Mục 2: Thông tin và dữ liệu",
            giai_thich_su_pham="Thông tin là ý nghĩa hiểu biết"
        )
    ]

    exam = ExamModel(
        exam_id="exam_test_unit_01",
        title="Đề kiểm tra thử nghiệm",
        grade=9,
        target_classes=["9A", "9B"],
        duration_minutes=15,
        status="published",
        questions=test_questions
    )

    saved = create_or_update_exam(exam)
    assert saved.exam_id == "exam_test_unit_01"

    exams_list = list_exams(grade=9, class_code="9A")
    found = any(e["exam_id"] == "exam_test_unit_01" for e in exams_list)
    assert found is True

    fetched = get_exam("exam_test_unit_01", hide_answers=True)
    assert fetched is not None
    assert fetched["questions"][0].get("dap_an_dung") is None # Bảo mật chống gian lận

    # Test nộp bài và nhận xét AI
    submission_data = {
        "exam_id": "exam_test_unit_01",
        "student_id": "std_test_01",
        "student_name": "Nguyễn Minh Khang",
        "class_code": "9A",
        "grade": 9,
        "answers": {
            "q_test_1": "A", # Đúng
            "q_test_2": "C"  # Sai
        }
    }

    result = grade_exam_submission(submission_data)
    assert result["score"] == 5.0
    assert result["total_questions"] == 2
    assert result["correct_count"] == 1
    assert "ai_evaluation" in result
    ai_eval = result["ai_evaluation"]
    assert "weak_topics" in ai_eval
    assert "recommendations" in ai_eval
    assert len(ai_eval["recommendations"]) >= 1
    assert "Mục 2: Thông tin và dữ liệu" in str(ai_eval["weak_topics"])
    from backend.exam_service import delete_exam
    del_ok = delete_exam("exam_test_unit_01")
    assert del_ok is True
    assert get_exam("exam_test_unit_01") is None
    print("TEST BACKEND EXAM SERVICE PASS 100%")

if __name__ == "__main__":
    test_export_template_excel()
    test_create_and_list_exam()
