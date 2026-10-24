"""
Unit & Integration Test Suite: Khế ước Dữ liệu & API Quản lý Học sinh (Student Analytics)
Kiểm thử tính toàn vẹn của Pydantic Contracts, API Endpoint và Gemini AI Pedagogical Engine.
"""
import pytest
from fastapi.testclient import TestClient
from backend.server import app, ACTIVE_TEACHER_SESSIONS
from backend.contracts import (
    TopicMasteryStatus,
    StudentOverviewItem,
    ClassKPIMetrics,
    ClassAnalyticsResponse,
    AIPedagogicalAdviceRequest,
    AIPedagogicalAdviceResponse,
)
from backend.agent import analyze_class_pedagogy


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def teacher_auth_headers():
    token = "test-teacher-token-analytics-12345"
    import time
    ACTIVE_TEACHER_SESSIONS[token] = time.time() + 3600
    return {"Authorization": f"Bearer {token}"}


def test_topic_mastery_contract():
    """Kiểm tra khế ước mức độ thành thạo theo chủ đề."""
    item = TopicMasteryStatus(
        topic_id="the_gioi_ki_thuat_so",
        topic_name="Thế giới kĩ thuật số",
        score=8.6,
        status="mastered"
    )
    assert item.topic_id == "the_gioi_ki_thuat_so"
    assert item.status == "mastered"
    assert item.score == 8.6

    with pytest.raises(Exception):
        TopicMasteryStatus(
            topic_id="invalid",
            topic_name="Invalid",
            score=5.0,
            status="invalid_status"  # Sai status literal
        )


def test_student_overview_item_contract():
    """Kiểm tra khế ước từng học sinh trong bảng quản lý."""
    student = StudentOverviewItem(
        id="hs-001",
        student_code="HS001",
        full_name="Nguyễn Minh Anh",
        progress_percent=100,
        average_score=9.2,
        topics=[
            TopicMasteryStatus(
                topic_id="the_gioi_ki_thuat_so",
                topic_name="Thế giới kĩ thuật số",
                score=9.5,
                status="mastered"
            )
        ],
        status="completed"
    )
    assert student.student_code == "HS001"
    assert student.status == "completed"
    assert student.progress_percent == 100


def test_class_analytics_contract():
    """Kiểm tra khế ước toàn diện bảng phân tích số liệu lớp học."""
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
    res = ClassAnalyticsResponse(
        grade=9,
        class_name="9A",
        semester="Học kì I (2026 - 2027)",
        kpi=kpi,
        topic_averages={
            "the_gioi_ki_thuat_so": 8.6,
            "thong_tin_giai_quyet_van_de": 8.1,
            "danh_gia_chat_luong_thong_tin": 7.8,
            "su_dung_dich_vu_internet": 8.5,
            "phan_mem_ma_nguon_mo": 8.9
        },
        donut_progress={
            "completed": 28,
            "learning": 5,
            "not_started": 2
        },
        students=[]
    )
    assert res.kpi.total_students == 35
    assert res.topic_averages["danh_gia_chat_luong_thong_tin"] == 7.8


