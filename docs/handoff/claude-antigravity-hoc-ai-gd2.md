# Học AI – giai đoạn 2: lõi phiếu + route học sinh (Worker)
Từ: Claude → Sang: Antigravity   Ngày: 22/11/2026 (Asia/Bangkok)   Mức: CAO (dữ liệu cá nhân HS, đáp án GV)

## Mục tiêu
Làm `frontend/hoc/phieu-core.js` (hàm thuần) và nhóm route học sinh `/api/pwa/phieu/*` trong Worker, theo FAIL-first. Chưa làm giao diện.

## Đọc (chỉ các tệp này)
`docs/integration-ai-grade9-lesson2/03_INTEGRATION_ARCHITECTURE.md`, `04_DATABASE_AND_SECURITY.md`, `06_TEST_CASES.md` (mục A, B), `08_FIELD_MAP.md`; dữ liệu `data/phieu/ai9_bai2.json`. Tham khảo cách dựng test ở `tests/test_accounts.mjs`.
Tệp `data/phieu/ai9_bai2.dapan.json` đã có trên máy, bị `.gitignore` chặn. **Không commit**, không chép đáp án vào test.

## 1. `frontend/hoc/phieu-core.js` (mã mẫu, sửa được nếu sai, nhưng ghi lý do vào log)
```js
// @ts-check
// Lõi phiếu học tập (Học AI): hàm thuần dùng chung Worker / giao diện / test. Không DOM, không mạng.
export const KINDS = ['toi_thieu', 'bo_tro', 'moc', 'tu_danh_gia', 'khong_cham', 'dong_gop'];
export const MUC_GV = ['chua_thay', 'dat', 'kha', 'tot'];
/** @param {string} s */ export const lopKey = s => String(s || '').trim().toLowerCase().replace(/[.#$[\]/\s]/g, '_').slice(0, 40);
/** @param {any} pack @returns {Map<string, any>} */
export function fieldMap(pack) { const m = new Map(); for (const a of pack.activities || []) for (const f of a.fields || []) m.set(f.id, f); return m; }
/** @param {any} pack @returns {string[]} lỗi tiếng Việt, rỗng = hợp lệ */
export function validatePack(pack) {
  const e = [];
  if (!pack || pack.schema !== 1 || !/^[a-z0-9_]{3,40}$/.test(pack.id || '')) e.push('Gói thiếu id hoặc schema.');
  const ids = new Set();
  for (const a of pack?.activities || []) for (const f of a.fields || []) {
    if (!/^[a-z0-9_]{2,40}$/.test(f.id)) e.push(`Mã trường không hợp lệ: ${f.id}`);
    if (ids.has(f.id)) e.push(`Trùng mã trường: ${f.id}`); ids.add(f.id);
    if (f.type !== 'heading' && !KINDS.includes(f.evidence?.kind)) e.push(`Trường ${f.id} thiếu loại minh chứng.`);
  }
  for (const y of pack?.yccd || []) {
    const ok = [...fieldMap(pack).values()].some(f => !f.an && f.mode !== 'nhom' && f.evidence?.code === y.code && f.evidence.kind === 'toi_thieu');
    if (!ok) e.push(`Yêu cầu ${y.code} chưa có trường minh chứng tối thiểu cá nhân.`);
  }
  if (pack?.ai_tutor !== false) e.push('Phiếu Học AI phải tắt Gia sư AI.');
  return e;
}
/**
 * Kiểm bản nháp cá nhân. @param {any} pack @param {Record<string, any>} answers @param {Record<string, number>} locked
 * @returns {{ok:true, clean:Record<string, string|string[]>}|{ok:false, error:string, field?:string}}
 */
export function checkDraft(pack, answers, locked = {}) {
  const fm = fieldMap(pack); const clean = {}; let total = 0;
  for (const [id, v] of Object.entries(answers || {})) {
    const f = fm.get(id);
    if (!f || f.type === 'heading') return { ok: false, error: 'FIELD_UNKNOWN', field: id };
    if (f.mode === 'nhom') return { ok: false, error: 'FIELD_GROUP', field: id };
    if (locked[id]) return { ok: false, error: 'FIELD_LOCKED', field: id };
    if (f.type === 'multi') {
      if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) return { ok: false, error: 'FIELD_TYPE', field: id };
      if (f.exact && v.length > f.exact) return { ok: false, error: 'EXACT_' + f.exact, field: id };
      clean[id] = v.slice(0, 20); total += JSON.stringify(v).length; continue;
    }
    if (typeof v !== 'string') return { ok: false, error: 'FIELD_TYPE', field: id };
    if (v.length > (f.max || 2000)) return { ok: false, error: 'FIELD_TOO_LONG', field: id };
    clean[id] = v; total += v.length;
  }
  if (total > 40000) return { ok: false, error: 'DRAFT_TOO_BIG' };
  return { ok: true, clean };
}
/** Chặn chèn công thức khi mở CSV bằng Excel. @param {unknown} v */
export function csvSafe(v) {
  let s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
```

