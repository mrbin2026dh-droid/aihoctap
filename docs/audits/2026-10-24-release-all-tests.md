# Sửa lỗi toàn dự án và đưa vào main — 24/10/2026

## Phạm vi và 20 test ban đầu

Người dùng yêu cầu sửa toàn bộ 20 ca còn lỗi của đợt gia sư, rồi đưa cả gia sư và các bản sửa vào main. Danh sách đầy đủ được giữ tại [20 test ban đầu](2026-10-24-grade9-unresolved-tests.md). Không thay đổi cơ chế PIN.

Các nhóm được sửa và kiểm tra:

- Đăng nhập, phân quyền, trang đầu, điều hướng bài/khối, dashboard: dùng phiên thật do API cấp trong test; giáo viên đổi khối vẫn xem được bài. Google/Facebook thiếu kết nối không tự tạo phiên giả; Facebook hợp lệ giữ ID token.
- Thi: tạo/sửa/mở/khóa đề, đủ câu mới nộp, điểm và danh tính do backend quyết định. Không nhận mã học sinh/lớp/khối giả từ trình duyệt. Lưu tên đề vào bài nộp và lịch sử.
- Analytics: đọc đúng sổ bộ cấu hình và bài nộp cục bộ; chấp nhận not_started; điểm 0 là kết quả đã ghi nhận. Không coi điểm thi là hoàn thành bài SGK, không suy diễn tiến bộ hay điểm từng chủ đề. Lớp rỗng/thiếu điểm chủ đề không gây lỗi 500. Firebase khả dụng vẫn được giữ làm nguồn; đề chỉ có trên cloud không bị mất.
- Gia sư/giao diện: tiến độ dựa trên câu làm đúng; gợi ý thay đổi theo bài/câu; giữ các rào chắn chống lộ đáp án, thử lại và hủy phản hồi cũ. Thống kê thiếu dữ liệu xếp hạng hiển thị chưa đủ dữ liệu.
- Tài liệu: upload PDF giả lập, gọi đúng ranh giới Firebase, xóa và tải lại không khôi phục tài liệu đã xóa.

## Cách kiểm tra và giới hạn bằng chứng

Test trình duyệt cũ được cập nhật selector và hợp đồng giao diện hiện tại, thay máy chủ chung cổng 8000/phiên giả bằng HTTP server riêng từng test, xác thực thật, dữ liệu dùng một lần. Không thêm skip/xfail. Bỏ ảnh và thời gian ngủ không cần thiết; giữ các kiểm tra nghiệp vụ. Hai browser context giáo viên/học sinh tách localStorage/cookie, tắt BroadcastChannel; học sinh nộp bài qua HTTP và giáo viên nhận điểm qua backend.

Firebase trong test là ranh giới giả lập hoặc bị cô lập; không ghi dữ liệu nhà trường, không gọi AI trả phí. Các kiểm thử không thay thế đánh giá toàn diện Google/Facebook/Firebase hay Gemini production. Smoke Gemini thật của đợt trước chỉ dùng câu hỏi/nội dung tự viết giả lập.

CodeGraph và Context7 đã được sử dụng. Các agent độc lập đã thẩm định kế hoạch, các phần frontend/thi và phát hiện lỗi mất nguồn cloud, thiếu score_count và thiếu bằng chứng analytics; đã sửa theo phản biện. Sonnet không khả dụng; không có phán quyết Sonnet. Các agent hết hạn mức trước vòng rà soát cuối; bản cuối được kiểm tra bằng toàn-suite và gate tự động, không mô tả là được Sonnet/agent độc lập duyệt lại toàn bộ.

Alibaba đạt nhưng bộ tự chạy F12 của nó không tìm thấy frontend/index.html nên bỏ qua browser. Bằng chứng trình duyệt đến từ Playwright riêng. Kiểm tra responsive, điều khiển bàn phím/Escape và console nằm trong suite; không tuyên bố chứng nhận WCAG toàn ứng dụng hoặc Core Web Vitals production. Chỉ số lab LCP/CLS được ghi riêng; chưa có INP thực địa.

## Kết quả cuối

- Toàn-suite: **443 passed, 9 warnings, 226.74s**; không failed/skipped/xfail. Log cục bộ: `scratch/release-final.log`. Đối chiếu từng node ID trong danh sách ban đầu: **20/20 PASS**.
- JavaScript: **19/19 PASS**, lệnh `node --test tests/backend_routing.test.cjs tests/student_progress.test.cjs tests/tutor_frontend.test.cjs`.
- V8 `node --check frontend/app.js`, Oxlint `-D correctness`, Alibaba staged gate và kiểm tra whitespace đạt. Cảnh báo Python đến từ thư viện bên thứ ba (Google/openpyxl), không phải test thất bại.
- Luồng gia sư chạy lại riêng: **1 PASS**, lab LCP **436 ms**, CLS **0.0774** khi cô lập dịch vụ ngoài; `scratch/release-perf.log`. Không dùng số đo lab để tuyên bố chất lượng production.
- Các tệp kiểm thử/hỗ trợ cần thiết được đưa cùng bản sửa; các tài liệu và script chưa theo dõi ngoài tác vụ được giữ nguyên, không đưa vào commit.
- Bản sửa được chuẩn bị để fast-forward main theo yêu cầu, không force push. Kiểm tra health Render trước phát hành trả HTTP 200 nhưng mã JavaScript còn cũ; Git push và xác nhận hosting là hai bằng chứng riêng.

## Bổ sung cấu hình phát hành Pages

Main đã được đẩy tại `b0bef4d`; SHA đọc lại từ GitHub trùng bản đã kiểm thử. Render sau đó trả health healthy và nội dung app.js khớp bản này.

GitHub Pages thực tế lấy từ nhánh `gh-pages`, không phải main. Bản Pages cần cấu hình backend Render riêng và phiên bản URL script mới, giữ nguyên custom backend của người dùng. Hook static preview tái hiện lỗi 404 API, rồi lỗi CORS trên cổng localhost ngẫu nhiên. Backend được bổ sung đúng origin localhost/127.0.0.1 với cổng tùy chọn, không thêm domain Internet khác. Test trước sửa: 2 FAIL, 4 PASS; sau sửa cùng hồi quy danh tính/phân quyền/backend: **20 PASS**, gồm 6 ca CORS mới (GET/preflight và domain giả mạo). Full-suite 443 ở trên được đo trước bổ sung CORS; không gọi đó là một lần full-suite 449.