def test_api_get_students_overview(client, teacher_auth_headers):
    """Kiểm tra API lấy dữ liệu tổng quan lớp học."""
    response = client.get("/api/teacher/students-overview/9/9A", headers=teacher_auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["success"] is True
    overview = data["data"]
    assert overview["grade"] == 9
    assert overview["class_name"] == "9A"
    assert overview["kpi"]["total_students"] == 2
    assert overview["kpi"]["completed_count"] == 0
    assert len(overview["students"]) == 2
    # Lớp thật phải dùng sổ bộ cô lập, không dùng danh sách demo cố định.
    first_hs = overview["students"][0]
    assert first_hs["full_name"] == "Nguyễn Minh Khang"
    assert first_hs["student_code"] == "123456"
    assert first_hs["status"] == "not_started"
    assert first_hs["average_score"] == 0


def test_analyze_class_pedagogy_function():
    """Kiểm tra hàm phân tích sư phạm AI với dữ liệu lớp mẫu."""
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
    class_data = ClassAnalyticsResponse(
        grade=9,
        class_name="9A",
        semester="Học kì I (2026 - 2027)",
        kpi=kpi,
        topic_averages={
            "the_gioi_ki_thuat_so": 8.6,
            "thong_tin_giai_quyet_van_de": 8.1,
            "danh_gia_chat_luong_thong_tin": 7.8,
            "su_dung_dich_vu_internet": 8.5,
            "phan_mem_ma_nguon_mo": 8.9
        },
        donut_progress={"completed": 28, "learning": 5, "not_started": 2},
        students=[]
    )
    advice = analyze_class_pedagogy(class_data)
    assert advice.general_assessment
    assert advice.critical_concerns
    assert len(advice.actionable_recommendations) >= 1


def test_api_analyze_class_endpoint(client, teacher_auth_headers):
    """Kiểm tra API POST /api/teacher/analyze-class."""
    payload = {
        "grade": 9,
        "class_name": "9A"
    }
    response = client.post("/api/teacher/analyze-class", json=payload, headers=teacher_auth_headers)
    assert response.status_code == 200, response.text
    res_data = response.json()
    assert res_data["success"] is True
    advice = res_data["advice"]
    assert "general_assessment" in advice
    assert "critical_concerns" in advice
    assert "actionable_recommendations" in advice


def test_new_student_contract_can_represent_no_learning_history():
    student = StudentOverviewItem(id="std_new", student_code="000001", full_name="Synthetic",
                                  progress_percent=0, average_score=0, status="not_started")
    assert student.status == "not_started"


def test_analytics_uses_configured_registry_and_filters_grade(tmp_path, monkeypatch):
    import json
    from backend import grounding
    registry = tmp_path / "analytics-registry.json"
    registry.write_text(json.dumps({
        "901001": {"uid": "std_901001", "student_name": "Synthetic completed", "class_code": "9A", "grade": 9,
                   "progress_percent": 100, "average_score": 9},
        "901002": {"uid": "std_901002", "student_name": "Synthetic learning", "class_code": "9A", "grade": 9,
                   "progress_percent": 50, "average_score": 6},
        "601001": {"student_name": "Other grade", "class_code": "9A", "grade": 6},
    }), encoding="utf-8")
    monkeypatch.setattr(grounding, "STUDENTS_REGISTRY_FILE", registry, raising=False)
    overview = grounding.get_class_analytics_data(9, "9A")
    assert overview.kpi.total_students == 2
    assert overview.kpi.completed_count == 1
    assert overview.kpi.average_score == 7.5
    assert overview.donut_progress == {"completed": 1, "learning": 1, "not_started": 0}
    assert {s.student_code for s in overview.students} == {"901001", "901002"}
    assert overview.students[0].id == "std_901001"
    assert overview.kpi.improved_count == 0  # No prior observation establishes improvement.
    assert not overview.topic_averages  # Overall averages cannot establish topic mastery.
    assert all(t.status == "not_started" for s in overview.students for t in s.topics)


def test_empty_class_does_not_reuse_demo_students():
    from backend.grounding import get_class_analytics_data
    overview = get_class_analytics_data(9, "9EMPTY")
    assert overview.students == []
    assert overview.kpi.total_students == 0
    assert overview.kpi.average_score == 0


def test_advice_with_no_recorded_topics_does_not_invent_a_weakest_topic():
    from backend.grounding import get_class_analytics_data
    overview = get_class_analytics_data(9, "9A")
    advice = analyze_class_pedagogy(overview)
    assert advice.general_assessment
    assert "tiến độ tốt" not in advice.general_assessment
    assert "chưa" in advice.critical_concerns.casefold()
    assert advice.actionable_recommendations
    assert not any("nhóm 5 học sinh" in r for r in advice.actionable_recommendations)


def test_advice_for_empty_class_does_not_claim_learning_or_improvement():
    from backend.grounding import get_class_analytics_data
    advice = analyze_class_pedagogy(get_class_analytics_data(9, "9EMPTY"))
    assert "chưa" in advice.general_assessment.casefold()
    assert "tiến độ tốt" not in advice.general_assessment


def test_local_exam_results_reach_analytics_including_a_real_zero_score():
    from backend import exam_service, grounding
    for exam_id, choice in [("exam_zero", "B"), ("exam_ten", "A")]:
        exam_service.create_or_update_exam(exam_service.ExamModel(
            exam_id=exam_id, title=f"Teacher title {exam_id}", grade=9, target_classes=["9A"],
            questions=[exam_service.QuestionItem(id="q1", cau_hoi="Synthetic question?",
                                               lua_chon={"A": "Option one", "B": "Option two"}, dap_an_dung="A")]))
        exam_service.grade_exam_submission({"exam_id": exam_id, "student_id": "std_123456",
                                             "student_code": "123456", "student_name": "Synthetic",
                                             "grade": 9, "class_code": "9A", "answers": {"q1": choice}})
    overview = grounding.get_class_analytics_data(9, "9A")
    student = next(s for s in overview.students if s.student_code == "123456")
    assert student.average_score == 5
    assert student.score_count == 2
    assert student.progress_percent == 0  # Exams are not completed textbook lessons.
    assert student.status == "learning"
    assert {t.topic_name for t in student.topics if t.topic_id.startswith("exam_")} == {
        "Teacher title exam_zero", "Teacher title exam_ten"}
    assert overview.topic_averages["exam_zero"] == 0
    assert overview.topic_averages["exam_ten"] == 10
    assert overview.kpi.average_score == 5
    assert overview.donut_progress == {"completed": 0, "learning": 1, "not_started": 1}


def test_zero_exam_score_is_observed_support_need_without_invented_lesson_progress():
    from backend import exam_service, grounding
    exam_service.create_or_update_exam(exam_service.ExamModel(
        exam_id="exam_support", title="Synthetic exam", grade=9,
        questions=[exam_service.QuestionItem(id="q1", cau_hoi="Synthetic question?",
                                           lua_chon={"A": "One", "B": "Two"}, dap_an_dung="A")]))
    exam_service.grade_exam_submission({"exam_id": "exam_support", "student_id": "std_123456",
                                         "student_code": "123456", "student_name": "Synthetic",
                                         "grade": 9, "class_code": "9A", "answers": {"q1": "B"}})
    overview = grounding.get_class_analytics_data(9, "9A")
    student = next(s for s in overview.students if s.student_code == "123456")
    assert student.score_count == 1
    assert student.average_score == 0
    assert student.status == "needs_support"
    assert overview.kpi.needs_support_count == 1
    assert overview.kpi.completed_count == 0
