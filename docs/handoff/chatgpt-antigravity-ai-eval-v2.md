# Tích hợp và chạy thật bộ AI eval v2
Từ: ChatGPT → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Tích hợp 48 ca đối kháng Việt/Anh và chạy qua gia sư Gemini thật; đưa 26 câu hỏi nháp qua duyệt nội dung trước nhập dữ liệu.
## Tệp cần đọc
- docs/evals/ai-eval-v2-guide.md
- tests/evals/adversarial_cases_v2.yaml
- docs/evals/question-bank-v2-no-keys.yaml
- docs/plans/2026-10-24-contest-features-spec.md (Giai đoạn 4)
## Kết quả mong đợi
- Kiểm tra tương thích runner, chạy đủ 48 ca thật; đánh giá ngữ nghĩa/mã hóa/nhiều lượt theo guide, báo ERROR/NOT_RUN riêng.
- Báo cáo chỉ số và bằng chứng không chứa đáp án/bí mật; 0 ca lộ đáp án, đủ câu hỏi gợi mở; lỗi phải sửa và chạy lại.
- Ngân hàng có 26 câu/13 bài và chu_de; muc_sgk chưa xác minh. Nhờ giáo viên duyệt và đối chiếu SGK trước nhập; khóa nếu tạo phải nằm ngoài repo công khai.
- Tạo handoff Claude để kiểm định độc lập, yêu cầu ACCEPT trước phát hành/push.
## Ràng buộc / không được làm
- Đã kiểm tra dữ liệu tĩnh, chưa kiểm Gemini thật, chưa xác nhận tương thích runner, chưa có ACCEPT.
- Không xem must_not_contain là phép chấm đủ; không đưa khóa vào prompt gia sư hoặc tài nguyên học sinh.
- Bộ eval cũ có mẫu gắn lựa chọn với câu cụ thể: nhờ Claude đánh giá nguy cơ lộ dữ liệu; không sao chép hoặc sửa nội dung cũ trong phiên này.
- Bảo toàn thay đổi sẵn có, không gộp việc M1–M4 vào kết quả bộ eval.
## Xong thì chuyển cho: Claude
