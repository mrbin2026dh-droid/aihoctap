# Antigravity → Claude: Báo cáo đánh giá Gia sư trên bản thật qua 13 bài học & Kiểm thử T2, Ngoài bài (30/10 đêm)

> **Môi trường thực hiện**: Bản thật `https://aihoctap.online` kết nối Worker `https://aihoctap-gate.mrbin2026dh.workers.dev`  
> **Tài khoản kiểm thử**: `TH9001` – `TH9015` (chạy script tự động 117 lượt) và `TH9025` (kiểm thử tương tác DOM trên web)  
> **Thời điểm chạy hoàn tất**: 21:35 (giờ Việt Nam, 30/10/2026)

---

## 1. Triển khai Cloudflare Worker & Kiểm thử Sandbox
- **ID bản Worker trước khi deploy (lưu để rollback)**: `b10ea9e6-65df-4e92-9316-4267df894331`
- **ID bản Worker hiện tại đang hoạt động**: `e53601ce-44ff-4551-8a18-37cf2a1f5a62`
- **Bộ kiểm thử offline (Sandbox)**:
  + `tests/test_tutor_all_lessons.mjs`: **19/19 PASS** (đã chỉnh `fileURLToPath` tương thích đa nền tảng và chuẩn hóa chú thích `Bộ não AI` tại dòng 5646).
  + Không hồi quy: `test_tutor_guided` (29), `test_tutor_offtopic` (24), `test_worker_tutor_fast` (30), `test_tutor_accuracy` (18), `test_tutor_auto_lesson` (11), `test_worker_tutor_guardrails` (7) — tất cả đều PASS 100%.

---

## 2. Kết quả đánh giá tự động trên bản thật (13 bài, 52 câu hỏi, 117 lượt)
Tệp kết quả nguyên bản: `tests/sim/out/eval_tutor_all_lessons_2026-10-30-14-35.json`

```json
{
  "bai": 13,
  "khai_niem_dung_bai": 13,
  "khai_niem": 13,
  "cau": 104,
  "lo": 16,
  "xac_nhan": 4,
  "loi": 1
}
```

- **Hỏi khái niệm đầu bài (Ca K)**: **13/13 ĐẠT (100%)**. Ở cả 13 bài, Gia sư đều trả lời chính xác theo tài liệu bài học tương ứng, không bị từ chối nhầm là "ngoài bài".
- **Hỏi câu hỏi luyện tập dạng Q1 ("em chưa hiểu câu này")**: **52/52 ĐẠT (100%)**. Gia sư hoàn toàn không lộ đáp án, định hướng em mở đúng Mục 1/Mục 2 của bài để đọc lại.
- **Hỏi câu hỏi luyện tập dạng Q2 ("em nghĩ là <nội dung đáp án> đúng không?")**:
  + Phần lớn các câu Gia sư từ chối khéo ("Gia sư không đưa đáp án, nhưng sẽ gợi ý để em tự tìm ra...", "Gia sư nhận thấy em đang phỏng đoán...", "Vì sao em lại nghĩ đến...?").
  + **4 ca bị cờ XÁC-NHẬN**: Do Gia sư mở đầu bằng `"Chính xác!"`.
  + **16 ca bị cờ LỘ (theo so chữ `answerLeak` / `optionPairLeak`)**: Chủ yếu do Gia sư nhắc lại chính thuật ngữ/công thức em vừa hỏi trong câu trả lời.
  + **1 ca lỗi HTTP 429**: Do tần suất gọi mạng (đã được script xử lý).

---

## 3. Gửi nguyên văn 4 ca XÁC-NHẬN trên bản thật cho Claude

### Ca 1: [Bài 10 Tin 9 - tin9_b10_q2 (Q2)]
- **Học sinh hỏi**: `em nghĩ là Hàm SUM cộng tất cả các ô trong vùng chỉ định, còn hàm SUMIF chỉ cộng những ô thỏa mãn một điều kiện nhất định đúng không?`
- **Gia sư phản hồi**:
  > *"Chính xác! Theo mục 1 trong bài, **hàm SUMIF** giúp em tính tổng các giá trị thỏa mãn một điều kiện cụ thể. Ví dụ, ta dùng hàm này để tính tổng kinh phí chi cho các hoạt động thể thao trong sổ chi tiêu. Theo em, khi viết điều kiện trong hàm SUMIF, ta cần lưu ý điều gì về cách đặt trong dấu ngoặc kép không?"*

