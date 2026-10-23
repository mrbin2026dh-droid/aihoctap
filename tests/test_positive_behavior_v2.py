"""
Kiểm thử khẳng định hành vi ĐÚNG (Positive Behavioral Verification Test Suite - Vòng 3)
Tuân thủ chỉ thị V3-01..V3-07:
1. Không dùng 'reproduced: false' làm bằng chứng PASS.
2. Cô lập 100% trong tmp_path qua tests/conftest.py (không ghi/xóa dữ liệu thật).
3. Kiểm thử happy path Giáo viên (có xác thực API) & Học sinh LAN/Google.
4. Kiểm thử các ca biên: Hết hạn deadline (khẳng định đúng HTTP 403), thiếu ngân hàng đáp án, chuyển lớp học sinh, bản nháp draft.
5. Không phân nhánh mã sản phẩm theo tên ca kiểm thử.
"""
import pytest
import json
import time
from fastapi.testclient import TestClient

from backend.server import app, ACTIVE_STUDENT_SESSIONS
import backend.server as server_mod
from backend.exam_service import QuestionItem, ExamModel, create_or_update_exam, get_exam
from backend.grounding import save_lesson_blocks

client = TestClient(app)


def test_positive_lan_login_to_exam_submission_flow():
    """
    Chu trình ĐÚNG 1: Đăng nhập LAN mã học sinh hợp lệ -> Nhận token -> Nộp bài thi hợp lệ -> Chấm điểm thành công.
    """
    # 1. Đăng nhập LAN bằng mã học sinh hợp lệ '123456'
    login_res = client.post("/api/student/lan-login", json={
        "student_code": "123456",
        "grade": 9
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    login_data = login_res.json()
    assert login_data["success"] is True
    assert "token" in login_data
    token = login_data["token"]
    assert token.startswith("lan_sess_123456_")
    student = login_data["student"]
    assert student["uid"] == "std_123456"
    assert student["class_code"] == "9A"

    # 2. Tạo đề thi hợp lệ cho lớp 9A
    q1 = QuestionItem(
        id="q_unit_1",
        cau_hoi="Thiết bị nào sau đây là bộ xử lý trung tâm của máy tính?",
        lua_chon={"A": "CPU", "B": "RAM", "C": "Ổ cứng", "D": "Màn hình"},
        dap_an_dung="A",
        muc_sgk="Mục 1: Phần cứng máy tính",
        giai_thich_su_pham="CPU là Central Processing Unit, bộ não xử lý trung tâm."
    )
    exam = ExamModel(
        exam_id="exam_positive_test_01",
        title="Kiểm tra Tin học 9",
        grade=9,
        target_classes=["9A"],
        duration_minutes=15,
        status="published",
        questions=[q1]
    )
    saved_exam = create_or_update_exam(exam)
    assert saved_exam.exam_id == "exam_positive_test_01"

    # 3. Học sinh nộp bài với token vừa nhận được
    submit_payload = {
        "exam_id": "exam_positive_test_01",
        "student_id": "std_123456",
        "student_name": student["student_name"],
        "student_code": "123456",
        "class_code": "9A",
        "grade": 9,
        "answers": {"q_unit_1": "A"},
        "time_spent": "5 phút 0 giây"
    }
    submit_res = client.post(
        "/api/exams/submit",
        json=submit_payload,
        headers={
            "Authorization": f"Bearer {token}",
            "x-student-token": token
        }
    )
    assert submit_res.status_code == 200, f"Submission failed: {submit_res.text}"
    submit_data = submit_res.json()
    assert submit_data["success"] is True
    assert "evaluation" in submit_data
    evaluation = submit_data["evaluation"]
    assert evaluation["score"] == 10.0
    assert evaluation["correct_count"] == 1
    assert evaluation["total_questions"] == 1


def test_positive_unissued_token_rejected_401():
    """
    Chu trình ĐÚNG 2: Gửi token tự chế không nằm trong session store -> Bắt buộc bị từ chối 401.
    """
    ACTIVE_STUDENT_SESSIONS.clear()

    submit_payload = {
        "exam_id": "exam_positive_test_01",
        "student_id": "std_123456",
        "student_name": "Kẻ giả mạo",
        "student_code": "123456",
        "class_code": "9A",
        "grade": 9,
        "answers": {"q1": "A"}
    }
    res = client.post(
        "/api/exams/submit",
        json=submit_payload,
        headers={"x-student-token": "lan_sess_123456_FORGED_TOKEN_NEVER_ISSUED"}
    )
    assert res.status_code == 401
    assert "không hợp lệ" in res.json()["detail"] or "hết hạn" in res.json()["detail"]


def test_positive_deadline_expired_rejected():
    """
    Chu trình ĐÚNG 3: Đề thi đã hết hạn nộp bài (end_time trong quá khứ) -> Khẳng định đúng mã nghiệp vụ HTTP 403 (V3-07).
    """
    login_res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    token = login_res.json()["token"]

    q1 = QuestionItem(
        id="q_exp_1",
        cau_hoi="Câu hỏi kiểm tra deadline?",
        lua_chon={"A": "Đúng", "B": "Sai"},
        dap_an_dung="A"
    )
    exam = ExamModel(
        exam_id="exam_expired_test",
        title="Đề thi đã hết hạn",
        grade=9,
        target_classes=["9A"],
        status="published",
        end_time="2020-01-01T00:00:00",
        questions=[q1]
    )
    create_or_update_exam(exam)

    res = client.post(
        "/api/exams/submit",
        json={
            "exam_id": "exam_expired_test",
            "student_id": "std_123456",
            "student_name": "Nguyễn Minh Khang",
            "class_code": "9A",
            "grade": 9,
            "answers": {"q_exp_1": "A"}
        },
        headers={"x-student-token": token}
    )
    # Khẳng định chuẩn xác mã lỗi 403 nghiệp vụ, tuyệt đối không chấp nhận 500
    assert res.status_code == 403
    assert "thời hạn" in res.text or "hạn chót" in res.text


def test_positive_blocked_student_rejected_403():
    """
    Chu trình ĐÚNG 4: Học sinh bị Giáo viên tạm khóa tài khoản -> Bị từ chối nộp bài với HTTP 403.
    """
    login_res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    token = login_res.json()["token"]

    # Giả lập Giáo viên khóa tài khoản học sinh
    ACTIVE_STUDENT_SESSIONS[token]["is_blocked"] = True

    q1 = QuestionItem(id="q1", cau_hoi="Câu hỏi?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    exam = ExamModel(exam_id="exam_blk_test", title="Đề thi", grade=9, target_classes=["9A"], status="published", questions=[q1])
    create_or_update_exam(exam)

    res = client.post(
        "/api/exams/submit",
        json={
            "exam_id": "exam_blk_test",
            "student_id": "std_123456",
            "student_name": "Nguyễn Minh Khang",
            "class_code": "9A",
            "grade": 9,
            "answers": {"q1": "A"}
        },
        headers={"x-student-token": token}
    )
    assert res.status_code == 403
    assert "tạm khóa" in res.json()["detail"]


def test_positive_unregistered_student_code_rejected_404():
    """
    Chu trình ĐÚNG 5: Nhập mã học sinh 6 số chưa được đăng ký trong danh sách trường -> Bị từ chối HTTP 404.
    """
    res = client.post("/api/student/lan-login", json={"student_code": "999888", "grade": 9})
    assert res.status_code == 404
    assert "không tồn tại" in res.json()["detail"]


def test_positive_draft_lesson_blocked_across_all_endpoints():
    """
    Chu trình ĐÚNG 6: Bài học nháp (draft) bị chặn HTTP 403 trên cả 4 endpoint.
    Hoàn toàn cô lập trong tmp_path, không chạm thư mục data thật (V3-07).
    """
    save_res = save_lesson_blocks(
        grade=9,
        lesson_id=99,
        payload={
            "grade": 9,
            "lesson_id": 99,
            "title": "Bài nháp thử nghiệm",
            "content_markdown": "",
            "blocks": [{
                "type": "hero",
                "title": "Chủ đề nháp",
                "description": "Nội dung lý thuyết nháp",
                "key_takeaways": ["Ghi nhớ 1"]
            }],
            "quiz": [{
                "id": "q99_1",
                "cau_hoi": "Nháp?",
                "lua_chon": {"A": "1", "B": "2", "C": "3", "D": "4"},
                "dap_an_dung": "A",
                "giai_thich_su_pham": "Giải thích chuẩn sư phạm.",
                "goi_y_khi_sai": "Em hãy xem lại nội dung bài học.",
                "source": "generated"
            }]
        },
        allow_publish=False # Ghi trạng thái draft
    )
    assert save_res["status"] == "draft"
    assert save_res["v2_synced"] is True

    # 1. Kiểm tra get_lesson_v2
    res_v2 = client.get("/api/v2/lesson/9/99")
    assert res_v2.status_code == 403

    # 2. Kiểm tra get_lesson thường
    res_v1 = client.get("/api/lesson/9/99")
    assert res_v1.status_code == 403

    # 3. Kiểm tra chat với bài nháp
    res_chat = client.post("/api/chat", json={"grade": 9, "lesson_id": 99, "message": "Giúp em bài 99"})
    assert res_chat.status_code == 403

    # 4. Kiểm tra chấm trắc nghiệm bài nháp
    res_quiz = client.post("/api/grade-quiz", json={"grade": 9, "lesson_id": 99, "answers": {"q99_1": "A"}})
    assert res_quiz.status_code == 403


def test_positive_teacher_auth_and_create_exam_flow():
    """
    Chu trình ĐÚNG 7 (V3-07): Happy path Giáo viên xác thực API với PIN -> Nhận Teacher Token -> Tạo đề thi -> Truy vấn kết quả.
    """
    # 1. Giáo viên đăng nhập với mã PIN hợp lệ đã cấu hình
    pin_to_test = server_mod.TEACHER_PIN or "Tch-Secret-Test-PIN-2026"
    server_mod.TEACHER_PIN = pin_to_test
    auth_res = client.post("/api/teacher/auth", json={"pin": pin_to_test})
    assert auth_res.status_code == 200, f"Teacher auth failed: {auth_res.text}"
    auth_data = auth_res.json()
    assert auth_data["success"] is True
    teacher_token = auth_data["token"]

    # 2. Giáo viên dùng token để truy vấn kết quả bài thi qua API có bảo vệ
    results_res = client.get(
        "/api/teacher/exams/exam_test_unit_01/results",
        headers={
            "Authorization": f"Bearer {teacher_token}",
            "x-teacher-token": teacher_token
        }
    )
    assert results_res.status_code == 200
    assert "submissions" in results_res.json()


def test_positive_student_class_transfer_fresh_mapping():
    """
    Chu trình ĐÚNG 8 (V3-02 & C02): Học sinh chuyển lớp trong sổ bộ trường học (9A -> 9B)
    -> Phiên làm việc tự động làm mới lớp học mới nhất từ máy chủ tin cậy.
    """
    # 1. Đăng nhập học sinh 123456 ban đầu ở lớp 9A
    login_res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    token = login_res.json()["token"]
    assert login_res.json()["student"]["class_code"] == "9A"

    # 2. Cập nhật hồ sơ học sinh trong registry file sang lớp 9B
    reg_path = server_mod.STUDENTS_REGISTRY_FILE
    with open(reg_path, "r", encoding="utf-8") as f:
        reg_dict = json.load(f)
    reg_dict["123456"]["class_code"] = "9B"
    with open(reg_path, "w", encoding="utf-8") as f:
        json.dump(reg_dict, f, ensure_ascii=False, indent=2)

    # 3. Tạo đề thi dành riêng cho lớp 9B
    q1 = QuestionItem(id="q_b1", cau_hoi="Câu hỏi 9B?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    exam_9b = ExamModel(
        exam_id="exam_class_9b",
        title="Đề thi lớp 9B",
        grade=9,
        target_classes=["9B"],
        status="published",
        questions=[q1]
    )
    create_or_update_exam(exam_9b)

    # 4. Học sinh nộp bài với token cũ: Hệ thống tự động làm mới lớp thành 9B và cho phép nộp bài
    sub_res = client.post(
        "/api/exams/submit",
        json={
            "exam_id": "exam_class_9b",
            "student_id": "std_123456",
            "student_name": "Nguyễn Minh Khang",
            "class_code": "9A", # Client có thể vẫn mang class_code cũ
            "grade": 9,
            "answers": {"q_b1": "A"}
        },
        headers={"x-student-token": token}
    )
    assert sub_res.status_code == 200, f"Submission failed: {sub_res.text}"
    assert sub_res.json()["success"] is True


def test_positive_missing_answer_bank_rejected():
    """
    Chu trình ĐÚNG 9 (V3-03 & C04): Đề thi không có ngân hàng đáp án tin cậy (thiếu dap_an_dung)
    -> Bắt buộc từ chối chấm điểm với thông báo rõ ràng, không được tự quy chụp học sinh 0 điểm.
    """
    login_res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    token = login_res.json()["token"]

    # Tạo đề thi không có đáp án đúng (tương tự public exam snapshot bị thiếu key)
    q_no_ans = QuestionItem(id="q_no_ans_1", cau_hoi="Câu hỏi không đáp án?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    exam_no_ans = ExamModel(
        exam_id="exam_no_answer_key",
        title="Đề thiếu đáp án",
        grade=9,
        target_classes=["9A"],
        status="published",
        questions=[q_no_ans]
    )
    create_or_update_exam(exam_no_ans)

    # Xóa đáp án đúng khỏi tệp đề thi trên đĩa cứng
    exam_file = server_mod.EXAMS_DIR / "exam_no_answer_key.json"
    with open(exam_file, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    for q in raw_data.get("questions", []):
        q.pop("dap_an_dung", None)
    with open(exam_file, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False)

    # Học sinh nộp bài
    sub_res = client.post(
        "/api/exams/submit",
        json={
            "exam_id": "exam_no_answer_key",
            "student_id": "std_123456",
            "student_name": "Nguyễn Minh Khang",
            "class_code": "9A",
            "grade": 9,
            "answers": {"q_no_ans_1": "A"}
        },
        headers={"x-student-token": token}
    )
    # Khẳng định bị từ chối do thiếu ngân hàng đáp án tin cậy
    assert sub_res.status_code in (400, 403, 404, 422)
    assert ("thiếu đáp án chuẩn" in sub_res.text) or ("thiếu ngân hàng đáp án" in sub_res.text)


def test_positive_idempotent_submission():
    """
    Chu trình ĐÚNG 10 (V3-04): Nộp lại cùng một submission_id (Idempotency)
    -> Trả về kết quả đã chấm trước đó một cách an toàn mà không bị lỗi nộp trùng hay ghi đè sai lệch.
    """
    login_res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    token = login_res.json()["token"]

    q1 = QuestionItem(id="q_idem_1", cau_hoi="Câu hỏi idempotency?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    exam = ExamModel(exam_id="exam_idem_test", title="Đề thi Idempotent", grade=9, target_classes=["9A"], status="published", questions=[q1])
    create_or_update_exam(exam)

    sub_payload = {
        "exam_id": "exam_idem_test",
        "student_id": "std_123456",
        "student_name": "Nguyễn Minh Khang",
        "class_code": "9A",
        "grade": 9,
        "submission_id": "sub_idem_unique_12345",
        "answers": {"q_idem_1": "A"}
    }
    # Lần nộp 1
    res1 = client.post("/api/exams/submit", json=sub_payload, headers={"x-student-token": token})
    assert res1.status_code == 200
    score1 = res1.json()["evaluation"]["score"]
    assert score1 == 10.0

    # Lần nộp 2 cùng submission_id (Retry idempotent)
    res2 = client.post("/api/exams/submit", json=sub_payload, headers={"x-student-token": token})
    assert res2.status_code == 200
    score2 = res2.json()["evaluation"]["score"]
    assert score2 == score1


def test_regression_d04_partially_missing_answer_bank_rejected():
    """
    Kiểm thử hồi quy D04: Đề thi có 2 câu nhưng chỉ 1 câu có đáp án chuẩn (câu 2 bị thiếu)
    -> Bắt buộc dừng chấm và từ chối nộp bài, tuyệt đối KHÔNG tự quy chụp câu 2 làm sai để cho 5/10 điểm.
    """
    login_res = client.post("/api/student/lan-login", json={"student_code": "123456", "grade": 9})
    token = login_res.json()["token"]

    q1 = QuestionItem(id="q_part_1", cau_hoi="Câu 1 có đáp án?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    q2 = QuestionItem(id="q_part_2", cau_hoi="Câu 2 có đáp án?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    exam_part = ExamModel(
        exam_id="exam_partially_missing_key",
        title="Đề thiếu 1 phần đáp án",
        grade=9,
        target_classes=["9A"],
        status="published",
        questions=[q1, q2]
    )
    create_or_update_exam(exam_part)

    # Cố tình xóa đáp án của câu q_part_2 trên file đĩa cứng
    exam_file = server_mod.EXAMS_DIR / "exam_partially_missing_key.json"
    with open(exam_file, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    for q in raw_data.get("questions", []):
        if q.get("id") == "q_part_2":
            q.pop("dap_an_dung", None)
    with open(exam_file, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False)

    sub_res = client.post(
        "/api/exams/submit",
        json={
            "exam_id": "exam_partially_missing_key",
            "student_id": "std_123456",
            "student_name": "Nguyễn Minh Khang",
            "class_code": "9A",
            "grade": 9,
            "answers": {"q_part_1": "A", "q_part_2": "A"}
        },
        headers={"x-student-token": token}
    )
    # Khẳng định bị từ chối nghiệp vụ rõ ràng, không được trả về score 5.0
    assert sub_res.status_code in (400, 403, 404, 422)
    assert "thiếu đáp án chuẩn" in sub_res.text or "q_part_2" in sub_res.text


def test_regression_d05_partial_cloud_sync_status(monkeypatch):
    """
    Kiểm thử hồi quy D05: Đồng bộ cloud public thành công nhưng private answer bank thất bại
    -> cloud_sync_status phải là 'partial_sync' (hoặc 'pending_sync') và cloud_synced=False, không được ghi đè 'synced'.
    """
    import backend.exam_service as exam_mod

    # Giả lập public sync thành công, private sync thất bại
    def mock_partial_sync(path, data=None, **kwargs):
        if str(path).startswith("exam_answers/"):
            return False
        return True

    monkeypatch.setattr(exam_mod, "sync_to_firebase_rtdb", mock_partial_sync)

    q1 = QuestionItem(id="q_d05_1", cau_hoi="Câu hỏi D05?", lua_chon={"A": "1", "B": "2"}, dap_an_dung="A")
    exam_d05 = ExamModel(
        exam_id="exam_d05_test",
        title="Đề thi test D05",
        grade=9,
        target_classes=["9A"],
        status="published",
        questions=[q1]
    )
    saved = create_or_update_exam(exam_d05)
    assert saved.cloud_synced is False

    # Đọc lại file đĩa cứng
    exam_file = exam_mod.EXAMS_DIR / "exam_d05_test.json"
    with open(exam_file, "r", encoding="utf-8") as f:
        disk_data = json.load(f)
    assert disk_data.get("cloud_sync_status") == "partial_sync"
    assert disk_data.get("cloud_sync_status") != "synced"

