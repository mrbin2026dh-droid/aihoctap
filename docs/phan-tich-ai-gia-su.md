# Phân tích các tính năng AI — Góc học tập (28/10/2026)

## 1. AI đang làm gì trong app
| Tính năng | Cách chạy | Ai chấm / ai nói |
|---|---|---|
| **Gia sư AI theo bài** (`/api/pwa/tutor`) | Worker gửi Gemini: luật sư phạm + nội dung bài học + câu đang làm (không kèm đáp án) + 6 lượt hội thoại gần nhất | Gemini trả lời, bộ lọc lộ đáp án kiểm tra lại, lộ thì hỏi lại Gemini 1 lần |
| **Chấm luyện tập / thi thử / thi thật** | So đáp án bằng code (trình duyệt + Firebase) | **Code chấm**, điểm 100% chính xác, không dùng AI |
| **AI nhận xét bài thi thử** (`mode:'exam_review'`) | Gửi câu hỏi + đúng/sai (không gửi đáp án) | Code đã chấm điểm; AI chỉ nhận xét: tốt ở đâu, cần ôn gì |
| **Khóa AI giờ thi** | Lớp có bài thi thật đang mở → app tự khóa; hoặc ô "Khóa AI trong khi kiểm tra" | Code |
| **Giới hạn lượt** | Durable Object đếm lượt/học sinh/ngày, nhiều khóa Gemini luân phiên | Code |
| **Kiểm thử đối kháng** | `tests/evals/` 48 ca (đòi đáp án, mạo danh giáo viên, mã hóa…) | Kiểm thử tự động |

Nguyên tắc đúng và nên giữ: **điểm số do code chấm, AI chỉ giải thích và gợi ý.** Đây là cách "chính xác và khoa học" nhất — AI không bao giờ quyết định điểm.

## 2. Vì sao AI trả lời "chưa chính xác" — 4 nguyên nhân gốc (đã sửa)
1. **Bộ lọc chặn nhầm (nguyên nhân lớn nhất).** Bộ lọc tìm "chọn/câu + chữ A–D", nhưng với tiếng Việt nó coi "**chọn c**ách", "**câu d**ưới", "**chọn b**ộ nhớ" là lộ đáp án → câu giải thích đúng bị thay bằng câu từ chối "Thầy/Cô không đưa ra đáp án…". Ngoài ra một số luật viết riêng cho bộ kiểm thử (ví dụ liệt kê "thu nhận, lưu trữ…") chặn luôn cả câu hỏi khái niệm.
   → Sửa: chữ A–D phải đứng riêng và viết hoa (`findLetterLeak`); các luật ngữ nghĩa chỉ áp khi học sinh đang làm câu hỏi hoặc đòi đáp án (`ANSWER_SEEKING_RE`). Vẫn chặn "Đáp án là B", "Em nên chọn C"…
2. **Câu trả lời bị cụt.** Worker chỉ lấy phần chữ đầu tiên của Gemini và giới hạn 700 token; Gemini 3.5 dùng một phần token để "suy nghĩ" → câu bị cắt giữa chừng.
   → Sửa: ghép mọi phần chữ, bỏ phần suy nghĩ (`geminiText`), 2048 token, cắt gọn về câu hoàn chỉnh nếu vẫn chạm trần.
3. **Bài dài bị cắt cụt.** Chỉ gửi 8.000 ký tự đầu bài → hỏi phần cuối bài thì AI không có tài liệu, đoán bừa.
   → Sửa: `pickLessonContext` — bài ngắn gửi nguyên; bài dài chia đoạn theo đề mục, chấm điểm từ khóa với câu hỏi (kiểu BM25), giữ phần mở đầu + các đoạn liên quan nhất (≤ 9.000 ký tự). Đây là "RAG gọn" chạy ngay trong Worker, không cần CSDL.
4. **Văn phong.** AI chào lại mỗi lượt, hỏi ngược kiểu Socrates cả khi em chỉ hỏi "X là gì?".
   → Sửa: `TUTOR_STYLE_RULES` — khái niệm thì giải thích đủ (định nghĩa + ví dụ + 1 câu hỏi kiểm tra), chỉ gợi mở kiểu Socrates khi là bài tập/đề thi; 60–140 từ; không chào lặp.

