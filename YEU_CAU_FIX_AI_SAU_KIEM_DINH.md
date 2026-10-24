# Phán quyết kiểm định AI — REVISE

Đối chiếu BAO_CAO_HOAN_THIEN_DEBUG.md với mã local và LIVE-01..03.
Chưa chấp thuận phát hành. Chỉ sửa AI/luồng dữ liệu chat; bỏ qua PWA, thiết kế UI và tiến độ.

Đã kiểm tra độc lập:
- 150 test: 146 PASS, 4 FAIL; XML: scratch/ai-report-audit.xml.
- 4 FAIL nằm ở test_reproduce_audit_bugs.py vì assert yêu cầu lỗi cũ còn tồn tại. Không phải 4 lỗi sản phẩm tái phát. Chuyển thành regression khẳng định hành vi đúng; giữ bằng chứng trước sửa trong tài liệu/Git.
- V8 và git diff --check PASS.
- API mock: dashboard/theory/quiz đều 200, có request_id. Không chứng minh website production đã sửa.
- Đã tái hiện: qid không tồn tại hoặc thiếu student_choice + is_correct=true vẫn được khen đúng; mock Gemini cũng nhận nhãn Đúng từ client khi thiếu lựa chọn.
- Fallback CPU vẫn dùng lời từ chối Dữ liệu/Thông tin; câu hỏi xin gợi ý có từ khóa thiết bị số vẫn vào nhánh CPU chung trước nhánh câu hỏi.
- Prompt Gemini có qid nhưng thiếu nội dung câu hỏi/lựa chọn; fallback không nhận history.
- Frontend lấy state.answers trong khi chọn/chấm quiz dùng state.userSelections.

Antigravity: đọc các lát hướng dẫn trong docs/audits/2026-10-23-ai-review/ theo thứ tự 01..05. Mỗi tệp dưới 3KB để audit Sonnet riêng; mẫu code là đề xuất chưa áp dụng, không phải patch đã nghiệm thu. Đọc lại mã thực tế vì working tree đang thay đổi.

Thứ tự: 01 sửa nguồn lựa chọn + chuẩn hóa server; 02 ưu tiên gợi ý theo câu; 03 prompt/history; 04 bằng chứng nguồn phản hồi; 05 test và nghiệm thu.

Tuân thủ AGENTS.md, Context7 và audit trước khi áp dụng. Test FAIL trước/PASS sau. Không reset công việc có sẵn, không gọi dữ liệu học sinh thật, không xóa test hay giảm assert để xanh. Nếu gate thiếu công cụ, ghi BLOCKED.

Sửa báo cáo: bỏ khẳng định “8/8 tận gốc” khi còn các ca trên; mô tả đúng coverage. Test F12 200/reply không tự chứng minh Gemini thật. Báo cáo nhắc _is_concept_in_scope nhưng chưa tìm thấy hàm đó trong agent.py.

Bàn giao log theo từng ca, phiên bản mã, các gate chưa đạt. Không commit/push/merge/deploy. Codex sẽ kiểm định độc lập lại.
