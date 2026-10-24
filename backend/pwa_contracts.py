"""Bounded contracts for the student PWA. Private answer keys never serialize publicly."""
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


Identifier = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9_-]{0,63}$")]
Version = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
CourseIdentifier = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9_-]{0,63}-[6-9]$")]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class PrivateQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Identifier
    prompt: ShortText
    kind: Literal["choice", "text"] = "choice"
    options: dict[str, str] = Field(default_factory=dict, max_length=8)
    correct_answer: str = Field(default="", max_length=16)
    hint: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def validate_question(self):
        if self.kind == "text":
            if self.options or self.correct_answer:
                raise ValueError("Bài tự luận không dùng đáp án trắc nghiệm.")
        else:
            if not 2 <= len(self.options) <= 8 or self.correct_answer not in self.options:
                raise ValueError("Câu hỏi cần ít nhất hai lựa chọn và một đáp án hợp lệ.")
            for key, value in self.options.items():
                if not key.isascii() or not key.isalnum() or len(key) > 8:
                    raise ValueError("Mã lựa chọn không hợp lệ.")
                if not value.strip() or len(value) > 2000:
                    raise ValueError("Nội dung lựa chọn trống hoặc quá dài.")
        return self


class PublishLesson(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_id: Identifier
    subject_name: ShortText
    grade: int = Field(ge=6, le=9, strict=True)
    lesson_id: Identifier
    title: ShortText
    content_markdown: str = Field(min_length=1, max_length=200000)
    questions: list[PrivateQuestion] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_lesson(self):
        if not self.content_markdown.strip():
            raise ValueError("Nội dung bài học không được để trống.")
        ids = [question.id for question in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("Mỗi câu hỏi cần một mã riêng.")
        return self


class AttemptSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    attempt_id: UUID
    course_id: CourseIdentifier
    lesson_id: Identifier
    version: Version
    answers: dict[Identifier, Annotated[str, StringConstraints(max_length=10000)]] = Field(max_length=100)


class TutorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    course_id: CourseIdentifier
    lesson_id: Identifier
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    history: list[dict[str, str]] = Field(default_factory=list, max_length=20)
    question_id: Identifier | None = None
    selected_option: str | None = None
    attempt_count: int = Field(default=1, ge=1, le=10)


class TutorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str
    error: str | None = None

