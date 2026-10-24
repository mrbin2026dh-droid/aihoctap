# Gate bảo vệ tính năng khi sửa AI

Áp dụng cùng YEU_CAU_ANTIGRAVITY_FIX_AI_KHONG_HOI_QUY.md. Đây là yêu cầu thực hiện, chưa phải CI đã cài hoặc chứng nhận an toàn.

## Ma trận bắt buộc
| Phần sửa | Tính năng phải kiểm lại |
|---|---|
| agent.py | Gemini mock, fallback, chặn lộ đáp án, phạm vi bài, chấm một câu/cả bài |
| contracts.py | Payload dashboard/theory/quiz, history, lựa chọn thiếu/sai, caller dùng chung |
| server.py | Chat, bài nháp, rate limit, lỗi an toàn, route/quyền dùng chung bị ảnh hưởng |
| app.js dữ liệu chat | Đăng nhập, mở/chuyển bài, chọn/chấm đáp án, hỏi AI, chuyển view, hủy yêu cầu |
| fixtures/tests | Dữ liệu tạm, session sạch, mock đúng nhánh, không ghi Firebase thật |

Mở rộng ma trận theo CodeGraph; không chỉ chạy các test ghi trong báo cáo cũ. Trước khi chạy test browser hiện có, sửa cơ chế tái sử dụng cổng 8000: dùng server fixture riêng, dữ liệu tạm và teardown; socket mở không chứng minh đúng ứng dụng.

## Ca AI không được thiếu
- Chọn B trên quiz: payload gửi B từ userSelections.
- Sai+is_correct=true không khen; thiếu choice/qid lạ cũng không khen.
- CPU xin đáp án không nhận mẫu Dữ liệu/Thông tin.
- Chọn màn hình sai, xin giải thích: hint đúng lựa chọn, không nhảy sang CPU chung.
- Lớp 9 bài 1 hỏi SUMIF: không dạy cú pháp ngoài bài.
- Mock Gemini nhận câu hỏi, lựa chọn và history phân vai; assert generate_content được gọi.
- Dashboard/theory/quiz có test riêng; 200 không tự chứng minh Gemini thật.
- Rỗng/timeout/429/500: fallback hoặc lỗi an toàn, không lộ nội bộ.
- Đổi bài/view, watchdog, typewriter: phản hồi cũ không sửa DOM/history; mở khóa đúng lượt.

## Đối chiếu trước/sau
Giữ cùng runtime, dependencies, bộ test, dữ liệu và cấu hình mock. Ghi thời gian, exit code, tổng PASS/FAIL/SKIP, hash và đường dẫn log. Tách test live dùng dữ liệu tổng hợp; không bắt buộc live trong mọi unit test.

Test tái hiện cũ yêu cầu lỗi tồn tại phải đổi thành regression hành vi đúng, không giữ assert lỗi rồi tuyên bố toàn suite xanh. Không bỏ lỗi baseline: sửa nếu thuộc phạm vi; ngoài phạm vi thì ghi rõ và chặn kết luận READY khi ảnh hưởng chức năng cần nghiệm thu.

Lỗi chung thì tách nhóm sửa, cập nhật vùng ảnh hưởng và chạy lại gate. Dừng trước phát hành; không dùng --no-verify, tắt guardrail hoặc thay đổi quyền để vượt kiểm tra. Cần test + review độc lập, không hứa hết lỗi chỉ bằng prompt.
