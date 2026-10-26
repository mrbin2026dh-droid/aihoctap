# Kiểm định lần 2: kế hoạch v2 + Bước 0 "số thật"
Từ: Claude (Opus 5.5) → Sang: Antigravity & Người dùng   Ngày: 26/10/2026
Đã đọc: docs/handoff/antigravity-claude-buoc0-so-that.md, docs/plans/ke-hoach-chi-tiet-firebase-drive.md (v2), tests/benchmark_auth_concurrency.cjs, tests/test_firebase_rules_step0.cjs.

## Phán quyết
- **Kế hoạch v2 (thiết kế): DUYỆT CÓ ĐIỀU KIỆN.** Đã sửa đúng hướng cả B1–B7 và 12 mục. Điều kiện sửa nhỏ ở mục 3.
- **Bước 0 (số đo): KHÔNG ĐẠT — chưa mở Cổng 1.** Hai "số đo thực tế" quan trọng nhất là mô phỏng, không phải đo:
  1. `benchmark_auth_concurrency.cjs` gọi **máy chủ giả trên localhost** với độ trễ `120 + random*80` ms tự đặt. Bảng 30/50/100 học sinh "100% thành công, p50 ~220 ms" chỉ phản ánh con số tự đặt đó; nó không chạm Firebase, không chạm mạng trường, không thể phát hiện `TOO_MANY_ATTEMPTS_TRY_LATER`.
  2. `test_firebase_rules_step0.cjs` là **bộ mô phỏng luật viết bằng JS**, không chạy công cụ luật của Firebase. "12/12 PASS" chỉ chứng minh bản mô phỏng khớp với ý người viết, không chứng minh luật thật đúng. (Báo cáo ghi 12 ca nhưng liệt kê 16.)
  3. PBKDF2: báo cáo nói 50k vòng = 24,5 ms rồi lại nói "lần đầu ~4 ms" — mâu thuẫn, và không có script trong repo. Claude đo lại trên Node ở máy chủ Claude: **50k vòng ≈ 8,8 ms** (khác runtime Workers). Kết luận vẫn đúng: phải đệm khóa trong isolate.
  4. Các con số "upload 10 MB mất 1,5–2,5 s", "quét 100 bài ~800 ms", "Firebase 100 QPS" không có nguồn hay phép đo.
Claude đã ghi chú đầu hai file mô phỏng để không ai nhầm là số thật. Mô phỏng không sai khi dùng để thử code, nhưng **không được ghi là "đo thực tế"** (AGENTS: không ghi PASS khi chưa kiểm thật).

## Để qua Cổng 0 cần đúng 4 việc thật
1. **Luật trên Emulator thật** (Claude đã viết sẵn, 40 ca): `cd spike/step0/emulator && npm i && npm test` (cần Java 11+). Luật: `spike/step0/database.rules.v2.json` (= luật trong kế hoạch v2, Claude thêm: giáo viên đọc danh sách học sinh, giáo viên tự kiểm `teachers/{uid}`). Dán nguyên kết quả in ra. Ca đáng chú ý nhất: **3.3a giáo viên gia hạn** — nếu Firebase kiểm `.validate` của nút cha khi ghi nút con thì ca này sẽ trượt và phải sửa luật.
2. **Đăng nhập thật** bằng trang `frontend/hoc/spike-step0/` với dự án Firebase thật (Spark), 30/50/100 tài khoản, ở **mạng trường** (hoặc ghi rõ là mạng nhà). Thêm 1 lượt: 10 tài khoản cố tình sai PIN 5 lần rồi đăng nhập đúng 30 tài khoản khác → có bị chặn cả IP không.
3. **Tắt tự đăng ký** trên Console, rồi gọi `accounts:signUp` bằng API key → phải bị từ chối (chụp lỗi).
4. **Apps Script quản trị**: tạo 5 tài khoản bằng `projects/{id}/accounts` và đổi PIN 1 tài khoản bằng `accounts:update` với `ScriptApp.getOAuthToken()` (scope cloud-platform). Ghi được/không được. Nếu không được → dùng phương án Python Admin SDK, nhưng **khóa service account không được commit, không để trên máy học sinh**.
(Tải file 30 × 10 MB đồng thời làm ở Cổng 3 cũng được, nhưng phải đo thật trước Cổng 5.)

## Điều kiện sửa trong kế hoạch v2
1. File thực hành: v2 ghi tối đa **15 MB** — người dùng đã chốt **10 MB**. Sửa về 10 MB (Base64 15 MB sẽ ~20 MB/request, tăng rủi ro Apps Script).
2. `.sb3` (Scratch): thêm mới so với danh sách người dùng chốt → người dùng xác nhận.
3. B4: trước giờ đóng chỉ trả "Đã nhận bài" + điểm tổng; chi tiết đúng/sai do Apps Script ghi vào `results` **sau** `closes_at` — ghi rõ ai/khi nào ghi.
4. Gate 4 "100 học sinh ảo trên mạng trường mô phỏng": ghi rõ đó là kiểm tải phía code; **không thay** buổi thử thật Gate 5.
5. Mục 4 kế hoạch: trỏ luật về `spike/step0/database.rules.v2.json` làm nguồn duy nhất (tránh hai bản lệch nhau).

## Chuyển cho
Antigravity làm 4 việc thật ở trên (cần người dùng tạo/đăng nhập dự án Firebase và tài khoản Google), ghi số nguyên văn vào `docs/handoff/antigravity-claude-buoc0-so-that-v2.md`, rồi chuyển Claude. Không viết mã sản phẩm trước khi Cổng 0 đạt.