## 2. Worker: `handlePhieu` (đặt hàm riêng, gọi một dòng trong `fetch`, trước nhánh 404)
```js
import { validatePack, checkDraft, lopKey } from '../frontend/hoc/phieu-core.js'; // nếu wrangler không gói được đường dẫn này, chép sang worker/phieu-core.js và giữ test so hai bản giống nhau
const J = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
async function studentFromToken(request, signingKeys) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ') || !signingKeys?.publicKey) return null;
  const v = await verifyJwtToken(h.slice(7).trim(), signingKeys.publicKey);
  const c = v.valid ? v.payload.claims || {} : null;
  if (!c || TeacherAuthContract.hasTeacherClaims(v.payload) || !c.class_code) return null; // cùng cách route bài học (~dòng 2950) loại token GV
  return { uid: String(v.payload.uid || v.payload.sub), name: String(c.name || ''), lop: String(c.class_code), grade: Number(c.grade) };
}
export async function handlePhieu(request, env, signingKeys, cors) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/api\/pwa\/phieu\/([a-z0-9_]{3,40})(?:\/(draft|lock|submit))?$/);
  if (!m) return null;                                                   // không phải route phiếu
  if (env.PHIEU_ENABLED === '0') return J({ error: 'PHIEU_OFF', detail: 'Chức năng Học AI đang tắt.' }, 404, cors);
  const me = await studentFromToken(request, signingKeys);
  if (!me) return J({ error: 'UNAUTHORIZED', detail: 'Hãy đăng nhập lại.' }, 401, cors);
  const [, packId, act] = m;
  const pr = await rtdb(env, signingKeys, 'GET', `phieu_bo/${packId}`);
  const pack = pr.ok ? await pr.json() : null;
  if (!pack || pack.an) return J({ error: 'PACK_NOT_FOUND', detail: 'Không tìm thấy bài.' }, 404, cors);
  if (pack.grade !== me.grade) return J({ error: 'GRADE_MISMATCH', detail: 'Bài này không dành cho khối của em.' }, 403, cors);
  const path = `phieu_bai/${packId}/${lopKey(me.lop)}/${me.uid}`;
  const br = await rtdb(env, signingKeys, 'GET', path);
  const bai = (br.ok ? await br.json() : null) || { answers: {}, locked: {}, status: 'draft', rev: 0 };
  if (request.method === 'GET' && !act) return J({ pack, bai }, 200, cors);   // KHÔNG bao giờ đọc phieu_dapan ở đây
  const body = await request.json().catch(() => ({}));
  if (Number(body.rev) !== Number(bai.rev)) return J({ error: 'REV_CONFLICT', detail: 'Bài đã được lưu từ máy khác. Tải lại để xem bản mới.', rev: bai.rev }, 409, cors);
  if (!['draft', 'returned'].includes(bai.status)) return J({ error: 'NOT_EDITABLE', detail: 'Bài đã nộp. Chờ thầy cô trả bài để sửa.' }, 409, cors);
  const base = { name: me.name, class_code: me.lop, updated_at: Date.now(), pack_rev: pack.rev };
  if (act === 'draft' && request.method === 'PUT') {
    const r = checkDraft(pack, body.answers, bai.locked || {});
    if (!r.ok) return J({ error: r.error, field: r.field, detail: 'Dữ liệu chưa hợp lệ.' }, r.error === 'FIELD_LOCKED' ? 409 : 400, cors);
    const next = { ...bai, ...base, answers: { ...bai.answers, ...r.clean }, rev: bai.rev + 1 };
    await rtdb(env, signingKeys, 'PUT', path, next);
    return J({ rev: next.rev }, 200, cors);
  }
  if (act === 'lock' && request.method === 'POST') {
    const ids = [...new Map([...(pack.activities || [])].flatMap(a => a.fields).filter(f => f.lock === body.lock).map(f => [f.id, f]))].map(([id]) => id);
    if (!ids.length) return J({ error: 'LOCK_UNKNOWN', detail: 'Không có mục cần chốt.' }, 400, cors);
    const locked = { ...(bai.locked || {}) }; for (const id of ids) locked[id] = locked[id] || Date.now();
    const next = { ...bai, ...base, locked, rev: bai.rev + 1 };
    await rtdb(env, signingKeys, 'PUT', path, next);
    return J({ rev: next.rev, locked }, 200, cors);
  }
  if (act === 'submit' && request.method === 'POST') {
    const rev = bai.rev + 1, lsPath = `phieu_ls/${packId}/${me.uid}/${rev}`;
    const ex = await rtdb(env, signingKeys, 'GET', lsPath);
    if (ex.ok && (await ex.json()) !== null) return J({ error: 'REV_CONFLICT', detail: 'Thử lại.' }, 409, cors);
    await rtdb(env, signingKeys, 'PUT', lsPath, { answers: bai.answers, pack_rev: pack.rev, status: 'submitted', at: Date.now(), by: 'hs' });
    const next = { ...bai, ...base, status: 'submitted', submitted_at: Date.now(), rev };
    await rtdb(env, signingKeys, 'PUT', path, next);
    return J({ rev, status: 'submitted' }, 200, cors);
  }
  return J({ error: 'METHOD', detail: 'Phương thức không được hỗ trợ.' }, 405, cors);
}
// trong fetch(): const ph = await handlePhieu(request, env, signingKeys, corsHeaders); if (ph) return ph;
```
Thêm `PHIEU_ENABLED = "1"` vào `[vars]`. Nạp gói lên RTDB (`phieu_bo/ai9_bai2` và bản gốc `phieu_bo_goc/ai9_bai2`) để ở giai đoạn 6, cùng lúc deploy thử.

