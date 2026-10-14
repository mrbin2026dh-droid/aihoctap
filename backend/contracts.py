"""
Module Contracts: Khế ước Toán học & Định kiểu Chặt chẽ (Bend Proof-Driven Development)
Đảm bảo 100% dữ liệu đi qua hệ thống đều được kiểm chứng hình thức bằng Pydantic.
"""
from typing import Dict, List, Literal
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


class ChatRequestContract(BaseModel):
    """Khế ước cho yêu cầu hỏi đáp của học sinh."""
    grade: int = Field(..., ge=6, le=9)
    lesson_id: int = Field(..., ge=1)
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[Dict[str, str]] = Field(default_factory=list)


class QuizSubmissionContract(BaseModel):
    """Khế ước cho bài nộp trắc nghiệm của học sinh."""
    grade: int = Field(..., ge=6, le=9)
    lesson_id: int = Field(..., ge=1)
    answers: Dict[str, str] = Field(..., description="Bảng câu trả lời {qid: choice}")
