# Kế hoạch: THI THẬT tại phòng máy (bản 2 – đã chốt với thầy 30/10/2026 00:28)

Người lập: Claude. Trạng thái: **KẾ HOẠCH v2 – chờ thầy xác nhận 3 điểm ở mục 9**, chưa code.
Mức bảo mật: **CAO** (AGENTS.md mục H: đề, đáp án, chấm điểm, đăng nhập).

## 0. Thầy đã chốt
| # | Quyết định | Hệ quả thiết kế |
|---|---|---|
| Q1 | Không chặn đăng nhập toàn trường | Chỉ học sinh **đang được mở thi** bị đưa vào màn thi (tắt học bài, Gia sư AI); các em khác dùng app bình thường |
| Q2 | **Không đếm giờ**, học sinh nộp muộn được, giáo viên chờ | Không có đồng hồ, không tự nộp khi hết giờ. Ca thi kết thúc khi giáo viên chủ động đóng |
| Q3 | Máy hỏng → giáo viên cho thi lại ở ca sau hoặc thi lại ngay | Trạng thái **Thi lại** do giáo viên bật cho từng em; bài làm dở được giữ |
| Q4 | **Học sinh không xem điểm** | Không hiện điểm ở bất kỳ đâu: màn nộp, danh sách bài, Tổng quan học sinh, Bản đồ năng lực, Gia sư nhận xét |
| Q5 | Màn giáo viên cập nhật tức thì em nào đã vào thi; ghi chú em vắng + lý do, lưu lại | Màn **Theo dõi ca thi**; ghi chú vắng lưu Sheet + Firebase |
| Q6 | Học sinh nộp → giáo viên thấy thông báo nộp thành công, bấm vào em đó mở bài trên Google Drive | Thông báo nổi + dòng có nút "Mở bài trên Drive" (thư mục của em) và dấu kiểm đủ file |
| Q7 | 4 trạng thái học sinh: **Chưa mở thi** (mặc định), **Chưa thi**, **Đã thi**, **Thi lại** | Máy trạng thái ở mục 2, chỉ máy chủ được đổi |

## 1. Hiện tại đang có gì (đã kiểm mã)
Trong kho có ba đường thi:
- **① Đang dùng:** Google Sheet + Firebase công khai (`teacher-thi.js`, `thi-app.js`, `apps-script/sheet-exam/Code.gs`). Đã làm được: soạn và nhập đề Excel, Mở/Khóa bài, theo dõi tức thì, đảo câu và phương án, bắt buộc làm hết câu, nộp file thực hành lên Drive, AI chấm tự luận, sổ chấm thực hành có AI gợi ý, file chữ minh chứng trên Drive.
- **② Worker** (`exam.js`, `/api/pwa/exams*`): chấm ở máy chủ, đăng nhập JWT, theo lớp.
- **③ Firebase Auth "Cổng 2–3"** (`exam-fb.js`, `apps-script/exam`): đã thử 26/10, chưa nối với menu giáo viên.

**Đường ① không dùng được cho thi thật:** đề kèm đáp án đọc công khai; điểm do máy học sinh tự tính và tự ghi (sửa được, nộp thay bạn được); bài làm cả trường đọc công khai; không kiểm đã nộp thực hành. → Giữ ① cho **Luyện tập và thi thử**; thi thật dùng nền ② (máy chủ giữ đáp án và chấm).

## 2. Máy trạng thái của MỘT học sinh trong MỘT kỳ thi
| Trạng thái | Nghĩa | Học sinh thấy | Làm bài được? |
|---|---|---|---|
| **Chưa mở thi** (mặc định) | Chưa tới lượt | Thẻ bài "Chưa mở thi", không có nút | Không |
| **Chưa thi** | Giáo viên đã mở, em chưa nộp | Nút **Vào thi** | Có |
| **Đã thi** | Em đã nộp, máy chủ nhận đủ | "Em đã nộp bài" (không có điểm) | Không |
| **Thi lại** | Giáo viên cho thi lại (máy hỏng, vắng, nộp lỗi) | Nút **Vào thi lại** | Có |

