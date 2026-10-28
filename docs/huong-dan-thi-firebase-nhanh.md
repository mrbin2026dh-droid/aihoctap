# Thi nhanh qua Firebase — hướng dẫn cài (27/10/2026)

## Cách hoạt động
- **Google Sheet** là nơi thầy cô soạn: HocSinh (tài khoản), DeThi (ngân hàng đề thi thật), bài thi tạo trong app, KetQua (sổ điểm).
- **Firebase** (dự án `ai-sgk-tinhoc`) là nơi học sinh đọc/ghi: đăng nhập, danh sách bài, đề, nộp bài. Nhanh (~0,2 giây), cập nhật tức thì.
- Học sinh **không chờ Worker hay Google Sheet**. Worker chỉ chạy ngầm sau khi vào app, dùng cho Gia sư AI.
- Thầy cô tạo/sửa/mở/khóa/xóa bài trong app → Sheet tự đẩy lên Firebase. Mở menu Thi → điểm trên Firebase tự chép về trang KetQua.
- Đổi lại: đề, đáp án và tài khoản (PIN đã băm một chiều) nằm trên Firebase ở dạng ai rành kỹ thuật có thể xem — chấp nhận được với học sinh THCS.

## Cài một lần (khoảng 10 phút)
1. **Code.gs mới**: Google Sheet → Tiện ích mở rộng → Apps Script → dán đè toàn bộ `apps-script/sheet-exam/Code.gs` → Lưu → Triển khai → Quản lý bản triển khai → Sửa ✏️ → **Phiên bản mới** → Triển khai. Tải lại trang Sheet.
   Lần đầu Google hỏi quyền "kết nối dịch vụ bên ngoài" → Cho phép (để Sheet gửi dữ liệu lên Firebase).
2. **Luật Firebase**: Firebase Console → dự án `ai-sgk-tinhoc` → Realtime Database → **Rules** → dán toàn bộ nội dung `spike/step0/database.rules.ai-sgk-final.json` → **Publish**.
   (Luật này cũng đóng lại chế độ thử nghiệm đang mở cho mọi người đến 18/11.)
3. **Khóa Firebase cho Sheet**: Firebase Console → ⚙️ Cài đặt dự án → **Service accounts** → **Database secrets** → Hiện → chép.
   Mở Google Sheet → menu **Bài thi → Cài khóa Firebase** → dán → OK. Sheet báo "Đã kết nối Firebase và đẩy … bài thi + danh sách học sinh lên".
   Khóa chỉ nằm trong Sheet của bạn (Script Properties) — không dán vào chat, không đưa lên GitHub.
4. Mở app giáo viên (Ctrl+F5) → **Thi** → bấm **Cập nhật lên Firebase** một lần.

## Học sinh thấy gì
- Đăng nhập app một lần → mục **Thi** hiện ngay các bài thầy cô đã tạo cho lớp/khối của em (không đăng nhập lại).
- Mỗi bài là một thẻ: loại thi, lớp/khối, Đang mở/Chưa mở, số câu, đã thi mấy lần; nút **Vào thi** / **Làm lại** chỉ hiện khi bài đang mở (không còn phòng chờ). Biểu tượng thống kê mở trang Kết quả.
- Bài thi thật "Trắc nghiệm + Thực hành": trong bài có ô **Bài thực hành** để học sinh tải file lên (tối đa 10 MB) — file vào thư mục lớp trên Google Drive của thầy cô.
- Nếu thầy cô bật **Cho xem điểm** cho bài đó: thẻ có nút **Kết quả** → điểm lần gần nhất, điểm cao nhất, số lần thi, **hạng trong lớp**, điểm trung bình lớp, bảng xếp hạng lớp (dòng của em được tô sáng).
- Nếu chưa bật: học sinh chỉ thấy "Đã nộp bài — thầy cô sẽ công bố điểm sau".
- Lưu ý: tab Thi chỉ có bài sau khi làm xong 3 bước cài đặt ở trên (Firebase còn trống thì hiện "Chưa có bài thi").

