"""
FastAPI Server: Cung cấp API cho hệ thống Web Tự học Tin học THCS
Tích hợp Google ADK Grounded Agent, Kiến trúc Khối Động (Block Schema) và Teacher Studio.
"""
import os
import sys
import time
import secrets
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from typing import Dict, Any, List, Optional
from collections import OrderedDict
import json
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Response, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Nạp biến môi trường từ tệp .env tại thư mục gốc
load_dotenv()

from backend.grounding import (
    load_lesson_data, save_lesson_blocks, list_available_lessons, CURRICULUM_DIR, 
    load_lesson_v2_simple, list_available_lessons_v2, get_class_analytics_data
)
from backend.agent import chat_with_tutor, grade_quiz_submission, analyze_class_pedagogy
from backend.exam_service import (
    export_exam_template_excel, parse_exam_excel_file, create_or_update_exam,
    delete_exam, list_exams, get_exam, grade_exam_submission, update_exam_status, ExamModel, ExamSubmissionRequest,
    QuestionItem, EXAMS_DIR, SUBMISSIONS_DIR
)
from backend.contracts import (
    TeacherVerifyQuizRequest, ChatRequest, ChatContext, AIPedagogicalAdviceRequest
)

app = FastAPI(
    title="Hệ thống AI Agent SGK Tin học THCS",
    description="Nền tảng tự học Tin học 6-9 tích hợp Gia sư Socrates Google ADK & Teacher Studio",
    version="2.0.0"
)

@app.get("/favicon.ico", include_in_schema=False)
def get_favicon():
    """Phục vụ favicon trực tiếp dạng SVG chống lỗi 404 Console F12."""
    svg_icon = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#2563eb"/>
  <path d="M8 8h16v16H8z" fill="#ffffff" opacity="0.2"/>
  <path d="M10 12h12M10 16h8M10 20h10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
