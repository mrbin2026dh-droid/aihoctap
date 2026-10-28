# Claude → Antigravity: khảo sát "Bộ não thứ 2" (Obsidian + AI) cho thầy (28/10)

## Mục tiêu của thầy
Một "bộ não thứ 2" như hình thầy gửi: kho ghi chú Markdown mở bằng **Obsidian** (cây thư mục bên trái, **đồ thị liên kết** bên phải), do AI tự đọc nguồn, viết trang, nối liên kết, giữ mục lục. Dùng để gom **thông tin học sinh** và **công việc của thầy** thành một mạng kiến thức hỏi đáp được.

Đây là hướng "LLM Wiki" của Andrej Karpathy: ba lớp **nguồn thô (raw)** → **wiki do AI viết** → **tệp luật (CLAUDE.md)**; ba thao tác **ingest** (nạp nguồn), **query** (hỏi), **lint** (kiểm tra). Không cần cơ sở dữ liệu vector, chạy tốt đến vài trăm tài liệu.

## Việc của Antigravity: TẢI, CÀI, PHÂN TÍCH TRƯỚC (chưa đụng dữ liệu thật)
Làm trong thư mục thử **ngoài** kho `aihoctap`, ví dụ `~/bo-nao-thu-2-thu-nghiem/`. **Không** dùng dữ liệu học sinh thật ở bước này; chỉ dùng dữ liệu giả.

### Quy tắc an toàn (bắt buộc)
1. Không chạy lệnh nào trong README mà chưa đọc. Với mỗi kho: đọc `hooks/`, `scripts/`, `package.json`, `install*`; ghi lại hook nào chạy tự động, có gọi mạng không, có ghi ngoài thư mục vault không.
2. Không dán khóa bí mật (Firebase secret, Gemini, BRAIN_KEY, SSH) vào vault, README hay chat.
3. Không `git push` bất cứ thứ gì lên GitHub trong bước này. Vault thử nghiệm không được là kho công khai.
4. Không cài plugin cộng đồng của Obsidian nếu chưa liệt kê tên, tác giả, số sao để thầy duyệt.
5. Cần quyền quản trị / xóa tệp ngoài thư mục thử → dừng và hỏi thầy.

### Bước 0: máy thầy
Ghi lại: hệ điều hành (Windows/macOS/Linux), phiên bản Python, Node, Git, Claude Code, Obsidian đã cài chưa. (Lưu ý: `claude-obsidian` ghi vault trên Windows phải qua WSL.)

### Bước 1: cài Obsidian và tạo vault thử
Cài Obsidian (obsidian.md, miễn phí cho cá nhân). Tạo vault trống `vault-thu`. Mở **Graph view** để biết đồ thị hoạt động.

### Bước 2: tải và thử 3 ứng viên (mỗi cái một vault thử riêng)
| # | Kho | Vì sao chọn | Cài |
|---|---|---|---|
| A | https://github.com/NicholasSpisak/second-brain | Gọn nhất, bám sát Karpathy. 4 kỹ năng: `second-brain` (cài đặt), `-ingest`, `-query`, `-lint`. Cấu trúc `raw/` `wiki/` `output/` | `npx skills add NicholasSpisak/second-brain` rồi chạy `/second-brain` |
| B | https://github.com/AgriciDaniel/claude-obsidian | Đầy đủ nhất (15,7 nghìn sao, MIT, 342 commit): nạp nguồn có bản sao bất biến, ghi nhận tuyên bố + độ tin cậy, ghi có xem trước và khôi phục, kiểm tra liên kết chết | Xem README: `python3 scripts/claude-obsidian.py init <vault>` (xem kế hoạch trước, rồi `--apply`), hoặc `/plugin install claude-obsidian --marketplace AgriciDaniel/claude-obsidian` |
| C | https://github.com/julianoczkowski/karpathy-llm-wiki | Hướng dẫn từng bước làm đúng kiểu Karpathy (dán gist + lời nhắc "You are my LLM Wiki agent"), dùng để đối chiếu tệp luật CLAUDE.md | Làm theo README, tự tạo vault + CLAUDE.md |

Tham khảo thêm, **chưa cài**, chỉ đọc: https://github.com/Ar9av/obsidian-wiki , https://github.com/ddenzu/karpathy-llm-wiki-second-brain , https://github.com/undefined-ui/second-brain-os .

