# Claude → Antigravity: Worker KHÔNG kết nối được agent (14:16) — deploy bản chẩn đoán rồi sửa theo lý do

## Hiện tượng
Thầy bấm Kiểm tra AI: "Bộ não đa agent (VPS): KHÔNG kết nối được". Worker chạy ở IAD (Mỹ).
Từ máy thầy thì `https://agent.aihoctap.online` mở được (DNS + chứng chỉ đúng), tức là lỗi nằm ở **khâu Worker gọi agent**.

**Nghi nhất:** giá trị secret `AGENT_KEY` dán vào Worker không khớp `/opt/agent/.env`. Hay gặp:
- dán cả chữ `AGENT_KEY=` (lệnh `grep ^AGENT_KEY=` in kèm tên biến);
- thừa xuống dòng `\r\n` khi dán trên Windows / PowerShell;
- dán thiếu ký tự.

## Claude đã sửa (đã đẩy)
- Worker tự làm sạch secret:
  - bỏ khoảng trắng / xuống dòng / dấu nháy / tiền tố `AGENT_KEY=` và `AGENT_URL=`;
  - tự thêm `https://`, bỏ `/` cuối.
- **Kiểm tra AI ngay** hiện **lý do cụ thể**:
  - `HTTP 401` (khóa khác nhau);
  - `HTTP 502/503` (Caddy chạy nhưng dịch vụ agent không trả lời);
  - `HTTP 404` (sai địa chỉ);
  - quá thời gian;
  - không kết nối được (DNS / tường lửa);
  - kèm **độ dài khóa ở Worker** (đúng là 64).
- Kiểm thử: `test_agent_bridge` 15 ca (thêm: secret dán thừa vẫn chạy, khóa sai báo 401).

## Antigravity làm
1. `git pull` → `npx wrangler deploy`.
2. Nhờ thầy bấm **Kiểm tra AI ngay**, đọc dòng "Lý do: …":
   - **HTTP 401 / độ dài khóa ≠ 64:** trên VPS chạy `sudo sed -n 's/^AGENT_KEY=//p' /opt/agent/.env` (chỉ in giá trị). Chạy `npx wrangler secret put AGENT_KEY`, dán **đúng 64 ký tự**, không kèm gì khác → `npx wrangler deploy`.
   - **HTTP 502/503:** `systemctl status agent`, `journalctl -u agent -n 50` → `systemctl restart agent`.
   - **Không kết nối được / quá thời gian:** `ufw status` (phải mở 443), `journalctl -u caddy -n 50`; kiểm nhà cung cấp VPS có tường lửa riêng chặn kết nối từ nước ngoài (Worker gọi từ Mỹ).
   - **HTTP 404:** `npx wrangler secret put AGENT_URL` = `https://agent.aihoctap.online` (không thêm đường dẫn).
3. Bấm lại cho đến khi hiện "Bộ não đa agent (VPS): đang chạy…".
4. Ghi `docs/handoff/antigravity-claude-agent-ket-noi-xong.md`: lý do đã gặp, đã sửa gì. Không ghi khóa, IP.