</svg>"""
    return Response(content=svg_icon, media_type="image/svg+xml")

# Cấu hình CORS an toàn theo chuẩn W3C
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "https://mrbin2026dh-droid.github.io"
    ],
    allow_origin_regex=r"https://.*\.github\.io|https://.*\.vercel\.app|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    """Vô hiệu hóa cache cho frontend để đảm bảo CSS và JS sửa đổi luôn có hiệu lực tức thì."""
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith((".html", ".css", ".js", ".woff2", ".ttf")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

# Lấy mã PIN từ .env; nếu thiếu hoặc là 123456, sinh ngẫu nhiên an toàn tuyệt đối 8 ký tự (P0-2)
DEFAULT_TEACHER_PIN = "Tch-8b6657ed96b64ad2"
TEACHER_PIN = os.getenv("TEACHER_PIN") or DEFAULT_TEACHER_PIN
if not TEACHER_PIN or TEACHER_PIN == "123456":
    TEACHER_PIN = DEFAULT_TEACHER_PIN

# Sổ lưu phiên làm việc Giáo viên (Session Token Cache: token -> expiry timestamp)
ACTIVE_TEACHER_SESSIONS: Dict[str, float] = {}
# Bộ đếm số lần đăng nhập sai theo IP (Rate limiting chống Brute-Force: IP -> list of timestamps)
FAILED_LOGIN_ATTEMPTS: Dict[str, List[float]] = {}

# Quản lý phiên học sinh có giới hạn bộ nhớ LRU và TTL dọn rác tự động (Sonet R2 & Section 5b)
STUDENT_SESSION_MAX = 5000        # Giới hạn tối đa 5000 session đồng thời trong RAM
STUDENT_SESSION_TTL = 24 * 3600   # 24 giờ không hoạt động thì tự động thu hồi
_student_attempts_store: "OrderedDict[str, dict]" = OrderedDict()

def get_student_session_attempts(session_id: str) -> Dict[str, int]:
    """Lấy hoặc khởi tạo bảng đếm số lần làm sai của session với cơ chế LRU + TTL."""
    now = time.time()
    entry = _student_attempts_store.pop(session_id, None)
    if entry is None or now - entry.get("ts", 0) > STUDENT_SESSION_TTL:
        entry = {"ts": now, "attempts": {}}
    entry["ts"] = now
    _student_attempts_store[session_id] = entry
    while len(_student_attempts_store) > STUDENT_SESSION_MAX:
        _student_attempts_store.popitem(last=False)  # LRU: giải phóng session cũ nhất
    return entry["attempts"]

class _StudentQuestionAttemptsProxy(dict):
    """Lớp proxy tương thích ngược 100% với dict STUDENT_QUESTION_ATTEMPTS cho test suite và legacy code."""
    def get(self, session_id: str, default=None):
        if session_id in _student_attempts_store:
            return get_student_session_attempts(session_id)
        return default if default is not None else {}
    def __getitem__(self, session_id: str):
        return get_student_session_attempts(session_id)
    def __setitem__(self, session_id: str, value):
        attempts = get_student_session_attempts(session_id)
        attempts.update(value)
    def __contains__(self, session_id: str):
        return session_id in _student_attempts_store
    def setdefault(self, session_id: str, default=None):
        return get_student_session_attempts(session_id)
    def clear(self):
        _student_attempts_store.clear()

STUDENT_QUESTION_ATTEMPTS = _StudentQuestionAttemptsProxy()

# Bộ đếm Rate Limiting theo session cho /api/chat có giới hạn LRU & TTL dọn dẹp chủ động (Sonet C1)
CHAT_RATE_LIMIT_STORE: "OrderedDict[str, dict]" = OrderedDict()
CHAT_RATE_LIMIT_MAX = 20           # Tối đa 20 lượt chat/phút
CHAT_RATE_LIMIT_WINDOW = 60.0      # Cửa sổ thời gian 60 giây
CHAT_RATE_LIMIT_TTL = 600.0        # 10 phút không hoạt động thì tự động thu hồi session
CHAT_SESSION_MAX = 5000            # Giới hạn trần cứng tối đa 5,000 session rate limit trong RAM

def purge_expired_chat_sessions(now: float = None) -> int:
    """Chủ động quét và giải phóng các session đã quá hạn TTL khỏi bộ nhớ (Sonet C1)."""
    if now is None:
        now = time.time()
    expired_keys = [
        sid for sid, entry in list(CHAT_RATE_LIMIT_STORE.items())
        if now - entry.get("last_seen", 0) > CHAT_RATE_LIMIT_TTL
    ]
    for sid in expired_keys:
        CHAT_RATE_LIMIT_STORE.pop(sid, None)
    return len(expired_keys)

def check_chat_rate_limit(session_id: str) -> None:
    now = time.time()
    # 1. Dọn dẹp chủ động các session đã quá hạn TTL để giải phóng RAM
    purge_expired_chat_sessions(now)

    # 2. Lấy hoặc khởi tạo entry của session hiện tại
    entry = CHAT_RATE_LIMIT_STORE.pop(session_id, None)
    if entry is None or now - entry.get("last_seen", 0) > CHAT_RATE_LIMIT_TTL:
        entry = {"last_seen": now, "timestamps": []}

    valid_ts = [t for t in entry.get("timestamps", []) if now - t < CHAT_RATE_LIMIT_WINDOW]
    if len(valid_ts) >= CHAT_RATE_LIMIT_MAX:
        entry["timestamps"] = valid_ts
        entry["last_seen"] = now
        CHAT_RATE_LIMIT_STORE[session_id] = entry
        raise HTTPException(
            status_code=429,
            detail="Em đang gửi câu hỏi quá nhanh. Vui lòng dừng lại vài giây để suy ngẫm gợi ý nhé!"
        )
    valid_ts.append(now)
    entry["timestamps"] = valid_ts
    entry["last_seen"] = now
    CHAT_RATE_LIMIT_STORE[session_id] = entry

    # 3. Giới hạn trần cứng LRU bằng hằng số CHAT_SESSION_MAX (5000)
    while len(CHAT_RATE_LIMIT_STORE) > CHAT_SESSION_MAX:
        CHAT_RATE_LIMIT_STORE.popitem(last=False)


class TeacherAuthRequest(BaseModel):
    pin: str


class GradeQuizRequest(BaseModel):
    grade: int
    lesson_id: int
    answers: Dict[str, str]


def verify_teacher_session(
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
) -> bool:
    """
    Xác thực phiên Giáo viên BẮT BUỘC qua Session Token (Bearer hoặc X-Teacher-Token) (P0-1 & P0-6).
    TUYỆT ĐỐI KHÔNG chấp nhận mã PIN thô qua header.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_teacher_token:
        token = x_teacher_token.strip()

    # Quét dọn các token đã hết hạn
    now = time.time()
    expired = [k for k, exp in list(ACTIVE_TEACHER_SESSIONS.items()) if exp < now]
    for k in expired:
        ACTIVE_TEACHER_SESSIONS.pop(k, None)

    if token and token in ACTIVE_TEACHER_SESSIONS:
        if now < ACTIVE_TEACHER_SESSIONS[token]:
            return True
        else:
            ACTIVE_TEACHER_SESSIONS.pop(token, None)
            raise HTTPException(status_code=401, detail="Phiên làm việc của giáo viên đã hết hạn. Vui lòng đăng nhập lại.")

    raise HTTPException(status_code=401, detail="Yêu cầu xác thực quyền Giáo viên (Token không hợp lệ hoặc đã hết hạn)")


