# Antigravity → Claude: Thầy chọn Phương án A — Đã xóa toàn bộ dữ liệu giả lập & Xác nhận làm Zalo Bot (28/10)

## 1. Quyết định của Thầy
- Thầy đã chọn **Phương án A**: Xóa toàn bộ dữ liệu giả lập và tài khoản ảo đang test; ngày mai cho học sinh làm bài thi thử thật để lấy dữ liệu thực nghiệm trung thực nộp cuộc thi.
- Thầy đã xác nhận **CÓ LÀM Zalo Bot bản tối thiểu** và đang tự tạo bot trên Zalo để lấy khóa/token.

---

## 2. Kết quả dọn dẹp dữ liệu (Đã hoàn thành 100%)

### Đã sao lưu dự phòng an toàn trước khi xóa
- Tệp sao lưu đầy đủ: `/opt/brain/backups/backup_mock_data_20261028.json` trên VPS (dung lượng: 199.563 bytes).
- Đã tải một bản sao lưu về máy cục bộ: `scratch/backup_mock_data_20261028.json`.

### Đã xóa sạch trên Firebase Realtime Database (Tất cả trả HTTP 200)
- `thi_nop/1793101939261`: Đã xóa toàn bộ 66 bài nộp giả lập. Hiện `thi_nop` trả `null`.
- `nang_luc`: Đã xóa sạch toàn bộ 65 bản đồ năng lực giả lập. Hiện `nang_luc` trả `null`.
- `doc_read/tin9~bai1` và `doc_read/tin9~bai2`: Đã xóa toàn bộ 130 bản ghi đọc giả lập.
- `thi_vao`: Đã xóa toàn bộ bản ghi vào thi thử nghiệm.
- `students` (schema cũ) & `students_auth`: Đã xóa sạch các tài khoản ảo cũ (`hsndcil6`, v.v.).
- `attempts`, `attempt_details`, `exam_sessions`: Đã xóa sạch các lượt thi thử nghiệm của tài khoản ảo.

### Dữ liệu THẬT được bảo toàn nguyên vẹn 100%
- `thi_hs`: Đầy đủ **65 học sinh thật** của 2 lớp 9A10 (31 em) và 9A9 (34 em).
- `thi_de` / `thi_bai`: 3 bộ đề thật (Đề thi thật khối 9 khóa `1793081445030`, Đề thi thử khối 9 mở `1793101939261`, Đề thi thử khối 8 mở `1793192089570`).
- `doc_read/tin-hoc-9~bai-*`: Toàn bộ các lượt đọc bài lý thuyết thật của học sinh qua PWA được giữ nguyên.
- `teacher_auth` / `thi_gv`: Tài khoản và thông tin giáo viên được bảo vệ an toàn.
- Tài liệu học tập, giáo trình, bài giảng trong `tai_lieu`, `courses`, `catalog`, `packages`: Nguyên vẹn.

---

## 3. Hiện trạng cơ sở dữ liệu VPS SQLite (`/var/lib/brain/brain.sqlite3`)
- Đã sao lưu tệp SQLite: `/var/lib/brain/brain.sqlite3.bak_pre_clean_20261028`.
- Đã dọn sạch các bảng dữ liệu cũ:
  - `answers`: 0 dòng.
  - `mastery`: 0 dòng.
  - `exams`: 0 dòng.
  - `reports`: 0 dòng.
  - `reads`: 0 dòng.
  - `students`: 65 dòng (giữ nguyên danh sách 65 học sinh thật).
  - `qbank`: 26 dòng (giữ nguyên ngân hàng câu hỏi chuẩn).
- Đã cập nhật mã nguồn mới nhất (`analyze.py` và `test_brain.py` từ commit `5ffd0d9`):
  - Chạy `python3 -m unittest discover -s brain/tests` trên VPS đạt **18/18 ca PASS**.
  - `brain.timer` vẫn ở trạng thái **disabled/inactive**, sẵn sàng kích hoạt lại khi học sinh làm bài thi thật.

---

## 4. Việc tiếp theo cho Claude
1. **Báo cáo minh chứng cuộc thi (`docs/bao-cao-minh-chung-cuoc-thi-ai-2026.md`)**:
   - Viết lại/điều chỉnh theo Phương án A:
     - Phần kiểm thử hệ thống: Ghi rõ là dữ liệu mô phỏng kỹ thuật/tải lớn để chứng minh tính ổn định của Worker, SQLite và Gemini.
     - Phần thực nghiệm sư phạm: Dành chỗ cho số liệu bài thi thử thật của 2 lớp 9A10 và 9A9 (sẽ làm vào ngày 29/10).
2. **Zalo Bot bản tối thiểu**:
   - Thiết kế luồng tích hợp Zalo Bot tối thiểu (thông báo kết quả/nhắc nhở học tập) để kết nối với Token khi Thầy tạo xong trên Zalo Developer.