Kiểm thử: `tests/test_tutor_accuracy.mjs` (17), `test_worker_tutor_guardrails.mjs`, `test_tutor_grounding.mjs`, `test_tutor_questions.mjs`, `test_tutor_exam_review.mjs` — đều đạt. **Cần deploy Worker mới có hiệu lực.**

## 3. Các dự án "bộ não thứ hai" trên GitHub — có dùng được không?
Các dự án hay được nhắc: **mem0** (bộ nhớ dài hạn cho AI), **Letta/MemGPT** (agent tự quản lý trí nhớ), **Khoj** (trợ lý tìm trong ghi chú), **LightRAG / Microsoft GraphRAG** (RAG theo đồ thị tri thức), **Obsidian Smart Connections**.

**Kết luận: không cài thẳng vào dự án được, nhưng lấy ý tưởng thì rất đáng.**
- Chúng là máy chủ Python/Docker cần CSDL vector, chạy thường trực, tốn tiền máy chủ. App này chạy trên Cloudflare Worker miễn phí + Firebase + Google Sheet; thêm một máy chủ nữa là đi ngược yêu cầu "nhanh, gọn, không rắc rối".
- Dữ liệu của mình **nhỏ và có cấu trúc** (vài chục bài SGK Tin 6–9). RAG đồ thị chỉ có lợi với hàng nghìn tài liệu rời rạc. Với SGK, chọn đoạn theo từ khóa (đã làm ở mục 2.3) cho kết quả tương đương mà không tốn gì.
- Rủi ro: thêm "trí nhớ" tự do về học sinh = thêm dữ liệu cá nhân trẻ em ở bên thứ ba.

**Ý tưởng đáng lấy, làm theo cách gọn của app:**
| Ý tưởng "bộ não thứ hai" | Cách làm gọn trong app | Lợi ích |
|---|---|---|
| Trí nhớ dài hạn (mem0) | Firebase `hoc_tap/{ma}`: chủ đề làm sai nhiều (tính từ kết quả luyện tập/thi thử, code tính, không AI) → gửi kèm 1 dòng cho Gia sư: "Em hay sai: mã nhị phân, đơn vị đo" | AI gợi ý đúng chỗ yếu của từng em |
| Truy xuất tri thức (RAG) | `pickLessonContext` (đã làm); nếu sau này cần tìm ngữ nghĩa: Cloudflare Vectorize + Workers AI embeddings (gói miễn phí) | Trả lời bám SGK |
| Đồ thị tri thức (GraphRAG) | Thêm cột **Chủ đề** cho mỗi câu hỏi trong DeThi/ngân hàng câu | Thống kê lớp yếu chủ đề nào; AI nhận xét theo chủ đề thay vì theo từng câu |
| Đánh giá liên tục | Bộ câu hỏi vàng (30–50 câu hỏi khái niệm + đáp án mẫu) chạy định kỳ với `tests/evals` | Phát hiện ngay khi đổi mô hình làm AI kém đi |

## 4. Lộ trình đề xuất (theo thứ tự lợi ích / công sức)
1. **Ngay**: deploy Worker (các sửa ở mục 2). Không cần đổi Sheet.
2. **Tuần tới**: thêm cột Chủ đề cho câu hỏi; AI nhận xét bài thi thử theo chủ đề; báo cáo giáo viên "lớp yếu chủ đề nào".
3. **Sau đó**: trí nhớ học tập theo học sinh (mục 3, dòng 1).
4. **Khi có thời gian**: bộ câu hỏi vàng + chạy đánh giá tự động mỗi lần đổi mô hình/luật.
5. Câu tự luận/thực hành: chấm theo **rubric** do giáo viên nhập (AI gợi ý điểm từng tiêu chí, giáo viên duyệt) — không để AI tự cho điểm cuối.

Không cần thay mô hình hay thư viện "tiên tiến" nào khác: độ chính xác hiện bị giới hạn bởi bộ lọc, ngữ cảnh và văn phong (đã sửa), không phải bởi mô hình Gemini.
