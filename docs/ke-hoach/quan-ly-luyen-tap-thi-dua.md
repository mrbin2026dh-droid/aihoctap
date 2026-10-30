# Kế hoạch: quản lý nhiều bộ Luyện tập / Thảo luận và Bảng thi đua cộng điểm (30/10/2026)

Người lập: Claude. Trạng thái: **Bảng thi đua ĐÃ CODE (30/10/2026 chiều)** theo quyết định của thầy:
- Kỳ thi đua theo **tháng**.
- Điểm tháng là **trung bình các buổi cao nhất**: N = 60% số buổi, làm tròn lên.
- Học sinh thấy **top 10 và hạng của mình**.
- **Thảo luận không tính.**

Phần quản lý nhiều bộ (thanh lọc, ghim, tab "Kết quả các buổi") làm ở đợt sau.

## 1. Hiện trạng
- Trang "Tiện ích" có 2 tab, Luyện tập và Thảo luận. Mỗi bộ là một thẻ (tên, số câu, giây/câu, lớp, nút Mở / Sửa / Xóa), xếp theo thứ tự tạo.
- Có 10 đến 50 bộ thì danh sách dài, khó tìm bộ của lớp đang dạy. Không biết bộ nào đã dùng, dùng lúc nào.
- Lịch sử buổi luyện tập chỉ lưu trên máy giáo viên (`qz-hist-…` trong trình duyệt, tối đa 20 buổi). Đổi máy là mất.
- Kết quả từng em (`quiz/{phòng}/kq`) nằm trong phòng, không được gom theo lớp. Vì vậy chưa có cơ sở để xếp hạng 1–10 qua nhiều buổi.

## 2. Thiết kế quản lý (H2)
Mẫu trang: **danh sách có bộ lọc** (giống Gmail, Google Classroom), không thêm tầng menu.

| Thành phần | Nội dung |
|---|---|
| Thanh lọc (một hàng, xuống dòng trên điện thoại) | Ô **Tìm theo tên** · **Lớp** (mặc định: lớp vừa dạy) · **Bài học/chủ đề** · **Sắp xếp** (Dùng gần đây / Mới tạo / Tên A–Z) |
| Nhóm | Hai nhóm thu gọn được: **Ghim** (bộ hay dùng, tối đa 5) và **Tất cả**. Có 100 bộ vẫn chỉ hiện 20, kèm nút "Hiện thêm" |
| Mỗi dòng | Tên · số câu · lớp · **"Dùng lần cuối 29/10, 3 lần"** · nút chính **Mở** · menu "…" (Sửa, Nhân bản, Ghim, Xóa) |
| Tab thứ 3 **"Kết quả các buổi"** | Mỗi buổi một dòng: ngày giờ, bộ, lớp, số em, % đúng TB. Bấm vào xem lại bảng xếp hạng và tải CSV. Lưu trên Firebase nên đổi máy vẫn còn |
| Phòng đang mở | Một dải trên cùng: "Đang mở: Ôn nhanh bài 1 · Lớp 9A7 · 32 em" + nút **Quay lại phòng** / **Kết thúc**. Giáo viên không quên đóng phòng |

Điều kiện: không vỡ khổ 390 px, nút ≥ 48 px, xóa phải có hộp xác nhận (mục J của AGENTS.md).

## 3. Bảng thi đua cộng điểm (ý tưởng của thầy)

### 3.1 Cách tính đề xuất (công bằng, chống "máy nhanh thắng")
Điểm Kahoot hiện tại cộng thêm theo tốc độ bấm. Máy yếu, mạng chậm sẽ thiệt, nên **không dùng điểm này để cộng điểm học tập**. Đề xuất:
- **Điểm thi đua mỗi buổi = số câu đúng × 10** (+2 nếu đúng hết). Tốc độ chỉ dùng để phân hạng khi bằng điểm trong buổi.
- **Bảng thi đua của lớp = tổng điểm thi đua** trong một kỳ (tuần / tháng / học kỳ, thầy chọn).
  - Muốn top 1–10 không chỉ là em đi học đủ, cần điều kiện **tham gia ≥ 60% số buổi** của kỳ.
  - Hoặc cách B: lấy **trung bình N buổi tốt nhất** để em vắng có phép không thiệt.
