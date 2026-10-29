# Kế hoạch: THI THẬT tại phòng máy (Trắc nghiệm + Tự luận / Trắc nghiệm + Thực hành)

Người lập: Claude, 30/10/2026 00:30. Trạng thái: **KẾ HOẠCH – chờ thầy chốt 5 câu hỏi ở mục 6**, chưa code.
Phạm vi: dùng thật trong trường sau cuộc thi. Mức bảo mật: **CAO** (AGENTS.md mục H: đề, đáp án, chấm điểm, đăng nhập).

## 1. Hiện tại đang có gì (đã kiểm mã)
Trong kho có **ba đường thi**, giao diện đang dùng đường thứ nhất:

| Đường | Tệp | Đang dùng? | Ghi chú |
|---|---|---|---|
| ① Thi nhanh qua Google Sheet + Firebase công khai | `teacher-thi.js`, `thi-app.js`, `apps-script/sheet-exam/Code.gs`, nhánh `thi_*` | **Có** (menu Thi giáo viên, tab Thi học sinh) | Nhanh, đủ tính năng, nhưng **không an toàn cho thi thật** (mục 3) |
| ② Thi qua Worker | `exam.js`, `/api/pwa/exams*`, `exam_defs` | Có mã, ít dùng | Chấm ở máy chủ, đồng hồ máy chủ, giới hạn số lần, cộng giờ, theo lớp (`class_codes`) |
| ③ Thi qua Firebase Auth "Cổng 2–3" | `exam-fb.js`, `apps-script/exam/Code.gs` | Có mã, đã thử 26/10, không nối với menu giáo viên | Đề chỉ đọc trong giờ thi, Apps Script chấm, nhận file xlsx/pptx/docx/pdf |

Đường ① đã làm được:
- **Giáo viên:** tạo bài (thật/thử, khối, **một** lớp, năm học, hình thức, nội dung TN / TN+TL / TN+TH); nhập đề từ Excel (mẫu cột STT, Loại, Câu hỏi, A–D, Đáp án, Điểm, Chủ đề, Gợi ý); Mở/Khóa; Cho xem điểm; theo dõi tức thì (phòng chờ / đang thi / đã nộp); thống kê; sổ chấm thực hành và AI gợi ý điểm theo tiêu chí; kéo điểm về trang KetQua.
- **Học sinh:** chỉ thấy bài của lớp mình; vào được khi bài **Mở**; thi thật đảo thứ tự câu và phương án theo từng em; bắt buộc làm hết câu; đếm số lần rời màn hình; nộp một lần (luật Firebase); tải file thực hành (Apps Script → Drive); AI chấm tự luận ngay khi nộp.
- **Minh chứng:** Drive `Bài thi - Góc học tập / Năm học / Lớp … / Hình thức - Tiêu đề /`, mỗi em một file chữ (đề, phương án, đáp án đúng, em chọn, đúng/sai, điểm) và file thực hành `Mã - Tên - Thực hành - …`.

## 2. Đối chiếu quy trình của thầy
| # | Bước thầy muốn | Hiện tại | Cần làm |
|---|---|---|---|
| 1 | Soạn đề trên máy hoặc Google Sheet | Có (Excel / soạn trong app; Sheet trang DeThi) | Giữ. Thêm: một đề có **nhiều mã đề** (đảo đã có) |
| 2 | Mỗi buổi, giáo viên cập nhật đề lên | Có (đề đẩy lên Firebase khi lưu) | Đề **chỉ đưa cho học sinh khi ca thi bắt đầu** (hiện công khai mọi lúc) |
| 3 | Kiểm tra học sinh vào phòng máy, mở máy | Có phòng chờ + trạng thái trực tuyến | Thêm **mã ca thi** 6 số giáo viên đọc tại phòng: chỉ em có mặt mới vào được |
| 4 | Giáo viên chọn lớp → cho thi | Mở/Khóa **theo bài**, một bài chỉ **một lớp** | **Ca thi = đề × lớp**, trạng thái riêng từng lớp: Chưa thi → Đang thi → Đã thi |
| 5 | Lớp khác không được thi, không đăng nhập | Lớp khác không thấy bài; vẫn đăng nhập học bình thường | Chặn đúng ca thi; còn chặn đăng nhập toàn trường thì xem câu hỏi 6.1 |
| 6 | Thi xong → "Đã thi", không vào lại | Thi thật nộp một lần; bài vẫn "Mở" tới khi khóa tay | Kết thúc ca → lớp sang "Đã thi", không vào lại; em chưa nộp được tự nộp phần đã làm |
| 7 | Đề TN+TL làm bình thường | Có | Giữ, chuyển chấm về máy chủ |
| 8 | Đề TN+TH: làm thực hành (Word/Excel/PowerPoint) trên máy, tải lên, rồi làm TN | Có tải file, nhưng `accept` chỉ .xlsx/.py | Nhận .docx/.xlsx/.pptx/.pdf; giao diện 2 phần rõ ràng |
| 9 | Nộp: thiếu TN hoặc thiếu TH thì cảnh báo, không cho nộp | Chỉ kiểm câu TN/TL; **không kiểm đã nộp thực hành**; trạng thái nộp file chỉ lưu trong trình duyệt | Máy chủ xác nhận file đã nằm trên Drive mới cho nộp; hộp thoại liệt kê đúng phần thiếu |
| 10 | Lưu Drive theo Kỳ thi / Lớp / Tên học sinh: file chữ TN + bài thực hành | Có, theo Năm học / Lớp / Hình thức - Tiêu đề; file chữ chạy **sau** (khi kéo điểm) | Thư mục mỗi em: `Kỳ thi / Lớp / Mã - Tên /`; ghi file chữ ngay khi nộp; kiểm cả hai file tồn tại mới "Hoàn thành" |
| 11 | Chấm: TN tự động; TL và TH AI gợi ý, giáo viên duyệt | TN chấm **trên máy học sinh**; TL AI chấm khi nộp; TH AI gợi ý trong sổ chấm | TN chấm ở máy chủ; màn "Chấm bài" theo ca: điểm TN, gợi ý AI cho TL/TH, giáo viên sửa và duyệt; xuất bảng điểm |

