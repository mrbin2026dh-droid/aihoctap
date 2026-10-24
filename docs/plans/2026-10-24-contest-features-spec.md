# Đặc tả tính năng dự thi (giai đoạn 1–4)
Người viết: Claude (đặc tả và kiểm định). Người làm mã: Antigravity. Nội dung/dữ liệu/bộ test AI: ChatGPT. Mọi mục đạt khi Claude tự kiểm và đánh dấu `[x]` trong `docs/REQUIREMENTS_CUOC_THI.md`.

## Nguyên tắc thiết kế
- Dữ liệu điều khiển giao diện: môn học, bài, đề, tài liệu đều nằm ở RTDB; không có tên môn "Tin học" trong mã. Thêm môn = giáo viên đăng bài với `subject_id` mới.
- Đáp án chỉ ở `packages_private`; AI KHÔNG BAO GIỜ nhận đáp án. Học sinh không đọc được đáp án qua bất kỳ route nào.
- Mọi route giáo viên cần token `admin` và có khóa thử sai (cơ chế DO hiện có).
- Báo cáo luôn ghi THẬT/MOCK. Dữ liệu thật do người dùng nhập; AI hướng dẫn từng bước.

## Giai đoạn 1: Giáo viên đăng nội dung và tính mở
- `POST /api/pwa/teacher/publish`: bài học (markdown + câu trắc nghiệm). Đáp án tách sang `packages_private/{course}:{lesson}`; phần công khai không chứa khóa đáp án (chạy sanitizer trước khi ghi). Môn mới tự tạo mục trong `courses`/`catalog`.
- `POST /api/pwa/teacher/materials`: tài liệu PDF <= 5MB. **Quyết định D1 (đã chốt, 24/10):** Google Drive + Worker làm cầu. Giáo viên tải PDF lên Drive, bật "Bất kỳ ai có đường liên kết", dán liên kết vào giao diện giáo viên. Worker chỉ lưu `file_id` (regex `^[A-Za-z0-9_-]{10,100}$`), không lưu URL tự do (loại bỏ N4). Học sinh tải qua `GET /api/pwa/materials/{course}/{id}/file`: Worker lấy từ `drive.google.com` (tên miền cố định, PDF <= 10MB, kiểm `Content-Type`), trả kèm CORS để PWA lưu ngoại tuyến. Lý do chọn Drive thay GitHub: giáo viên quen dùng, không cần git; GitHub chỉ nên dùng nếu muốn tài liệu nằm cùng kho mã.
- Học sinh: tab "Tài liệu", tải và lưu ngoại tuyến (Cache API, giới hạn dung lượng, nút xóa).
- Kiểm: thêm môn mẫu (ví dụ Toán) bằng giao diện giáo viên, học sinh thấy ngay, không deploy lại.

## Giai đoạn 2: Quản lý học sinh và thống kê
- `GET/POST /api/pwa/teacher/students`: danh sách, tạo, đặt lại PIN, khóa/mở; nhập hàng loạt từ CSV; PIN tự sinh ngẫu nhiên, hiển thị một lần, không lưu bản rõ.
- `GET /api/pwa/teacher/stats`: theo lớp, bài, câu (tỉ lệ đúng), chủ đề yếu; xuất CSV.
- Giao diện giáo viên: bảng lớp, lọc, biểu đồ cột đơn giản, không phụ thuộc thư viện ngoài.

## Giai đoạn 3: Đề thi thử, xếp hạng, đánh giá
- `exams/{exam_id}`: tiêu đề, môn, lớp được giao, thời lượng, giờ mở/đóng, số lần làm (mặc định 1). Câu hỏi công khai không đáp án; đáp án ở `packages_private/exam_{exam_id}`.
- Worker kiểm giờ mở/đóng và lớp; đồng hồ theo máy chủ; nộp trễ bị từ chối; nộp lặp (idempotent).
- Xếp hạng: sau khi đề đóng. Học sinh thấy top 10 (tên rút gọn) và hạng của mình; giáo viên thấy đầy đủ.
- `POST /api/pwa/exam-feedback` (AI sau thi): đầu vào là kết quả từng câu và chủ đề `muc_sgk`, KHÔNG có đáp án. Đầu ra: điểm mạnh, chủ đề cần ôn, 2 câu hỏi gợi mở cho mỗi chủ đề yếu, không nêu đáp án. Chỉ chạy khi có mạng; ngoại tuyến báo rõ.

