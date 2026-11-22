// @ts-check
// Lõi phiếu học tập (Học AI): hàm thuần dùng chung Worker / giao diện / test. Không DOM, không mạng.
// Bản sao y hệt nằm ở frontend/hoc/phieu-core.js (test_phieu_core kiểm hai bản giống nhau từng byte).
export const KINDS = ['toi_thieu', 'bo_tro', 'moc', 'tu_danh_gia', 'khong_cham', 'dong_gop'];
export const MUC_GV = ['chua_thay', 'dat', 'kha', 'tot'];
export const FIELD_TYPES = ['heading', 'text', 'textarea', 'choice', 'multi', 'scale', 'members'];
export const MAX_DRAFT = 40000;

/** Khóa lớp an toàn cho đường dẫn RTDB. @param {unknown} s */
export const lopKey = s => String(s || '').trim().toLowerCase().replace(/[.#$[\]/\s]/g, '_').slice(0, 40);
/** Mã học sinh an toàn cho đường dẫn RTDB; null nếu có ký tự lạ. @param {unknown} s */
export const safeUid = s => (/^[A-Za-z0-9_-]{1,64}$/.test(String(s || '')) ? String(s) : null);
/** Mã nhóm: số 1..20. @param {unknown} n */
export const nhomKey = n => { const v = Number(n); return Number.isInteger(v) && v >= 1 && v <= 20 ? 'n' + v : null; };

/** @param {any} pack @returns {Map<string, any>} */
export function fieldMap(pack) {
  const m = new Map();
  for (const a of pack?.activities || []) for (const f of a.fields || []) m.set(f.id, f);
  return m;
}
/** @param {any} pack @param {any} f @returns {string[]} */
export function optionsOf(pack, f) {
  const o = Array.isArray(f?.options) ? f.options : pack?.options?.[f?.options_ref];
  return Array.isArray(o) ? o.map(String) : [];
}
/** Trường có đang hiện với bộ câu trả lời này không (show_if). @param {any} f @param {Record<string, any>} ans */
export function isShown(f, ans) {
  if (!f?.show_if) return true;
  return Object.entries(f.show_if).every(([k, vals]) => {
    const v = ans?.[k];
    return Array.isArray(v) ? v.some(x => vals.includes(x)) : vals.includes(v);
  });
}
const isEmpty = v => v === null || v === undefined || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');

/** Kiểm lược đồ gói. @param {any} pack @returns {string[]} lỗi tiếng Việt, rỗng = hợp lệ */
export function validatePack(pack) {
  const e = [];
  if (!pack || pack.schema !== 1 || !/^[a-z0-9_]{3,40}$/.test(pack.id || '')) e.push('Gói thiếu id hoặc schema.');
  if (!pack?.title || typeof pack.title !== 'string') e.push('Gói thiếu tên bài.');
  if (!Number.isInteger(pack?.grade) || pack.grade < 1 || pack.grade > 12) e.push('Khối lớp phải từ 1 đến 12.');
  for (const k of Object.keys(pack?.blocks || {})) if (!/^[a-z0-9_]{2,40}$/.test(k)) e.push(`Mã học liệu không hợp lệ: ${k}`);
  if (JSON.stringify(pack || {}).length > 400000) e.push('Gói quá lớn.');
  const ids = new Set();
  for (const a of pack?.activities || []) {
    if (!/^[a-z0-9_]{2,40}$/.test(a.id || '')) e.push(`Mã hoạt động không hợp lệ: ${a.id}`);
    for (const b of a.blocks || []) if (!pack.blocks?.[b]) e.push(`Hoạt động ${a.id} dùng học liệu không có: ${b}`);
    for (const f of a.fields || []) {
      if (!/^[a-z0-9_]{2,40}$/.test(f.id || '')) e.push(`Mã trường không hợp lệ: ${f.id}`);
      if (ids.has(f.id)) e.push(`Trùng mã trường: ${f.id}`);
      ids.add(f.id);
      if (!FIELD_TYPES.includes(f.type)) e.push(`Trường ${f.id} có kiểu lạ: ${f.type}`);
      if (typeof f.label !== 'string' || !f.label.trim()) e.push(`Trường ${f.id} thiếu nhãn.`);
      if (f.type !== 'heading' && !KINDS.includes(f.evidence?.kind)) e.push(`Trường ${f.id} thiếu loại minh chứng.`);
      if (['choice', 'multi', 'scale'].includes(f.type) && !optionsOf(pack, f).length) e.push(`Trường ${f.id} chưa có lựa chọn.`);
      if (f.type === 'members' && f.mode !== 'nhom') e.push(`Trường ${f.id} chọn thành viên phải là trường nhóm.`);
    }
  }
  for (const r of pack?.reveal || []) if (!pack.blocks?.[r.block]) e.push(`Mở học liệu không có: ${r.block}`);
  const fm = fieldMap(pack);
  for (const y of pack?.yccd || []) {
    const ok = [...fm.values()].some(f => !f.an && f.mode !== 'nhom' && f.evidence?.code === y.code && f.evidence.kind === 'toi_thieu');
    if (!ok) e.push(`Yêu cầu ${y.code} chưa có trường minh chứng tối thiểu cá nhân.`);
  }
  if (pack?.ai_tutor !== false) e.push('Phiếu Học AI phải tắt Gia sư AI.');
  return e;
}

/**
 * Kiểm một giá trị theo trường. @param {any} pack @param {any} f @param {unknown} v
 * @returns {{ok:true, value:any}|{ok:false, error:string}}
 */
export function checkValue(pack, f, v) {
  const opts = optionsOf(pack, f);
  if (f.type === 'multi') {
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !opts.includes(x))) return { ok: false, error: 'FIELD_OPTION' };
    if (new Set(v).size !== v.length) return { ok: false, error: 'FIELD_OPTION' };
    if (f.exact && v.length > f.exact) return { ok: false, error: 'EXACT_' + f.exact };
    return { ok: true, value: v.slice() };
  }
  if (f.type === 'members') {
    if (!Array.isArray(v) || v.some(x => !safeUid(x))) return { ok: false, error: 'FIELD_TYPE' };
    if (v.length > (f.max_members || 8)) return { ok: false, error: 'FIELD_TOO_MANY' };
    return { ok: true, value: [...new Set(v)] };
  }
  if (typeof v !== 'string') return { ok: false, error: 'FIELD_TYPE' };
  if (v.length > (f.max || 2000)) return { ok: false, error: 'FIELD_TOO_LONG' };
  if ((f.type === 'choice' || f.type === 'scale') && v !== '' && !opts.includes(v)) {
    if (!(f.allow_custom && v.length <= 120)) return { ok: false, error: 'FIELD_OPTION' };
  }
  return { ok: true, value: v };
}

