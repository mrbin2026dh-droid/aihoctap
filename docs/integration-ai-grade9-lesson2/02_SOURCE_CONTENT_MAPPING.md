# 02. Đối chiếu ứng dụng Bài 2 với giáo án và phụ lục

Ký hiệu: **G** = đúng tài liệu gốc · **T** = thiếu so với gốc · **L** = lệch với gốc · **Đ** = đề xuất cải tiến (không phải nội dung gốc, giáo viên quyết định).

Đáp án PL9.2.9 là tài liệu "dành cho GV" (mức CAO theo AGENTS.md mục H). Repo công khai, nên tài liệu này chỉ dẫn số mục, không chép nguyên văn đáp án.

## Quy tắc chung rút ra từ giáo án (bắt buộc giữ)
- Phiếu học tập số 1 là minh chứng tối thiểu (cá nhân): phần A → 9.A3.1; phần B (trước **và** sau sửa) → 9.A3.2; phần D dòng 1–3 → 9.A3.3; phần C → 9.A3.4.
- Minh chứng bổ trợ: thẻ năng lực nhóm, dòng 4 phần D, dòng nhìn lại (9.A3.1); Phiếu học tập số 2, câu trả lời ở trạm (9.A3.4). **Không lấy kết quả nhóm làm kết quả cá nhân.**
- HĐ 1 không dùng để kết luận mức đạt; không có đúng sai.
- Ô tự chấm ●◐○ và bốn ô tự đánh giá là nhận định của học sinh, không phải mức của giáo viên.
- "Bạn góp ý" là minh chứng của **bạn viết góp ý**, không tính cho chủ phiếu.
- Phần nói được ghi nhận như phần viết; học sinh không có thiết bị không bị bất lợi.
- Dòng mức dùng AI không làm tăng hay giảm kết quả.
- Không quy đổi điểm số. Mức Đạt theo IV.1, mức Khá/Tốt theo PL9.2.9 mục 7. Giáo viên chỉ ghi tên học sinh **chưa thấy minh chứng**, kèm phần còn thiếu và cách hỗ trợ.
- Giáo án: học sinh **không dùng công cụ AI**. Ứng dụng là phương án số hóa phiếu giấy, nên **tắt Gia sư AI** trong phân hệ này.

## Bảng đối chiếu theo hoạt động