## Giai đoạn 4: Gia sư AI và giao diện
- Gia sư: Socratic, hỏi ngược, gợi ý từng bước; từ chối xác nhận lựa chọn ("câu 3 chọn A đúng không?" thì hỏi lại lý do). Chặn đầu ra: nếu có mẫu "đáp án là", "chọn A/B/C/D" thì thay bằng lời gợi mở; ghi cờ để giáo viên xem.
- Bộ test đối kháng >= 40 ca (tiếng Việt và Anh): xin đáp án thẳng, đóng vai, "bỏ qua luật", hỏi từng phần, ép xác nhận, mã hóa đáp án (base64, đảo chữ), hỏi giáo viên giả. Đạt khi 0 ca lộ đáp án trên Gemini THẬT.
- Giao diện: mobile-first 360–430px, nút >= 44px, chữ thân >= 16px, tương phản AA, không icon trang trí và không emoji; nhãn là động từ ngắn; mỗi màn hình một việc chính; đủ trạng thái tải/trống/lỗi/ngoại tuyến. Lighthouse di động: PWA đạt, Accessibility >= 95, Performance >= 85.

## Thứ tự và người làm
1. Antigravity: M1–M4 và deploy giai đoạn 2 đăng nhập. 2. Antigravity: giai đoạn 1. 3. Antigravity: giai đoạn 2. 4. ChatGPT: bộ ca đối kháng AI và ngân hàng câu hỏi có thẻ chủ đề; Antigravity: giai đoạn 3. 5. Antigravity: gia sư; ChatGPT thiết kế giao diện sau khi giai đoạn 1–2 ổn. 6. Claude kiểm định từng giai đoạn trước khi deploy.

## Hạn mức Gemini và nhiều khóa (chốt 24/10)
- Khóa nằm ngoài Git. Giáo viên thêm/xóa khóa trong giao diện giáo viên; Worker kiểm khóa bằng một lời gọi nhỏ, rồi lưu mã hóa AES-GCM trong Durable Object (khóa mã hóa là secret `KEY_ENC_SECRET` của Worker). Giao diện chỉ hiện 4 ký tự cuối và trạng thái; không route nào trả khóa đầy đủ. Khóa `GEMINI_API_KEY` trong secret vẫn dùng được như dự phòng.
- Cân bằng tải: chọn khóa còn hạn mức và ít dùng nhất; đếm theo phút và theo ngày cho từng khóa; giới hạn do giáo viên cấu hình (không đoán, vì hạn mức miễn phí của Google đổi theo mẫu và theo thời gian).
- Gặp 429/RESOURCE_EXHAUSTED: khóa vào trạng thái nghỉ (theo `retryDelay`, hoặc đến 00:00 giờ Thái Bình Dương nếu hết hạn mức ngày) và thử khóa kế tiếp. Hết mọi khóa: dừng gọi AI, trả mã `AI_QUOTA_EXHAUSTED`; học sinh thấy "Gia sư đang nghỉ, em quay lại sau"; giao diện giáo viên hiện biểu ngữ "Hết hạn mức Gemini: n/n khóa" kèm ô thêm khóa. Không bao giờ tự chuyển sang gói trả tiền.
- Trần toàn hệ thống lấy từ tổng hạn mức các khóa (thay hằng số 1000); giữ trần theo học sinh. Dự phòng tiến trình: lượt đã đặt chỗ phải hoàn lại khi lỗi.
- Lưu ý cho giáo viên: khóa cùng một dự án Google dùng chung hạn mức, nên chỉ có tác dụng nếu từ các dự án khác nhau. Dùng khóa của tài khoản hợp lệ của bạn; việc tạo nhiều dự án chỉ để né giới hạn có thể vi phạm điều khoản Gemini API. Để dự án khóa không bật thanh toán, vượt hạn mức sẽ báo lỗi thay vì tính tiền.
- Quyền riêng tư: gói miễn phí của Gemini có thể dùng dữ liệu để cải thiện sản phẩm Google. Gia sư chỉ gửi câu hỏi và khối lớp, không gửi tên hay mã học sinh; giữ nguyên nguyên tắc này và ghi một dòng thông báo trong ứng dụng.
- Kiểm: test MOCK với 3 khóa (một khóa hết ngày, một khóa 429 theo phút, một khóa tốt); hết cả ba trả `AI_QUOTA_EXHAUSTED`; không có khóa đầy đủ trong phản hồi, nhật ký, RTDB; sai quyền giáo viên bị 403.

