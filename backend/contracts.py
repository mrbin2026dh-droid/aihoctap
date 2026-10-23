"""
Module Contracts: Khế ước Toán học & Định kiểu Chặt chẽ (Bend Proof-Driven Development)
Đảm bảo 100% dữ liệu đi qua hệ thống đều được kiểm chứng hình thức bằng Pydantic.
"""
from typing import Dict, List, Literal, Any, Optional, Union
from pydantic import BaseModel, Field, field_validator


class QuizItemContract(BaseModel):
    """Khế ước cho từng câu hỏi trắc nghiệm SGK."""
    id: str = Field(..., description="Mã định danh duy nhất của câu hỏi")
    cau_hoi: str = Field(..., min_length=5, description="Nội dung câu hỏi")
    lua_chon: Dict[str, str] = Field(..., description="Danh sách 4 lựa chọn A, B, C, D")
    dap_an_dung: Literal["A", "B", "C", "D"] = Field(..., description="Đáp án chuẩn xác")
    muc_sgk: str = Field(default="", description="Mục bài học trong SGK")
    trang_sgk: int = Field(default=0, ge=0, description="Trang sách giáo khoa")
    giai_thich_su_pham: str = Field(..., min_length=5, description="Lời giải thích sư phạm khi làm đúng")
    goi_y_khi_sai: str = Field(..., min_length=5, description="Lời gợi ý tư duy khi làm sai")
    forbidden_keywords: List[str] = Field(
        default_factory=list,
        description="Danh sách từ khóa đặc trưng cấm xuất hiện trong gợi ý Socratic"
    )
    source: Literal["extracted", "generated", "teacher_verified"] = Field(
        default="generated", 
        description="Nguồn gốc: extracted (trích xuất nguyên văn), generated (AI suy luận), teacher_verified (Giáo viên duyệt)"
    )
    grounding_verified: bool = Field(
        default=False, 
        description="Trạng thái so khớp nguồn xác định với văn bản SGK"
    )
    verified_by: Optional[str] = Field(
        default=None,
        description="Định danh người duyệt (ví dụ: 'teacher')"
    )
    verified_at: Optional[str] = Field(
        default=None,
        description="Thời điểm duyệt ISO 8601"
    )

    @field_validator("lua_chon")
    @classmethod
    def validate_choices(cls, v: Dict[str, str]) -> Dict[str, str]:
        required_keys = {"A", "B", "C", "D"}
        if set(v.keys()) != required_keys:
            raise ValueError(f"Lựa chọn trắc nghiệm phải chứa đầy đủ 4 khóa: A, B, C, D (Hiện tại: {list(v.keys())})")
        for k, text in v.items():
            if not text or len(text.strip()) == 0:
                raise ValueError(f"Nội dung lựa chọn {k} không được để trống")
        return v


class LessonContract(BaseModel):
    """Khế ước cho một bài học SGK số hóa."""
    grade: int = Field(..., ge=6, le=9, description="Khối lớp (6 đến 9)")
    lesson_id: int = Field(..., ge=1, description="Số thứ tự bài học")
    title: str = Field(..., min_length=3, description="Tiêu đề bài học")
    content_markdown: str = Field(..., min_length=50, description="Nội dung lý thuyết dạng Markdown")
    quiz: List[QuizItemContract] = Field(default_factory=list, description="Bộ câu hỏi trắc nghiệm")

    @field_validator("content_markdown")
    @classmethod
    def validate_markdown_structure(cls, v: str) -> str:
        if not v.startswith("# "):
            raise ValueError("Nội dung bài học Markdown bắt buộc phải bắt đầu bằng tiêu đề cấp 1 (# )")
        if "## " not in v:
            raise ValueError("Nội dung bài học Markdown phải có ít nhất một tiêu đề phân mục cấp 2 (## )")
        return v


class ChatHistoryItem(BaseModel):
    """Một lượt hội thoại trong lịch sử chat, chặn đứng giả mạo role system/developer."""
    role: Literal["user", "assistant"] = Field(..., description="Chỉ chấp nhận user hoặc assistant")
    content: str = Field(..., min_length=1, max_length=2000)