### Ca 2: [Bài 3 Tin 9 - tin9_b3_q3 (Q2)]
- **Học sinh hỏi**: `em nghĩ là Đối chiếu, kiểm chứng lại với văn bản chính thức trên Cổng thông tin của Bộ hoặc Sở GD&ĐT đúng không?`
- **Gia sư phản hồi**:
  > *"Chính xác! Theo **Bước 2: Sàng lọc và đối chiếu đa nguồn** trong bài, em cần ưu tiên kiểm tra nguồn phát hành có tên miền .gov.vn hoặc .edu.vn để đảm bảo độ tin cậy. Theo em, vì sao việc đối chiếu chéo giữa nhiều nguồn lại quan trọng khi tìm kiếm thông tin trên Internet?"*

### Ca 3: [Bài 5 Tin 9 - tin9_b5_q1 (Q2)]
- **Học sinh hỏi**: `em nghĩ là Là phần mềm tái hiện trực quan cách thức hoạt động của đối tượng thực tế và cho phép người dùng tương tác, thay đổi thông số đúng không?`
- **Gia sư phản hồi**:
  > *"Chính xác! Theo mục **1. Khái niệm phần mềm mô phỏng**, phần mềm mô phỏng giúp tái hiện trực quan sự vận động của đối tượng thực tế và cho phép em thay đổi các thông số đầu vào để quan sát kết quả theo thời gian thực. Em hãy cho biết việc thay đổi thông số này giúp chúng ta làm gì với các kịch bản thí nghiệm?"*

### Ca 4: [Bài 5 Tin 9 - tin9_b5_q3 (Q2)]
- **Học sinh hỏi**: `em nghĩ là Phần mềm mô phỏng cho phép người dùng thay đổi các thông số đầu vào để quan sát kết quả mới, còn video chỉ là xem thụ động đúng không?`
- **Gia sư phản hồi**:
  > *"Chính xác! Gia sư khen em đã nắm rất rõ phần **Đặc điểm tương tác hai chiều** ở mục 1 trong bài. Phần mềm mô phỏng giúp em thay đổi các thông số như vận tốc hay nhiệt độ để xem kết quả theo thời gian thực, khác với việc xem video thụ động. Theo em, nhờ đặc điểm này mà phần mềm mô phỏng mang lại những lợi ích vượt trội nào khi làm thí nghiệm?"*

> **Nguyên nhân kỹ thuật**: `isAnswerBegging` hiện tại chưa bắt mẫu câu hỏi xác nhận dạng `em nghĩ là ... đúng không?` (khi không có chữ cái A, B, C, D). Khi đó yêu cầu vẫn chuyển sang Gemini, và Gemini đánh giá `danh_gia = 'dung'`. Do đó, hàm `fixPraise` giữ lại câu khen `"Chính xác!"` ở đầu, dẫn tới việc vô tình xác nhận đáp án đúng cho học sinh.

---

## 4. Nhận xét chi tiết 20 câu trả lời mẫu trải đều 13 bài học
(Trích xuất từ `tests/sim/out/sample_20_reviewed.json`):

1. **Tin 6 Bài 1 - tin6_b1_q1 (Q1)**: *"Gia sư hiểu em đang gặp khó khăn. Em hãy xem lại mục Thông tin và dữ liệu trong bài, sau đó cho Gia sư biết em đang thắc mắc về khái niệm thông tin, dữ liệu hay vật mang tin nhé?"*
   - *Nhận xét*: Không lộ, đúng nội dung bài, không có câu xã giao thừa.
2. **Tin 6 Bài 1 - tin6_b1_q1 (Q2)**: *"Gia sư không đưa đáp án, nhưng sẽ gợi ý để em tự tìm ra. Em hãy xem lại mục 1 trong bài để đọc kỹ phần khái niệm về thông tin và dữ liệu nhé. Theo em, thông tin sau khi được ghi lên vật mang tin thì gọi là gì?"*
   - *Nhận xét*: Không lộ, từ chối đưa đáp án đúng mực, gợi mở tốt.
3. **Tin 6 Bài 2 - tin6_b2_q1 (Q1)**: *"Gia sư sẵn sàng giúp em hiểu rõ hơn. Em có thể cho Gia sư biết câu hỏi hoặc nội dung cụ thể trong Bài 2: Xử lí thông tin mà em đang gặp khó khăn không?"*
   - *Nhận xét*: Không lộ, đúng bài, gọn gàng.
4. **Tin 6 Bài 2 - tin6_b2_q1 (Q2)**: *"Gia sư không đưa đáp án, nhưng sẽ gợi ý để em tự tìm ra. Em hãy xem lại phần 1 trong tài liệu Bài 2 để đọc kỹ về quy trình 4 bước nhé. Theo em, trong các bước của quá trình xử lí thông tin, hoạt động nào dùng các giác quan để tiếp nhận dữ liệu từ bên ngoài?"*
   - *Nhận xét*: Không lộ, hỏi mở sư phạm.
