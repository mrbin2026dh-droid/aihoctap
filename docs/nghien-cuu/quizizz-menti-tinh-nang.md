# Nghiên cứu Tính năng Kiểu Quizizz & Mentimeter cho Ứng dụng Giáo dục AI Học Tập

Tài liệu phục vụ định hướng phát triển tính năng tương tác lớp học sau ngày 30/10/2026. Tuân thủ 100% nguyên tắc bản quyền: Không trích xuất/sao chép mã nguồn thương mại, không sao chép hình ảnh/âm thanh có bản quyền, chỉ khảo sát tính năng công khai và các dự án mã nguồn mở có giấy phép minh bạch (MIT/Apache/AGPL).

---

## 1. Bảng so sánh tính năng tương tác lớp học

| STT | Tính năng | Mô tả hoạt động (Quizizz / Mentimeter) | AI Học Tập hiện có | Mức hữu ích THCS | Độ phức tạp (S/M/L) |
|---|---|---|---|---|---|
| 1 | **Trắc nghiệm nhanh đồng bộ (Live Quiz)** | Giáo viên điều khiển từng câu trên máy chiếu; học sinh chọn 4 ô màu/hình trên điện thoại; tính điểm tốc độ; hiện đáp án, biểu đồ và BXH ngay sau mỗi câu. *(Tham khảo: support.kahoot.com, help.quizizz.com)* | **ĐÃ CÓ (100%)** qua `quiz-core.js`, `teacher-quiz.js`, `quiz-play.js` (công thức tính điểm Kahoot 500–1000đ, phòng chờ 6 số, 4 hình ▲ ◆ ● ■, bục vinh danh). | Cực cao | S (Đã xong) |
| 2 | **Đám mây từ khóa thời gian thực (Live Word Cloud)** | Học sinh gửi 1–3 từ khóa trả lời một câu hỏi gợi mở. Các từ trùng nhau sẽ tự động phóng to, tạo hình đám mây sinh động trên máy chiếu. *(Tham khảo: mentimeter.com/features/word-cloud)* | **CHƯA CÓ** | Rất cao (Khởi động bài học, kiểm tra ấn tượng đầu tiên) | M |
| 3 | **Câu trả lời mở có kiểm duyệt (Open-ended with Moderation)** | Học sinh gõ đoạn văn ngắn (1–2 câu) nêu ý kiến/giải pháp. Giáo viên xem trước trên màn hình quản lý, bấm "Duyệt" mới hiển thị thẻ lên máy chiếu. | **CHƯA CÓ** | Cực cao (Bắt buộc cho học sinh THCS để ngăn ngừa lời lẽ trêu đùa/không phù hợp) | M |
| 4 | **AI phân tích & gom cụm ý kiến (Semantic Clustering)** | Thay vì giáo viên phải đọc từng ý kiến, AI tự động phân loại các câu trả lời học sinh thành 2–3 luồng suy nghĩ chính, phát hiện các hiểu lầm phổ biến. | **CHƯA CÓ** (Hiện mới có AI phân tích chung sau buổi trắc nghiệm) | Cao (Tận dụng thế mạnh Bộ não AI sẵn có) | M |
| 5 | **Học sinh tự làm theo tốc độ riêng (Student-Paced / Homework)** | Giáo viên giao bộ câu hỏi có hạn chót; học sinh vào làm bất kỳ lúc nào, tự chuyển câu theo nhịp độ riêng, có thể làm lại để cải thiện. | **MỘT PHẦN** (Đã có mục Thi thử / Luyện tập từng bài, nhưng chưa có tính năng "Bộ câu hỏi giao về nhà có hạn chót" tích hợp vào phân hệ Tiện ích). | Rất cao (Giao bài tập về nhà không áp lực) | M |
| 6 | **Đa dạng dạng câu hỏi (Đúng/Sai, Nhiều đáp án, Điền từ)** | Hỗ trợ thêm các định dạng trắc nghiệm ngoài dạng 1 đáp án đúng: Chọn tất cả đáp án đúng, câu hỏi Đúng/Sai nhanh, câu hỏi kéo thả ghép đôi. | **MỘT PHẦN** (Hiện tại `quiz-core.js` chuyên biệt 1 đáp án đúng trong 4 lựa chọn A, B, C, D; mục Thi đã có Tự luận). | Vừa | M |
| 7 | **Hỏi đáp trực tiếp (Live Q&A / Upvoting)** | Học sinh gửi câu hỏi thắc mắc trong giờ học; các bạn khác bấm biểu tượng "Cùng thắc mắc" để đẩy câu hỏi lên đầu danh sách máy chiếu. | **CHƯA CÓ** | Vừa (Phù hợp giờ ôn tập/thảo luận chuyên đề) | S |

