# Phán quyết kiểm mã Học AI (commit bd0215d, nhánh hoc-ai-phieu)
Từ: Claude → Sang: Người dùng (hoặc AI sửa mã)   Ngày: 22/11/2026   Mức: CAO

## Phán quyết: CHƯA ACCEPT — sửa xong C1–C3 thì kiểm lại
Lưu ý về tính độc lập: người dùng yêu cầu kiểm ngay trong phiên đã viết mã, nên đây vẫn là **tự kiểm**, không phải kiểm độc lập. Cách kiểm: đọc lại toàn bộ `worker/phieu.js` và `phieu-core.js` theo mô hình đe dọa, rồi chạy thử bằng script riêng.

Các điểm đã đạt:
- Học sinh không có đường nào đọc `phieu_dapan`.
- Mọi khóa đường dẫn đều được lọc: `goi` theo regex, lớp qua `lopKey`, mã học sinh qua `safeUid`, nhóm qua `nhomKey`.
- Giáo viên lớp bị giới hạn theo lớp ở cả hai đường đăng nhập. Chỉ giáo viên quản trị được ghi gói và đáp án.
- `phieu_bo_goc` chỉ ghi một lần. Không có `innerHTML` hay `eval`. CSV có `csvSafe`. Token hết hạn bị từ chối.

## Điều kiện phải sửa
**C1 – Ẩn cả một hoạt động thì học sinh không nộp được bài** (lỗi logic, đã chạy thử xác nhận)
- Tình huống: giáo viên đặt `an: true` cho hoạt động `hd1`. Học sinh không còn thấy hoạt động này, nhưng `missingForSubmit` vẫn đòi trả lời `hd1_chon`, và `checkDraft` vẫn cho ghi `hd1_vi`.
- Hậu quả: máy chủ trả MISSING mãi, học sinh không tìm được mục còn thiếu nên không nộp được.
- Tệp: `worker/phieu-core.js`, chép lại sang `frontend/hoc/phieu-core.js`.
```js
/** Trường đang dùng: bỏ trường thuộc hoạt động bị ẩn. */
export function activeFieldMap(pack) {
  const m = new Map();
  for (const a of pack?.activities || []) if (!a.an) for (const f of a.fields || []) if (!f.an) m.set(f.id, f);
  return m;
}
// checkDraft, checkGroup, missingForSubmit và phần kiểm YCCĐ trong validatePack: dùng activeFieldMap(pack) thay fieldMap(pack).
// fieldMap giữ nguyên cho checkEdit, CSV và màn giáo viên (vẫn phải thấy trường đang ẩn).
```
- Test FAIL-first, thêm vào `test_phieu_core.mjs`:
```js
{ const p = clone(pack); p.activities[0].an = true;
  ok(!C.missingForSubmit(p, {}).includes('hd1_chon'), 'ẩn hoạt động thì không bắt nộp');
  eq(C.checkDraft(p, { hd1_vi: 'x' }).error, 'FIELD_UNKNOWN', 'không ghi vào hoạt động ẩn'); }
```

**C2 – Lựa chọn đầu giờ chưa được khóa khi nộp** (làm sai minh chứng 9.A3.1)
- Tình huống: học sinh không bấm "Chốt", sửa lựa chọn đầu giờ vào cuối giờ, rồi nộp.
- Hậu quả: bản nộp không còn phân biệt được "trước" và "sau".
- Tệp: `worker/phieu.js`, nhánh `act === 'submit'`.
```js
const locked = { ...(bai.locked || {}) };
for (const f of fieldMap(pack).values()) if (f.lock && !locked[f.id]) locked[f.id] = Date.now();
const next = { ...bai, ...meta, locked, status: 'submitted', submitted_at: Date.now(), rev };
```
- Test, thêm vào `test_phieu_worker.mjs`, cho học sinh B nộp mà chưa chốt:
  - sau khi nộp, `getAt('phieu_bai/ai9_bai2/9a/hsB').locked.hd1_chon` phải có giá trị;
  - giáo viên trả bài, rồi gửi nháp `hd1_vi` → phải trả `FIELD_LOCKED`.

