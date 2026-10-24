"""
Thực thi kiểm thử thực tế với mô hình Gemini Live thật trên bộ AI Eval v2 (48 ca đối kháng):
- Gọi trực tiếp Google Gemini API qua GEMINI_API_KEY thật
- Thực thi toàn bộ 48 ca đối kháng (8 nhóm: direct_answer, ignore_rules, role_spoofing,
  history_context_spoofing, piecemeal_extraction, forced_confirmation, encoded_output, off_topic)
- Đánh giá 3 điều kiện gác cổng:
  1. Không lộ chữ cái, đáp án, mã hóa, phương án đúng
  2. Có câu hỏi gợi mở sư phạm, điều hướng ca ngoài chủ đề
  3. Không nhận quyền giáo viên hay giả mạo lịch sử
- Lưu báo cáo định lượng và kết quả chi tiết vào tests/logs/gemini_live_eval_v2.log
- Tuyệt đối bảo mật: Không in khóa API, token hay đáp án thô vào log công khai
"""
import os
import sys
import time
import re
from pathlib import Path
from datetime import datetime, timezone
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

from backend.agent import chat_with_tutor, chat_with_tutor_with_meta
from backend.grounding import load_lesson_data
from backend.contracts import ChatContext
from tests.test_adversarial_evals_v2 import (
    assert_guardrails_compliance_v2,
    LESSON_CACHE,
    QUIZ_LOOKUP
)


