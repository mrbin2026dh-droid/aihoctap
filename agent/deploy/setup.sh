#!/usr/bin/env bash
# Cài / cập nhật Bộ não đa agent trên VPS (Ubuntu 24.04). Chạy: sudo bash agent/deploy/setup.sh [tên-miền]
# Mặc định tên miền: agent.aihoctap.online (cần bản ghi A trỏ về VPS trước khi Caddy xin chứng chỉ).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
DOMAIN="${1:-agent.aihoctap.online}"
[ "$(id -u)" -eq 0 ] || { echo "[-] Cần chạy bằng root (sudo)." >&2; exit 1; }

echo "[1/7] Gói hệ thống (python3-venv, caddy)..."
apt update -y
apt install -y python3 python3-venv git curl openssl caddy

echo "[2/7] Người dùng 'brain' và thư mục..."
id -u brain &>/dev/null || useradd --system --create-home --home-dir /opt/brain --shell /usr/sbin/nologin brain
mkdir -p /opt/agent /var/lib/brain
chown -R brain:brain /var/lib/brain

echo "[3/7] Lấy mã nguồn mới nhất..."
rm -rf /tmp/aihoctap-agent
git clone --depth 1 https://github.com/mrbin2026dh-droid/aihoctap.git /tmp/aihoctap-agent
rm -rf /opt/agent/agent
cp -r /tmp/aihoctap-agent/agent /opt/agent/agent

echo "[4/7] Môi trường Python + thư viện (phiên bản cố định)..."
[ -x /opt/agent/venv/bin/python ] || python3 -m venv /opt/agent/venv
/opt/agent/venv/bin/pip install -q --upgrade pip
/opt/agent/venv/bin/pip install -q -r /opt/agent/agent/requirements.txt

echo "[5/7] Tệp cấu hình /opt/agent/.env (giữ nguyên nếu đã có)..."
if [ ! -f /opt/agent/.env ]; then
  cp /opt/agent/agent/.env.example /opt/agent/.env
  sed -i "s|^AGENT_KEY=.*|AGENT_KEY=$(openssl rand -hex 32)|" /opt/agent/.env
  if [ -f /opt/brain/.env ] && grep -q '^GEMINI_API_KEY=.\+' /opt/brain/.env; then
    K=$(grep '^GEMINI_API_KEY=' /opt/brain/.env | head -1 | cut -d= -f2-)
    sed -i "s|^GEMINI_API_KEYS=.*|GEMINI_API_KEYS=${K}|" /opt/agent/.env
    echo "    Đã chép khóa Gemini từ /opt/brain/.env (không in ra màn hình)."
  else
    echo "    [!] Chưa có khóa Gemini: sửa GEMINI_API_KEYS trong /opt/agent/.env rồi: systemctl restart agent"
  fi
fi
chown -R brain:brain /opt/agent
chmod 600 /opt/agent/.env

echo "[6/7] Kiểm thử tự động..."
cd /opt/agent && sudo -u brain /opt/agent/venv/bin/python -W ignore -m unittest agent.tests.test_agent 2>&1 | grep -v LLM_FAIL | tail -3

echo "[7/7] Dịch vụ systemd + HTTPS (Caddy) + tường lửa..."
cp /opt/agent/agent/deploy/agent.service /etc/systemd/system/agent.service
systemctl daemon-reload
systemctl enable --now agent
systemctl restart agent
if ! grep -q "$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
  if grep -qE '^\s*:80\s*\{' /etc/caddy/Caddyfile 2>/dev/null || [ ! -s /etc/caddy/Caddyfile ]; then
    sed "s|agent.aihoctap.online|$DOMAIN|" /opt/agent/agent/deploy/Caddyfile.snippet > /etc/caddy/Caddyfile   # tệp mặc định của gói → thay
  else
    { echo; sed "s|agent.aihoctap.online|$DOMAIN|" /opt/agent/agent/deploy/Caddyfile.snippet; } >> /etc/caddy/Caddyfile
  fi
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null && systemctl reload caddy || systemctl restart caddy
ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
sleep 2
echo "--- /health (trong máy):"; curl -s http://127.0.0.1:8787/health; echo
echo "--- Xong. Việc tiếp theo:"
echo "  1) Chấm thử bằng AI thật:  cd /opt/agent && sudo -u brain venv/bin/python -m agent smoke --env /opt/agent/.env"
echo "  2) Kiểm HTTPS:            curl -s https://$DOMAIN/health"
echo "  3) Worker: npx wrangler secret put AGENT_KEY  (giá trị: sudo grep ^AGENT_KEY= /opt/agent/.env)"
echo "             npx wrangler secret put AGENT_URL  (giá trị: https://$DOMAIN)  → npx wrangler deploy"
