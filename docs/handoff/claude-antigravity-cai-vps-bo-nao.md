# Claude → Antigravity: cài đặt và kiểm thử Bộ não AI trên VPS của thầy (28/10)

Thầy đã thuê VPS Ubuntu 24.04 (2 vCPU, 2 GB RAM, 30 GB SSD, đăng nhập `root`). Antigravity cài đặt đầy đủ trên máy ảo này và kiểm thử thật. Đọc kỹ mục 0 trước.

## 0. VIỆC KHẨN: khóa BRAIN_KEY đã lộ, phải xoay trước khi cài
- Khóa `BRAIN_KEY` cũ từng bị ghi cứng trong `brain/deploy/setup.sh` và `docs/handoff/antigravity-claude-vps-bo-nao.md`. Kho GitHub là **công khai** nên coi như khóa đã lộ (lịch sử Git vẫn giữ). Khóa này cho phép đọc nhật ký câu hỏi học sinh hỏi Gia sư qua `/api/brain/export`.
- Claude đã gỡ khóa khỏi mã và tài liệu (commit kèm theo). **Khóa cũ vẫn dùng được trên Worker cho đến khi xoay.**
- Antigravity làm ngay:
  1. Tạo khóa mới trên máy thầy: `openssl rand -hex 24` (hoặc PowerShell tương đương). **Không in ra chat, không ghi vào tệp trong kho.**
  2. Đặt cho Worker: `npx wrangler secret put BRAIN_KEY` (dán khóa mới khi được hỏi).
  3. Kiểm chứng: gọi `/api/brain/export` bằng khóa **cũ** phải trả **403**, bằng khóa **mới** trả **200**.
  4. Giữ khóa mới trong biến tạm của phiên làm việc để chép lên VPS ở mục 3, rồi xóa khỏi lịch sử lệnh.
- Tương tự, **không** dán `FB_SECRET`, `SHEET_BRAIN_KEY`, `GEMINI_API_KEY` vào mã, tài liệu, commit hay chat. Chúng chỉ nằm trong `/opt/brain/.env` trên VPS (quyền 600).

## 1. Thông tin đăng nhập VPS
- Địa chỉ IP, tên đăng nhập `root` và mật khẩu nằm ở trang quản lý của nhà cung cấp. Thầy đã có. **Không ghi IP hay mật khẩu vào kho, tài liệu hay lệnh** (dùng `<IP_VPS>`).
- Mật khẩu root đã từng bị gửi trong khung chat của thầy, nên **coi như đã lộ**: sau khi cài xong phải làm mục 6 (khóa SSH + đổi mật khẩu).
- Cách làm: thầy tự gõ mật khẩu khi `ssh` hỏi (Antigravity không lưu mật khẩu). Nếu Antigravity không mở được phiên SSH tương tác, dừng và hướng dẫn thầy mở terminal tự gõ lệnh theo từng bước dưới đây, rồi dán kết quả về.

## 2. Đăng nhập bằng khóa SSH (làm một lần)
Trên máy thầy:
```
ssh-keygen -t ed25519 -f ~/.ssh/vps_brain -N ""
ssh-copy-id -i ~/.ssh/vps_brain.pub root@<IP_VPS>      # nhập mật khẩu một lần
ssh -i ~/.ssh/vps_brain root@<IP_VPS> "echo ok"        # phải in ok, không hỏi mật khẩu
```
(Windows chưa có `ssh-copy-id`: dùng `type $env:USERPROFILE\.ssh\vps_brain.pub | ssh root@<IP_VPS> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"`.)

## 3. Cài đặt trên VPS
1. Chạy kịch bản (đọc trước khi chạy: `curl -sSL <raw setup.sh>` rồi xem, hoặc `git clone` rồi `bash brain/deploy/setup.sh`):
   ```
   curl -sSL https://raw.githubusercontent.com/mrbin2026dh-droid/aihoctap/main/brain/deploy/setup.sh | bash
   ```
   Kỳ vọng: 6 bước chạy hết, `unittest` in OK (7 ca), cuối cùng liệt kê các dòng `.env` còn trống.
2. Điền `.env` **không qua lịch sử lệnh**: soạn tệp tạm trên máy thầy rồi đẩy bằng
   `ssh -i ~/.ssh/vps_brain root@<IP_VPS> "cat > /opt/brain/.env && chown brain:brain /opt/brain/.env && chmod 600 /opt/brain/.env" < tệp-tạm`, xong xóa tệp tạm.
   Các dòng cần có (mẫu ở `brain/.env.example`):
   - `FB_URL` (giữ nguyên mẫu), `FB_SECRET` (Firebase Console → Cài đặt dự án → Service accounts → Database secrets; nếu máy thầy đã có thì dùng, nếu không thì nhờ thầy tự `nano` dán trên VPS).
   - `WORKER_URL` (đã điền), `BRAIN_KEY` = **khóa mới** ở mục 0.
   - `SHEET_URL` (địa chỉ /exec) và `SHEET_BRAIN_KEY` (Google Sheet → menu Bài thi → Cài khóa Bộ não AI).
   - `GEMINI_API_KEY`: nên tạo **khóa riêng** cho Bộ não (Google AI Studio), không dùng chung khóa của Worker.