/**
 * Kiểm bản nháp cá nhân (chỉ phần gửi lên). @param {any} pack @param {Record<string, any>} answers @param {Record<string, number>} locked
 * @returns {{ok:true, clean:Record<string, any>}|{ok:false, error:string, field?:string}}
 */
export function checkDraft(pack, answers, locked = {}) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { ok: false, error: 'FIELD_TYPE' };
  const fm = fieldMap(pack); const clean = {}; let total = 0;
  for (const [id, v] of Object.entries(answers)) {
    const f = fm.get(id);
    if (!f || f.type === 'heading' || f.an) return { ok: false, error: 'FIELD_UNKNOWN', field: id };
    if (f.mode === 'nhom') return { ok: false, error: 'FIELD_GROUP', field: id };
    if (locked[id]) return { ok: false, error: 'FIELD_LOCKED', field: id };
    const r = checkValue(pack, f, v);
    if (!r.ok) return { ok: false, error: r.error, field: id };
    clean[id] = r.value; total += JSON.stringify(r.value).length;
  }
  if (total > MAX_DRAFT) return { ok: false, error: 'DRAFT_TOO_BIG' };
  return { ok: true, clean };
}

/** Kiểm phần nhóm gửi lên (chỉ trường mode nhom). */
export function checkGroup(pack, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { ok: false, error: 'FIELD_TYPE' };
  const fm = fieldMap(pack); const clean = {}; let total = 0;
  for (const [id, v] of Object.entries(answers)) {
    const f = fm.get(id);
    if (!f || f.type === 'heading' || f.an || f.mode !== 'nhom') return { ok: false, error: 'FIELD_UNKNOWN', field: id };
    const r = checkValue(pack, f, v);
    if (!r.ok) return { ok: false, error: r.error, field: id };
    clean[id] = r.value; total += JSON.stringify(r.value).length;
  }
  if (total > MAX_DRAFT) return { ok: false, error: 'DRAFT_TOO_BIG' };
  return { ok: true, clean };
}

/** Trường cá nhân còn thiếu khi nộp (bắt buộc, đang hiện, chưa ẩn). @returns {string[]} */
export function missingForSubmit(pack, answers) {
  const miss = [];
  for (const f of fieldMap(pack).values()) {
    if (f.type === 'heading' || f.an || f.mode === 'nhom' || !f.required || !isShown(f, answers)) continue;
    const v = answers?.[f.id];
    if (isEmpty(v) || (f.type === 'multi' && f.exact && v.length !== f.exact)) miss.push(f.id);
  }
  return miss;
}

/** Học liệu học sinh đã được xem. @param {any} pack @param {Record<string, any>} opened (phieu_mo của lớp) @param {Record<string, any>} ans */
export function openBlocks(pack, opened, ans) {
  const out = new Set(Object.keys(pack?.blocks || {}));
  for (const r of pack?.reveal || []) {
    const byGv = !!opened?.[r.block];
    const byField = r.after_field ? !isEmpty(ans?.[r.after_field]) : false;
    if (!byGv && !byField) out.delete(r.block);
  }
  return out;
}

/** Bản gói gửi cho học sinh: bỏ học liệu chưa mở, bỏ trường bị ẩn. Không bao giờ chứa đáp án (đáp án nằm ở nhánh khác). */
export function studentView(pack, opened, ans) {
  const open = openBlocks(pack, opened, ans);
  const blocks = {};
  for (const [k, b] of Object.entries(pack.blocks || {})) if (open.has(k)) blocks[k] = b;
  return {
    ...pack,
    blocks,
    locked_blocks: Object.keys(pack.blocks || {}).filter(k => !open.has(k)),
    activities: (pack.activities || []).filter(a => !a.an).map(a => ({ ...a, fields: (a.fields || []).filter(f => !f.an) }))
  };
}

/**
 * Kiểm bản sửa gói của giáo viên so với bản đang dùng: mã trường cũ không được mất (chỉ được ẩn), kiểu không đổi.
 * @returns {string[]}
 */
export function checkEdit(oldPack, next) {
  const e = validatePack(next);
  if (oldPack && next?.id !== oldPack.id) e.push('Không được đổi mã gói.');
  const nm = fieldMap(next);
  for (const f of fieldMap(oldPack).values()) {
    const g = nm.get(f.id);
    if (!g) e.push(`Không được xóa trường ${f.id}; hãy ẩn trường.`);
    else if (g.type !== f.type) e.push(`Không được đổi kiểu trường ${f.id}.`);
  }
  return e;
}

/** Chặn chèn công thức khi mở CSV bằng Excel. @param {unknown} v */
export function csvSafe(v) {
  let s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