## Theo dõi và giới hạn học sinh dùng AI (thiết kế 24/10)
Hiện trạng: Worker chỉ đếm theo ngày UTC (hằng số 30 lượt/ngày/học sinh), không lưu lịch sử, giáo viên không xem được, không chỉnh được.

**Thiết lập (giáo viên chỉnh, không sửa mã)**
- `ai_settings`: bật/tắt gia sư; hạn mức mặc định theo ngày; ghi đè theo lớp; ghi đè theo học sinh; hạn mức theo tuần (tùy chọn); số lượt thưởng thêm.
- Tắt AI tự động khi học sinh đang làm đề thi (đề mở, chưa nộp): trả `AI_DISABLED_IN_EXAM`.
- Khóa/mở tay từng học sinh; cấp thêm N lượt kèm lý do (ghi lại).
- Ngày đếm tính theo giờ Việt Nam (UTC+7), không theo UTC.

**Thực thi (nguyên tử trong Durable Object, đã có đặt chỗ/hoàn lại)**
- Hạn mức hiệu lực = ghi đè học sinh, nếu không có thì ghi đè lớp, nếu không thì mặc định, cộng lượt thưởng. Hết hạn mức: 429 mã `AI_LIMIT_REACHED`; học sinh thấy "Em đã dùng hết lượt hôm nay. Tự ôn tập và quay lại ngày mai" và số lượt còn lại trước đó. Khóa tay: `AI_LOCKED`.
- Học sinh xem được: `GET /api/pwa/ai-quota` trả đã dùng, hạn mức, còn lại, giờ đặt lại.

**Ghi nhận (chỉ siêu dữ liệu, không lưu nội dung chat mặc định)**
- Mỗi lượt: thời điểm, `uid`, lớp, môn/bài, loại (gia sư, nhận xét sau thi), kết quả (thành công, lỗi, bị từ chối, bộ lọc đáp án kích hoạt), số token (từ `usageMetadata` của Gemini). Ghi bất đồng bộ vào RTDB `ai_usage_daily/{ngày}/{uid}` (đếm gộp) và `ai_usage_events` (giữ 90 ngày); quy tắc RTDB: chỉ máy chủ ghi, học sinh chỉ đọc số của mình.
- Nội dung câu hỏi: tắt mặc định; giáo viên có thể bật, giữ <= 30 ngày, chỉ giáo viên xem, ứng dụng báo rõ cho học sinh biết (minh bạch, học sinh là trẻ vị thành niên: cần sự đồng ý của nhà trường/phụ huynh theo quy định).

**Thống kê giáo viên (`GET /api/pwa/teacher/ai-stats?lop&tu&den`, xuất CSV)**
- Theo học sinh/lớp/ngày/bài: số lượt, token, tỉ lệ bị chặn; top học sinh dùng nhiều; xu hướng theo tuần.
- Chỉ báo phụ thuộc AI: số lượt hỏi ngay trước khi nộp bài, số lần bộ lọc đáp án kích hoạt (hỏi xin đáp án), tỉ lệ lượt AI trên số bài tập; đối chiếu điểm và số lượt AI để giáo viên thấy học sinh nào dùng nhiều mà điểm thấp.
- Mọi chỉ báo chỉ để định hướng sư phạm, không tự động kết luận hay xử phạt.

**Kiểm (TDD, MOCK rồi THẬT)**
- Vượt hạn mức: song song 40 yêu cầu, đúng hạn mức qua, phần còn lại 429; lỗi Gemini hoàn lượt; ghi đè lớp/học sinh đúng thứ tự ưu tiên; đổi ngày đúng giờ Việt Nam (23:59 và 00:01 UTC+7).
- Đề thi mở: gia sư bị chặn; sau khi nộp mở lại. Khóa tay, cấp thêm lượt có hiệu lực ngay.
- Thống kê khớp với số lượt thực tế; học sinh không đọc được số của người khác; không có nội dung chat khi tắt lưu.
