# Bước 0 – bộ kiểm tra kỹ thuật Firebase + Apps Script

Mục đích: lấy số liệu thật trước khi chuyển đường thi khỏi Worker (xem `docs/plans/kien-truc-firebase-drive.md`).
Mọi thứ ở đây là **tạm thời**; xóa sau khi xong (`frontend/hoc/spike-step0/`, `spike/step0/`).

Thành phần:
- `frontend/hoc/spike-step0/` – trang đo (tự lên GitHub Pages, địa chỉ `…/aihoctap/spike-step0/`).
- `spike/step0/database.rules.merged.json` – quy tắc hiện tại **cộng thêm** nhánh `spike`; dùng khi thử trên dự án thật. `database.rules.spike-only.json` chỉ có nhánh `spike`, dùng cho **dự án Firebase thử riêng** (khuyên dùng: không đụng dữ liệu thật).
- `spike/step0/apps-script/` – `Code.gs` và `appsscript.json` cho dự án Apps Script thử.
Hướng dẫn chạy và mẫu báo cáo: `docs/handoff/claude-antigravity-buoc0-firebase-drive.md`.
