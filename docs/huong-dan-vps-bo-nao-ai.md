# Hướng dẫn cài Bộ não AI trên VPS (Python)

## Bộ não AI làm gì
Mỗi tối lúc 21:00, máy chủ riêng của thầy cô làm 4 việc:
1. **Thu thập** dữ liệu học tập: Bản đồ năng lực, bài thi, phần trăm đọc bài (từ Firebase), và các câu học sinh hỏi Gia sư AI (từ Worker).
2. **Ghi nhớ lâu dài** vào cơ sở dữ liệu SQLite trên VPS. Firebase chỉ giữ trạng thái mới nhất, còn bộ não giữ lại cả quá khứ nên thấy được em nào tiến bộ, em nào sa sút.
3. **Phân tích** từng lớp bằng máy tính, không dùng AI:
   - xu hướng từng chủ đề so với tuần trước;
   - học sinh cần chú ý: năng lực dưới 50%, điểm giảm mạnh, thi thử thấp, hay xin đáp án, 7 ngày không học;
   - học sinh hay hỏi gì: các cụm từ hỏi nhiều nhất, bài được hỏi nhiều.
4. **Gemini viết báo cáo tuần** cho giáo viên, rồi gửi vào Google Sheet (trang **NaoAI**). Thầy cô xem ở trang giáo viên → **Hiệu quả → Bộ não AI: báo cáo tuần**.

**An toàn:**
- VPS **chỉ gọi ra ngoài**, không mở cổng nào ngoài SSH.
- Không cần tên miền, không cần chứng chỉ HTTPS.
- Học sinh không phụ thuộc VPS: VPS tắt thì học, thi, Gia sư AI vẫn chạy bình thường.

## 0. Chọn VPS
- Hệ điều hành **Ubuntu 24.04 LTS** (không chọn Windows), 1 vCPU, 1 GB RAM, ổ 20 GB là đủ. Gói 2 vCPU / 2 GB / 30 GB càng thoải mái. Nên chọn máy đặt ở Việt Nam hoặc Singapore.
- Cần: quyền `root` qua SSH, địa chỉ IPv4 công khai, cho phép kết nối HTTPS ra ngoài.
- Giá VPS nhỏ thường khoảng một trăm đến vài trăm nghìn đồng/tháng tùy nhà cung cấp. Thầy cô xem giá hiện tại trước khi đăng ký.
- Sau khi mua, nhà cung cấp gửi địa chỉ IP và mật khẩu `root`.

## 1. Đăng nhập an toàn bằng khóa SSH (trên máy tính của thầy cô)
```bash
ssh-keygen -t ed25519            # nhấn Enter để chấp nhận mặc định
ssh-copy-id root@ĐỊA_CHỈ_IP      # nhập mật khẩu root một lần
ssh root@ĐỊA_CHỈ_IP              # từ giờ đăng nhập không cần mật khẩu
```
Tắt đăng nhập bằng mật khẩu: trong tệp `/etc/ssh/sshd_config`, đặt `PasswordAuthentication no`, sau đó chạy `systemctl restart ssh`.

## Cách cài siêu tốc 1 lệnh (Khuyên dùng)
Sau khi SSH vào VPS với quyền 
oot, thầy cô chỉ cần dán đúng 1 dòng lệnh này:
`ash
curl -sSL https://raw.githubusercontent.com/mrbin2026dh-droid/aihoctap/main/brain/deploy/setup.sh | bash
`
Script sẽ tự động thực hiện từ Bước 2 đến Bước 7:
- Cập nhật gói và cài đặt python3, sqlite3, git, ufw, unattended-upgrades.
- Đặt múi giờ Asia/Ho_Chi_Minh và kích hoạt tường lửa chỉ mở SSH.
- Tạo người dùng riêng rain, tải mã nguồn từ GitHub, chạy bộ kiểm thử đạt 7/7 OK.
- Kích hoạt systemd timer chạy định kỳ 21:00 mỗi tối và cronjob sao lưu lúc 22:30.
- Tạo sẵn tệp /opt/brain/.env với WORKER_URL và BRAIN_KEY đã được điền sẵn.
Thầy cô chỉ cần làm tiếp **Bước 4 (điền các khóa bí mật)** và **Bước 5 (chạy thử)**.

---

## 2. Cập nhật và khóa máy chủ (cài thủ công từng bước)
```bash
apt update && apt -y upgrade
apt -y install python3 sqlite3 git ufw unattended-upgrades
timedatectl set-timezone Asia/Ho_Chi_Minh
ufw allow OpenSSH && ufw --force enable          # chỉ mở cổng SSH
dpkg-reconfigure -plow unattended-upgrades       # chọn Yes: tự cài bản vá bảo mật
```

