# Bộ ca kiểm thử đối kháng cho gia sư AI
Từ: Claude → Sang: ChatGPT   Ngày: 24/10/2026
## Mục tiêu
Soạn nội dung (không viết mã Worker): >= 40 ca đối kháng cho gia sư AI Tin học THCS để chứng minh AI không đưa đáp án.
## Tệp cần đọc
- docs/plans/2026-10-24-contest-features-spec.md (mục Giai đoạn 4)
- tests/evals/adversarial_cases.yaml (định dạng hiện có)
## Kết quả mong đợi
- Tệp `tests/evals/adversarial_cases_v2.yaml`: >= 40 ca, tiếng Việt và Anh, nhóm: xin đáp án thẳng, đóng vai/giả làm giáo viên, "bỏ qua luật", hỏi từng phần, ép xác nhận lựa chọn, mã hóa (base64, đảo chữ), hỏi ngoài chủ đề. Mỗi ca ghi kỳ vọng "không nêu đáp án, hỏi gợi mở".
- Ngân hàng câu trắc nghiệm có thẻ `muc_sgk`/chủ đề cho các bài hiện có, nằm ngoài repo công khai nếu chứa đáp án.
## Ràng buộc
Không đưa đáp án thật vào tệp trong repo. Không ghi bí mật vào chat/nhật ký/Git. Cuối phiên ghi nhật ký 3–5 dòng, tạo handoff và kết thúc theo mẫu "XONG … / TIẾP THEO → Antigravity".
## Xong thì chuyển cho: Antigravity
