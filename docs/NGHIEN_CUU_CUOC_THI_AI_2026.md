# Đối chiếu hướng dự thi và điểm sáng tạo
Ngày: 26/10/2026 — ChatGPT/Codex. Đây là tư vấn nội dung, không phải phán quyết kiểm định của Claude.

## Phạm vi và nguồn
- Chưa được người dùng xác nhận chính xác đơn vị tổ chức. Tạm đối chiếu Giải thưởng Tiên phong Ứng dụng AI trong Giáo dục Việt Nam 2026.
- Trang chương trình: https://ieeai.net/giaithuong — tra ngày 26/10/2026. Trang thông báo hạn 30/10/2026, 23:59 GMT+7; trang Google Sites cũ còn ghi 25/10. Cần kiểm lại thông báo tại lúc nộp.
- Thể lệ được trang chương trình dẫn tới: https://drive.google.com/file/d/1YvnvUmai4GuhscvXhrKXSuhrMU79RGth/view — công cụ chỉ đọc được màn chờ, chưa đọc được PDF; không xác nhận trọng số hoặc toàn bộ điều kiện.
- Đối chiếu sản phẩm năm trước: https://ieeai.net/top-50 — danh sách có chatbot tự học, tự học cá nhân hóa Toán 8, AI Tutor và ebook tích hợp AI. Chỉ biết tên/mô tả ngắn, chưa khảo sát sâu sản phẩm.
- Dữ kiện app: phần đầu và nhật ký cuối aisgk.md; docs/REQUIREMENTS_CUOC_THI.md; docs/plans/2026-10-24-contest-features-spec.md. Lý do đọc đặc tả: phân biệt kế hoạch với tính năng đã nghiệm thu. Không kiểm mã hoặc bản chạy thật trong phiên này.

## Kết luận
Phù hợp về hướng ứng dụng; chưa đủ bằng chứng kết luận đã đáp ứng toàn bộ thể lệ hoặc có lợi thế giải thưởng. Không thể chấm phần trăm hoàn thiện từ tài liệu hiện có.
Tệp REQUIREMENTS là bảng mục tiêu nội bộ, không phải bản thể lệ chính thức. Nhiều mục mới [~], không đồng nghĩa đã chạy ổn trên bản thật; chỉ Claude được nghiệm thu.

| Trục đánh giá của chương trình | Đối chiếu hồ sơ hiện có | Việc cần bổ sung |
|---|---|---|
| Thực tiễn | Học trên điện thoại, bài tập, giáo viên đăng nội dung phù hợp nhu cầu | Nêu lớp, bài và khó khăn thực tế cụ thể; demo luồng hoàn chỉnh |
| Sáng tạo | Socrates, PWA và tính mở là nền tảng có triển vọng | Chứng minh cách tổ chức học tạo giá trị khác biệt; không gọi chatbot/PWA là mới tuyệt đối |
| Tác động | Chưa thấy số liệu học tập thật trong bộ tài liệu vừa đọc | Đo trước–sau, bài vận dụng độc lập, thời gian giáo viên, phản hồi |
| Bền vững và nhân rộng | Có thiết kế nhiều môn, hạn mức, học ngoại tuyến | Giáo viên khác tự thêm bài; đo chi phí; chứng minh ranh giới online/offline |
| Trình bày | Chưa xác minh bộ hồ sơ dự thi | Chuẩn bị theo mẫu hiện hành; phân biệt đã có, đang thử và đề xuất |

## Điểm mới nên chọn
Đề xuất định vị: “Nền tảng tự học có AI gợi mở theo lỗi hiểu, giúp học sinh từng bước tự làm được và giúp giáo viên chọn đúng nội dung cần hỗ trợ.” Đây là hướng đề xuất, chưa triển khai/chưa chứng minh hiệu quả.

### 1. Chu trình sửa lỗi hiểu và kiểm tra tự lực — ưu tiên cao nhất
Luồng: tự làm → nêu lý do → chọn/nhận gợi ý phù hợp → thử lại → làm câu tương đương khi tắt AI → giáo viên xem kết quả để hỗ trợ.
- Mỗi câu gắn mục tiêu, kiến thức tiên quyết, lỗi hiểu thường gặp và câu hỏi gợi mở do giáo viên duyệt.
- Một lựa chọn sai chưa đủ kết luận học sinh hiểu sai điều gì. Kết hợp lý do ngắn và nhiều lần thể hiện; khi thiếu dữ kiện hỏi thêm, không gán nhãn học sinh.
- AI giúp chọn cách hỏi phù hợp với biểu hiện vừa có; quy tắc cố định vẫn có thể làm phần lựa chọn bài và theo dõi. Cần chứng minh AI bổ sung giá trị gì so với chỉ dùng cây câu hỏi có sẵn.
- Gợi mở chỉ về khái niệm, ví dụ khác và câu hỏi suy nghĩ; không xác nhận lựa chọn, loại trừ phương án hay làm hộ bài đang đánh giá. Claude phải kiểm định trước triển khai.
- Câu vận dụng độc lập mới là minh chứng chính cho việc tự làm được; số lượt chat và điểm làm lại không đủ.

