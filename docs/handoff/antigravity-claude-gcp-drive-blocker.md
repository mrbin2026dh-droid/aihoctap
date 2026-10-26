# Báo cáo điểm nghẽn GCP Project và đề xuất giải pháp mã nguồn cho Cổng 3
Từ: Antigravity → Sang: Claude (Opus 5.5)   Ngày: 26/10/2026

## Tình trạng thực tế (Minh chứng số thật)
1. Khi chạy `node tests/test_live_pilot_3_students.mjs` trên Web App thật:
   - Cổng 2 (chấm ngay + tự nộp nháp `auto_from_draft: true`): ĐẠT 100%.
   - Cổng 3: Gặp lỗi Google API: `"evidence_error": "Permission denied while enabling APIs: drive for GCP project 368135385597."`
2. Khi người dùng vào ⚙️ Project Settings của Apps Script để liên kết sang GCP Project `628267818434`:
   - Google Apps Script báo lỗi đỏ: `Project does not exist or you need edit access to it.`
   - Nguyên nhân: Tài khoản Google đang mở phiên Apps Script trên trình duyệt của người dùng không phải là tài khoản Owner/Editor của `628267818434`, hoặc Google Workspace/Chrome profile có xung đột phiên đăng nhập đa tài khoản.

## Phân tích kỹ thuật (Gốc rễ vấn đề)
- Lỗi `Permission denied while enabling APIs: drive for GCP project 368135385597` phát sinh do `appsscript.json` khai báo tường minh `oauthScopes` (chứa `drive` và `firebase.database`). Khi có `oauthScopes` tùy chỉnh, Apps Script ép buộc kích hoạt Cloud APIs trên GCP project.
- Đối với project mặc định ẩn (`368135385597`), Google cấm người dùng bật Drive REST API qua giao diện này.
- Nếu không khai báo `oauthScopes` tùy chỉnh trong `appsscript.json` (để Apps Script tự động suy luận scope cho `DriveApp` và `SpreadsheetApp`), các dịch vụ built-in `DriveApp` và `SpreadsheetApp` hoạt động bình thường trên bất kỳ dự án Apps Script mặc định nào mà KHÔNG đòi hỏi người dùng phải liên kết GCP Standard Project.
- Đối với kết nối Firebase RTDB: `db_()` trong `Code.gs` đã hỗ trợ sẵn `DB_SECRET` qua query `?auth=...`.

## Đề xuất giải pháp mã nguồn (Không bắt người dùng cấu hình GCP phức tạp)
1. Phương án A (Khuyến nghị cho Cổng 3):
   - Trong `apps-script/exam/appsscript.json`: Bỏ `oauthScopes` tùy chỉnh để Apps Script tự cấp quyền `DriveApp` nội bộ không lỗi GCP.
   - Sử dụng `DB_SECRET` trong Script Properties cho kết nối RTDB của Apps Script chấm thi.
2. Phương án B:
   - Giữ nguyên kiến trúc Claude, người dùng chỉ cần cung cấp địa chỉ Gmail đang mở Apps Script để Antigravity thêm quyền Editor trên GCP `628267818434`.

## Xong thì chuyển cho: Antigravity
Sau khi Claude phán quyết phương án, Antigravity sẽ cập nhật mã nguồn hoặc chạy nghiệm thu.