Chuyển trạng thái (**chỉ máy chủ ghi**, học sinh không tự đổi được):
| Từ → Đến | Ai/lúc nào | Ghi chú |
|---|---|---|
| Chưa mở thi → Chưa thi | Giáo viên bấm **Mở thi cho lớp** (cả lớp) hoặc **Mở cho em này** (từng em) | Lớp khác giữ nguyên "Chưa mở thi" |
| Chưa thi → Đã thi | Em nộp thành công (đủ phần, Drive đã có file) | Giáo viên nhận thông báo |
| Chưa thi → Chưa mở thi | Giáo viên bấm **Đóng thi lớp này** (hết lượt lớp) | Em vắng hoặc chưa vào: về "Chưa mở thi", **ghi chú vắng được giữ**; bài làm dở (nếu có) được giữ trên máy chủ |
| Đã thi → Thi lại | Giáo viên bấm **Cho thi lại** (bắt buộc ghi lý do) | Lần nộp trước vẫn lưu trên Drive |
| Thi lại → Đã thi | Em nộp lần thi lại | Lần mới là lần chính thức (xem mục 9.1) |
| Thi lại → Chưa mở thi | Giáo viên đóng lớp khi em chưa nộp lần thi lại | Thi lại ở ca sau: mở lại cho em đó |

Bất biến: (a) đã ở "Đã thi" thì **không vào được** cho đến khi giáo viên bật "Thi lại"; (b) học sinh chỉ nhận đề khi trạng thái là "Chưa thi" hoặc "Thi lại"; (c) mọi lần đổi trạng thái ghi nhật ký: ai, lúc nào, lý do.

## 3. Luồng giáo viên
1. **Soạn đề** trên máy (Excel) hoặc Google Sheet như hiện tại. Đề có: tiêu đề, năm học, hình thức (15 phút, giữa kỳ…), khối, nội dung (**TN + TL** hoặc **TN + TH**), câu hỏi, đáp án, điểm; đề thực hành và tiêu chí chấm.
2. **Đưa đề lên** trước buổi thi: kiểm đề (đủ đáp án, điểm, tiêu chí thực hành; báo dòng lỗi). Đề chuyển sang máy chủ, đáp án lưu chỗ học sinh không đọc được. Mọi học sinh của khối ở "Chưa mở thi".
3. **Tới lượt một lớp:** mở màn **Theo dõi ca thi** → chọn **Lớp** → bấm **Mở thi cho lớp** (hộp thoại xác nhận: "Mở thi cho lớp 9A9, 34 em"). Màn hiện **mã ca 6 số** để đọc cho lớp (xem 9.2).
4. **Theo dõi tức thì** (mỗi em một dòng, xếp theo trạng thái):
   - Trực tuyến / Đã vào thi lúc … / Đang làm (TN 12/20, TH đã nộp ✓ hoặc chưa) / **Đã nộp lúc …** / Vắng (ghi chú).
   - Ô đếm đầu màn: Sĩ số 34 · Đã vào 31 · Đang làm 20 · Đã nộp 11 · Chưa vào 3.
   - Em nộp: **thông báo nổi** "Nguyễn Văn A (9A9) đã nộp bài" + dòng đổi màu; nút **Mở bài trên Drive** (thư mục của em) và hai dấu kiểm "Trắc nghiệm.txt ✓ · Thực hành ✓" (máy chủ đã kiểm file có trên Drive).
   - Em chưa vào: nút **Ghi chú vắng** → hộp thoại chọn lý do (Ốm, Có phép, Không phép, Khác + ô ghi) → lưu.
   - Từng em: **Cho thi lại** (bắt buộc lý do), **Mở cho em này**.
5. **Đóng thi lớp này** khi giáo viên thấy đủ (không đếm giờ). Hộp thoại xác nhận nêu: "Còn 2 em đang làm, 3 em chưa vào. Đóng thì các em này về Chưa mở thi, bài làm dở được giữ." Em đang làm mà mất mạng hoặc máy hỏng vẫn còn bài làm dở.
6. **Chấm bài** (màn riêng, theo lớp): TN máy chủ chấm sẵn; TL và TH có **AI gợi ý điểm + lý do** (gửi AI không kèm tên/mã); giáo viên sửa điểm, bấm **Duyệt**; mở bài trên Drive một chạm; xuất bảng điểm Excel. Điểm chính thức là điểm giáo viên duyệt.

