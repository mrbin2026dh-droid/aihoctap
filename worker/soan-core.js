// @ts-check
// Trình soạn bài Học AI dùng chung: bài → hoạt động → câu hỏi (8 dạng). Hàm thuần, không DOM, không mạng.
// Bản sao y hệt ở frontend/hoc/soan-core.js. Máy chủ dùng lessonToPack để tách đáp án khỏi bài học sinh.
import { validatePack, fieldMap } from './phieu-core.js';

export const QTYPES = /** @type {const} */ ({
  mot: 'Trắc nghiệm 1 đáp án',
  nhieu: 'Nhiều đáp án đúng',
  dung_sai: 'Đúng / Sai từng ý',
  phan_loai: 'Xếp vào nhóm',
  ghep: 'Ghép đôi',
  thu_tu: 'Sắp xếp thứ tự',
  dien: 'Điền câu trả lời ngắn',
  tu_luan: 'Tự luận (thầy cô chấm)'
});
export const DUNG_SAI = ['Đúng', 'Sai'];
export const ID_RE = /^[a-z][a-z0-9_]{2,30}$/;
const MAX_TEXT = 2000;

const clean = (/** @type {unknown} */ s, max = MAX_TEXT) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Chuẩn hoá câu trả lời điền: bỏ khoảng trắng thừa, chữ thường, NFC (giữ dấu tiếng Việt). @param {unknown} s */
export const normAns = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** Mã ngẫu nhiên cho bài/hoạt động/câu. @param {string} prefix */
export function newId(prefix) {
  const b = new Uint8Array(5); crypto.getRandomValues(b);
  return prefix + [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Xáo trộn ổn định theo mã câu (học sinh nào cũng thấy cùng thứ tự, không phải thứ tự đáp án). @template T @param {T[]} arr @param {string} seed @returns {T[]} */
export function stableShuffle(arr, seed) {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Kiểm một câu hỏi; trả lỗi tiếng Việt (gắn với ô cụ thể) hoặc null.
 * @param {any} q @returns {{field:string, msg:string}|null}
 */
export function checkQuestion(q) {
  if (!q || !Object.hasOwn(QTYPES, q.type)) return { field: 'type', msg: 'Chọn dạng câu hỏi.' };
  if (!clean(q.prompt)) return { field: 'prompt', msg: 'Nhập nội dung câu hỏi.' };
  const opts = Array.isArray(q.options) ? q.options.map(x => clean(x, 500)) : [];
  const items = Array.isArray(q.items) ? q.items : [];
  if (q.type === 'mot' || q.type === 'nhieu') {
    if (opts.filter(Boolean).length < 2) return { field: 'options', msg: 'Cần ít nhất 2 lựa chọn có nội dung.' };
    if (opts.some(x => !x)) return { field: 'options', msg: 'Xóa lựa chọn để trống.' };
    if (new Set(opts).size !== opts.length) return { field: 'options', msg: 'Hai lựa chọn đang trùng nhau.' };
    const d = Array.isArray(q.dung) ? q.dung : [];
    if (d.some(i => !Number.isInteger(i) || i < 0 || i >= opts.length)) return { field: 'dung', msg: 'Đáp án đúng không hợp lệ.' };
    if (q.type === 'mot' && d.length > 1) return { field: 'dung', msg: 'Trắc nghiệm 1 đáp án chỉ chọn 1 đáp án đúng.' };
    if (q.type === 'nhieu' && d.length < 1) return { field: 'dung', msg: 'Đánh dấu ít nhất 1 đáp án đúng.' };
  }
  if (['dung_sai', 'phan_loai', 'ghep', 'thu_tu'].includes(q.type)) {
    if (items.length < 2) return { field: 'items', msg: 'Cần ít nhất 2 dòng.' };
    if (items.length > 12) return { field: 'items', msg: 'Tối đa 12 dòng.' };
    if (items.some(it => !clean(it?.text, 500))) return { field: 'items', msg: 'Có dòng chưa nhập nội dung.' };
    if (new Set(items.map(it => clean(it.text, 500))).size !== items.length) return { field: 'items', msg: 'Hai dòng đang trùng nhau.' };
  }
  if (q.type === 'dung_sai' && items.some(it => !DUNG_SAI.includes(it.dap))) return { field: 'items', msg: 'Mỗi ý chọn Đúng hoặc Sai.' };
  if (q.type === 'phan_loai') {
    const nhom = (Array.isArray(q.nhom) ? q.nhom : []).map(x => clean(x, 120));
    if (nhom.length < 2 || nhom.some(x => !x)) return { field: 'nhom', msg: 'Cần ít nhất 2 nhóm có tên.' };
    if (new Set(nhom).size !== nhom.length) return { field: 'nhom', msg: 'Hai nhóm đang trùng tên.' };
    if (items.some(it => !nhom.includes(clean(it.dap, 120)))) return { field: 'items', msg: 'Mỗi dòng chọn một nhóm.' };
  }
  if (q.type === 'ghep') {
    if (items.some(it => !clean(it.dap, 500))) return { field: 'items', msg: 'Mỗi dòng cần vế ghép bên phải.' };
    if (new Set(items.map(it => clean(it.dap, 500))).size !== items.length) return { field: 'items', msg: 'Hai vế bên phải đang trùng nhau.' };
  }
  if (q.type === 'dien') {
    const acc = (Array.isArray(q.chap_nhan) ? q.chap_nhan : []).map(x => clean(x, 200)).filter(Boolean);
    if (!acc.length) return { field: 'chap_nhan', msg: 'Nhập ít nhất 1 đáp án được chấp nhận.' };
  }
  if (clean(q.giai_thich).length > 1000) return { field: 'giai_thich', msg: 'Giải thích tối đa 1000 kí tự.' };
  return null;
}

/** Làm sạch câu hỏi trước khi lưu (giữ mã câu). @param {any} q */
export function cleanQuestion(q) {
  const out = { id: q.id, type: q.type, prompt: clean(q.prompt), giai_thich: clean(q.giai_thich, 1000), bat_buoc: q.bat_buoc !== false };
  if (q.yccd) out.yccd = clean(q.yccd, 20);
  if (q.type === 'mot' || q.type === 'nhieu') { out.options = q.options.map(x => clean(x, 500)); out.dung = [...new Set(q.dung || [])].sort((a, b) => a - b); }
  if (['dung_sai', 'phan_loai', 'ghep', 'thu_tu'].includes(q.type)) out.items = q.items.map(it => ({ text: clean(it.text, 500), ...(q.type === 'thu_tu' ? {} : { dap: clean(it.dap, 500) }) }));
  if (q.type === 'phan_loai') out.nhom = q.nhom.map(x => clean(x, 120));
  if (q.type === 'dien') out.chap_nhan = q.chap_nhan.map(x => clean(x, 200)).filter(Boolean);
  return out;
}

/** Kiểm cả bài soạn. @param {any} m @returns {string[]} */
export function checkLesson(m) {
  const e = [];
  if (!m || !ID_RE.test(String(m.id || ''))) e.push('Mã bài không hợp lệ.');
  if (!clean(m?.title)) e.push('Nhập tên bài.');
  if (!Number.isInteger(m?.grade) || m.grade < 1 || m.grade > 12) e.push('Chọn khối lớp.');
  const ids = new Set();
  for (const a of m?.activities || []) {
    if (!ID_RE.test(String(a.id || ''))) e.push('Mã hoạt động không hợp lệ.');
    if (!clean(a.title)) e.push('Có hoạt động chưa có tên.');
    for (const q of a.questions || []) {
      if (!ID_RE.test(String(q.id || '')) || ids.has(q.id)) e.push('Mã câu hỏi không hợp lệ hoặc trùng.');
      ids.add(q.id);
      const er = checkQuestion(q); if (er) e.push(`${a.title}: ${er.msg}`);
    }
  }
  return e;
}

/** Ô nhập (trường) của một câu cho bài học sinh và đáp án tương ứng. @param {any} q */
function questionFields(q) {
  const ev = q.yccd ? { code: q.yccd, kind: q.type === 'tu_luan' ? 'toi_thieu' : 'khong_cham' } : { kind: q.type === 'tu_luan' ? 'bo_tro' : 'khong_cham' };
  const req = q.bat_buoc !== false;
  /** @type {any[]} */ const fields = []; /** @type {Record<string, any>} */ const dap = {};
  if (q.type === 'mot') {
    fields.push({ id: q.id, type: 'choice', label: 'Chọn một đáp án', options: q.options, required: req, evidence: ev });
    if (q.dung.length) dap[q.id] = q.options[q.dung[0]];
  } else if (q.type === 'nhieu') {
    fields.push({ id: q.id, type: 'multi', label: 'Chọn tất cả đáp án đúng', options: q.options, required: req, evidence: ev });
    dap[q.id] = q.dung.map((/** @type {number} */ i) => q.options[i]);
  } else if (q.type === 'dien') {
    fields.push({ id: q.id, type: 'text', label: 'Câu trả lời của em', max: 200, required: req, evidence: ev });
    dap[q.id] = { chap_nhan: q.chap_nhan };
  } else if (q.type === 'tu_luan') {
    fields.push({ id: q.id, type: 'textarea', label: 'Bài làm của em', max: 2000, required: req, evidence: ev });
  } else {
    const n = q.items.length;
    const pos = q.type === 'thu_tu' ? q.items.map((/** @type {any} */ _, /** @type {number} */ i) => String(i + 1)) : null;
    const right = q.type === 'ghep' ? stableShuffle(q.items.map((/** @type {any} */ it) => it.dap), q.id) : null;
    const order = q.type === 'thu_tu' ? stableShuffle(q.items.map((/** @type {any} */ _, /** @type {number} */ i) => i), q.id + 't') : q.items.map((/** @type {any} */ _, /** @type {number} */ i) => i);
    for (const i of order) {
      const it = q.items[i]; const id = `${q.id}_${i + 1}`;
      const options = q.type === 'dung_sai' ? DUNG_SAI : q.type === 'phan_loai' ? q.nhom : q.type === 'ghep' ? right : pos;
      fields.push({ id, type: 'choice', label: it.text, options, kieu: q.type === 'ghep' || q.type === 'thu_tu' || n > 6 ? 'chon' : 'nut', required: req, evidence: ev });
      dap[id] = q.type === 'thu_tu' ? String(i + 1) : it.dap;
    }
  }
  return { fields, dap };
}

const LABEL_CARD = { mot: 'Chọn một đáp án.', nhieu: 'Chọn tất cả đáp án đúng.', dung_sai: 'Chọn Đúng hoặc Sai cho từng ý.', phan_loai: 'Xếp mỗi dòng vào một nhóm.',
  ghep: 'Ghép mỗi dòng với một vế bên phải.', thu_tu: 'Ghi số thứ tự đúng cho từng bước (1 là bước đầu tiên).', dien: 'Gõ câu trả lời ngắn.', tu_luan: 'Viết câu trả lời của em.' };

/**
 * Chuyển bài soạn thành gói học sinh (KHÔNG có đáp án, giải thích) và gói đáp án (chỉ giáo viên, máy chủ).
 * @param {any} m @returns {{pack:any, dapan:any}}
 */
export function lessonToPack(m) {
  /** @type {Record<string, any>} */ const kiem = {};
  const acts = (m.activities || []).map((/** @type {any} */ a) => {
    /** @type {any[]} */ const fields = []; /** @type {any[]} */ const the = [];
    (a.questions || []).forEach((/** @type {any} */ q, /** @type {number} */ k) => {
      const r = questionFields(q);
      fields.push(...r.fields);
      const auto = Object.keys(r.dap).length > 0;
      the.push({ ten: `Câu ${k + 1}`, noi_dung: q.prompt, ...(r.fields.length > 1 ? { goi_y: LABEL_CARD[/** @type {keyof typeof LABEL_CARD} */ (q.type)] } : {}), fields: r.fields.map(f => f.id), ...(auto ? { kiem: q.id } : {}) });
      if (auto) kiem[q.id] = { dap_an: r.dap, giai_thich: {}, chot: q.giai_thich || '', chot_luon: true };
    });
    return { id: a.id, title: a.title, blocks: [], fields, buoc: [{ tieu_de: a.title, huong_dan: a.huong_dan ? [a.huong_dan] : [], the }] };
  });
  const pack = { id: m.id, schema: 1, rev: 1, mon: m.mon || 'giao_duc_ai', grade: m.grade, thu_tu: m.thu_tu || 0, title: m.title, so_tiet: m.so_tiet || 0,
    ai_tutor: false, soan: true, yccd: Array.isArray(m.yccd) ? m.yccd : [], thang_muc_gv: ['Chưa thấy minh chứng', 'Đạt', 'Khá', 'Tốt'], options: {}, blocks: {}, reveal: [], activities: acts };
  return { pack, dapan: { id: m.id, schema: 1, chi_gv: true, kiem } };
}

/** Giữ ô của câu đã xóa (ẩn) để không mất bài học sinh đã làm và không vi phạm checkEdit. @param {any} oldPack @param {any} pack */
export function keepRemoved(oldPack, pack) {
  if (!oldPack) return pack;
  const now = fieldMap(pack); /** @type {any[]} */ const gone = [];
  for (const f of fieldMap(oldPack).values()) {
    if (!now.has(f.id)) gone.push({ ...f, an: true });
  }
  if (gone.length) pack.activities.push({ id: 'da_xoa', title: 'Câu đã xóa', an: true, blocks: [], fields: gone });
  return pack;
}

/** Kiểm gói chuyển từ bài soạn (luật YCCĐ chỉ áp dụng khi bài khai báo YCCĐ). @param {any} pack */
export function checkSoanPack(pack) { return validatePack(pack); }