## 4. Kiểm thử thật trên VPS (ghi kết quả từng dòng)
| # | Lệnh / việc | Kỳ vọng |
|---|---|---|
| 1 | `sudo -u brain python3 -m unittest discover -s brain/tests -t .` (trong `/opt/brain`) | OK, 7 ca |
| 2 | `ls -l /opt/brain/.env` | `-rw------- brain brain` |
| 3 | `sudo -u brain python3 -m brain run --dry-run --env /opt/brain/.env` | in báo cáo ra màn hình, không lỗi 401/403 |
| 4 | `sudo -u brain python3 -m brain run --env /opt/brain/.env` | gửi thành công; Google Sheet có trang **NaoAI** |
| 5 | Trang giáo viên → Hiệu quả → "Bộ não AI: báo cáo tuần" | hiện báo cáo (có thể "chưa đủ dữ liệu" nếu lớp chưa dùng) |
| 6 | `systemctl list-timers brain.timer` | thấy lần chạy kế tiếp lúc 21:00 |
| 7 | `systemctl start brain.service; journalctl -u brain -n 50 --no-pager` | kết thúc `status=0/SUCCESS`, không in khóa nào |
| 8 | `sudo -u brain /opt/brain/brain/deploy/backup.sh; ls /var/lib/brain/backup` | có tệp `brain-<ngày>.sqlite3` |
| 9 | `crontab -u brain -l` | có dòng sao lưu 22:30 |
| 10 | `ufw status verbose; ss -tlnp` | chỉ mở cổng 22 (SSH); không có cổng nghe nào khác ra ngoài |
| 11 | `timedatectl` | `Asia/Ho_Chi_Minh` |
| 12 | `reboot`, đợi 1 phút, đăng nhập lại, `systemctl list-timers brain.timer` | timer vẫn còn |
| 13 | Gọi `/api/brain/export` bằng khóa cũ / mới | 403 / 200 (mục 0) |

Nếu ca 3 hoặc 4 lỗi: ghi nguyên văn thông báo (đã che khóa), đối chiếu mục "Sự cố thường gặp" của `docs/huong-dan-vps-bo-nao-ai.md`, báo lại, không tự sửa mã Python nếu chưa hỏi Claude.

## 5. Dữ liệu thử
Nếu lớp chưa có dữ liệu thật, báo cáo sẽ ít nội dung. **Không** bơm dữ liệu giả vào Firebase thật. Chỉ kiểm chứng đường truyền (ca 3 đến 5) và để thầy cho lớp dùng vài ngày rồi chạy lại.

## 6. Khóa chặt VPS (sau khi ca 1 đến 13 đạt)
1. Mở thêm một phiên SSH thứ hai bằng **khóa** để đảm bảo không tự khóa mình ngoài.
2. Trong `/etc/ssh/sshd_config` (hoặc `/etc/ssh/sshd_config.d/`): `PasswordAuthentication no`, `PermitRootLogin prohibit-password`. Chạy `sshd -t` (phải không lỗi) rồi `systemctl restart ssh`. Kiểm tra phiên thứ ba vào được bằng khóa và **không** vào được bằng mật khẩu.
3. Cài `fail2ban` (`apt install -y fail2ban`) để chặn dò mật khẩu.
4. Nhắc thầy **đổi (reset) mật khẩu root** trong trang quản lý nhà cung cấp, vì mật khẩu cũ đã lộ qua chat.
5. Kiểm tra `unattended-upgrades` đang bật: `systemctl is-enabled unattended-upgrades`.

## 7. Báo cáo
Ghi `docs/handoff/antigravity-claude-vps-cai-dat-xong.md`: bảng 13 ca (đạt/không, kèm đoạn nhật ký đã che khóa), xác nhận khóa cũ đã vô hiệu, đã khóa SSH, ngày giờ lần chạy timer kế tiếp. **Không** ghi IP, mật khẩu, khóa, hay nội dung `.env`. Cập nhật mục liên quan trong `aisgk.md`.

Dán cho Claude khi xong: "Đọc AGENTS.md và docs/handoff/antigravity-claude-vps-cai-dat-xong.md rồi làm theo."
