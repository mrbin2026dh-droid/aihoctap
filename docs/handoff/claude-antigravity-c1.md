# Sửa C1: bỏ khóa vạn năng X-Admin-Secret — Claude → Antigravity
Căn cứ: `docs/audits/2026-10-25-tai-khoan-verdict.md`. Mức CAO, FAIL-first, không deploy trước ACCEPT.

## Sửa (worker/index.js, hàm `requireTeacher`, ~dòng 1235–1240)
Chỉ chấp nhận header secret khi đang ở chế độ MOCK (dành cho test), không bao giờ ở production:
```js
const providedSecret = request.headers.get('X-Admin-Secret') || '';
if (SecurityConfigContract.isMockModeAllowed(env) &&
    TeacherAuthContract.isValidSecret(providedSecret, env.TEACHER_ADMIN_SECRET)) {
  return { authorized: true, user: { role: 'teacher', admin: true }, isSecret: true };
}
```
(`isMockModeAllowed` đã có ở worker/contracts.js; production không bật MOCK_MODE.) Các bộ test cũ đang dùng header (g1_g6, h1_h6, l1_l5, m1_m4, worker_gate) phải bật MOCK_MODE trong `env` của test hoặc chuyển sang token giáo viên; không sửa kết quả mong đợi.
Phần đăng nhập bằng `TEACHER_ADMIN_SECRET` khi CHƯA có `teacher_auth/main` (dòng ~2097) và `change-pin` lúc 404 (dòng ~2234) GIỮ NGUYÊN (đó là PIN khởi tạo), vì có khóa thử sai.

## Test FAIL-first (thêm vào `tests/test_accounts.mjs`, mục [10])
1. Env production (không MOCK_MODE), `X-Admin-Secret` đúng → mọi route giáo viên (`GET /api/teacher/students`, `POST /api/teacher/ai-lock`, `GET /api/teacher/gemini-keys`, `POST /api/pwa/teacher/publish`) trả 403/401, không gọi RTDB.
2. Sau khi đổi PIN, đăng nhập bằng secret khởi tạo → 401 (đã có ở [2]) và dùng header secret → 403.
3. Env MOCK_MODE + header đúng → vẫn 200 (để test cũ chạy được).
4. Quét tĩnh: chuỗi `X-Admin-Secret` chỉ xuất hiện trong `requireTeacher` và trong khối kiểm MOCK.

## Xong khi
Test mới FAIL rồi PASS; 14 bộ test PASS; oxlint 0/0; node --check. Cập nhật `docs/guides/kiem-tay-dot-1.md` nếu có nhắc header. Chuyển Claude; khi ACCEPT, deploy thử theo AGENTS.md mục G (lưu ID bản cũ để rollback).
