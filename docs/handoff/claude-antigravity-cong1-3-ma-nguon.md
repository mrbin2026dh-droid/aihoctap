# Cổng 1 nghiệm thu + mã Cổng 2–3 (Claude viết) — Antigravity chỉ chạy trên tài khoản thật
Từ: Claude (Opus 5.5) → Sang: Antigravity & Người dùng   Ngày: 26/10/2026
Người dùng yêu cầu Claude viết thẳng logic và mã để bớt vòng qua lại. Antigravity KHÔNG viết lại; chỉ cài, chạy, báo số.

## 1. Phán quyết Cổng 1: ĐẠT, kèm sửa của Claude
Mã tạo tài khoản/danh bạ đúng chức năng (40 HS, chạy lại giữ UID, đổi PIN). Claude đã sửa trong `apps-script/provisioning/Code.gs`:
- **PIN mặc định `123456` cho dòng trống PIN** (ai cũng đăng nhập được vào tài khoản bạn) → nay sinh PIN ngẫu nhiên 6 chữ số, ghi lại cột E.
- **Khối trống mặc định 9** (học sinh khối 6 thấy đề khối 9) → nay báo lỗi dòng.
- **Chạy lại cả danh sách gọi API cho cả dòng đã có UID** và có thể vượt 6 phút → nay bỏ qua dòng đã có UID, tự dừng ở 5 phút, chạy lại làm tiếp.
- Thêm **tạo tài khoản giáo viên** (`gv_{mã}@…`, PIN ≥ 8, ghi `teachers/{uid}`) — mục menu 5.
Còn nợ: Đ2 chưa có nhật ký chạy **trong Apps Script** (test chạy bằng token CLI trên máy). Làm ở bước 2.3 dưới đây.
Lưu ý: dự án đang có **845 tài khoản Firebase Auth cũ**. Đã tắt tự đăng ký → kiểm xem có ứng dụng cũ nào (lan_quiz_arena, backend Python…) còn cần tự đăng ký không.

## 2. Mã mới (đã có test xanh)
| Tệp | Nội dung |
|---|---|
| `frontend/hoc/fb.js` | Firebase REST: đăng nhập, tự làm mới token, đọc/ghi RTDB, giờ máy chủ qua `clock/{uid}` |
| `frontend/hoc/exam-fb.js` | Đường thi Firebase: danh sách, vào thi (phiên giờ máy chủ), nháp, nộp (chống nộp trùng khi mất phản hồi), nộp file thực hành có thử lại giãn cách |
| `frontend/hoc/exam.js` | Gộp đề Worker + Firebase; chọn backend **theo từng đề** (`exam_meta.backend:'firebase'`); màn kết quả "Đã nhận bài"; khối nộp file thực hành |
| `frontend/hoc/app.js` | Đăng nhập Worker xong thì đăng nhập Firebase song song bằng cùng mã + PIN (không có tài khoản Firebase → chỉ thấy đề Worker); đăng xuất/hết phiên xóa phiên Firebase |
| `frontend/hoc/teacher.js` | Giáo viên đăng nhập trên máy → xóa phiên thi Firebase của học sinh (cách ly vai trò) |
| `apps-script/exam/` | Chấm ngay (chỉ trả điểm tổng), trigger mỗi phút chấm bù, **tự nộp từ nháp** sau giờ đóng, chi tiết đúng/sai + đáp án sau giờ đóng, minh chứng .txt trong thư mục học sinh, sổ điểm Sheet + GV gõ điểm thực hành tự cập nhật, phát hành đề từ tab Sheet, nhận file ≤10 MB |
| `spike/step0/database.rules.v2.json` | Thêm `clock/{uid}`, `drafts.leaves`, phiên bắt buộc có cả `started_at` + `extra_ms`. Emulator dùng **chung một tệp** (`emulator/firebase.json` trỏ `../`) |
| `tests/test_exam_firebase_flow.cjs` | 28 kiểm tra trình duyệt (Firebase/Apps Script giả lập) |

Test đã chạy xanh ở máy Claude: test_exam_firebase_flow (28), toàn bộ test thi/đăng nhập/giao diện cũ, test_exam_backend.mjs. `audit_settings_behavior.cjs` lỗi **cả trên main trước thay đổi** — lỗi cũ, xử lý riêng.

## 3. Việc Antigravity (theo thứ tự, dán nguyên văn kết quả)
1. `cd spike/step0/emulator && npm test` (hoặc `run_tests.ps1`) → phải **45/45**.
2. **Trước khi xuất bản luật v2 lên dự án thật**: tải luật đang chạy (Console → Realtime Database → Rules), so với v2. Mọi nhánh cấp gốc mà app/công cụ khác đọc/ghi **từ client** phải được giữ (Worker dùng tài khoản dịch vụ nên không bị ảnh hưởng). Gộp, rồi mới Publish. Ghi lại bản cũ vào `spike/step0/database.rules.live-backup.json`.
3. Apps Script cổng 1: chạy `testAdminAccounts()` **trong trình soạn Apps Script**, dán "Nhật ký thực thi" (đóng Đ2).
4. Apps Script cổng 3: làm theo `apps-script/exam/README.md` (Sheet sổ điểm, properties, `setup()`, deploy web app), dán URL `/exec` vào `FB_CONFIG.appsScriptUrl` (`frontend/hoc/fb.js`), `python tools/package_student_pwa.py --stamp`, commit.
5. Thi thử khép kín với **3 tài khoản thử** (tạo bằng menu provisioning, lớp 9TEST): phát hành đề 2 câu + thực hành 6 điểm, mở 15 phút.
   - HS1 làm đủ, nộp, nộp file .xlsx; HS2 chỉ làm nháp rồi đóng trình duyệt; HS3 không vào.
   - Sau giờ đóng + 3 phút báo: điểm HS1 hiện ngay khi nộp; HS2 có `auto_from_draft: true` và có điểm; có thư mục + `minh-chung_*.txt` cho HS1, HS2; sổ điểm có 2 hàng; gõ điểm thực hành HS1 → tổng + minh chứng cập nhật.
   - Xóa 3 tài khoản thử + dữ liệu đề thử sau khi xong.
6. Deploy Pages. Không đổi gì ở đường thi Worker.

## 4. Chưa làm (cổng sau)
- Giao diện giáo viên trong app cho đề Firebase (hiện phát hành bằng Sheet; endpoint `publish_exam` đã sẵn để nối sau).
- Đăng nhập Firebase làm đường chính (hiện đi kèm sau đăng nhập Worker) và chuyển phân tích giáo viên khỏi Worker.
- Đo tải 30 file × 10 MB đồng thời và thi thử ở mạng trường (Cổng 4–5).
