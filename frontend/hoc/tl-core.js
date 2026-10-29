// @ts-check
// Lõi Thảo luận trên lớp (kiểu Mentimeter), dùng chung giáo viên / học sinh / kiểm thử. Hàm thuần, không đụng DOM hay mạng.
// Theo tài liệu công khai của Mentimeter: đám mây từ khóa gộp chữ thường, từ gửi nhiều thì to hơn, nên ≤ 25 ký tự, tối đa 400 từ;
// giáo viên gỡ được ý kiến (gỡ một ý thì gỡ mọi ý giống hệt); có bộ lọc từ ngữ nhưng không bắt được hết nên vẫn cần duyệt tay.

export const TYPES = /** @type {const} */ ({ cloud: 'Đám mây từ khóa', open: 'Câu trả lời mở', poll: 'Bình chọn', scale: 'Thang điểm 1–5', qa: 'Hỏi đáp' });
/** @typedef {keyof typeof TYPES} TlType */
/** @typedef {{type:TlType,text:string,opts?:string[],items?:string[],max?:number,mod?:boolean}} Slide */
export const MAX_SLIDES = 20;
export const MAX_LEN = /** @type {Record<string, number>} */ ({ cloud: 25, open: 200, qa: 200 });
export const CLOUD_TOP = 100;

