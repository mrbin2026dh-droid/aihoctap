# Bàn giao Điều kiện C1: Bỏ khóa vạn năng X-Admin-Secret trong Production
Từ: Antigravity → Sang: Claude   Ngày: 2026-10-25 (Asia/Bangkok)

## Mục tiêu (1–3 dòng)
Khắc phục triệt để điều kiện C1: Loại bỏ vĩnh viễn khóa vạn năng `X-Admin-Secret` trên môi trường production, chỉ cho phép sử dụng trong môi trường kiểm thử `MOCK_MODE`; bảo đảm quy trình đổi PIN và phân quyền giáo viên bất biến.

## Tệp cần đọc (đường dẫn, càng ít càng tốt)
- `worker/index.js` (Hàm `requireTeacher` bọc `SecurityConfigContract.isMockModeAllowed(env)`)
- `tests/test_accounts.mjs` (Nhóm kiểm thử [10] cho C1)

## Kết quả đạt được & Tiêu chí nghiệm thu
1. **FAIL-First Verified**:
   - Thêm nhóm kiểm thử [10] vào `tests/test_accounts.mjs` và xác nhận FAIL trước khi sửa code (`AssertionError: 200 !== 403` khi gọi `GET /api/teacher/students` bằng `X-Admin-Secret` trên môi trường non-mock).
   - Sau khi cập nhật `requireTeacher`, test [10] **PASS 100%**:
     - Môi trường production (`MOCK_MODE: false`): Mọi request gửi header `X-Admin-Secret` tới các route giáo viên (`/api/teacher/students`, `/api/teacher/ai-lock`, `/api/teacher/gemini-keys`, `/api/pwa/teacher/publish`) đều bị chặn dứt khoát với **403/401**, không gọi RTDB.
     - Sau khi đổi PIN: Đăng nhập bằng secret khởi tạo bị chặn 401; dùng header secret bị chặn 403.
     - Môi trường `MOCK_MODE: true`: Header secret vẫn hoạt động hợp lệ để giữ tương thích các bộ test cũ.
2. **Hồi quy toàn bộ hệ thống**: Toàn bộ **14 bộ test suites** của dự án (`test_accounts.mjs` + 13 bộ test cũ) chạy và **PASS 100%**.
3. **Quét mã tĩnh & Oxlint**:
   - Chuỗi `X-Admin-Secret` chỉ xuất hiện trong CORS headers và khối `SecurityConfigContract.isMockModeAllowed(env)` trong `requireTeacher`.
   - `node --check` 100% sạch.
   - `npx oxlint` đạt **0 errors, 0 warnings**.
4. **Phân định rõ MOCK / THẬT**: Đã kiểm chứng 100% trên môi trường MOCK. **CHƯA DEPLOY** lên Cloudflare Worker (chờ phán quyết ACCEPT từ Claude theo AGENTS.md mục G).

## Ràng buộc / Không được làm
- Không deploy trước khi có phán quyết ACCEPT từ Claude.
- Không in bí mật hay PIN vào log/chat/Git.

## Xong thì chuyển cho: Claude
