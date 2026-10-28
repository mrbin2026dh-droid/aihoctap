# BÁO CÁO MINH CHỨNG
## Cuộc thi Giáo viên sáng tạo ứng dụng AI năm 2026

**Đề tài:** Ứng dụng Gia sư AI hỏi gợi mở và "Bộ não AI" phân tích hiểu lầm trong dạy học phân hóa môn Tin học THCS (Chương trình GDPT 2018)
**Giáo viên thực hiện:** ……………… · **Trường:** ………………
**Đối tượng thực nghiệm:** học sinh khối 9, lớp 9A10 và 9A9 (tổng ……… em có tài khoản)
**Thời gian:** Học kỳ I năm học 2026–2027. Bài thi thử thực nghiệm: ngày 29/10/2026.

> **Nguyên tắc của báo cáo:** mọi số liệu ở mục IV lấy trực tiếp từ hệ thống sau khi học sinh làm bài thật. Phần kiểm thử kỹ thuật (mục III) ghi rõ loại kiểm thử và dữ liệu dùng để kiểm thử (mô phỏng hay thật). Học sinh được ghi bằng mã ẩn danh (HS-01, HS-02…), không công bố họ tên (theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).

---

## I. Vấn đề và giải pháp

| Vấn đề trong lớp Tin học THCS | Giải pháp trong ứng dụng |
|---|---|
| Học sinh dùng AI để chép đáp án, không tự nghĩ. | **Gia sư AI hỏi gợi mở**: chỉ dựa trên nội dung bài học, không đưa đáp án; dẫn học sinh tự tìm câu trả lời. |
| Giáo viên mất nhiều thời gian chấm tự luận. | **AI chấm tự luận theo gợi ý đáp án của giáo viên**, cho điểm từng câu và nhận xét đúng ý nào, thiếu ý nào; giáo viên xem và chỉnh khi cần. |
| Giáo viên khó biết học sinh **hiểu sai điều gì**, chỉ biết điểm. | **Bộ não AI** (máy chủ riêng của giáo viên) phân tích từng lựa chọn sai: **hiểu lầm phổ biến** của lớp, **hiểu lầm riêng** của từng em (Gia sư dùng để hỏi gợi mở đúng chỗ), và **chất lượng câu hỏi** (câu nghi ghi sai đáp án, câu quá khó, câu phân biệt kém). |
| Học sinh nông thôn mạng chập chờn. | Ứng dụng cài như app (PWA), học bài đã tải khi mất mạng, bài làm dở được giữ trên máy. |

**Vòng khép kín:** Bộ não phát hiện em hiểu sai gì → Gia sư hỏi gợi mở đúng chỗ đó → giáo viên đọc báo cáo tuần, quyết định dạy lại → lần thi sau Bộ não đo lại xem em đã hết hiểu sai chưa.

---

## II. Kiến trúc và an toàn dữ liệu (đã triển khai)

- **Ứng dụng học sinh và trang giáo viên:** trang web cài được như app (GitHub Pages).
- **Máy chủ trung gian (Cloudflare Worker):** giữ khóa AI (không nằm trong điện thoại học sinh), kiểm soát số lượt AI mỗi em mỗi ngày.
- **Cơ sở dữ liệu thời gian thực (Firebase):** tài khoản, đề thi, bài nộp.
- **Bộ não AI (VPS riêng, Python + SQLite):** chạy mỗi tối, lưu lịch sử học tập dài hạn, gửi báo cáo tuần cho giáo viên.
- **An toàn:**
  - Khi gửi dữ liệu cho AI viết báo cáo, tên học sinh được thay bằng ký hiệu (HS1, HS2…), ghép lại trên máy chủ của giáo viên.
  - Gia sư chỉ nhận "lựa chọn em đã chọn sai", **không nhận đáp án đúng**, nên không thể lỡ lộ đáp án.
  - Câu bị nghi ghi sai đáp án bị loại khỏi phần nhắc hiểu lầm, để không nói em "chọn sai" khi em có thể đúng.
  - Bài luyện tập được chấm ở máy chủ. *Lưu ý trung thực:* đề thi thử chạy nhanh trên Firebase nên dữ liệu đề có đáp án (ứng dụng không hiển thị); thi chính thức nên tổ chức có giám sát tại lớp.

---

## III. Minh chứng kỹ thuật (kiểm thử tự động, dữ liệu mô phỏng)

Các bộ kiểm thử dưới đây chạy tự động trên mã nguồn, dùng **dữ liệu mô phỏng** và **AI giả lập** (kiểm tra logic, quyền, an toàn), **không phải kết quả học tập của học sinh**.

| Thành phần | Nội dung kiểm thử | Kết quả |
|---|---|---|
| Bộ não AI: hiểu lầm, chất lượng câu hỏi | Đề mô phỏng 20 em: phát hiện đúng câu ghi sai đáp án; không báo nhầm câu khó; độ phân biệt tính tay khớp máy; loại câu nghi sai đáp án khỏi phần nhắc Gia sư; không gửi tên học sinh | 18/18 ca đạt |
| Worker: Bộ não → Gia sư | Chỉ máy chủ có khóa mới gửi được; em này không thấy hiểu lầm của em khác; dữ liệu giả từ máy học sinh bị bỏ qua; em đã hết nhầm thì xóa | 16/16 ca đạt |
| Chấm tự luận | Điểm không vượt tối đa, câu bỏ trống = 0 (không tốn lượt AI), giới hạn lượt/ngày, lời nhắc chặn câu lệnh lừa AI trong bài làm | 17/17 ca đạt |
| Thi thử Trắc nghiệm + Tự luận (giao diện) | Giáo viên soạn đề/gợi ý, học sinh gõ trên dòng chấm, AI lỗi vẫn nộp được, chấm lại | 68/68 ca đạt |
| Trò chơi câu hỏi trên lớp | Mở phòng, khóa phòng, xếp hạng, AI nhận xét lớp | 30/30 ca đạt |
| Trang giáo viên: Thi | Tạo đề, theo dõi thi, giáo viên lớp chỉ thấy lớp mình | 136/136 ca đạt |

