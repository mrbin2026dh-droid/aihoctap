# Thẩm định cấu trúc giao diện giáo viên (Claude, 25/10/2026) — KHÔNG ĐẠT

## Hiện trạng (đo trên bản đang chạy, mock API)
- Một trang dài duy nhất: 3148 px (máy tính), 3793 px (điện thoại 390 px). Không có thanh điều hướng, không có tab.
- Cùng một cuộn: chọn bài đã xuất bản, nội dung bài, câu hỏi/bài tập, bài đã nộp, tài liệu Drive, quản lý học sinh.
- 17 ô nhập cùng lúc trên một màn hình làm việc.
- Không có chỗ riêng cho đề thi (giữa kỳ, 15 phút). Yêu cầu A4/A5 chưa có giao diện.
- "Quản lý học sinh" (tài khoản học sinh) nằm lẫn trong vùng soạn bài. Cài đặt (đổi PIN, hạn mức AI, khóa API) tách riêng, nhưng là phần của tài khoản giáo viên.
- Nhãn kỹ thuật lọt ra giao diện: "(D1 / A6)", "(A9 / B7)", "(C5)".

## Lỗi nghiệp vụ
1. Bài học + bài tập, tài liệu (đề cương, ngân hàng câu hỏi) và đề kiểm tra là ba việc khác nhau (đối tượng, vòng đời, quyền xem đáp án, có giới hạn thời gian hay không) nhưng đang dùng chung một biểu mẫu.
2. Quản lý tài khoản (giáo viên và học sinh) phải là khu riêng, có kiểm soát quyền cao hơn (AGENTS H).
3. Không tách "soạn" khỏi "xem kết quả", nên giáo viên phải cuộn qua cả form để xem bài nộp.

## Cấu trúc đề xuất (thanh điều hướng 5 mục; điện thoại: thanh dưới/danh sách, máy tính: thanh bên — theo AGENTS K)
1. **Bài học** — danh sách bài (lọc theo lớp/môn), Soạn bài mới, mở bài để sửa. Bên trong bài: tab "Nội dung" và "Bài tập". Xuất bản tạo phiên bản mới.
2. **Tài liệu** — đề cương, ngân hàng câu hỏi, tệp Drive. Có loại tài liệu, lớp áp dụng, bật/tắt hiển thị cho học sinh. Không có điểm.
3. **Đề kiểm tra** — loại: 15 phút / 1 tiết / giữa kỳ / cuối kỳ. Chọn lớp, thời gian làm bài, cửa sổ mở–đóng, số lần làm, trộn câu, khi nào lộ đáp án. Giao đề, theo dõi, chấm tự luận. (A4/A5)
4. **Kết quả** — theo bài học, theo đề kiểm tra, theo học sinh. Xuất CSV.
5. **Quản lý** — Học sinh (thêm, đặt lại PIN, khóa, xóa; xác nhận bằng hộp thoại), Tài khoản giáo viên (đổi PIN), Gia sư AI và hạn mức, Khóa API.

Quy tắc: mỗi mục một mục đích, tối đa một biểu mẫu chính trên màn hình, nút Lưu cố định, cảnh báo thay đổi chưa lưu (có sẵn checkDirtyAndProceed), không còn mã nhãn kỹ thuật.

## Phân kỳ đề xuất
- Đợt 1 (không đổi Worker): dựng điều hướng 5 mục, chuyển các phần hiện có vào đúng mục, bỏ nhãn kỹ thuật. Đưa Quản lý học sinh sang "Quản lý".
- Đợt 2 (cần Worker + Firebase rules): kiểu dữ liệu và API cho Tài liệu và Đề kiểm tra (nhóm bảo mật CAO: đáp án đề thi chỉ ở máy chủ).
- Đợt 3: học sinh làm đề (đếm giờ, tự lưu nháp, nộp một lần), chấm và kết quả.
