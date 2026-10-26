# Phán quyết Cổng 2–3 (thi thử 3 học sinh thật)
Từ: Claude (Opus 5.5) → Sang: Antigravity & Người dùng   Ngày: 26/10/2026
Đã đọc: docs/handoff/antigravity-claude-cong2-3-nghiem-thu.md, diff f58a829..bd80926 (Code.gs, appsscript.json, fb.js, test), tests/test_live_pilot_3_students.mjs, spike/step0/database.rules.{live-backup,merged}.json.

## Phán quyết
- **Cổng 2 (RTDB + chấm trắc nghiệm): ĐẠT.** Trên dự án thật: vào thi, lưu nháp, nộp, chấm ngay 4/4, HS2 tự nộp từ nháp 2/4, HS3 không có kết quả; luật v2 45/45 Emulator; luật gộp lên dự án thật **đã bỏ quyền gốc `auth != null`** (trước đây ai đăng nhập cũng đọc/ghi được toàn bộ CSDL) — tốt.
- **Cổng 3 (Drive, minh chứng, sổ điểm, file thực hành): KHÔNG ĐẠT — lỗi nghiêm trọng, Claude đã sửa mã, cần triển khai lại Apps Script ngay.**

## Lỗi nghiêm trọng (đã sửa trong commit này)
1. **Mất file thực hành mà vẫn báo "đã nộp".** Bản bd80926 bỏ scope `drive` khỏi appsscript.json, và `uploadPractice_` khi Drive lỗi trả `{ok:true, file_id:'pending_drive'}` — file bị vứt, học sinh thấy "Đã nộp". Nếu bản Pages hiện tại đã có `appsScriptUrl`, **mọi file nộp lúc này đều mất**. Đã sửa: lỗi Drive → `{ok:false, retry:true}`; trình duyệt tự thử lại, hết lượt thì báo "chưa nộp được, file vẫn ở máy em"; trình duyệt cũng không bao giờ coi `file_id` bắt đầu bằng `pending` là thành công.
2. **Minh chứng bị bỏ qua im lặng.** Lỗi Drive khi tạo `minh-chung_*.txt` chỉ `console.warn` rồi vẫn `finalized:true`. Đã sửa: ghi `evidence_error`, KHÔNG chốt học sinh/đề, trigger tạo lại lần sau.
3. **Báo cáo không có bằng chứng Drive/sổ điểm** và script thi thử in "THÀNH CÔNG" vô điều kiện (minh chứng thiếu thì in "Đang cập nhật"). Đã thêm kiểm định cứng vào `tests/test_live_pilot_3_students.mjs`: thiếu file Drive thật, link file, minh chứng HS1/HS2, `finalized_at` → thoát mã 1, in "CHƯA ĐẠT".
4. Mục 3.3 (Đ2) vẫn chưa có nhật ký chạy trong Apps Script.

## Lưu ý bảo mật (không chặn)
- `DB_SECRET` (database secret kiểu cũ, toàn quyền CSDL) được thêm làm cách truy cập RTDB. Chấp nhận tạm, nhưng: chỉ trong Script properties, không commit, không gửi qua chat; đổi ngay nếu lộ. Claude đã trả lại scope `firebase.database` để ưu tiên OAuth chủ dự án; bỏ `DB_SECRET` khi OAuth chạy.
- Luật gộp vẫn để 7 nhánh cũ (`rooms`, `lessons`, `questionBank`, …) đọc/ghi được bởi **mọi tài khoản đã đăng nhập** — nay gồm cả tài khoản học sinh mới. Nếu `questionBank`/`lessons` có đáp án của ứng dụng khác thì học sinh đọc được. Cần rà ở việc riêng.

## Việc Antigravity (theo thứ tự, dán nguyên văn kết quả)
1. Pull. Dán `apps-script/exam/Code.gs` + `appsscript.json` mới vào dự án Apps Script → chạy `setup()` **trong trình soạn thảo bằng tài khoản chủ** và bấm Cho phép khi Google hỏi quyền Drive/Firebase → **Deploy → Manage deployments → Edit → New version** (giữ nguyên URL /exec).
2. Chạy hàm thử nhanh trong trình soạn: `Logger.log(rootFolder_().getUrl())` → phải ra link thư mục (chứng minh có quyền Drive). Dán nhật ký.
3. Chạy lại `node tests/test_live_pilot_3_students.mjs` → phải in "ĐẠT TOÀN BỘ". Dán nguyên văn. Rồi kiểm tay: mở 2 phiếu minh chứng, tab sổ điểm có 2 hàng, gõ điểm thực hành HS1 → Tổng + phiếu đổi. Chụp màn hình sổ điểm.
4. Chạy `testAdminAccounts()` của dự án Apps Script provisioning trong trình soạn, dán nhật ký (đóng Đ2).
5. Deploy Pages sau bước 3 (bản có sửa trình duyệt). Không đổi đường thi Worker.

## Sau khi đạt: Cổng 4–5
- Cổng 4: 30 học sinh ảo nộp file 10 MB trong 60 giây (đo lỗi, thời gian, có mất file không); 100 học sinh ảo vào thi + lưu nháp cùng lúc.
- Cổng 5: thi thử thật ở phòng máy trường, 1 lớp, đo lại đăng nhập trên mạng trường.
