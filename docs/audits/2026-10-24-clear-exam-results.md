# Dọn kết quả thi — 24/10/2026

Người dùng đã xác nhận: xóa toàn bộ kết quả thi hiện có, giữ đề thi và tài khoản. Không xóa bài học/tiến độ luyện tập SGK, không đổi PIN.

## Dữ liệu đã dọn

- Firebase: xóa 10 bài nộp trong exam_submissions và 8 bản sao kết quả tại students/.../exams. Sau xóa, hai nguồn này đều không còn kết quả.
- Giữ 19 hồ sơ tài khoản, toàn bộ đề và đáp án. Một node chỉ chứa kết quả được giữ bằng uid chuẩn bằng khóa node trước khi xóa nhánh exams; các trường hồ sơ có sẵn không đổi. Không xóa tài khoản Firebase Auth.
- Các lần xóa dùng ETag/if-match và so sánh với bản sao lưu trước khi xóa; gặp thay đổi đồng thời thì dừng. Đã so sánh lại đề, đáp án và hồ sơ không liên quan sau khi dọn.
- Main: xóa 6 JSON kết quả vận hành khỏi bản hiện hành; thêm ignore để không đưa bài nộp mới vào Git. Không xóa định nghĩa đề thi.
- Trình duyệt: migration một lần xóa đúng AISGK_SUBMISSIONS và aisgk_offline_submissions trước khi đọc/đồng bộ. Ghi dấu hoàn tất sau khi dọn thành công; lần tải lại sau giữ kết quả mới, đăng nhập, đề và tiến độ SGK.
- Điểm trung bình cũ trong hồ sơ được giữ nguyên dữ liệu, nhưng giao diện không biến riêng số tổng hợp đó thành một bài làm còn tồn tại. Điểm từ bài luyện SGK có dữ liệu thật vẫn được tính.

## Bảo quản và kiểm chứng

Bản sao lưu đầy đủ và manifest nằm riêng trong scratch (Git ignore), không đưa lên GitHub/Pages. Không ghi nội dung hồ sơ, mật khẩu hay dữ liệu bài nộp vào báo cáo công khai này. Xóa trên phiên bản Git hiện hành, không rewrite lịch sử repository.

CodeGraph và Context7 Firebase REST đã dùng. Independent reviewer đã rà soát migration và chạy riêng 6 test mới PASS. Đã sửa theo phản biện: thêm test lỗi xóa một phần/ghi marker, loại điểm trung bình cũ không có bài làm. Không có Sonnet trong môi trường; dùng reviewer Codex độc lập theo phương án đã chấp thuận trước đó.

Gate toàn-suite: **450 PASS, 0 FAIL, 9 cảnh báo deprecation thư viện trong 302.27s** (`scratch/cleanup-all-final.log`). Node: **25 PASS**; outbox: **6 tình huống PASS**. Các test thi/analytics liên quan: 22 PASS; test reload migration trình duyệt: 1 PASS. V8/Oxlint/Alibaba đạt. Browser của chính Alibaba không tìm thấy index.html tại root main; bằng chứng reload đến từ test Playwright riêng. Đang phát hành main/Pages sau khi tất cả gate đạt.

Các tab cũ đã mở trước phát hành cần tải lại để áp dụng migration; một request đang chạy hoặc tab cũ còn hoạt động có thể ghi lại dữ liệu sau thời điểm dọn. Sẽ kiểm tra lại cloud sau phát hành. Đây là một lần dọn theo yêu cầu, không khóa học sinh nộp bài mới.
