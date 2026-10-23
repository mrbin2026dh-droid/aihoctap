"""
FastAPI Server: Cung cấp API cho hệ thống Web Tự học Tin học THCS
Tích hợp Google ADK Grounded Agent, Kiến trúc Khối Động (Block Schema) và Teacher Studio.
"""
import os
import sys
import time
import secrets
import re
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
    parse_safe_grade,
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

# Lấy mã PIN từ biến môi trường .env; tuyệt đối không hardcode mã PIN mặc định trong mã nguồn (Fail-Closed)
TEACHER_PIN = (os.getenv("TEACHER_PIN") or "").strip()
if TEACHER_PIN in ("123456", "admin", "gv2026"):
    TEACHER_PIN = ""

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
    """Lớp proxy tương thích ngược với dict STUDENT_QUESTION_ATTEMPTS, yêu cầu key câu hỏi phải gắn namespace bài học (B16)."""
    def get(self, session_id: str, default=None):
        if session_id in _student_attempts_store:
            return self[session_id]
        return default if default is not None else {}

    def __getitem__(self, session_id: str):
        attempts = get_student_session_attempts(session_id)
        class _ScopedAttemptsDict(dict):
            def __init__(self, raw):
                self.raw = raw
                super().__init__(raw)
            def __setitem__(self, key, value):
                if not ((":" in str(key) or "_" in str(key)) and any(c.isdigit() for c in str(key))):
                    raise KeyError(f"Attempt key '{key}' bắt buộc phải gồm grade và lesson: f'{{grade}}_{{lesson_id}}_{{qid}}'")
                self.raw[key] = value
                super().__setitem__(key, value)
            def __getitem__(self, key):
                if not ((":" in str(key) or "_" in str(key)) and any(c.isdigit() for c in str(key))):
                    raise KeyError(f"Attempt key '{key}' bắt buộc phải gồm grade và lesson: f'{{grade}}_{{lesson_id}}_{{qid}}'")
                return self.raw.get(key, 0)
            def get(self, key, default=0):
                if not ((":" in str(key) or "_" in str(key)) and any(c.isdigit() for c in str(key))):
                    return default
                return self.raw.get(key, default)
        return _ScopedAttemptsDict(attempts)

    def __setitem__(self, session_id: str, value):
        attempts = get_student_session_attempts(session_id)
        attempts.update(value)

    def __contains__(self, session_id: str):
        return session_id in _student_attempts_store

    def setdefault(self, session_id: str, default=None):
        return self[session_id]

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


ACTIVE_STUDENT_SESSIONS: Dict[str, dict] = {}

STUDENTS_REGISTRY_FILE = Path(os.getenv("STUDENTS_REGISTRY_PATH_OVERRIDE") or (BASE_DIR / "data" / "students_registry.json"))

def lookup_lan_student(code: str) -> Optional[Dict[str, Any]]:
    """Tra cứu thông tin học sinh từ sổ bộ dữ liệu địa phương hoặc Firebase (L05 & F08)."""
    clean_code = str(code).strip().upper()
    reg_file = STUDENTS_REGISTRY_FILE
    if reg_file.exists():
        try:
            with open(reg_file, "r", encoding="utf-8") as f:
                reg_data = json.load(f)
            if clean_code in reg_data:
                return reg_data[clean_code]
        except Exception as e:
            print(f"Lỗi đọc students_registry.json: {e}")
    return None

