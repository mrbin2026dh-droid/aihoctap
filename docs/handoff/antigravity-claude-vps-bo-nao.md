# Antigravity → Claude: Đã xoay BRAIN_KEY an toàn, tạo khóa SSH & xác nhận hạn cuộc thi 30/10/2026 (28/10)

## 1. Xoay BRAIN_KEY khẩn cấp (Mục 0 đã hoàn tất 100%)
- **Đã tạo khóa mới**: Sử dụng `secrets.token_hex(24)` ngẫu nhiên an toàn trên máy Thầy. Không in ra chat, không commit lên Git.
- **Cập nhật Worker**: Đã gọi `npx wrangler secret put BRAIN_KEY` đẩy khóa mới lên Cloudflare Worker `aihoctap-gate`.
- **Kiểm chứng độc lập thực tế**:
  + Gọi `/api/brain/export` với khóa CŨ: trả về **HTTP 403 Forbidden** (khóa cũ đã bị vô hiệu hóa hoàn toàn).
  + Gọi `/api/brain/export` với khóa MỚI: trả về **HTTP 200 OK** `{"items":[]}` (kết nối trực tiếp thành công).
- **Cập nhật `.env` cục bộ**: Đã lưu khóa mới vào `brain/.env` (tệp này nằm trong `.gitignore`, an toàn tuyệt đối).

## 2. Chuẩn bị đăng nhập SSH không mật khẩu (Mục 2)
- Đã sinh cặp khóa SSH Ed25519 riêng cho VPS tại máy Thầy:
  + Khóa riêng: `~/.ssh/vps_brain`
  + Khóa công khai: `~/.ssh/vps_brain.pub`
- Thầy chỉ cần gõ đúng 1 dòng lệnh dưới đây để đưa khóa vào VPS (nhập mật khẩu root 1 lần duy nhất):
  ```powershell
  Get-Content "$env:USERPROFILE\.ssh\vps_brain.pub" | ssh root@<IP_VPS> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
  ```
- Sau khi Thầy gõ lệnh này, Antigravity sẽ tự động dùng khóa `~/.ssh/vps_brain` để SSH vào thực thi toàn bộ 13 ca kiểm thử mà Thầy không cần gõ thêm mật khẩu nào nữa.

## 3. Xác nhận hạn nộp cuộc thi từ Thầy (cho Claude)
- **Hạn nộp chính thức**: **Trong ngày 30/10/2026** (tức là còn đúng **2 ngày**).
- Chuyển tiếp tới Claude: Thầy đã chốt hạn nộp là ngày 30/10/2026 để Claude lập kế hoạch làm 2 tính năng:
  1. Phân tích hiểu lầm của học sinh (Misconception Analysis).
  2. Ôn tập cách quãng (Spaced Repetition).
