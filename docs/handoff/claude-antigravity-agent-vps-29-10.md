# Claude → Antigravity: (1) deploy sửa chấm tự luận, (2) chuẩn bị VPS cho Bộ não đa agent

## Phần 1 — Làm ngay: deploy Worker
AI đã chấm được sau khi đặt Worker chạy ở Mỹ: bài 12:42, 12:49, 12:56 có điểm và nhận xét. Hai việc còn lại Claude đã sửa và đẩy:
- **Bài chỉ có ký tự lặp** (vd "AAAAAAAA…"): Worker chấm 0 ngay, không tốn lượt AI. Nhận xét đúng sự thật ("chỉ có ký tự lặp lại…"), thay cho câu AI viết "em để trống".
- **App:** ô nhận xét AI trong chế độ tối bị chữ trắng trên nền sáng, gần như không đọc được. Đã đổi sang màu theo giao diện sáng/tối (Pages tự phát hành).
- Kiểm thử: `test_essay_ai` 21 ca, `test_gemini_recovery` 15 ca.

Làm: `git pull` → `npx wrangler deploy`. Nhờ thầy bấm **Kiểm tra AI ngay** một lần, xác nhận có mã 200 và dòng "gọi Google từ" không phải HKG.

## Phần 2 — Chuẩn bị VPS (CHƯA cài mã agent; Claude viết mã sau 30/10)
Đọc `docs/ke-hoach/bo-nao-agent-ai.md` mục 3 và 5. Trên VPS:
1. **Báo cấu hình:** `nproc`, `free -h`, `df -h /`, `lsb_release -a`, quốc gia đặt máy (`curl -s https://ipinfo.io/country`; **không ghi IP vào báo cáo**).
2. **Cài:**
   - `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - `uv python install 3.12`
   - tạo `/opt/agent` (chủ sở hữu là user chạy dịch vụ Bộ não);
   - `cd /opt/agent && uv venv --python 3.12 && uv pip install "fastapi" "uvicorn[standard]" "pydantic-ai-slim[google,openai]" "httpx"`
   - ghi phiên bản cài được vào báo cáo.
3. **Kiểm VPS gọi được Gemini** (VPS ở Việt Nam thì không bị chặn vùng như Hong Kong):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -H "x-goog-api-key: $GEMINI_KEY" -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"OK"}]}]}' \
     https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent
   ```
   Kết quả mong muốn: 200. Lấy khóa từ `.env` của Bộ não nếu có, hoặc khóa AI Studio thầy cung cấp. **Không in khóa ra màn hình hay báo cáo.**
4. **HTTPS cho dịch vụ agent:**
   - DNS: bản ghi **A** `agent.aihoctap.online` → IP VPS (tại nơi thầy mua tên miền).
   - Cài Caddy (gói chính thức), `/etc/caddy/Caddyfile`:
     ```
     agent.aihoctap.online {
         reverse_proxy 127.0.0.1:8787
     }
     ```
   - `ufw allow 80,443/tcp` (giữ cổng SSH). **Không** mở cổng 8787 ra ngoài.
   - Kiểm: `curl -I https://agent.aihoctap.online` trả 502 là đúng (chưa có dịch vụ), chứng chỉ hợp lệ.
5. **Tạo khóa bảo vệ** giữa Worker và VPS:
   - `openssl rand -hex 32`, lưu vào `/opt/agent/.env` dạng `AGENT_KEY=...` (quyền 600);
   - `npx wrangler secret put AGENT_KEY` cùng giá trị.
   - **Không ghi khóa vào kho hay báo cáo.**
6. **Không** cài Ollama hay mô hình tại chỗ (VPS 2 GB không đủ). Chỉ ghi lại: nếu thầy nâng VPS ≥ 16 GB thì sẽ cân nhắc.

## Báo cáo
Ghi `docs/handoff/antigravity-claude-agent-vps-xong.md`:
- kết quả Phần 1 (mã Kiểm tra AI, nơi gọi Google);
- cấu hình VPS, phiên bản Python / uv / pydantic-ai / fastapi;
- mã HTTP khi VPS gọi Gemini;
- `https://agent.aihoctap.online` có chứng chỉ chưa;
- đã đặt `AGENT_KEY` ở cả hai nơi chưa.

**Không ghi IP, mật khẩu, khóa, tên/mã học sinh.**
