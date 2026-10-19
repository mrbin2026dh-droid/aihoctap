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

SYSTEM_PROMPT_TEMPLATE = """Bạn là Thầy/Cô Trợ lý Sư phạm Tin học THCS (dành cho học sinh lớp {grade}), giảng dạy theo chuẩn Sách giáo khoa Tin học.

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


# Bổ sung lớp nhận diện ký tự định dạng Markdown (*, _, `, ngoặc) quanh chữ cái A-D
_OPT_WRAP = r"[\*_`\"'\(\[\s]*([A-D])[\*_`\"'\)\]]*(?:\b|$)"

LEAK_PATTERNS = [
    # Mẫu 1: "đáp án đúng là **B**", "phương án chính xác là: A", "kết quả: C", "đáp án của câu này là D"
    rf"(?:đáp án|câu trả lời|phương án|lựa chọn|kết quả)(?:\s+của\s+câu(?:\s+\w+)?)?(?:\s+này)?(?:\s+đúng|\s+chính xác|\s+chuẩn)?(?:\s+nhất)?(?:\s+là|\s+sẽ là)?\s*[:\-]?[ \t]*{_OPT_WRAP}",
    # Mẫu 2: "hãy chọn B", "em chọn đáp án **C** nhé", "nên chọn D", "khoanh vào câu C"
    rf"(?:hãy chọn|chọn ngay|em chọn|nên chọn|chọn đáp án|chọn phương án|khoanh vào|khoanh)\s+(?:vào\s+)?(?:câu\s+|phương án\s+)?{_OPT_WRAP}",
    # Mẫu 3: "chọn B nhé", "chọn câu A đi em"
    rf"\b(?:chọn|khoanh|đánh dấu)(?:\s+câu|\s+ý)?\s+{_OPT_WRAP}\s*(?:nhé|nha|đi em|nào|là đúng)",
    # Mẫu 4: Đảo ngữ "D là đáp án chính xác nhất", "Phương án B là đúng", "**C** là câu trả lời chính xác"
    rf"(?:phương án|đáp án|câu|ý)?\s*{_OPT_WRAP}\s+là\s+(?:đáp án\s+|phương án\s+)?(?:đúng|chính xác|hoàn toàn đúng)(?:\s+nhất)?",
    # Mẫu 5: Diễn đạt tự do (Sonet P1-6): "chữ B mới chuẩn", "cái B mới đúng", "B mới chuẩn"
    rf"\b(?:cái|phương án|chữ|câu)\s+{_OPT_WRAP}\s+(?:mới\s+)?(?:chuẩn|đúng|chính xác)",
    rf"\b{_OPT_WRAP}\s+mới\s+(?:chuẩn|đúng|chính xác)\b",
    rf"\b(?:cái thứ|phương án thứ)\s+(?:nhất|hai|ba|tư|1|2|3|4)\s+(?:mới\s+)?(?:chuẩn|đúng|chính xác|là đáp án|là câu trả lời)",
    # Mẫu 6: Tương thích mở rộng
    r"\bchọn\s+([A-D])\b",
    r"\b([A-D])\s+(?:mới\s+)?là\s+đáp án\b",
]

SOCRATIC_REDIRECT_MSG = (
    "Thầy không đưa ngay chữ cái đáp án đâu nhé! "
    "Em hãy dựa vào gợi ý bên trên, đối chiếu xem đâu là **Dữ liệu** (những gì nhìn/nghe thấy), "
    "đâu là **Thông tin** (ý nghĩa rút ra) và đâu là **Vật mang tin** (vật chứa đựng) để tự mình tìm ra câu trả lời nhé."
)


def check_and_redact_answer_leak(
    response_text: str, 
    quiz_data: Optional[List[Dict[str, Any]]] = None,
    current_question_id: Optional[str] = None
) -> str:
    """
    Chốt chặn kiểm duyệt đầu ra (Output Guardrail):
    1. Quét theo các biểu thức Regex mở rộng (LEAK_PATTERNS) nhận diện chữ cái A-D (kể cả bọc Markdown).
    2. Quét đối chiếu nội dung văn bản thực tế của đáp án đúng (Sonet P0-1 Option Text Leak) từ quiz_data.
    Nếu phát hiện rò rỉ đáp án, tự động thay thế bằng gợi ý định hướng sư phạm.
    """
    if not response_text:
        return response_text

    cleaned = response_text
    leak_detected = False

    # 1. Quét các mẫu regex ký tự lựa chọn A-D
    for pattern in LEAK_PATTERNS:
        if re.search(pattern, cleaned, flags=re.IGNORECASE):
            leak_detected = True
            cleaned = re.sub(
                pattern, 
                "gợi ý: em hãy đối chiếu lại các đặc điểm trong SGK để tự tìm ra phương án phù hợp", 
                cleaned, 
                flags=re.IGNORECASE
            )

    # 2. Quét đối chiếu nội dung văn bản thực tế của đáp án đúng (Sonet P0-1 Option Text Leak)
    if quiz_data:
        for q in quiz_data:
            if current_question_id and q.get("id") != current_question_id:
                continue
            correct_key = q.get("dap_an_dung")
            choices = q.get("lua_chon", {})
            correct_text = str(choices.get(correct_key, "")).strip()
            if correct_text and len(correct_text) >= 2:
                # Danh sách các biến thể chuỗi: cả cụm đầy đủ và cụm từ khóa rút gọn (Sonet R1)
                text_variants = [correct_text]
                words = correct_text.split()
                if len(words) >= 4:
                    text_variants.append(" ".join(words[:3]))  # ví dụ: "Suy nghĩ trong đầu"
                    text_variants.append(" ".join(words[-3:])) # ví dụ: "trong đầu con người"

                for variant in text_variants:
                    escaped_text = re.escape(variant)
                    text_leak_patterns = [
                        rf"(?:đáp án|phương án|kết quả|câu trả lời)(?:\s+\w+){{0,6}}?(?:\s+là|\s+sẽ là|\s*:)\s*[\*_`\"']*({escaped_text})[\*_`\"']*",
                        rf"(?:hãy chọn|chọn ngay|em chọn|nên chọn|khoanh vào|chọn)\s+(?:cái\s+)?[\*_`\"']*({escaped_text})[\*_`\"']*",
                        rf"\b({escaped_text})\s+là\s+(?:đáp án|phương án|câu trả lời)\s+(?:đúng|chính xác)\b",
                    ]
                    for tp in text_leak_patterns:
                        if re.search(tp, cleaned, flags=re.IGNORECASE):
                            leak_detected = True
                            cleaned = re.sub(
                                tp,
                                "gợi ý: em hãy đối chiếu lại các đặc điểm trong SGK để tự tìm ra phương án phù hợp",
                                cleaned,
                                flags=re.IGNORECASE
                            )

    if leak_detected and SOCRATIC_REDIRECT_MSG not in cleaned:
        cleaned += f"\n\n*(Thầy/Cô không thể chọn hộ đáp án cho em được, em hãy tự tin chọn phương án mình hiểu nhé!)*"

    return cleaned


# Bản đồ phân tích lỗi sai & Giàn giáo Sư phạm Đa tầng (3-Tier Scaffolding)
QUESTION_SCAFFOLDING = {
    "tin6_b1_q1": {
        "default": (
            "Ở **Câu 1**, đề bài đang nhắc đến tình huống: *'nhìn thấy ánh sáng đèn tín hiệu giao thông màu đỏ'*. 🚦\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Ánh sáng màu đỏ là thứ mà **mắt em thu nhận trực tiếp** từ thế giới bên ngoài, chưa qua bộ não suy nghĩ hay xử lý.\n"
            "- Em hãy mở lại Mục 1.a (SGK Trang 6) xem: Những con số, chữ viết, hình ảnh thu nhận qua giác quan được gọi là gì?\n\n"
            "Theo em, chỉ riêng luồng ánh sáng đỏ đó đã là sự hiểu biết để hành động chưa, hay nó mới là dữ liệu ban đầu?"
        ),
        "tier2_by_choice": {
            "A": "Về suy nghĩ ban đầu của em: Hãy nhớ lại: **Vật mang tin** là phương tiện hay vật thể hữu hình chứa dữ liệu (như cái cột đèn, tấm biển). Ở đây đề bài hỏi về bản thân 'luồng ánh sáng màu đỏ' mà mắt em nhìn thấy cơ! Luồng ánh sáng đó là gì nhỉ?",
            "C": "Về suy nghĩ ban đầu của em: Hãy chú ý: **Thông tin** là sự hiểu biết trong đầu em (như hiểu rằng 'phải dừng xe lại'). Còn 'luồng ánh sáng màu đỏ' mới chỉ là tín hiệu mắt em thu nhận từ bên ngoài thôi. Đó là gì trong SGK?",
            "D": "Về suy nghĩ ban đầu của em: Quyết định (như đạp phanh dừng xe) là hành động của em sau khi đã có thông tin. Luồng ánh sáng đỏ chiếu vào mắt em đóng vai trò gì trước khi em ra quyết định?"
        },
        "tier3": (
            "Gợi ý sát hơn cho em nhé: Hãy đặt câu hỏi *'Nhờ nhìn/nghe thấy cái này, mình biết được điều gì?'*. "
            "Cái mắt em nhìn thấy trực tiếp (màu đỏ) là **Dữ liệu**. "
            "Còn điều em hiểu ra trong đầu (phải dừng xe) mới là **Thông tin**!"
        )
    },
    "tin6_b1_q2": {
        "default": (
            "Ở **Câu 2**, câu hỏi hỏi về: *'Thông tin con người nhận được khi nhìn thấy ánh sáng đèn đỏ'*. 🧠\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Khi mắt thấy ánh sáng đỏ (Dữ liệu), bộ não em lập tức suy nghĩ và rút ra ý nghĩa gì?\n"
            "- Có phải não em hiểu rằng: *'Cần phải dừng xe lại để bảo đảm an toàn'* không?\n"
            "- Hãy nhớ: **Thông tin** là ý nghĩa và sự hiểu biết rút ra sau khi xử lý dữ liệu.\n\n"
            "Em thử đối chiếu lại xem phương án nào diễn tả đúng suy nghĩ trong đầu người tham gia giao thông nhé!"
        ),
        "tier2_by_choice": {
            "A": "Về suy nghĩ ban đầu của em: Ánh sáng đèn đỏ là **Dữ liệu** mắt em nhìn thấy. Đề bài đang hỏi về *sự hiểu biết trong đầu* (Thông tin) cơ mà!",
            "C": "Về suy nghĩ ban đầu của em: Cột đèn giao thông mới là **Vật mang tin**. Sự hiểu biết của người đi đường là gì nhỉ?",
            "D": "Về suy nghĩ ban đầu của em: Xe máy hay ô tô chỉ là phương tiện giao thông thôi, không phải là sự hiểu biết của con người."
        },
        "tier3": (
            "Mẹo nhỏ từ SGK: Khi thấy đèn đỏ, em biết mình **phải dừng xe lại**. Đó chính là sự hiểu biết giúp em an toàn!"
        )
    },
    "tin6_b1_q3": {
        "default": (
            "Ở **Câu 3**, đề bài yêu cầu tìm vật **KHÔNG PHẢI** là một vật mang tin. 📦\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Em hãy mở lại Mục 2 (SGK Trang 6) để đọc lại khái niệm cốt lõi: Thế nào là một **Vật mang tin**?\n"
            "- Hãy chú ý đến yếu tố: Phương tiện đó có phải là một **vật thể vật lý** ở thế giới bên ngoài mà em có thể nhìn thấy, chạm vào hoặc trao đổi được không?\n\n"
            "Trong 4 phương án, em thấy phương án nào khác biệt nhất về tính chất vật lý?"
        ),
        "tier2_by_choice": {
            "A": "Về suy nghĩ của em: Em hãy đối chiếu: Cuốn vở có các trang giấy chứa chữ viết bài học. Chữ viết là dữ liệu ghi trên giấy. Vậy cuốn vở có phải là một vật thể đóng vai trò phương tiện chứa dữ liệu không?",
            "B": "Về suy nghĩ của em: Chiếc thẻ nhớ lưu trữ các tệp âm thanh và hình ảnh. Các tệp đó là dữ liệu số. Thẻ nhớ có đóng vai trò là một vật thể lưu giữ dữ liệu không?",
            "D": "Về suy nghĩ của em: Tấm biển báo ven đường mang các hình vẽ ký hiệu cho người đi đường. Bản thân tấm biển kim loại đó có phải là một vật thể chứa đựng dữ liệu hình vẽ không?"
        },
        "tier3": (
            "Gợi ý định hướng thêm cho em: Hãy đặt câu hỏi: *'Điều này có tồn tại dưới dạng một vật thể bên ngoài có thể truyền tay nhau được không, hay nó chỉ là hoạt động nhận thức vô hình?'*. "
            "Đối chiếu 4 phương án với câu hỏi đó nhé!"
        )
    },
    "tin6_b1_q4": {
        "default": (
            "Ở **Câu 4**, đề bài hỏi về **tầm quan trọng lớn nhất** của thông tin. 🎯\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Hãy nhớ lại ví dụ: Khi nghe dự báo thời tiết báo ngày mai trời trở rét (Thông tin), em sẽ làm gì?\n"
            "- Nhờ có thông tin, em biết mặc thêm áo ấm, tức là giúp em **đưa ra quyết định và hành động đúng đắn**.\n\n"
            "Em hãy đọc lại Mục 3 (SGK Trang 7) để tìm câu trả lời chuẩn xác nhất nhé!"
        ),
        "tier2_by_choice": {
            "A": "Giải trí chỉ là một phần nhỏ trong cuộc sống. Mục đích quan trọng nhất của thông tin khi học tập và làm việc là gì?",
            "B": "Lưu trữ sách vở là nhiệm vụ của vật mang tin hoặc thư viện, chưa phải là ích lợi lớn nhất đối với hành động con người.",
            "D": "Tốc độ máy tính là do phần cứng, thông tin là để phục vụ cho sự hiểu biết của con người."
        },
        "tier3": (
            "Hãy nhớ: Thông tin giúp con người nâng cao hiểu biết và quan trọng nhất là **đưa ra các quyết định đúng đắn**!"
        )
    },
    # =========================================================================
    # GIÀN GIÁO SƯ PHẠM TIN HỌC 9 (BÀI 1 ĐẾN BÀI 5)
    # =========================================================================
    "tin9_b1_q1": {
        "default": (
            "Ở **Câu 1**, đề bài hỏi về thành phần đóng vai trò như **'bộ não'** của các thiết bị kĩ thuật số. 🧠\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trong máy tính hay thiết bị thông minh, bộ phận nào trực tiếp tính toán các phép toán logic và điều khiển thực thi câu lệnh?\n"
            "- Em hãy mở lại Mục 1 (SGK Tin học 9 Trang 5) xem chữ viết tắt CPU là viết tắt của từ gì nhé!"
        ),
        "tier2_by_choice": {
            "B": "Màn hình chỉ có nhiệm vụ hiển thị kết quả trực quan ra bên ngoài (thiết bị ra), không thể tính toán hay điều khiển hệ thống được em nhé.",
            "C": "Vỏ máy chỉ có tác dụng bảo vệ phần cứng vật lý bên ngoài.",
            "D": "Dây nguồn chỉ truyền năng lượng điện, không có khả năng xử lý thông tin hay dữ liệu."
        },
        "tier3": (
            "Gợi ý sát: Hãy tìm linh kiện vi mạch điện tử thực hiện tính toán cốt lõi, thường được gọi là CPU!"
        )
    },
    "tin9_b1_q2": {
        "default": (
            "Ở **Câu 2**, đề bài yêu cầu tìm vật **KHÔNG PHẢI** là thiết bị số có tích hợp bộ xử lí thông tin. 🔍\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Thiết bị số bắt buộc phải có vi mạch điện tử, bộ xử lí hoặc cảm biến để hoạt động tự động.\n"
            "- Trong 4 phương án, vật dụng nào là đồ dùng học tập truyền thống hoàn toàn không có mạch điện?"
        ),
        "tier2_by_choice": {
            "A": "Máy ATM có cả hệ thống máy tính, bộ xử lý và kết nối mạng ngân hàng để đếm tiền và giao dịch tự động.",
            "C": "Robot hút bụi có bộ vi xử lý và cảm biến laser để quét phòng và lập bản đồ di chuyển.",
            "D": "Điện thoại thông minh là thiết bị số cá nhân rất mạnh mẽ với chip xử lý đa nhân."
        },
        "tier3": (
            "Gợi ý sát: Bảng dùng phấn viết thông thường trên lớp có vi mạch điện tử nào bên trong không?"
        )
    },
    "tin9_b1_q3": {
        "default": (
            "Ở **Câu 3**, đề bài nhắc đến hệ thống thu phí tự động không dừng (ETC) trên đường cao tốc. 🛣️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Hệ thống này được lắp đặt ở đâu và phục vụ cho các đối tượng phương tiện nào (ô tô, xe tải)?\n"
            "- Việc giúp xe lưu thông liên tục không cần dừng mua vé thuộc lĩnh vực đời sống nào trong SGK?"
        ),
        "tier2_by_choice": {
            "B": "Nông nghiệp liên quan đến trồng trọt, chăn nuôi; trạm thu phí đường cao tốc không thuộc nông nghiệp.",
            "C": "Mỹ thuật liên quan đến vẽ tranh, điêu khắc nghệ thuật.",
            "D": "Thời trang liên quan đến trang phục may mặc."
        },
        "tier3": (
            "Gợi ý sát: Đường cao tốc và các trạm thu phí là cơ sở hạ tầng của ngành Giao thông vận tải!"
        )
    },
    "tin9_b1_q4": {
        "default": (
            "Ở **Câu 4**, đề bài hỏi về điều **KHÔNG PHẢI** là ưu thế của máy tính so với con người. 💻\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Máy tính vượt trội con người về: Tốc độ tính toán, độ chuẩn xác, dung lượng nhớ khổng lồ và làm việc 24/7.\n"
            "- Tuy nhiên, máy tính có biết buồn vui, yêu ghét hay đồng cảm như con người không?"
        ),
        "tier2_by_choice": {
            "A": "Tốc độ hàng tỷ phép tính mỗi giây là ưu thế vượt trội hàng đầu của máy tính.",
            "B": "Khả năng lưu trữ hàng triệu cuốn sách là ưu thế lớn của bộ nhớ máy tính.",
            "D": "Làm việc bền bỉ liên tục không mệt mỏi là thế mạnh của máy móc so với sức người."
        },
        "tier3": (
            "Gợi ý sát: Cảm xúc, tình cảm và lòng trắc ẩn là đặc quyền tâm lý chỉ có ở con người, máy tính không thể có!"
        )
    },
    "tin9_b2_q1": {
        "default": (
            "Ở **Câu 1 - Bài 2**, đề bài hỏi về **căn cứ quan trọng nhất** để con người ra quyết định giải quyết vấn đề. 🎯\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Muốn giải quyết một bài toán hay ra quyết định đúng đắn, chúng ta cần căn cứ vào điều gì đã thu thập được?"
        ),
        "tier2_by_choice": {
            "B": "Phỏng đoán may rủi rất dễ dẫn đến sai lầm nguy hiểm.",
            "C": "Cảm tính nhất thời không mang tính khoa học vững chắc.",
            "D": "Tin đồn không rõ nguồn gốc là thông tin kém chất lượng, gây hại cho quyết định."
        },
        "tier3": (
            "Gợi ý sát: Thông tin thu thập chính xác là cơ sở quan trọng nhất để con người giải quyết vấn đề!"
        )
    },
    "tin9_b2_q2": {
        "default": (
            "Ở **Câu 2 - Bài 2**, tình huống bạn Mai dùng số liệu tuyển sinh lớp 10 của **3 năm trước** để nộp hồ sơ năm nay. 📅\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Số liệu của 3 năm trước đã cũ và không phản ánh đúng tình hình tuyển sinh của năm học hiện tại.\n"
            "- Điều này vi phạm tiêu chí nào trong 4 tiêu chí: Tính mới, tính chính xác, tính đầy đủ, tính sử dụng được?"
        ),
        "tier2_by_choice": {
            "B": "Tính bảo mật liên quan đến việc giấu kín thông tin, không phải về thời điểm cập nhật.",
            "C": "Tính thẩm mỹ liên quan đến vẻ đẹp hình thức, không phải chất lượng nội dung.",
            "D": "Tính dung lượng liên quan đến kích thước file (KB, MB), không phản ánh thời gian."
        },
        "tier3": (
            "Gợi ý sát: Dữ liệu bị cũ, lỗi thời là vi phạm Tính mới (Tính cập nhật) của thông tin!"
        )
    },
    "tin9_b2_q3": {
        "default": (
            "Ở **Câu 3 - Bài 2**, đề bài yêu cầu tìm nguồn tin có **độ tin cậy và chính xác cao nhất** về kỳ thi vào lớp 10. 🏛️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Cơ quan nhà nước nào chịu trách nhiệm quản lý chuyên ngành và tổ chức kỳ thi tuyển sinh lớp 10 tại địa phương?"
        ),
        "tier2_by_choice": {
            "B": "Tài khoản ẩn danh trên diễn đàn không có căn cứ pháp lý và dễ lan truyền tin đồn sai lệch.",
            "C": "Bài đăng không rõ nguồn trên mạng xã hội thường câu like và độ chính xác rất thấp.",
            "D": "Tin nhắn quảng cáo dịch vụ có mục đích thương mại, không phải văn bản quy chế chính thức."
        },
        "tier3": (
            "Gợi ý sát: Cổng thông tin điện tử chính thức của Sở Giáo dục và Đào tạo là nguồn tin chính thống cao nhất!"
        )
    },
    "tin9_b2_q4": {
        "default": (
            "Ở **Câu 4 - Bài 2**, thông tin về kỹ thuật chăn nuôi rất mới và chuẩn xác, nhưng em đang cần giải bài Tin học 9. 🎯\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Thông tin dù đúng nhưng không ăn nhập gì với mục đích bài toán cần làm thì nó thiếu tiêu chí nào?"
        ),
        "tier2_by_choice": {
            "B": "Đề bài đã cho biết thông tin mới xuất bản hôm qua nên nó không hề thiếu tính mới.",
            "C": "Đề bài đã cho biết thông tin có số liệu rất chính xác nên không hề thiếu tính chính xác."
        },
        "tier3": (
            "Gợi ý sát: Không phù hợp, không dùng được cho mục tiêu giải quyết vấn đề nghĩa là thiếu Tính sử dụng được!"
        )
    },
    "tin9_b3_q1": {
        "default": (
            "Ở **Câu 1 - Bài 3**, câu hỏi tìm dấu hiệu của nguồn tin có **độ tin cậy kém hoặc tin giả**. ⚠️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Các trang tin giả mạo câu tương tác thường có đặc điểm gì ở tiêu đề và tên tác giả?"
        ),
        "tier2_by_choice": {
            "A": "Tên miền .gov.vn và .edu.vn là tên miền được nhà nước bảo hộ cho cơ quan và trường học uy tín.",
            "C": "Có trích dẫn nguồn số liệu rõ ràng là dấu hiệu của bài viết khoa học nghiêm túc.",
            "D": "Được các chuyên gia và cơ quan báo chí dẫn lại là minh chứng cho độ tin cậy cao."
        },
        "tier3": (
            "Gợi ý sát: Tiêu đề giật gân, thiếu tên tác giả và không ghi ngày tháng cập nhật là dấu hiệu tin giả điển hình!"
        )
    },
    "tin9_b3_q2": {
        "default": (
            "Ở **Câu 2 - Bài 3**, câu hỏi hỏi về **bước đầu tiên** trước khi tiến hành tra cứu trên công cụ tìm kiếm. 🔍\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trước khi gõ tìm kiếm, em cần biết rõ mình đang tìm cái gì và dùng từ ngữ nào để máy tính hiểu đúng?"
        ),
        "tier2_by_choice": {
            "B": "Mở cùng lúc quá nhiều tab chỉ gây phân tâm và làm máy tính chậm chạp.",
            "C": "Nhấp ngẫu nhiên vào link quảng cáo rất dễ dẫn đến trang lừa đảo hoặc mã độc.",
            "D": "Tải tệp lạ về máy tính cực kỳ nguy hiểm, có thể dính virus."
        },
        "tier3": (
            "Gợi ý sát: Xác định rõ mục tiêu cần tìm và chuẩn bị các từ khóa phù hợp là bước quan trọng số 1!"
        )
    },
    "tin9_b3_q3": {
        "default": (
            "Ở **Câu 3 - Bài 3**, gặp thông tin gây xôn xao về quy chế thi mới trên mạng xã hội. 🛡️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Cách hành xử thông minh và chuẩn khoa học nhất để biết tin đó đúng hay sai là gì?"
        ),
        "tier2_by_choice": {
            "A": "Chia sẻ ngay lập tức có thể vô tình tiếp tay lan truyền tin giả, vi phạm pháp luật.",
            "C": "Tranh cãi kích động không giúp tìm ra sự thật mà gây độc hại môi trường mạng.",
            "D": "Nhiều lượt thích không đồng nghĩa với sự thật, tin giả giật gân thường câu view rất nhiều like."
        },
        "tier3": (
            "Gợi ý sát: Luôn đối chiếu và kiểm chứng lại với văn bản chính thức trên Cổng thông tin của Bộ hoặc Sở GD&ĐT!"
        )
    },
    "tin9_b3_q4": {
        "default": (
            "Ở **Câu 4 - Bài 3**, chọn trường sau THCS mà thiếu các yếu tố tổ hợp môn học, điểm chuẩn, cơ sở vật chất. 📚\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Thiếu những khía cạnh quan trọng của vấn đề thì thông tin đã vi phạm tiêu chí chất lượng nào?"
        ),
        "tier2_by_choice": {
            "B": "Tính mới liên quan đến thời gian xuất bản, không phải về lượng thông tin đủ hay thiếu.",
            "C": "Tính hợp pháp liên quan đến quy định luật, không phải độ toàn diện của thông tin."
        },
        "tier3": (
            "Gợi ý sát: Bao quát đầy đủ các khía cạnh cần thiết là nội dung của Tính đầy đủ!"
        )
    },
    "tin9_b4_q1": {
        "default": (
            "Ở **Câu 1 - Bài 4**, câu hỏi về hành vi **VI PHẠM PHÁP LUẬT** trên Internet. ⚖️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Hành vi nào xâm phạm đến danh dự, nhân phẩm của người khác và bị Luật An ninh mạng nghiêm cấm?"
        ),
        "tier2_by_choice": {
            "A": "Tra cứu học tập là hành vi hoàn toàn đúng đắn và được khuyến khích.",
            "C": "Gửi email chúc mừng sinh nhật là giao tiếp văn minh, lành mạnh.",
            "D": "Tham gia lớp học trực tuyến là hoạt động giáo dục tích cực."
        },
        "tier3": (
            "Gợi ý sát: Đăng bài viết bịa đặt, vu khống bôi nhọ danh dự người khác là hành vi vi phạm pháp luật!"
        )
    },
    "tin9_b4_q2": {
        "default": (
            "Ở **Câu 2 - Bài 4**, sử dụng tác phẩm tranh ảnh của người khác vào bài báo tường. 🎨\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Để tôn trọng quyền sở hữu trí tuệ của tác giả, em cần thực hiện hành động gì?"
        ),
        "tier2_by_choice": {
            "A": "Xóa tên tác giả và nhận là của mình là hành vi đạo văn, vi phạm bản quyền nghiêm trọng.",
            "C": "Chỉnh sửa vài câu rồi nhận là của mình vẫn là vi phạm quyền tác giả.",
            "D": "Tài nguyên trên mạng vẫn có bản quyền thuộc về người sáng tạo ra nó."
        },
        "tier3": (
            "Gợi ý sát: Xin phép tác giả hoặc ghi rõ ràng họ tên tác giả cùng nguồn trích dẫn là tuân thủ bản quyền!"
        )
    },
    "tin9_b4_q3": {
        "default": (
            "Ở **Câu 3 - Bài 4**, câu hỏi về tác hại của việc vứt bỏ **rác thải điện tử** bừa bãi. 🔋\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Pin, điện thoại cũ, mạch điện tử chứa những chất kim loại nặng nào (chì, thủy ngân) gây hại gì cho môi trường?"
        ),
        "tier2_by_choice": {
            "B": "Kim loại nặng trong rác điện tử là chất cực độc, làm chết đất đai chứ không làm màu mỡ.",
            "C": "Linh kiện điện tử bằng nhựa và kim loại cần hàng trăm năm mới phân hủy, giải phóng chất độc.",
            "D": "Gây thiệt hại nặng nề về môi trường và sức khỏe cộng đồng."
        },
        "tier3": (
            "Gợi ý sát: Tạo ra rác thải điện tử nguy hại, giải phóng các kim loại nặng làm ô nhiễm đất và nguồn nước!"
        )
    },
    "tin9_b4_q4": {
        "default": (
            "Ở **Câu 4 - Bài 4**, hành vi lăng mạ, bêu xấu bạn bè trên mạng xã hội. 🛑\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Thuật ngữ quốc tế chỉ hành vi bắt nạt, tấn công người khác bằng ngôn từ trên mạng là gì?"
        ),
        "tier2_by_choice": {
            "B": "Hành vi gây tổn thương tâm lý nặng nề cho bạn không bao giờ là trò đùa vô hại.",
            "C": "Tự do ngôn luận không bao gồm quyền xúc phạm, bôi nhọ người khác.",
            "D": "Đây là hành vi độc hại, hoàn toàn đi ngược lại văn hóa ứng xử trên mạng."
        },
        "tier3": (
            "Gợi ý sát: Đó là Bạo lực mạng (Cyberbullying) - vi phạm chuẩn mực đạo đức và pháp luật!"
        )
    },
    "tin9_b5_q1": {
        "default": (
            "Ở **Câu 1 - Bài 5**, đề bài hỏi về định nghĩa chuẩn của **'Phần mềm mô phỏng'**. 🔬\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Hai đặc điểm cốt lõi của phần mềm mô phỏng: Tái hiện trực quan cách thức hoạt động của đối tượng và cho phép người dùng làm gì?"
        ),
        "tier2_by_choice": {
            "B": "Phần mềm chỉ chiếu video là trình phát video thụ động, không có tính tương tác mô phỏng.",
            "C": "Phần mềm gõ văn bản là Microsoft Word, LibreOffice Writer, không phải phần mềm mô phỏng.",
            "D": "Hệ thống nghe nhạc chỉ xử lý âm thanh giải trí."
        },
        "tier3": (
            "Gợi ý sát: Phần mềm mô phỏng tái hiện trực quan sự vận động của đối tượng thực và cho phép tương tác, thay đổi thông số!"
        )
    },
    "tin9_b5_q2": {
        "default": (
            "Ở **Câu 2 - Bài 5**, hỏi về **lợi ích quan trọng nhất** của phần mềm mô phỏng trong học tập Khoa học tự nhiên. 🧪\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trong môn Hóa học hay Vật lý, khi làm thí nghiệm có nguy cơ cháy nổ độc hại hoặc quá vi mô, phần mềm mô phỏng giúp ích gì?"
        ),
        "tier2_by_choice": {
            "B": "Phần mềm mô phỏng kích thích tư duy khám phá chứ không làm học sinh lười suy nghĩ.",
            "C": "Công cụ mô phỏng hỗ trợ đắc lực chứ không thể thay thế sự hướng dẫn sư phạm của thầy cô.",
            "D": "Phần mềm mô phỏng giúp tiết kiệm chi phí phòng lab, không làm tốn kém tiền bạc."
        },
        "tier3": (
            "Gợi ý sát: Đảm bảo an toàn tuyệt đối khi quan sát thí nghiệm nguy hiểm và trực quan hóa các hiện tượng trừu tượng!"
        )
    },
    "tin9_b5_q3": {
        "default": (
            "Ở **Câu 3 - Bài 5**, so sánh giữa xem **video thí nghiệm** và dùng **phần mềm mô phỏng**. 🎬 ↔️ 🎮\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Xem video là thụ động (kết quả cố định). Còn trên phần mềm mô phỏng, em có thể làm gì với các nút điều khiển, con trượt thông số?"
        ),
        "tier2_by_choice": {
            "B": "Video thông thường chỉ phát lại hình ảnh đã quay sẵn, không cho phép em can thiệp dữ liệu.",
            "C": "Video và phần mềm mô phỏng khác nhau hoàn toàn về tính năng tương tác hai chiều.",
            "D": "Phần mềm mô phỏng có hình ảnh trực quan động 2D/3D rất sống động."
        },
        "tier3": (
            "Gợi ý sát: Phần mềm mô phỏng cho phép người dùng thay đổi các thông số đầu vào để quan sát kết quả mới tương ứng!"
        )
    },
    "tin9_b5_q4": {
        "default": (
            "Ở **Câu 4 - Bài 5**, hỏi về phần mềm **Solar System Scope**. 🪐\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Cụm từ 'Solar System' trong tiếng Anh có nghĩa là gì? Nó giúp chúng ta quan sát Mặt Trời và các hành tinh nào?"
        ),
        "tier2_by_choice": {
            "B": "Phần mềm pha màu là Trycolors.com, không phải Solar System Scope.",
            "C": "Tính toán kế toán là Microsoft Excel, không liên quan đến vũ trụ.",
            "D": "Thiết kế web là các công cụ lập trình web."
        },
        "tier3": (
            "Gợi ý sát: Solar System Scope mô phỏng Thiên văn học và chuyển động của các hành tinh trong Hệ Mặt Trời!"
        )
    },
    # --- Bài 6: Thực hành: Khai thác phần mềm mô phỏng ---
    "tin9_b6_q1": {
        "default": (
            "Ở **Câu 1 - Bài 6**, bước đầu tiên khi bắt đầu thực hành với phần mềm mô phỏng. 🎯\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trước khi điều chỉnh các nút bấm hay con trượt, em cần biết mục đích mình làm thí nghiệm để kiểm chứng điều gì?"
        ),
        "tier2_by_choice": {
            "A": "Bấm liên tục không có kế hoạch sẽ làm kết quả bị loạn, không giúp em hiểu được hiện tượng khoa học.",
            "C": "Phần mềm mô phỏng là để trực quan hóa, không nên bỏ cuộc khi chưa bắt đầu.",
            "D": "Chụp ảnh màn hình chỉ là bước lưu trữ sau khi đã hoàn thành thí nghiệm."
        },
        "tier3": (
            "Gợi ý sát: Xác định rõ ràng mục tiêu thí nghiệm và hiện tượng khoa học cần khảo sát là bước đầu tiên!"
        )
    },
    "tin9_b6_q2": {
        "default": (
            "Ở **Câu 2 - Bài 6**, định luật Ohm trong PhET khi giữ nguyên R và tăng hiệu điện thế U. ⚡\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Công thức I = U / R: Khi điện áp U tăng lên thì dòng điện I chạy qua bóng đèn sẽ biến đổi như thế nào?"
        ),
        "tier2_by_choice": {
            "B": "Cường độ dòng điện I tỉ lệ thuận với hiệu điện thế U, không thể giảm về 0 khi U tăng được.",
            "C": "Phần mềm PhET được thiết kế hoạt động ổn định với dải điện áp học đường, không bị văng lỗi.",
            "D": "Khi tăng hiệu điện thế, dòng điện và độ sáng bóng đèn chắc chắn sẽ thay đổi rõ rệt."
        },
        "tier3": (
            "Gợi ý sát: Cường độ dòng điện I sẽ tăng lên tỉ lệ thuận và bóng đèn sẽ sáng rực rỡ hơn!"
        )
    },
    "tin9_b6_q3": {
        "default": (
            "Ở **Câu 3 - Bài 6**, hỏi về tính năng **'tương tác hai chiều'** của phần mềm mô phỏng. 🔄\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Người dùng không chỉ xem thụ động mà có thể làm gì với các thanh trượt và nút điều khiển?"
        ),
        "tier2_by_choice": {
            "A": "Xem thụ động là đặc điểm của đoạn video thông thường, không phải phần mềm mô phỏng.",
            "C": "Màn hình tự động chuyển bài không thể hiện được sự can thiệp tham số của người dùng.",
            "D": "Kết quả hiển thị trực tiếp và sinh động ngay trên màn hình số."
        },
        "tier3": (
            "Gợi ý sát: Người dùng có thể chủ động thay đổi thông số đầu vào và quan sát kết quả thay đổi tức thì!"
        )
    },
    "tin9_b6_q4": {
        "default": (
            "Ở **Câu 4 - Bài 6**, tính năng **điều chỉnh tốc độ thời gian** trong Solar System Scope. ⏱️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trái Đất quay quanh Mặt Trời mất 365 ngày ngoài đời thực. Để học sinh thấy trọn vẹn chu kỳ đó trong tiết học, tính năng tua thời gian giúp ích gì?"
        ),
        "tier2_by_choice": {
            "A": "Tốc độ xử lý của phần cứng máy tính không thay đổi khi chỉnh thời gian trong phần mềm.",
            "C": "Phần mềm chỉ tái hiện mô hình số, không tác động đến vị trí thực tế của các thiên thể ngoài vũ trụ.",
            "D": "Tính năng này phục vụ cho việc quan sát mô phỏng, không phải chế độ tiết kiệm pin."
        },
        "tier3": (
            "Gợi ý sát: Giúp quan sát chu kỳ chuyển động vốn mất nhiều tháng ngoài đời thực chỉ trong vài giây!"
        )
    },
    # --- Bài 7: Trình bày thông tin trong trao đổi và hợp tác ---
    "tin9_b7_q1": {
        "default": (
            "Ở **Câu 1 - Bài 7**, hỏi về **lợi ích nổi bật nhất** của các công cụ trực quan hóa thông tin. 📊\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Khi người nghe nhìn vào hình ảnh, sơ đồ và biểu đồ so với việc đọc một trang toàn chữ, họ tiếp thu như thế nào?"
        ),
        "tier2_by_choice": {
            "B": "Mục đích của công cụ là tối ưu hóa truyền đạt, không phải để làm nặng bộ nhớ máy.",
            "C": "Công cụ trực quan hỗ trợ bài phát biểu trở nên sinh động chứ không thay thế hoàn toàn lời nói.",
            "D": "Hình ảnh giúp kích thích thị giác và não bộ tiếp thu nhanh hơn văn bản thuần túy rất nhiều."
        },
        "tier3": (
            "Gợi ý sát: Giúp người nghe tiếp thu thông tin nhanh hơn, dễ ghi nhớ và tăng tính thuyết phục!"
        )
    },
    "tin9_b7_q2": {
        "default": (
            "Ở **Câu 2 - Bài 7**, công cụ phát triển các **nhánh ý tưởng logic từ một chủ đề trung tâm**. 🌳\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Công cụ nào có cấu trúc phân nhánh tỏa tròn như cành cây từ tâm ra các phía?"
        ),
        "tier2_by_choice": {
            "A": "Phần mềm nghe nhạc chỉ phát các tệp âm thanh.",
            "C": "Hòm thư điện tử dùng để gửi và nhận thư từ trao đổi.",
            "D": "Văn bản thuần túy không có cấu trúc phân nhánh trực quan tỏa tròn."
        },
        "tier3": (
            "Gợi ý sát: Sơ đồ tư duy (Mindmap) là công cụ chuyên dụng để phát triển các nhánh ý tưởng!"
        )
    },
    "tin9_b7_q3": {
        "default": (
            "Ở **Câu 3 - Bài 7**, nguyên tắc thiết kế **trang trình chiếu (PowerPoint)** chuẩn mực. 🖥️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trang slide hiệu quả nên chứa nhiều chữ hay từ khóa cô đọng? Màu chữ và nền cần như thế nào để dễ đọc?"
        ),
        "tier2_by_choice": {
            "A": "Chép nguyên cả trang sách sẽ khiến slide rối mắt và người nghe không muốn đọc.",
            "B": "Chữ vàng trên nền trắng có độ tương phản cực kỳ thấp, người ngồi dưới sẽ không nhìn thấy gì.",
            "D": "Quá nhiều hiệu ứng động sẽ làm người nghe xao nhãng khỏi thông điệp chính."
        },
        "tier3": (
            "Gợi ý sát: Chỉ trình bày các từ khóa cốt lõi, chọn cỡ chữ đủ lớn và có độ tương phản rõ ràng giữa chữ và nền!"
        )
    },
    "tin9_b7_q4": {
        "default": (
            "Ở **Câu 4 - Bài 7**, tính năng hỗ trợ **hợp tác làm việc nhóm từ xa**. 🤝\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Để các bạn ở nhà khác nhau cùng đóng góp vào một bài thuyết trình, tính năng đám mây nào là quan trọng nhất?"
        ),
        "tier2_by_choice": {
            "B": "Mỗi người làm một tệp riêng rồi gộp thủ công rất dễ xảy ra xung đột và mất thời gian.",
            "C": "Khóa truy cập sẽ làm tê liệt hoạt động phối hợp nhóm.",
            "D": "Gửi bưu điện hoàn toàn không phù hợp với kỷ nguyên số."
        },
        "tier3": (
            "Gợi ý sát: Tính năng chia sẻ liên kết cho phép nhiều người cùng xem và chỉnh sửa đồng thời theo thời gian thực!"
        )
    },
    # --- Bài 8: Thực hành: Sử dụng công cụ trực quan trình bày thông tin ---
    "tin9_b8_q1": {
        "default": (
            "Ở **Câu 1 - Bài 8**, thành phần liên kết các ý tưởng trong **sơ đồ tư duy**. 🔗\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Để nối các ý con với chủ đề chính trong Mindmap, chúng ta sử dụng đường nét gì?"
        ),
        "tier2_by_choice": {
            "B": "Không có bức tường ngăn cách nào trong sơ đồ tư duy.",
            "C": "Nếu không có đường nối thì người xem không thể nhận biết được quan hệ phân cấp ý tưởng.",
            "D": "Sơ đồ tư duy là biểu diễn đồ họa trực quan."
        },
        "tier3": (
            "Gợi ý sát: Các nhánh và đường liên kết có mũi tên hoặc màu sắc phân biệt!"
        )
    },
    "tin9_b8_q2": {
        "default": (
            "Ở **Câu 2 - Bài 8**, thông tin bắt buộc tại **Trang đầu tiên (Slide 1)** của bài báo cáo. 📑\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Khi người nghe bắt đầu theo dõi bài thuyết trình, điều đầu tiên họ cần biết là tên đề tài gì và ai trình bày?"
        ),
        "tier2_by_choice": {
            "A": "Bảng số liệu chi tiết thuộc về phần nội dung ở các slide sau.",
            "C": "Lời cảm ơn luôn được đặt ở trang kết thúc bài nói.",
            "D": "Trang đầu tiên cần giới thiệu chủ đề một cách ngắn gọn, súc tích."
        },
        "tier3": (
            "Gợi ý sát: Tên chủ đề báo cáo, tên nhóm học tập và danh sách các thành viên thực hiện!"
        )
    },
    "tin9_b8_q3": {
        "default": (
            "Ở **Câu 3 - Bài 8**, phân quyền chia sẻ tệp để người khác **CHỈ ĐƯỢC XEM**. 👁️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Từ tiếng Anh nào có nghĩa là Người xem / Khán giả, ngăn chặn người khác sửa xóa nội dung của em?"
        ),
        "tier2_by_choice": {
            "A": "Quyền Editor (Chỉnh sửa) sẽ cho phép người nhận chỉnh sửa hoặc xóa nhầm dữ liệu của em.",
            "B": "Owner là người tạo ra tệp, nắm quyền kiểm soát tối cao.",
            "D": "Administrator là quản trị viên hệ thống."
        },
        "tier3": (
            "Gợi ý sát: Thiết lập quyền Viewer (Người xem) để khóa quyền chỉnh sửa!"
        )
    },
    "tin9_b8_q4": {
        "default": (
            "Ở **Câu 4 - Bài 8**, định dạng tệp tối ưu để **in ấn và không bị nhảy font chữ**. 📄\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Định dạng tệp tài liệu di động nổi tiếng toàn cầu nào luôn khóa cố định bố cục khi mở trên mọi thiết bị?"
        ),
        "tier2_by_choice": {
            "A": "MP3 là định dạng âm thanh giải trí.",
            "C": "ZIP là tệp nén dung lượng, bên trong vẫn chứa các file gốc.",
            "D": "EXE là tệp chương trình chạy phần mềm trên hệ điều hành Windows."
        },
        "tier3": (
            "Gợi ý sát: Định dạng tài liệu cố định PDF giữ nguyên định dạng 100% khi in ấn!"
        )
    },
    # --- Bài 9: Sử dụng công cụ xác thực dữ liệu và hàm điều kiện ---
    "tin9_b9_q1": {
        "default": (
            "Ở **Câu 1 - Bài 9**, mục đích của công cụ **Xác thực dữ liệu (Data Validation)**. 🛡️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Công cụ này hoạt động như một người gác cổng tại ô tính, có nhiệm vụ kiểm soát điều gì khi người dùng gõ dữ liệu?"
        ),
        "tier2_by_choice": {
            "A": "Tô màu nền là tính năng Fill Color hoặc Conditional Formatting.",
            "C": "Data Validation bảo vệ tính chính xác của dữ liệu, không bao giờ xóa dữ liệu máy tính.",
            "D": "Đây là tính năng nghiệp vụ của phần mềm bảng tính."
        },
        "tier3": (
            "Gợi ý sát: Kiểm soát và giới hạn dữ liệu được phép nhập vào ô tính, ngăn chặn việc nhập sai ngay từ đầu!"
        )
    },
    "tin9_b9_q2": {
        "default": (
            "Ở **Câu 2 - Bài 9**, thiết lập tiêu chí cho cột **điểm kiểm tra từ 0 đến 10**. 💯\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Điểm số học sinh có các giá trị thập phân (ví dụ: 6.5, 8.25). Ta cần chọn kiểu số nguyên hay số thực?"
        ),
        "tier2_by_choice": {
            "A": "Text length chỉ đo độ dài của chuỗi ký tự, không kiểm soát được giá trị số.",
            "C": "Điểm số không phải là kiểu ngày tháng năm.",
            "D": "Nếu không thiết lập thì người dùng có thể nhập nhầm điểm 100 hay chữ cái vào cột điểm."
        },
        "tier3": (
            "Gợi ý sát: Kiểu số thực (Decimal) với điều kiện 'between' từ 0 đến 10!"
        )
    },
    "tin9_b9_q3": {
        "default": (
            "Ở **Câu 3 - Bài 9**, cú pháp chuẩn của **hàm điều kiện IF**. ⚖️\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Công thức =IF(..., ..., ...) gồm mấy vị trí đối số ngăn cách nhau bởi dấu phẩy?"
        ),
        "tier2_by_choice": {
            "A": "Hàm IF cần cả điều kiện và các giá trị trả về tương ứng, không thể chỉ có 1 đối số.",
            "B": "2 đối số là thiếu trường hợp điều kiện sai.",
            "D": "Hàm IF tiêu chuẩn chỉ có đúng 3 đối số."
        },
        "tier3": (
            "Gợi ý sát: 3 đối số: (điều_kiện_logic, giá_trị_nếu_đúng, giá_trị_nếu_sai)!"
        )
    },
    "tin9_b9_q4": {
        "default": (
            "Ở **Câu 4 - Bài 9**, tính kết quả công thức: `=IF(C2 >= 5, \"Đạt\", \"Chưa đạt\")` với C2 = 7. 🧮\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Kiểm tra biểu thức 7 >= 5 là ĐÚNG hay SAI? Khi ĐÚNG thì hàm IF trả về đối số thứ hai hay thứ ba?"
        ),
        "tier2_by_choice": {
            "A": "\"Chưa đạt\" chỉ xuất hiện khi giá trị C2 nhỏ hơn 5.",
            "C": "Cú pháp hoàn toàn hợp lệ, không có lỗi tính toán.",
            "D": "Hàm IF luôn trả về một trong hai kết quả đã khai báo."
        },
        "tier3": (
            "Gợi ý sát: Vì 7 >= 5 là ĐÚNG nên kết quả trả về là \"Đạt\"!"
        )
    },
    # --- Bài 10: Thực hành: Xử lý dữ liệu bảng tính nâng cao ---
    "tin9_b10_q1": {
        "default": (
            "Ở **Câu 1 - Bài 10**, công thức **đếm số học sinh đạt loại 'Tốt'** trong vùng F2:F40. 📋\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Hàm kết hợp giữa ĐẾM (COUNT) và NẾU (IF) để đếm các ô thỏa mãn tiêu chí là hàm gì?"
        ),
        "tier2_by_choice": {
            "A": "Hàm SUM là tính tổng các số, không dùng để đếm chuỗi chữ.",
            "C": "Cú pháp =IF(F2:F40=\"Tốt\") không phải là hàm thống kê đếm số lượng.",
            "D": "AVERAGE là hàm tính trung bình cộng."
        },
        "tier3": (
            "Gợi ý sát: Sử dụng hàm =COUNTIF(F2:F40, \"Tốt\") để đếm theo điều kiện!"
        )
    },
    "tin9_b10_q2": {
        "default": (
            "Ở **Câu 2 - Bài 10**, phân biệt giữa **hàm SUM** và **hàm SUMIF**. ➕ ↔️ 🔍\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Hàm SUM cộng tất cả, còn chữ 'IF' trong SUMIF mang lại khả năng chọn lọc nào?"
        ),
        "tier2_by_choice": {
            "A": "Cả hai hàm đều có thể tính toán cho hàng nghìn ô dữ liệu.",
            "C": "SUM là tính tổng, AVERAGE mới là tính trung bình.",
            "D": "Hàm SUMIF có thêm phần kiểm tra điều kiện trước khi cộng."
        },
        "tier3": (
            "Gợi ý sát: SUM cộng tất cả các ô, còn SUMIF chỉ cộng những ô thỏa mãn một điều kiện nhất định!"
        )
    },
    "tin9_b10_q3": {
        "default": (
            "Ở **Câu 3 - Bài 10**, vai trò của vùng `C2:C15` trong công thức `=SUMIF(A2:A15, \"Sách giáo khoa\", C2:C15)`. 💰\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Trong hàm SUMIF, vị trí thứ ba [sum_range] chứa dữ liệu gì để máy cộng lại?"
        ),
        "tier2_by_choice": {
            "A": "Vùng tiêu chí kiểm tra là A2:A15 ở vị trí thứ nhất.",
            "C": "Tên trang tính được đặt riêng ở thanh tab dưới cùng.",
            "D": "Công thức này dùng để tính tổng, không liên quan đến thao tác xóa cột."
        },
        "tier3": (
            "Gợi ý sát: C2:C15 là vùng chứa các giá trị số cần tính tổng (sum_range)!"
        )
    },
    "tin9_b10_q4": {
        "default": (
            "Ở **Câu 4 - Bài 10**, công cụ **trích xuất danh sách học sinh Xuất sắc** mà không làm mất dữ liệu khác. 🔍\n\n"
            "👉 **Gợi ý tư duy:**\n"
            "- Công cụ nào có biểu tượng chiếc phễu, chỉ tạm ẩn các dòng không thỏa mãn để hiển thị danh sách cần tìm?"
        ),
        "tier2_by_choice": {
            "A": "Xóa dòng sẽ làm mất vĩnh viễn dữ liệu học sinh trong sổ điểm.",
            "C": "Vẽ hình che lại là thao tác thủ công không có tính khoa học trong bảng tính.",
            "D": "Khởi động lại máy tính không giúp trích xuất danh sách theo tiêu chí."
        },
        "tier3": (
            "Gợi ý sát: Sử dụng công cụ Lọc dữ liệu tự động (AutoFilter) để lọc theo điều kiện!"
        )
    }
}


def socratic_fallback_reply(
    grade: int, 
    lesson_id: int, 
    message: str, 
    curriculum_text: str = "", 
    context: Optional[Any] = None,
    quiz_data: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Bộ động cơ Sư phạm Socrates Cục bộ (Local Socratic Engine):
    Xử lý thông minh khi chưa có API Key hoặc khi phòng máy trường học mất mạng.
    Hỗ trợ cả ngữ cảnh câu hỏi cụ thể lẫn câu hỏi tự do kết hợp Giàn giáo 3 Tầng (3-Tier Scaffolding).
    """
    msg_lower = (message or "").lower().strip()
    
    # 1. Kịch bản học sinh nài nỉ hoặc đòi đáp án trực tiếp
    if any(k in msg_lower for k in ["đáp án", "chọn câu nào", "câu 1 là gì", "câu 2 là gì", "câu 3 là gì", "câu 4 là gì", "giải hộ", "cho em đáp án", "nói luôn đáp án", "chỉ luôn", "a hay b", "c hay d"]):
        refusal = (
            "Thầy hiểu là em đang rất muốn biết kết quả! Tuy nhiên, nhiệm vụ của thầy là giúp em tự hiểu bản chất bài học chứ không giải hộ bài tập. 😉\n\n"
            "👉 **Gợi ý cho em:**\n"
            "- Hãy đọc kỹ xem đề bài đang hỏi về **Dữ liệu** (thứ mắt thấy tai nghe thô sơ) hay **Thông tin** (sự hiểu biết sau khi suy nghĩ).\n"
            "- Em thử xem lại phần **Ghi nhớ** ở cuối bài học xem định nghĩa nào khớp nhất với tình huống này nhé!\n\n"
            "Em đang phân vân giữa phương án nào, hãy nói cho thầy lý do xem sao?"
        )
        return check_and_redact_answer_leak(refusal)

    # 2. Xử lý các câu hỏi về Khái niệm & Ví dụ cụ thể (Ưu tiên trả lời đúng câu hỏi của học sinh)
    # 2.1. Học sinh hỏi về Vật mang tin (Ví dụ trong lớp học / thực tế)
    if "vật mang tin" in msg_lower:
        if "lớp học" in msg_lower or "ví dụ" in msg_lower or "trường" in msg_lower:
            return (
                "Chào em! Trong **lớp học** của chúng mình có rất nhiều **Vật mang tin** gần gũi:\n\n"
                "1. 📚 **Sách giáo khoa & Vở ghi bài**: Chứa đựng chữ viết, hình vẽ và sơ đồ để lưu trữ kiến thức bài học.\n"
                "2. ⬛ **Chiếc Bảng đen / Bảng từ**: Nơi thầy cô viết phấn hoặc gắn tranh ảnh để truyền đạt bài giảng cho cả lớp.\n"
                "3. 💾 **Chiếc USB bài giảng**: Thầy cô cắm vào máy tính, máy chiếu để truyền tải bài thuyết trình điện tử.\n"
                "4. 📋 **Tấm Bảng nội quy lớp học**: Treo trên tường mang các điều khoản, quy định bằng chữ viết.\n\n"
                "👉 **Bí quyết nhận diện:** Vật mang tin bắt buộc phải là một **vật thể hữu hình** bên ngoài dùng để chứa hoặc truyền đạt dữ liệu.\n\n"
                "Bây giờ em thử nhìn quanh bàn học của mình xem chiếc hộp bút hay chiếc cặp sách có phải là vật mang tin không? Vì sao?"
            )
        return (
            "Khái niệm **Vật mang tin** rất trực quan em nhé:\n"
            "- Đó là vật thể hoặc phương tiện dùng để chứa, lưu trữ hoặc truyền đạt dữ liệu.\n"
            "- *Ví dụ:* Cuốn vở ghi bài, chiếc USB, thẻ nhớ điện thoại, hay tấm biển báo ven đường đều là vật mang tin.\n"
            "- Lưu ý: Những suy nghĩ chỉ nằm trong đầu thì **không phải** là vật mang tin.\n\n"
            "Theo em, chiếc bảng đen ở lớp học có phải là vật mang tin không? Vì sao?"
        )

    # 2.2. Học sinh hỏi về khái niệm Dữ liệu
    if "dữ liệu" in msg_lower and ("là gì" in msg_lower or "ví dụ" in msg_lower or "khái niệm" in msg_lower or "phân biệt" in msg_lower):
        return (
            "Chào em! Trong Tin học 6, **Dữ liệu** rất dễ hiểu:\n"
            "- Đó là những con số, chữ viết, hình ảnh, âm thanh thu nhận được từ thế giới bên ngoài mà bộ não **chưa qua xử lý suy nghĩ**.\n"
            "- *Ví dụ:* Tiếng chuông reng reng báo thức reo lên vào 6h sáng chính là **dữ liệu âm thanh** mà tai em nghe thấy.\n\n"
            "Em hãy nhìn quanh phòng mình và tìm thử 1 ví dụ về dữ liệu hình ảnh xem nào?"
        )

    # 2.3. Học sinh hỏi về khái niệm Thông tin
    if "thông tin" in msg_lower and ("là gì" in msg_lower or "ví dụ" in msg_lower or "khái niệm" in msg_lower or "tầm quan trọng" in msg_lower):
        return (
            "Chào em! **Thông tin** chính là **sự hiểu biết của con người** sau khi bộ não đã tiếp nhận và xử lý dữ liệu.\n"
            "- *Ví dụ:* Khi tai nghe tiếng chuông reo (Dữ liệu), não em hiểu rằng: *'Đã đến giờ dậy chuẩn bị đi học rồi!'* -> Đó chính là **Thông tin**!\n"
            "- Thông tin rất quan trọng vì nó giúp em đưa ra hành động đúng đắn.\n\n"
            "Bây giờ em thử cho thầy biết: Khi nhìn thấy đèn giao thông màu đỏ, thông tin em rút ra được là gì?"
        )

    # 2.4. Học sinh hỏi về Bộ xử lí CPU và Thiết bị số (Tin học 9 Bài 1)
    if any(k in msg_lower for k in ["bộ xử lí", "bộ vi xử lí", "cpu", "thiết bị số", "kĩ thuật số"]):
        return (
            "Chào em! Trong **Tin học 9 - Bài 1 (Thế giới kĩ thuật số)**:\n\n"
            "- **Bộ vi xử lí (CPU)**: Đóng vai trò là 'bộ não' của mọi thiết bị số, thực hiện các phép tính và điều khiển thiết bị theo câu lệnh.\n"
            "- **Thiết bị số**: Là các thiết bị được gắn bộ vi xử lí và cảm biến (như ti vi thông minh, máy ATM, robot hút bụi) để hoạt động tự động và thông minh.\n\n"
            "Em thử quan sát trong nhà mình xem ngoài điện thoại và máy tính, còn thiết bị nào có gắn bộ xử lí thông tin nữa không?"
        )

    # 2.5. Học sinh hỏi về Tiêu chí đánh giá chất lượng thông tin (Tin học 9 Bài 2 & 3)
    if any(k in msg_lower for k in ["tiêu chí", "chất lượng thông tin", "tính mới", "tính chính xác", "tính đầy đủ", "tính sử dụng được"]):
        return (
            "Chào em! Để đánh giá chất lượng thông tin trong **Tin học 9 (Bài 2 & 3)**, chúng ta nhớ quy tắc **MỚI - ĐÚNG - ĐỦ - DÙNG ĐƯỢC**:\n\n"
            "1. ⏱️ **Tính mới**: Thông tin phản ánh đúng thời điểm hiện tại, không dùng dữ liệu đã cũ hay hết hạn.\n"
            "2. 🎯 **Tính chính xác**: Số liệu và sự kiện đúng sự thật, từ nguồn chính thống uy tín.\n"
            "3. 📋 **Tính đầy đủ**: Bao quát toàn diện các khía cạnh cần thiết của vấn đề.\n"
            "4. 💡 **Tính sử dụng được**: Có ích và phù hợp trực tiếp với mục tiêu giải quyết vấn đề.\n\n"
            "Theo em, khi tìm hiểu điểm thi tuyển sinh lớp 10, tiêu chí nào là quan trọng nhất để tránh bị nộp nhầm hồ sơ?"
        )

    # 2.6. Học sinh hỏi về Pháp lí, Bản quyền, Rác thải điện tử (Tin học 9 Bài 4)
    if any(k in msg_lower for k in ["pháp lí", "bản quyền", "rác thải điện tử", "bạo lực mạng", "cyberbullying"]):
        return (
            "Chào em! Bài 4 môn **Tin học 9** giáo dục chúng mình trở thành **Công dân số có trách nhiệm**:\n\n"
            "- ⚖️ **Bản quyền**: Luôn xin phép hoặc trích dẫn nguồn tác giả rõ ràng khi sử dụng tranh ảnh, tài liệu trên mạng.\n"
            "- 🛡️ **Ứng xử văn minh**: Nói KHÔNG với tin giả, vu khống và bạo lực mạng (Cyberbullying).\n"
            "- 🔋 **Bảo vệ môi trường**: Thu gom rác thải điện tử đúng cách, không vứt bỏ bừa bãi vì chứa kim loại nặng độc hại (chì, thủy ngân).\n\n"
            "Em đã từng thấy ví dụ nào về việc chia sẻ thông tin cần trích dẫn nguồn tác giả chưa?"
        )

    # 2.7. Học sinh hỏi về Phần mềm mô phỏng (Tin học 9 Bài 5)
    if any(k in msg_lower for k in ["phần mềm mô phỏng", "mô phỏng", "phet", "solar system", "geogebra"]):
        return (
            "Chào em! **Phần mềm mô phỏng (Tin học 9 - Bài 5 & 6)** là công cụ học tập cực kỳ thú vị:\n\n"
            "- 🔬 **Khái niệm**: Tái hiện trực quan cách thức hoạt động của đối tượng thực tế và cho phép em tương tác hai chiều.\n"
            "- 🎮 **Tương tác**: Em có thể thay đổi thông số (vận tốc, khối lượng, góc độ, hiệu điện thế U) để xem ngay kết quả biến đổi trên màn hình.\n"
            "- 🛡️ **Lợi ích**: Đảm bảo an toàn tuyệt đối (tránh cháy nổ hóa chất), tiết kiệm chi phí và trực quan hóa các hiện tượng vi mô, vũ trụ.\n"
            "- 🌟 *Ví dụ*: PhET (Khoa học tự nhiên), Solar System Scope (Hệ Mặt Trời), GeoGebra (Toán học).\n\n"
            "Em đã thử làm thí nghiệm nào với PhET hay Solar System chưa?"
        )

    # 2.8. Học sinh hỏi về Trực quan hóa & Sơ đồ tư duy (Tin học 9 Bài 7 & 8)
    if any(k in msg_lower for k in ["sơ đồ tư duy", "mindmap", "trực quan hóa", "bài trình chiếu", "slide", "powerpoint"]):
        return (
            "Chào em! **Trực quan hóa thông tin (Tin học 9 - Bài 7 & 8)** giúp truyền đạt ý tưởng hiệu quả vượt trội:\n\n"
            "- 🌳 **Sơ đồ tư duy (Mindmap)**: Bắt đầu từ chủ đề trung tâm, phát triển các nhánh cấp 1, cấp 2 tỏa tròn logic kèm biểu tượng và màu sắc.\n"
            "- 🖥️ **Nguyên tắc trình chiếu**: Ít chữ, nhiều hình ảnh, độ tương phản cao (chữ sáng trên nền tối hoặc ngược lại), cỡ chữ đủ lớn để người ngồi xa vẫn đọc rõ.\n"
            "- 🤝 **Chia sẻ an toàn**: Thiết lập quyền **Viewer (Người xem)** khi chỉ muốn người khác đọc; quyền **Editor (Người sửa)** cho bạn cùng nhóm trực tiếp cộng tác.\n\n"
            "Em đang chuẩn bị bài thuyết trình về chủ đề gì, em dự định dùng sơ đồ tư duy hay slide?"
        )

    # 2.9. Học sinh hỏi về Xác thực dữ liệu & Hàm IF (Tin học 9 Bài 9)
    if any(k in msg_lower for k in ["xác thực dữ liệu", "data validation", "hàm if", "điều kiện if"]):
        return (
            "Chào em! **Xác thực dữ liệu và hàm IF (Tin học 9 - Bài 9)** là hai công cụ cực kỳ quyền năng trong bảng tính:\n\n"
            "- 🛡️ **Data Validation**: 'Người gác cổng' kiểm soát dữ liệu nhập vào ô tính (chỉ cho phép nhập số thực từ 0 đến 10 cho điểm số, hoặc tạo danh sách chọn thả xuống Drop-down list).\n"
            "- ⚖️ **Hàm IF**: Cú pháp gồm 3 đối số: `=IF(điều_kiện, giá_trị_nếu_đúng, giá_trị_nếu_sai)`.\n"
            "- 💡 *Ví dụ*: `=IF(D2>=5, \"Đạt\", \"Chưa đạt\")` -> Nếu điểm $\\ge 5$ trả về \"Đạt\", ngược lại trả về \"Chưa đạt\".\n\n"
            "Em có câu hỏi nào về cách viết biểu thức điều kiện trong hàm IF không?"
        )

    # 2.10. Học sinh hỏi về COUNTIF & SUMIF & Lọc dữ liệu (Tin học 9 Bài 10)
    if any(k in msg_lower for k in ["countif", "sumif", "autofilter", "lọc dữ liệu", "bảng tính nâng cao"]):
        return (
            "Chào em! **Xử lý dữ liệu bảng tính nâng cao (Tin học 9 - Bài 10)** gồm các công cụ thống kê chuyên nghiệp:\n\n"
            "- 🔢 **Hàm COUNTIF**: Đếm số ô thỏa mãn tiêu chí. Cú pháp: `=COUNTIF(vùng_dữ_liệu, tiêu_chí)` (ví dụ: `=COUNTIF(E2:E35, \"Đạt\")`).\n"
            "- ➕ **Hàm SUMIF**: Tính tổng các ô thỏa mãn tiêu chí. Cú pháp: `=SUMIF(vùng_kiểm_tra, điều_kiện, [vùng_tính_tổng])`.\n"
            "- 🌪️ **Lọc AutoFilter**: Công cụ hình chiếc phễu giúp trích xuất danh sách cần tìm mà không làm mất dữ liệu gốc của bảng tính.\n\n"
            "Em đang cần dùng hàm COUNTIF hay SUMIF để thống kê bảng điểm hay chi tiêu?"
        )


    # 3. Trích xuất ngữ cảnh học tập thời gian thực theo câu hỏi trắc nghiệm
    qid = getattr(context, "current_question_id", None) if context else None
    choice = getattr(context, "student_choice", None) if context else None
    is_correct = getattr(context, "is_correct", None) if context else None
    attempt = getattr(context, "attempt_count", 1) if context else 1
    active_tab = getattr(context, "active_tab", "quiz") if context else "quiz"

    if quiz_data is None:
        try:
            from backend.grounding import load_lesson_data
            ld = load_lesson_data(grade, lesson_id)
            quiz_data = ld.get("quiz", [])
        except Exception:
            quiz_data = []

    # Xử lý khi học sinh đã chọn ĐÚNG (Sonet P1-5: Khen ngợi và củng cố tư duy, cấm mang thông điệp sai)
    if is_correct is True:
        affirmation = (
            f"Chúc mừng em! Lựa chọn phương án **{choice or ''}** của em hoàn toàn chính xác! 🌟\n\n"
            "Em đã vận dụng rất tốt kiến thức trong SGK. Em có thể giải thích ngắn gọn bằng lời của mình xem vì sao phương án này lại đúng với định nghĩa bài học không?"
        )
        return check_and_redact_answer_leak(affirmation, quiz_data=quiz_data, current_question_id=qid)

    # Xử lý ngữ cảnh theo từng câu hỏi khi đang ở tab quiz
    if active_tab == "quiz" and qid in QUESTION_SCAFFOLDING:
        q_guide = QUESTION_SCAFFOLDING[qid]
        if attempt >= 3 and "tier3" in q_guide:
            reply = q_guide["tier3"]
        elif choice and "tier2_by_choice" in q_guide and choice in q_guide["tier2_by_choice"]:
            reply = q_guide["tier2_by_choice"][choice]
        else:
            reply = q_guide["default"]
        return check_and_redact_answer_leak(reply, quiz_data=quiz_data, current_question_id=qid)

    # 4. Phản hồi chung gợi mở
    return (
        f"Thầy đã nhận được câu hỏi của em về bài học Tin học {grade}!\n\n"
        "Để nắm chắc phần này, em hãy đối chiếu với nội dung bài học bên cột trái:\n"
        "1. Xác định tình huống cụ thể trong câu hỏi.\n"
        "2. Liên hệ với các ví dụ thực tế trong đời sống hàng ngày.\n\n"
        "Em có thể nói rõ hơn phần nào trong bài khiến em cảm thấy chưa rõ nhất không?"
    )