- Em vắng có lý do (ốm, có phép): giáo viên đánh dấu "miễn buổi". Buổi đó không tính vào mẫu số.

### 3.2 Hiển thị cho học sinh (tạo động lực, không gây áp lực)
- Mục Luyện tập: thẻ **"Bảng thi đua lớp 9A7 – tháng 11"**, chỉ hiện **top 10** (tên rút gọn, ví dụ "Nguyễn V. An") và **thứ hạng của chính em** ("Em đang hạng 14, còn 20 điểm nữa vào top 10").
- Không công khai thứ hạng các bạn ngoài top 10. Đây là chuẩn sư phạm: không làm em yếu xấu hổ.
- Huy hiệu nhỏ: "Tiến bộ nhất tháng" (tăng nhiều hạng nhất). Em trung bình cũng có cơ hội.

### 3.3 Cho giáo viên
- Trang "Kết quả các buổi" có thêm tab **Thi đua**: chọn lớp và kỳ → bảng xếp hạng đầy đủ, số buổi tham gia, nút **Chốt kỳ**.
- Chốt kỳ: lưu bản chốt (không đổi được nữa), tải **CSV / Excel** để vào sổ điểm. Hệ thống **không tự cộng điểm vào sổ**; giáo viên quyết định theo quy định của trường (ví dụ top 3 được +1 điểm thường xuyên).

### 3.4 Dữ liệu và bảo mật
- Khi kết thúc buổi, máy giáo viên ghi `quiz_kq_lop/{lớp}/{phòng} = {at, bo, so_cau, kq: {mã: {c, p}}}`. Đây là bản tóm tắt, không có câu trả lời chi tiết.
- Luật Firebase: chỉ giáo viên có khóa phòng (`quiz_proof`) được ghi. Học sinh chỉ đọc bảng top 10 đã tính sẵn (`quiz_bxh/{lớp}/{kỳ}`), **không đọc điểm của từng bạn**.
- Đã chốt kỳ thì khóa, không sửa được (lưu kèm thời điểm chốt làm minh chứng).
- Khả năng gian lận: em mở 2 máy trả lời hộ bạn. Phòng đã dùng mã học sinh đăng nhập; giáo viên giám sát tại lớp. Chấp nhận như hiện tại.

## 4. Câu hỏi thầy cần chốt
1. Kỳ thi đua: theo **tuần**, **tháng** hay **học kỳ**?
2. Cách tính: **tổng điểm + điều kiện tham gia ≥ 60%** (A) hay **trung bình các buổi tốt nhất** (B)?
3. Học sinh thấy: **top 10 + hạng của mình** (đề xuất) hay **cả lớp**?
4. Thảo luận có tính vào thi đua không? Đề xuất: **không**, vì Thảo luận là ý kiến, không có đúng/sai.

## 5. Các bước làm (khi thầy đồng ý)
| Bước | Việc | Xong khi |
|---|---|---|
| 1 | Lưu kết quả buổi lên Firebase (`quiz_kq_lop`), tab "Kết quả các buổi" | Test: kết thúc 2 buổi → 2 dòng, đổi máy vẫn thấy |
| 2 | Thanh lọc, ghim, "Dùng lần cuối", dải phòng đang mở | Test DOM 60 bộ: tìm, lọc lớp, sắp xếp đúng; 390 px không tràn |
| 3 | Bảng thi đua giáo viên + chốt kỳ + CSV | Test: 3 buổi, 1 em vắng có phép → thứ hạng đúng theo công thức |
| 4 | Thẻ thi đua học sinh (top 10 + hạng em) | Test: em hạng 14 thấy "hạng 14", không thấy điểm bạn hạng 15 |
| 5 | Luật Firebase + emulator, thử thật lớp 9TH | Báo cáo có ảnh |
