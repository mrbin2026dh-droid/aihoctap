# Kiểm định độc lập ngày 23/10/2026

**Kết luận: HOLD — chưa đủ điều kiện đưa lên GitHub cho học sinh.**
Chưa sửa mã ứng dụng, commit, push, merge hoặc deploy trong phiên này.

## Bằng chứng thực chạy

- 5 suite: `test_socratic_guardrails`, `test_socratic_agent_context`, `test_adversarial_evals`, `test_tin9_curriculum`, `test_api_endpoints`: **119 PASS, 21 FAIL**, 1 warning. Tắt API key trong tiến trình; dữ liệu kiểm thử được cô lập. 21 FAIL tập trung vào fixture thiếu bài học, không phải bằng chứng 21 lỗi production.
- V8 `node --check frontend/app.js`: PASS.
- `git diff --check`: FAIL tại `backend/agent.py:1129` (trailing whitespace).
- HTTP mock: ép tutor ném `RuntimeError('PRIVATE_INTERNAL_SENTINEL')`; `/api/chat` trả 500 với `detail` chứa nguyên sentinel.
- Fallback: đáp án A sai, client gửi `is_correct=true`; vẫn khen “hoàn toàn chính xác”.
- Fallback: lớp 6 bài 1 hỏi SUMIF; trả nội dung lớp 9 bài 10, vượt phạm vi SGK đang học.

## Các điểm phải sửa và kiểm tra lại

1. Không trả chi tiết ngoại lệ nội bộ ra client; dùng thông báo an toàn và request_id để đối chiếu.
2. Xác minh kết quả lựa chọn từ dữ liệu server; không tin is_correct của client.
3. Ràng buộc toàn bộ nhánh fallback theo bài học; áp dụng guardrail đầu ra nhất quán.
4. Frontend watchdog mở khóa sau 30s nhưng không hủy fetch. Phải kiểm thử phản hồi trễ, đổi bài/view và ngăn ghi lịch sử của lượt cũ.
5. F12 test hiện không có assert, bắt timeout rồi chỉ in lỗi và chạy ở import. Chuyển thành test cô lập có điều kiện FAIL rõ ràng.
6. MockGenaiClient của adversarial eval chỉ nhận api_key, trong khi code truyền thêm http_options; nhánh mock có thể chuyển fallback trước generate_content. Bắt buộc assert đã gọi mock và kiểm tra source.
7. Sửa fixture bài học, kiểm thử hồi quy chấm điểm, auth và dữ liệu học sinh.
8. Alibaba --all báo PASS nhưng chỉ liệt kê 11 tệp thay đổi, sai đường dẫn đầu thành ackend/agent.py. Không coi đây là audit toàn dự án hoặc bằng chứng F12.

## Bàn giao và giới hạn

Đã gửi Antigravity yêu cầu tại `.bridge/DEBUG_REVIEW_REQUEST.md`. CLI bị từ chối RunCommand và WriteFile; auto mode không khả dụng. Chưa có bản sửa để nghiệm thu. Cần cấp quyền chạy lệnh kiểm thử và ghi tệp dự án trong Antigravity rồi tiếp tục cùng phiên `55d3c139-6484-4282-8298-73a34ae61a4c`.
Chưa xác minh lại Gemini live, tải đồng thời, Firebase production, WCAG hoặc Core Web Vitals. Thiếu phán quyết Sonnet mới. Chỉ phát hành khi đã sửa, kiểm thử độc lập và đóng các gate bắt buộc.