**Phát hiện nhờ Bộ não khi chạy trên dữ liệu mô phỏng ngày 28/10:** chẩn đoán cho thấy 620/660 bản ghi mô phỏng mang mã câu không khớp đề, làm sai lệch tỉ lệ đúng. Lỗi phân tích đã được sửa (chỉ tính câu trả lời khớp đề). Toàn bộ dữ liệu mô phỏng đã được **xóa khỏi hệ thống thật** trước khi thực nghiệm.

---

## IV. Thực nghiệm sư phạm (số liệu THẬT, điền sau bài thi ngày 29/10)

### 1. Cách lấy số liệu
- Học sinh làm **bài thi thử thật** trên ứng dụng (đề khối 9: …… câu trắc nghiệm + …… câu tự luận).
- Tối 29/10, Bộ não chạy (hoặc giáo viên nhờ chạy ngay), báo cáo hiện ở **Trang giáo viên → Hiệu quả → Bộ não AI: báo cáo tuần** và trang **NaoAI** trong Google Sheet.
- Chép số liệu dưới đây **đúng như hệ thống hiển thị**; ảnh chụp màn hình đính kèm phụ lục.

### 2. Tổng quan bài thi
| Chỉ số | 9A10 | 9A9 |
|---|---|---|
| Số em làm bài / sĩ số | …… / …… | …… / …… |
| Điểm trung bình lần làm đầu | …… | …… |
| Điểm trung bình cao nhất (nếu làm lại) | …… | …… |
| Số em đọc hết bài lý thuyết liên quan | …… | …… |

### 3. Hiểu lầm phổ biến (Bộ não phát hiện)
| Câu | Tỉ lệ sai | Em hay chọn nhầm | Giáo viên xử lý |
|---|---|---|---|
| …… | ……% | …… | (ví dụ: dạy lại 10 phút đầu tiết, mở trò chơi câu hỏi) |

### 4. Chất lượng câu hỏi (Bộ não phát hiện)
| Câu | Nhận định của máy | Giáo viên kiểm tra lại | Kết luận |
|---|---|---|---|
| …… | (nghi sai đáp án / quá khó / phân biệt thấp) | …… | (sửa đáp án / giữ nguyên / thay câu) |

### 5. Độ tin cậy của AI chấm tự luận
Giáo viên tự chấm lại **…… bài** (chọn ngẫu nhiên) rồi so với điểm AI:
| Chỉ số | Kết quả |
|---|---|
| Chênh lệch trung bình (giáo viên − AI) | …… điểm |
| Số bài lệch quá 0,5 điểm | …… / …… |
| Nhận xét | …… |

### 6. Gia sư AI
| Chỉ số | Kết quả |
|---|---|
| Số câu học sinh hỏi Gia sư (trong tuần) | …… |
| Số lần học sinh cố xin đáp án, Gia sư từ chối | …… |
| Trích đoạn hội thoại thật (đã ẩn danh) | xem Phụ lục |

### 7. So sánh tiến bộ (khi có lần thi thứ hai)
Nếu kịp tổ chức lần thi thứ hai cùng chủ đề: ghi điểm trung bình lần 1 → lần 2 và tỉ lệ em hết hiểu lầm đã được Gia sư nhắc. Nếu chưa kịp, ghi rõ "sẽ đo ở lần thi tiếp theo" (không ước lượng).

---

## V. Hạn chế và hướng phát triển
- Thời gian thực nghiệm ngắn (1 bài thi thử); cần thêm các lần thi để đo tiến bộ.
- AI chấm tự luận có sai số; điểm AI là tham khảo, giáo viên có quyền chỉnh.
- Phân tích chất lượng câu hỏi cần ít nhất 10 em làm cùng đề.
- Hướng phát triển: học sinh ôn và trả lời qua **Zalo Bot** (kết quả về Bộ não); **gói ôn đúng chỗ hổng** do AI soạn, giáo viên duyệt; **ôn tập cách quãng**; chuyển chấm thi thử về máy chủ để giấu hẳn đáp án.

---

## VI. Hướng dẫn Ban giám khảo xem thử
- Dùng **tài khoản trình diễn riêng** (một lớp "DEMO" với học sinh giả, không phải học sinh thật). Mã đăng nhập và mã PIN được gửi riêng cho Ban tổ chức, **không ghi trong tài liệu công khai**.
- Gợi ý trải nghiệm:
  1. Học sinh: mở bài học → hỏi Gia sư AI, thử xin đáp án → Gia sư hỏi gợi mở, không đưa đáp án.
  2. Học sinh: làm đề thi thử Trắc nghiệm + Tự luận → xem điểm và nhận xét AI.
  3. Giáo viên: Hiệu quả → Bộ não AI: báo cáo tuần (Hiểu lầm phổ biến, Chất lượng câu hỏi).
  4. Bấm nút **?** góc phải dưới: trợ giúp nhanh giới thiệu ứng dụng.

---

## Phụ lục (đính kèm khi nộp)
- Ảnh chụp báo cáo tuần của Bộ não (đã che tên học sinh nếu có).
- 2–3 trích đoạn hội thoại **thật** với Gia sư AI, học sinh ghi là HS-01, HS-02.
- Ảnh chụp 2–3 bài tự luận AI chấm kèm điểm giáo viên chấm lại.
