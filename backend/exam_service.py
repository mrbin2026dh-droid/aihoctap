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

import urllib.request
import urllib.error

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
EXAMS_DIR = DATA_DIR / "exams"
SUBMISSIONS_DIR = EXAMS_DIR / "submissions"

FIREBASE_RTDB_URL = os.getenv("FIREBASE_DATABASE_URL", "https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app")

def sync_to_firebase_rtdb(path_str: str, data: Any = None, method: str = "PUT") -> bool:
    """Đồng bộ dữ liệu sang Firebase Realtime Database qua REST API an toàn với hỗ trợ Auth Credentials (R08)."""
    try:
        clean_path = path_str.lstrip('/')
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/{clean_path}.json"
        auth_secret = os.getenv("FIREBASE_RTDB_AUTH") or os.getenv("FIREBASE_DATABASE_SECRET") or os.getenv("FIREBASE_AUTH_TOKEN")
        if auth_secret:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}auth={auth_secret}"
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"} if body else {},
            method=method
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            return resp.status in (200, 204)
    except Exception:
        return False

# Đảm bảo các thư mục dữ liệu tồn tại an toàn
EXAMS_DIR.mkdir(parents=True, exist_ok=True)
SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)


class QuestionItem(BaseModel):
    id: str = Field(min_length=1)
    cau_hoi: str = Field(min_length=1)
    lua_chon: Dict[str, str] = Field(default_factory=dict) # A, B, C, D
    dap_an_dung: str # A, B, C, or D
    muc_sgk: Optional[str] = "Mục kiến thức SGK"
    trang_sgk: Optional[int] = 0
    giai_thich_su_pham: Optional[str] = ""
    goi_y_khi_sai: Optional[str] = ""

    def __init__(self, **data):
        super().__init__(**data)
        if not self.id or not str(self.id).strip():
            raise ValueError("ID câu hỏi không được để trống")
        if not self.cau_hoi or not str(self.cau_hoi).strip():
            raise ValueError("Nội dung câu hỏi không được để trống")
        if not self.lua_chon or len(self.lua_chon) < 2:
            raise ValueError("Câu hỏi phải có ít nhất 2 lựa chọn (A, B)")
        for opt_k, opt_v in self.lua_chon.items():
            if not opt_v or not str(opt_v).strip():
                raise ValueError(f"Nội dung phương án {opt_k} không được để trống")
        if self.dap_an_dung not in self.lua_chon:
            raise ValueError(f"Đáp án đúng '{self.dap_an_dung}' phải thuộc danh sách các lựa chọn")


class ExamModel(BaseModel):
    exam_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    grade: int = Field(default=9)
    target_classes: List[str] = Field(default_factory=lambda: ["Tất cả"])
    duration_minutes: int = Field(default=15, gt=0)
    start_time: Optional[str] = ""
    end_time: Optional[str] = ""
    status: str = Field(default="published") # published, closed, draft
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    questions: List[QuestionItem] = Field(default_factory=list)
    cloud_synced: bool = Field(default=True)
    public_synced: Optional[bool] = Field(default=None)
    private_synced: Optional[bool] = Field(default=None)

    def __init__(self, **data):
        super().__init__(**data)
        if not self.exam_id or not re.match(r"^[a-zA-Z0-9_\-]+$", str(self.exam_id)) or ".." in str(self.exam_id) or "/" in str(self.exam_id) or "\\" in str(self.exam_id):
            raise ValueError(f"exam_id không hợp lệ hoặc chứa ký tự thoát thư mục: {self.exam_id}")
        if not self.title or not str(self.title).strip():
            raise ValueError("Tiêu đề đề thi không được để trống")
        if self.grade not in (0, 6, 7, 8, 9):
            raise ValueError(f"Khối lớp {self.grade} không hợp lệ (chỉ chấp nhận 6, 7, 8, 9 hoặc 0 - Tất cả)")
        if self.duration_minutes <= 0:
            raise ValueError("Thời lượng làm bài phải lớn hơn 0 phút")
        if self.status not in ("published", "closed", "draft"):
            raise ValueError(f"Trạng thái đề thi '{self.status}' không hợp lệ (chỉ chấp nhận published, closed, draft)")
        if not self.questions or len(self.questions) == 0:
            raise ValueError("Đề kiểm tra phải có ít nhất 1 câu hỏi")
        q_ids = [q.id for q in self.questions]
        if len(q_ids) != len(set(q_ids)):
            raise ValueError("Các câu hỏi trong đề không được trùng mã ID")


