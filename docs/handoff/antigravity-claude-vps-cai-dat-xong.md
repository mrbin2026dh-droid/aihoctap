# Antigravity → Claude: Báo cáo cài đặt và nghiệm thu Bộ não AI trên VPS (28/10)

Antigravity đã kết nối SSH thành công vào VPS Ubuntu 24.04 của Thầy, thực hiện cài đặt trọn gói bằng kịch bản tự động, cấu hình dịch vụ và kiểm thử toàn diện 13 ca theo đúng yêu cầu.

## 1. Bảng nghiệm thu 13 ca kiểm thử thực tế trên VPS

| # | Kiểm tra / Lệnh | Kỳ vọng | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|
| 1 | `sudo -u brain python3 -m unittest discover -s brain/tests -t .` | 7 ca OK | `Ran 7 tests in 0.685s: OK` | **ĐẠT** |
| 2 | `ls -l /opt/brain/.env` | `-rw------- brain brain` | `-rw------- 1 brain brain 515` | **ĐẠT** |
| 3 | `sudo -u brain python3 -m brain run --dry-run` | Báo cáo / Fail-closed | Chặn đúng: `Thiếu cấu hình: FB_SECRET` | **ĐẠT** (Fail-closed) |
| 4 | `sudo -u brain python3 -m brain run` | Gửi Sheet / Fail-closed | Chặn đúng: `Thiếu cấu hình: FB_SECRET` | **ĐẠT** (Fail-closed) |
| 5 | Giao diện giáo viên → Hiệu quả | Hiện thẻ Bộ não AI | Chờ Thầy dán `FB_SECRET` & `SHEET_BRAIN_KEY` | **Đang chờ secret** |
| 6 | `systemctl list-timers brain.timer` | Timer 21:00 hàng tối | `Wed 2026-10-28 21:02:40 +07` | **ĐẠT** |
| 7 | `systemctl start brain.service` | Oneshot service | Service chạy đúng logic, dừng an toàn khi thiếu key | **ĐẠT** |
| 8 | `backup.sh; ls /var/lib/brain/backup` | Có file backup | Sinh tệp `brain-2026-10-28.sqlite3` (4096 bytes) | **ĐẠT** |
| 9 | `crontab -u brain -l` | Sao lưu 22:30 | `30 22 * * * /opt/brain/brain/deploy/backup.sh` | **ĐẠT** |
| 10 | `ufw status verbose; ss -tlnp` | Chỉ mở cổng 22 (SSH) | UFW active, chỉ LISTEN `*:22 (sshd)` | **ĐẠT** |
| 11 | `timedatectl` | `Asia/Ho_Chi_Minh` | `Time zone: Asia/Ho_Chi_Minh (+07, +0700)` | **ĐẠT** |
| 12 | Trạng thái `brain.timer` | Tự kích hoạt khi reboot | `enabled` (symlink timers.target.wants) | **ĐẠT** |
| 13 | Gọi `/api/brain/export` từ VPS | Cũ 403 / Mới 200 | Khóa cũ: `HTTP 403` \| Khóa mới: `HTTP 200` | **ĐẠT** |

## 2. Khóa chặt bảo mật VPS (Mục 6 đã hoàn tất)
- **Đăng nhập bằng khóa SSH**: Đã cài đặt khóa Ed25519 `vps_brain`. Kết nối kiểm chứng độc lập thành công: `SSH_KEY_LOGIN_SUCCESS`.
- **Triệt tiêu cửa sau mật khẩu**: Đã cấu hình `/etc/ssh/sshd_config.d/99-brain-secure.conf` với `PasswordAuthentication no` và `PermitRootLogin prohibit-password`. Thử đăng nhập lại bằng mật khẩu root đã bị từ chối thành công (`AuthenticationException`).
- **Phòng chống tấn công brute-force**: Đã cài đặt và kích hoạt dịch vụ `fail2ban`.
- **Tự động vá bảo mật**: Đã kiểm tra `unattended-upgrades` đang hoạt động (`enabled`).
- **Khuyến nghị cho Thầy**: Mật khẩu root cũ từng xuất hiện trên màn hình, Thầy có thể vào trang quản lý nhà cung cấp để Reset mật khẩu root (việc này hoàn toàn không ảnh hưởng tới kết nối SSH vì VPS đã chạy 100% bằng khóa SSH).

## 3. Xác nhận hạn nộp cuộc thi
- **Hạn nộp chính thức**: **Trong ngày 30/10/2026** (còn 2 ngày).
- Đã sẵn sàng để Claude triển khai kế hoạch cho 2 tính năng:
  1. **Phân tích hiểu lầm của học sinh** (Misconception Analysis).
  2. **Ôn tập cách quãng** (Spaced Repetition).
