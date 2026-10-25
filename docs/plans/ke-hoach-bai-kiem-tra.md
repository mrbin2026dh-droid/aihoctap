# Kế hoạch tính năng Kiểm tra (Thử / Thật)

Trạng thái: chỉ có kế hoạch, ô chọn "Hình thức" trên form giáo viên (bản xem thử) và mục "Thi" trên menu học sinh (hiện báo "Chưa có bài kiểm tra"). Màn hình thi và phần máy chủ làm sau.

## 1. Hai hình thức
| | Thử | Thật |
|---|---|---|
| Mục đích | Ôn luyện trước khi thi | Thi chính thức |
| Học sinh vào | Như bài luyện tập, màn hình học thường | Màn hình thi riêng (toàn khung, không menu) |
| Số lần làm | Không giới hạn | Theo giáo viên đặt (mặc định 1) |
| Giờ mở/đóng, đồng hồ | Không | Có |
| Hiện đáp án | Theo câu, ngay sau khi nộp | Theo cấu hình: sau nộp / sau khi đóng / không |
| Tính vào thống kê | Có (gợi ý ôn tập) | Báo cáo riêng, không lẫn với luyện tập |
| Trộn câu | Tùy chọn | Tùy chọn (mỗi học sinh thứ tự khác) |

Quy tắc mã bài hiện tại (`exam_` chỉ nộp 1 lần) sẽ thay bằng trường `mode` và `max_attempts` của bài kiểm tra.

## 2. Dữ liệu
- `exams/{exam_id}` (công khai khi đang mở, không có đáp án): tiêu đề, lớp, môn, `mode: trial|real`, `minutes`, `opens_at`, `closes_at`, `max_attempts`, `shuffle`, `reveal: after-submit|after-close|never`, danh sách câu hỏi (giống bài học: id, prompt, options, topic).
- `exams_private/{exam_id}`: đáp án (chỉ Worker/admin).
- `exam_sessions/{uid}/{exam_id}`: do Worker ghi khi học sinh BẮT ĐẦU thi: `started_at`, `deadline = started_at + minutes` (không quá `closes_at`), `order` (thứ tự câu đã trộn), `attempt_no`. Đồng hồ tính ở máy chủ, không tin đồng hồ máy học sinh.
- `attempts` và `attempt_details`: dùng lại cấu trúc hiện có, thêm `exam_id`, `mode`.

## 3. Máy chủ (Worker)
- `POST /pwa/exams/start`: kiểm tra học sinh thuộc lớp, trong giờ mở/đóng, còn lượt; tạo phiên, trả đề (đã trộn, không đáp án) và `deadline`.
- `PUT /pwa/exams/save`: lưu nháp đáp án (tối đa 1 lần/15 giây) để mất mạng hoặc tắt máy vẫn khôi phục được.
- `POST /pwa/exams/submit`: chấm bằng đáp án riêng, từ chối nếu quá `deadline` + 30 giây ân hạn (nộp tự động khi hết giờ vẫn được nhận), idempotent theo `attempt_id`.
- `GET /pwa/exams`: danh sách đề của lớp em: sắp mở, đang mở, đã đóng, đã làm.
- Giáo viên: tạo/sửa/mở/đóng đề, nhập từ Excel, xem kết quả và phân tích điểm yếu theo đề (dùng lại `analyzeAttempts`).
- Thử: dùng đường luyện tập hiện có (không phiên, không đồng hồ).

## 4. Giao diện học sinh
Menu "Thi" (đã thêm): danh sách đề theo trạng thái. Đề Thử mở thẳng vào màn luyện tập. Đề Thật: thẻ có giờ mở/đóng, thời lượng, số lần còn lại, nút "Vào thi".

Bước vào thi (hộp thoại xác nhận): tên đề, số câu, thời gian, lưu ý "đồng hồ chạy ngay khi em bấm Bắt đầu và không dừng lại".

