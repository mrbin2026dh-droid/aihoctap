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
    assert overview["kpi"]["total_students"] == 35
    assert overview["kpi"]["completed_count"] == 28
    assert len(overview["students"]) == 35
    # Kiểm tra học sinh đầu tiên khớp với ảnh mẫu (Nguyễn Minh Anh)
    first_hs = overview["students"][0]
    assert first_hs["full_name"] == "Nguyễn Minh Anh"
    assert first_hs["student_code"] == "HS001"
    assert first_hs["average_score"] >= 9.0


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
