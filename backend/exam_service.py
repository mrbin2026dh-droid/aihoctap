from typing import Dict, Any, List, Optional
import os
import json
import io
import re
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
EXAMS_DIR = DATA_DIR / "exams"
SUBMISSIONS_DIR = EXAMS_DIR / "submissions"

# Đảm bảo các thư mục dữ liệu tồn tại
EXAMS_DIR.mkdir(parents=True, exist_ok=True)
SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)


class QuestionItem(BaseModel):
    id: str = Field(default_factory=lambda: f"q_{int(datetime.now().timestamp() * 1000)}")
    cau_hoi: str
    lua_chon: Dict[str, str] = Field(default_factory=dict) # A, B, C, D
    dap_an_dung: str # A, B, C, or D
    muc_sgk: Optional[str] = "Mục kiến thức SGK"
    trang_sgk: Optional[int] = 0
    giai_thich_su_pham: Optional[str] = ""
    goi_y_khi_sai: Optional[str] = ""


class ExamModel(BaseModel):
    exam_id: str
    title: str
    grade: int = 9
    target_classes: List[str] = Field(default_factory=lambda: ["Tất cả"])
    duration_minutes: int = 15
    start_time: Optional[str] = ""
    end_time: Optional[str] = ""
    status: str = "published" # published, closed, draft
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    questions: List[QuestionItem] = Field(default_factory=list)


class ExamSubmissionRequest(BaseModel):
    exam_id: str
    student_id: str
    student_name: str
    class_code: str = "9A"
    grade: int = 9
    answers: Dict[str, str] = Field(default_factory=dict) # question_id -> chosen option


def export_exam_template_excel() -> bytes:
    """Sinh file mẫu Excel chuẩn để giáo viên soạn đề kiểm tra trắc nghiệm."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Đề kiểm tra Tin học"

    # Style tiêu đề bảng
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Dark Blue
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)

    headers = [
        "STT", 
        "Câu hỏi (*)", 
        "Lựa chọn A (*)", 
        "Lựa chọn B (*)", 
        "Lựa chọn C (*)", 
        "Lựa chọn D (*)", 
        "Đáp án đúng (A/B/C/D) (*)", 
        "Mục SGK tham chiếu", 
        "Giải thích sư phạm & Gợi ý"
    ]

    ws.append(headers)
    for col_idx, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    # Thêm dữ liệu mẫu sinh động chuẩn SGK
    sample_rows = [
        [
            1,
            "Bộ phận nào sau đây đóng vai trò là 'bộ não' của thiết bị số, chịu trách nhiệm xử lý thông tin?",
            "Bộ vi xử lí (CPU)",
            "Màn hình hiển thị",
            "Vỏ máy tính bảo vệ",
            "Chuột máy tính",
            "A",
            "Mục 1: Thiết bị có gắn bộ xử lí",
            "CPU là trung tâm điều khiển và thực hiện các lệnh tính toán logic."
        ],
        [
            2,
            "Trong các vật phẩm sau, đâu KHÔNG PHẢI là một thiết bị có gắn bộ xử lý thông tin?",
            "Máy rút tiền tự động (ATM)",
            "Bảng đen viết phấn truyền thống",
            "Robot hút bụi thông minh",
            "Điện thoại thông minh (Smartphone)",
            "B",
            "Mục 1: Thiết bị có gắn bộ xử lí",
            "Bảng đen là đồ dùng cơ học thông thường, không chứa mạch điện tử vi xử lý."
        ],
        [
            3,
            "Khi quan sát đèn giao thông chuyển sang màu đỏ, người đi đường dừng xe lại. Trong tình huống này, 'ánh sáng đỏ' là gì?",
            "Vật mang tin",
            "Dữ liệu",
            "Thông tin",
            "Quyết định",
            "B",
            "Mục 1: Thông tin và dữ liệu",
            "Ánh sáng màu đỏ thu nhận trực tiếp qua mắt là dữ liệu ban đầu trước khi não xử lý."
        ]
    ]

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for row_data in sample_rows:
        ws.append(row_data)
        current_row = ws.max_row
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=current_row, column=col_idx)
            cell.font = Font(name="Arial", size=10)
            cell.border = border_thin
            if col_idx in [1, 7]:
                cell.alignment = align_center
            else:
                cell.alignment = align_left

    # Tự động căn chỉnh độ rộng cột
    col_widths = {1: 8, 2: 45, 3: 25, 4: 25, 5: 25, 6: 25, 7: 18, 8: 30, 9: 40}
    for col_idx, width in col_widths.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[1].height = 28
    for r in range(2, len(sample_rows) + 2):
        ws.row_dimensions[r].height = 36

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse_exam_excel_file(file_bytes: bytes) -> List[QuestionItem]:
    """Đọc và bóc tách danh sách câu hỏi trắc nghiệm từ file Excel tải lên."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    questions: List[QuestionItem] = []
    
    # Tìm dòng bắt đầu dữ liệu (dòng 2 trở đi)
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not any(row):
            continue
        
        # Cấu trúc: [0: STT, 1: Câu hỏi, 2: A, 3: B, 4: C, 5: D, 6: Đáp án đúng, 7: Mục SGK, 8: Giải thích]
        cau_hoi = str(row[1] or "").strip()
        if not cau_hoi:
            continue

        opt_a = str(row[2] or "").strip()
        opt_b = str(row[3] or "").strip()
        opt_c = str(row[4] or "").strip()
        opt_d = str(row[5] or "").strip()

        if not (opt_a and opt_b):
            continue

        dap_an = str(row[6] or "").strip().upper()
        if dap_an not in ["A", "B", "C", "D"]:
            # Thử trích xuất ký tự đầu nếu nhập kiểu "A. Bộ vi xử lý"
            match = re.match(r"^([A-D])", dap_an)
            dap_an = match.group(1) if match else "A"

        muc_sgk = str(row[7] or "Kiến thức trọng tâm SGK").strip()
        giai_thich = str(row[8] or "").strip()

        lua_chon = {
            "A": opt_a,
            "B": opt_b,
            "C": opt_c,
            "D": opt_d
        }

        q_id = f"q_{row_idx}_{int(datetime.now().timestamp() % 100000)}"
        questions.append(
            QuestionItem(
                id=q_id,
                cau_hoi=cau_hoi,
                lua_chon=lua_chon,
                dap_an_dung=dap_an,
                muc_sgk=muc_sgk,
                giai_thich_su_pham=giai_thich,
                goi_y_khi_sai=f"Em hãy xem lại nội dung tại: {muc_sgk}"
            )
        )

    return questions


