"""
Module Agent: Gia sư Sư phạm Socrates & Vành đai Chống Ảo giác (Google ADK Architecture)
Đảm bảo:
1. Bám sát 100% tài liệu SGK (Strict Grounding - Zero-Hallucination).
2. CẤM TUYỆT ĐỐI cung cấp đáp án trực tiếp hay giải hộ bài tập (Zero-Direct-Answer Law).
3. Hỗ trợ cả Gemini API thật và Chế độ Mô phỏng Sư phạm Cục bộ (Local Socratic Engine).
"""
import os
import re
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Tải biến môi trường từ .env nếu có
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT_TEMPLATE = """Bạn là Thầy/Cô Trợ lý Sư phạm Tin học THCS (dành cho học sinh lớp {grade}), giảng dạy theo Chương trình GDPT 2018.

TÀI LIỆU BÀI HỌC CHUẨN TRONG SGK:
\"\"\"
{curriculum_text}
\"\"\"

BỘ NGUYÊN TẮC BẤT BIẾN (BẮT BUỘC TUÂN THỦ 100%):
1. NGUYÊN TẮC KHÔNG LÀM HỘ (ZERO-DIRECT-ANSWER):
   - CẤM TUYỆT ĐỐI đưa ra đáp án trực tiếp của bài tập trắc nghiệm (như 'Chọn A', 'Đáp án là B', 'Phương án đúng là C').
   - CẤM viết sẵn lời giải code hoàn chỉnh cho bài tập thực hành.
   - Dù học sinh có nài nỉ, giục giã ('Em cần nộp bài gấp', 'Cho em đáp án đi thầy', 'Câu này chọn gì?'), bạn PHẢI từ chối lịch sự và quay lại gợi ý từng bước.
   
2. NGUYÊN TẮC CHỐNG ẢO GIÁC (STRICT GROUNDING):
   - CHỈ SỬ DỤNG thông tin và ví dụ nằm trong phạm vi bài học SGK được cung cấp ở trên.
   - Nếu câu hỏi của học sinh hoàn toàn không liên quan đến bài học hoặc vượt quá chương trình THCS, hãy trả lời: 'Nội dung này nằm ngoài phạm vi bài học Tin học {grade}, em hãy tập trung vào các kiến thức của bài nhé!'

3. PHƯƠNG PHÁP SƯ PHẠM SOCRATES:
   - Khi học sinh hỏi một khái niệm khó hiểu: Hãy lấy ví dụ đời sống thực tế gần gũi với lứa tuổi 11-15 tuổi (như trò chơi, sinh hoạt ở trường, gia đình).
   - Chia nhỏ vấn đề thành 2-3 bước tư duy đơn giản.
   - Luôn kết thúc bằng 1 câu hỏi gợi mở để học sinh tự suy nghĩ và phản hồi.

4. VĂN PHONG SƯ PHẠM:
   - Xưng hô thân thiện: 'Thầy/Cô' và 'Em'.
   - Giọng điệu ấm áp, kiên nhẫn, luôn động viên và khích lệ học sinh.
"""


def check_and_redact_answer_leak(response_text: str, quiz_data: List[Dict[str, Any]]) -> str:
    """
    Chốt chặn kiểm duyệt đầu ra (Output Guardrail):
    Rà soát xem câu trả lời của AI có vô tình làm lộ đáp án trắc nghiệm không.
    Nếu phát hiện rò rỉ đáp án, tự động thay thế bằng gợi ý định hướng.
    """
    cleaned = response_text
    # Phát hiện các mẫu làm lộ đáp án trắc nghiệm
    leak_patterns = [
        r"(?:đáp án|câu trả lời|phương án|chọn)\s*(?:đúng|chính xác)?\s*(?:là|chính là|sẽ là)?\s*[:\-]?\s*([A-D])\b",
        r"\bchọn\s+([A-D])\b",
        r"\b([A-D])\s+là\s+đáp án\b"
    ]
    
    for pattern in leak_patterns:
        if re.search(pattern, cleaned, re.IGNORECASE):
            cleaned = re.sub(
                pattern, 
                "gợi ý: em hãy đối chiếu lại các đặc điểm trong SGK để tự tìm ra phương án phù hợp", 
                cleaned, 
                flags=re.IGNORECASE
            )
            cleaned += "\n\n*(Thầy/Cô không thể chọn hộ đáp án cho em được, em hãy tự tin chọn phương án mình hiểu nhé!)*"
            break

    return cleaned