## 3. Lỗi nghiêm trọng phải sửa trước khi thi thật (đường ①)
1. **Đáp án công khai:** `thi_de` đọc được không cần đăng nhập và chứa `answer` → học sinh xem đáp án ở nhà bất cứ lúc nào.
2. **Điểm do máy học sinh tự tính và tự ghi:** `thi_nop/{bài}/{mã}` ghi bằng REST không xác thực → em sửa được điểm của mình, hoặc nộp thay bạn khác (chỉ cần biết mã).
3. **Bài làm và điểm cả trường đọc công khai** (`thi_nop .read: true`).
4. **Đăng nhập kiểm trên máy học sinh** bằng băm PIN trong `thi_hs` công khai → dò được PIN 6 số (đã báo 29/10).
5. Nộp bài không kiểm đã nộp thực hành; "đã nộp file" chỉ lưu trong trình duyệt.
→ Đường ① **giữ cho Luyện tập và thi thử**. Thi thật phải đi đường có máy chủ (mục 4).

## 4. Thiết kế đề xuất
**Nguyên tắc:** học sinh không bao giờ giữ đáp án; máy chủ quyết định ai được thi, lúc nào, và chấm điểm; Drive là nơi lưu minh chứng; giáo viên duyệt điểm cuối.

**Nền:** dùng **đường ② (Worker)** đã có JWT, chấm ở máy chủ, đồng hồ máy chủ, `class_codes`, cộng giờ. Soạn đề vẫn trên Sheet/Excel như hiện tại; khi giáo viên "Đưa đề lên cho buổi thi", Apps Script gửi đề sang Worker (`exam_defs`, đáp án lưu riêng, học sinh không đọc được).

**Dữ liệu mới (Worker/Firebase, chỉ máy chủ ghi):**
```
ky_thi/{id}      {ten, nam_hoc, hinh_thuc, khoi, noi_dung: tn_tl|tn_th, phut, de_id, tieu_chi_th[]}
ca_thi/{id}/{lop} {trang_thai: chua_thi|dang_thi|tam_dung|da_thi, ma_ca: 6 số, bat_dau, ket_thuc, gv}
bai_nop/{id}/{ma} {tn:{...}, tl:{...}, th:{file_id, ten, size, at}, diem_tn, goi_y_tl, goi_y_th, diem_gv, trang_thai: dang_lam|thieu_th|hoan_thanh|da_cham}
```

**Luồng giáo viên:** Kỳ thi → chọn đề → bấm "Đưa đề lên" (kiểm đề: đủ đáp án, điểm, tiêu chí thực hành) → buổi thi chọn **Lớp** → màn ca thi: mã ca 6 số, danh sách lớp (trực tuyến / đã vào / đang làm / đã nộp TH / đã nộp) → **Bắt đầu** → (Tạm dừng, Cộng giờ cho một em, Cho em vào lại khi máy hỏng) → **Kết thúc ca** (xác nhận) → lớp sang "Đã thi".

**Luồng học sinh:**
1. Đăng nhập. Lớp đang có ca "Đang thi" thì vào thẳng màn thi (tắt Gia sư AI, tắt học bài).
2. Nhập **mã ca** giáo viên đọc → phòng chờ → giáo viên bấm Bắt đầu → máy chủ cấp đề (không có đáp án) và đồng hồ.
3. Đề TN+TL: một trang, như hiện tại.
4. Đề TN+TH: hai thẻ **Phần 1 · Thực hành** (đề thực hành, chọn file .docx/.xlsx/.pptx/.pdf ≤ 10 MB, Tải lên, máy chủ trả tên + dung lượng + giờ, nộp lại được để thay file) và **Phần 2 · Trắc nghiệm**. Thanh trên cùng: đồng hồ, "TN 18/20 · TH: đã nộp ✓ / chưa nộp".
5. Bấm Nộp bài → kiểm theo thứ tự: (a) còn câu TN/TL chưa làm → liệt kê số câu; (b) **chưa có file thực hành được máy chủ xác nhận** → "Em chưa nộp bài thực hành", nút đi tới Phần 1. Đủ cả hai mới hiện xác nhận "Nộp bài? Nộp rồi không làm lại được".
6. Nộp xong: máy chủ chấm TN, ghi file chữ minh chứng vào Drive, **kiểm lại** cả file chữ và file thực hành đều có trên Drive → trạng thái "Hoàn thành". Thiếu (Drive lỗi) → báo em "Nộp lại phần thực hành" ngay tại chỗ, giáo viên thấy cờ đỏ.
7. Hết giờ: máy chủ tự nộp phần đã làm (nháp lưu 1,5 giây/lần), ghi "thiếu thực hành" nếu chưa có file (xem 6.2).

