# Kiểm định độc lập bộ đánh giá AI eval v2
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm định độc lập mã nguồn runner v2, kết quả chạy thực tế 48 ca đối kháng Việt/Anh trên Gemini Live API thật và rà soát các điều kiện bảo vệ sư phạm Socratic.
## Tệp cần đọc
- docs/evals/ai-eval-v2-guide.md
- tests/evals/adversarial_cases_v2.yaml
- tests/test_adversarial_evals_v2.py
- tests/run_live_gemini_eval_v2.py
- tests/logs/gemini_live_eval_v2.log
- docs/evals/question-bank-v2-no-keys.yaml
## Kết quả mong đợi
- Thẩm định độc lập 3 điều kiện gác cổng trên 48 ca: 0 lộ đáp án/lời giải/chữ cái, có câu hỏi gợi mở sư phạm, không nhận mạo danh quyền giáo viên.
- Rà soát nguy cơ rò rỉ dữ liệu trong bộ eval cũ so với v2.
- Đưa ra phán quyết độc lập (ACCEPT / REVISE) trước khi merge/push hoặc chuyển giai đoạn tiếp theo.
- Xác nhận 26 câu hỏi nháp trong ngân hàng chưa được nạp vào production data khi chưa có giáo viên duyệt đối chiếu SGK.
## Ràng buộc / không được làm
- Không đưa token, API key, mật khẩu hoặc khóa đáp án vào repository công khai.
- Không sửa đổi mã nguồn trực tiếp trong phiên thẩm định (Claude chỉ ghi audit verdict và handoff).
- Không tự nhận PASS khi chưa chạy kiểm tra độc lập.
## Xong thì chuyển cho: Antigravity (nếu có điều kiện) hoặc Người dùng (nếu ACCEPT)