### Bước 3: chạy cùng một bộ dữ liệu giả cho cả 3
Tạo 6 tệp giả trong `raw/` (không có tên thật):
1. Một bài viết ngắn về "Mã nhị phân" (giống bài Tin 9).
2. Bảng điểm giả 3 học sinh `HS-001..003` với điểm từng chủ đề.
3. Nhật ký lớp giả: "9A tuần 3: nhiều em nhầm bit và byte".
4. Biên bản họp giả: "Tổ Tin học chọn 2 đề thi thử Tin 8, Tin 9".
5. Ghi chú công việc giả: "Việc cần làm: nộp hồ sơ cuộc thi trước ngày X".
6. Một đoạn từ `aisgk.md` (tiến độ dự án).

Với mỗi ứng viên: chạy ingest cả 6 tệp, rồi **query** 3 câu ("Em nào yếu chủ đề Mã nhị phân?", "Tuần này tôi cần làm gì?", "Quyết định nào đã chốt về đề thi thử?"), rồi **lint**. Chụp **Graph view** (ảnh).

### Bước 4: báo cáo `docs/handoff/antigravity-claude-bo-nao-thu-2-khao-sat.md`
Với từng ứng viên A, B, C ghi:
- Cài có suôn không (lệnh đã chạy, lỗi nếu có, mất bao lâu). Chạy được trên Windows không?
- Hook/script tự chạy: tên, làm gì, có gọi mạng không.
- Giấy phép (kho A không hiện giấy phép: kiểm tra thật).
- Kết quả 6 tệp: số trang AI tạo, liên kết `[[...]]` có đúng không, có bịa thông tin không (đối chiếu tệp nguồn), `index.md`/`log.md` có cập nhật không.
- Kết quả 3 câu hỏi: đúng/sai, có dẫn nguồn không.
- Số lượt/token ước tính cho mỗi lần nạp một tệp (để thầy biết chi phí).
- Ảnh Graph view.
- Rủi ro riêng tư: dữ liệu đi đâu khi AI đọc (nhà cung cấp mô hình nào), có tệp nào bị ghi ngoài vault.
- **Đề xuất một** ứng viên (hoặc "tự viết CLAUDE.md theo Karpathy, không dùng kho nào") kèm lý do ngắn.

## Định hướng cho giai đoạn sau (chưa làm, chờ báo cáo)
- **Cấu trúc kho đề xuất:** `raw/` (hộp thư đến), `wiki/hoc-sinh/` (mỗi em một trang), `wiki/lop/`, `wiki/chu-de/` (Mã nhị phân…), `wiki/cong-viec/`, `wiki/du-an/` (AI Học tập, cuộc thi), `wiki/quyet-dinh/`, `index.md`, `log.md`, `CLAUDE.md`.
- **Nguồn học sinh:** báo cáo tuần của Bộ não AI (VPS) và bảng KetQua/NaoAI trong Google Sheet, xuất thành tệp văn bản hằng tuần vào `raw/`, không nối thẳng vào Firebase.
- **Nguồn công việc:** `aisgk.md`, thư mục `docs/handoff/`, nhật ký git, ghi chú tay của thầy, kẹp web bằng Obsidian Web Clipper (đổi nơi lưu thành `raw/`).
- **Riêng tư (quan trọng):** vault để **trên máy thầy, không đồng bộ lên kho công khai**. Học sinh dùng **mã ẩn danh** (HS-001…); bảng đối chiếu mã ↔ tên để **ngoài** vault, không bao giờ cho AI đọc. Giống cách Bộ não AI hiện tại đã làm (HS1, HS2…).
- **"Cấm rắc rối":** thầy chỉ cần 3 việc: thả tệp vào `raw/`, nói "nạp", hỏi bất cứ gì.

## Khi xong
Dán cho Claude: "Đọc AGENTS.md và docs/handoff/antigravity-claude-bo-nao-thu-2-khao-sat.md rồi làm theo."

## Nguồn
- https://github.com/AgriciDaniel/claude-obsidian
- https://github.com/NicholasSpisak/second-brain
- https://github.com/julianoczkowski/karpathy-llm-wiki
- https://github.com/Ar9av/obsidian-wiki
