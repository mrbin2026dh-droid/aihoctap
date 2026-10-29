# Kế hoạch: THI THẬT tại phòng máy (bản 3 – đơn giản hóa theo thầy, 30/10/2026 00:39)

Người lập: Claude. Trạng thái: **KẾ HOẠCH v3 – đủ quyết định, chờ thầy nói "đồng ý" là code.**
Nguyên tắc thầy chốt: **đơn giản, giáo viên giám sát tại phòng máy** (biết mặt từng em, điểm danh), không làm bảo mật rườm rà; chỉ giữ những chặn rẻ mà cần thiết.

## 0. Quyết định đã chốt
| # | Quyết định |
|---|---|
| 1 | Không chặn đăng nhập toàn trường. Chỉ em đang được mở thi mới vào màn thi (tạm tắt học bài, Gia sư AI) |
| 2 | **Không đếm giờ.** Hết tiết mà em chưa xong vẫn cho làm xong. Máy hỏng hoặc ốm thì về, hôm sau thi lại |
| 3 | Thi lại do giáo viên bật cho từng em; **lấy điểm lần thi lại** (lần trước vẫn lưu Drive) |
| 4 | **Học sinh không xem điểm** ở bất kỳ đâu |
| 5 | **Không có mã ca thi.** Giáo viên điểm danh, ghi chú em vắng + lý do (lưu lại) |
| 6 | Màn giáo viên cập nhật tức thì em nào đã vào thi; em nộp → thông báo + bấm mở bài trên Google Drive |
| 7 | 4 trạng thái mỗi em: **Chưa mở thi** (mặc định) → **Chưa thi** → **Đã thi** → (giáo viên cho) **Thi lại** |
| 8 | Có thể xem **máy nào vào thi từ ngoài mạng nhà trường** (chỉ để kiểm tra khi nghi ngờ) |

## 1. Cách làm: dùng lại hệ thống thi đang chạy, sửa ít nhất
Giữ nguyên đường thi hiện tại (Google Sheet + Firebase, menu Thi của giáo viên, tab Thi của học sinh), vì đã có: soạn/nhập đề Excel, đảo câu, bắt buộc làm hết câu, nộp file thực hành lên Drive, theo dõi tức thì, sổ chấm thực hành + AI gợi ý, file chữ minh chứng trên Drive.

Chỉ thêm 3 chặn **rẻ nhưng bắt buộc**, vì học sinh không xem điểm nên chẳng mất gì:
1. **Đề thi thật không kèm đáp án** khi gửi xuống máy học sinh (`thi_de` chỉ có câu hỏi + phương án). Đáp án nằm trong Sheet.
2. **Máy học sinh không tự chấm.** Học sinh chỉ nộp lựa chọn; Google Sheet chấm khi kéo bài về (Sheet đã có đáp án và đã có sẵn hàm chấm trong `saveTxt_`).
3. Firebase chỉ nhận bài nộp khi em đang ở trạng thái **Chưa thi** hoặc **Thi lại**; đề TN + TH thì phải **đã có file thực hành** (do Google Sheet xác nhận, `thi_th/{bài}/{mã}`) mới nhận.

## 2. Máy trạng thái (mỗi em, mỗi bài thi thật)
| Trạng thái | Học sinh thấy | Làm bài? |
|---|---|---|
| **Chưa mở thi** (mặc định) | "Chưa mở thi" | Không |
| **Chưa thi** | Nút **Vào thi** | Có |
| **Đã thi** | "Em đã nộp bài" (không điểm) | Không |
| **Thi lại** | Nút **Vào thi lại** | Có |

| Chuyển | Ai làm |
|---|---|
| Chưa mở thi → Chưa thi | Giáo viên: **Mở thi cho lớp** (cả lớp) hoặc **Mở cho em này** |
| Chưa thi / Thi lại → Đã thi | Học sinh nộp thành công (đủ câu, đủ file thực hành) |
| Đã thi → Thi lại | Giáo viên: **Cho thi lại** (chọn lý do: Máy hỏng, Ốm, Khác) |
| Chưa thi / Thi lại → Chưa mở thi | Giáo viên: **Đóng thi lớp này** (chỉ khi các em đã xong; em ốm/máy hỏng về thì để thi hôm sau) |

Lưu: `thi_tt/{bài}/{mã} = {tt, lop, lan, at}`. Giáo viên đổi qua Google Sheet (Sheet có khóa Firebase); học sinh chỉ được đổi đúng một bước "→ Đã thi" cùng lúc nộp bài (luật Firebase kiểm). Mỗi lần đổi ghi một dòng trang `NhatKyThi` (ai, lúc nào, lý do).

## 3. Màn giáo viên: **Theo dõi ca thi**
- Chọn bài thi → chọn **Lớp** → **Mở thi cho lớp** (xác nhận: "Mở thi cho lớp 9A9, 34 em").
- Đầu màn: Sĩ số · Đã vào · Đang làm · Đã nộp · Chưa vào · Vắng.
- Mỗi em một dòng, cập nhật tức thì: trực tuyến; **đã vào thi lúc …**; đang làm (TN 12/20 · Thực hành đã nộp ✓/chưa); **đã nộp lúc …**; nhãn "Ngoài mạng trường" nếu có (mục 6).
- Em nộp: **thông báo nổi** "Nguyễn Văn A đã nộp bài"; dòng có nút **Mở bài trên Drive** (thư mục của em) và dấu kiểm "Trắc nghiệm ✓ · Thực hành ✓" khi Google Sheet đã lưu xong file (thường dưới 1 phút).
- Em chưa vào: **Ghi chú vắng** (Ốm, Có phép, Không phép, Khác + ghi thêm) → lưu trang `DiemDanhThi`.
- Từng em: **Cho thi lại**, **Mở cho em này**.
- **Đóng thi lớp này**: hộp thoại nêu số em chưa nộp; mặc định giáo viên chờ các em làm xong.

