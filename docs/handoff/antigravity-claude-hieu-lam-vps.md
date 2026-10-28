# Antigravity → Claude: Đã cập nhật Bộ não AI (Hiểu lầm phổ biến) lên VPS (28/10)

## 1. Kết quả cập nhật mã nguồn trên VPS
- **Đồng bộ mã mới**: Đã kéo commit `d48e3b4` và chạy kịch bản cập nhật tự động `setup.sh` trên VPS Ubuntu 24.04 (`zcloudviet-rs5k`).
- **Kiểm thử thực tế trên VPS**:
  - Chạy `sudo -u brain python3 -m unittest discover -s brain/tests -t .`
  - Kết quả: **`Ran 8 tests in 0.686s: OK`** (**8/8 PASS**, bao gồm kiểm thử `test_misconceptions` mới).
- **Trạng thái dịch vụ & Bảo mật**:
  - `brain.timer` (21:00 hàng tối) và `backup.sh` (22:30 hàng đêm) duy trì hoạt động tốt.
  - SSH tiếp tục khóa chặt bằng xác thực khóa Ed25519 `vps_brain`, từ chối đăng nhập bằng mật khẩu.

## 2. Trạng thái tệp `/opt/brain/.env` trên VPS
Quét cấu hình thực tế trên VPS (đã che nội dung bí mật):
- `FB_URL`: Đã điền
- `WORKER_URL`: Đã điền
- `BRAIN_KEY`: Đã điền (khóa xoay mới)
- `SHEET_URL`: Đã điền
- `GEMINI_API_KEY`: Đã điền
- `GEMINI_MODEL`: `gemini-3.5-flash`
- `DB_PATH`: `/var/lib/brain/brain.sqlite3`
- `TZ_OFFSET_HOURS`: `7`
- `FB_SECRET`: **Đang chờ Thầy điền**
- `SHEET_BRAIN_KEY`: **Đang chờ Thầy điền**

Khi chạy `sudo -u brain python3 -m brain run --dry-run`, hệ thống dừng an toàn theo đúng luật bất biến (Fail-closed: `Thiếu cấu hình: FB_SECRET`).

## 3. Bước tiếp theo
- Thầy SSH vào VPS qua lệnh không mật khẩu: `ssh -i ~/.ssh/vps_brain root@<IP_VPS>` và mở `nano /opt/brain/.env` để dán 2 khóa:
  + `FB_SECRET`: Firebase Console → Cài đặt dự án → Service accounts → Database secrets.
  + `SHEET_BRAIN_KEY`: Google Sheet của Thầy → menu Bài thi → Cài khóa Bộ não AI.
- Sau khi Thầy lưu xong, Bộ não AI sẽ tự động chạy thu thập, phân tích "Hiểu lầm phổ biến" và gửi báo cáo về trang giáo viên (Hiệu quả → Bộ não AI: báo cáo tuần) mỗi tối lúc 21:00.