---

## 2. Top 6 tính năng nên triển khai tiếp theo (Sau 30/10)

Thứ tự ưu tiên được xây dựng dựa trên bối cảnh thực tế phòng học THCS (mạng Wi-Fi di động chập chờn, máy chiếu của giáo viên, học sinh dùng điện thoại cấu hình phổ thông):

1. **Chế độ Thảo luận: Câu trả lời mở có kiểm duyệt (Open-ended Moderation)**  
   - *Lý do:* Giúp học sinh THCS tự tin bày tỏ quan điểm mà giáo viên hoàn toàn kiểm soát được nội dung hiển thị trên máy chiếu trước cả lớp (chống spam, chống từ ngữ thiếu chuẩn mực).
2. **AI Gom cụm ý kiến & Chỉ ra hiểu lầm (Semantic Clustering via VPS Agent)**  
   - *Lý do:* Điểm vượt trội hoàn toàn so với Mentimeter/Quizizz bản miễn phí. Giáo viên không mất thời gian tổng hợp 40 câu trả lời; Bộ não AI trên VPS lập tức phân tích: "70% lớp chọn giải pháp A, 30% lớp có sự nhầm lẫn giữa khái niệm X và Y".
3. **Đám mây từ khóa trực tiếp (Live Word Cloud)**  
   - *Lý do:* Hiệu ứng trực quan rất mạnh mẽ trong 5 phút khởi động tiết học, tạo không khí hứng khởi ngay khi bắt đầu bài mới.
4. **Giao bài luyện tập về nhà theo tốc độ riêng (Student-Paced Assignment)**  
   - *Lý do:* Mở rộng từ bộ câu hỏi giáo viên đã soạn ở lớp; học sinh về nhà luyện tập lại không bị giới hạn thời gian từng câu như trên lớp.
5. **Đa dạng dạng câu hỏi: Đúng/Sai và Nhiều lựa chọn đúng**  
   - *Lý do:* Phù hợp với cấu trúc đề kiểm tra đánh giá mới theo Chương trình GDPT 2018.
6. **Bình chọn & Thang điểm đánh giá nhanh (Quick Poll / Rating scale 1–5)**  
   - *Lý do:* Phục vụ hoạt động tự đánh giá và đánh giá đồng đẳng (Peer assessment) cuối tiết học.

---

## 3. Khảo sát các dự án mã nguồn mở trên GitHub

| Tên dự án | Liên kết kho mã | Giấy phép (License) | Công nghệ | Bài học / Khả năng áp dụng |
|---|---|---|---|---|
| **QuizLive** | `github.com/sivasooryagiri/quizlive` | **MIT License** | React, Firebase RTDB, Tailwind CSS | **Rất đáng học hỏi:** Cùng chung kiến trúc Serverless Firebase Realtime Database và phòng chờ mã PIN; cơ chế đồng bộ nhẹ nhàng, không cần duy trì WebSocket phức tạp trên máy chủ riêng. |
| **QuizDock** | `github.com/quizdock/quizdock` | **MIT License** | React, NestJS, TypeScript, Socket.io | **Học hỏi kiến trúc:** Tách biệt triệt để giữa màn hình Host (Máy chiếu) và Player (Điện thoại); giao diện tối giản cho thiết bị màn hình nhỏ. Không dùng mã nguồn do khác biệt công nghệ (họ dùng Node socket). |
| **Crowdflow** | `github.com/fadhilmch/crowdflow` | **MIT License** | Vue 3, Node.js, Express, Socket.IO | **Học hỏi thuật toán Word Cloud:** Cách đếm tần suất từ khóa client-side và dựng layout kích thước chữ bằng SVG/Canvas mà không làm đơ giao diện. |
| **WordWall** | `github.com/engineerjoe440/wordwall` | **MIT License** | React, Python | Thư viện tạo đám mây từ khóa nhẹ nhàng, độc lập, có thể tham khảo thuật toán xử lý tiếng Việt có dấu. |
| **ClassQuiz** | `github.com/mawoka-myblock/classquiz` | **AGPL-3.0** | Svelte, Python FastAPI | **CHỈ THAM KHẢO Ý TƯỞNG (CẤM CHÉP MÃ):** Tham khảo quy trình tổ chức ngân hàng câu hỏi và cơ chế xuất/nhập dữ liệu. Tuyệt đối không tích hợp mã nguồn vì ràng buộc lây lan của giấy phép AGPL. |