| HĐ / phụ lục | Ứng dụng Bài 2 đang có | Trạng thái | Việc cần làm khi tích hợp |
|---|---|---|---|
| HĐ 1 · PL9.2.1 tin tuyển dụng, 9 thẻ | Văn bản 9 thẻ đúng; chọn đúng 3; ô lý do | G | Giữ nguyên |
| HĐ 1 · dòng "Lúc đầu em chọn…" | Sửa được tới cuối bài | L | **Khóa** sau khi học sinh bấm "Chốt lựa chọn đầu giờ" (Worker từ chối ghi đè). Dòng nhìn lại ở HĐ 4 là trường riêng |
| HĐ 1 · đáp án cốt lõi (PL9.2.9 mục 1) | Không hiển thị | G | Chỉ giáo viên thấy; không đưa vào gói nội dung học sinh |
| HĐ 2.1 · PL9.2.4 sáu tình huống | Văn bản khớp (tình huống 1 cố ý sai, đúng gốc) | G | Giữ; ghi chú cho GV có thể đổi chi tiết theo SGK lớp đang dùng (PL9.2.4) |
| HĐ 2.1 · cột "Em" tự chấm ●◐○ | Không có | T | Thêm trường thang 3 mức cho từng tình huống, gắn nhãn "tự đánh giá, không phải mức GV" |
| HĐ 2.1 · "Em sẽ làm gì (một cụm từ)" | Ô văn bản dài | L nhẹ | Ô một dòng, tối đa ~120 ký tự |
| HĐ 2.1 · phần A tiếp: mạnh/yếu nhất | Một ô gộp "minh chứng + vì sao" | L | Tách hai cột như phiếu: "Minh chứng (việc em đã làm)" và "Vì sao quan trọng khi có AI?". Câu hỏi năng lực yếu dùng đúng chữ của phiếu |
| HĐ 2.1 · PL9.2.3 thẻ năng lực (nhóm) | Không có | T | Sản phẩm nhóm: "Cần hơn khi có AI vì…", "Ví dụ"; với Hợp tác/Giao tiếp thêm "Với người", "Với AI" |
| HĐ 2.2 · PL9.2.5 bảng mục tiêu mẫu | Chỉ có một câu ví dụ | T | Hiện bảng 5 mẫu (sau bước phân loại). Câu bẫy "Tôi sẽ cố gắng học tốt hơn" **không in cho HS** (chỉ GV đọc) |
| HĐ 2.2 · Mục tiêu 2 chọn hướng 1/2/3 | Không có | T | Trường chọn hướng |
| HĐ 2.2 · ba câu "Bạn kiểm tra" | Không có | T | Ba ô có/chưa cho mỗi mục tiêu, do bạn góp ý điền |
| HĐ 2.2 · "Bạn góp ý" | Ghi vào hồ sơ chủ phiếu | L | Lưu là minh chứng của người góp ý (`phieu_gopy`), hiển thị cho chủ phiếu để sửa |
| HĐ 2.2 · bản trước/sau sửa | Một ô "revision" tự do | L | Lưu **bản chụp bất biến** phần B trước góp ý; bản sửa là lần lưu sau; giáo viên xem so sánh hai bản |
| HĐ 2.2 · "Nếu không dùng AI…" | Có | G | Giữ |
| HĐ 2.2 · việc tùy chọn hỏi người lớn | Không có | T | Ô tùy chọn, ghi rõ "không chấm"; nhắc không ghi tên, nơi làm, thu nhập |
| HĐ 2.3 · PL9.2.6 thẻ nghề | 6 thẻ, văn bản khớp, có dòng lưu ý thẻ 6 | G | Thêm khả năng giáo viên **viết thẻ nghề địa phương** theo khuôn gốc (trước đây / nay / một lần máy sai) |
| HĐ 2.3 · PL9.2.7 phiếu số 2 | Bốn cột lưu trong hồ sơ từng HS | L | Thực thể **nhóm** riêng; cột 4 = hai kĩ năng, mỗi kĩ năng có ô "vì" |
| HĐ 2.3 · dòng "Phân công" | Ô văn bản tự do | L | Có cấu trúc: cột 1–4 + người phản biện, chọn trong thành viên nhóm, để ghi đóng góp từng bạn |
| HĐ 2.3 · câu hỏi của khách ở trạm | Ô "bổ sung sau trạm" | L nhẹ | Hai câu ① ② in đúng gốc; ô trả lời của người giữ trạm/giấy nhớ |
| HĐ 2.3 · phiếu quan sát nhóm, 3 chỉ báo (PL9.2.9 mục 4) | Không có | T | Màn hình giáo viên: chọn 2 nhóm quan sát, 3 chỉ báo, ghi đóng góp cá nhân |
| HĐ 3 · phần C | Có tên nghề, trước/nay, 2 kĩ năng | G | Tách "kĩ năng" và "vì" thành hai ô để kiểm có lý do; nhắc không chép bảng nhóm |
| HĐ 3 · nhãn tài liệu | `heading()` ghi PL9.2.6 | L | Đúng là PL9.2.2 phần C |
| HĐ 4 · PL9.2.8 ba ví dụ | Hiện cả ba ví dụ, gồm luôn phần của Tuấn | L | Trang 2 (phần của Tuấn) chỉ mở **sau** khi HS trả lời "chỗ cần hỏi lại" ở ví dụ 2, hoặc khi GV mở |
| HĐ 4 · phần D 4 dòng | Có | G | Giữ |
| HĐ 4 · nhìn lại lựa chọn đầu giờ | Chọn Giữ/Đổi + ô lý do | G | Hiển thị lại lựa chọn đã khóa ở HĐ 1 bên cạnh |
| HĐ 4 · 4 ô tự đánh giá | Có, chữ lệch phiếu (ví dụ "kỹ năng nghề") | L | Dùng nguyên câu PL9.2.2: "Em xác định được mục tiêu rõ ràng." … "Em tách được phần AI giúp và phần của riêng em." |
| HĐ 4 · mức dùng AI (5 lựa chọn) | Có | G | Giữ; không đưa vào kết luận |
| Chính tả | App dùng "kỹ" | L | Nội dung học liệu giữ "kĩ" như gốc; nhãn hệ thống theo quy ước dự án. **Giáo viên xác nhận** |
| Đánh giá GV | 5 mức có "Cần bổ sung" | L nhẹ | "Chưa thấy minh chứng / Đạt / Khá / Tốt" + "phần còn thiếu" + "cách hỗ trợ lần sau" (PLC.7); ô "ghi nhận trình bày miệng" cho từng phần |
| Minh chứng 9.A3.4 phía GV | Gộp trường nhóm vào điểm cá nhân | L | Tách: cá nhân (phần C) là chính; nhóm hiện riêng, ghi "bổ trợ" |
| Minh chứng 9.A3.1 phía GV | Thiếu năng lực đã chọn, dòng nhìn lại | T | Đủ: 6 năng lực + việc sẽ làm, phần A tiếp; bổ trợ: dòng 4 phần D, dòng nhìn lại |

## Đề xuất cải tiến (Đ, chờ giáo viên duyệt)
1. Gợi ý "thiếu chữ vì" khi học sinh lưu phần C và cột 4. Chỉ là nhắc nhở, không chặn.
2. Đếm số phần đã điền để học sinh biết còn thiếu gì. Không hiển thị như điểm.
3. Tới hạn mục tiêu (~8 tuần), học sinh mở lại phần B để tự xem (giáo án: "chụp lại phần B để tới hạn HS tự xem lại").
4. Gợi ý nhận xét theo mẫu ba ý (PL9.2.9 mục 7) cho giáo viên chọn rồi sửa, không gửi tự động.