def chat_with_tutor(
    grade: int, 
    lesson_id: int, 
    message: str, 
    history: List[Dict[str, str]], 
    curriculum_text: str, 
    context: Optional[Any] = None,
    quiz_data: Optional[List[Dict[str, Any]]] = None,
    model_name: Optional[str] = None
) -> str:
    """Xử lý hội thoại của học sinh với Gia sư AI."""
    if quiz_data is None:
        try:
            from backend.grounding import load_lesson_data
            ld = load_lesson_data(grade, lesson_id)
            quiz_data = ld.get("quiz", [])
        except Exception:
            quiz_data = []

    qid = getattr(context, "current_question_id", None) if context else None

    # Nếu có GEMINI_API_KEY thì gọi Google GenAI / Gemini
    if GEMINI_API_KEY and GEMINI_API_KEY.strip() and not GEMINI_API_KEY.startswith("YOUR_"):
        try:
            from google import genai
            from google.genai import types

            http_opts = types.HttpOptions(timeout=30000)
            client = genai.Client(api_key=GEMINI_API_KEY, http_options=http_opts)
            system_prompt = SYSTEM_PROMPT_TEMPLATE.format(grade=grade, curriculum_text=curriculum_text)
            
            # Nạp ngữ cảnh câu hỏi nếu có
            if context and qid:
                system_prompt += f"""

BỐI CẢNH CÂU HỎI HỌC SINH ĐANG LÀM:
- Mã câu hỏi: {qid}
- Lựa chọn học sinh vừa chọn: {getattr(context, 'student_choice', 'Chưa chọn')} (Kết quả: {getattr(context, 'is_correct', 'Chưa rõ')})
NHIỆM VỤ SƯ PHẠM:
- Hãy phân tích ngắn gọn lý do vì sao lựa chọn của học sinh có thể chưa chính xác (nếu chọn sai).
- Tuyệt đối KHÔNG ĐƯỢC cung cấp đáp án đúng trực tiếp hoặc tiết lộ chữ cái/nội dung phương án đúng.
- Dẫn dắt học sinh bằng 1 ví dụ đời sống hoặc câu hỏi gợi mở để tự sửa sai.
"""

            # Xây dựng nội dung tin nhắn
            contents = []
            for h in history[-4:]:  # Lấy tối đa 4 lượt gần nhất để tiết kiệm ngữ cảnh
                contents.append(f"{h.get('role', 'user')}: {h.get('content', '')}")
            contents.append(f"Học sinh: {message}")
            full_prompt = "\n".join(contents)

            if not model_name:
                model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
            response = client.models.generate_content(
                model=model_name,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.0,  # Triệt tiêu ảo giác
                    http_options=http_opts
                )
            )
            raw_text = response.text or ""
            return check_and_redact_answer_leak(raw_text, quiz_data=quiz_data, current_question_id=qid)
        except Exception:
            # Fallback sang động cơ Socrates cục bộ nếu có lỗi mạng/API
            return socratic_fallback_reply(grade, lesson_id, message, curriculum_text, context=context, quiz_data=quiz_data)

    # Nếu chưa cấu hình API Key, dùng động cơ Sư phạm cục bộ
    return socratic_fallback_reply(grade, lesson_id, message, curriculum_text, context=context, quiz_data=quiz_data)


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


