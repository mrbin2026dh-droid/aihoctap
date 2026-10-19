"""
Bộ Kiểm Thử TDD: Kiểm Chứng Vành Đai Socrates & Khế Ước Dữ Liệu
Tuân thủ Luật: Cấm lộ đáp án, bám sát SGK, chấm điểm có nhận xét sư phạm.
"""
import pytest
from backend.grounding import load_lesson_data
from backend.contracts import LessonContract, QuizItemContract
from backend.agent import check_and_redact_answer_leak, socratic_fallback_reply, grade_quiz_submission


def test_lesson_1_conforms_to_proof_contract():
    """Kiểm chứng Bài 1 Tin học 6 thỏa mãn 100% Khế ước Toán học Pydantic."""
    raw_data = load_lesson_data(grade=6, lesson_id=1)
    # Nếu vi phạm luật hoặc thiếu trường, Pydantic sẽ ném ValidationError
    lesson = LessonContract(**raw_data)
    assert lesson.grade == 6
    assert lesson.lesson_id == 1
    assert "thông tin và dữ liệu" in lesson.title.lower()
    assert len(lesson.quiz) == 4
    for item in lesson.quiz:
        assert isinstance(item, QuizItemContract)
        assert item.dap_an_dung in ["A", "B", "C", "D"]
        assert len(item.lua_chon) == 4


def test_zero_direct_answer_guardrail_blocks_leakage():
    """Kiểm chứng Chốt chặn Guardrail triệt tiêu hoàn toàn câu trả lời lộ đáp án."""
    test_cases = [
        "Câu này đáp án là B nhé em.",
        "Em hãy chọn C vì nó đúng.",
        "Phương án chính xác là: A",
        "D là đáp án chính xác nhất.",
    ]
    for leak_text in test_cases:
        redacted = check_and_redact_answer_leak(leak_text, [])
        # Bắt buộc không còn cụm 'đáp án là B' hay 'chọn C'
        assert "đáp án là B" not in redacted.lower()
        assert "chọn c" not in redacted.lower()
        assert "gợi ý: em hãy đối chiếu lại" in redacted


def test_socratic_engine_refuses_homework_requests():
    """Kiểm chứng Agent từ chối giải hộ khi học sinh vòi vĩnh đáp án."""
    student_prompt = "Thầy ơi cho em đáp án câu 1 với em cần nộp bài gấp!"
    curriculum = "Dữ liệu là các số, hình ảnh... Thông tin là sự hiểu biết..."
    reply = socratic_fallback_reply(grade=6, lesson_id=1, message=student_prompt, curriculum_text=curriculum)
    
    # Khẳng định: Không đưa đáp án trực tiếp, có lời từ chối lịch sự và gợi mở tư duy
    assert "nhiệm vụ của thầy là giúp em tự hiểu bản chất" in reply
    assert "Dữ liệu" in reply or "Thông tin" in reply


def test_quiz_grading_and_pedagogical_remediation():
    """Kiểm chứng chấm điểm trắc nghiệm và phản hồi sư phạm chữa bài."""
    raw_data = load_lesson_data(grade=6, lesson_id=1)
    quiz_data = raw_data["quiz"]

    # 1. Trường hợp làm đúng 100%
    perfect_answers = {
        "tin6_b1_q1": "B",
        "tin6_b1_q2": "B",
        "tin6_b1_q3": "C",
        "tin6_b1_q4": "C"
    }
    result_perfect = grade_quiz_submission(perfect_answers, quiz_data)
    assert result_perfect["score"] == 10.0
    assert result_perfect["correct_count"] == 4
    assert "Xuất sắc" in result_perfect["summary_comment"]

    # 2. Trường hợp làm sai câu 1
    wrong_answers = {
        "tin6_b1_q1": "A", # Sai (đáp án đúng là B)
        "tin6_b1_q2": "B",
        "tin6_b1_q3": "C",
        "tin6_b1_q4": "C"
    }
    result_wrong = grade_quiz_submission(wrong_answers, quiz_data)
    assert result_wrong["score"] == 7.5
    assert result_wrong["correct_count"] == 3
    # Phải có nhận xét chỉ dẫn cho câu làm sai
    q1_detail = next(d for d in result_wrong["details"] if d["id"] == "tin6_b1_q1")
    assert q1_detail["is_correct"] is False
    assert "Em hãy nhớ lại" in q1_detail["feedback"]