## 3. Test FAIL-first (viết trước, chạy thấy đỏ, rồi mới viết mã)
- `tests/test_phieu_core.mjs`, các ca C1–C7 ở tệp 06. Bổ sung:
  - **C1:** `validatePack(gói thật)` trả `[]`.
  - **C2:** chuỗi JSON gói thật không chứa `'Ngô Quyền'`, `'cố gắng học tốt hơn'`, `'92 triệu'`.
  - **C3b:** `checkDraft(pack, {n_c1:'x'})` trả `FIELD_GROUP`.
  - **C3c:** `checkDraft(pack, {hd1_chon:['a']}, {hd1_chon: 1})` trả `FIELD_LOCKED`.
  - **C6:** `csvSafe('=1+1')` trả `"'=1+1"` (có ngoặc kép bao ngoài).
- `tests/test_phieu_worker.mjs`, các ca W1–W10, W19–W21 ở tệp 06 (RTDB giả trong bộ nhớ, nạp `phieu_bo/ai9_bai2` từ tệp JSON). W9 phần giáo viên trả bài để giai đoạn 4; ở giai đoạn này chỉ kiểm `phieu_ls/…/1` tồn tại sau khi nộp và không bị ghi đè khi nộp lần hai (409).

## Xong khi
- Hai tệp test mới xanh, bộ test cũ xanh (ghi số ca PASS thật vào `aisgk.md`).
- Không có đường nào trả `phieu_dapan` cho token học sinh.
- Không deploy ở bước này. Chuyển Claude kiểm (mức CAO), có ACCEPT mới sang giai đoạn 3 (giao diện học sinh) và giai đoạn 7 (trình soạn gói cho GV, bắt buộc trước khi dùng thật).

## Ràng buộc
Không sửa route/luật/IndexedDB cũ. Không ghi bí mật hay dữ liệu HS thật. Một mình Antigravity sửa mã trong lúc làm.
