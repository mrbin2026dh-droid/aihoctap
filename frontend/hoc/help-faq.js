// @ts-check
// Câu hỏi có sẵn cho khung "Trợ giúp nhanh". Câu trả lời cố định (không gọi AI, không tốn chi phí, trả lời tức thì).
// Chỉ ghi điều ứng dụng THẬT SỰ làm được; nhóm "Phát triển" ghi rõ là dự kiến. Cập nhật 30/10/2026 theo các tính năng đã chạy.
export const GROUPS = [
  {id: 'app', label: 'Ứng dụng'},
  {id: 'hs', label: 'Học sinh'},
  {id: 'gv', label: 'Giáo viên'},
  {id: 'an', label: 'An toàn'},
  {id: 'pt', label: 'Phát triển'}
];
/** @type {{g:string,q:string,a:string}[]} */
export const FAQ = [
  {g: 'app', q: 'Ứng dụng này là gì?', a: 'AI Học Tập là gia sư AI và lớp học số cho học sinh THCS, hiện triển khai môn Tin học lớp 6 đến 9 (sách Kết nối tri thức). Học sinh đọc bài, luyện tập, hỏi Gia sư AI, thảo luận và thi trên điện thoại hoặc máy tính phòng máy. Giáo viên soạn bài, giao đề, tổ chức hoạt động trên lớp và theo dõi từng em.'},
  {g: 'app', q: 'Ứng dụng giải quyết vấn đề gì?', a: '1) Học sinh hỏi AI thường được đưa sẵn đáp án, nên không tự nghĩ. Gia sư AI ở đây chỉ gợi mở theo đúng bài đang học.\n2) Giáo viên mất nhiều thời gian chấm, tổng hợp. Trắc nghiệm được chấm tự động, AI gợi ý điểm tự luận để giáo viên duyệt.\n3) Giáo viên khó biết em nào chưa nắm bài. Trang Tổng quan cho thấy theo từng lớp: ai chưa làm, câu nào cả lớp sai nhiều, chủ đề nào cần dạy lại.'},
  {g: 'app', q: 'AI được dùng ở những đâu?', a: '1) Gia sư AI: hỏi gợi mở, chỉ trả lời trong phạm vi bài học, không đưa đáp án.\n2) Gợi ý điểm bài tự luận theo đáp án mẫu của giáo viên (giáo viên duyệt).\n3) Soạn câu hỏi theo ma trận và theo bài (giáo viên phải duyệt mới dùng).\n4) Nhận xét lớp sau buổi Luyện tập và tổng hợp ý kiến Thảo luận (không gửi tên học sinh).\n5) Bộ não AI viết báo cáo tuần về lớp cho giáo viên.'},
  {g: 'app', q: 'Dùng được khi mất mạng không?', a: 'Được một phần. Ứng dụng cài lên màn hình chính như app thường. Bài đã tải mở được khi không có mạng; bài đang làm dở được giữ trên máy. Gia sư AI, Luyện tập trực tiếp, Thảo luận và nộp bài thi cần có mạng.'},
  {g: 'app', q: 'Cài ứng dụng như thế nào?', a: 'Không cần vào kho ứng dụng. Mở đường dẫn bằng Chrome hoặc Safari, bấm nút tải xuống ở thanh trên (Cài ứng dụng) rồi làm theo hướng dẫn. Khi có bản mới, ứng dụng hỏi em trước khi tải lại, bài đang làm dở không mất.'},
  {g: 'app', q: 'Chi phí vận hành ra sao?', a: 'Thấp. Ứng dụng chạy trên dịch vụ đám mây có gói miễn phí hoặc gói nhỏ (trang web tĩnh, máy chủ nhỏ, cơ sở dữ liệu thời gian thực). Phần đáng kể là AI, được giới hạn số lượt cho từng học sinh và từng lớp. Câu xin đáp án hoặc câu ngoài bài được trả lời ngay, không gọi AI, không trừ lượt.'},

  {g: 'hs', q: 'Học sinh đăng nhập thế nào?', a: 'Bằng mã học sinh và mã PIN do giáo viên cấp, không cần email hay tài khoản Google. Quên PIN thì nhờ giáo viên đặt lại.'},
  {g: 'hs', q: 'Gia sư AI có làm hộ bài không?', a: 'Không. Gia sư AI hỏi gợi mở: giải thích khái niệm theo bài, đặt câu hỏi để em tự nghĩ, chỉ phần cần đọc lại, nhưng không đưa đáp án dù em xin nhiều lần hay giả làm giáo viên. Câu ngoài bài học thì Gia sư từ chối lịch sự và gợi ý nội dung trong bài để hỏi.'},
  {g: 'hs', q: 'Luyện tập trực tiếp và Bảng thi đua là gì?', a: 'Thầy cô mở phòng Luyện tập trên lớp, em vào bằng điện thoại, trả lời từng câu theo giờ, có bảng xếp hạng và bục vinh danh. Kết quả vào Bảng thi đua của lớp theo tháng: điểm buổi = số câu đúng ÷ số câu × 10 (bấm nhanh hay chậm không ảnh hưởng), điểm tháng là trung bình các buổi điểm cao nhất. Em thấy hạng của mình và top 10 của lớp.'},
  {g: 'hs', q: 'Thảo luận trên lớp là gì?', a: 'Thầy cô mở phòng Thảo luận: em gửi từ khóa (hiện thành đám mây từ), ý kiến, bình chọn, chấm điểm 1 đến 5 hoặc đặt câu hỏi và bấm "Cùng thắc mắc". Ý kiến hiện ẩn danh trên màn chiếu, thầy cô duyệt trước khi hiện. Thảo luận không tính điểm.'},
  {g: 'hs', q: 'Thi thử và thi thật khác nhau thế nào?', a: 'Thi thử: làm lại được nhiều lần, nộp xong thấy điểm và nhận xét. Thi thật: thầy cô mở thi cho lớp tại phòng máy, mỗi em có thứ tự câu và thứ tự đáp án riêng, không đếm giờ. Đề có phần thực hành thì em nộp file (Word, Excel, PowerPoint, PDF) rồi mới nộp được bài. Nộp xong em chỉ thấy "Đã nộp bài thành công" và giờ nộp; điểm do thầy cô chấm.'},
  {g: 'hs', q: 'Bản đồ năng lực là gì?', a: 'Là màn hình cho em thấy từng chủ đề mình đang ở mức Vững, Đang học hay Cần ôn, tính từ việc đọc bài và làm bài tập. Từ đó ứng dụng gợi ý em nên ôn bài nào.'},

  {g: 'gv', q: 'Giáo viên làm được những gì?', a: 'Đăng bài học và tài liệu; soạn đề từ Excel hoặc nhờ AI soạn rồi duyệt; giao thi thử và tổ chức thi thật theo ca; mở Luyện tập trực tiếp và Thảo luận trên lớp; xem Bảng thi đua theo tháng và tải Excel; xem Tổng quan theo lớp, tiến độ đọc bài, thời gian học, ai đang trực tuyến; quản lý tài khoản học sinh; đặt hạn mức AI.'},
  {g: 'gv', q: 'Thi thật được tổ chức ra sao?', a: 'Giáo viên chọn lớp rồi bấm Mở thi. Màn "Theo dõi ca thi" cập nhật tức thì: em nào đã vào, làm được bao nhiêu câu, đã nộp thực hành chưa, nộp lúc mấy giờ. Em nộp xong có thông báo kèm nút mở bài trên Google Drive. Giáo viên ghi chú em vắng kèm lý do, cho em thi lại khi máy hỏng (lấy điểm lần thi lại). File minh chứng lưu trên Drive ghi giờ nộp đến từng giây.'},
  {g: 'gv', q: 'Câu hỏi do AI soạn có đáng tin không?', a: 'Câu AI soạn chỉ là bản nháp. Giáo viên phải xem từng câu và đánh dấu "Đã duyệt" thì mới lưu được vào đề. Điểm tự luận AI gợi ý cũng chờ giáo viên duyệt. Giáo viên luôn là người quyết định cuối cùng.'},
  {g: 'gv', q: 'Làm sao biết em nào cần hỗ trợ?', a: 'Trang Tổng quan chọn từng lớp: em đã làm hay chưa làm, mức nắm bài, câu cả lớp sai nhiều (kèm phương án sai hay chọn), chủ đề cần củng cố, danh sách em cần hỗ trợ. Trang Hiệu quả và báo cáo tuần của Bộ não AI giúp theo dõi tiến bộ.'},

  {g: 'an', q: 'Dữ liệu học sinh có an toàn không?', a: 'Học sinh đăng nhập bằng mã và PIN, không thu email hay thông tin nhạy cảm. Khóa dịch vụ AI nằm trên máy chủ, không nằm trong máy học sinh. Bài luyện tập được chấm ở máy chủ. Đề thi thật gửi xuống máy em không kèm đáp án, Google Sheet của giáo viên chấm. Giáo viên lớp chỉ thấy lớp của mình.'},
  {g: 'an', q: 'Khi gửi dữ liệu cho AI có lộ tên học sinh không?', a: 'Không. Câu hỏi gửi Gia sư AI, bài tự luận gửi AI chấm, ý kiến thảo luận gửi AI tổng hợp đều không kèm tên hay mã học sinh. Bộ não AI thay tên bằng ký hiệu (HS1, HS2…) trước khi gửi, rồi ghép tên lại trên máy chủ riêng của giáo viên.'},
  {g: 'an', q: 'AI có trả lời bịa không?', a: 'Gia sư AI chỉ được dùng tài liệu bài học. Câu không có trong tài liệu thì hệ thống tự gửi lời từ chối cố định và gợi ý nội dung trong bài, không để AI tự giảng kiến thức ngoài sách. Giáo viên duyệt mọi câu hỏi AI soạn trước khi dùng.'},
  {g: 'an', q: 'Ban giám khảo xem thử bằng cách nào?', a: 'Bấm "Nhắn Zalo cho thầy cô" ở cuối khung này để nhận tài khoản xem thử. Lớp 9TH là lớp minh họa dùng tài khoản thử để kiểm thử hệ thống; số liệu ở các lớp thật là thí điểm từ 29/10/2026. Phần giáo viên vào trang "Góc dành cho Giáo viên".'},

  {g: 'pt', q: 'Ứng dụng sẽ phát triển thế nào?', a: 'Dự kiến: 1) Mở rộng sang môn khác bằng cách nạp bài học và câu hỏi mới, không phải viết lại ứng dụng. 2) Trang quản lý nhiều bộ Luyện tập, Thảo luận (tìm, lọc theo lớp, ghim bộ hay dùng, xem lại kết quả các buổi). 3) Hoàn thiện báo cáo tiến bộ theo học kỳ để làm minh chứng đánh giá thường xuyên.'},
  {g: 'pt', q: 'Có nhân rộng cho trường khác được không?', a: 'Được. Mỗi trường chỉ cần một Google Sheet danh sách học sinh và đề, dùng chung ứng dụng web, không cần cài phần mềm hay mua máy chủ. Học sinh dùng điện thoại hoặc máy tính phòng máy sẵn có. Giáo viên mỗi lớp chỉ quản lý lớp của mình.'},
  {g: 'pt', q: 'Có kế hoạch cho phụ huynh không?', a: 'Đang lên kế hoạch, chưa triển khai: phụ huynh xem tiến độ học và kết quả của con, có sự đồng ý của phụ huynh và nhà trường, tuân thủ quy định bảo vệ dữ liệu cá nhân của trẻ em.'}
];