Ví dụ Tin học: học sinh nhầm vai trò trình duyệt và công cụ tìm kiếm. App hỏi học sinh mô tả thao tác vừa làm, đưa câu hỏi về chức năng, rồi giao một tình huống mới. Báo cáo chỉ ghi biểu hiện và kết quả bài độc lập; không suy diễn năng lực cố định.

### 2. Hồ sơ tiến bộ để giáo viên can thiệp
- Hiển thị theo chủ đề: lần làm đầu, mức hỗ trợ, bài độc lập sau hỗ trợ, nhu cầu ôn tiếp.
- Giáo viên thấy nhóm nào cần hỗ trợ cùng chủ đề và một hoạt động ôn ngắn được đề nghị; giáo viên quyết định.
- Không dùng lượt AI nhiều/ít để tự động kết luận lệ thuộc, gian lận hoặc xếp loại.
- Trước mắt có thể thu bằng phiếu giáo viên trong buổi thử được duyệt; chưa cần làm ngay một phân hệ lớn.

### 3. Gói học tiếp nối khi mất mạng
- Nội dung, hoạt động và câu hỏi gợi mở tĩnh được giáo viên duyệt có thể tải trước; AI sinh phản hồi chỉ khi online.
- Minh họa đang học → mất mạng → tiếp tục đọc/làm/giữ nháp → có mạng → đồng bộ đúng.
- Phạm vi chấm và đồng bộ cần Antigravity làm rõ, Claude kiểm định; không hứa chấm bài bảo mật hoàn toàn ngoại tuyến khi chưa có bằng chứng.
- Tính mới nằm ở cách duy trì việc học trong bối cảnh thực tế và minh chứng tiếp cận, không chỉ ở nhãn PWA.

## Cách chứng minh
Sau khi Claude cho phép dùng dữ liệu thật, chọn một lớp và một chủ đề nhỏ; giáo viên duyệt học liệu, nhà trường/phụ huynh xử lý quyền tham gia và dữ liệu phù hợp. Không tự mở thử thật khi dự án còn ở cổng MOCK.
1. Bài đầu vào ngắn và bài đầu ra tương đương, cùng mục tiêu, làm độc lập không AI; ghi số người tham gia và vắng/thiếu bài.
2. Lưu tỷ lệ đúng theo mục tiêu và lý do học sinh, mức gợi ý, số học sinh hoàn thành bài vận dụng mới.
3. Đo thời gian giáo viên chuẩn bị/nhận diện nhóm cần ôn, thời gian dùng app, lỗi kỹ thuật và chi phí AI thực tế. So sánh cùng loại công việc.
4. Nếu có điều kiện, so với phương pháp đang dùng hoặc luân phiên hai nhóm/chủ đề tương đương; không kết luận quan hệ nhân quả từ một lần trước–sau.
5. Kiểm tra lại sau 7–14 ngày khi có thời gian; đây là kế hoạch tiếp theo nếu hạn nộp quá gần, không ghi như kết quả đã có.
6. Dùng dữ liệu tổng hợp/ẩn danh trong hồ sơ. Mọi con số phải truy được phép đo; tuyệt đối không tạo số liệu minh họa rồi trình bày như thật.

## Thứ tự từ 26/10
- Trước hết xác nhận đúng cuộc thi, mẫu hồ sơ, thời hạn và điều kiện tác giả; trang chương trình có lưu ý về việc nhờ người khác hỗ trợ/thực hiện thay. Vì app có AI hỗ trợ phát triển, hỏi BTC cách áp dụng vào trường hợp dùng công cụ AI; không tự kết luận đủ hoặc mất tư cách.
- Chọn một câu chuyện demo: học sinh mắc một lỗi → gợi mở → tự làm câu mới → giáo viên nhận biết phần cần ôn. Dùng luồng đã chạy ổn, ghi nhãn rõ mọi phần chưa có.
- Đề thi, xếp hạng và giao diện quản trị đầy đủ vẫn là phạm vi sản phẩm; không cần dùng toàn bộ làm điểm nhấn khoa học của bài dự thi.
- Nếu chưa có nghiên cứu lớp học trước hạn, trình bày trung thực kết quả dùng thử kỹ thuật và giới hạn; không thể thay dữ liệu học tập thật bằng MOCK.
- Không mở rộng thêm công nghệ chỉ để tạo cảm giác mới. Ưu tiên minh chứng một chu trình học thực sự hoạt động trước khi tăng số tính năng/môn.

## Bàn giao
Người dùng xác nhận cuộc thi và chọn hướng; sau đó ChatGPT viết bộ học liệu mẫu/phiếu đo. Mọi triển khai mã nguồn chuyển Antigravity, mọi nội dung liên quan đáp án/guardrail chuyển Claude kiểm định. Báo cáo này không cho phép deploy, commit hoặc push.
