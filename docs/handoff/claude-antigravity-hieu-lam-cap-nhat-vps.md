# Claude → Antigravity: cập nhật Bộ não trên VPS (thêm "Hiểu lầm phổ biến") (28/10)
Hạn cuộc thi: **30/10/2026**. Việc này nhỏ, làm trước.

## Có gì mới (brain/)
- Bộ não đọc thêm `thi_de/<bài>` và `tra_loi` trong `thi_nop` của các bài thi thử/thi thật, lưu vào hai bảng SQLite mới `qbank`, `answers` (tự tạo, không cần di chuyển dữ liệu).
- Báo cáo tuần mỗi lớp có thêm mục **Hiểu lầm phổ biến**: câu trắc nghiệm có từ 30% em sai trở lên (ít nhất 4 em làm), đáp án sai nào được chọn nhiều nhất. Chỉ là số đếm, không có tên học sinh; Gemini không nhận tên.
- Kiểm thử: `python3 -m unittest discover -s brain/tests -t .` → 8 ca OK (thêm `test_misconceptions`).

## Antigravity làm
1. `git pull`.
2. Cập nhật VPS (không đụng `.env`): chạy lại `curl -sSL https://raw.githubusercontent.com/mrbin2026dh-droid/aihoctap/main/brain/deploy/setup.sh | bash` (kịch bản giữ `.env`, chạy lại 8 ca kiểm thử), hoặc làm theo mục 8 của `docs/huong-dan-vps-bo-nao-ai.md`.
3. Khi thầy đã điền đủ `FB_SECRET` và `SHEET_BRAIN_KEY` trong `/opt/brain/.env` (Antigravity KHÔNG tự lấy; hỏi thầy tự dán trên VPS bằng `nano`):
   - `sudo -u brain python3 -m brain run --dry-run --env /opt/brain/.env`
   - Nếu lớp đã có học sinh làm thi thử, báo cáo có mục "Hiểu lầm phổ biến"; chưa có thì mục này im lặng hoặc ghi "chưa đủ dữ liệu thi".
   - `sudo -u brain python3 -m brain run --env /opt/brain/.env` → trang giáo viên → Hiệu quả → "Bộ não AI: báo cáo tuần".
4. Không bơm dữ liệu giả vào Firebase thật. Ghi kết quả vào `docs/handoff/antigravity-claude-hieu-lam-vps.md` (che khóa).

## Lưu ý cho thầy
- Cuối khung Trợ giúp đã sửa câu về bảo mật: đề thi thử chạy nhanh trên Firebase, nên đáp án nằm trong dữ liệu đề (ứng dụng không hiện). Bài luyện tập mới chấm ở máy chủ. Câu hỏi trong cuộc thi nên trả lời đúng như vậy.