---

## 4. Đề xuất cấu trúc dữ liệu Firebase cho phân hệ Thảo luận (`discussion`)

Tuân thủ phương pháp thiết kế an toàn thời gian thực tương tự nhánh `quiz*`:

```json
{
  "discussion": {
    "$roomId": {
      "meta": {
        "title": "Khởi động: Theo em Internet mang lại lợi ích gì lớn nhất?",
        "type": "wordcloud | open | poll",
        "created_at": 1730198000000,
        "is_active": true
      },
      "responses": {
        "$respId": {
          "text": "Tìm kiếm tài liệu học tập",
          "at": 1730198015000,
          "approved": true
        }
      },
      "summary": {
        "cluster_1": "Học tập và tra cứu (24 em)",
        "cluster_2": "Giải trí và kết nối (12 em)",
        "ai_note": "Học sinh nắm rõ các tiện ích tích cực."
      }
    }
  }
}
```

### Quy tắc bảo mật RTDB sơ bộ:
- Học sinh chỉ được ghi (`.write`) câu trả lời của mình với trường `approved: false` (mặc định chưa duyệt) và độ dài giới hạn (`newData.child('text').val().length <= 150`).
- Chỉ giáo viên (sở hữu mã khóa phòng `disc_key/$roomId`) mới được ghi đè trường `approved: true` hoặc cập nhật bảng tổng hợp `summary`.
- Màn hình máy chiếu chỉ lắng nghe truy vấn các bản ghi đã được duyệt: `.indexOn: ["approved"]`.

---

## 5. Phương án nhân rộng cho toàn trường (~1.000 học sinh)

### 5.1. Phân quyền và Không gian dữ liệu
- **Cách ly tài khoản:** Mỗi giáo viên có không gian bộ câu hỏi riêng tại `quiz_bo/{hash_gv}`; chỉ giáo viên đó mới thấy và chỉnh sửa bộ câu hỏi của mình.
- **Ngân hàng chung:** Tạo nhánh `quiz_shared/` để giáo viên cùng tổ bộ môn có thể chia sẻ bộ câu hỏi dùng chung mà không sợ bị người khác sửa đè.

### 5.2. Định mức sử dụng và Chi phí ước tính (1.000 học sinh, ~30 lớp)
- **Firebase Realtime Database:**
  - 1 buổi luyện tập 40 học sinh, 10 câu trắc nghiệm tiêu tốn khoảng **1.2 MB băng thông**.
  - Toàn trường 1.000 học sinh cùng tham gia đồng thời trong tuần: Băng thông ước tính $\approx 150 - 200 \text{ MB/tuần}$, nằm hoàn toàn trong gói miễn phí của Firebase (Gói Spark cho phép 10 GB/tháng tải về và 100 kết nối đồng thời trên mỗi DB; khi vượt 100 kết nối có thể nâng gói Blaze với chi phí $\approx 0\$$ vì dưới ngưỡng tính tiền).
- **Bộ não AI trên VPS (Python FastAPI Agent):**
  - VPS hiện tại tiêu thụ **36.1 MB RAM**, CPU tải < 2% khi chấm bài.
  - Xử lý xác thực câu hỏi và gom cụm ý kiến qua hàng đợi (queue) với tốc độ trung bình 450ms/yêu cầu.
  - Chi phí vận hành máy chủ: Đã bao gồm trong chi phí thuê VPS hiện tại, không phát sinh thêm.
- **Google Gemini API:**
  - 1 bộ câu hỏi AI soạn tiêu tốn khoảng 800 input tokens + 400 output tokens.
  - Sử dụng mô hình `gemini-3.5-flash-lite`: Chi phí $\approx 0.0001\$$ / lần soạn. Với 1.000 học sinh, chi phí hàng tháng dưới **1 USD** (hoặc 0 đồng nếu dùng quota miễn phí 1.500 requests/ngày).

---

## 6. Kết luận & Khuyến nghị
- Nền tảng hiện tại của AI Học Tập đã sở hữu lõi tương tác thời gian thực chuẩn mực, ổn định và bảo mật cao.
- Việc bổ sung Chế độ Thảo luận (Đám mây từ khóa + Câu trả lời mở có kiểm duyệt AI) sau ngày 30/10 sẽ hoàn thiện bức tranh chuyển đổi số toàn diện cho trường học: từ tự học, ôn luyện, thi cử đến tương tác trực tiếp sinh động ngay tại lớp.
