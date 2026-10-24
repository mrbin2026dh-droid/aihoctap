# THẨM ĐỊNH: PLAN-SGK-EXTRACTION-V1 (Bóc tách PDF SGK & Zero-Hallucination)

**Tài liệu thẩm định:** `docs/plans/2026-10-14-sgk-pdf-extraction-and-zero-hallucination-pipeline.md`
**Đích yêu cầu:** `docs/audits/sgk-extraction-sonnet-verdict.md` (không ghi được, xem mục 6)
**Đối chiếu mã:** `backend/agent.py` (L46-71, L134-152), `backend/server.py` (L43, L88-116), `backend/grounding.py` (L138-194), `backend/contracts.py`, `frontend/app.js` (L575-580)
**Phạm vi:** đọc mã và tài liệu. Không chạy pipeline, không benchmark PDF, không kiểm chứng số sao GitHub hay license.

---

## 1. Lựa chọn thư viện bóc tách PDF

**Khuyến nghị: PyMuPDF (`pymupdf4llm`) cho PDF có text layer (Dạng A). Không dùng Gemini làm đường duy nhất. MinerU/Docling chỉ dự phòng cho bảng phức tạp hoặc scan, và chỉ khi benchmark chứng minh cần.**

| Phương án | Tốc độ | Bảng / hộp màu | Chi phí | Offline | Vai trò |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PyMuPDF / pymupdf4llm | Nhanh, CPU | Tốt với text/heading; bảng đơn giản; hộp màu chỉ nhận qua vị trí, không qua màu nền | Miễn phí | Có | Đường chính Dạng A |
| Docling | Trung bình, CPU được | Tốt với bảng | Miễn phí | Có, cần tải model | Dự phòng bảng |
| MinerU | Chậm nếu không GPU | Tốt với layout sách | Miễn phí | Có, model lớn | Chỉ khi có GPU |
| Gemini 2.5 Flash | Nhanh theo request | Tốt về ngữ nghĩa | Trả phí theo token | Không | Chỉ hỗ trợ, không quyết định nội dung |

Ghi chú:
- Plan ghi "PyMuPDF đã cài sẵn trong máy". Repo không có `requirements.txt`, `pyproject.toml` hay lockfile. Không có bằng chứng `pymupdf4llm` đã cài. Phải pin phiên bản.
- Số sao GitHub và "nạp model ~2GB" chưa kiểm chứng; không dùng làm tiêu chí.
- Dạng B (scan) không có text layer, plan không nêu OCR. Lỗi OCR đi thẳng vào model như dữ liệu gốc, và lớp kiểm chứng ở mục 2 không bắt được lỗi này nếu không có điểm tin cậy OCR.

## 2. Tính toán học của chuỗi 4 lớp chống ảo giác

**Kết luận: KHÔNG khẳng định được "AI không thể bịa đặt". Ba lớp đầu chỉ đảm bảo hình thức và giảm xác suất; không lớp nào kiểm tra nội dung có nằm trong SGK.**

- **Lớp 1** (system instruction + `temperature=0.0`): chỉ thị ngôn ngữ, không phải ràng buộc. Temperature 0 giảm biến thiên, không đảm bảo đúng nguồn.
- **Lớp 2** (`response_schema`): đảm bảo cấu trúc JSON. Chuỗi hợp lệ vẫn có thể là nội dung bịa.
- **Lớp 3** (Pydantic): kiểm hình thức (`Literal["A","B","C","D"]`, độ dài). Không biết nội dung có trong sách.
- **Lớp 4** (giáo viên duyệt): lớp duy nhất kiểm nội dung, nhưng là con người, không phải toán học.

