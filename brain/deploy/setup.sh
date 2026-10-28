#!/usr/bin/env bash
set -euo pipefail

# Kịch bản cài đặt tự động Bộ não AI (Góc học tập SGK) trên Ubuntu 24.04 LTS
# Sử dụng: sudo bash brain/deploy/setup.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "[-] Lỗi: Cần chạy script bằng quyền root (sudo bash setup.sh)." >&2
  exit 1
fi

echo "[1/6] Cập nhật gói và cài đặt phần mềm cần thiết..."
apt update -y
apt install -y python3 sqlite3 git ufw unattended-upgrades

echo "[2/6] Thiết lập múi giờ Việt Nam và cấu hình tường lửa UFW..."
timedatectl set-timezone Asia/Ho_Chi_Minh
ufw allow OpenSSH
ufw --force enable

echo "[3/6] Tạo người dùng hệ thống 'brain' và phân quyền thư mục dữ liệu..."
id -u brain &>/dev/null || useradd --system --create-home --home-dir /opt/brain --shell /usr/sbin/nologin brain
mkdir -p /var/lib/brain /var/lib/brain/backup /opt/brain
chown -R brain:brain /var/lib/brain /opt/brain

echo "[4/6] Tải/Cập nhật mã nguồn Bộ não AI..."
rm -rf /tmp/aihoctap
git clone --depth 1 https://github.com/mrbin2026dh-droid/aihoctap.git /tmp/aihoctap
rm -rf /opt/brain/brain
cp -r /tmp/aihoctap/brain /opt/brain/brain
chown -R brain:brain /opt/brain

echo "[5/6] Chạy kiểm thử tự động (Unit Tests)..."
cd /opt/brain
sudo -u brain python3 -m unittest discover -s brain/tests -t .

echo "[6/6] Cài đặt dịch vụ systemd (brain.service & brain.timer)..."
cp /opt/brain/brain/deploy/brain.service /opt/brain/brain/deploy/brain.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now brain.timer

# Chuẩn bị tệp .env nếu chưa có
if [ ! -f /opt/brain/.env ]; then
  cp /opt/brain/brain/.env.example /opt/brain/.env
  # Điền sẵn các giá trị mặc định của dự án
  sed -i 's|WORKER_URL=https://ten-worker-cua-ban.workers.dev|WORKER_URL=https://aihoctap-gate.mrbin2026dh.workers.dev|g' /opt/brain/.env
  sed -i 's|BRAIN_KEY=|BRAIN_KEY=7ae4e12a355fa61dfade8edb4cbe758e355bcbf317b02902|g' /opt/brain/.env
  chown brain:brain /opt/brain/.env
  chmod 600 /opt/brain/.env
  echo "[+] Đã tạo /opt/brain/.env mẫu với WORKER_URL và BRAIN_KEY điền sẵn."
fi

# Cài đặt cronjob sao lưu hàng ngày lúc 22:30
(crontab -u brain -l 2>/dev/null | grep -v "backup.sh" || true; echo "30 22 * * * /opt/brain/brain/deploy/backup.sh") | crontab -u brain -

echo "=========================================================="
echo " [OK] Cài đặt hoàn tất!"
echo " Việc tiếp theo của Thầy:"
echo " 1. Điền thông tin bí mật: nano /opt/brain/.env"
echo "    - FB_SECRET (Firebase Database Secret)"
echo "    - SHEET_URL & SHEET_BRAIN_KEY (từ Google Sheet)"
echo "    - GEMINI_API_KEY (khóa Gemini của Thầy)"
echo " 2. Chạy thử nghiệm:"
echo "    sudo -u brain python3 -m brain run --dry-run --env /opt/brain/.env"
echo " 3. Xem nhật ký timer: systemctl list-timers brain.timer"
echo "=========================================================="