class ExamSubmissionRequest(BaseModel):
    exam_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    student_name: str = Field(min_length=1)
    student_code: Optional[str] = ""
    class_code: str = "9A"
    grade: int = 9
    submission_id: Optional[str] = ""
    time_spent: Optional[str] = ""
    answers: Dict[str, str] = Field(default_factory=dict) # question_id -> chosen option

    def __init__(self, **data):
        super().__init__(**data)
        if not self.exam_id or not re.match(r"^[a-zA-Z0-9_\-]+$", str(self.exam_id)) or ".." in str(self.exam_id) or "/" in str(self.exam_id) or "\\" in str(self.exam_id):
            raise ValueError(f"exam_id không hợp lệ hoặc chứa ký tự thoát thư mục: {self.exam_id}")
        if not self.student_id or not re.match(r"^[a-zA-Z0-9_\-]+$", str(self.student_id)) or ".." in str(self.student_id) or "/" in str(self.student_id) or "\\" in str(self.student_id):
            raise ValueError(f"student_id không hợp lệ hoặc chứa ký tự thoát thư mục: {self.student_id}")


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
    if not file_bytes or not file_bytes.startswith(b"PK\x03\x04"):
        raise ValueError("Định dạng tệp không hợp lệ. Vui lòng tải lên tệp Excel (.xlsx chuẩn), không hỗ trợ định dạng .xls cũ hoặc tệp không phải Excel!")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as e:
        raise ValueError(f"Không thể đọc tệp Excel: {e}")
    ws = wb.active

    questions: List[QuestionItem] = []
    seen_ids = set()

    # Tìm dòng bắt đầu dữ liệu (dòng 2 trở đi)
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not any(row):
            continue

        cau_hoi = str(row[1] or "").strip()
        if not cau_hoi:
            continue

        opt_a = str(row[2] or "").strip() if len(row) > 2 else ""
        opt_b = str(row[3] or "").strip() if len(row) > 3 else ""
        opt_c = str(row[4] or "").strip() if len(row) > 4 else ""
        opt_d = str(row[5] or "").strip() if len(row) > 5 else ""

        if not opt_a or not opt_b:
            raise ValueError(f"Dòng {row_idx}: Câu hỏi '{cau_hoi[:30]}...' thiếu phương án lựa chọn A hoặc B")

        if len(row) <= 6 or row[6] is None or not str(row[6]).strip():
            raise ValueError(f"Dòng {row_idx}: Thiếu đáp án đúng cho câu hỏi '{cau_hoi[:30]}...' (phải là A, B, C hoặc D)")

        dap_an = str(row[6]).strip().upper()
        if dap_an not in ["A", "B", "C", "D"]:
            match = re.match(r"^([A-D])", dap_an)
            if match:
                dap_an = match.group(1)
            else:
                raise ValueError(f"Dòng {row_idx}: Đáp án đúng '{dap_an}' không hợp lệ (phải là A, B, C hoặc D)")

        lua_chon = {
            "A": opt_a,
            "B": opt_b
        }
        if opt_c:
            lua_chon["C"] = opt_c
        if opt_d:
            lua_chon["D"] = opt_d

        if dap_an not in lua_chon:
            raise ValueError(f"Dòng {row_idx}: Đáp án đúng '{dap_an}' không có nội dung trong các phương án đã nhập")

        muc_sgk = str(row[7] or "Kiến thức trọng tâm SGK").strip() if len(row) > 7 and row[7] else "Kiến thức trọng tâm SGK"
        giai_thich = str(row[8] or "").strip() if len(row) > 8 and row[8] else ""

        q_id = f"q_{row_idx}_{int(datetime.now().timestamp() % 100000)}"
        if q_id in seen_ids:
            q_id = f"q_{row_idx}_{secrets.token_hex(3)}"
        seen_ids.add(q_id)

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

    if not questions:
        raise ValueError("Tệp Excel không có bất kỳ câu hỏi hợp lệ nào")

    return questions


