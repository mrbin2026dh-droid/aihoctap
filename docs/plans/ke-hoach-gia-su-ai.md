# Kế hoạch Gia sư AI: trả lời có căn cứ, không bịa, không lộ đáp án

Ngày lập: 2026-10-25. Người lập: Claude (kiểm soát chất lượng). Người thực hiện: Claude (code), Antigravity (triển khai Worker).

## 1. Hiện trạng đã rà soát (sự thật, không phỏng đoán)
| Phát hiện | Mức | Đã xử lý |
|---|---|---|
| App gửi câu hỏi tới `/pwa/tutor` **không kèm token** nên máy chủ trả 401, Gia sư không dùng được | Nghiêm trọng | Đã sửa (gửi token, hết phiên thì đăng nhập lại) |
| Worker không có nội dung bài học làm căn cứ (chỉ tin `context.curriculum_text` do trình duyệt gửi, mà app không gửi) nên AI trả lời từ trí nhớ, dễ bịa | Nghiêm trọng | Đã sửa: Worker tự tải bài từ Firebase, đưa vào lệnh hệ thống, có quy tắc "chỉ dùng tài liệu" |
| Không đặt nhiệt độ sinh văn bản | Trung bình | Đã đặt 0.3, tối đa 700 token |
| Nút hỏi AI chỉ có trong trang bài học | Thiếu chức năng | Đã thêm nút AI trên thanh đầu, hỏi ở mọi trang, chọn bài nếu chưa mở bài |
| Đã có: chống rò đáp án (lệnh cấm + lọc đáp án đúng ở máy chủ), hạn mức lượt, khóa theo học sinh, tắt trong giờ thi, nhóm khóa Gemini | Tốt | Giữ nguyên |
Kiểm thử: `tests/test_tutor_grounding.mjs`.

## 2. Nguyên tắc: "không bịa" cần nhiều lớp, không cần "AI canh AI"
Câu hỏi của bạn: có cần tạo thêm các AI để chặn không? **Không bắt buộc, và không nên làm ngay.** Mỗi AI thêm vào là thêm tiền, thêm độ trễ, thêm chỗ lỗi. Nên ưu tiên các kiểm tra bằng code (chắc chắn, rẻ), chỉ thêm một AI "chấm" khi kiểm thử cho thấy còn lọt.

Các lớp, từ rẻ đến đắt:
1. **Giới hạn kho tri thức**: AI chỉ thấy nội dung bài giáo viên soạn (đã làm). Không cho tìm web.
2. **Lệnh hệ thống chặt**: chỉ dùng tài liệu; ngoài tài liệu thì nói "chưa có trong bài, em hỏi thầy cô"; không đưa đáp án (đã làm).
3. **Đầu ra có cấu trúc + bằng chứng (làm tiếp)**: bắt Gemini trả JSON `{in_scope, answer, evidence_quote}` (tính năng responseSchema của Gemini). Code kiểm tra `evidence_quote` có thật sự nằm trong bài (so khớp chuỗi sau khi chuẩn hóa). Nếu trả lời "trong bài" mà không có trích dẫn đúng, thử lại một lần, vẫn sai thì trả câu mặc định. Đây là cách chặn bịa mạnh nhất mà không cần AI thứ hai. Hiển thị cho học sinh dòng "Theo bài: …" để tin cậy.
4. **Bộ lọc rò đáp án bằng code (đã có, thêm kiểm thử)**: so khớp chữ cái và nội dung đáp án đúng trong câu trả lời.
5. **Giám sát bởi giáo viên**: lưu câu hỏi và câu trả lời (mã học sinh, bài, giờ, cờ cảnh báo) vào Firebase; trang giáo viên có danh sách "Hỏi gia sư" để rà soát; học sinh có nút "Báo trả lời sai". Cần thông báo quyền riêng tư cho học sinh.
6. **Bộ đo chất lượng tự động**: ~50 câu mẫu (đúng phạm vi, ngoài phạm vi, ép lộ đáp án, tiêm lệnh, tiếng Việt khó) chạy mỗi lần đổi lệnh hoặc đổi mô hình. Mục tiêu: lộ đáp án 0 lần; từ chối ngoài phạm vi ≥ 95%; câu trả lời có trích dẫn đúng ≥ 90%.
7. **AI chấm (tùy chọn, sau cùng)**: một lần gọi mô hình nhỏ để kiểm tra "câu trả lời có bám tài liệu không". Chỉ bật cho giờ thi hoặc khi bộ đo cho thấy lớp 1 đến 6 chưa đủ.

## 3. Công nghệ trên GitHub đã tìm hiểu
| Công nghệ | Làm gì | Có dùng được ở đây? |
|---|---|---|
| NVIDIA NeMo Guardrails | Lớp rào (đầu vào, đầu ra, kiểm tra thực tế, theo kịch bản hội thoại) | Viết bằng Python, Worker của ta là JavaScript trên Cloudflare nên không chạy trực tiếp. Mượn ý tưởng (lớp 3 đến 4), không cài |
| Guardrails AI, LLM Guard (Protect AI) | Bộ kiểm tra đầu vào/đầu ra (tiêm lệnh, nội dung độc hại, định dạng) | Cũng Python. Cùng kết luận |
| promptfoo | Chạy bộ câu mẫu, so kết quả, chạy trong CI (Node.js) | **Dùng được** cho lớp 6, gọn, không cần máy chủ riêng |
| Ragas, DeepEval | Đo độ trung thành (faithfulness) với tài liệu | Python. Tham khảo cách tính; lớp 3 đã kiểm tra bằng code nên chưa cần |
Nguồn: [NeMo Guardrails (tài liệu NVIDIA)](https://docs.nvidia.com/nemo/guardrails/latest), [so sánh DeepEval, promptfoo, Ragas](https://itsourcecode.com/web-dev/deepeval-vs-promptfoo-vs-ragas/), [hướng dẫn schema của Gemini](https://dejan.ai/blog/prompt-engineers-guide-to-gemini-schemas/). Lưu ý: tôi chỉ đọc được tiêu đề kết quả tìm kiếm, chưa kiểm chứng sâu từng thư viện; cần xác nhận phiên bản khi thật sự dùng.

## 4. Lộ trình
| Giai đoạn | Việc | Tiêu chí xong | Ghi chú |
|---|---|---|---|
| A (xong) | Sửa token, căn cứ bài học từ máy chủ, nhiệt độ, nút AI mọi trang | `test_tutor_grounding.mjs` đạt | Cần `wrangler deploy` |
| B | Đầu ra có cấu trúc + kiểm tra trích dẫn + hiển thị "Theo bài" | Câu có `in_scope` mà thiếu trích dẫn đúng thì không đến học sinh | 1 phiên làm việc |
| C | Bộ đo promptfoo 50 câu, chạy trong CI hoặc tay | Báo cáo tỉ lệ ở mục 2.6; lộ đáp án = 0 | Cần khóa Gemini thật để chạy |
| D | Nhật ký hỏi đáp + trang giáo viên + nút "Báo sai" | Giáo viên xem được câu bị cờ | Cần quyết định về quyền riêng tư |
| E (nếu cần) | AI chấm cho giờ thi | Chỉ khi C cho thấy còn lọt | Tốn thêm lượt gọi |

## 5. Giới hạn cần nói thẳng
Không có kỹ thuật nào làm AI "không bao giờ bịa". Kế hoạch này giảm mạnh khả năng bịa, buộc có bằng chứng từ bài, và cho giáo viên thấy khi có sai sót. Mục tiêu hợp lý là "hiếm khi sai và dễ phát hiện", không phải "không bao giờ sai".