**Kẽ hở kỹ thuật:**
1. **Đáp án và giải thích không có trong SGK.** Plan (mục 1, điểm 3) thừa nhận điều này. Vậy `dap_an_dung` và `giai_thich_su_pham` do model sinh, không phải trích xuất. Plan gọi đây là "bóc tách". Cần gắn `source: "generated"`.
2. **Không có kiểm chứng nguồn xác định.** Cần: mọi chuỗi nội dung và câu hỏi phải khớp (sau chuẩn hóa khoảng trắng và Unicode NFC, ngưỡng cao) với text PyMuPDF của đúng trang được trích. Không khớp thì `unverified`.
3. **`trang_sgk` do model tự khai.** Phải kiểm tra trang đó có chứa chuỗi nguồn hay không.
4. **Constrained decoding với schema phức tạp.** Gemini chỉ hỗ trợ tập con OpenAPI Schema. `Dict[str, Any]` và union kiểu block có thể bị bỏ qua. Lớp 3 phải chạy độc lập. Xác minh giới hạn qua context7 trước khi viết code.
5. **Áp sai guardrail.** `check_and_redact_answer_leak` (`backend/agent.py:46-71`) là regex cho câu trả lời chat. Với JSON bóc tách, đáp án đúng là dữ liệu hợp lệ cần lưu. Áp bộ lọc này sẽ phá dữ liệu. Phải tách đường xử lý.
6. **Ghi đè không sao lưu.** `save_lesson_blocks` (`backend/grounding.py:138-194`) ghi đè `bai{id}.blocks.json` không kiểm tra tồn tại, không sao lưu. Atomic write chỉ chống ghi dở, không chống ghi nhầm.
7. **Mặc định đáp án `"A"` âm thầm.** `backend/grounding.py:166` gán `"A"` khi thiếu `dap_an_dung` và có bản cũ. Với import mới, đáp án sai có thể lọt vào bài. Phải báo lỗi, không gán mặc định.

## 3. Google GenAI SDK và ADK

- **`google-genai` đúng chuẩn.** `backend/agent.py:134-135` dùng `from google import genai` và `from google.genai import types`. Không có import `google.generativeai` nào trong repo.
- Plan ghi "v1.0+" nhưng không có file phụ thuộc để kiểm. Cần pin.
- `types.Part.from_bytes(data=..., mime_type="application/pdf")`: xác nhận giới hạn kích thước inline với context7. PDF lớn có thể phải dùng Files API.
- **ADK không tồn tại trong mã.** Không có `google.adk`, `Agent`, `Runner`, hay tool. Chỉ có tên `google-adk` trong `docs/plans/2026-10-14-ai-agent-sgk-tinhoc.md:14`. Plan mục 4 ghi "tuân thủ 100% ADK": khẳng định sai. Hoặc bỏ, hoặc ghi là việc chưa làm.
- Mục 4.3 và 4.4 mô tả hành vi đã có (`check_and_redact_answer_leak`, fallback `socratic_fallback_reply`), không phải tính năng mới.

## 4. Smart Importer và Human-in-the-loop

**Chưa an toàn, chưa đủ tinh gọn.**

1. **PIN giáo viên nằm trong client.** `frontend/app.js:575` so sánh với `"123456"` hardcode; `app.js:580` gửi PIN trong header. Học sinh đọc được PIN trong mã nguồn, gọi `GET /api/teacher/lesson/...` và lấy `dap_an_dung`, `giai_thich_su_pham`. Đây là lỗ hổng đang tồn tại, plan không nhắc, và Test 3 của plan còn dùng PIN đó. **P0.**
2. **PIN mặc định `123456`** (`backend/server.py:43`). Quên đặt biến môi trường là mở toàn bộ quyền giáo viên. **P0.**
3. **Không có luồng chọn đích.** Không nêu import vào khối/bài nào, xử lý bài đã tồn tại thế nào.
4. **Không có đối chiếu nguồn trong UI.** Giáo viên không thấy trang PDF gốc cạnh từng khối/câu, nên Human-in-the-loop chỉ là hình thức.
5. **Không có cờ riêng cho đáp án AI.** Giáo viên phải xác nhận từng đáp án, ghi người duyệt và thời điểm.
6. **Không dùng `status`.** `LessonBlockPackageContract` đã có trường `status`. Import phải ghi `draft`; chỉ duyệt mới thành `published`. Nếu không, bài nháp lộ qua `/api/lesson`.
7. **Lỗi từng bước chưa định nghĩa:** PDF mã hóa, scan không đọc được, JSON sai schema (retry có giới hạn, thông báo rõ).
8. **Không giới hạn kích thước upload, timeout, hàng đợi.** File lớn có thể làm nghẽn server phục vụ 18 máy.
9. **Gemini cần Internet.** Plan mục 4.4 nói offline, nhưng import bằng Gemini chỉ chạy trên máy giáo viên có mạng. Học sinh vẫn offline sau khi bài đã lưu. Cần ghi rõ.