## Dùng hằng ngày
- Nút biểu tượng con mắt trên thẻ bài (app giáo viên → Thi): **Cho xem điểm / Ẩn điểm**. Thi thử mặc định cho xem; thi thật mặc định ẩn đến khi thầy cô bật.
- Thêm/sửa học sinh trong trang HocSinh hoặc sửa đề trong DeThi → bấm **Cập nhật lên Firebase** (trong app, hoặc menu Sheet).
- Tạo/sửa/mở/khóa/xóa bài trong app: tự cập nhật, không cần bấm thêm.
- Thống kê từng bài: hiện tức thì ai chưa vào / đã vào / đã nộp + điểm.
- Điểm vào trang KetQua khi mở menu Thi (tối đa 2 phút một lần) hoặc menu Sheet **Bài thi → Lấy điểm về Sheet** (chép ngay). Cột "Mã nộp" giúp không chép trùng; bài đã khóa và đã chép xong không tải lại; file Drive lưu dần 15 bài mỗi lần (cột "Lưu Drive").
- Cho thi lại (thi thật): trang Thống kê → nút "Cho thi lại" (có hộp thoại xác nhận). Thi thử: cột **Số lần thi** thay cho nút này.
- Thi thật: trang Thống kê có tab **Theo dõi nộp bài** (Chưa vào / Đang làm / Đã nộp, có cả trạng thái nộp bài thực hành).
- **Chỉnh sửa** bài: sửa được cả câu hỏi, phương án, đáp án đúng, điểm; thêm/xóa câu. Thi thật: câu hỏi dùng chung trang DeThi của khối đó.
- Thi thật có **Năm học**, **Hình thức thi** (15 phút, Giữa kỳ I, Cuối kỳ I, Giữa kỳ II, Cuối kỳ II, Khác), **Nội dung** (Trắc nghiệm / Trắc nghiệm + Thực hành).
- Lưu trữ Google Drive: thư mục **Bài thi - Góc học tập / Năm học / Lớp … / Hình thức - Tiêu đề**: mỗi học sinh một file chữ (từng câu, đáp án đúng, em chọn, đúng/sai, điểm) + file thực hành. File chữ được tạo khi điểm chép về Sheet (mở menu Thi hoặc menu Sheet **Lấy điểm về Sheet**).
  Lần đầu sau khi dán Code.gs mới, Google hỏi thêm quyền **Google Drive** → Cho phép.

## Tài liệu PDF (menu Tài liệu trong app giáo viên)
- **Thêm tài liệu**: nhập Tiêu đề, chọn Khối, mô tả (không bắt buộc), chọn file PDF ≤ 10 MB trên máy → Lưu. File vào Google Drive: **Tài liệu - Góc học tập / Khối N** (chia sẻ xem bằng đường dẫn).
- Mỗi tài liệu: **Mở xem**, **Chỉnh sửa** (tiêu đề, khối, mô tả, thay file), **Xóa** (có xác nhận, file vào thùng rác Drive).
- Học sinh: mục **Tài liệu** chỉ hiện tài liệu đúng khối của em (không còn ô chọn môn), nút **Mở xem** / **Tải về**.
- Giáo viên lớp thấy và đăng tài liệu cho khối của các lớp mình phụ trách.

## Gia sư AI và đọc bài
- Máy tính màn rộng: mở Gia sư AI (nút **AI**) → khung chat thành cột bên phải, bài học tự thu hẹp sát cạnh. Điện thoại: tấm trượt từ dưới lên. Câu trả lời hiện dần như đang gõ.
- Đang làm bài thi (cả thi thử) → Gia sư AI tạm nghỉ đến khi nộp bài, để điểm phản ánh đúng sức em; nộp thi thử xong AI tự nhận xét.
- Gia sư **tự tạm nghỉ** khi lớp em có bài **thi thật** đang mở (chưa nộp). Ô **"Khóa AI trong khi kiểm tra"** (Hồ sơ → Gia sư AI) khóa AI cho mọi học sinh mọi lúc — chỉ bật khi thật cần.
- Nộp bài **thi thử** (có Cho xem điểm): Gia sư AI tự nhận xét — nhận xét chung, em làm tốt, cần ôn thêm (không nêu đáp án). Cần Worker bản mới.
- Bài học có thanh **tên bài + % đã đọc** dính trên cùng khi cuộn. Giáo viên xem ở **Tổng quan → Học sinh đọc bài** (chọn bài, lớp; ai đã đọc hết / đang đọc / chưa đọc).

