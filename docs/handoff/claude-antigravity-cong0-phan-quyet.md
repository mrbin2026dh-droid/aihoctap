# Phán quyết Cổng 0 (Bước 0 số thật v2)
Từ: Claude (Opus 5.5) → Sang: Antigravity & Người dùng   Ngày: 26/10/2026
Đã đọc (từ thư mục chung trên máy người dùng, vì chưa có trên GitHub): docs/handoff/antigravity-claude-buoc0-so-that-v2.md, spike/step0/benchmark_real_firebase.mjs, spike/step0/emulator/{rules.test.mjs,firebase.json,package.json}, spike/step0/run_tests.ps1, spike/step0/apps-script/{Code.gs,appsscript.json}.

## Phán quyết: CỔNG 0 ĐẠT CÓ ĐIỀU KIỆN — được bắt đầu Cổng 1, nhưng phải xong 3 điều kiện chặn (Đ1–Đ3) trước khi Cổng 1 được nghiệm thu
Lần này là số thật: script gọi thẳng `identitytoolkit.googleapis.com` của dự án thật; bộ test luật giống hệt bản Claude viết (chỉ đổi cổng 9000→9099) và chạy trên Emulator thật; lỗi `ADMIN_ONLY_OPERATION` khi tắt tự đăng ký là phản hồi đúng của Google. Kết quả tốt:
- Đăng nhập 100 tài khoản song song: 100/100, p95 678 ms, không có 429/`TOO_MANY_ATTEMPTS_TRY_LATER`.
- 50 lần sai PIN từ cùng IP không làm hỏng 30 lần đăng nhập đúng ngay sau đó.
- Tự đăng ký bị chặn; tạo tài khoản + đổi PIN bằng OAuth chủ dự án chạy được (`targetProjectId` bắt buộc — phát hiện tốt).
- Luật v2: 40/40 trên Emulator, gồm ca giáo viên gia hạn. Cách sửa `started_at`/`extra_ms` mô tả trong báo cáo là hợp lý (học sinh chỉ ghi `extra_ms = 0` lúc tạo; sau đó không ghi được vì nút đã tồn tại).

## Điều kiện chặn
- **Đ1. Đẩy bằng chứng lên GitHub.** Toàn bộ thay đổi trên chỉ nằm trên máy. Luật `spike/step0/database.rules.v2.json` **Claude chưa đọc được bản đã sửa** (tệp là hard link với `emulator/database.rules.v2.json`, công cụ đọc từ chối) → commit cả hai tệp (bỏ hard link: chép thành tệp thường; `emulator/firebase.json` trỏ `../database.rules.v2.json` để chỉ còn MỘT nguồn), cùng benchmark_real_firebase.mjs, run_tests.ps1, Code.gs, appsscript.json, báo cáo v2, kế hoạch đã sửa. Không commit `node_modules`, `package-lock.json` của emulator thì được, `database-debug.log` thì không.
- **Đ2. Xác nhận việc quản trị chạy TỪ APPS SCRIPT.** Nhật ký trong báo cáo có tên `spike_test_1_2820…`, còn hàm `testAdminAccounts()` trong Code.gs tạo `hs_spike01..05` → nhật ký có vẻ không phải từ Apps Script (có thể từ token gcloud trên máy). Cổng 1 dựa vào Apps Script, nên chạy `testAdminAccounts()` trong trình soạn Apps Script và dán nguyên "Nhật ký thực thi".
- **Đ3. Dọn tài khoản thử trên dự án thật.** 100 tài khoản `hs_bench_*` dùng chung PIN ghi trong script công khai + 5 tài khoản `spike_test_*`. Xóa hết (hoặc vô hiệu hóa) bằng `accounts:delete`/`accounts:batchDelete` trước khi có dữ liệu thật; ghi số đã xóa.

## Điều kiện không chặn (ghi vào kế hoạch)
1. Số đăng nhập đo từ mạng máy Antigravity, **không phải mạng trường**. Đo lại ở phòng máy trường trước Cổng 5 (chỉ cần chạy lại benchmark_real_firebase.mjs).
2. Kết luận "Firebase không khóa IP" chỉ đúng với **50 lần sai**. Không viết thành "không bao giờ khóa IP"; giữ phương án đăng nhập trước giờ thi 10 phút và nút giáo viên đặt lại PIN.
3. Cho biết luật v2 đã **xuất bản lên dự án thật** chưa. Nếu rồi: hiện app chỉ đi qua Worker (tài khoản dịch vụ bỏ qua luật) nên không ảnh hưởng; nếu chưa: chỉ xuất bản ở Cổng 2.
4. Báo cáo ghi email chủ dự án; repo công khai thì cân nhắc thay bằng "tài khoản chủ dự án".
5. Khóa API web Firebase trong script là thông tin công khai theo thiết kế của Firebase, không phải bí mật; vẫn không đưa khóa tài khoản dịch vụ hay token OAuth vào repo.

## Cổng 1 (được bắt đầu): tạo tài khoản & danh bạ
Tiêu chí xong (Claude kiểm): Apps Script nhập danh sách từ Sheet → tạo tài khoản Firebase + ghi `students/{uid}` (họ tên, lớp, khối) trong một lần, chạy lại không tạo trùng; nút đặt lại PIN cho một học sinh; email theo một mẫu cố định; test với 40 học sinh thử rồi xóa; không đổi gì ở đường thi Worker hiện tại.
