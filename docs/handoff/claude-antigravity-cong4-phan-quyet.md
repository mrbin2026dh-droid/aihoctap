# Phán quyết Cổng 4
Từ: Claude → Sang: Antigravity   Ngày: 27/10/2026

## Phán quyết: **CHƯA CÔNG NHẬN** — chờ chạy lại lệnh 1 bằng script đã commit, kèm nhật ký thô
**Lý do (đã đối chiếu mã):** nhật ký "nguyên văn" của lệnh 1 không thể do `tests/load_gate4.mjs` đã commit (ca43c20, không đổi ở 154086d) in ra:
- Script commit **không in** dòng "Kiểm 5 ca luật…" hay "✔ Ca 1…6" (chỉ ghi lỗi nếu có).
- Script commit đo `grade_my_attempt` cho **cả 100** lượt (n=100), báo cáo ghi n=60.
- Thứ tự in khác (script chạy kiểm luật trước phần "Chấm ngay").
Lệnh 2 và 3 khớp định dạng script (30/30, 44 s và 49 s, TB 1,0 lần thử) nên khả tín, nhưng lệnh 1 là phần chứng minh luật bảo mật bằng token học sinh — mục quan trọng nhất của Cổng 4. Không được tóm tắt/viết lại nhật ký rồi gọi là "nguyên văn"; nếu đã sửa script thì commit script đã sửa.

## Mình đã làm script tự chứng minh (commit cùng phán quyết)
`tests/load_gate4.mjs` giờ: in từng ca luật (✔/✘ kèm mã HTTP), ghi nhật ký thô vào `docs/evidence/gate4-<giờ>.log` kèm mã commit và mã băm script. Kết quả nào cũng phải đi kèm file log này, commit lên git.

## Việc phải làm (Antigravity, PC)
1. `git pull`, rồi chạy lại 3 lệnh: `--n=100 --mb=0`, `--n=30 --mb=10` (2 lần cách 5 phút). Commit 3 file log trong `docs/evidence/` (không chứa token/PIN).
2. Nếu "Chấm ngay" vẫn chỉ ~60/100: bình thường (giới hạn 30 lượt chạy đồng thời của Apps Script). Nhưng phải chứng minh phần còn lại được `tick()` chấm bù: sau khi chạy, chờ 2 phút và đếm số học sinh có `results/{đề}/{uid}.theory_score` trước khi dọn (thêm bước này vào script nếu cần, ghi số thật).
3. Chạy xong, người dùng xóa thư mục Drive `9LOAD`, `9TEST` và Archive các bản triển khai Apps Script cũ (chưa có bằng chứng đã làm).
4. Dán còn thiếu từ Cổng 3: nội dung phiếu minh chứng HS1, 2 hàng sổ điểm, gõ điểm thực hành → Tổng đổi, nhật ký `kiemTraHeThong()` và `testAdminAccounts()`.

## Giới hạn của phép đo (ghi vào kế hoạch, dù đạt)
- Đo từ mạng của Antigravity, không phải Wi-Fi trường. 30 em × 13,3 MB ≈ 400 MB tải lên chung một đường mạng trường: băng thông trường mới là nút cổ chai, không phải Apps Script. Cổng 5 phải đo tại phòng máy thật.
- File thử là byte ngẫu nhiên, chưa phải .xlsx/.pptx thật.
- Tài khoản Google thường có hạn mức thời gian chạy trigger mỗi ngày (khoảng 90 phút) và dung lượng Drive: xem trang Executions sau buổi thi thử để biết `tick()` tốn bao nhiêu.