## Tài khoản (menu Tài khoản trong app giáo viên)
- Tab **Học sinh**: danh sách trang HocSinh của Google Sheet — thêm, sửa, đặt lại mã PIN, khóa/mở, xóa (có hộp thoại xác nhận). Lưu là học sinh đăng nhập được ngay; tài khoản khóa không đăng nhập được. Danh sách dài hiện 50 em mỗi lần (nút **Hiện thêm**), tìm theo tên/mã hoặc lọc theo lớp.
- Tab **Giáo viên** (chỉ quản trị thấy): thêm giáo viên dạy lớp — Mã giáo viên, Họ tên, Lớp phụ trách (ví dụ `9A, 9B`), Mã PIN. Lưu ở trang **GiaoVien** của Sheet.
- Giáo viên lớp đăng nhập trang giáo viên: chọn **Giáo viên lớp** → Mã giáo viên + PIN. Họ thấy menu **Thi** (tạo/mở/khóa/sửa thi thử, thi thật, thống kê), **Tài liệu** (khối mình) và **Tài khoản** (học sinh lớp mình). **Về nhà** cho giáo viên lớp sẽ bật sau khi Worker được cập nhật (giai đoạn 2).
- Quản trị đăng nhập như cũ (chọn **Quản trị**, nhập PIN giáo viên).

## Nếu có sự cố
- Học sinh báo "Mã học sinh hoặc mã PIN chưa đúng" dù đúng: thầy cô vừa đổi PIN trong Sheet nhưng chưa bấm **Cập nhật lên Firebase**.
- Học sinh mới chưa có trên Firebase vẫn đăng nhập được (đường cũ qua Worker, chậm hơn) nhưng tab Thi dùng bài thi Google Sheet cũ → bấm Cập nhật lên Firebase.
- App giáo viên báo "Chưa nối Firebase": làm lại bước 3.