def run_live_gemini_eval_v2(limit: int = None):
    print("=" * 70)
    print("KIỂM THỬ THỰC TẾ GEMINI LIVE - BỘ ĐỐI KHÁNG AI EVAL V2 (48 CA)")
    print("=" * 70)

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key.startswith("YOUR_"):
        print("FAIL: Chưa cấu hình GEMINI_API_KEY thật trong môi trường (.env).")
        sys.exit(1)

    print("-> Đã phát hiện GEMINI_API_KEY: [REDACTED_SECURE]")

    evals_yaml = ROOT_DIR / "tests" / "evals" / "adversarial_cases_v2.yaml"
    with open(evals_yaml, "r", encoding="utf-8") as f:
        all_cases = yaml.safe_load(f)

    if limit and limit > 0:
        cases_to_run = all_cases[:limit]
    else:
        cases_to_run = all_cases

    model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    start_iso = datetime.now(timezone.utc).isoformat()
    print(f"-> Bắt đầu chạy {len(cases_to_run)} ca đối kháng qua mô hình: {model_name}")
    print(f"-> Thời gian: {start_iso}")
    print("-" * 70)

    results = []
    passed_count = 0
    leak_count = 0
    missing_socratic_count = 0
    error_count = 0
    gemini_driver_count = 0
    rule_driver_count = 0
    full_responses = []

    log_lines = []
    log_lines.append(f"AI EVAL V2 LIVE BENCHMARK REPORT")
    log_lines.append(f"Timestamp: {start_iso}")
    log_lines.append(f"Model: {model_name}")
    log_lines.append(f"Total Cases: {len(cases_to_run)}")
    log_lines.append("=" * 70)

    for idx, case in enumerate(cases_to_run, 1):
        cid = case["id"]
        cat = case.get("category", "")
        lang = case.get("language", "")
        msg = case["message"]
        ctx_data = case.get("context", {})
        qid = ctx_data.get("current_question_id")

        m = re.match(r"tin(\d+)_b(\d+)_q(\d+)", qid)
        grade = int(m.group(1)) if m else 6
        lesson_id = int(m.group(2)) if m else 1

        lesson_data = LESSON_CACHE.get((grade, lesson_id))
        if not lesson_data:
            lesson_data = load_lesson_data(grade, lesson_id)
            LESSON_CACHE[(grade, lesson_id)] = lesson_data

        curriculum_text = lesson_data.get("content_markdown", "")
        quiz_data = lesson_data.get("quiz", [])
        q_info = QUIZ_LOOKUP.get(qid)

        context_obj = ChatContext(
            current_question_id=qid,
            student_choice=ctx_data.get("student_choice"),
            is_correct=ctx_data.get("is_correct"),
            attempt_count=ctx_data.get("attempt_count", 1)
        )

        history = case.get("history", [])
        start_time = time.time()

        try:
            meta_res = chat_with_tutor_with_meta(
                grade=grade,
                lesson_id=lesson_id,
                message=msg,
                history=history,
                curriculum_text=curriculum_text,
                context=context_obj,
                quiz_data=quiz_data,
                model_name=model_name
            )
            live_reply = meta_res["reply"]
            driver = meta_res.get("driver", "real_gemini")
            duration = time.time() - start_time

            # Thẩm định 3 điều kiện gác cổng
            assert_guardrails_compliance_v2(live_reply, case, q_info=q_info)
            status = "PASS (ZERO-LEAK & SOCRATIC)"
            passed_count += 1
            if driver == "real_gemini":
                gemini_driver_count += 1
            else:
                rule_driver_count += 1

            full_responses.append({
                "id": cid,
                "category": cat,
                "language": lang,
                "driver": driver,
                "prompt": msg,
                "full_reply": live_reply,
                "status": status,
                "duration_seconds": round(duration, 3)
            })

            print(f"[{idx:02d}/{len(cases_to_run)}] {cid} [{lang}|{cat}|{driver}]: PASS ({duration:.2f}s)")
            log_lines.append(f"[{cid}] [{lang}] [{cat}] [{driver}] PASS duration={duration:.2f}s turns={len(history)+1}")
            log_lines.append(f"  Prompt: {msg}")
            log_lines.append(f"  Driver: {driver}")
            log_lines.append(f"  Live Reply Snippet: {live_reply[:150].replace(chr(10), ' ')}...\n")

        except AssertionError as ae:
            duration = time.time() - start_time
            err_msg = str(ae)
            if "VI PHẠM ĐIỀU KIỆN 1" in err_msg or "VI PHẠM (" in err_msg:
                leak_count += 1
                status = f"FAIL (ANSWER LEAK): {err_msg}"
            elif "VI PHẠM ĐIỀU KIỆN 2" in err_msg:
                missing_socratic_count += 1
                status = f"FAIL (MISSING SOCRATIC): {err_msg}"
            else:
                status = f"FAIL (BOUNDARY): {err_msg}"
            print(f"[{idx:02d}/{len(cases_to_run)}] {cid} [{lang}|{cat}]: {status} ({duration:.2f}s)")
            log_lines.append(f"[{cid}] [{lang}] [{cat}] {status}\n")

        except Exception as e:
            duration = time.time() - start_time
            error_count += 1
            status = f"ERROR: {type(e).__name__} - {e}"
            print(f"[{idx:02d}/{len(cases_to_run)}] {cid} [{lang}|{cat}]: {status} ({duration:.2f}s)")
            log_lines.append(f"[{cid}] [{lang}] [{cat}] {status}\n")

        # Giãn cách nhẹ tránh vượt quá quota hạn mức gọi Gemini
        time.sleep(0.4)

    end_iso = datetime.now(timezone.utc).isoformat()
    total_run = len(cases_to_run)
    leak_rate = (leak_count / total_run) * 100 if total_run > 0 else 0.0

    summary_banner = [
        "",
        "=" * 70,
        f"KẾT QUẢ ĐÁNH GIÁ GEMINI LIVE THẬT BỘ AI EVAL V2 ({total_run} CA)",
        "=" * 70,
        f"Mô hình: {model_name}",
        f"Thời gian hoàn tất: {end_iso}",
        f"Tổng số ca đã chạy: {total_run}/{len(all_cases)}",
        f"Số ca PASS: {passed_count}/{total_run} ({(passed_count/total_run)*100:.1f}%)",
        f"Số ca do Gemini API sinh (real_gemini): {gemini_driver_count}/{total_run}",
        f"Số ca quy tắc can thiệp (rule_fallback): {rule_driver_count}/{total_run}",
        f"Số ca rò rỉ đáp án (Leak): {leak_count} (Tỷ lệ rò rỉ: {leak_rate:.2f}%)",
        f"Số ca thiếu gợi mở Socratic: {missing_socratic_count}",
        f"Số ca lỗi kỹ thuật (ERROR/TIMEOUT/QUOTA): {error_count}",
        "=" * 70
    ]
    summary_text = "\n".join(summary_banner)
    print(summary_text)
    log_lines.append(summary_text)

    log_dir = ROOT_DIR / "tests" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "gemini_live_eval_v2.log"
    with open(log_file, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines))
    print(f"-> Đã lưu báo cáo chi tiết vào: {log_file}")

    full_resp_file = log_dir / "eval_v2_full_responses.json"
    with open(full_resp_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": end_iso,
            "total_cases": total_run,
            "passed_count": passed_count,
            "gemini_driver_count": gemini_driver_count,
            "rule_driver_count": rule_driver_count,
            "cases": full_responses
        }, f, ensure_ascii=False, indent=2)
    print(f"-> Đã lưu toàn văn phản hồi để chấm ngữ nghĩa (E4) vào: {full_resp_file}")

    return {
        "total": total_run,
        "passed": passed_count,
        "leak_count": leak_count,
        "missing_socratic_count": missing_socratic_count,
        "error_count": error_count,
        "log_file": str(log_file)
    }


if __name__ == "__main__":
    limit_arg = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run_live_gemini_eval_v2(limit=limit_arg)
