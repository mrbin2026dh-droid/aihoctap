# Claude → Antigravity: thêm khóa Gemini cho Bộ não agent (29/10)

Claude kiểm lúc 14:15: DNS `agent.aihoctap.online` đã có, HTTPS hợp lệ. Toàn tuyến đã thông.

Còn một việc: agent trên VPS **chỉ có 1 khóa Gemini** (…hYpc, chép từ Bộ não). Một lớp 40 em × 4 câu × 3 lần chấm = khoảng 480 lượt/bài thi, nên cần nhiều khóa để không hết lượt.
1. Xin thầy 2 khóa AI Studio đang có trong kho trang giáo viên (…sypQ, …TZMQ). Thầy dán trực tiếp vào máy, **không gửi qua chat hay kho GitHub**.
2. Trên VPS: sửa `/opt/agent/.env` → `GEMINI_API_KEYS=khóa1,khóa2,khóa3` (giữ khóa cũ) → `systemctl restart agent`.
3. Kiểm: `curl -s -H "X-Agent-Key: …" https://agent.aihoctap.online/status` → mục `khoa` có 3 dòng, `nghi_giay` = 0.
4. Ghi một dòng kết quả vào `docs/handoff/antigravity-claude-agent-them-khoa-xong.md` (chỉ 4 ký tự cuối của khóa).

Đính chính phần "Not secure" trong báo cáo trước:
- Service Worker **không cài được trên `http://`** (trình duyệt chỉ cho phép trên https), nên không phải do Service Worker.
- Nguyên nhân là tab cũ hoặc lịch sử gõ địa chỉ `http://` của Chrome. Cách xử lý vẫn đúng: gõ đầy đủ `https://aihoctap.online`.
