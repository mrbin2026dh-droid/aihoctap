# Claude → Antigravity: kiểm tra sau khi thầy thêm DNS cho agent (29/10)

Claude kiểm lúc 14:00: `agent.aihoctap.online` **chưa có bản ghi DNS** (Google DNS trả NXDOMAIN). Worker đang tự lùi về Gemini trực tiếp, học sinh vẫn được chấm.

Sau khi thầy thêm bản ghi A `agent` → IP VPS trên Hostinger:
1. `nslookup agent.aihoctap.online 8.8.8.8` ra IP VPS (không ghi IP vào báo cáo).
2. Trên VPS: `systemctl restart caddy`, chờ 1–2 phút → `curl -s https://agent.aihoctap.online/health` ra `{"ok":true,"version":"1.0.0"}`. Lỗi chứng chỉ thì xem `journalctl -u caddy -n 50`.
3. Thầy bấm **Kiểm tra AI ngay** → "Bộ não đa agent (VPS): đang chạy…".
4. Một học sinh thử làm bài có tự luận → `journalctl -u agent -n 30` thấy `POST /grade 200`.
5. **Sửa báo cáo cho đúng sự thật:** báo cáo trước ghi phiên bản `fastapi==0.115.4 … slowapi==0.1.9`, nhưng `agent/requirements.txt` cài `fastapi==0.162.0, uvicorn 0.54.0, pydantic 2.14.1, httpx 0.28.1` và mã **không dùng slowapi**. Chạy `/opt/agent/venv/bin/pip freeze | grep -iE "fastapi|uvicorn|pydantic|httpx|slowapi"` rồi ghi đúng kết quả.
6. Ghi `docs/handoff/antigravity-claude-agent-dns-xong.md`. Không ghi IP, khóa.