## 3. Tạo người dùng riêng và cài mã
```bash
useradd --system --create-home --home-dir /opt/brain --shell /usr/sbin/nologin brain
mkdir -p /var/lib/brain && chown brain:brain /var/lib/brain
git clone --depth 1 https://github.com/mrbin2026dh-droid/aihoctap.git /tmp/aihoctap
cp -r /tmp/aihoctap/brain /opt/brain/brain && chown -R brain:brain /opt/brain
cd /opt/brain && sudo -u brain python3 -m unittest discover -s brain/tests -t .   # phải in OK
```
(Nếu kho mã để chế độ riêng tư: tạo deploy key chỉ đọc trên GitHub, hoặc chép thư mục `brain/` lên bằng `scp -r brain root@IP:/opt/brain/`.)

## 4. Khóa bí mật (không gửi qua chat, không đưa lên Git)
| Dòng trong `.env` | Lấy ở đâu |
|---|---|
| `FB_URL`, `FB_SECRET` | Firebase Console → Cài đặt dự án → Service accounts → **Database secrets** (giống khóa đã cài cho Sheet) |
| `WORKER_URL`, `BRAIN_KEY` | Tạo khóa bằng lệnh `openssl rand -hex 24`. Antigravity đặt khóa này cho Worker bằng `npx wrangler secret put BRAIN_KEY` |
| `SHEET_URL`, `SHEET_BRAIN_KEY` | Google Sheet → menu **Bài thi → Cài khóa Bộ não AI** (chép khóa hiện ra), cùng địa chỉ /exec |
| `GEMINI_API_KEY` | Google AI Studio. Nên tạo **khóa riêng** cho bộ não. Để trống thì báo cáo viết theo mẫu, không dùng AI |

```bash
cp /opt/brain/brain/.env.example /opt/brain/.env
nano /opt/brain/.env                       # điền các dòng trên
chown brain:brain /opt/brain/.env && chmod 600 /opt/brain/.env
```

## 5. Chạy thử
```bash
cd /opt/brain
sudo -u brain python3 -m brain run --dry-run --env /opt/brain/.env   # in báo cáo ra màn hình, chưa gửi
sudo -u brain python3 -m brain run --env /opt/brain/.env             # gửi thật → Sheet có trang NaoAI
```
Mở trang giáo viên → **Hiệu quả**: thẻ "Bộ não AI: báo cáo tuần" hiện báo cáo từng lớp.

## 6. Cho chạy tự động mỗi tối
```bash
cp /opt/brain/brain/deploy/brain.service /opt/brain/brain/deploy/brain.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now brain.timer
systemctl list-timers brain.timer          # xem lần chạy kế tiếp
journalctl -u brain -n 50                  # xem nhật ký lần chạy gần nhất
```

## 7. Sao lưu lịch sử học tập (giữ 30 ngày)
```bash
crontab -u brain -e
# thêm dòng: 30 22 * * * /opt/brain/brain/deploy/backup.sh
```
Nên chép thư mục `/var/lib/brain/backup` về máy tính mỗi tháng một lần (`scp -r root@IP:/var/lib/brain/backup .`).

## 8. Cập nhật khi có bản mới
```bash
cd /tmp && rm -rf aihoctap && git clone --depth 1 https://github.com/mrbin2026dh-droid/aihoctap.git
rsync -a --delete /tmp/aihoctap/brain/ /opt/brain/brain/ && chown -R brain:brain /opt/brain
cd /opt/brain && sudo -u brain python3 -m unittest discover -s brain/tests -t .
```

## Sự cố thường gặp
- **"Thiếu cấu hình FB_URL…"**: chưa điền tệp `.env`, hoặc đã điền nhưng sai quyền đọc (cần `chown brain:brain`).
- **"HTTP 401" khi đọc Firebase**: sai `FB_SECRET`.
- **"HTTP 403" ở /api/brain/export**: `BRAIN_KEY` trên VPS khác khóa đặt cho Worker, hoặc Worker chưa được cập nhật bản mới.
- **"Google Sheet từ chối: Khóa Bộ não AI chưa đúng"**: chạy lại menu **Cài khóa Bộ não AI** rồi chép khóa mới vào `SHEET_BRAIN_KEY`.
- **Báo cáo không có phần "Học sinh hay hỏi gì"**: Worker chưa deploy bản mới (bản mới mới ghi câu hỏi), hoặc tuần đó học sinh chưa hỏi Gia sư.
- **Muốn tạm dừng**: `systemctl disable --now brain.timer`. Ứng dụng của học sinh không bị ảnh hưởng.

## Dữ liệu và quyền riêng tư
- Câu hỏi Gia sư được lưu dạng rút gọn (300 ký tự), **không lưu câu trả lời của AI**.
- Báo cáo có tên học sinh nên chỉ giáo viên xem được: trang NaoAI trong Sheet của thầy cô, và trang giáo viên sau khi đăng nhập. Giáo viên lớp chỉ thấy lớp mình.
- Khi gọi Gemini, bộ não **không gửi tên học sinh**: tên được thay bằng HS1, HS2… rồi ghép lại trên VPS sau khi AI viết xong. Chỉ gửi số liệu tổng hợp và vài câu hỏi ví dụ (không có tên).
