# Bộ tài khoản: PIN giáo viên, đổi PIN, quản lý học sinh, đổi PIN học sinh, tab Kiểm tra
Từ: Claude → Antigravity. Mức CAO. TẠM DỪNG mọi việc khác (kể cả đợt 1 kiểm tay chỉ chạy trên bản hiện có). Quy trình: context7, FAIL-first, oxlint, node --check, báo THẬT/MOCK. Căn cứ: `docs/audits/2026-10-25-quy-trinh-tai-khoan-rasoat.md`. Không log PIN; PIN chỉ hiện đúng 1 lần cho giáo viên khi tạo/đặt lại. Không deploy khi chưa có ACCEPT của Claude (sau ACCEPT, deploy thử theo AGENTS.md mục G).

## 0. Dữ liệu (RTDB, `.read/.write` = false cho client; chỉ Worker ghi bằng OAuth)
- `teacher_auth/main` = `{ salt, pin_hash, must_change, updated_at }` (PBKDF2 như `hashPinPbkdf2`).
- `students_auth/{id}` hiện có `{name, grade, class_code, salt, pin_hash}`; thêm `disabled` (bool), `must_change_pin` (bool), `created_at`.
Helper chung trong worker/index.js (mọi lần ghi PHẢI kiểm `res.ok`, lỗi → 502, mẫu N1):
```js
async function rtdb(env, signingKeys, method, path, body) {
  const tok = await getOrFetchGoogleOAuthToken(env, signingKeys?.privateKey);
  const r = await fetch(`${env.FIREBASE_DATABASE_URL}/${path}.json`, { method, headers: getRtdbHeaders(tok), body: body === undefined ? undefined : JSON.stringify(body) });
  return r; // người gọi kiểm r.ok / r.status === 404
}
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const autoPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
```

## 1. PIN giáo viên và bắt đổi lần đầu
- PIN khởi tạo = giá trị `TEACHER_ADMIN_SECRET` (người dùng đặt bằng `npx wrangler secret put TEACHER_ADMIN_SECRET`, Antigravity hướng dẫn tạo chuỗi ngẫu nhiên 10–12 ký tự và đọc cho người dùng nhập; không in vào log/Git).
- `POST /api/teacher/auth` (giữ nguyên khóa thử sai): GET `teacher_auth/main`. Nếu 404 → so với `TEACHER_ADMIN_SECRET` (hàm `isValidSecret`), thành công → token có claim `must_change: true`. Nếu có bản ghi → so PBKDF2; thành công → claim `must_change: Boolean(rec.must_change)`. Lỗi RTDB khác 404 → 502 (không tính sai PIN). Khi đã có bản ghi, KHÔNG cho đăng nhập bằng `TEACHER_ADMIN_SECRET` (chỉ giữ header `X-Admin-Secret` cho công cụ/dự phòng như hiện tại).
- Hàm dùng chung `requireTeacher(request, env, signingKeys, { allowMustChange = false })`: bọc logic hiện có (header secret hoặc JWT + `hasTeacherClaims`); nếu JWT có `claims.must_change` và `!allowMustChange` → 403 `{ error: 'TEACHER_PIN_CHANGE_REQUIRED', detail: 'Hãy đổi mã PIN trước khi tiếp tục.' }`. Thay cho mọi chỗ kiểm quyền giáo viên đang lặp lại (publish, results, lesson, materials, gemini-keys, ai-*, unlock, students).
- `POST /api/teacher/change-pin` `{ old_pin, new_pin }` (`allowMustChange: true`, cùng khóa thử sai): `new_pin` ≥ 8 ký tự, khác `old_pin`, không gồm 1 ký tự lặp; xác minh `old_pin` như ở auth; ghi `teacher_auth/main` với salt mới, `must_change:false`; trả token mới (không có `must_change`). Sai → 401 đếm vào khóa thử sai.
- Quên PIN: người dùng xóa nút `teacher_auth/main` trong Firebase Console → quay lại PIN khởi tạo (ghi vào hướng dẫn).
- Giao diện teacher.html/.js: sau đăng nhập, nếu phản hồi `must_change` → chỉ hiện form "Đổi mã PIN" (mã hiện tại, mã mới, nhập lại), ẩn toàn bộ mục khác; có mục "Đổi mã PIN" thường trực trong cài đặt.