Màn hình thi, theo chuẩn các phần mềm thi trắc nghiệm (Moodle Quiz, Google Forms Quiz, VioEdu):
- Thanh trên cố định: tên đề, đồng hồ đếm ngược lớn (đổi màu khi còn 5 phút và 1 phút, đọc được bằng trình đọc màn hình ở các mốc), nút "Nộp bài".
- Một câu mỗi màn hình (điện thoại) hoặc danh sách cuộn (máy tính, tùy chọn). Nút "Câu trước / Câu sau" lớn, 48px.
- Bảng câu hỏi: lưới số câu; đã trả lời (xanh), chưa trả lời (trắng), đánh dấu xem lại (cam, có cờ). Bấm để nhảy câu.
- Nút "Đánh dấu xem lại" cho mỗi câu.
- Lưu tự động mỗi lần chọn (cục bộ) và gửi lên máy chủ định kỳ; hiện trạng thái "Đã lưu" / "Chưa gửi được, đang thử lại".
- Nộp bài: hộp thoại "Em đã trả lời X/Y câu, còn Z câu chưa làm, K câu đánh dấu. Nộp bài?" (nút chính "Nộp bài", nút phụ "Quay lại làm tiếp"). Hết giờ: tự nộp, báo rõ lý do.
- Mất mạng: vẫn làm tiếp, bài nộp xếp hàng chờ, hiện thông báo; nếu quá hạn máy chủ có ân hạn 30 giây tính từ lúc hết giờ theo đồng hồ máy chủ.
- Khôi phục: tắt tab/hết pin, đăng nhập lại vào cùng phiên, đồng hồ vẫn theo `deadline`.
- Không dùng thông báo nổi; dùng `<dialog>`. Mục tiêu chạm 48px, chữ >= 16px, tương phản AA, hỗ trợ bàn phím (phím mũi tên đổi câu, 1-4 hoặc A-D chọn đáp án).
- Sau nộp: màn kết quả theo cấu hình `reveal` (điểm, số câu đúng; xem đáp án nếu được phép).

Chống gian lận mức hợp lý (không hứa hơn khả năng của trình duyệt): trộn câu và đáp án theo học sinh, đồng hồ máy chủ, ghi lại số lần rời tab (hiện cho giáo viên, không tự phạt), mỗi học sinh một phiên tại một thời điểm.

## 5. Giao diện giáo viên
- Form đề (đã có xem thử): thêm "Hình thức: Thử / Thật". Chọn Thử thì khóa số lần làm và giờ; chọn Thật thì bắt buộc giờ mở/đóng, thời gian, số lần.
- Sửa lỗi bố cục: ô "Trộn câu hỏi" và khu vực tải Excel căn hàng đều (đã sửa).
- Danh sách đề: trạng thái, số học sinh đã nộp, nút mở/đóng sớm, xem kết quả và điểm yếu.

## 6. Thứ tự làm
1. (xong) Menu "Thi" học sinh, trường "Hình thức" trên form giáo viên.
2. Mô hình dữ liệu + Worker `exams/start|save|submit|list` + test (hết giờ, hết lượt, ngoài giờ mở, lớp khác, nộp trùng, ân hạn).
3. Màn hình thi học sinh (có test hành vi: đồng hồ, bảng câu, đánh dấu, nộp, hết giờ, mất mạng, khôi phục).
4. Giáo viên: quản lý đề, nhập Excel, báo cáo kết quả.
5. Thi thử với một lớp, đo và sửa trước khi dùng thật.

## 7. File Excel nhập câu hỏi (đã làm, 2026-10-25)
Cột theo thứ tự: STT, Loại (TN/TL), Câu hỏi, A, B, C, D, Đáp án đúng, Điểm, Chủ đề, Gợi ý. Điểm bắt buộc cho mọi câu (lớn hơn 0, tối đa 100, 2 chữ số thập phân, chấp nhận dấu phẩy). Trắc nghiệm: A và B bắt buộc, điền liền nhau, đúng một đáp án. Tự luận: để trống A-D và đáp án. Có kiểm tra tiêu đề cột, trùng câu, độ dài, tối đa 200 câu, file .xlsx dưới 2 MB. Tất cả hoặc không: còn một dòng lỗi thì chưa nhận câu nào. Tổng điểm khác 10 thì báo, điểm học sinh quy về thang 10. Mã: `frontend/hoc/exam-import.js` (hàm thuần, có test), thư viện Excel ở `frontend/hoc/vendor/` (MIT, nạp khi cần).