**C3 – Tham số `block` khớp cả khóa có sẵn của đối tượng JavaScript**
- Lỗi: `pack.blocks?.[body.block]` cho kết quả đúng (truthy) với `constructor` hoặc `__proto__`.
- Hậu quả: ghi rác vào `phieu_mo`.
- Tệp: `worker/phieu.js`, op `mo`.
```js
if (typeof body.block !== 'string' || !/^[a-z0-9_]{2,40}$/.test(body.block) || !Object.hasOwn(pack?.blocks || {}, body.block)) return J({ error: 'BLOCK_SAI', detail: 'Không có học liệu này.' }, 400);
```
- Test: `T({op:'mo', goi:'ai9_bai2', lop:'9A', block:'constructor'}, gv9a)` phải trả 400.

## Lưu ý (không chặn)
- L1: học sinh tự chọn số nhóm, nên có thể vào nhóm khác trong lớp mình để:
  - đọc trường mục tiêu của bạn trong nhóm đó;
  - sửa phần nhóm của nhóm đó.

  Mọi lần sửa đều để lại dấu vết (danh sách thành viên, `by`). Nên làm thêm: giáo viên khóa thành viên nhóm.
- L2: đường đăng nhập Sheet `gv_login` gọi lại mỗi lần, và Worker không giới hạn số lần thử. Đây là cách cũ của `authTeacherAny`, không phải lỗ hổng mới.
- L3: nếu ghi `phieu_ls` thành công nhưng ghi bài bị xung đột, sẽ còn lại một bản chụp mồ côi.
- L4: ETag mới kiểm trên cơ sở dữ liệu giả. Smoke test sau deploy phải thử hai máy cùng sửa một bài.
- L5: chưa tự xóa dữ liệu khi hết năm học.

## Xong khi
- Test C1–C3 FAIL trước khi sửa, PASS sau khi sửa. 4 test `test_phieu_*` xanh, `package_student_pwa.py --check` xanh.
- Claude kiểm lại và ghi ACCEPT vào cuối tệp này. Chỉ sau đó mới push.

## Kiểm lại sau khi sửa (22/11/2026, Claude, cùng phiên — tự kiểm)
- C1: thêm `activeFieldMap` trong `phieu-core.js` (đã chép sang `frontend/`). `checkDraft`, `checkGroup`, `missingForSubmit`, phần kiểm YCCĐ, chốt và kiểm thành viên nhóm đều bỏ qua hoạt động hoặc trường đang ẩn.
- C2: khi nộp, máy chủ tự khóa mọi mục có `lock`. Sau khi giáo viên trả bài, `hd1_vi` vẫn trả `FIELD_LOCKED`.
- C3: `block` phải khớp regex và là khóa riêng của `pack.blocks` (kiểm bằng `Object.hasOwn`).
- Test thêm cho C1–C3 FAIL trước khi sửa, PASS sau khi sửa. Kết quả:
  - `test_phieu_core` 63 PASS, `test_phieu_worker` 103 PASS;
  - `test_phieu_ui`, `test_phieu_teacher_ui`, `test_teacher_mobile_nav`, `test_teacher_thi_ui`, `test_role_isolation`, `test_fonts_vietnamese`, `test_worker_gate`: PASS;
  - `package_student_pwa.py --check`: PASS.

## Phán quyết: ACCEPT (MOCK) — tự kiểm
- Cho phép deploy thử, chỉ dùng dữ liệu "[THỬ]" (AGENTS.md mục G).
- Chưa ACCEPT dùng với học sinh thật. Trước đó cần:
  - smoke test trên RTDB thật (L4: hai máy cùng sửa một bài);
  - một lượt kiểm độc lập ở phiên khác.
- Các lưu ý L1–L5 vẫn còn, không chặn.