## 4. Luồng học sinh
1. Đăng nhập như thường. Nếu em đang ở "Chưa thi"/"Thi lại" của một kỳ thi: app mở thẳng tab Thi, thẻ bài có nút **Vào thi**; Gia sư AI và học bài tạm tắt.
2. Bấm Vào thi → nhập **mã ca** (nếu bật) → máy chủ ghi "đã vào thi" (giáo viên thấy ngay) → nhận đề (không có đáp án). Không có đồng hồ.
3. **Đề TN + TL:** một trang, như hiện tại.
4. **Đề TN + TH:** hai thẻ:
   - **Phần 1 · Thực hành:** đề thực hành; chọn file .docx/.xlsx/.pptx/.pdf (≤ 10 MB) → **Tải lên** → máy chủ trả "Đã nhận: bai-lam.xlsx, 245 KB, 09:12" (nộp lại được để thay file).
   - **Phần 2 · Trắc nghiệm.**
   - Thanh trên cùng: "TN 18/20 · Thực hành: đã nộp ✓ / chưa nộp".
5. Bài làm dở **lưu lên máy chủ 1,5 giây/lần** và lưu trên máy; mất mạng vẫn làm tiếp, có mạng tự gửi; sang máy khác (khi được thi lại) thì bài làm dở hiện lại.
6. Bấm **Nộp bài** → kiểm theo thứ tự:
   - Thiếu câu TN/TL → hộp thoại "Còn câu 3, 7 chưa làm" + đưa tới câu đầu tiên còn thiếu.
   - Đề TN+TH mà máy chủ **chưa xác nhận file thực hành** → "Em chưa nộp bài thực hành" + nút "Tới Phần 1".
   - Đủ cả hai → "Nộp bài? Nộp rồi không làm lại được." → Nộp.
7. Máy chủ: chấm TN, ghi `Trắc nghiệm.txt` vào thư mục Drive của em, **kiểm lại** cả hai file có trên Drive → trạng thái **Đã thi** → học sinh thấy "Em đã nộp bài thành công" (**không có điểm**); giáo viên nhận thông báo. Drive lỗi → học sinh thấy "Chưa lưu được bài thực hành, em bấm Nộp lại", trạng thái giữ "Chưa thi", giáo viên thấy cờ đỏ.

## 5. Lưu trữ
**Google Drive (minh chứng):** `Bài thi - Góc học tập / <Năm học> / <Hình thức> - <Tiêu đề> / Lớp <lớp> / <Mã> - <Họ tên> /`
- `Trắc nghiệm.txt`: đề từng câu, các phương án, đáp án đúng, em chọn, đúng/sai, điểm TN, giờ vào, giờ nộp, số lần rời màn hình. Có cả bài tự luận nếu đề TN+TL.
- File thực hành gốc (giữ tên em đặt, thêm tiền tố mã).
- Thi lại: thêm `Lần 2 - …`, không xóa lần trước.

**Google Sheet (theo dõi lâu dài):** trang `CaThi` (mỗi lần mở/đóng lớp), `DiemDanhThi` (mã, tên, lớp, kỳ thi, trạng thái, giờ vào, giờ nộp, **vắng + lý do**, người ghi), `KetQua` (điểm TN, gợi ý AI, điểm giáo viên duyệt, đường dẫn Drive).

**Máy chủ (chỉ máy chủ ghi; học sinh chỉ đọc trạng thái của chính mình):**
```
ky_thi/{id}             {tieu_de, nam_hoc, hinh_thuc, khoi, noi_dung, de_id, tieu_chi_th[], tao_luc}
thi_tt/{id}/{ma}        {tt: chua_mo|chua_thi|da_thi|thi_lai, lop, vao_luc, nop_luc, lan, ma_ca?}
thi_vang/{id}/{ma}      {ly_do, ghi, gv, at}
thi_nhat_ky/{id}/{n}    {ma|lop, tu, den, gv, ly_do, at}
bai_lam/{id}/{ma}/{lan} {tn, tl, th:{file_id,ten,size,at}, drive:{folder_id, txt_ok, th_ok}, diem_tn, goi_y, diem_gv, duyet}
```
Đáp án nằm ở kho riêng của máy chủ (như `packages_private`/`exam_defs`), không bao giờ gửi về máy học sinh.

