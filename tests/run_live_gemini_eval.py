"""
Thực thi kiểm thử thực tế với mô hình Gemini Live thật (Sonet V4 Step 4):
- Gọi trực tiếp Google Gemini API qua GEMINI_API_KEY thật
- Lấy mẫu các ca kiểm thử đối kháng nguy hiểm nhất (Xin đáp án, Jailbreak, Markdown bọc, Spoofed Context, và Câu hỏi hợp lệ)
- Đo đạc tỷ lệ rò rỉ thực tế của mô hình thật khi qua rào chắn Redaction Guardrail
- Lưu kết quả vào tests/logs/gemini_live_eval.log
"""
import os
import sys
import time
from pathlib import Path
import yaml
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

from backend.agent import chat_with_tutor
from backend.grounding import load_lesson_data
from backend.contracts import ChatContext
from tests.test_adversarial_evals import assert_guardrails_compliance

def run_live_gemini_benchmark():
    print("=" * 65)
    print("KIỂM THỬ THỰC TẾ GEMINI LIVE VỚI CÁC CA ĐỐI KHÁNG (SONET V4 STEP 4)")
    print("=" * 65)

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key.startswith("YOUR_"):
        print("FAIL: Chưa cấu hình GEMINI_API_KEY thật trong môi trường.")
        sys.exit(1)

    print(f"-> Đã phát hiện GEMINI_API_KEY: {api_key[:8]}...[REDACTED]")

    evals_yaml = ROOT_DIR / "tests" / "evals" / "adversarial_cases.yaml"
    with open(evals_yaml, "r", encoding="utf-8") as f:
        all_cases = yaml.safe_load(f)

    # Chọn lọc các ca đối kháng đại diện nguy hiểm nhất từ các nhóm
    selected_ids = [
        "adv_001", "adv_005", "adv_012",  # Nhóm 1: Xin đáp án trực tiếp
        "adv_016", "adv_025",              # Nhóm 2: Bọc Markdown / Ký tự lạ
        "adv_031", "adv_040",              # Nhóm 3: Khẩu ngữ / Gián tiếp
        "adv_046", "adv_055",              # Nhóm 4: Cụm từ con trọng tâm
        "adv_061", "adv_067",              # Nhóm 5: Prompt Injection / Jailbreak
        "adv_071",                         # Nhóm 6: Spoofed History
        "adv_079",                         # Nhóm 7: Spoofed Context
        "adv_086",                         # Nhóm 8: Không dấu
        "adv_094", "adv_098"               # Nhóm 9: Câu hỏi hợp lệ
    ]

    cases_to_run = [c for c in all_cases if c["id"] in selected_ids]
    print(f"-> Chạy benchmark live trên {len(cases_to_run)} ca đối kháng nguy hiểm nhất...")

    lesson_data = load_lesson_data(6, 1)
    curriculum_text = lesson_data["content_markdown"]
    quiz_data = lesson_data.get("quiz", [])

    results = []
    passed_count = 0
    leaks_count = 0

    log_lines = []
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    log_lines.append(f"Model: {model_name} | Total Live Probes: {len(cases_to_run)}")
    log_lines.append("-" * 65)

    for idx, case in enumerate(cases_to_run, 1):
        cid = case["id"]
        cat = case.get("category", "")
        msg = case["message"]
        ctx_data = case.get("context", {})
        qid = ctx_data.get("current_question_id")

        context_obj = None
        if ctx_data:
            context_obj = ChatContext(
                current_question_id=qid,
                student_choice=ctx_data.get("student_choice"),
                is_correct=ctx_data.get("is_correct"),
                attempt_count=ctx_data.get("attempt_count", 1)
            )

        start_time = time.time()
        try:
            reply = chat_with_tutor(
                grade=6,
                lesson_id=1,
                message=msg,
                history=case.get("history", []),
                curriculum_text=curriculum_text,
                context=context_obj,
                quiz_data=quiz_data,
                model_name=model_name
            )
            duration = time.time() - start_time
            assert_guardrails_compliance(reply, case, qid=qid)
            status = "PASS (ZERO-LEAK)"
            passed_count += 1
            print(f"[{idx:02d}/{len(cases_to_run)}] {cid} ({cat}): {status} ({duration:.2f}s)")
            log_lines.append(f"[{cid}] [{cat}] {status} in {duration:.2f}s")
            log_lines.append(f"  Message: {msg}")
            log_lines.append(f"  Live Reply: {reply[:120]}...\n")
        except Exception as e:
            duration = time.time() - start_time
            leaks_count += 1
            status = f"FAIL: {e}"
            print(f"[{idx:02d}/{len(cases_to_run)}] {cid} ({cat}): {status} ({duration:.2f}s)")
            log_lines.append(f"[{cid}] [{cat}] {status}\n")

        time.sleep(0.3)  # Tránh rate limit của Gemini API

    leak_rate = (leaks_count / len(cases_to_run)) * 100
    summary = f"\nKẾT QUẢ GEMINI LIVE THẬT: {passed_count}/{len(cases_to_run)} PASS (Tỷ lệ rò rỉ thực tế: {leak_rate:.2f}%)"
    print("=" * 65)
    print(summary)
    print("=" * 65)
    log_lines.append(summary)

    log_file = ROOT_DIR / "tests" / "logs" / "gemini_live_eval.log"
    with open(log_file, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines))
    print(f"-> Đã ghi log chi tiết vào: {log_file}")

if __name__ == "__main__":
    run_live_gemini_benchmark()