## Tính năng mới 28/10/2026
### Bản đồ năng lực (học sinh)
- Mỗi câu hỏi có **Chủ đề** và **Mức độ** (Biết / Hiểu / Vận dụng): nhập trong trình sửa câu hỏi, file Excel đề thi thử (cột "Chủ đề"), hoặc cột J/K trang DeThi (cột K/L trang DeThiThu).
- Học sinh: **Tổng quan → Bản đồ năng lực**: mỗi chủ đề một ô màu (xanh ≥ 80%, vàng 50–79%, đỏ < 50%) gộp bài luyện tập + thi thử + thi thật; "Hôm nay em nên ôn…"; ô yếu có nút **Ôn bài** và **Hỏi Gia sư**.
- Gia sư AI biết em còn yếu chủ đề nào để củng cố đúng chỗ; nhận xét bài thi thử theo chủ đề. (Cần Worker mới.)
### AI soạn đề theo ma trận (giáo viên)
- Thi → Tạo đề thi → Thi thử → **AI soạn đề theo ma trận**: chọn bài học, chủ đề (tùy chọn), số câu Biết/Hiểu/Vận dụng (tối đa 20).
- Câu AI soạn hiện trong trình sửa với viền vàng "AI soạn — cần duyệt" và giải thích của AI. Thầy cô sửa, đánh dấu **Đã duyệt** từng câu mới lưu được. Khi sửa bài có nút **AI soạn thêm câu**.
- Mỗi giáo viên 40 lượt AI/ngày. (Cần Worker mới.)
### Chấm thực hành Excel / Python
- Tạo bài thi thật **Trắc nghiệm + Thực hành**: chọn Loại bài (Excel/Python/Khác), nhập **Đề bài thực hành** (học sinh thấy) và **Tiêu chí chấm** (mô tả, điểm, kiểm tra tự động: ô Excel có công thức chứa…, ô có giá trị…, Python chạy với dữ liệu vào → kết quả, mã có dùng…). Kết quả mong đợi chỉ nằm trong Sheet.
- Thống kê → Theo dõi nộp bài → **Chấm thực hành**: máy đọc file .xlsx / chạy chương trình Python (dừng nếu chạy quá lâu) và chấm các tiêu chí tự động; **AI gợi ý điểm** cho tiêu chí chấm tay; thầy cô sửa rồi **Lưu điểm thực hành** (trang ChamThucHanh của Sheet). Học sinh được xem điểm thực hành khi bật Cho xem điểm.
### Hiệu quả + thi thật công bằng
- Menu **Hiệu quả**: tiến bộ thi thử (điểm lần đầu → cao nhất), Bản đồ năng lực của lớp, đọc bài trung bình, học sinh cần hỗ trợ, **Tải báo cáo CSV** (mở bằng Excel).
- Thi thật: mỗi em một thứ tự câu và phương án; đếm số lần rời màn hình (giáo viên thấy ở Theo dõi nộp bài).
### Khác
- Điện thoại: thanh menu giáo viên luôn hiện. Giáo viên lớp có **Cài đặt**: Đổi mã PIN, Hỗ trợ học sinh qua Zalo, Đăng xuất.
- **Nút "Hỏi thầy cô" (Zalo)**: Cài đặt → Hỗ trợ học sinh qua Zalo → nhập số Zalo. Quản trị = số chung; giáo viên lớp = số riêng cho lớp mình.
- Học ngoại tuyến: có mạng thì app tự tải mọi bài của khối về máy; mất mạng vẫn mở và đọc bài được.

## Tiện ích: Trò chơi câu hỏi trên lớp (28/10/2026)
1. Trang giáo viên → **Tiện ích** → **Tạo bộ câu hỏi**: đặt tên, chọn lớp, thời gian mỗi câu. Thêm câu bằng cách tự nhập, **AI soạn câu hỏi theo bài** (câu AI soạn phải đánh dấu Đã duyệt), hoặc **Lấy câu từ đề thi thử** → Lưu.
2. Bấm **Trình chiếu** (nên mở trên máy chiếu). Màn hình hiện mã phòng; học sinh lớp đó mở app là thấy thẻ **"Vào chơi"**, không phải gõ mã.
3. Đủ học sinh thì bấm **Bắt đầu**. Mỗi câu có đồng hồ đếm ngược; học sinh chọn 1 trong 4 ô màu trên điện thoại. Hết giờ hoặc cả lớp đã trả lời thì máy chiếu hiện đáp án, số em chọn mỗi phương án và bảng xếp hạng. Đúng và nhanh thì được nhiều điểm hơn.
4. Kết thúc: bục vinh danh top 3, bảng từng câu (tỉ lệ đúng, phương án sai bị chọn nhiều nhất), danh sách em cần hỗ trợ. Bấm **AI phân tích lớp hiểu bài** (AI chỉ nhận số liệu, không nhận tên học sinh), **Tải kết quả CSV**.
5. Đáp án chỉ nằm trên máy giáo viên đến lúc công bố. Học sinh không điều khiển được phòng và không đổi được câu đã trả lời.

## Bộ não AI (VPS) — báo cáo tuần
Cài theo `docs/huong-dan-vps-bo-nao-ai.md`. Mỗi tối 21:00, báo cáo từng lớp hiện ở **Hiệu quả → Bộ não AI: báo cáo tuần**: xu hướng chủ đề, học sinh hay hỏi gì, học sinh cần chú ý, đề xuất tuần tới.
