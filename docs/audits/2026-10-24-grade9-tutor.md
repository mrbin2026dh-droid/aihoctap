# Gia sư lớp 9 - bản sửa 24/10/2026

## Hành vi đã sửa
- Gợi ý ba tầng bám bài và câu hỏi đang học, không dùng lời giải sẵn ở tầng 3.
- Chặn đáp án viết trực tiếp, từ khóa cấm, định dạng ẩn/Markdown, chỉ thứ tự lựa chọn, loại phương án và công thức hoàn chỉnh trong câu đang làm.
- Gemini nhận đề/các lựa chọn/lượt học thực tế; hội thoại dùng đúng vai user/model. Không truyền trường đáp án đúng; không tin is_correct từ trình duyệt.
- Dán nguyên câu hỏi ở tab lý thuyết vẫn được coi là bài tập. Khi thiếu nội dung SGK hoặc đang thi, chỉ hỗ trợ quy trình học.
- Lựa chọn thật được gửi tới AI; chọn sai có thể thử lại; đếm lần làm một lần; lỗi mạng không bị coi là trả lời sai.
- Hủy phản hồi cũ khi đổi bài/khối/view; giữ các sửa lỗi AI đã có trên máy sau khi kiểm tra.
- Không thay đổi cơ chế PIN; giữ các tệp ngoài phạm vi chưa commit.

## Kiểm chứng
Gate AI: 328 pytest PASS; 9 Node PASS. Có test cho 40 câu hỏi x 3 tầng, toàn bộ 40 đáp án bị trả về bởi Gemini giả lập, timeout/quota/rỗng, giả mạo ngữ cảnh, lý thuyết và thi. Luồng trình duyệt thật: sai -> hỏi AI -> thử lại -> đổi bài. Có một smoke test Gemini thật chỉ dùng bài học/câu hỏi tự viết hoàn toàn giả lập: mô hình trả lời thành công, bộ lọc đạt, 4094ms. Không gửi nội dung SGK cục bộ hay dữ liệu học sinh thật.
V8, Oxlint và Alibaba auditor đạt. Auditor tự động không tìm thấy frontend/index.html nên bỏ qua phần browser của chính nó; browser riêng đã chạy thật, không dùng thông báo auditor làm bằng chứng thay thế.
Bố cục không tràn ở 1920x1080,1366x768,390x844. Lab LCP 1048ms, CLS 0.064 khi cô lập dịch vụ ngoài; chưa đo INP/production. Có cảnh báo deprecation Python 3.14 từ SDK Google.

## Trạng thái hồi quy toàn dự án
Lần đầy đủ cuối: 409 PASS,20 FAIL,9 warnings trong 400.16s (scratch/tutor-release-suite.log). Các lỗi chưa sửa thuộc đăng nhập/thi/dashboard/analytics; xem 2026-10-24-grade9-unresolved-tests.md. Sau bổ sung chốt phạm vi, gate AI chạy lại đạt 328 PASS. Chưa xác nhận toàn dự án sẵn sàng phát hành.

## Giới hạn
Bộ lọc kết hợp quy tắc và prompt, không bảo đảm chặn mọi cách diễn đạt ngữ nghĩa. Smoke test thật chỉ xác nhận đường gọi API và một tình huống giả lập; chưa đánh giá toàn diện chất lượng Gemini hoặc triển khai production. Bản sửa đưa lên nhánh riêng để xem xét, không tự gộp main.