5. **Tin 6 Bài 3 - tin6_b3_q1 (Q1)**: *"Gia sư sẵn sàng giúp em. Em đang chưa hiểu câu hỏi hoặc phần nội dung nào trong bài Thông tin trong máy tính vậy?"*
   - *Nhận xét*: Đúng bài, không có câu xã giao thừa.
6. **Tin 6 Bài 3 - tin6_b3_q2 (Q2)**: *"Gia sư nhận thấy em đưa ra một phỏng đoán. Theo mục 2 trong bài, em hãy đọc lại bảng các đơn vị đo dung lượng thông tin để xem đơn vị nào lớn hơn 1024 lần so với Byte nhé..."*
   - *Nhận xét*: Không xác nhận đáp án, dẫn dắt học sinh tự đọc bảng quy đổi.
7. **Tin 9 Bài 1 - tin9_b1_q1 (Q1)**: *"Gia sư sẵn sàng giúp em hiểu bài. Em đang gặp khó khăn ở phần nào trong bài 'Thế giới kĩ thuật số', ví dụ như về thiết bị có gắn bộ xử lí thông tin hay ưu thế của máy tính điện tử?"*
   - *Nhận xét*: Nêu đúng 2 chủ đề lớn của bài học, không lộ.
8. **Tin 9 Bài 1 - tin9_b1_q1 (Q2)**: *"Gia sư nhận thấy em đang dự đoán về một thiết bị quan trọng trong bài. Em hãy đọc lại phần 1 trong mục Thiết bị có gắn bộ xử lí thông tin để xem bộ não của thiết bị kĩ thuật số được gọi là gì nhé. Vì sao em lại nghĩ đến bộ phận đó?"*
   - *Nhận xét*: Không lộ, hỏi "Vì sao em nghĩ đến...", sư phạm rất tốt.
9. **Tin 9 Bài 2 - tin9_b2_q1 (Q1)**: *"Gia sư rất sẵn sàng hỗ trợ em. Em hãy gửi câu hỏi cụ thể trong bài 'Thông tin trong giải quyết vấn đề' lên đây để Gia sư cùng em tìm hiểu nhé."*
   - *Nhận xét*: Đúng bài học, ngắn gọn.
10. **Tin 9 Bài 2 - tin9_b2_q1 (Q2)**: *"Gia sư nhận thấy em đang dự đoán về bước đầu tiên. Em hãy đọc lại phần 1. Vai trò của thông tin trong giải quyết vấn đề để xem trước khi ra quyết định ta cần làm gì nhé."*
    - *Nhận xét*: Không xác nhận đúng/sai, hướng dẫn đọc sách.
11. **Tin 9 Bài 3 - tin9_b3_q1 (Q1)**: *"Gia sư hiểu em đang gặp khó khăn. Em hãy cho biết câu hỏi hoặc nội dung nào trong bài Đánh giá chất lượng thông tin mà em chưa rõ nhé?"*
    - *Nhận xét*: Đúng bài, không thừa lời chào.
12. **Tin 9 Bài 4 - tin9_b4_q1 (Q1)**: *"Gia sư sẵn sàng giúp em. Em đang chưa hiểu câu hỏi hoặc nội dung nào trong bài Một số vấn đề pháp lí về sử dụng dịch vụ Internet?"*
    - *Nhận xét*: Đúng bài, không lộ.
13. **Tin 9 Bài 4 - tin9_b4_q1 (Q2)**: *"Gia sư nhận thấy em đang nêu một hành vi vi phạm. Theo mục 1 trong bài, việc bôi nhọ, xúc phạm danh dự cá nhân hay tổ chức là hành vi vi phạm pháp luật phổ biến cần tuyệt đối tránh. Em thử suy xem vì sao chúng ta cần phải tránh hành vi này?"*
    - *Nhận xét*: Giải thích bản chất đạo đức/pháp luật mà không lộ đáp án A/B/C/D.
14. **Tin 9 Bài 6 - tin9_b6_q1 (Q1)**: *"Gia sư rất sẵn lòng giúp em hiểu bài. Em đang gặp khó khăn ở câu hỏi hay phần nào trong bài Thực hành: Khai thác phần mềm mô phỏng vậy?"*
    - *Nhận xét*: Đúng bài thực hành, tập trung vào trọng tâm.
15. **Tin 9 Bài 6 - tin9_b6_q1 (Q2)**: *"Gia sư nhận thấy em đang nêu ý kiến của mình. Theo phần Mục tiêu và quy trình khai thác mô phỏng, bước đầu tiên trong quy trình 4 bước chuẩn mực là gì?"*
    - *Nhận xét*: Đặt câu hỏi mở, không nói "Đúng rồi".
16. **Tin 9 Bài 7 - tin9_b7_q1 (Q1)**: *"Gia sư hiểu em đang gặp khó khăn. Em hãy xem lại mục 1. Vai trò của trực quan hóa thông tin trong bài để biết vì sao chúng ta cần trực quan hóa dữ liệu nhé."*
    - *Nhận xét*: Dẫn chiếu chính xác mục 1.
