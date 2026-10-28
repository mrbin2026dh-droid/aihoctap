# Antigravity → Claude & Thầy: Chuẩn bị & Kịch bản tự động cài Bộ não AI lên VPS (28/10)

## 1. Kết quả kiểm tra & chuẩn bị hạ tầng Bộ não AI hiện có (Python)
- **Mã nguồn `brain/`**: Đã kiểm tra cấu trúc (sources.py, analyze.py, report.py, store.py, config.py, __main__.py), tất cả unittests trong `brain/tests/test_brain.py` đều đạt **7/7 PASS**.
- **Đồng bộ Cloudflare Worker Secret**: Đã nạp secret `BRAIN_KEY=7ae4e12a355fa61dfade8edb4cbe758e355bcbf317b02902` lên Worker live `aihoctap-gate`. Đã đo đạc thực tế gọi endpoint `/api/brain/export` với header `X-Brain-Key` và User-Agent: API trả về **HTTP 200** `{"items":[]}` thành công 100%.
- **Kịch bản tự động 1 lệnh `setup.sh`**: Đã viết tại `brain/deploy/setup.sh` và đẩy lên `origin/main` (commit `15d3314`). Thầy cô chỉ cần chạy 1 dòng lệnh duy nhất trên VPS là hoàn tất toàn bộ các bước cấu hình hệ thống, UFW, user `brain`, systemd service & timer 21:00 hàng tối và cronjob sao lưu.
- **Tài liệu hướng dẫn**: Đã cập nhật `docs/huong-dan-vps-bo-nao-ai.md` bổ sung phần cài đặt siêu tốc 1 lệnh.
- **Kiểm thử giao diện**: Chạy `node tests/test_help_widget.cjs` đạt **28/28 PASS** (kiểm chứng khung Trợ giúp nhanh và căn giữa thẻ đăng nhập trên cả mobile và desktop).

## 2. Các bước triển khai thực tế trên VPS dành cho Thầy
Do thông tin đăng nhập VPS thuộc diện bảo mật cá nhân, Thầy có thể chọn 1 trong 2 cách:

### Cách 1: Thầy tự chạy 1 lệnh trên VPS (Khuyên dùng, chỉ mất 1 phút)
1. Thầy thuê VPS Ubuntu 24.04 LTS (gói 1-2 vCPU, 1-2 GB RAM như hướng dẫn).
2. Đăng nhập SSH vào VPS: `ssh root@<IP_VPS>`
3. Dán 1 lệnh duy nhất:
   ```bash
   curl -sSL https://raw.githubusercontent.com/mrbin2026dh-droid/aihoctap/main/brain/deploy/setup.sh | bash
   ```
4. Điền các khóa bí mật vào `/opt/brain/.env`:
   ```bash
   nano /opt/brain/.env
   ```
   - `FB_SECRET`: Lấy tại Firebase Console → Cài đặt dự án → Service accounts → Database secrets.
   - `SHEET_URL` & `SHEET_BRAIN_KEY`: Google Sheet của Thầy → menu Bài thi → Cài khóa Bộ não AI (chép khóa hiện ra) và link /exec.
   - `GEMINI_API_KEY`: Khóa Gemini của Thầy (đã có trong file `.env` cục bộ).
5. Chạy thử nghiệm:
   ```bash
   sudo -u brain python3 -m brain run --dry-run --env /opt/brain/.env
   sudo -u brain python3 -m brain run --env /opt/brain/.env
   ```

### Cách 2: Antigravity cài đặt trực tiếp
Nếu Thầy cung cấp địa chỉ IP của VPS và mật khẩu/khóa SSH (hoặc mở phiên SSH), Antigravity sẽ kết nối và thực thi toàn bộ chu trình cài đặt, cấu hình và chạy kiểm thử live tại chỗ cho Thầy.

## 3. Câu hỏi chuyển tiếp đến Thầy (về hạn nộp cuộc thi)
Claude cần Thầy xác nhận:
- **Hạn nộp hồ sơ/sản phẩm cuộc thi "Giáo viên sáng tạo ứng dụng AI 2026" là ngày nào?**
- Để Claude và Antigravity căn chỉnh tiến độ phát triển 2 tính năng sư phạm tiếp theo:
  1. **Phân tích hiểu lầm của học sinh** (Misconception Analysis).
  2. **Ôn tập cách quãng** (Spaced Repetition).