## 4. Màn học sinh
1. Đăng nhập. Nếu đang ở **Chưa thi/Thi lại**: mở thẳng tab Thi, thẻ bài có nút Vào thi.
2. Không đồng hồ. Bài làm tự lưu trên máy liên tục (và lên Firebase khi nộp).
3. **Đề TN + TL:** một trang như hiện tại.
4. **Đề TN + TH:** hai phần **Phần 1 · Thực hành** (đề, chọn file .docx/.xlsx/.pptx/.pdf ≤ 10 MB, Tải lên → "Đã nhận: bai-lam.xlsx, 245 KB, 09:12", nộp lại được) và **Phần 2 · Trắc nghiệm**. Thanh trên: "TN 18/20 · Thực hành: đã nộp ✓".
5. **Nộp bài:** thiếu câu → báo câu nào; chưa có file thực hành được xác nhận → "Em chưa nộp bài thực hành" + nút tới Phần 1; đủ → xác nhận → nộp.
6. Nộp xong: "Em đã nộp bài thành công." **Không hiện điểm** (cả ở Tổng quan, Bản đồ năng lực, Gia sư nhận xét).

## 5. Lưu trữ
- **Google Drive** (minh chứng): `Bài thi - Góc học tập / <Năm học> / <Hình thức> - <Tiêu đề> / Lớp <lớp> / <Mã> - <Họ tên> /` gồm `Trắc nghiệm.txt` (đề, phương án, đáp án đúng, em chọn, đúng/sai, điểm, giờ vào, giờ nộp) và file thực hành. Thi lại: thêm `Lần 2 - …`.
- **Google Sheet:** `KetQua` (điểm TN do Sheet chấm, gợi ý AI tự luận/thực hành, điểm giáo viên duyệt, đường dẫn Drive, lần thi), `DiemDanhThi` (vắng + lý do), `NhatKyThi`.
- **Lưu Drive nhanh:** Google Sheet chạy mỗi 1 phút (trigger) kéo bài nộp mới, chấm, ghi Drive, rồi báo `thi_drive/{bài}/{mã} = {thu_muc, txt, th}` để màn giáo viên hiện dấu kiểm và nút mở Drive.

## 6. Xem máy ngoài mạng nhà trường (tùy chọn, khi nghi ngờ)
- Trình duyệt không tự biết IP, nên khi em **vào thi** và **nộp bài**, app gửi một tín hiệu nhỏ tới Worker. Worker đọc IP mạng và so với **IP mạng trường**: giáo viên bấm "Lấy IP mạng trường" một lần trên máy ở phòng máy.
- Chỉ lưu "trong trường / ngoài trường" và 2 số đầu của IP (`thi_ip/{bài}/{mã}`), không lưu đầy đủ. Màn giáo viên hiện nhãn "Ngoài mạng trường" để kiểm tra khi cần, **không tự chặn**.

## 7. Chấm bài
- TN: Google Sheet tự chấm khi kéo bài về.
- TL: AI gợi ý điểm + lý do (như hiện tại, chạy ở máy chủ, không gửi tên/mã), giáo viên sửa và duyệt.
- TH: sổ chấm thực hành hiện có, AI gợi ý theo tiêu chí, giáo viên duyệt.
- Điểm chính thức = điểm giáo viên duyệt của **lần thi mới nhất**.

## 8. Các bước làm
| Bước | Việc | Xong khi (test FAIL trước) |
|---|---|---|
| 1 | Sheet: không đẩy đáp án đề thi thật; chấm khi kéo bài; trigger 1 phút; `thi_drive` | `thi_de` của đề thật không có `answer`; bài nộp không có `diem` vẫn ra điểm đúng ở KetQua |
| 2 | Trạng thái 4 mức: `thi_tt`, luật Firebase, Sheet mở/đóng lớp, mở từng em, thi lại, nhật ký | Em "Chưa mở thi"/"Đã thi" nộp → Firebase từ chối; thi lại → nộp được |
| 3 | Học sinh: màn 2 phần, nhận .docx/.xlsx/.pptx/.pdf, kiểm thiếu TN/TH, không hiện điểm | Test DOM: thiếu TN chặn; thiếu TH chặn; đủ mới nộp; không có số điểm trên màn |
| 4 | Giáo viên: màn Theo dõi ca thi (tức thì, thông báo nộp, mở Drive, ghi chú vắng, thi lại, đóng lớp) | Test: 2 em nộp → 2 thông báo, nút Drive đúng thư mục; vắng có lý do lưu Sheet |
| 5 | IP mạng trường (tùy chọn) | Test: IP khác → nhãn "Ngoài mạng trường" |
| 6 | Thi thử toàn trình lớp 9TH trên phòng máy | Báo cáo có ảnh, 0 lỗi nghiêm trọng |
Ước lượng: khoảng 2–3 ngày làm + 1 buổi thi thử.

## 9. Rủi ro còn lại (thầy đã chấp nhận vì có giám sát)
- Ai biết mã học sinh vẫn có thể nộp thay qua kỹ thuật (luật Firebase không xác thực từng em); giáo viên phát hiện qua điểm danh, giờ nộp và nhãn ngoài mạng trường.
- Rủi ro `thi_hs` công khai có băm PIN (báo 29/10) vẫn còn; xử lý ở đợt bảo mật riêng.
