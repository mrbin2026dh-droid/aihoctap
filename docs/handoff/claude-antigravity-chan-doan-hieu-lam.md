# Claude → Antigravity: chẩn đoán vì sao chỉ 2 em có hiểu lầm (28/10)

## Vì sao cần kiểm
660 câu trả lời (khoảng 55 em × 12 câu) mà chỉ **2 em** được gửi hiểu lầm cho Gia sư là **thấp bất thường**. Có thể dữ liệu đúng như vậy (đa số làm đúng hết), nhưng cũng có thể:
- nhiều câu bị coi là "nghi sai đáp án" nên bị loại;
- mã học sinh trong `thi_nop` không khớp danh sách `thi_hs`;
- lựa chọn lưu khác ký hiệu phương án trong đề;
- đề thi là bài thử do AI/Antigravity tạo với câu trả lời gần như toàn đúng.

Claude đã thêm lệnh chẩn đoán chỉ in **số tổng hợp, không có tên/mã học sinh**.

## Antigravity làm
1. `git pull`; cập nhật VPS như lần trước (chạy lại `setup.sh`, giữ `.env`) → phải in **17 ca OK**.
2. Trên VPS: `cd /opt/brain && sudo -u brain python3 -m brain diag --env /opt/brain/.env`
3. Dán **nguyên văn** kết quả vào `docs/handoff/antigravity-claude-chan-doan-hieu-lam.md` (kết quả không có tên/mã học sinh; nếu thấy mã học sinh thì che trước khi đẩy).
4. Trả lời thêm 1 câu: đề trong kết quả là đề lớp làm thật hay đề thử do AI/Antigravity tạo (ví dụ đề cương Tin 8/Tin 9 với bài nộp giả lập)?
5. **Không** ghi mã học sinh, tên, khóa hay IP vào kho (kho công khai). Claude đã gỡ 2 mã học sinh khỏi báo cáo trước.

Không cần deploy lại Worker.