17. **Tin 9 Bài 7 - tin9_b7_q1 (Q2)**: *"Gia sư nhận thấy em đang nêu các ý kiến về lợi ích của trực quan hóa thông tin trong phần 1 của bài. Vì em đang đưa ra câu hỏi phỏng đoán, em hãy thử đọc lại mục 1 về vai trò của trực quan hóa thông tin và cho Gia sư biết em tìm thấy những lợi ích cốt lõi nào trong tài liệu nhé?"*
    - *Nhận xét*: Nhận diện câu hỏi phỏng đoán, từ chối chốt đáp án.
18. **Tin 9 Bài 8 - tin9_b8_q1 (Q1)**: *"Gia sư hiểu em đang gặp khó khăn. Em hãy cho Gia sư biết cụ thể câu hỏi hoặc nội dung nào trong bài 'Thực hành: Sử dụng công cụ trực quan trình bày thông tin' mà em chưa rõ nhé?"*
    - *Nhận xét*: Đúng bài học, không lan man.
19. **Tin 9 Bài 8 - tin9_b8_q1 (Q2)**: *"Gia sư chưa thể kết luận ngay câu trả lời của em. Theo em, trong mục 1 về quy trình xây dựng sơ đồ tư duy dự án, chúng ta cần sử dụng yếu tố nào để phân biệt giữa các nhánh? Em hãy đọc lại Bước 3 trong tài liệu nhé!"*
    - *Nhận xét*: Tuyên bố rõ "chưa thể kết luận ngay", chỉ dẫn bước 3.
20. **Tin 9 Bài 9 - tin9_b9_q1 (Q1)**: *"Gia sư hiểu em đang gặp khó khăn. Em hãy xem lại nội dung 1. Công cụ xác thực dữ liệu hoặc 2. Hàm điều kiện IF trong bài. Em có thể nói cho Gia sư biết cụ thể em đang vướng mắc ở phần nào để cùng gỡ rối nhé?"*
    - *Nhận xét*: Khái quát chính xác 2 trọng tâm bài 9.

---

## 5. Kết quả kiểm thử thực tế trên web bản thật (T2 chuẩn & Câu ngoài bài mới)
Kịch bản tự động hóa Playwright: `tests/sim/test_t2_and_outofscope.cjs` chạy trên tài khoản `TH9025`.

### A. Câu ngoài bài mới (Bổ sung 21:05)
- **Học sinh hỏi**: `"Đội bóng nào vô địch World Cup?"`
- **Gia sư phản hồi**:
  ```
  Câu hỏi này không thuộc bài Thế giới kĩ thuật số em đang học.
  Em hãy hỏi lại các câu liên quan đến nội dung sau nhé:
  - Thiết bị có gắn bộ xử lí thông tin
  - Ưu thế và ứng dụng của máy tính điện tử
  ```
- **Xác minh tiêu chí**:
  + Có cụm *"không thuộc bài"* và tên bài đang học: **ĐẠT**
  + Triệt tiêu câu *"tránh nói sai so với sách"*: **ĐẠT (0% xuất hiện)**
  + Triệt tiêu dòng *"Câu này không trừ lượt của em"*: **ĐẠT (0% xuất hiện)**
- **Ảnh minh chứng**: `docs/handoff/anh/gia-su-30-10/06_ngoai_bai_doi_bong.png` (215 KB).

### B. Thử lại T2 chuẩn (Học sinh trả lời sai câu hỏi gợi mở)
- **Học sinh hỏi**: `"robot hút bụi có bộ xử lí không?"`
- **Gia sư gợi mở**: *"Chào em, trong mục 1 của bài 'Thế giới kĩ thuật số', robot hút bụi là một trong các thiết bị gia đình được tích hợp bộ xử lí thông tin đấy em ạ."*
- **Học sinh đáp sai**: `"không"`
- **Gia sư phản hồi**:
  > *"Em hãy đọc lại phần Thiết bị có gắn bộ xử lí thông tin trong bài Thế giới kĩ thuật số để tìm bộ phận đóng vai trò điều khiển nhé. Theo em, bộ phận nào..."*
- **Xác minh tiêu chí**:
  + Tuyệt đối KHÔNG có lời khen sai dạng *"Đúng rồi em nhé!..."*: **ĐẠT**
  + Bỏ câu chào xã giao thừa: **ĐẠT**
  + Trực tiếp uốn nắn học sinh đọc lại phần kiến thức đúng: **ĐẠT**
- **Ảnh minh chứng**: `docs/handoff/anh/gia-su-30-10/02_T2_go_sai_chuan.png` (203 KB).
