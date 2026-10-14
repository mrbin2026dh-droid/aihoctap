"""
FastAPI Server: Cung cấp API cho hệ thống Web Tự học Tin học THCS
Tích hợp Google ADK Grounded Agent và giao diện Sân khấu học tập.
"""
from pathlib import Path
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.grounding import load_lesson_data
from backend.agent import chat_with_tutor, grade_quiz_submission

app = FastAPI(
    title="Hệ thống AI Agent SGK Tin học THCS",
    description="Nền tảng tự học Tin học 6-9 tích hợp Gia sư Socrates Google ADK",
    version="1.0.0"
)

# Cấu hình CORS để web gọi API dễ dàng
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


class ChatRequest(BaseModel):
    grade: int
    lesson_id: int
    message: str
    history: List[Dict[str, str]] = []


class GradeQuizRequest(BaseModel):
    grade: int
    lesson_id: int
    answers: Dict[str, str]


@app.get("/api/lesson/{grade}/{lesson_id}")
def get_lesson(grade: int, lesson_id: int):
    """Lấy nội dung bài học SGK và bộ trắc nghiệm (đã giấu đáp án đúng để chống gian lận F12)."""
    try:
        data = load_lesson_data(grade, lesson_id)
        # Giấu 'dap_an_dung' và 'giai_thich_su_pham' khi gửi về trình duyệt học sinh
        safe_quiz = []
        for q in data["quiz"]:
            safe_quiz.append({
                "id": q["id"],
                "cau_hoi": q["cau_hoi"],
                "lua_chon": q["lua_chon"],
                "muc_sgk": q.get("muc_sgk", "")
            })
        
        return {
            "success": True,
            "grade": data["grade"],
            "lesson_id": data["lesson_id"],
            "title": data["title"],
            "content_markdown": data["content_markdown"],
            "quiz": safe_quiz
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/chat")
def handle_chat(req: ChatRequest):
    """Xử lý hội thoại hỏi đáp với Gia sư Socrates AI."""
    try:
        lesson_data = load_lesson_data(req.grade, req.lesson_id)
        reply = chat_with_tutor(
            grade=req.grade,
            lesson_id=req.lesson_id,
            message=req.message,
            history=req.history,
            curriculum_text=lesson_data["content_markdown"]
        )
        return {
            "success": True,
            "reply": reply
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI: {str(e)}")


@app.post("/api/grade-quiz")
def handle_grade_quiz(req: GradeQuizRequest):
    """Chấm điểm trắc nghiệm bài học và trả về nhận xét sư phạm thông minh."""
    try:
        lesson_data = load_lesson_data(req.grade, req.lesson_id)
        evaluation = grade_quiz_submission(req.answers, lesson_data["quiz"])
        return {
            "success": True,
            "evaluation": evaluation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi chấm điểm: {str(e)}")


# Phục vụ giao diện Frontend tĩnh
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="127.0.0.1", port=8000, reload=True)