def analyze_class_pedagogy(class_data: Any) -> Any:
    """
    Phân tích sư phạm toàn diện cho lớp học bằng Google Gemini AI (hoặc Local Rule-Based Engine).
    Trả về đối tượng AIPedagogicalAdviceResponse có cấu trúc chuẩn:
    - general_assessment: Nhận xét tổng quan tiến độ và điểm số
    - critical_concerns: Cảnh báo học sinh yếu và chủ đề hổng
    - actionable_recommendations: 3 hành động sư phạm cụ thể
    """
    from backend.contracts import AIPedagogicalAdviceResponse

    kpi = class_data.kpi
    topic_averages = class_data.topic_averages
    lowest_topics = sorted(topic_averages.items(), key=lambda x: x[1])
    lowest_topic_str = ", ".join([f"'{name}' ({score}/10)" for name, score in lowest_topics[:2]])

    prompt = f"""Bạn là Chuyên gia Cố vấn Sư phạm Tin học THCS giàu kinh nghiệm.
Dưới đây là bảng số liệu học tập của lớp {class_data.class_name} (Khối {class_data.grade}, {class_data.semester}):
- Sĩ số: {kpi.total_students} học sinh
- Đã hoàn thành bài học: {kpi.completed_count}/{kpi.total_students} ({kpi.completed_percent}%)
- Điểm trung bình cả lớp: {kpi.average_score}/10 (Tăng {kpi.score_delta_month} so với tháng trước)
- Học sinh có tiến bộ: {kpi.improved_count} em ({kpi.improved_percent}%)
- Học sinh cần hỗ trợ thêm: {kpi.needs_support_count} em ({kpi.needs_support_percent}%)
- Điểm trung bình theo các chủ đề:
{chr(10).join([f"  + {k}: {v}/10" for k, v in topic_averages.items()])}

Hãy xuất ra phản hồi dạng JSON hợp lệ (không kèm Markdown code block) với 3 trường chính:
{{
  "general_assessment": "Đoạn văn ngắn gọn nhận xét tiến độ tổng thể và điểm số của lớp.",
  "critical_concerns": "Đoạn văn ngắn cảnh báo cụ thể về {kpi.needs_support_count} học sinh cần hỗ trợ và các chủ đề có điểm thấp ({lowest_topic_str}).",
  "actionable_recommendations": [
    "Hành động sư phạm 1...",
    "Hành động sư phạm 2...",
    "Hành động sư phạm 3..."
  ]
}}
"""
    if GEMINI_API_KEY:
        try:
            import json
            from google import genai
            from google.genai import types

            http_opts = types.HttpOptions(timeout=15000)
            client = genai.Client(api_key=GEMINI_API_KEY, http_options=http_opts)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    response_mime_type="application/json"
                )
            )
            parsed = json.loads(response.text)
            return AIPedagogicalAdviceResponse(
                general_assessment=parsed.get("general_assessment", ""),
                critical_concerns=parsed.get("critical_concerns", ""),
                actionable_recommendations=parsed.get("actionable_recommendations", [])
            )
        except Exception:
            pass

    # Fallback Rule-Based Sư phạm Thông minh (Khi offline hoặc không có API Key)
    delta_text = f"cao hơn {kpi.score_delta_month} so với tháng trước" if kpi.score_delta_month >= 0 else f"giảm {abs(kpi.score_delta_month)} so với tháng trước"
    
    general = f"Lớp {class_data.class_name} có tiến độ tốt ({kpi.completed_percent}%), điểm TB {kpi.average_score} – {delta_text}. Có {kpi.improved_count} em ({kpi.improved_percent}%) ghi nhận sự tiến bộ rõ rệt."
    
    concerns = f"{kpi.needs_support_count} học sinh cần được hỗ trợ thêm ({kpi.needs_support_percent}% sĩ số), đặc biệt ở các chủ đề {lowest_topic_str} do còn nhiều câu trắc nghiệm nhầm lẫn."
    
    recs = [
        f"Tổ chức 1 buổi ôn tập nhanh 15 phút đầu giờ để củng cố trọng tâm chủ đề {lowest_topics[0][0].replace('_', ' ').title()}.",
        "Áp dụng phương pháp 'Đôi bạn cùng tiến': Phân công các em đạt Xuất sắc hỗ trợ kèm cặp nhóm 5 học sinh cần hỗ trợ.",
        "Giao thêm 3-5 câu hỏi tương tác tình huống thực tế trên hệ thống để học sinh luyện phản xạ trước giờ kiểm tra định kỳ."
    ]
    
    return AIPedagogicalAdviceResponse(
        general_assessment=general,
        critical_concerns=concerns,
        actionable_recommendations=recs
    )

