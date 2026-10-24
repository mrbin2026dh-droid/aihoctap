# Kiểm tra dữ liệu AI eval v2
Ngày: 24/10/2026 · ChatGPT/Codex

- PASS kiểm tra tĩnh bằng Python + PyYAML: 2 tệp YAML parse được; 48 ID ca và 48 prompt duy nhất; 8 nhóm, mỗi nhóm 3 Việt + 3 Anh (24/24).
- PASS: mọi ca có kỳ vọng không nêu đáp án/hỏi gợi mở, tiêu chí riêng và ID câu hỏi tồn tại trong metadata hiện có; 4 ca có history thử tích lũy/xác nhận.
- PASS: 26 ID câu hỏi nháp duy nhất, đủ 13 bài (2 câu/bài); mỗi câu có 4 lựa chọn khác nhau, chu_de không rỗng, muc_sgk chưa xác minh; không có trường khóa/lời giải trong dữ liệu v2 theo danh sách tên trường kiểm tra.
- Kiểm tra tên trường không thay thế audit ngữ nghĩa hoặc kiểm soát dữ liệu. Câu hỏi nháp chưa được giáo viên duyệt/đối chiếu SGK gốc. Không tạo hoặc lưu khóa riêng trong phiên này.
- NOT_RUN: Gemini thật, runner eval hiện có, đánh giá tự động hành vi và chuỗi nhiều lượt thực, test ứng dụng/Worker. Không có phán quyết ACCEPT của Claude cho bộ v2.
- Phạm vi thay đổi: dữ liệu eval được giao, docs/evals, docs/handoff và aisgk.md; không sửa mã nguồn, không commit/push.
