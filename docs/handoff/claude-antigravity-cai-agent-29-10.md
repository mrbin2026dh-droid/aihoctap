# Claude → Antigravity: CÀI ĐẶT + KIỂM TRA Bộ não đa agent trên VPS (29/10 chiều)

Tệp này thay cho `claude-antigravity-agent-vps-29-10.md`: Claude đã viết xong mã, không chỉ chuẩn bị.
Thiết kế chi tiết: `docs/ke-hoach/bo-nao-agent-ai.md`.

## 1. Claude đã viết (đã đẩy GitHub)
**Thư mục `agent/`** (Python 3.12, FastAPI, Pydantic, httpx; phiên bản cố định trong `agent/requirements.txt`):

| Tệp | Việc |
|---|---|
| `llm.py` | Gọi Gemini với **nhiều khóa** + **mô hình dự phòng** (+ tùy chọn nhà cung cấp tương thích OpenAI). 429 → khóa nghỉ 60 giây; khóa sai → nghỉ 10 phút; 404 → mô hình kế; 5xx → thử lại. Đầu ra JSON kiểm bằng Pydantic, sai khuôn thì gọi lại một lần kèm lỗi. Không ghi khóa vào nhật ký |
| `rubric.py` | Tách gợi ý của giáo viên thành từng ý có điểm: đọc bằng luật ("(0,5đ)", "Ý 1: … (1 điểm)"), chia đều theo gạch đầu dòng, hoặc nhờ AI khi là đoạn văn. Lưu lại theo câu |
| `grading.py` | **Agent Chấm tự luận**: lọc bài trống / ký tự lặp (không tốn AI) → chấm từng ý **bắt buộc trích nguyên văn bằng chứng** → **máy kiểm bằng chứng** (trích bịa = 0 điểm) → **chấm 3 lần, lấy trung vị**, lệch > 25% thì **"thầy cô sẽ xem lại"** → dùng bài giáo viên đã sửa điểm làm ví dụ mẫu |
| `verify.py` | **Agent Kiểm đề**: một agent khác tự giải câu trắc nghiệm AI soạn (không thấy đáp án); ra khác đáp án, câu mơ hồ, trùng phương án → loại kèm lý do |
| `server.py` | `/health` (công khai, không lộ cấu hình); `/grade`, `/correct` (giáo viên sửa điểm → ví dụ mẫu), `/verify-questions`, `/status`: bắt buộc tiêu đề `X-Agent-Key` |
| `__main__.py` | `python -m agent serve` / `smoke` (chấm 1 bài MẪU + 1 bài tấn công bằng AI thật) / `eval FILE.jsonl` (đo trên bộ bài chuẩn) |
| `deploy/` | `setup.sh` (cài tự động), `agent.service` (systemd, user `brain`, giới hạn 450 MB RAM), `Caddyfile.snippet` (HTTPS) |
| `tests/test_agent.py` | 20 ca (AI giả lập): luật tách tiêu chí, kiểm bằng chứng, bỏ phiếu, chống bịa, đổi khóa/mô hình, lỗi vùng, khóa bảo vệ, học từ giáo viên, kiểm đề |

**Worker** (cần deploy):
- **AI chấm tự luận:** có `AGENT_URL` + `AGENT_KEY` thì chấm qua agent. Agent lỗi hoặc chậm > 28 giây thì tự dùng đường cũ (Gemini trực tiếp), học sinh không bị ảnh hưởng. Không gửi tên học sinh.
- **AI soạn câu hỏi:** agent kiểm đề tự giải lại, loại câu sai đáp án. Giáo viên thấy dòng "Agent kiểm đề đã … loại N câu".
- **Kiểm tra AI ngay:** hiện thêm trạng thái Bộ não agent (phiên bản, mô hình, số khóa, số câu chấm 24 giờ, số câu cần giáo viên xem lại).
- Kiểm thử: `test_agent_bridge` 12 ca. Hồi quy đạt: essay 21, gemini_recovery 15, teacher AI 22, tutor, gate, guardrails, key pool, phạm vi giáo viên, đa tên miền; giao diện: shell, thi 136, tự luận 70.