## 5. Phán quyết

**[REJECT]**

Lý do: khẳng định "không bịa đặt" không có lớp kiểm chứng nguồn; khẳng định tuân thủ ADK không có cơ sở trong mã; luồng mới dựa trên PIN đang lộ trong client.

**Điểm chặn P0 (trước khi viết code):**
1. Gỡ PIN khỏi client (`frontend/app.js:575, 580`). Xác thực qua phiên phía server (cookie HttpOnly hoặc token ngắn hạn).
2. Bỏ PIN mặc định (`backend/server.py:43`). Thiếu `TEACHER_PIN` thì không mở luồng giáo viên.
3. Thêm kiểm chứng nguồn xác định: chuỗi phải khớp text trang trích dẫn, không khớp thì `unverified` và chặn lưu nếu là trường bắt buộc.
4. Đánh dấu `source: "extracted" | "generated"` cho từng trường. Đáp án và giải thích luôn là `generated`, bắt buộc giáo viên duyệt từng câu.
5. Import ghi `status: "draft"`; chỉ thao tác duyệt của giáo viên mới chuyển `published`. Học sinh chỉ đọc `published`.
6. Sao lưu `bai{id}.blocks.json` trước khi ghi đè; hiển thị cảnh báo ghi đè.
7. Bỏ mặc định `"A"` (`backend/grounding.py:166`).
8. Tách đường xử lý: không áp `check_and_redact_answer_leak` lên JSON bóc tách.
9. Sửa mục 3 và 4 của plan: bỏ "tuân thủ 100% ADK" và "PyMuPDF đã cài sẵn", hoặc ghi rõ là việc chưa làm.

**Điểm chặn P1 (trước khi giáo viên dùng):**
10. File phụ thuộc có pin: `google-genai`, `pymupdf4llm`, `pydantic`, `fastapi`.
11. Xác minh giới hạn Gemini schema và kích thước PDF qua context7; quyết định inline hay Files API.
12. Giao diện đối chiếu trang PDF gốc cạnh từng khối và từng câu.
13. Chọn bài đích tường minh; không suy từ tên file.
14. Giới hạn upload, timeout, retry có giới hạn khi JSON sai schema.
15. Scan (Dạng B): OCR có điểm tin cậy, gắn cờ trang điểm thấp.
16. Benchmark PyMuPDF trên một PDF Dạng A và một Dạng B thật; đối chiếu tiêu đề và số câu với sách.

**Điểm P2:**
17. Chỉ thêm MinerU/Docling nếu benchmark cho thấy PyMuPDF không đủ bảng.
18. Nhật ký import: người nhập, file, trang, thời điểm, điểm tin cậy.

**Kiểm thử bắt buộc trước APPROVE:** ngoài Test 1 (schema), cần: chuỗi bịa không có trong text trang phải bị `unverified`; import không ghi đè bài `published` khi chưa duyệt; `/api/lesson` sau import không chứa `dap_an_dung` và không chứa bài `draft`; request với PIN từ client công khai phải bị từ chối sau khi gỡ PIN.

## 6. Ghi chú đầu ra

Yêu cầu ghi báo cáo vào `docs/audits/sgk-extraction-sonnet-verdict.md`. Ghi file đó bị từ chối bởi quyền hiện tại (chỉ cho phép `.md` trong thư mục plan). Nội dung được lưu tại đường dẫn plan này. Để đưa vào đích yêu cầu, cần agent có quyền ghi sao chép nguyên văn file này.