## 6. Tình huống biên (đã tính)
| Tình huống | Xử lý |
|---|---|
| Em ở nhà (lớp đang được mở) vào thi thay | Mã ca 6 số chỉ đọc tại phòng (9.2); giáo viên thấy em "đã vào" mà không có mặt thì đánh dấu và cho thi lại |
| Hai máy cùng đăng nhập một em | Máy chủ chỉ nhận một phiên làm bài; máy thứ hai thấy "Tài khoản đang thi trên máy khác" |
| Mất mạng giữa bài | Làm tiếp trên máy, có mạng tự gửi; giáo viên thấy "mất kết nối lúc …" |
| Nộp file thực hành sai định dạng hoặc quá 10 MB | Báo ngay, không nhận |
| Giáo viên đóng lớp khi em đang làm | Hộp thoại cảnh báo; bài dở giữ; em về "Chưa mở thi" |
| Đổi đề sau khi đã có em nộp | Chặn sửa đáp án; chỉ cho tạo đề mới |
| Học sinh xem điểm qua chỗ khác | Không trả điểm trong mọi API của học sinh; tắt "Gia sư nhận xét bài thi" và cập nhật Bản đồ năng lực cho thi thật |

## 7. Các bước làm (mỗi bước Claude kiểm rồi mới sang bước sau)
| Bước | Việc | Xong khi (test FAIL trước) |
|---|---|---|
| 0 | Chặn rủi ro đường ①: không đẩy đề thi thật lên `thi_de` công khai; `thi_de` thi thử bỏ đáp án nếu chấm được ở máy chủ | Đọc `thi_de` của đề thi thật → không có |
| 1 | Máy chủ: kỳ thi, trạng thái 4 mức + nhật ký, mở/đóng theo lớp, từng em, thi lại, ghi chú vắng | Test: học sinh tự đổi trạng thái → 403; lớp khác → 403; "Đã thi" vào lại → 403; thi lại → vào được |
| 2 | Đưa đề từ Sheet/Excel lên máy chủ, kiểm đề | Đề thiếu đáp án bị từ chối, báo đúng dòng |
| 3 | Học sinh: màn thi 2 phần, lưu nháp lên máy chủ, nộp TH (Apps Script trả `file_id` cho máy chủ), kiểm thiếu khi nộp | Test DOM: thiếu TN chặn, thiếu TH chặn, đủ mới nộp; không có điểm trên màn |
| 4 | Nộp: chấm TN, ghi Drive, kiểm đủ file → Đã thi; Drive lỗi → Nộp lại | Test: Drive lỗi giả lập → giữ "Chưa thi", báo nộp lại |
| 5 | Giáo viên: màn Theo dõi ca thi (tức thì, thông báo nộp, mở Drive, ghi chú vắng, cho thi lại, đóng lớp) | Test: 2 em nộp → 2 thông báo, nút Drive đúng thư mục; vắng có lý do lưu Sheet |
| 6 | Màn chấm: AI gợi ý TL/TH, giáo viên duyệt, xuất Excel | Điểm chính thức = điểm giáo viên duyệt |
| 7 | Thi thử toàn trình lớp 9TH (30 tài khoản thử) trên phòng máy | Báo cáo có ảnh, 0 lỗi nghiêm trọng |
Ước lượng: bước 0 nửa ngày; 1–4 ba ngày; 5–6 hai ngày; 7 một buổi.

## 8. Thay đổi so với bản 1
Bỏ đồng hồ, bỏ tự nộp khi hết giờ, bỏ cộng giờ; thêm trạng thái 4 mức theo từng em, ghi chú vắng, thông báo nộp + mở Drive, mở cho từng em, không cho xem điểm.

## 9. Cần thầy xác nhận (3 điểm)
1. **Điểm khi thi lại:** lần thi lại là điểm chính thức (lần trước vẫn lưu Drive làm minh chứng) – Claude đề xuất cách này. Hay lấy điểm cao hơn?
2. **Mã ca 6 số:** giữ (chặn em vắng ở nhà vào thi khi lớp đang mở) – đề xuất giữ. Hay bỏ cho nhanh, chỉ dựa vào việc giáo viên quan sát?
3. **Đóng lớp khi còn em đang làm:** các em này về "Chưa mở thi" và thi tiếp ở ca sau (bài dở còn nguyên) – đúng ý thầy không?