## 2. Quản lý học sinh (giáo viên)
Tất cả `requireTeacher`. ID hợp lệ theo `IdValidationContract`. Không bao giờ trả `salt`/`pin_hash`.
- `GET /api/teacher/students` → `[{ id, name, grade, class_code, disabled, created_at }]` (đọc `students_auth.json`, bỏ các trường bí mật).
- `POST /api/teacher/students` `{ name, grade (6–12), class_code, pin? }`: `name` 1–60 ký tự, `class_code` 1–10 ký tự `[A-Za-z0-9_-]`; `pin` (nếu có) ≥ 6 ký tự, nếu bỏ trống dùng `autoPin()`; id = `'hs' + 6 ký tự a-z0-9 ngẫu nhiên`, nếu GET trả khác 404 thì sinh lại (tối đa 5 lần); ghi bản ghi `{name,grade,class_code,salt,pin_hash,disabled:false,must_change_pin:true,created_at}`; trả `{ id, name, grade, class_code, pin }` (PIN chỉ trong phản hồi này).
- `PATCH /api/teacher/students/{id}` `{ name?, grade?, class_code? }` (cập nhật từng trường hợp lệ, dùng PATCH RTDB hoặc PUT sau GET); 404 nếu chưa có.
- `POST /api/teacher/students/{id}/reset-pin` `{ pin? }` → PIN mới (tự sinh nếu trống), `must_change_pin:true`, gọi `http://do/reset-lockout` để xóa khóa thử sai; trả `{ pin }` một lần.
- `POST /api/teacher/students/{id}/lock` `{ locked: boolean }` → ghi `disabled`.
- `DELETE /api/teacher/students/{id}` → xóa `students_auth/{id}`; ghi chú: kết quả đã nộp giữ nguyên.
- `/api/login`: SAU khi PIN đúng, nếu `studentCred.disabled === true` → 403 `{ detail: 'Tài khoản đang bị khóa. Hãy liên hệ giáo viên.' }` (không đếm sai PIN); phản hồi đăng nhập thêm `must_change_pin`.
- Giao diện giáo viên: mục "Học sinh": bảng (Họ tên, Lớp, Trạng thái, thao tác Sửa / Đặt lại PIN / Khóa-Mở / Xóa có xác nhận); form "Thêm học sinh" (Họ tên, Khối 6–12, Mã lớp, PIN tùy chọn); sau khi tạo/đặt lại hiện thẻ "Mã học sinh … · PIN … (chỉ hiện một lần)" kèm nút Sao chép; bộ lọc theo lớp. Chữ ngắn, không emoji.

## 3. Học sinh
- `POST /api/pwa/change-pin` `{ old_pin, new_pin }` (JWT học sinh): `new_pin` ≥ 6, khác `old_pin`, không toàn một ký tự; xác minh PIN cũ bằng PBKDF2 (sai → 401 và đếm vào khóa thử sai như login); ghi salt/hash mới, `must_change_pin:false`; 200.
- Giao diện index.html/app.js: mục "Tài khoản" (mở từ tên ở thanh trên): `Tên · Lớp 9A`, form Đổi mã PIN, nút Đăng xuất; nếu `must_change_pin` hiện thẻ nhắc "Hãy đổi mã PIN do giáo viên cấp" (nhắc, không chặn học).
- Lớp: giữ hành vi hiện có (ô Khối lớp khóa theo lớp học sinh, chỉ thấy bài khối đó). Test thêm: học sinh lớp 9 không mở được bài lớp 6 (`/api/pwa/lessons/...` trả 403 nếu khối khác `claims.grade`; nếu hiện đang cho xem, sửa).
- Tab 02 "Bài tập" đổi nhãn thành "Kiểm tra" (nội dung giữ nguyên: bài trắc nghiệm theo bài học, hiển thị điểm lần gần nhất). Đề thi giáo viên giao (A4) làm sau.

## 4. Test FAIL-first (`tests/test_accounts.mjs`, mock RTDB + DO)
1. Giáo viên đăng nhập bằng secret (chưa có bản ghi) → token `must_change`; gọi route khác (vd `GET /api/teacher/students`) → 403 `TEACHER_PIN_CHANGE_REQUIRED`; `change-pin` ngắn < 8 → 400; đúng → ghi hash (không lưu bản rõ), token mới dùng được route khác.
2. Sau khi đã đổi: đăng nhập bằng `TEACHER_ADMIN_SECRET` → 401; bằng PIN mới → 200; sai 5 lần → 429 (khóa).
3. RTDB lỗi 500 khi ghi → 502, không báo thành công; khi GET teacher_auth lỗi → 502, không tính sai PIN.
4. Tạo học sinh: PIN tự sinh 6 chữ số, phản hồi có PIN, RTDB chỉ có `pin_hash`/`salt`; id đúng regex; PIN < 6 → 400; thiếu tên/lớp → 400; không quyền → 403.
5. Danh sách không chứa `salt`/`pin_hash`; sửa tên/lớp đúng; xóa → login học sinh đó 401.
6. Khóa: học sinh bị `disabled` đăng nhập PIN đúng → 403 và không tăng bộ đếm sai; mở khóa → 200. Reset PIN: PIN cũ 401, PIN mới 200, `must_change_pin` true, khóa thử sai được xóa.
7. Học sinh đổi PIN: sai PIN cũ 401; đúng → login bằng PIN mới; PIN mới = cũ → 400; không token → 401.
8. Học sinh lớp 9 không đọc được bài lớp 6 (403).
9. Quét tĩnh: không có PIN/secret trong `console.*` ở các route mới; không `salt`/`pin_hash` trong phản hồi.
Cập nhật `tools/manage_students.py` giữ nguyên cho dùng dòng lệnh (tương thích `disabled`, `must_change_pin`).

## Xong khi
Test mới FAIL rồi PASS; 13 bộ cũ vẫn PASS; oxlint 0/0; node --check mọi tệp sửa; báo cáo THẬT/MOCK; cập nhật `docs/guides/kiem-tay-dot-1.md` cho đúng quy trình mới (đăng nhập giáo viên → đổi PIN → tạo học sinh → học sinh đăng nhập → đổi PIN). Chuyển Claude.
