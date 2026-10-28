# Claude → Antigravity: dữ liệu giả lập đang nằm trong Firebase thật — tạm dừng, chưa xóa (28/10)

## Phát hiện
- Theo `aisgk.md` (28/10 chiều) và báo cáo chẩn đoán: bài thi `1793101939261` cùng 66 bài nộp, 65 `nang_luc`, 130 `doc_read` của lớp 9A10, 9A9 là **dữ liệu do Antigravity tạo và nạp vào Firebase THẬT**, không phải học sinh làm.
- Bộ não, trang giáo viên (Hiệu quả) và báo cáo tuần đang phân tích **dữ liệu giả như thật**.
- **Nguy hại trực tiếp:** 2 học sinh thật đang bị Gia sư nhắc "em từng chọn sai…" ở câu các em **chưa từng làm**.
- `docs/bao-cao-minh-chung-cuoc-thi-ai-2026.md` trình bày số liệu tiến bộ và trích đoạn hội thoại gắn tên thật các em như kết quả thực nghiệm. Đây là dữ liệu tạo ra, không được nộp như kết quả thật (trái `REQUIREMENTS_CUOC_THI.md`: "Dữ liệu THẬT… báo cáo phân biệt THẬT/MOCK").

## Antigravity làm NGAY (an toàn, đảo ngược được)
1. **Tạm dừng Bộ não** trước lượt 21:00 tối nay (nếu không, nó gửi lại hiểu lầm giả cho Gia sư):
   `systemctl disable --now brain.timer` → kiểm `systemctl list-timers brain.timer` không còn lượt kế tiếp.
2. **Xóa hiểu lầm giả khỏi Gia sư** (gửi danh sách rỗng; không in khóa):
   ```
   KEY=$(grep '^BRAIN_KEY=' /opt/brain/.env | cut -d= -f2-); URL=$(grep '^WORKER_URL=' /opt/brain/.env | cut -d= -f2-)
   curl -s -X POST "$URL/api/brain/hieu-lam" -H "X-Brain-Key: $KEY" -H 'Content-Type: application/json' -d '{"items":{}}'; unset KEY
   ```
   Kỳ vọng: `{"saved":0,"cleared":2,"skipped":0}`.
3. **Kiểm kê, CHƯA XÓA** (chỉ đọc): liệt kê đường dẫn Firebase đã bị lệnh nạp giả lập ghi (bài thi, `thi_nop/<bài>`, `nang_luc/<mã>`, `doc_read/...`), số bản ghi mỗi nhánh, và **có ghi đè dữ liệu thật trước đó không** (nhất là `nang_luc`). Ghi vào `docs/handoff/antigravity-claude-kiem-ke-du-lieu-gia.md` — chỉ số đếm và tên nhánh, **không** ghi tên/mã học sinh.
4. **Không** xóa gì trên Firebase, **không** sửa báo cáo minh chứng cho tới khi thầy quyết định.

## Chờ thầy quyết định
- A) Xóa dữ liệu giả khỏi Firebase, chỉ dùng dữ liệu lớp làm thật (khuyên dùng); báo cáo minh chứng viết lại: phần kiểm thử hệ thống ghi rõ "dữ liệu mô phỏng", phần thực nghiệm chỉ dùng số liệu thật.
- B) Giữ làm dữ liệu minh họa nhưng chuyển sang lớp/học sinh giả (không tên thật), ghi rõ "minh họa".

## Bộ não (Claude đã sửa, cần cập nhật VPS sau khi thầy quyết định)
- Phân tích câu hỏi bỏ qua câu trả lời mang mã câu không có trong đề (trước đây làm sai tỉ lệ đúng: "5% đúng" trong khi chỉ 1 em chọn sai). 18 ca OK.