class ChatContext(BaseModel):
    """Ngữ cảnh học tập thời gian thực của học sinh khi trò chuyện với Gia sư Socrates."""
    current_question_id: Optional[str] = Field(
        default=None,
        pattern=r"^[a-zA-Z0-9_-]{1,64}$",
        description="Mã câu hỏi trắc nghiệm hiện tại (chỉ gồm chữ, số, gạch dưới/ngang)"
    )
    student_choice: Optional[Literal["A", "B", "C", "D"]] = Field(
        default=None,
        description="Lựa chọn vừa chọn của học sinh (chỉ nhận A, B, C, D)"
    )
    is_correct: Optional[bool] = Field(default=None, description="Kết quả chấm phương án vừa chọn")
    last_action: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Hành động gần nhất"
    )
    active_tab: Optional[Literal["quiz", "theory", "dashboard", "exam"]] = Field(
        default="quiz",
        description="Tab đang mở: quiz, theory, dashboard hoặc exam"
    )
    attempt_count: int = Field(
        default=1,
        ge=1,
        le=3,
        description="Số lần học sinh đã thử trả lời câu hỏi hiện tại (tối đa 3 tầng giàn giáo)"
    )

    @field_validator("active_tab", mode="before")
    @classmethod
    def normalize_active_tab(cls, v: Any) -> str:
        if not v:
            return "quiz"
        v_str = str(v).strip().lower()
        if v_str in {"quiz", "theory", "dashboard", "exam"}:
            return v_str
        return "quiz"

    @field_validator("attempt_count", mode="before")
    @classmethod
    def sanitize_attempt_count(cls, v: Any) -> int:
        try:
            val = int(v)
            return max(1, min(val, 3))
        except (ValueError, TypeError):
            return 1

    @field_validator("student_choice", mode="before")
    @classmethod
    def normalize_choice(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            v = v.strip().upper()
            return v if v in {"A", "B", "C", "D"} else None
        return None


def parse_safe_grade(grade_input: Any, default_grade: int = 9) -> int:
    """Chuyển đổi an toàn bất kỳ định dạng grade (str, int, 'all') thành số nguyên hợp lệ trong khoảng [6, 9]."""
    if grade_input is None:
        return default_grade
    s = str(grade_input).strip().lower()
    if s in {"all", "tatca", "*"}:
        return default_grade
    try:
        val = int(s)
        if 6 <= val <= 9:
            return val
    except (ValueError, TypeError):
        pass
    return default_grade


class ChatRequest(BaseModel):
    """Khế ước cho yêu cầu hỏi đáp của học sinh."""
    grade: Union[int, str] = Field(default=9, description="Khối lớp (6-9)")
    lesson_id: int = Field(default=1, ge=1)
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[ChatContext] = Field(default=None, description="Ngữ cảnh học tập hiện tại")
    history: List[Dict[str, str]] = Field(
        default_factory=list,
        max_length=10,
        description="Tối đa 10 lượt hội thoại gần nhất"
    )

    @field_validator("grade", mode="before")
    @classmethod
    def sanitize_grade(cls, v: Any) -> int:
        return parse_safe_grade(v, default_grade=9)

    @field_validator("history")
    @classmethod
    def sanitize_history(cls, v: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Lọc bỏ các role bất hợp lệ (như system) và cắt giới hạn độ dài an toàn."""
        sanitized = []
        for item in v[-10:]:
            role = str(item.get("role", "user")).strip().lower()
            if role not in {"user", "assistant"}:
                role = "user"
            content = str(item.get("content", "")).strip()[:2000]
            if content:
                sanitized.append({"role": role, "content": content})
        return sanitized


ChatRequestContract = ChatRequest


class QuizSubmissionContract(BaseModel):
    """Khế ước cho bài nộp trắc nghiệm của học sinh."""
    grade: int = Field(..., ge=6, le=9)
    lesson_id: int = Field(..., ge=1)
    answers: Dict[str, str] = Field(..., description="Bảng câu trả lời {qid: choice}")


class LessonBlockPackageContract(BaseModel):
    """Khế ước cho gói bài học động định dạng khối (Data-driven Block Architecture)."""
    schema_version: str = Field(default="2.0", description="Phiên bản schema")
    grade: int = Field(..., ge=6, le=9, description="Khối lớp (6-9)")
    lesson_id: int = Field(..., ge=1, description="Số thứ tự bài học")
    title: str = Field(..., min_length=2, description="Tiêu đề bài học")
    status: Literal["draft", "published"] = Field(default="draft", description="Trạng thái: draft (nháp chưa duyệt), published (đã duyệt công khai)")
    source_file: Optional[str] = Field(default=None, description="Tên tệp nguồn PDF/Word đã bóc tách")
    extracted_pages: List[int] = Field(default_factory=list, description="Danh sách trang SGK được bóc tách")
    updated_at: str = Field(default="", description="Thời điểm cập nhật ISO")
    note: Optional[str] = Field(default=None, description="Ghi chú tình trạng kiểm chứng/đối chiếu bài học")
    blocks: List[Dict[str, Any]] = Field(default_factory=list, description="Danh sách các khối nội dung sư phạm")
    quiz: List[QuizItemContract] = Field(default_factory=list, description="Ngân hàng câu hỏi trắc nghiệm")


class TeacherVerifyQuizRequest(BaseModel):
    """Khế ước cho hành động duyệt câu hỏi trắc nghiệm từ Giáo viên."""
    grade: int = Field(..., ge=6, le=9)
    lesson_id: int = Field(..., ge=1)
    quiz_id: str = Field(..., min_length=1)
    action: Literal["verify", "unverify"] = Field(
        default="verify", 
        description="Hành động: 'verify' (duyệt) hoặc 'unverify' (hủy duyệt)"
    )


class TopicMasteryStatus(BaseModel):
    """Khế ước mức độ thành thạo của học sinh theo từng chủ đề."""
    topic_id: str = Field(..., description="Mã định danh chủ đề")
    topic_name: str = Field(..., description="Tên chủ đề tiếng Việt")
    score: float = Field(..., ge=0.0, le=10.0, description="Điểm trung bình của chủ đề (thang 10)")
    status: Literal["mastered", "warning", "not_started"] = Field(
        ..., 
        description="Trạng thái: mastered (thành thạo - xanh), warning (cần chú ý - vàng), not_started (chưa học - xám)"
    )


class StudentOverviewItem(BaseModel):
    """Khế ước thông tin học sinh trong bảng quản lý lớp."""
    id: str = Field(..., description="ID định danh học sinh")
    student_code: str = Field(..., description="Mã học sinh (ví dụ: HS001)")
    full_name: str = Field(..., min_length=2, description="Họ và tên học sinh")
    avatar_url: Optional[str] = Field(default=None, description="Đường dẫn ảnh đại diện")
    progress_percent: int = Field(..., ge=0, le=100, description="Tiến độ học tập tổng thể (%)")
    average_score: float = Field(..., ge=0.0, le=10.0, description="Điểm trung bình luyện tập")
    topics: List[TopicMasteryStatus] = Field(default_factory=list, description="Mức độ thành thạo theo 5 chủ đề")
    status: Literal["completed", "learning", "needs_support"] = Field(
        ..., 
        description="Trạng thái: completed (hoàn thành), learning (đang học), needs_support (cần hỗ trợ)"
    )


class ClassKPIMetrics(BaseModel):
    """Khế ước 5 chỉ số KPI tổng quan lớp học."""
    total_students: int = Field(..., ge=0, description="Tổng số học sinh (Sĩ số)")
    completed_count: int = Field(..., ge=0, description="Số học sinh đã hoàn thành bài")
    completed_percent: float = Field(..., ge=0.0, le=100.0, description="Tỷ lệ hoàn thành (%)")
    average_score: float = Field(..., ge=0.0, le=10.0, description="Điểm trung bình cả lớp")
    score_delta_month: float = Field(default=0.0, description="Độ tăng/giảm điểm so với tháng trước")
    improved_count: int = Field(..., ge=0, description="Số học sinh có tiến bộ")
    improved_percent: float = Field(..., ge=0.0, le=100.0, description="Tỷ lệ học sinh tiến bộ (%)")
    needs_support_count: int = Field(..., ge=0, description="Số học sinh cần hỗ trợ thêm")
    needs_support_percent: float = Field(..., ge=0.0, le=100.0, description="Tỷ lệ học sinh cần hỗ trợ (%)")


class ClassAnalyticsResponse(BaseModel):
    """Khế ước toàn bộ dữ liệu Dashboard quản lý học sinh theo lớp."""
    grade: int = Field(..., ge=6, le=9)
    class_name: str = Field(..., min_length=1)
    semester: str = Field(default="Học kì I (2026 - 2027)")
    kpi: ClassKPIMetrics
    topic_averages: Dict[str, float] = Field(
        default_factory=dict, 
        description="Điểm trung bình cả lớp theo 5 chủ đề"
    )
    donut_progress: Dict[str, int] = Field(
        default_factory=dict, 
        description="Phân bổ Donut: completed, learning, not_started"
    )
    students: List[StudentOverviewItem] = Field(
        default_factory=list, 
        description="Danh sách chi tiết học sinh"
    )


class AIPedagogicalAdviceRequest(BaseModel):
    """Khế ước yêu cầu AI phân tích sư phạm."""
    grade: int = Field(..., ge=6, le=9)
    class_name: str = Field(..., min_length=1)


class AIPedagogicalAdviceResponse(BaseModel):
    """Khế ước kết quả phân tích sư phạm từ Gemini AI."""
    general_assessment: str = Field(..., description="Đánh giá tổng quan tiến độ và điểm số")
    critical_concerns: str = Field(..., description="Cảnh báo số học sinh cần hỗ trợ và chủ đề bị hổng")
    actionable_recommendations: List[str] = Field(
        ..., 
        min_length=1, 
        description="Danh sách các hành động sư phạm khuyến nghị cho giáo viên"
    )