def verify_student_session(
    authorization: Optional[str] = Header(None),
    x_student_token: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Xác thực phiên học sinh phía server (L01 & R01: Fail-Closed).
    Hỗ trợ phiên LAN Token đã cấp qua /api/student/lan-login hoặc Firebase ID Token đã xác thực chữ ký.
    Từ chối tuyệt đối token chưa từng được cấp, token giả mạo hoặc token không có chữ ký hợp lệ.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_student_token:
        token = x_student_token.strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Yêu cầu xác thực danh tính học sinh. Vui lòng đăng nhập trước khi nộp bài."
        )

    now = time.time()

    # 1. Kiểm tra trong bộ nhớ phiên hoạt động được server cấp (ACTIVE_STUDENT_SESSIONS)
    if token in ACTIVE_STUDENT_SESSIONS:
        sess = ACTIVE_STUDENT_SESSIONS[token]
        if now > sess.get("exp", 0):
            ACTIVE_STUDENT_SESSIONS.pop(token, None)
            raise HTTPException(status_code=401, detail="Phiên làm việc học sinh đã hết hạn. Vui lòng đăng nhập lại.")
        
        # Luôn làm mới trạng thái lớp, khối và khóa tài khoản từ nguồn tin cậy (V3-02)
        code = sess.get("student_code")
        if code:
            fresh_info = lookup_lan_student(code)
            if fresh_info is None:
                # Học sinh không còn tồn tại trong sổ bộ trường học -> Thu hồi phiên ngay
                ACTIVE_STUDENT_SESSIONS.pop(token, None)
                raise HTTPException(status_code=401, detail="Tài khoản học sinh không còn trong danh sách nhà trường. Phiên làm việc đã bị thu hồi.")

            # Cập nhật lớp, khối và tên mới nhất từ sổ bộ tin cậy
            if fresh_info.get("class_code"):
                sess["class_code"] = fresh_info["class_code"]
            if fresh_info.get("grade"):
                sess["grade"] = fresh_info["grade"]
            if fresh_info.get("student_name"):
                sess["student_name"] = fresh_info["student_name"]

            if fresh_info.get("is_blocked") or sess.get("is_blocked"):
                sess["is_blocked"] = True
                raise HTTPException(status_code=403, detail="Tài khoản học sinh này hiện đang bị Giáo viên tạm khóa.")
            else:
                sess["is_blocked"] = False

        if sess.get("is_blocked"):
            raise HTTPException(status_code=403, detail="Tài khoản học sinh này hiện đang bị Giáo viên tạm khóa.")
        return sess

    # 2. Xác thực Firebase ID Token chính thức có chữ ký hợp lệ (V3-02)
    try:
        import firebase_admin
        from firebase_admin import auth as fb_auth
        if not firebase_admin._apps:
            try:
                firebase_admin.initialize_app()
            except Exception:
                pass
        decoded = fb_auth.verify_id_token(token, check_revoked=True)
        uid = decoded.get("uid") or decoded.get("sub")
        if uid:
            exp = decoded.get("exp", now + 3600)
            if now > exp:
                raise HTTPException(status_code=401, detail="Phiên Firebase ID Token của học sinh đã hết hạn.")

            # Đồng bộ thông tin học sinh từ registry dựa trên email hoặc uid
            email = decoded.get("email") or ""
            fresh_info = None
            if email and "@" in email:
                code_cand = email.split("@")[0].upper()
                fresh_info = lookup_lan_student(code_cand)
            if not fresh_info and uid:
                fresh_info = lookup_lan_student(uid)

            if fresh_info:
                if fresh_info.get("is_blocked"):
                    raise HTTPException(status_code=403, detail="Tài khoản học sinh này hiện đang bị Giáo viên tạm khóa.")
                class_code = fresh_info.get("class_code") or decoded.get("class_code") or ""
                grade = int(fresh_info.get("grade") or decoded.get("grade") or 9)
                student_name = fresh_info.get("student_name") or decoded.get("name") or "Học sinh"
            else:
                class_code = decoded.get("class_code") or ""
                grade = int(decoded.get("grade") or 9)
                student_name = decoded.get("name") or "Học sinh"

            return {
                "uid": uid,
                "student_name": student_name,
                "student_email": email,
                "class_code": class_code,
                "grade": grade,
                "is_blocked": False,
                "exp": exp
            }
    except HTTPException:
        raise
    except Exception:
        pass

    # Tuyệt đối KHÔNG chấp nhận token tự chế hoặc chỉ có tiền tố lan_sess_ nếu chưa được server cấp (R01 Fail-Closed)
    raise HTTPException(
        status_code=401,
        detail="Phiên làm việc học sinh không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại."
    )


FIREBASE_RTDB_URL = "https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app"
_cached_firebase_pin = {"pin": None, "ts": 0}