def create_or_update_exam(exam: ExamModel) -> ExamModel:
    """Lưu đề kiểm tra vào hệ thống đĩa cứng và đồng bộ Firebase Realtime DB an toàn."""
    exam_id = str(exam.exam_id).strip()
    if not exam_id or not re.match(r"^[a-zA-Z0-9_\-]+$", exam_id) or ".." in exam_id or "/" in exam_id or "\\" in exam_id:
        raise ValueError("exam_id không hợp lệ hoặc chứa ký tự thoát thư mục")
    file_path = (EXAMS_DIR / f"{exam_id}.json").resolve()
    try:
        file_path.relative_to(EXAMS_DIR.resolve())
    except ValueError:
        raise ValueError("Đường dẫn đề thi thoát khỏi thư mục an toàn")

    exam_dict = exam.model_dump()
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(exam_dict, f, ensure_ascii=False, indent=2)

    # Tách dữ liệu đề thi công khai (không lộ đáp án đúng) khi đồng bộ sang Firebase
    public_dict = dict(exam_dict)
    public_dict["questions"] = [
        {k: v for k, v in q.items() if k not in ("dap_an_dung", "giai_thich_su_pham")}
        for q in exam_dict.get("questions", [])
    ]
    public_synced = sync_to_firebase_rtdb(f"exams/{exam_id}", public_dict)

    # Đồng bộ ngân hàng đáp án riêng biệt vào node exam_answers (V3-03 & D05)
    answer_bank = {
        "exam_id": exam_id,
        "answers": {
            q.get("id"): {
                "dap_an_dung": q.get("dap_an_dung"),
                "giai_thich_su_pham": q.get("giai_thich_su_pham", "")
            }
            for q in exam_dict.get("questions", [])
            if q.get("id") and q.get("dap_an_dung")
        }
    }
    private_synced = sync_to_firebase_rtdb(f"exam_answers/{exam_id}", answer_bank)

    # D05: CHỈ đánh dấu synced khi CẢ public VÀ private answer bank đều đồng bộ thành công!
    cloud_synced = bool(public_synced and private_synced)
    setattr(exam, "cloud_synced", cloud_synced)
    setattr(exam, "public_synced", public_synced)
    setattr(exam, "private_synced", private_synced)

    if cloud_synced:
        cloud_sync_status = "synced"
    elif public_synced or private_synced:
        cloud_sync_status = "partial_sync"
    else:
        cloud_sync_status = "pending_sync"

    exam_dict["cloud_sync_status"] = cloud_sync_status
    exam_dict["public_synced"] = public_synced
    exam_dict["private_synced"] = private_synced
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(exam_dict, f, ensure_ascii=False, indent=2)

    # V3-05: Bỏ phân nhánh theo tên audit (sync-audit), chỉ phân nhánh theo cấu hình AISGK_STRICT_CLOUD_SYNC
    if not cloud_synced and os.getenv("AISGK_STRICT_CLOUD_SYNC") == "1":
        raise RuntimeError(f"Lỗi đồng bộ đám mây Firebase cho đề thi {exam_id}. Vui lòng kiểm tra kết nối mạng hoặc quyền truy cập!")
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


def delete_exam(exam_id: str) -> bool:
    """Xóa bài kiểm tra theo exam_id và đồng bộ xóa trên Firebase."""
    clean_id = str(exam_id).strip()
    if not clean_id or not re.match(r"^[a-zA-Z0-9_\-]+$", clean_id) or ".." in clean_id or "/" in clean_id or "\\" in clean_id:
        raise ValueError(f"exam_id không hợp lệ: {exam_id}")
    file_path = (EXAMS_DIR / f"{clean_id}.json").resolve()
    try:
        file_path.relative_to(EXAMS_DIR.resolve())
    except ValueError:
        raise ValueError("Đường dẫn file đề thi nằm ngoài thư mục lưu trữ an toàn")

    deleted = False
    if file_path.exists():
        try:
            file_path.unlink()
            deleted = True
        except Exception as e:
            print(f"Lỗi khi xóa file đề thi {clean_id}: {e}")
            deleted = False
    sync_to_firebase_rtdb(f"exams/{clean_id}", method="DELETE")
    return deleted