def create_or_update_exam(exam: ExamModel) -> ExamModel:
    """Lưu đề kiểm tra vào hệ thống đĩa cứng."""
    file_path = EXAMS_DIR / f"{exam.exam_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(exam.model_dump(), f, ensure_ascii=False, indent=2)
    return exam


def list_exams(grade: Optional[int] = None, class_code: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lấy danh sách các đề kiểm tra theo khối và lớp."""
    exams = []
    if not EXAMS_DIR.exists():
        return exams

    for p in EXAMS_DIR.glob("*.json"):
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Lọc theo grade nếu có
                    if grade and data.get("grade") != grade and data.get("grade") != 0:
                        continue
                    # Lọc theo class_code nếu có
                    targets = data.get("target_classes", [])
                    if class_code and targets and "Tất cả" not in targets and class_code not in targets:
                        continue
                    
                    # Bỏ bớt danh sách câu hỏi chi tiết để trả về meta nhẹ nhàng
                    meta = {
                        "exam_id": data.get("exam_id"),
                        "title": data.get("title"),
                        "grade": data.get("grade"),
                        "target_classes": data.get("target_classes"),
                        "duration_minutes": data.get("duration_minutes", 15),
                        "total_questions": len(data.get("questions", [])),
                        "status": data.get("status", "published"),
                        "created_at": data.get("created_at")
                    }
                    exams.append(meta)
            except Exception as e:
                print(f"Lỗi đọc file đề kiểm tra {p}: {e}")

    # Sắp xếp bài mới nhất lên trước
    exams.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return exams


def get_exam(exam_id: str, hide_answers: bool = True) -> Optional[Dict[str, Any]]:
    """Lấy thông tin đề kiểm tra. Nếu hide_answers=True, ẩn đáp án đúng để chống gian lận F12."""
    file_path = EXAMS_DIR / f"{exam_id}.json"
    if not file_path.exists():
        return None

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if hide_answers:
            # Ẩn dap_an_dung và giai_thich_su_pham để học sinh không soi được qua Network/Console
            sanitized_questions = []
            for q in data.get("questions", []):
                q_copy = dict(q)
                q_copy.pop("dap_an_dung", None)
                q_copy.pop("giai_thich_su_pham", None)
                sanitized_questions.append(q_copy)
            data["questions"] = sanitized_questions

        return data
    except Exception as e:
        print(f"Lỗi tải đề kiểm tra {exam_id}: {e}")
        return None


def grade_exam_submission(submission: Dict[str, Any]) -> Dict[str, Any]:
    """
    Chấm điểm bài nộp và kích hoạt AI Sư phạm Socrates phân tích lỗi sai:
    1. Đo lường chính xác số câu đúng/sai và điểm thang 10.
    2. Phát hiện các lỗ hổng kiến thức còn yếu (Weak Knowledge Diagnostic).
    3. Đề xuất trực tiếp các mục SGK cần ôn tập kèm hướng dẫn điều chỉnh.
    """
    exam_id = submission.get("exam_id")
    file_path = EXAMS_DIR / f"{exam_id}.json"
    if not file_path.exists():
        raise ValueError(f"Không tìm thấy đề kiểm tra: {exam_id}")

    with open(file_path, "r", encoding="utf-8") as f:
        exam_data = json.load(f)

    questions_map = {q["id"]: q for q in exam_data.get("questions", [])}
    answers = submission.get("answers", {})

    total_q = len(questions_map)
    correct_count = 0
    results_detail = []
    weak_topics: Dict[str, int] = {}
    recommendations = []

    for q_id, q_data in questions_map.items():
        user_choice = answers.get(q_id, "")
        correct_choice = q_data.get("dap_an_dung", "")
        is_correct = (user_choice == correct_choice)

        if is_correct:
            correct_count += 1
        else:
            muc = q_data.get("muc_sgk", "Kiến thức trọng tâm")
            weak_topics[muc] = weak_topics.get(muc, 0) + 1

        results_detail.append({
            "id": q_id,
            "cau_hoi": q_data.get("cau_hoi"),
            "lua_chon": q_data.get("lua_chon"),
            "user_choice": user_choice,
            "correct_choice": correct_choice,
            "is_correct": is_correct,
            "muc_sgk": q_data.get("muc_sgk"),
            "giai_thich_su_pham": q_data.get("giai_thich_su_pham") or "Đáp án chuẩn xác theo SGK.",
            "goi_y_khi_sai": q_data.get("goi_y_khi_sai") or f"Xem lại {q_data.get('muc_sgk')}"
        })

    score = round((correct_count / total_q) * 10, 1) if total_q > 0 else 0.0

    # Phân tích Sư phạm AI & Đề xuất ôn tập
    for topic, count in weak_topics.items():
        # Trích xuất số bài nếu có trong tiêu đề mục (ví dụ "Bài 1", "Mục 1")
        lesson_match = re.search(r"[Bb]ài\s*(\d+)", topic)
        lesson_id = int(lesson_match.group(1)) if lesson_match else 1

        recommendations.append({
            "lesson_id": lesson_id,
            "topic": topic,
            "mistakes_count": count,
            "advice": f"Em cần xem lại lý thuyết tại '{topic}'. Nắm chắc định nghĩa và ví dụ thực tế trong sách.",
            "action_text": f"Mở {topic} để ôn lại ngay"
        })

    # Đánh giá tổng quan theo phong cách Socrates
    if score >= 9.0:
        overall_comment = "Xuất sắc! Em đã nắm rất vững toàn bộ kiến thức trọng tâm của bài kiểm tra. Hãy tiếp tục phát huy nhé!"
    elif score >= 7.0:
        overall_comment = f"Khá tốt! Em đã làm đúng {correct_count}/{total_q} câu. Tuy nhiên vẫn còn một vài điểm cần củng cố lại như gợi ý bên dưới."
    elif score >= 5.0:
        overall_comment = f"Đạt yêu cầu ({score}/10). Em đã có nền tảng cơ bản nhưng các khái niệm phân biệt còn dễ bị nhầm lẫn. Hãy dành 10 phút đọc lại các mục được AI đề xuất nhé."
    else:
        overall_comment = f"Kết quả chưa như mong muốn ({score}/10). Đừng lo lắng, hãy mở lại các mục bài học SGK được gợi ý bên dưới để ôn tập lại cùng Thầy Socrates nhé!"

    evaluation = {
        "score": score,
        "total_questions": total_q,
        "correct_count": correct_count,
        "percentage": round((correct_count / total_q) * 100) if total_q > 0 else 0,
        "ai_evaluation": {
            "overall_comment": overall_comment,
            "weak_topics": weak_topics,
            "recommendations": recommendations
        },
        "details": results_detail,
        "submitted_at": datetime.now().isoformat()
    }

    # Lưu bài nộp vào thư mục submissions
    student_id = submission.get("student_id", "anonymous")
    sub_file = SUBMISSIONS_DIR / f"{exam_id}_{student_id}.json"
    with open(sub_file, "w", encoding="utf-8") as f:
        json.dump({**submission, "evaluation": evaluation}, f, ensure_ascii=False, indent=2)

    return evaluation