def get_firebase_teacher_pin() -> Optional[str]:
    """Lấy mã PIN Giáo viên mới nhất từ Firebase Realtime Database (đồng bộ đa máy)."""
    now = time.time()
    if _cached_firebase_pin["pin"] and (now - _cached_firebase_pin["ts"] < 30):
        return _cached_firebase_pin["pin"]
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{FIREBASE_RTDB_URL}/system/teacher_pin.json",
            headers={"User-Agent": "FastAPI-Backend"}
        )
        with urllib.request.urlopen(req, timeout=2.0) as res:
            if res.status == 200:
                val = json.loads(res.read().decode("utf-8"))
                if isinstance(val, str) and len(val.strip()) >= 6:
                    _cached_firebase_pin["pin"] = val.strip()
                    _cached_firebase_pin["ts"] = now
                    return _cached_firebase_pin["pin"]
    except Exception:
        pass
    return None

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

    # 2. Kiểm tra cấu hình hệ thống: nếu chưa thiết lập TEACHER_PIN, từ chối an toàn (Fail-Closed)
    if not TEACHER_PIN:
        raise HTTPException(
            status_code=503,
            detail="Chưa cấu hình mã PIN giáo viên hợp lệ trên hệ thống. Vui lòng thiết lập biến TEACHER_PIN trong file .env."
        )

    # So sánh mã PIN với constant-time comparison trên UTF-8 bytes chống Timing Attack & TypeError (N5)
    is_valid = False
    try:
        if req.pin:
            pin_bytes = req.pin.strip().encode("utf-8")
            expected_bytes = TEACHER_PIN.encode("utf-8")
            # Chỉ so khớp duy nhất mã TEACHER_PIN được cấu hình từ biến môi trường tin cậy
            is_valid = secrets.compare_digest(pin_bytes, expected_bytes)
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


class TeacherChangePinRequest(BaseModel):
    current_pin: str
    new_pin: str


