// @ts-check
// Câu hỏi có sẵn cho khung "Trợ giúp nhanh". Câu trả lời cố định (không gọi AI, không tốn chi phí, trả lời tức thì).
// Chỉ ghi điều ứng dụng THẬT SỰ làm được. Sửa nội dung ở đây, không cần sửa nơi khác.
export const GROUPS = [
  {id: 'app', label: 'Ứng dụng'},
  {id: 'hs', label: 'Học sinh'},
  {id: 'gv', label: 'Giáo viên'},
  {id: 'an', label: 'An toàn'}
];
/** @type {{g:string,q:string,a:string}[]} */
export const FAQ = [
  {g: 'app', q: 'Ứng dụng này là gì?', a: 'Góc học tập là ứng dụng tự học môn Tin học THCS (lớp 6 đến 9, sách Kết nối tri thức). Học sinh đọc bài, luyện tập, thi thử và hỏi Gia sư AI. Giáo viên soạn bài, giao đề và theo dõi lớp ngay trên điện thoại.'},
  {g: 'app', q: 'Ứng dụng giải quyết vấn đề gì?', a: 'Ba việc: học sinh được gợi ý để tự nghĩ chứ không chép đáp án; giáo viên bớt chấm tay vì trắc nghiệm và tự luận được chấm tự động; giáo viên thấy ngay chủ đề nào cả lớp còn yếu để dạy bù đúng chỗ.'},
  {g: 'app', q: 'AI được dùng ở những đâu?', a: '1) Gia sư AI hỏi gợi mở khi học sinh học bài.\n2) AI chấm bài tự luận theo gợi ý đáp án của giáo viên.\n3) AI soạn câu hỏi theo ma trận cho giáo viên (giáo viên phải duyệt mới dùng).\n4) Bộ não AI viết báo cáo tuần về từng lớp cho giáo viên.'},
  {g: 'app', q: 'Dùng được khi mất mạng không?', a: 'Được một phần. Ứng dụng cài lên màn hình chính như app thường. Bài đã tải mở được khi không có mạng, bài đang làm dở được giữ trên máy và tự gửi khi có mạng lại. Gia sư AI và chấm tự luận cần có mạng.'},
  {g: 'app', q: 'Cài ứng dụng như thế nào?', a: 'Không cần vào kho ứng dụng. Mở đường dẫn bằng Chrome hoặc Safari, bấm nút tải xuống ở thanh trên (Cài ứng dụng) rồi làm theo hướng dẫn. Khi có bản mới, ứng dụng tự cập nhật sau khi học sinh đăng nhập.'},
  {g: 'app', q: 'Chi phí vận hành ra sao?', a: 'Thấp. Ứng dụng chạy trên các dịch vụ đám mây có gói miễn phí hoặc gói nhỏ. Phần đáng kể duy nhất là AI, được giới hạn số lượt cho từng học sinh và từng lớp để không vượt hạn mức.'},

  {g: 'hs', q: 'Học sinh đăng nhập thế nào?', a: 'Bằng mã học sinh và mã PIN do giáo viên cấp, không cần email hay tài khoản Google. Quên PIN thì nhờ giáo viên đặt lại.'},
  {g: 'hs', q: 'Gia sư AI có làm hộ bài không?', a: 'Không. Gia sư AI dùng cách hỏi gợi mở: đặt câu hỏi, gợi hướng nghĩ, chỉ về đoạn trong bài, nhưng không đưa đáp án dù em xin nhiều lần. Mỗi em có số lượt hỏi giới hạn mỗi ngày.'},
  {g: 'hs', q: 'Thi thử hoạt động ra sao?', a: 'Giáo viên giao đề cho lớp. Đề có thể gồm trắc nghiệm, hoặc trắc nghiệm kèm tự luận. Phần tự luận học sinh gõ trên khung kẻ dòng chấm như giấy thi. Nộp bài xong, em thấy điểm và nhận xét từng câu. Thi thử làm lại được nhiều lần.'},
  {g: 'hs', q: 'AI chấm tự luận như thế nào?', a: 'AI chấm bám theo gợi ý đáp án và thang điểm do giáo viên nhập, cho điểm lẻ đến 0,25 và nhận xét: đúng ý nào, còn thiếu ý nào. Mất khoảng 10 đến 20 giây. Nếu AI bận, bài vẫn được nộp và em bấm chấm lại sau.'},
  {g: 'hs', q: 'Trò chơi câu hỏi trên lớp là gì?', a: 'Giáo viên mở phòng, học sinh vào chơi bằng điện thoại, trả lời từng câu theo thời gian thật. Có bảng xếp hạng và cuối trò chơi AI nhận xét lớp hiểu bài ở mức nào, hiểu lầm ở đâu.'},
  {g: 'hs', q: 'Bản đồ năng lực là gì?', a: 'Là màn hình cho em thấy từng chủ đề mình đang ở mức Vững, Đang học hay Cần ôn, tính từ việc đọc bài, làm bài tập và thi thử. Từ đó ứng dụng gợi ý em nên học tiếp bài nào.'},

  {g: 'gv', q: 'Giáo viên làm được những gì?', a: 'Đăng bài học và tài liệu; soạn đề từ file Excel hoặc nhờ AI soạn theo ma trận; giao thi thử và đề thi chính thức; xem kết quả, theo dõi lớp khi đang thi; tạo trò chơi câu hỏi; quản lý tài khoản học sinh; đặt hạn mức AI cho từng lớp.'},
  {g: 'gv', q: 'Câu hỏi do AI soạn có đáng tin không?', a: 'Câu AI soạn chỉ là bản nháp. Giáo viên phải xem từng câu và đánh dấu "Đã duyệt" thì mới lưu được vào đề, nên giáo viên luôn là người quyết định cuối cùng.'},
  {g: 'gv', q: 'Làm sao biết em nào cần hỗ trợ?', a: 'Trang giáo viên hiện bản đồ năng lực cả lớp và danh sách học sinh cần chú ý (điểm thấp, điểm giảm, hay xin đáp án, lâu không học). Mỗi tuần, Bộ não AI còn viết báo cáo tóm tắt cho từng lớp.'},

  {g: 'an', q: 'Dữ liệu học sinh có an toàn không?', a: 'Học sinh đăng nhập bằng mã và PIN, không thu email hay thông tin nhạy cảm. Khóa dịch vụ AI nằm trên máy chủ, không nằm trong điện thoại học sinh. Bài luyện tập được chấm ở máy chủ nên đáp án không gửi xuống máy em. Với đề thi thử, ứng dụng không hiển thị đáp án trước khi nộp; thi chính thức nên tổ chức có giám sát ở lớp. Giáo viên lớp chỉ thấy lớp của mình.'},
  {g: 'an', q: 'Khi báo cáo cho AI có lộ tên học sinh không?', a: 'Bộ não AI thay tên học sinh bằng ký hiệu (HS1, HS2…) trước khi gửi cho AI viết báo cáo, rồi ghép tên lại trên máy chủ riêng của giáo viên.'},
  {g: 'an', q: 'Ban giám khảo xem thử bằng cách nào?', a: 'Bấm "Nhắn Zalo cho giáo viên" ở cuối khung này để nhận tài khoản xem thử. Học sinh đăng nhập bằng mã và PIN; phần giáo viên vào trang "Góc dành cho Giáo viên" (biểu tượng màn hình ở thanh trên).'}
];