const sp = (/** @type {unknown} */ v) => v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
/** Chuẩn hóa một từ cho đám mây: chữ thường, bỏ khoảng trắng thừa, bỏ dấu câu ở hai đầu (giữ dấu tiếng Việt). @param {string} s */
export const normWord = s => sp(s).normalize('NFC').toLowerCase().replace(/^[\s"'“”‘’.,;:!?()[\]{}…-]+|[\s"'“”‘’.,;:!?()[\]{}…-]+$/g, '');
/** Bỏ dấu, đổi ký tự lách luật (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s), gộp chữ lặp, chỉ giữ chữ số và khoảng trắng. @param {string} s */
export function fold(s) {
  return sp(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[013457@$]/g, c => /** @type {Record<string,string>} */ ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' })[c])
    .replace(/[^a-z0-9\s]+/g, ' ').replace(/([a-z])\1+/g, '$1').replace(/\s+/g, ' ').trim()
    .replace(/\b([a-z])\s(?=[a-z]\b)/g, '$1');   // "d m", "v c l" → "dm", "vcl"
}
// Bộ lọc từ ngữ (không đầy đủ, như Mentimeter cũng nói rõ): 1) từ có dấu so khớp nguyên từ, 2) từ viết tắt / không dấu sau khi "fold".
// Không chặn "cac", "lon"... vì trùng từ thường khi gõ không dấu ("các", "lon nước"); những trường hợp đó giáo viên duyệt tay.
const BAD_VI = ['lồn', 'cặc', 'buồi', 'địt', 'đĩ', 'đụ', 'đéo', 'đếch', 'cứt', 'dái', 'óc chó', 'đồ chó', 'thằng chó', 'con chó má', 'chó chết', 'mẹ mày', 'bố mày', 'con mẹ mày', 'đồ ngu', 'thằng ngu', 'con ngu', 'ngu như bò', 'ngu như chó', 'mặt lồn', 'vãi lồn', 'vãi cả lồn', 'khốn nạn', 'súc vật', 'đần độn'];
const BAD_ASCII = ['dm', 'dmm', 'dcm', 'dkm', 'dcmm', 'dmml', 'vl', 'vcl', 'vkl', 'vklm', 'cmm', 'clm', 'dit', 'djt', 'deo', 'dis me', 'dit me', 'du ma', 'du me', 'dit con me', 'me may', 'oc cho', 'do cho', 'thang cho', 'cho chet', 'do ngu', 'thang ngu', 'con ngu', 'vai lon', 'mat lon', 'khon nan', 'suc vat', 'fuck', 'fck', 'shit', 'bitch', 'dick'];
const words = (/** @type {string} */ s) => ` ${s} `;
/**
 * Câu có từ ngữ không phù hợp không. Trả về từ bị bắt (rỗng nếu không có).
 * @param {string} text @param {string[]} [extra] từ cấm giáo viên thêm
 */
export function badWord(text, extra = []) {
  const low = ` ${sp(text).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ')} `;
  for (const w of BAD_VI) if (low.includes(words(w))) return w;
  const f = words(fold(text));
  for (const w of [...BAD_ASCII, ...extra.map(x => fold(x)).filter(Boolean)]) if (f.includes(words(w))) return w;
  for (const w of extra.map(x => sp(x).toLowerCase()).filter(Boolean)) if (low.includes(words(w))) return w;
  return '';
}

/**
 * Đám mây từ khóa: gộp chữ thường, đếm, bỏ từ bị ẩn và từ bị lọc, lấy CLOUD_TOP từ nhiều nhất.
 * @param {string[]} entries @param {string[]} [hidden] @param {string[]} [extra] @returns {{w:string,n:number}[]}
 */
export function cloud(entries, hidden = [], extra = []) {
  const hide = new Set(hidden.map(normWord));
  /** @type {Map<string, number>} */ const m = new Map();
  for (const e of entries) { const w = normWord(e).slice(0, MAX_LEN.cloud); if (!w || hide.has(w) || badWord(w, extra)) continue; m.set(w, (m.get(w) || 0) + 1); }
  return [...m.entries()].map(([w, n]) => ({ w, n })).sort((a, b) => b.n - a.n || a.w.localeCompare(b.w, 'vi')).slice(0, CLOUD_TOP);
}
/** Cỡ chữ của một từ trong đám mây (px), tỉ lệ căn bậc hai theo số lần. @param {number} n @param {number} max @param {number} [lo] @param {number} [hi] */
export const cloudSize = (n, max, lo = 20, hi = 76) => Math.round(lo + (hi - lo) * Math.sqrt(Math.max(0, Math.min(n, max)) / Math.max(1, max)));   // từ nhiều nhất luôn to nhất (kể cả khi mới có 1 từ)

/** Đếm bình chọn. @param {string[]} values chỉ số phương án ("0".."5") @param {number} nOpts */
export function pollCounts(values, nOpts) {
  const c = Array.from({ length: nOpts }, () => 0);
  for (const v of values) { const i = Number(v); if (Number.isInteger(i) && i >= 0 && i < nOpts && /^\d$/.test(String(v))) c[i]++; }
  return c;
}
/** Thang điểm 1–5 nhiều tiêu chí. Mỗi bài gửi là chuỗi "4|5|3". @param {string[]} values @param {number} nItems */
export function scaleStats(values, nItems) {
  const out = Array.from({ length: nItems }, () => ({ n: 0, sum: 0, avg: 0, dist: [0, 0, 0, 0, 0] }));
  for (const v of values) {
    const parts = String(v).split('|'); if (parts.length !== nItems || !parts.every(p => /^[1-5]$/.test(p))) continue;
    parts.forEach((p, i) => { const x = Number(p); out[i].n++; out[i].sum += x; out[i].dist[x - 1]++; });
  }
  for (const o of out) o.avg = o.n ? Math.round((o.sum / o.n) * 10) / 10 : 0;
  return out;
}
/** Chuỗi gửi lên của thang điểm (kiểm hợp lệ). @param {number[]} scores */
export const scaleValue = scores => scores.every(x => Number.isInteger(x) && x >= 1 && x <= 5) ? scores.join('|') : '';

/**
 * Gom mọi ý đã gửi của một trang: y = {mã: {0:{v,t},1:{v,t}}}. Trả danh sách có id = "mã~số".
 * @param {Record<string, Record<string, {v:string,t:number}>>|null|undefined} y @returns {{id:string,ma:string,v:string,t:number}[]}
 */
export function entriesOf(y) {
  /** @type {{id:string,ma:string,v:string,t:number}[]} */ const out = [];
  for (const [ma, byN] of Object.entries(y || {})) for (const [n, e] of Object.entries(byN || {})) if (e && typeof e.v === 'string') out.push({ id: `${ma}~${n}`, ma, v: e.v, t: Number(e.t) || 0 });
  return out.sort((a, b) => a.t - b.t);
}
/** Gỡ một ý thì gỡ mọi ý giống hệt (như Mentimeter). @param {{id:string,v:string}[]} list @param {Record<string, unknown>} an id đã ẩn */
export function visible(list, an = {}) {
  const hiddenText = new Set(list.filter(e => an[e.id]).map(e => normWord(e.v)));
  return list.filter(e => !an[e.id] && !hiddenText.has(normWord(e.v)));
}
/** Hỏi đáp: số phiếu "Cùng thắc mắc", xếp nhiều phiếu lên trên, câu đã trả lời xuống cuối. @param {{id:string,v:string,t:number}[]} qs @param {Record<string, Record<string, unknown>>} votes @param {Record<string, unknown>} [done] */
export function qaRank(qs, votes = {}, done = {}) {
  return qs.map(q => ({ ...q, votes: Object.keys(votes?.[q.id] || {}).length, done: !!done[q.id] }))
    .sort((a, b) => Number(a.done) - Number(b.done) || b.votes - a.votes || a.t - b.t);
}

/** Kiểm một trang khi soạn. @param {Slide} s @returns {string} lỗi (rỗng = hợp lệ) */
export function slideError(s) {
  if (!s || !(s.type in TYPES)) return 'Chọn loại câu hỏi.';
  if (!sp(s.text)) return 'Nhập câu hỏi thảo luận.';
  if (sp(s.text).length > 300) return 'Câu hỏi tối đa 300 ký tự.';
  if (s.type === 'poll') { const o = (s.opts || []).map(sp).filter(Boolean); if (o.length < 2) return 'Bình chọn cần ít nhất 2 lựa chọn.'; if (o.length > 6) return 'Tối đa 6 lựa chọn.'; }
  if (s.type === 'scale') { const it = (s.items || []).map(sp).filter(Boolean); if (!it.length) return 'Thang điểm cần ít nhất 1 tiêu chí.'; if (it.length > 6) return 'Tối đa 6 tiêu chí.'; }
  return '';
}
/** Chuẩn hóa một trang để lưu / phát. @param {any} s @returns {Slide} */
export function cleanSlide(s) {
  const type = /** @type {TlType} */ (s?.type in TYPES ? s.type : 'open');
  /** @type {Slide} */ const out = { type, text: sp(s?.text).slice(0, 300) };
  if (type === 'poll') out.opts = (Array.isArray(s.opts) ? s.opts : Object.values(s.opts || {})).map(sp).filter(Boolean).slice(0, 6).map(x => x.slice(0, 80));
  if (type === 'scale') out.items = (Array.isArray(s.items) ? s.items : Object.values(s.items || {})).map(sp).filter(Boolean).slice(0, 6).map(x => x.slice(0, 80));
  if (type === 'cloud' || type === 'qa') out.max = Math.max(1, Math.min(3, Number(s.max) || (type === 'cloud' ? 3 : 2)));
  if (type === 'open' || type === 'qa') out.mod = s.mod !== false;
  return out;
}

/** Cột file Excel mẫu cho bộ thảo luận. */
export const TL_COLUMNS = ['STT', 'Loại', 'Câu hỏi', 'Lựa chọn / tiêu chí 1', 'Lựa chọn / tiêu chí 2', 'Lựa chọn / tiêu chí 3', 'Lựa chọn / tiêu chí 4', 'Lựa chọn / tiêu chí 5', 'Lựa chọn / tiêu chí 6', 'Số ý mỗi em'];
const TYPE_ALIASES = /** @type {Record<string, TlType>} */ ({ 'đám mây': 'cloud', 'đám mây từ khóa': 'cloud', 'tu khoa': 'cloud', cloud: 'cloud', 'trả lời mở': 'open', 'câu trả lời mở': 'open', mở: 'open', open: 'open', 'bình chọn': 'poll', poll: 'poll', 'thang điểm': 'scale', 'thang điểm 1–5': 'scale', 'thang điểm 1-5': 'scale', scale: 'scale', 'hỏi đáp': 'qa', qa: 'qa' });
/** Đọc dòng Excel → các trang thảo luận. @param {unknown[][]} rows */
export function parseTlRows(rows) {
  /** @type {Slide[]} */ const slides = []; /** @type {string[]} */ const errors = [];
  if (!Array.isArray(rows) || rows.length < 2) return { slides, errors, fatal: 'File trống. Hãy tải file mẫu rồi điền.' };
  const h = (rows[0] || []).map(v => sp(v).toLowerCase());
  if (h[1] !== 'loại' || h[2] !== 'câu hỏi') return { slides, errors, fatal: 'File không đúng mẫu. Hãy bấm "Tải file mẫu" và điền đúng các cột.' };
  rows.slice(1).forEach((row, i) => {
    const r = /** @type {unknown[]} */ (row || []), line = i + 2;
    if (!sp(r[1]) && !sp(r[2])) return;
    const type = TYPE_ALIASES[sp(r[1]).toLowerCase()];
    if (!type) { errors.push(`Dòng ${line}: loại "${sp(r[1])}" chưa đúng (Đám mây, Trả lời mở, Bình chọn, Thang điểm, Hỏi đáp).`); return; }
    const list = r.slice(3, 9).map(sp).filter(Boolean);
    const s = cleanSlide({ type, text: r[2], opts: list, items: list, max: r[9] });
    const err = slideError(s); if (err) { errors.push(`Dòng ${line}: ${err}`); return; }
    slides.push(s);
  });
  if (slides.length > MAX_SLIDES) { errors.push(`Chỉ lấy ${MAX_SLIDES} trang đầu.`); slides.length = MAX_SLIDES; }
  if (!slides.length && !errors.length) return { slides, errors, fatal: 'Không tìm thấy câu hỏi nào trong file.' };
  return { slides, errors };
}

/**
 * Tổng hợp một trang (dùng cho màn kết thúc, CSV, gửi AI không kèm tên, nhận xét tính sẵn).
 * @param {Slide} s @param {{id:string,ma:string,v:string,t:number}[]} list @param {{an?:Record<string,unknown>,ok?:Record<string,unknown>,anw?:string[],votes?:any,done?:any,cam?:string[]}} st
 */
export function summarize(s, list, st = {}) {
  const shown = visible(list, st.an || {}).filter(e => !badWord(e.v, st.cam || []));
  const approved = (s.type === 'open' || s.type === 'qa') && s.mod ? shown.filter(e => st.ok?.[e.id]) : shown;
  const people = new Set(list.map(e => e.ma)).size;
  if (s.type === 'cloud') return { type: s.type, people, cloud: cloud(list.map(e => e.v), st.anw || [], st.cam || []) };
  if (s.type === 'poll') return { type: s.type, people, counts: pollCounts(list.map(e => e.v), (s.opts || []).length) };
  if (s.type === 'scale') return { type: s.type, people, scale: scaleStats(list.map(e => e.v), (s.items || []).length) };
  if (s.type === 'qa') return { type: s.type, people, qa: qaRank(approved, st.votes || {}, st.done || {}) };
  return { type: s.type, people, open: approved };
}
/** Nhận xét tính sẵn (khi AI chưa trả lời được). @param {Slide[]} slides @param {ReturnType<typeof summarize>[]} sums */
export function localNotes(slides, sums) {
  return slides.map((s, i) => {
    const r = /** @type {any} */ (sums[i] || {}); const head = `Trang ${i + 1} (${TYPES[s.type]}): ${r.people || 0} em tham gia.`;
    if (s.type === 'cloud') return `${head} Từ nhiều nhất: ${(r.cloud || []).slice(0, 5).map((/** @type {any} */ x) => `"${x.w}" (${x.n})`).join(', ') || 'chưa có'}.`;
    if (s.type === 'poll') { const c = r.counts || [], tot = c.reduce((a, b) => a + b, 0) || 1, top = c.indexOf(Math.max(...c, 0)); return `${head} Nhiều nhất: "${(s.opts || [])[top] || ''}" ${Math.round(100 * (c[top] || 0) / tot)}%.`; }
    if (s.type === 'scale') return `${head} ${(s.items || []).map((it, j) => `${it}: ${r.scale?.[j]?.avg || 0}/5`).join('; ')}.`;
    if (s.type === 'qa') return `${head} Câu hỏi được quan tâm nhất: ${(r.qa || []).slice(0, 3).map((/** @type {any} */ q) => `"${q.v}" (${q.votes} phiếu)`).join('; ') || 'chưa có'}.`;
    return `${head} ${(r.open || []).length} ý kiến đã duyệt.`;
  });
}