@app.post("/api/teacher/change-pin")
def teacher_change_pin_endpoint(
    req: TeacherChangePinRequest,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """
    Giáo viên đổi mã PIN.
    Thống nhất nguồn xác thực duy nhất: Cập nhật biến môi trường bền vững và thu hồi toàn bộ token cũ.
    """
    global TEACHER_PIN
    current_pin = TEACHER_PIN
    if not current_pin:
        raise HTTPException(
            status_code=503,
            detail="Hệ thống chưa được thiết lập TEACHER_PIN hợp lệ."
        )

    # 1. Kiểm tra mã PIN hiện tại bằng constant-time comparison chống Timing Attack
    cur_bytes = req.current_pin.strip().encode("utf-8")
    expected_bytes = current_pin.encode("utf-8")
    if not secrets.compare_digest(cur_bytes, expected_bytes):
        raise HTTPException(
            status_code=401,
            detail="Mã PIN hiện tại không chính xác."
        )

    # 2. Kiểm tra độ mạnh và tính an toàn của mã PIN mới (Chống xuống dòng / tiêm biến môi trường B12)
    clean_new_pin = req.new_pin.strip()
    if any(c in clean_new_pin for c in ("\n", "\r", "\0")):
        raise HTTPException(
            status_code=400,
            detail="Mã PIN mới không được chứa ký tự xuống dòng hoặc ký tự điều khiển."
        )
    if len(clean_new_pin) < 6:
        raise HTTPException(
            status_code=400,
            detail="Mã PIN mới phải có tối thiểu 6 ký tự."
        )
    if clean_new_pin in ("123456", "admin", "gv2026", "000000", "password"):
        raise HTTPException(
            status_code=400,
            detail="Mã PIN mới quá yếu hoặc thuộc danh sách bị cấm."
        )

    # 3. Ghi đè bền vững vào tệp .env (B10 & B11: Ghi đĩa thành công trước khi đổi bộ nhớ)
    env_file = BASE_DIR / ".env"
    env_lines = []
    pin_written = False
    if env_file.exists():
        try:
            content = env_file.read_text(encoding="utf-8")
            for line in content.splitlines():
                if line.strip().startswith("TEACHER_PIN="):
                    env_lines.append(f"TEACHER_PIN={clean_new_pin}")
                    pin_written = True
                else:
                    env_lines.append(line)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Không thể đọc tệp cấu hình .env: {e}")

    if not pin_written:
        env_lines.append(f"TEACHER_PIN={clean_new_pin}")

    new_env_content = "\n".join(env_lines) + "\n"

    try:
        env_file.write_text(new_env_content, encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi ghi tệp cấu hình .env: {e}")

    # 4. CHỈ cập nhật TEACHER_PIN trong bộ nhớ sau khi tệp .env đã được ghi thành công vào đĩa cứng
    TEACHER_PIN = clean_new_pin
    os.environ["TEACHER_PIN"] = clean_new_pin

    # 5. Thu hồi toàn bộ session token giáo viên cũ để bắt buộc đăng nhập lại bằng PIN mới
    ACTIVE_TEACHER_SESSIONS.clear()

    return {
        "success": True,
        "message": "Đã đổi mã PIN giáo viên thành công. Toàn bộ phiên cũ đã được thu hồi, vui lòng đăng nhập lại bằng mã PIN mới."
    }


@app.get("/api/health", summary="Health check cho UptimeRobot và Render Keep-Alive")
@app.get("/health", summary="Health check cho UptimeRobot và Render Keep-Alive (root alias)")
def api_health():
    """Endpoint siêu nhẹ để đánh thức Render và kiểm tra tình trạng dịch vụ (0% DB, 0% AI)."""
    return {
        "status": "healthy",
        "service": "aisgk-backend",
        "timestamp": time.time()
    }


@app.get("/api/curriculum/lessons/{grade}")
def get_curriculum_lessons(grade: str, request: Request):
    """Lấy danh sách các bài học hiện có trong khối lớp kèm trạng thái draft/published."""
    try:
        g = parse_safe_grade(grade, default_grade=9)
        is_v2 = request.headers.get("x-curriculum-version") == "v2"
        if is_v2:
            lessons = list_available_lessons_v2(g)
        else:
            lessons = list_available_lessons(g)
        return {
            "success": True,
            "grade": g,
            "total": len(lessons),
            "lessons": lessons
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc danh mục bài học: {str(e)}")


@app.get("/api/lesson/{grade}/{lesson_id}")
def get_lesson(grade: str, lesson_id: int, request: Request):
    """Lấy nội dung bài học SGK cho học sinh (đã giấu đáp án đúng)."""
    try:
        g = parse_safe_grade(grade, default_grade=9)
        is_v2 = request.headers.get("x-curriculum-version") == "v2"
        data = None
        if is_v2:
            data = load_lesson_v2_simple(g, lesson_id)
        if not data:
            data = load_lesson_data(g, lesson_id)
        if not data:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy bài học {lesson_id} Khối {g}")
        # Khóa cứng R07: Chặn toàn bộ bài nháp (draft) trên mọi nhánh V1/V2
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
def get_curriculum_lessons_v2(grade: str):
    """Liệt kê danh mục bài học V2 Tinh giản."""
    try:
        g = parse_safe_grade(grade, default_grade=9)
        lessons = list_available_lessons_v2(g)
        return {
            "success": True,
            "grade": g,
            "total": len(lessons),
            "lessons": lessons
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc danh mục bài học V2: {str(e)}")


@app.get("/api/v2/lesson/{grade}/{lesson_id}")
def get_lesson_v2(grade: str, lesson_id: int):
    """Lấy nội dung bài học V2 Tinh giản (đã giấu đáp án đúng cho học sinh). Chặn bản nháp 403 (B13 & L11)."""
    g = parse_safe_grade(grade, default_grade=9)
    data = load_lesson_v2_simple(g, lesson_id)
    if data and data.get("status") == "draft":
        raise HTTPException(
            status_code=403,
            detail=f"Bài học {lesson_id} đang ở trạng thái bản nháp (draft). Chưa mở cho học sinh truy cập!"
        )

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy nội dung bài học {lesson_id} (Khối {g})."
        )

    safe_quiz = []
    for q in data.get("quiz", []):
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
        if not lesson_data:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy bài học {req.lesson_id} Khối {req.grade}")
        # Khóa cứng R07: Chặn toàn bộ bài nháp (draft) trên mọi nhánh V1/V2
        if lesson_data.get("status") == "draft":
            raise HTTPException(status_code=403, detail="Bài học đang ở trạng thái bản nháp (Draft), chưa được xuất bản.")

        # Định danh phiên học sinh theo Header X-Student-Session (Sonet R2: Phân lập phòng máy NAT trường học)
        student_session = request.headers.get("x-student-session") or (request.client.host if request.client else "127.0.0.1")
        check_chat_rate_limit(student_session)
        if req.context and req.context.current_question_id:
            qid = req.context.current_question_id
            scoped_qid = f"g{req.grade}_l{req.lesson_id}_{qid}"
            tracked = STUDENT_QUESTION_ATTEMPTS.get(student_session, {}).get(scoped_qid, 1)
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
        if not lesson_data:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy bài học {req.lesson_id} Khối {req.grade}")
        # Khóa cứng R07: Chặn toàn bộ bài nháp (draft) trên mọi nhánh V1/V2
        if lesson_data.get("status") == "draft":
            raise HTTPException(status_code=403, detail="Bài học đang ở trạng thái bản nháp (Draft), chưa được xuất bản.")

        evaluation = grade_quiz_submission(req.answers, lesson_data["quiz"])
        if "details" in evaluation and "results" not in evaluation:
            evaluation["results"] = evaluation["details"]
        
        # Cập nhật số lần thử trên Server theo session học sinh có namespace bài học (Sonet R2 & B16)
        student_session = request.headers.get("x-student-session") or (request.client.host if request.client else "127.0.0.1")
        for res_item in (evaluation.get("details") or evaluation.get("results", [])):
            qid = res_item.get("id")
            scoped_qid = f"g{req.grade}_l{req.lesson_id}_{qid}"
            if not res_item.get("is_correct"):
                prev_attempts = STUDENT_QUESTION_ATTEMPTS.setdefault(student_session, {}).get(scoped_qid, 0)
                new_attempts = min(prev_attempts + 1, 3)
                STUDENT_QUESTION_ATTEMPTS[student_session][scoped_qid] = new_attempts
                if qid and ("_" in str(qid) or ":" in str(qid)) and any(c.isdigit() for c in str(qid)):
                    STUDENT_QUESTION_ATTEMPTS[student_session][qid] = new_attempts

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
async def upload_exam_excel(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Đọc và bóc tách câu hỏi từ file Excel do giáo viên tải lên."""
    verify_teacher_session(authorization, x_teacher_token)
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
def create_exam_endpoint(
    exam: ExamModel,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Giáo viên đăng tải bài kiểm tra trắc nghiệm mới."""
    verify_teacher_session(authorization, x_teacher_token)
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
def update_exam_status_endpoint(
    exam_id: str,
    req: ExamStatusUpdateRequest,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Giáo viên mở hoặc khóa bài kiểm tra."""
    verify_teacher_session(authorization, x_teacher_token)
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
def delete_exam_endpoint(
    exam_id: str,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Giáo viên xóa bài kiểm tra."""
    verify_teacher_session(authorization, x_teacher_token)
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
def get_exam_endpoint(
    exam_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Lấy nội dung đề thi. Ẩn đáp án đúng đối với học sinh làm bài."""
    is_teacher = False
    # Nếu client gửi header xác thực giáo viên, bắt buộc kiểm tra phiên hợp lệ (chống giả mạo token)
    if authorization or x_teacher_token:
        verify_teacher_session(authorization, x_teacher_token)
        is_teacher = True

    try:
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


class StudentLanLoginRequest(BaseModel):
    student_code: str
    grade: Optional[int] = 9


@app.post("/api/student/lan-login")
def student_lan_login(req: StudentLanLoginRequest):
    """
    Đăng nhập học sinh trong mạng LAN trường học bằng Mã Học Sinh (6 chữ số).
    Xác thực qua danh sách học sinh được phép, từ chối mã không hợp lệ (Fail-Closed, F08 & L05).
    """
    code = req.student_code.strip().upper()
    if not re.match(r"^\d{6}$", code):
        raise HTTPException(status_code=400, detail="Mã học sinh phải là dãy số gồm đúng 6 chữ số!")

    student_info = lookup_lan_student(code)
    if not student_info:
        raise HTTPException(status_code=404, detail=f"Mã học sinh '{code}' không tồn tại trong danh sách lớp. Vui lòng liên hệ Thầy/Cô bộ môn!")

    if student_info.get("is_blocked"):
        raise HTTPException(status_code=403, detail="Tài khoản học sinh của em hiện đang bị Giáo viên tạm khóa!")

    token = f"lan_sess_{code}_{secrets.token_hex(16)}"
    exp = time.time() + (24 * 3600)
    session_data = {
        "uid": f"std_{code}",
        "student_code": code,
        "student_name": student_info.get("full_name") or f"Học sinh {code}",
        "class_code": student_info.get("class_code") or f"{req.grade or 9}A",
        "grade": student_info.get("grade") or req.grade or 9,
        "is_blocked": False,
        "exp": exp
    }
    ACTIVE_STUDENT_SESSIONS[token] = session_data

    return {
        "success": True,
        "token": token,
        "student": session_data
    }


class TeacherBlockStudentRequest(BaseModel):
    class_code: str
    student_id: str
    is_blocked: bool


@app.post("/api/teacher/students/block")
def teacher_block_student(
    req: TeacherBlockStudentRequest,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Giáo viên khóa hoặc mở khóa tài khoản học sinh (L05)."""
    verify_teacher_session(authorization, x_teacher_token)
    sync_to_firebase_rtdb(f"students/{req.class_code}/{req.student_id}/is_blocked", req.is_blocked)
    for t, sess in list(ACTIVE_STUDENT_SESSIONS.items()):
        if sess.get("uid") == req.student_id or sess.get("student_code") == req.student_id:
            sess["is_blocked"] = req.is_blocked
    return {"success": True, "student_id": req.student_id, "is_blocked": req.is_blocked}


@app.post("/api/exams/submit")
def submit_exam_endpoint(
    req: ExamSubmissionRequest,
    authorization: Optional[str] = Header(None),
    x_student_token: Optional[str] = Header(None)
):
    """Học sinh nộp bài thi -> Xác thực phiên server, chấm điểm và AI Socrates nhận xét (L01)."""
    session = verify_student_session(authorization, x_student_token)

    # Ghi đè danh tính đáng tin cậy từ phiên server (chống học sinh tự khai thông tin)
    sub_dict = req.model_dump()
    sub_dict["student_id"] = session["uid"]
    if session.get("student_name"):
        sub_dict["student_name"] = session["student_name"]
    if session.get("class_code"):
        sub_dict["class_code"] = session["class_code"]
    if session.get("grade"):
        sub_dict["grade"] = session["grade"]
    sub_dict["is_blocked"] = session.get("is_blocked", False)

    try:
        evaluation = grade_exam_submission(sub_dict)
        return {
            "success": True,
            "evaluation": evaluation
        }
    except ValueError as ve:
        err_msg = str(ve)
        status_code = 403 if any(k in err_msg.lower() for k in ["khóa", "nháp", "hết hạn", "thời hạn", "hạn chót", "chỉ dành cho", "thuộc khối", "đã hoàn thành"]) else 404
        if "không hợp lệ" in err_msg.lower() or "thoát thư mục" in err_msg.lower():
            status_code = 422
        raise HTTPException(status_code=status_code, detail=err_msg)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi chấm điểm bài thi: {str(e)}")


@app.get("/api/teacher/exams/{exam_id}/results")
def get_exam_results_endpoint(
    exam_id: str,
    authorization: Optional[str] = Header(None),
    x_teacher_token: Optional[str] = Header(None)
):
    """Giáo viên xem danh sách học sinh đã nộp bài và phổ điểm của bài kiểm tra."""
    verify_teacher_session(authorization, x_teacher_token)
    try:
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
