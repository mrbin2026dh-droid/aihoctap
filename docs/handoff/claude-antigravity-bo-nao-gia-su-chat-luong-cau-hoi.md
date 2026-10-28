# Claude → Antigravity: Bộ não AI → Gia sư biết em hay nhầm gì + Chất lượng câu hỏi (28/10)
Hạn cuộc thi **30/10/2026**. Cần **deploy Worker** và **cập nhật VPS**. Không đổi luật Firebase, không đổi app học sinh.

## 1. Tính năng
### A. Gia sư biết em hay nhầm gì
- Bộ não (VPS) tính cho mỗi em tối đa 3 câu trắc nghiệm em chọn sai ở lần làm gần nhất, ưu tiên lỗi nhiều bạn cùng mắc.
- Gửi lên Worker `POST /api/brain/hieu-lam` (khóa `BRAIN_KEY`), lưu trong Durable Object, **thay toàn bộ** mỗi lần (em đã hết nhầm thì xóa).
- Khi em hỏi Gia sư, Worker tra theo tài khoản trong token (không tin dữ liệu từ máy học sinh) và thêm dòng nhắc: em từng chọn "…" ở câu "…". Gia sư chỉ dùng khi câu hỏi liên quan, hỏi gợi mở, **không có và không được nói đáp án đúng**.
- Câu bị nghi ghi sai đáp án (mục B, mức 3) bị loại: không nói em "chọn sai" khi em có thể đúng.
- Không gửi tên học sinh.
### B. Chất lượng câu hỏi (trong báo cáo tuần, mục mới thứ 7)
- Thống kê khảo thí cổ điển trên mọi em làm đề (≥ 10 em): p (tỉ lệ đúng), D (nhóm 27% điểm cao − nhóm 27% điểm thấp; ngưỡng Ebel: < 0,2 kém).
- Gắn cờ: **nghi sai đáp án** (một phương án được nhóm cao chọn nhiều hơn đáp án đang ghi và nhiều hơn nhóm thấp), **D âm**, **quá khó** (≤ 20%), **phân biệt thấp**, phương án nhiễu không ai chọn. Báo cáo chỉ đưa câu mức ≥ 2.

## 2. Kiểm thử Claude đã chạy
- `python3 -m unittest discover -s brain/tests -t .` → **16 ca OK** (thêm 8 ca: phát hiện sai đáp án, không báo nhầm câu khó, D = 0 tính tay khớp, phương án nhiễu, ít em thì không kết luận, hiểu lầm riêng không chứa đáp án đúng, loại câu nghi sai đáp án, chạy thử không gửi Gia sư, gửi kèm khóa).
- `node tests/test_brain_hieu_lam.mjs` → **16 ca OK** (quyền, mã chữ hoa khớp, em khác không thấy, dữ liệu giả từ máy học sinh bị bỏ qua, gửi lại thì xóa em đã hết nhầm).
- Hồi quy 31 tệp kiểm thử Worker đạt. `test_accounts`, `test_gate1_provisioning` lỗi **cả trên mã cũ** (không do thay đổi này); các tệp smoke/live cần mạng thật.

## 3. Antigravity làm (theo thứ tự)
1. `git pull`.
2. **Deploy Worker**: `npx wrangler deploy`. Không cần khóa mới (dùng `BRAIN_KEY` đã xoay).
   Kiểm nhanh: `POST /api/brain/hieu-lam` không có khóa → **403**.
3. **Cập nhật VPS** (giữ `.env`): chạy lại `curl -sSL https://raw.githubusercontent.com/mrbin2026dh-droid/aihoctap/main/brain/deploy/setup.sh | bash` → phải in **16 ca OK**.
4. Chạy thật: `sudo -u brain python3 -m brain run --env /opt/brain/.env`. Kỳ vọng có các dòng:
   - `Đã viết 2 báo cáo lớp.`
   - `Đã gửi hiểu lầm riêng cho Gia sư: <N> em, xóa 0 em đã hết nhầm.` (N > 0 vì đã có 660 câu trả lời)
   - `Đã gửi Google Sheet: 2 lớp`
5. Kiểm báo cáo: trang giáo viên → Hiệu quả → Bộ não AI: có mục **Hiểu lầm phổ biến** và **Chất lượng câu hỏi**. Nếu mục chất lượng nêu "nghi sai đáp án" → báo thầy mở đề kiểm tra lại đáp án (đây đúng là tác dụng của tính năng).
6. Kiểm Gia sư thật (nhờ thầy, 1 học sinh có trong danh sách N em): đăng nhập, mở bài liên quan, hỏi về đúng kiến thức em đã nhầm. Kỳ vọng: Gia sư hỏi gợi mở về chỗ đó, **không nói đáp án đúng**. Hỏi chuyện khác: không nhắc.
7. Ghi kết quả vào `docs/handoff/antigravity-claude-bo-nao-gia-su-xong.md` (không ghi tên học sinh, khóa, IP). Cập nhật `aisgk.md`.

## 4. Giới hạn cần nói đúng khi trình bày
- Hiểu lầm lấy từ **lần làm gần nhất** của mỗi bài thi thử/thi thật còn trên hệ thống; giáo viên xóa đề thì Bộ não bỏ dữ liệu đề đó.
- Cập nhật mỗi tối 21:00 (không tức thời).
- Phân tích chất lượng câu hỏi cần ≥ 10 em làm cùng đề; ít hơn thì không kết luận.