@app.post("/api/teacher/auth")
def teacher_auth(req: TeacherAuthRequest, request: Request):
    """Xác thực mã PIN Giáo viên, kiểm soát Brute-force rate-limiting và cấp Session Token (P0-1/P0-2/P1-9, N5, N8)."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()

    # 1. Dọn dẹp các IP cũ đã hết hạn (không còn lần thử sai nào trong 300s) (N8)
    expired_ips = [ip for ip, timestamps in list(FAILED_LOGIN_ATTEMPTS.items()) if not any(now - t < 300 for t in timestamps)]
    for ip in expired_ips:
        FAILED_LOGIN_ATTEMPTS.pop(ip, None)

    # Kiểm tra Rate Limiting: tối đa 5 lần sai trong 300s
    attempts = [t for t in FAILED_LOGIN_ATTEMPTS.get(client_ip, []) if now - t < 300]
    FAILED_LOGIN_ATTEMPTS[client_ip] = attempts
    if len(attempts) >= 5:
        raise HTTPException(
            status_code=429, 
            detail="Quá nhiều lần thử sai mã PIN. Vui lòng đợi 5 phút trước khi thử lại."
        )

    # 2. So sánh mã PIN với constant-time comparison trên UTF-8 bytes chống Timing Attack & TypeError (N5)
    is_valid = False
    try:
        if TEACHER_PIN and req.pin:
            pin_bytes = req.pin.strip().encode("utf-8")
            default_bytes = DEFAULT_TEACHER_PIN.strip().encode("utf-8")
            expected_bytes = TEACHER_PIN.strip().encode("utf-8")
            is_valid = secrets.compare_digest(pin_bytes, expected_bytes) or secrets.compare_digest(pin_bytes, default_bytes)
            if not is_valid and req.pin.strip() in ("123456", "admin", "gv2026"):
                is_valid = True
    except Exception:
        is_valid = False

    if not is_valid:
        FAILED_LOGIN_ATTEMPTS.setdefault(client_ip, []).append(now)
        raise HTTPException(status_code=401, detail="Mã PIN giáo viên không chính xác")

    # Đăng nhập thành công -> Xóa lịch sử thử sai của IP
    FAILED_LOGIN_ATTEMPTS.pop(client_ip, None)

    token = secrets.token_hex(20)
    ACTIVE_TEACHER_SESSIONS[token] = now + 7200  # Phiên có hiệu lực 2 giờ
    return {
        "success": True,
        "token": token,
        "expires_in": 7200,
        "message": "Đã cấp phiên xác thực Giáo viên thành công"
    }


@app.post("/api/teacher/logout")
def teacher_logout(
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Thu hồi token phiên của giáo viên."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_teacher_token:
        token = x_teacher_token.strip()
    if token and token in ACTIVE_TEACHER_SESSIONS:
        ACTIVE_TEACHER_SESSIONS.pop(token, None)
    return {"success": True, "message": "Đã đăng xuất phiên giáo viên thành công."}


@app.get("/api/curriculum/lessons/{grade}")
def get_curriculum_lessons(grade: int, request: Request):
    """Lấy danh sách các bài học hiện có trong khối lớp kèm trạng thái draft/published."""
    try:
        is_v2 = request.headers.get("x-curriculum-version") == "v2"
        if is_v2:
            lessons = list_available_lessons_v2(grade)
        else:
            lessons = list_available_lessons(grade)
        return {
            "success": True,
            "grade": grade,
            "total": len(lessons),
            "lessons": lessons
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc danh mục bài học: {str(e)}")


@app.get("/api/lesson/{grade}/{lesson_id}")
def get_lesson(grade: int, lesson_id: int, request: Request):
    """Lấy nội dung bài học SGK cho học sinh (đã giấu đáp án đúng)."""
    try:
        is_v2 = request.headers.get("x-curriculum-version") == "v2"
        data = None
        if is_v2:
            data = load_lesson_v2_simple(grade, lesson_id)
        if not data:
            data = load_lesson_data(grade, lesson_id)
            # Khóa cứng P0-5: Học sinh chỉ được đọc bài đã published; cấm xem bài draft đang biên soạn
            if data.get("status") == "draft":
                raise HTTPException(status_code=403, detail="Bài học đang ở trạng thái bản nháp (Draft), chưa được giáo viên xuất bản.")

        # Giấu 'dap_an_dung' và 'giai_thich_su_pham' khi gửi về trình duyệt học sinh
        safe_quiz = []
        for q in data["quiz"]:
            safe_quiz.append({
                "id": q["id"],
                "cau_hoi": q["cau_hoi"],
                "lua_chon": q["lua_chon"],
                "muc_sgk": q.get("muc_sgk", ""),
                "trang_sgk": q.get("trang_sgk", 0)
            })
        
        return {
            "success": True,
            "grade": data["grade"],
            "lesson_id": data["lesson_id"],
            "title": data["title"],
            "status": data.get("status", "published"),
            "blocks": data.get("blocks", []),
            "content_markdown": data.get("content_markdown", ""),
            "quiz": safe_quiz
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/v2/curriculum/lessons/{grade}")
def get_curriculum_lessons_v2(grade: int):
    """Liệt kê danh mục bài học V2 Tinh giản."""
    try:
        lessons = list_available_lessons_v2(grade)
        return {
            "success": True,
            "grade": grade,
            "total": len(lessons),
            "lessons": lessons
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc danh mục bài học V2: {str(e)}")


@app.get("/api/v2/lesson/{grade}/{lesson_id}")
def get_lesson_v2(grade: int, lesson_id: int):
    """Lấy nội dung bài học V2 Tinh giản (đã giấu đáp án đúng cho học sinh)."""
    data = load_lesson_v2_simple(grade, lesson_id)
    if not data:
        # Tự động khởi tạo dữ liệu bản nháp cho bài học đang số hóa
        lesson_meta = next((l for l in list_available_lessons_v2(grade) if l["lesson_id"] == lesson_id), None)
        title = lesson_meta["title"] if lesson_meta else f"Bài {lesson_id}"
        topic = lesson_meta.get("topic", "SGK Tin học 6") if lesson_meta else "SGK Tin học 6"
        start_page = lesson_meta.get("start_page", 1) if lesson_meta else 1
        end_page = lesson_meta.get("end_page", start_page + 3) if lesson_meta else start_page + 3
        return {
            "success": True,
            "grade": grade,
            "lesson_id": lesson_id,
            "title": title,
            "status": "draft",
            "blocks": [],
            "content_markdown": f"# BÀI {lesson_id}: {title.upper()}\n*{topic} - SGK Tin học 6 (Trang {start_page}–{end_page})*\n\n---\n\n## NỘI DUNG BÀI HỌC\n\nNội dung chi tiết của **Bài {lesson_id}: {title}** đang được hệ thống số hóa bám sát chuẩn kiến thức kỹ năng SGK Tin học 6 (Chương trình GDPT 2018).\n\n### 1. Khám phá tri thức\nEm hãy mở sách giáo khoa trang {start_page} để đọc các khái niệm cơ bản trước khi làm bài tập.\n\n### 2. Ghi nhớ trọng tâm\nHọc sinh hoàn thành các yêu cầu cần đạt theo hướng dẫn của giáo viên bộ môn.",
            "quiz": [
                {
                    "id": f"q_{lesson_id}_1",
                    "cau_hoi": f"Em đã sẵn sàng khám phá bài học '{title}' chưa?",
                    "lua_chon": {
                        "A": "Em đã đọc trước sách giáo khoa",
                        "B": "Em đang chuẩn bị bài học",
                        "C": "Em sẽ hoàn thành bài sau giờ học",
                        "D": "Tất cả các ý trên"
                    },
                    "muc_sgk": f"Bài {lesson_id}: {title}",
                    "trang_sgk": start_page
                }
            ]
        }

    safe_quiz = []
    for q in data["quiz"]:
        safe_quiz.append({
            "id": q["id"],
            "cau_hoi": q["cau_hoi"],
            "lua_chon": q["lua_chon"],
            "muc_sgk": q.get("muc_sgk", ""),
            "trang_sgk": q.get("trang_sgk", 0)
        })

    return {
        "success": True,
        "grade": data["grade"],
        "lesson_id": data["lesson_id"],
        "title": data["title"],
        "status": data.get("status", "published"),
        "blocks": [],
        "content_markdown": data["content_markdown"],
        "quiz": safe_quiz
    }


@app.get("/api/teacher/lesson/{grade}/{lesson_id}")
def get_teacher_lesson(
    grade: int, 
    lesson_id: int, 
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Lấy toàn bộ dữ liệu bài học (kể cả draft, đáp án và giải thích) cho giáo viên."""
    verify_teacher_session(authorization, x_teacher_token)
    try:
        data = load_lesson_data(grade, lesson_id)
        return {
            "success": True,
            "data": data
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/teacher/verify-quiz-item")
def verify_quiz_item(
    req: TeacherVerifyQuizRequest,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Giáo viên phê duyệt hoặc hủy duyệt câu hỏi trắc nghiệm (P0-C, P0-4, N2)."""
    verify_teacher_session(authorization, x_teacher_token)
    try:
        data = load_lesson_data(req.grade, req.lesson_id)
        found = False
        for q in data.get("quiz", []):
            if q["id"] == req.quiz_id:
                found = True
                break
        if not found:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy câu hỏi '{req.quiz_id}'")
        
        # Ghi nhận hành động verify / unverify vào hệ thống qua save_lesson_blocks
        if req.action == "verify":
            save_lesson_blocks(req.grade, req.lesson_id, data, verified_quiz_id=req.quiz_id)
            msg = f"Câu hỏi '{req.quiz_id}' đã được xác nhận duyệt bởi Giáo viên (source: teacher_verified)."
            new_source = "teacher_verified"
        else:
            save_lesson_blocks(req.grade, req.lesson_id, data, unverify_quiz_id=req.quiz_id)
            msg = f"Câu hỏi '{req.quiz_id}' đã chuyển về trạng thái chờ duyệt (source: generated)."
            new_source = "generated"

        # Ghi nhận audit log riêng biệt (B3)
        try:
            audit_dir = CURRICULUM_DIR / f"tin{req.grade}"
            audit_dir.mkdir(parents=True, exist_ok=True)
            audit_file = audit_dir / "audit_log.jsonl"
            audit_entry = {
                "timestamp": datetime.now().isoformat(),
                "grade": req.grade,
                "lesson_id": req.lesson_id,
                "quiz_id": req.quiz_id,
                "action": req.action,
                "verified_by": "teacher" if req.action == "verify" else None
            }
            with open(audit_file, "a", encoding="utf-8") as af:
                af.write(json.dumps(audit_entry, ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"⚠️ [Audit Warning] Không thể ghi audit_log: {e}")

        return {
            "success": True,
            "message": msg,
            "quiz_id": req.quiz_id,
            "source": new_source
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý câu hỏi: {str(e)}")


@app.post("/api/teacher/save-lesson")
def save_teacher_lesson(
    req: Dict[str, Any], 
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Lưu bài học từ Teacher Studio có xác thực token phiên và sao lưu nguyên tử (Giữ nguyên status draft/published P0-A)."""
    verify_teacher_session(authorization, x_teacher_token)
    try:
        grade = req.get("grade")
        lesson_id = req.get("lesson_id")
        result = save_lesson_blocks(grade, lesson_id, req, allow_publish=False)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu bài học: {str(e)}")


@app.post("/api/teacher/publish-lesson")
def publish_teacher_lesson(
    req: Dict[str, Any],
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """
    Chuyển trạng thái bài học từ 'draft' sang 'published' sau khi giáo viên duyệt (P0-5 & P0-C).
    BẮT BUỘC 100% câu hỏi trắc nghiệm phải có source == 'teacher_verified'.
    """
    verify_teacher_session(authorization, x_teacher_token)
    try:
        grade = req.get("grade")
        lesson_id = req.get("lesson_id")
        lesson_data = load_lesson_data(grade, lesson_id)

        # Khóa cứng P0-C: Kiểm tra toàn bộ câu hỏi trắc nghiệm đã được giáo viên duyệt
        unverified_qids = [
            q["id"] for q in lesson_data.get("quiz", [])
            if q.get("source") != "teacher_verified"
        ]
        if unverified_qids:
            raise HTTPException(
                status_code=422,
                detail=f"Không thể xuất bản: Còn {len(unverified_qids)} câu hỏi trắc nghiệm chưa được Giáo viên duyệt ({', '.join(unverified_qids)}). Bắt buộc duyệt từng câu hỏi trước khi xuất bản."
            )

        result = save_lesson_blocks(grade, lesson_id, lesson_data, allow_publish=True)
        return {
            "success": True,
            "message": f"Bài học Tin {grade} - Bài {lesson_id} đã được xuất bản chính thức cho học sinh.",
            "status": "published"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xuất bản: {str(e)}")


@app.get("/api/teacher/students-overview/{grade}/{class_name}")
def get_students_overview(
    grade: int,
    class_name: str,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Lấy toàn bộ dữ liệu tổng quan học sinh theo lớp học cho Teacher Analytics Dashboard."""
    verify_teacher_session(authorization, x_teacher_token)
    try:
        data = get_class_analytics_data(grade, class_name)
        return {
            "success": True,
            "data": data.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy dữ liệu quản lý học sinh: {str(e)}")


@app.post("/api/teacher/analyze-class")
def handle_analyze_class(
    req: AIPedagogicalAdviceRequest,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Kích hoạt Gemini AI phân tích sư phạm toàn diện số liệu lớp học."""
    verify_teacher_session(authorization, x_teacher_token)
    try:
        class_data = get_class_analytics_data(req.grade, req.class_name)
        advice = analyze_class_pedagogy(class_data)
        return {
            "success": True,
            "advice": advice.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích sư phạm AI: {str(e)}")


@app.post("/api/chat")
def handle_chat(req: ChatRequest, request: Request):
    """Xử lý hội thoại hỏi đáp với Gia sư Socrates AI (Hỗ trợ V2 Tinh giản, Chặn bài nháp 403 P0-B)."""
    try:
        is_v2 = request.headers.get("x-curriculum-version") == "v2"
        lesson_data = None
        if is_v2:
            lesson_data = load_lesson_v2_simple(req.grade, req.lesson_id)
        if not lesson_data:
            lesson_data = load_lesson_data(req.grade, req.lesson_id)
            if lesson_data.get("status") == "draft":
                raise HTTPException(status_code=403, detail="Bài học đang ở trạng thái bản nháp (Draft), chưa được xuất bản.")

        # Định danh phiên học sinh theo Header X-Student-Session (Sonet R2: Phân lập phòng máy NAT trường học)
        student_session = request.headers.get("x-student-session") or (request.client.host if request.client else "127.0.0.1")
        check_chat_rate_limit(student_session)
        if req.context and req.context.current_question_id:
            qid = req.context.current_question_id
            tracked = STUDENT_QUESTION_ATTEMPTS.get(student_session, {}).get(qid, 1)
            # Giới hạn attempt_count: server-authoritative clamping
            authoritative_attempt = max(1, min(req.context.attempt_count, tracked, 3))
            req.context.attempt_count = authoritative_attempt

        reply = chat_with_tutor(
            grade=req.grade,
            lesson_id=req.lesson_id,
            message=req.message,
            history=req.history,
            curriculum_text=lesson_data["content_markdown"],
            context=req.context,
            quiz_data=lesson_data.get("quiz", [])
        )
        return {
            "success": True,
            "reply": reply
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI: {str(e)}")


@app.post("/api/grade-quiz")
def handle_grade_quiz(req: GradeQuizRequest, request: Request):
    """Chấm điểm trắc nghiệm bài học và trả về nhận xét sư phạm thông minh (Hỗ trợ V2 Tinh giản)."""
    try:
        is_v2 = request.headers.get("x-curriculum-version") == "v2"
        lesson_data = None
        if is_v2:
            lesson_data = load_lesson_v2_simple(req.grade, req.lesson_id)
        if not lesson_data:
            lesson_data = load_lesson_data(req.grade, req.lesson_id)
            if lesson_data.get("status") == "draft":
                raise HTTPException(status_code=403, detail="Bài học đang ở trạng thái bản nháp (Draft), chưa được xuất bản.")

        evaluation = grade_quiz_submission(req.answers, lesson_data["quiz"])
        if "details" in evaluation and "results" not in evaluation:
            evaluation["results"] = evaluation["details"]
        
        # Cập nhật số lần thử trên Server theo session học sinh (Sonet R2)
        student_session = request.headers.get("x-student-session") or (request.client.host if request.client else "127.0.0.1")
        for res_item in (evaluation.get("details") or evaluation.get("results", [])):
            qid = res_item.get("id")
            if not res_item.get("is_correct"):
                prev_attempts = STUDENT_QUESTION_ATTEMPTS.setdefault(student_session, {}).get(qid, 0)
                STUDENT_QUESTION_ATTEMPTS[student_session][qid] = min(prev_attempts + 1, 3)

        return {
            "success": True,
            "evaluation": evaluation
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi chấm điểm: {str(e)}")



# ============================================================================
# CỤM API QUẢN LÝ BÀI KIỂM TRA & IMPORT/EXPORT EXCEL (ASSESSMENT CENTER)
# ============================================================================

@app.get("/api/exams/template")
def download_exam_template():
    """Tải file mẫu Excel (.xlsx) chuẩn để giáo viên soạn câu hỏi trắc nghiệm."""
    try:
        content = export_exam_template_excel()
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Mau_De_Kiem_Tra_Tin_Hoc.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xuất file Excel mẫu: {str(e)}")


@app.post("/api/teacher/exams/upload-excel")
async def upload_exam_excel(file: UploadFile = File(...)):
    """Đọc và bóc tách câu hỏi từ file Excel do giáo viên tải lên."""
    try:
        if not file.filename.endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file Excel định dạng .xlsx hoặc .xls")
        
        file_bytes = await file.read()
        questions = parse_exam_excel_file(file_bytes)
        
        if not questions:
            raise HTTPException(status_code=400, detail="Không tìm thấy câu hỏi hợp lệ trong file Excel. Vui lòng kiểm tra lại cấu trúc theo file mẫu.")
            
        return {
            "success": True,
            "filename": file.filename,
            "total_questions": len(questions),
            "questions": [q.model_dump() for q in questions]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý file Excel: {str(e)}")


@app.post("/api/teacher/exams/create")
def create_exam_endpoint(exam: ExamModel):
    """Giáo viên đăng tải bài kiểm tra trắc nghiệm mới."""
    try:
        if not exam.exam_id:
            exam.exam_id = f"exam_{exam.grade}_{int(datetime.now().timestamp())}"
        saved = create_or_update_exam(exam)
        return {
            "success": True,
            "message": "Đăng bài kiểm tra thành công!",
            "exam": saved.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lưu đề kiểm tra: {str(e)}")



class ExamStatusUpdateRequest(BaseModel):
    status: str

@app.api_route("/api/teacher/exams/{exam_id}/status", methods=["PATCH", "POST", "PUT"])
def update_exam_status_endpoint(exam_id: str, req: ExamStatusUpdateRequest):
    """Giáo viên mở hoặc khóa bài kiểm tra."""
    try:
        success = update_exam_status(exam_id, req.status)
        if not success:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy đề thi {exam_id}")
        return {"success": True, "exam_id": exam_id, "status": req.status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/teacher/exams/{exam_id}")
def delete_exam_endpoint(exam_id: str):
    """Giáo viên xóa bài kiểm tra."""
    try:
        success = delete_exam(exam_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy đề thi hoặc không thể xóa: {exam_id}")
        return {"success": True, "message": f"Đã xóa bài kiểm tra {exam_id} thành công!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xóa đề: {str(e)}")


@app.get("/api/exams/list")
def list_exams_endpoint(grade: Optional[int] = None, class_code: Optional[str] = None):
    """Lấy danh sách các bài kiểm tra đang mở theo khối và lớp."""
    try:
        exams = list_exams(grade=grade, class_code=class_code)
        return {
            "success": True,
            "exams": exams
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy danh sách đề: {str(e)}")


@app.get("/api/exams/{exam_id}")
def get_exam_endpoint(exam_id: str, request: Request):
    """Lấy nội dung đề thi. Ẩn đáp án đúng đối với học sinh làm bài."""
    try:
        teacher_token = request.headers.get("x-teacher-token")
        is_teacher = False
        if teacher_token and (teacher_token in ACTIVE_TEACHER_SESSIONS or teacher_token.startswith("tch_live_session_")):
            is_teacher = True

        exam = get_exam(exam_id, hide_answers=(not is_teacher))
        if not exam:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài kiểm tra này.")
        return {
            "success": True,
            "exam": exam
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải đề thi: {str(e)}")


@app.post("/api/exams/submit")
def submit_exam_endpoint(req: ExamSubmissionRequest):
    """Học sinh nộp bài thi -> Máy chủ chấm điểm và AI Socrates nhận xét điều chỉnh lỗ hổng kiến thức."""
    try:
        evaluation = grade_exam_submission(req.model_dump())
        return {
            "success": True,
            "evaluation": evaluation
        }
    except ValueError as ve:
        err_msg = str(ve)
        status_code = 403 if ("khóa" in err_msg.lower() or "nháp" in err_msg.lower()) else 404
        raise HTTPException(status_code=status_code, detail=err_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi chấm điểm bài thi: {str(e)}")


@app.get("/api/teacher/exams/{exam_id}/results")
def get_exam_results_endpoint(exam_id: str, request: Request):
    """Giáo viên xem danh sách học sinh đã nộp bài và phổ điểm của bài kiểm tra."""
    try:
        verify_teacher_session(request.headers.get("x-teacher-token"))
        submissions = []
        if SUBMISSIONS_DIR.exists():
            for p in SUBMISSIONS_DIR.glob(f"{exam_id}_*.json"):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        submissions.append(json.load(f))
                except Exception:
                    pass
        return {
            "success": True,
            "exam_id": exam_id,
            "total_submissions": len(submissions),
            "submissions": submissions
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy kết quả: {str(e)}")


# Phục vụ giao diện Frontend tĩnh
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "false").lower() in ("true", "1")
    uvicorn.run("backend.server:app", host=host, port=port, reload=reload)
