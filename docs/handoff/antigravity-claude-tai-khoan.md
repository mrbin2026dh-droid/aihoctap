# Bàn giao Bộ tài khoản: PIN giáo viên, đổi PIN, quản lý học sinh & phân quyền khối lớp
Từ: Antigravity → Sang: Claude   Ngày: 2026-10-25 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Kiểm định độc lập việc triển khai Bộ tài khoản bảo mật Mức CAO: mã PIN giáo viên PBKDF2 khởi tạo và bắt buộc đổi lần đầu, quản lý học sinh (thêm, sửa, reset PIN, khóa, xóa), học sinh tự đổi PIN, đổi tab 02 thành "Kiểm tra", và kiểm soát phân quyền khối lớp chặt chẽ.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `tests/test_accounts.mjs` (Bộ test 9 nhóm chức năng tài khoản & RBAC)
- `worker/index.js` (Hàm `rtdb`, `requireTeacher`, các route `/api/teacher/*` và `/api/pwa/change-pin`)
- `worker/contracts.js` (`TeacherAuthContract`, `IdValidationContract.isValidStudentId`)
- `tools/manage_students.py` (Hỗ trợ `disabled`, `must_change_pin`, `created_at`)
- `frontend/hoc/teacher.html` & `frontend/hoc/teacher.js` (UI đổi PIN lần đầu, quản lý học sinh, đổi PIN thường trực)
- `frontend/hoc/index.html` & `frontend/hoc/app.js` (Tab 02 "Kiểm tra", form đổi PIN học sinh, nhắc đổi PIN)
- `docs/guides/kiem-tay-dot-1.md` (Quy trình kiểm tay cập nhật)

## Kết quả đạt được & Tiêu chí nghiệm thu
1. **FAIL-First Verified**: Đã chạy `test_accounts.mjs` và xác nhận FAIL trước khi triển khai, sau đó PASS 100% cả 9 nhóm test cases:
   - Giáo viên đăng nhập secret khởi tạo -> token `must_change: true`. Gọi route khác -> 403 `TEACHER_PIN_CHANGE_REQUIRED`. `change-pin` < 8 ký tự hoặc trùng lặp -> 400. Đổi đúng -> ghi salt/hash PBKDF2 vào `teacher_auth/main`, cấp token mới không còn `must_change`.
   - Sau khi đổi PIN: Đăng nhập bằng secret khởi tạo -> 401. Đăng nhập bằng PIN mới -> 200. Sai 5 lần -> 429 DO lockout.
   - RTDB 500 khi ghi/đọc -> 502 Bad Gateway an toàn (không tính sai PIN / không kích hoạt lockout).
   - Thêm học sinh: Tự sinh mã PIN 6 số, phản hồi có PIN (chỉ hiện 1 lần), RTDB chỉ lưu `salt`/`pin_hash`. ID tuân thủ regex `^hs[a-z0-9]{6}$`. Thiếu thông tin hoặc grade < 6 -> 400. Không có quyền giáo viên -> 403.
   - Danh sách học sinh (`GET /api/teacher/students`): Tuyệt đối không chứa `salt`/`pin_hash`/`pin`. Sửa thông tin (PATCH) -> 200. Xóa (DELETE) -> 200, sau đó học sinh login báo 401.
   - Khóa học sinh: Học sinh bị `disabled` đăng nhập đúng PIN -> 403 (không tăng bộ đếm sai PIN). Mở khóa -> 200. Đặt lại PIN -> PIN cũ 401, PIN mới 200, `must_change_pin: true`, bộ đếm sai PIN được reset.
   - Học sinh đổi PIN (`POST /api/pwa/change-pin`): Sai PIN cũ -> 401; trùng PIN cũ -> 400; đúng PIN -> 200, đăng nhập được bằng PIN mới. Không có token -> 401.
   - Phân quyền khối lớp: Học sinh lớp 9 gọi bài học lớp 6 (`/api/pwa/lessons/tin6/...`) -> 403 Forbidden.
   - Quét tĩnh: 0 rò rỉ mã PIN hoặc bí mật trong log hay phản hồi; không trả về `salt`/`pin_hash`.
2. **Hồi quy toàn bộ hệ thống**: Cả 14 bộ test suites (`test_accounts.mjs` + 13 bộ test cũ) chạy tự động và PASS 100%.
3. **Cú pháp & Oxlint**: `node --check` 100% sạch; `npx oxlint` đạt **0 errors, 0 warnings** trên toàn bộ các tệp thay đổi.
4. **Phân định rõ MOCK / THẬT**: Toàn bộ thay đổi đã được kiểm chứng 100% trên môi trường MOCK (unit/integration test). **CHƯA DEPLOY** lên môi trường THẬT (Worker / GitHub Pages) theo đúng quy tắc G.1 và ràng buộc của Claude (chờ phán quyết ACCEPT của Claude).

## Ràng buộc / Không được làm
- Không deploy Cloudflare Worker hay push Git lên production khi chưa có phán quyết ACCEPT từ Claude.
- Không in mã PIN hoặc secret vào chat, log hay Git.

## Xong thì chuyển cho: Claude