def _load_exam_data(exam_id: str) -> Optional[Dict[str, Any]]:
    """Tải dữ liệu đề kiểm tra từ đĩa cứng hoặc tự động kéo từ Firebase Realtime Database nếu là đề mới."""
    clean_id = str(exam_id).strip()
    if not clean_id or not re.match(r"^[a-zA-Z0-9_\-]+$", clean_id) or ".." in clean_id or "/" in clean_id or "\\" in clean_id:
        return None
    file_path = (EXAMS_DIR / f"{clean_id}.json").resolve()
    try:
        file_path.relative_to(EXAMS_DIR.resolve())
    except ValueError:
        return None

    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                local_data = json.load(f)
            questions = local_data.get("questions", [])
            has_answers = all(bool(q.get("dap_an_dung")) for q in questions if isinstance(q, dict)) if questions else True
            if has_answers:
                return local_data
            # D05: Nếu bản local thiếu đáp án (ví dụ cache từ bản public), thử nạp phục hồi từ exam_answers
            try:
                auth_secret = os.getenv("FIREBASE_RTDB_AUTH") or os.getenv("FIREBASE_DATABASE_SECRET") or os.getenv("FIREBASE_AUTH_TOKEN")
                auth_param = f"?auth={auth_secret}" if auth_secret else ""
                ans_url = f"{FIREBASE_RTDB_URL.rstrip('/')}/exam_answers/{clean_id}.json{auth_param}"
                ans_req = urllib.request.Request(ans_url, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(ans_req, timeout=3.5) as ans_resp:
                    if ans_resp.status == 200:
                        ans_data = json.loads(ans_resp.read().decode("utf-8"))
                        if ans_data and isinstance(ans_data, dict) and "answers" in ans_data:
                            ans_map = ans_data["answers"]
                            for q in local_data.get("questions", []):
                                qid = q.get("id")
                                if qid in ans_map:
                                    q["dap_an_dung"] = ans_map[qid].get("dap_an_dung")
                                    q["giai_thich_su_pham"] = ans_map[qid].get("giai_thich_su_pham", "")
                            with open(file_path, "w", encoding="utf-8") as cf:
                                json.dump(local_data, cf, ensure_ascii=False, indent=2)
            except Exception:
                pass
            return local_data
        except Exception as e:
            print(f"Lỗi đọc file đề {clean_id}: {e}")

    # Tải từ Firebase Realtime Database nếu chưa có trên đĩa cứng
    try:
        url = f"{FIREBASE_RTDB_URL.rstrip('/')}/exams/{clean_id}.json"
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            if resp.status == 200:
                raw = resp.read().decode("utf-8")
                fb_data = json.loads(raw)
                if fb_data and isinstance(fb_data, dict) and "questions" in fb_data:
                    # Nạp kèm ngân hàng đáp án tin cậy từ node riêng exam_answers (V3-03)
                    try:
                        auth_secret = os.getenv("FIREBASE_RTDB_AUTH") or os.getenv("FIREBASE_DATABASE_SECRET") or os.getenv("FIREBASE_AUTH_TOKEN")
                        auth_param = f"?auth={auth_secret}" if auth_secret else ""
                        ans_url = f"{FIREBASE_RTDB_URL.rstrip('/')}/exam_answers/{clean_id}.json{auth_param}"
                        ans_req = urllib.request.Request(ans_url, headers={"Content-Type": "application/json"})
                        with urllib.request.urlopen(ans_req, timeout=3.5) as ans_resp:
                            if ans_resp.status == 200:
                                ans_data = json.loads(ans_resp.read().decode("utf-8"))
                                if ans_data and isinstance(ans_data, dict) and "answers" in ans_data:
                                    ans_map = ans_data["answers"]
                                    for q in fb_data.get("questions", []):
                                        qid = q.get("id")
                                        if qid in ans_map:
                                            q["dap_an_dung"] = ans_map[qid].get("dap_an_dung")
                                            q["giai_thich_su_pham"] = ans_map[qid].get("giai_thich_su_pham", "")
                    except Exception:
                        pass
                    try:
                        with open(file_path, "w", encoding="utf-8") as cf:
                            json.dump(fb_data, cf, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    return fb_data
    except Exception as e_fb:
        print(f"Không thể kéo đề {clean_id} từ Firebase: {e_fb}")

    return None


def get_exam(exam_id: str, hide_answers: bool = True) -> Optional[Dict[str, Any]]:
    """Lấy thông tin đề kiểm tra. Nếu hide_answers=True, ẩn đáp án đúng để chống gian lận F12."""
    clean_id = str(exam_id).strip()
    if not clean_id or not re.match(r"^[a-zA-Z0-9_\-]+$", clean_id) or ".." in clean_id or "/" in clean_id or "\\" in clean_id:
        raise ValueError(f"exam_id không hợp lệ: {exam_id}")

    data = _load_exam_data(clean_id)
    if not data:
        return None

    try:
        status = data.get("status", "published")
        if hide_answers and status != "published":
            # Đề kiểm tra đã đóng hoặc bản nháp: Học sinh không được phép đọc nội dung câu hỏi
            return None

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
        print(f"Lỗi tải đề kiểm tra {clean_id}: {e}")
        return None


def grade_exam_submission(submission: Dict[str, Any]) -> Dict[str, Any]:
    """
    Chấm điểm bài nộp và kích hoạt AI Sư phạm Socrates phân tích lỗi sai:
    1. Đo lường chính xác số câu đúng/sai và điểm thang 10.
    2. Phát hiện các lỗ hổng kiến thức còn yếu (Weak Knowledge Diagnostic).
    3. Đề xuất trực tiếp các mục SGK cần ôn tập kèm hướng dẫn điều chỉnh.
    """
    exam_id = str(submission.get("exam_id", "")).strip()
    student_id = str(submission.get("student_id", "")).strip()

    # 1. Chốt chặn chống Path Traversal và kiểm tra tính hợp lệ của ID
    if not exam_id or not re.match(r"^[a-zA-Z0-9_\-]+$", exam_id) or ".." in exam_id or "/" in exam_id or "\\" in exam_id:
        raise ValueError(f"exam_id không hợp lệ hoặc chứa ký tự thoát thư mục: {exam_id}")
    if not student_id or not re.match(r"^[a-zA-Z0-9_\-]+$", student_id) or ".." in student_id or "/" in student_id or "\\" in student_id:
        raise ValueError(f"student_id không hợp lệ hoặc chứa ký tự thoát thư mục: {student_id}")

    exam_data = _load_exam_data(exam_id)
    if not exam_data:
        raise ValueError(f"Không tìm thấy đề kiểm tra: {exam_id}")

    # 2. Chốt chặn trạng thái đề thi (Fail-Closed Security): Chỉ đề "published" mới được nộp bài
    exam_status = exam_data.get("status", "published")
    if exam_status != "published":
        if exam_status == "closed":
            raise ValueError("Bài kiểm tra này hiện đang bị Thầy/Cô khóa. Không thể nộp bài vào thời điểm này!")
        elif exam_status == "draft":
            raise ValueError("Bài kiểm tra đang ở trạng thái bản nháp. Chưa mở cho học sinh nộp bài!")
        else:
            raise ValueError(f"Bài kiểm tra đang ở trạng thái không hợp lệ ('{exam_status}'). Không thể nộp bài!")

    # 2b. Kiểm tra tính toàn vẹn của câu hỏi: Không cho phép đề thi chứa câu hỏi trùng ID
    raw_questions = exam_data.get("questions", [])
    q_ids = [q.get("id") for q in raw_questions if isinstance(q, dict)]
    if len(q_ids) != len(set(q_ids)):
        raise ValueError("Đề kiểm tra có chứa các câu hỏi bị trùng mã ID. Không thể chấm điểm chính xác!")

    # 3. Chốt chặn đối tượng lớp học được giao đề (Target Classes Check)
    target_classes = exam_data.get("target_classes", ["Tất cả"])
    student_class = str(submission.get("class_code", "")).strip()
    if target_classes and "Tất cả" not in target_classes:
        if student_class not in target_classes:
            raise ValueError(f"Bài kiểm tra này chỉ dành cho lớp {', '.join(target_classes)}. Lớp '{student_class}' không thuộc danh sách được giao làm bài!")

    # 4. Chốt chặn khối lớp (Grade Check)
    exam_grade = exam_data.get("grade")
    student_grade = submission.get("grade")
    if exam_grade and exam_grade != 0 and student_grade and student_grade != 0 and exam_grade != student_grade:
        raise ValueError(f"Bài kiểm tra này thuộc Khối {exam_grade}. Học sinh Khối {student_grade} không thể nộp bài!")

    # 5. Chốt chặn hạn chót làm bài (End Time / Deadline Enforcement R06)
    end_time_str = exam_data.get("end_time")
    if end_time_str:
        deadline = None
        try:
            deadline = datetime.fromisoformat(str(end_time_str).strip())
        except Exception:
            pass
        if deadline:
            now_dt = datetime.now(deadline.tzinfo) if deadline.tzinfo is not None else datetime.now()
            if now_dt > deadline:
                raise ValueError(f"Đã hết thời hạn làm bài kiểm tra này (hạn chót: {end_time_str}). Không thể nộp bài!")

    # 6. Chốt chặn tài khoản học sinh bị khóa (Blocked Student Check)
    if submission.get("is_blocked"):
        raise ValueError("Tài khoản học sinh hiện đang bị Giáo viên tạm khóa. Không thể nộp bài!")

    # 7. Kiểm tra đường dẫn lưu bài nộp an toàn (Path Containment Enforcement)
    sub_file = (SUBMISSIONS_DIR / f"{exam_id}_{student_id}.json").resolve()
    try:
        sub_file.relative_to(SUBMISSIONS_DIR.resolve())
    except ValueError:
        raise ValueError("Đường dẫn lưu bài nộp không an toàn (phát hiện dấu hiệu thoát thư mục)")

    # 8. Chốt chặn chống nộp lại đè điểm & Hỗ trợ Idempotency
    if sub_file.exists():
        try:
            with open(sub_file, "r", encoding="utf-8") as f_exist:
                existing_sub = json.load(f_exist)
            existing_sub_id = existing_sub.get("submission_id")
            req_sub_id = submission.get("submission_id")
            if req_sub_id and existing_sub_id and req_sub_id == existing_sub_id:
                # Idempotent retry: Trả về kết quả đã chấm trước đó
                return existing_sub.get("evaluation") or existing_sub

            allow_retake = existing_sub.get("allow_retake", False) or submission.get("allow_retake", False)
            if not allow_retake:
                raise ValueError("Em đã hoàn thành và nộp bài kiểm tra này rồi. Mỗi học sinh chỉ được làm bài 1 lần (trừ khi được Giáo viên cho phép làm lại)!")
        except ValueError:
            raise
        except Exception as e_check:
            print(f"Lỗi kiểm tra bài nộp cũ: {e_check}")

    raw_questions = exam_data.get("questions", [])
    if not raw_questions:
        raise ValueError("Đề kiểm tra không chứa câu hỏi nào!")

    # D04: Xác thực ĐẦY ĐỦ ngân hàng đáp án cho TỪNG câu hỏi
    # Thiếu một phần cũng bắt buộc dừng chấm và báo lỗi, không chấm câu thiếu thành sai
    for q in raw_questions:
        if not isinstance(q, dict):
            raise ValueError("Định dạng câu hỏi trong đề thi không hợp lệ!")
        qid = q.get("id") or "unknown"
        ans_key = str(q.get("dap_an_dung") or "").strip()
        if not ans_key:
            raise ValueError(f"Đề kiểm tra thiếu đáp án chuẩn cho câu hỏi '{qid}'. Không thể chấm điểm một phần!")
        choices = q.get("lua_chon")
        if choices and isinstance(choices, dict) and len(choices) > 0:
            if ans_key not in choices:
                raise ValueError(f"Đáp án chuẩn '{ans_key}' của câu '{qid}' không nằm trong danh sách lựa chọn hợp lệ!")

    questions_map = {q["id"]: q for q in raw_questions if isinstance(q, dict)}
    answers = submission.get("answers", {})

    total_q = len(questions_map)
    correct_count = 0
    results_detail = []
    weak_topics: Dict[str, int] = {}
    recommendations = []

    for q_id, q_data in questions_map.items():
        user_choice = answers.get(q_id, "")
        correct_choice = q_data.get("dap_an_dung", "")
        is_correct = bool(correct_choice and user_choice == correct_choice)

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
        lesson_match = re.search(r"[Bb]ài\s*(\d+)", topic)
        lesson_id = int(lesson_match.group(1)) if lesson_match else 1

        recommendations.append({
            "lesson_id": lesson_id,
            "topic": topic,
            "mistakes_count": count,
            "advice": f"Em cần xem lại lý thuyết tại '{topic}'. Nắm chắc định nghĩa và ví dụ thực tế trong sách.",
            "action_text": f"Mở {topic} để ôn lại ngay"
        })

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
        "socratic_advice": overall_comment,
        "recommended_lessons": recommendations,
        "weak_topics": list(weak_topics.keys()),
        "ai_evaluation": {
            "overall_comment": overall_comment,
            "weak_topics": weak_topics,
            "recommendations": recommendations
        },
        "details": results_detail,
        "submitted_at": datetime.now().isoformat()
    }

    # Lưu bài nộp an toàn vào thư mục submissions
    sub_payload = {
        **submission,
        "exam_title": exam_data.get("title", "Bài kiểm tra"),
        "score": score,
        "correct_count": correct_count,
        "total_questions": total_q,
        "percentage": round((correct_count / total_q) * 100) if total_q > 0 else 0,
        "evaluation": evaluation,
        "submitted_at": evaluation["submitted_at"]
    }
    with open(sub_file, "w", encoding="utf-8") as f:
        json.dump(sub_payload, f, ensure_ascii=False, indent=2)

    # Đồng bộ kết quả chi tiết lên Firebase
    sync_to_firebase_rtdb(f"exam_submissions/{exam_id}/{student_id}", sub_payload)

    # Đồng bộ kết quả vào hồ sơ học sinh trên Firebase
    class_code = submission.get("class_code", "9A")
    sync_to_firebase_rtdb(f"students/{class_code}/{student_id}/exams/{exam_id}", {
        "exam_id": exam_id,
        "exam_title": exam_data.get("title", "Bài kiểm tra"),
        "score": score,
        "correct_count": correct_count,
        "total_questions": total_q,
        "percentage": round((correct_count / total_q) * 100) if total_q > 0 else 0,
        "submitted_at": evaluation["submitted_at"]
    })

    return evaluation


def update_exam_status(exam_id: str, new_status: str) -> bool:
    """Cập nhật trạng thái mở/khóa đề kiểm tra (published / closed / draft) và đồng bộ Firebase."""
    clean_status = str(new_status).strip()
    if clean_status not in ("published", "closed", "draft"):
        raise ValueError(f"Trạng thái đề không hợp lệ: '{clean_status}'. Chỉ chấp nhận 'published', 'closed' hoặc 'draft'.")

    clean_id = str(exam_id).strip()
    if not clean_id or not re.match(r"^[a-zA-Z0-9_\-]+$", clean_id) or ".." in clean_id or "/" in clean_id or "\\" in clean_id:
        raise ValueError(f"exam_id không hợp lệ: {exam_id}")

    file_path = (EXAMS_DIR / f"{clean_id}.json").resolve()
    try:
        file_path.relative_to(EXAMS_DIR.resolve())
    except ValueError:
        raise ValueError("Đường dẫn đề thi thoát khỏi thư mục an toàn")

    if not file_path.exists():
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["status"] = clean_status
        data["updated_at"] = datetime.now().isoformat()
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Lỗi cập nhật file đề thi {clean_id}: {e}")
        return False

    sync_to_firebase_rtdb(f"exams/{clean_id}/status", clean_status, method="PUT")
    return True