## 2. Antigravity làm (đúng thứ tự)
1. **DNS:** tại nơi thầy mua tên miền, thêm bản ghi **A** `agent` → IP VPS. Kiểm: `nslookup agent.aihoctap.online` ra đúng IP (không ghi IP vào báo cáo).
2. **VPS** (root):
   ```bash
   cd /tmp && rm -rf aihoctap && git clone --depth 1 https://github.com/mrbin2026dh-droid/aihoctap.git
   sudo bash /tmp/aihoctap/agent/deploy/setup.sh agent.aihoctap.online
   ```
   - Bước [6/7] phải in `OK` (20 ca).
   - `/health` in `{"ok":true,"version":"1.0.0"}`.
   - Script tự tạo `AGENT_KEY` và chép khóa Gemini từ `/opt/brain/.env` nếu có. Không có thì sửa `GEMINI_API_KEYS=` trong `/opt/agent/.env`, dán **khóa AI Studio** (nên dán cả 2 khóa đang có trong kho, cách nhau dấu phẩy), rồi `systemctl restart agent`.
   - Mô hình dự phòng: đặt `GEMINI_FALLBACK_MODEL=` một tên mô hình có thật (nếu không chắc thì để trống).
3. **Chấm thử bằng AI thật** (bài mẫu do Claude viết, không phải bài học sinh):
   ```bash
   cd /opt/agent && sudo -u brain venv/bin/python -m agent smoke --env /opt/agent/.env
   ```
   Mong đợi: bài tốt ≥ 0,75/1 điểm, có trích bằng chứng; **bài tấn công = 0**; cuối dòng `SMOKE OK`. Chép kết quả vào báo cáo (không có khóa).
4. **HTTPS:** `curl -s https://agent.aihoctap.online/health` ra `{"ok":true,...}`. Lỗi chứng chỉ: chờ DNS rồi `systemctl restart caddy`.
5. **Worker:**
   ```bash
   git pull
   sudo grep ^AGENT_KEY= /opt/agent/.env      # lấy giá trị (trên VPS), KHÔNG dán vào báo cáo
   npx wrangler secret put AGENT_KEY            # dán giá trị trên
   npx wrangler secret put AGENT_URL            # https://agent.aihoctap.online
   npx wrangler deploy
   ```
6. **Kiểm toàn tuyến:**
   - Thầy bấm **Kiểm tra AI ngay** → dòng "Bộ não đa agent (VPS): đang chạy…".
   - Một tài khoản học sinh thử làm bài thi thử có tự luận → có điểm + nhận xét.
   - Trên VPS: `journalctl -u agent -n 30` thấy `POST /grade 200`.
   - Giáo viên dùng "AI soạn câu hỏi" → thông báo có dòng "Agent kiểm đề…".
7. **Nếu agent lỗi:** học sinh vẫn được chấm bằng đường cũ. Muốn tắt hẳn agent thì `npx wrangler secret delete AGENT_URL` → deploy.

## 3. Báo cáo
Ghi `docs/handoff/antigravity-claude-cai-agent-xong.md`:
- kết quả từng bước (số ca kiểm thử, `/health`, kết quả `smoke`, HTTPS, Kiểm tra AI, một lần chấm thật);
- RAM khi agent chạy (`systemctl status agent` dòng Memory).

**Không ghi IP, khóa, mật khẩu, tên/mã học sinh, nội dung bài học sinh.**

## 4. Việc của thầy sau khi cài (để đo, đưa vào minh chứng)
- Chọn 60–100 bài tự luận thật đã có, chấm tay từng câu. Tạo tệp `chuan.jsonl` **trên VPS** (mỗi dòng: câu hỏi, gợi ý, điểm tối đa, bài làm, điểm giáo viên).
- Chạy `sudo -u brain /opt/agent/venv/bin/python -m agent eval chuan.jsonl --env /opt/agent/.env`.
- Kết quả gồm lệch trung bình, tỉ lệ lệch > 0,5 điểm, tỉ lệ chuyển giáo viên, bài tấn công. **Chỉ ghi số liệu thật vào báo cáo.**
