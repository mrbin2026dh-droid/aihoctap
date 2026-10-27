# Bàn giao: Giáo viên lớp dùng Về nhà + Tài liệu (giai đoạn 2, Worker)
Từ: Claude → Sang: Antigravity   Ngày: 27/10/2026   Mức: CAO (xác thực, phân quyền)

## Bối cảnh (đã xong, giai đoạn 1)
- Trang `GiaoVien` trong Google Sheet (Mã giáo viên | Họ tên | Mã PIN | Lớp phụ trách | Trạng thái). Quản trị thêm/sửa/khóa/xóa trong app → menu **Tài khoản → Giáo viên**.
- Giáo viên lớp đăng nhập trang giáo viên bằng Mã giáo viên + PIN (kiểm trên Firebase `thi_gv`, không qua Worker). Hiện chỉ thấy **Thi** và **Tài khoản** (lớp mình) — `body.is-class-teacher` ẩn các menu khác (teacher.css).
- Apps Script đã có action `gv_login` {ma, pin} → `{ok, teacher:{ma, ten, lop:[...]}}` (sai PIN/khóa → `{ok:false,error}`).

## Việc giai đoạn 2
Cho giáo viên lớp dùng **Về nhà** và **Tài liệu** (đang qua Worker) nhưng CHỈ với lớp mình phụ trách.

### 1. `/api/teacher/auth` nhận thêm giáo viên lớp (worker/index.js, tìm `url.pathname === '/api/teacher/auth'`)
```js
const body = await request.json().catch(() => ({}));
if (body.teacher_code && env.SHEET_LOGIN_URL) {
  const sr = await fetch(env.SHEET_LOGIN_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'gv_login', ma: String(body.teacher_code), pin: String(body.pin || '') }) });
  const sj = await sr.json().catch(() => null);
  if (!sj || !sj.ok) return json({ detail: (sj && sj.error) || 'Mã giáo viên hoặc PIN chưa đúng.' }, 401);   // dùng chung bộ đếm khóa IP như PIN quản trị
  const token = await signJwt({ sub: 'gv:' + sj.teacher.ma, claims: { role: 'teacher', scope: 'class', teacher_code: sj.teacher.ma, classes: sj.teacher.lop } }, signingKeys.privateKey, 12 * 3600);
  return json({ token, must_change: false, classes: sj.teacher.lop });
}
// … nhánh PIN quản trị giữ nguyên
```

### 2. `requireTeacher` trả phạm vi lớp
```js
// sau khi verify: const c = verification.payload.claims || {};
return { authorized: true, user: { role: 'teacher', admin: c.scope !== 'class', classes: c.scope === 'class' ? (c.classes || []) : null } };
```

### 3. Lọc theo lớp ở các endpoint giáo viên
- `/api/pwa/teacher/exams*` (Về nhà): tạo/sửa chỉ khi `class_code ∈ user.classes`; danh sách chỉ trả đề có `class_code ∈ user.classes`; kết quả/nộp bài chỉ của học sinh các lớp đó.
- `/api/pwa/teacher/materials`: tài liệu gắn khóa học — với giáo viên lớp chỉ cho đăng vào khóa học có `grade` = khối của lớp phụ trách.
- Mọi endpoint quản trị khác (publish bài học, khóa Gemini, hạn mức AI, students_auth, teacher PIN): `if (!auth.user.admin) return 403`.

### 4. Frontend (Claude làm sau khi Worker xong)
- `teacher.js` nhánh `role === 'gv'`: gọi thêm `/api/teacher/auth` {teacher_code, pin} để có token, bỏ ẩn `#nav-exams`, `#nav-materials` cho giáo viên lớp.

## Test FAIL-first cần thêm (tests/test_worker_teacher_scope.mjs)
1. `gv_login` giả trả lớp ['9A'] → `/api/teacher/auth` {teacher_code:'GV01', pin} → 200, token có claims.scope='class'.
2. Token giáo viên lớp gọi `POST /api/pwa/teacher/exams` với class_code '9B' → 403; '9A' → 200.
3. Token giáo viên lớp gọi `/api/pwa/teacher/publish` → 403.
4. PIN quản trị vẫn đăng nhập như cũ, `admin:true`.

## Xong khi
Test trên xanh + hồi quy worker xanh; deploy có lưu ID để `wrangler rollback`; báo Claude kiểm định (ACCEPT) trước khi bật menu cho giáo viên lớp.

## Xong thì chuyển cho: Claude
