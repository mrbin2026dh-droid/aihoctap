# Antigravity → Claude: Báo cáo tạm dừng Bộ não, xóa hiểu lầm Gia sư & Kiểm kê dữ liệu Firebase (28/10)

## 1. Hành động khẩn cấp đã hoàn thành (trước 21:00)

### Bước 1: Tạm dừng Bộ não AI trên VPS
- Đã thực thi lệnh `systemctl disable --now brain.timer` qua SSH lúc 20:25:33.
- Kết quả kiểm tra: `systemctl list-timers brain.timer` trả về `0 timers listed`.
- **Đảm bảo:** Bộ não AI không tự động kích hoạt lượt phân tích 21:03 tối nay, ngăn chặn hoàn toàn việc gửi lại dữ liệu cũ.

### Bước 2: Xóa hiểu lầm giả lập khỏi Gia sư
- Đã gửi yêu cầu API xác thực bằng `BRAIN_KEY` lên Cloudflare Worker:
  `POST https://aihoctap-gate.mrbin2026dh.workers.dev/api/brain/hieu-lam` với payload `{"items": {}}`.
- Kết quả phản hồi thực tế từ Durable Object: `{"saved":0,"cleared":2,"skipped":0}`.
- **Đảm bảo:** Toàn bộ 2 bản ghi hiểu lầm giả lập đã bị xóa sạch khỏi bộ nhớ Gia sư. Các em học sinh khi tương tác với Gia sư AI không còn bị nhắc sai về những câu chưa từng làm.

---

## 2. Kiểm kê chi tiết dữ liệu trên Firebase Realtime Database (Chỉ đọc, chưa xóa)

Quét trực tiếp qua REST API xác thực bằng Service Secret trên Firebase Realtime Database:

| Nhánh dữ liệu | Số lượng bản ghi | Trạng thái nguồn gốc | Đánh giá việc ghi đè dữ liệu thật |
| :--- | :--- | :--- | :--- |
| `thi_de` | 3 đề | 1 đề thật khóa (`1793081445030`), 1 đề thử mở gắn dữ liệu giả lập (`1793101939261`), 1 đề thử K8 mở (`1793192089570`) | Không ghi đè đề khác. |
| `thi_bai` | 3 bài | Tương ứng 3 mã trên | Không ghi đè. |
| `thi_nop/1793101939261` | 66 bài nộp | Dữ liệu giả lập nạp trưa 28/10 (65 học sinh của 9A10, 9A9, 1 bài nộp lại) | Chỉ nằm riêng trong mã đề `1793101939261`. Các đề khác có 0 bài nộp. |
| `nang_luc` | 65 bản ghi | 56 bản ghi giữ nguyên timestamp nạp giả lập (`1793165794887`, 12:36:34); 9 bản ghi được client cập nhật lại từ 12:50 và 19:29–20:08 tối nay | **Không ghi đè dữ liệu trước 28/10** (nhánh này mới tạo sáng 28/10, trước 12:36 chưa có bản ghi nào). 56 bản ghi là dữ liệu giả, 9 bản ghi là do lượt thử nghiệm tối nay. |
| `doc_read/tin9~bai1` | 65 bản ghi | Dữ liệu giả lập nạp trưa 28/10 | Slug riêng (`tin9~bai1`). |
| `doc_read/tin9~bai2` | 65 bản ghi | Dữ liệu giả lập nạp trưa 28/10 | Slug riêng (`tin9~bai2`). |
| `doc_read/tin-hoc-9~bai-*` | 13 bản ghi | **Dữ liệu thật** từ người dùng/học sinh tương tác PWA (bài 1: 6, bài 10: 4, bài 4: 1, bài 7: 1, bài 9: 1) | **Hoàn toàn nguyên vẹn 100%**, không bị ghi đè do script giả lập dùng slug khác (`tin9~bai*` vs `tin-hoc-9~bai-*`). |
| `thi_hs` | 65 học sinh | Danh sách học sinh thật (9A10: 31, 9A9: 34) | **Hoàn toàn nguyên vẹn**, script chỉ đọc, không sửa/ghi đè. |

---

## 3. Hiện trạng cơ sở dữ liệu SQLite trên VPS (`/var/lib/brain/brain.sqlite3`)

Số lượng bản ghi hiện có trong cơ sở dữ liệu cục bộ của VPS:
- `answers`: 660 dòng (từ 66 bài nộp của đề `1793101939261`).
- `mastery`: 195 dòng (65 học sinh × 3 chủ đề).
- `qbank`: 26 câu hỏi.
- `reads`: 139 dòng (130 dòng từ 2 bài đọc giả lập + 9 dòng từ các bài đọc thật).
- `students`: 65 dòng.
- `exams`: 66 dòng.
- `reports`: 2 dòng (báo cáo tuần của 9A10 và 9A9).

---

## 4. Cam kết tiếp theo

1. **Giữ nguyên trạng thái:** Chưa thực hiện bất kỳ lệnh xóa nào trên Firebase, chưa thay đổi cấu trúc bảng SQLite trên VPS, và chưa chỉnh sửa tài liệu `docs/bao-cao-minh-chung-cuoc-thi-ai-2026.md`.
2. **Chờ quyết định của Thầy:**
   - **Phương án A (Khuyên dùng):** Xóa toàn bộ dữ liệu giả lập khỏi Firebase (`thi_nop/1793101939261`, `doc_read/tin9~bai1`, `doc_read/tin9~bai2`, làm sạch `nang_luc` giả); reset SQLite trên VPS; tổ chức cho học sinh làm một bài thi thử thật vào ngày mai 29/10 để thu thập dữ liệu thật 100%; viết lại báo cáo minh chứng nêu rõ kết quả thực tế ban đầu.
   - **Phương án B:** Giữ lại làm dữ liệu mô phỏng nhưng đổi tên lớp/học sinh thành dữ liệu ẩn danh (mô phỏng kiểm thử tải và tính năng), ghi rõ trong báo cáo là "dữ liệu mô phỏng kiểm thử hệ thống".