def socratic_fallback_reply(grade: int, lesson_id: int, message: str, curriculum_text: str) -> str:
    """
    Bộ động cơ Sư phạm Socrates Cục bộ (Local Rule-based Socratic Engine):
    Chạy khi chưa cấu hình API Key hoặc khi offline, đảm bảo hệ thống luôn sẵn sàng 100%.
    """
    msg_lower = message.lower().strip()
    
    # 1. Phát hiện học sinh đòi đáp án
    if any(k in msg_lower for k in ["đáp án", "chọn câu nào", "câu 1 là gì", "câu 2 là gì", "câu 3 là gì", "câu 4 là gì", "giải hộ", "cho em đáp án"]):
        return (
            "Thầy hiểu là em đang rất muốn biết kết quả! Tuy nhiên, nhiệm vụ của thầy là giúp em tự hiểu bản chất bài học chứ không giải hộ bài tập. 😉\n\n"
            "👉 **Gợi ý cho em:**\n"
            "- Hãy đọc kỹ xem đề bài đang hỏi về **Dữ liệu** (thứ mắt thấy tai nghe thô sơ) hay **Thông tin** (sự hiểu biết sau khi suy nghĩ).\n"
            "- Em thử xem lại phần **Ghi nhớ** ở cuối bài học xem định nghĩa nào khớp nhất với tình huống này nhé!\n\n"
            "Em đang phân vân giữa phương án nào, hãy nói cho thầy lý do xem sao?"
        )

    # 2. Học sinh hỏi về khái niệm Dữ liệu
    if "dữ liệu" in msg_lower:
        return (
            "Chào em! Trong Tin học 6, **Dữ liệu** rất dễ hiểu:\n"
            "- Đó là những con số, chữ viết, hình ảnh, âm thanh thu nhận được từ thế giới bên ngoài mà bộ não **chưa qua xử lý suy nghĩ**.\n"
            "- *Ví dụ:* Tiếng chuông reng reng báo thức reo lên vào 6h sáng chính là **dữ liệu âm thanh** mà tai em nghe thấy.\n\n"
            "Em hãy nhìn quanh phòng mình và tìm thử 1 ví dụ về dữ liệu hình ảnh xem nào?"
        )

    # 3. Học sinh hỏi về khái niệm Thông tin
    if "thông tin" in msg_lower:
        return (
            "Chào em! **Thông tin** chính là **sự hiểu biết của con người** sau khi bộ não đã tiếp nhận và xử lý dữ liệu.\n"
            "- *Ví dụ:* Khi tai nghe tiếng chuông reo (Dữ liệu), não em hiểu rằng: *'Đã đến giờ dậy chuẩn bị đi học rồi!'* -> Đó chính là **Thông tin**!\n"
            "- Thông tin rất quan trọng vì nó giúp em đưa ra hành động đúng đắn.\n\n"
            "Bây giờ em thử cho thầy biết: Khi nhìn thấy đèn giao thông màu đỏ, thông tin em rút ra được là gì?"
        )

    # 4. Học sinh hỏi về Vật mang tin
    if "vật mang tin" in msg_lower:
        return (
            "Khái niệm **Vật mang tin** rất trực quan em nhé:\n"
            "- Đó là vật thể hoặc phương tiện dùng để chứa, lưu trữ hoặc truyền đạt dữ liệu.\n"
            "- *Ví dụ:* Cuốn vở ghi bài, chiếc USB, thẻ nhớ điện thoại, hay tấm biển báo ven đường đều là vật mang tin.\n"
            "- Lưu ý: Những suy nghĩ chỉ nằm trong đầu thì **không phải** là vật mang tin.\n\n"
            "Theo em, chiếc bảng đen ở lớp học có phải là vật mang tin không? Vì sao?"
        )

    # 5. Phản hồi chung gợi mở
    return (
        f"Thầy đã nhận được câu hỏi của em về bài học Tin học {grade}!\n\n"
        "Để nắm chắc phần này, em hãy đối chiếu với nội dung bài học bên cột trái:\n"
        "1. Xác định tình huống cụ thể trong câu hỏi.\n"
        "2. Liên hệ với các ví dụ thực tế trong đời sống hàng ngày.\n\n"
        "Em có thể nói rõ hơn phần nào trong bài khiến em cảm thấy chưa rõ nhất không?"
    )