**Drive:** `Bài thi - Góc học tập / <Năm học> / <Kỳ thi> / Lớp <lớp> / <Mã> - <Tên> /` gồm `trac-nghiem.txt` (đề, đáp án đúng, em chọn, đúng/sai, điểm, giờ nộp, số lần rời màn hình) và file thực hành gốc.

**Chấm (giáo viên):** màn "Chấm bài" theo ca: mỗi em một dòng: TN (tự động), TL (AI gợi ý + lý do), TH (AI gợi ý theo tiêu chí từ nội dung file + kiểm tự động công thức Excel nếu có), ô điểm giáo viên, nút **Duyệt**; mở file Drive một chạm; xuất bảng điểm Excel. AI chỉ gợi ý, điểm chính thức là điểm giáo viên duyệt. Gửi AI không kèm tên/mã học sinh.

**Ổn định khi cả phòng máy thi:** đề tải một lần lúc bắt đầu; nháp lưu trên máy và gửi máy chủ 1,5 giây/lần; mất mạng vẫn làm tiếp, có mạng tự gửi; máy hỏng thì giáo viên bấm "Cho vào lại" để em sang máy khác, bài làm còn nguyên.

## 5. Các bước làm (mỗi bước Claude kiểm rồi mới sang bước sau)
| Bước | Việc | Xong khi |
|---|---|---|
| 0 | Chặn rủi ro ngay: `thi_de` bỏ đáp án (chỉ đưa câu hỏi); đề thi thật không đẩy lên Firebase công khai | Test luật: đọc `thi_de` không thấy `answer` |
| 1 | Worker: `ky_thi`, `ca_thi` (theo lớp, mã ca), cấp đề khi ca "Đang thi" + đúng lớp + đúng mã ca | Test: lớp khác 403; sai mã ca 403; ca "Đã thi" 403 |
| 2 | Apps Script: "Đưa đề lên" từ Sheet sang Worker; kiểm đề | Test: đề thiếu đáp án bị từ chối, có báo dòng lỗi |
| 3 | Học sinh: màn thi 2 phần, đồng hồ, nộp TH qua Apps Script trả `file_id` cho Worker | Test DOM: thiếu TN chặn, thiếu TH chặn, đủ mới nộp |
| 4 | Máy chủ chấm TN, ghi Drive, kiểm cả 2 file, trạng thái Hoàn thành / Thiếu | Test: Drive lỗi → "thiếu", em được nộp lại |
| 5 | Giáo viên: màn ca thi (bắt đầu, tạm dừng, cộng giờ, cho vào lại, kết thúc) | Test: kết thúc → tự nộp nháp, lớp "Đã thi" |
| 6 | Màn chấm: AI gợi ý TL/TH, giáo viên duyệt, xuất Excel | Test: điểm chính thức = điểm giáo viên duyệt |
| 7 | Thi thử toàn trình với lớp 9TH (30 tài khoản thử) trên phòng máy thật | Báo cáo có ảnh, 0 lỗi nghiêm trọng |

Ước lượng: bước 0 nửa ngày; bước 1–4 hai đến ba ngày; bước 5–6 hai ngày; bước 7 một buổi.

## 6. Câu hỏi thầy cần chốt
1. **Chặn đăng nhập lớp khác trong giờ thi:** Claude đề xuất **không chặn toàn trường** (học sinh ở nhà vẫn học được; tải phòng máy khoảng 40 máy là nhẹ với hệ thống), chỉ chặn đúng lớp đang thi ra khỏi phần học và Gia sư. Nếu thầy vẫn muốn chặn, sẽ là một công tắc "Giờ thi: chỉ lớp đang thi được đăng nhập".
2. **Hết giờ mà chưa nộp thực hành:** tự nộp TN và ghi 0 điểm thực hành, hay giữ ca cho em đó thêm vài phút để nộp file?
3. **Thời gian làm bài:** đồng hồ đếm ngược theo từng em (bắt đầu khi em vào) hay theo cả ca (giáo viên bấm Bắt đầu là tính chung)?
4. **Máy hỏng giữa giờ:** cho em vào lại trên máy khác (giữ thời gian còn lại) do giáo viên bấm. Thầy đồng ý cách này không?
5. **Xem điểm:** sau khi giáo viên duyệt mới cho học sinh xem điểm (đề xuất), hay xem điểm TN ngay khi nộp?