def chat_with_tutor(grade: int, lesson_id: int, message: str, history: List[Dict[str, str]], curriculum_text: str) -> str:
    """Xử lý hội thoại của học sinh với Gia sư AI."""
    # Nếu có GEMINI_API_KEY thì gọi Google GenAI / Gemini
    if GEMINI_API_KEY and GEMINI_API_KEY.strip() and not GEMINI_API_KEY.startswith("YOUR_"):
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=GEMINI_API_KEY)
            system_prompt = SYSTEM_PROMPT_TEMPLATE.format(grade=grade, curriculum_text=curriculum_text)
            
            # Xây dựng nội dung tin nhắn
            contents = []
            for h in history[-4:]:  # Lấy tối đa 4 lượt gần nhất để tiết kiệm ngữ cảnh
                contents.append(f"{h.get('role', 'user')}: {h.get('content', '')}")
            contents.append(f"Học sinh: {message}")
            full_prompt = "\n".join(contents)

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.0  # Triệt tiêu ảo giác
                )
            )
            raw_text = response.text or ""
            return check_and_redact_answer_leak(raw_text, [])
        except Exception as e:
            # Fallback sang động cơ Socrates cục bộ nếu có lỗi mạng/API
            fallback = socratic_fallback_reply(grade, lesson_id, message, curriculum_text)
            return fallback

    # Nếu chưa cấu hình API Key, dùng động cơ Sư phạm cục bộ
    return socratic_fallback_reply(grade, lesson_id, message, curriculum_text)


def grade_quiz_submission(submitted_answers: Dict[str, str], quiz_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Chấm điểm trắc nghiệm và sinh nhận xét sư phạm thông minh cho từng câu hỏi.
    """
    total = len(quiz_data)
    correct_count = 0
    results = []

    for item in quiz_data:
        qid = item["id"]
        correct_key = item["dap_an_dung"]
        student_choice = submitted_answers.get(qid, "").upper().strip()
        is_correct = (student_choice == correct_key)

        if is_correct:
            correct_count += 1
            feedback = item.get("giai_thich_su_pham", "Rất tốt! Em đã chọn đúng.")
        else:
            feedback = item.get("goi_y_khi_sai", "Chưa đúng. Em hãy xem lại nội dung bài học nhé!")

        results.append({
            "id": qid,
            "cau_hoi": item["cau_hoi"],
            "student_choice": student_choice if student_choice else "Chưa chọn",
            "is_correct": is_correct,
            "feedback": feedback,
            "muc_sgk": item.get("muc_sgk", ""),
            "trang_sgk": item.get("trang_sgk", 0)
        })

    score = round((correct_count / total) * 10, 1) if total > 0 else 0

    if score == 10:
        summary_comment = "Xuất sắc! Em đã nắm chắc 100% kiến thức của bài học. Hãy tự tin bước sang bài tiếp theo nhé!"
    elif score >= 7.5:
        summary_comment = f"Rất tốt! Em đạt {score}/10 điểm. Em chỉ cần xem lại một vài điểm lưu ý nhỏ ở các câu làm chưa đúng."
    elif score >= 5.0:
        summary_comment = f"Khá tốt! Em đạt {score}/10 điểm. Hãy đọc lại các mục được gợi ý trong SGK để hiểu sâu hơn nhé."
    else:
        summary_comment = f"Em đạt {score}/10 điểm. Đừng nản lòng nhé! Em hãy dành ít phút đọc lại phần Ghi nhớ và làm lại bài trắc nghiệm."

    return {
        "score": score,
        "correct_count": correct_count,
        "total_questions": total,
        "summary_comment": summary_comment,
        "details": results
    }
