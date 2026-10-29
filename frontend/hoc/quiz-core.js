// @ts-check
// Lõi Luyện tập trên lớp (dùng chung giáo viên / học sinh / kiểm thử). Hàm thuần, không đụng DOM hay mạng.
//
// Điểm theo công thức Kahoot công bố (support.kahoot.com "How points work"):
//   điểm = làm tròn( (1 − (thời gian trả lời / thời gian câu hỏi) / 2) × 1000 )  → đúng ngay: 1000, đúng sát giờ: 500, sai/không trả lời: 0.
// Chuỗi đúng liên tiếp chỉ để hiển thị và trao danh hiệu (không cộng điểm), tránh tự đặt luật không có nguồn.

export const L = /** @type {const} */ (['A', 'B', 'C', 'D']);
export const MAX_Q = 50;

/** @param {boolean} ok @param {number} ms thời gian trả lời (mili giây) @param {number} limSec thời gian câu hỏi (giây) */
export function points(ok, ms, limSec) {
  if (!ok) return 0;
  const r = Math.min(1, Math.max(0, Number(ms) || 0) / (Math.max(1, Number(limSec) || 20) * 1000));
  return Math.round((1 - r / 2) * 1000);
}

/** @typedef {{ten:string,p:number,c:number,streak:number,best:number,tsum:number,tc:number,last:number,lastOk:boolean|null,answered:number}} Score */

/** @param {string} ten @returns {Score} */
export const blankScore = ten => ({ ten, p: 0, c: 0, streak: 0, best: 0, tsum: 0, tc: 0, last: 0, lastOk: null, answered: 0 });

/**
 * Chấm một câu cho cả lớp. Cập nhật điểm từng em (cả em không trả lời: chuỗi về 0).
 * @param {Record<string, Score>} score @param {Record<string, {ten?:string}>} players @param {Record<string, {a?:string,t?:number}>} answers
 * @param {{ans:string}} q @param {number} qAt thời điểm bắt đầu câu (giờ máy chủ, đã trừ thời gian tạm dừng) @param {number} limSec
 * @returns {Record<string, number>} số em chọn từng phương án + none
 */
export function scoreQuestion(score, players, answers, q, qAt, limSec) {
  /** @type {Record<string, number>} */ const counts = { A: 0, B: 0, C: 0, D: 0, none: 0 };
  for (const k of new Set([...Object.keys(players || {}), ...Object.keys(answers || {})])) {
    const s = score[k] || (score[k] = blankScore(String(players?.[k]?.ten || k)));
    const v = answers?.[k];
    if (!v || !L.includes(/** @type {any} */ (v.a))) { counts.none++; s.streak = 0; s.last = 0; s.lastOk = null; continue; }
    counts[/** @type {string} */ (v.a)]++;
    s.answered++;
    const ok = v.a === q.ans, ms = Math.max(0, Number(v.t) - qAt);
    const got = points(ok, ms, limSec);
    s.p += got; s.last = got; s.lastOk = ok;
    if (ok) { s.c++; s.streak++; s.best = Math.max(s.best, s.streak); s.tsum += ms; s.tc++; } else s.streak = 0;
  }
  return counts;
}

/** Xếp hạng: điểm giảm dần → số câu đúng → tên. @param {Record<string, Score>} score */
export function ranked(score) {
  return Object.entries(score || {}).map(([k, v]) => ({ k, ...v }))
    .sort((a, b) => b.p - a.p || b.c - a.c || a.ten.localeCompare(b.ten, 'vi'));
}

/**
 * Danh hiệu cuối buổi (mỗi danh hiệu một em; cần ít nhất 1 câu đúng).
 * @param {Record<string, Score>} score @returns {{k:string,ten:string,giai:string,chi_tiet:string}[]}
 */
export function awards(score) {
  const rk = ranked(score).filter(r => r.c > 0);
  if (!rk.length) return [];
  /** @type {{k:string,ten:string,giai:string,chi_tiet:string}[]} */ const out = [];
  const add = (/** @type {any} */ r, /** @type {string} */ giai, /** @type {string} */ ct) => { if (r) out.push({ k: r.k, ten: r.ten, giai, chi_tiet: ct }); };
  add(rk[0], 'Quán quân', `${rk[0].p} điểm`);
  const acc = [...rk].sort((a, b) => b.c - a.c || b.p - a.p)[0];
  add(acc, 'Chính xác nhất', `${acc.c} câu đúng`);
  const fast = [...rk].filter(r => r.tc).sort((a, b) => a.tsum / a.tc - b.tsum / b.tc)[0];
  if (fast) add(fast, 'Nhanh như chớp', `trung bình ${(fast.tsum / fast.tc / 1000).toFixed(1).replace('.', ',')} giây/câu đúng`);
  const streak = [...rk].sort((a, b) => b.best - a.best || b.p - a.p)[0];
  if (streak.best >= 2) add(streak, 'Chuỗi đúng dài nhất', `${streak.best} câu liên tiếp`);
  return out;
}

/** Cột file Excel mẫu cho bộ câu hỏi luyện tập. */
export const QUIZ_COLUMNS = ['STT', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Chủ đề'];
const t = (/** @type {unknown} */ v) => v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
const nk = (/** @type {string} */ v) => v.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Đọc dòng Excel → câu hỏi. Nhận cả file mẫu Luyện tập và file mẫu đề thi (lấy các câu trắc nghiệm).
 * @param {unknown[][]} rows @returns {{qs:{text:string,opts:Record<string,string>,ans:string,topic:string}[], errors:string[], fatal?:string}}
 */
export function parseQuizRows(rows) {
  /** @type {{text:string,opts:Record<string,string>,ans:string,topic:string}[]} */ const qs = [];
  /** @type {string[]} */ const errors = [];
  if (!Array.isArray(rows) || rows.length < 2) return { qs, errors, fatal: 'File trống hoặc chưa có câu hỏi. Hãy tải file mẫu rồi điền.' };
  const h = (rows[0] || []).map(v => nk(t(v)));
  let col;
  if (h[1] === nk('Câu hỏi') && h[6] === nk('Đáp án đúng')) col = { text: 1, A: 2, B: 3, C: 4, D: 5, ans: 6, topic: 7, kind: -1 };
  else if (h[1] === nk('Loại (TN/TL)') && h[2] === nk('Câu hỏi') && h[7] === nk('Đáp án đúng')) col = { text: 2, A: 3, B: 4, C: 5, D: 6, ans: 7, topic: 9, kind: 1 };
  else return { qs, errors, fatal: 'File không đúng mẫu. Hãy bấm "Tải file mẫu" và điền vào đúng các cột.' };
  rows.slice(1).forEach((row, i) => {
    const r = /** @type {unknown[]} */ (row || []), line = i + 2;
    const text = t(r[col.text]);
    if (!text && L.every(k => !t(r[/** @type {any} */ (col)[k]]))) return;   // dòng trống
    if (col.kind >= 0 && !/^tn$/i.test(t(r[col.kind]))) return;   // file đề thi: bỏ câu tự luận
    /** @type {Record<string,string>} */ const opts = {}; for (const k of L) { const v = t(r[/** @type {any} */ (col)[k]]); if (v) opts[k] = v.slice(0, 120); }
    const ans = t(r[col.ans]).toUpperCase();
    if (!text) { errors.push(`Dòng ${line}: thiếu câu hỏi.`); return; }
    if (Object.keys(opts).length < 2) { errors.push(`Dòng ${line}: cần ít nhất 2 phương án.`); return; }
    if (!opts[ans]) { errors.push(`Dòng ${line}: đáp án đúng "${ans || '(trống)'}" chưa có nội dung.`); return; }
    qs.push({ text: text.slice(0, 300), opts, ans, topic: t(r[col.topic]).slice(0, 60) });
  });
  if (qs.length > MAX_Q) { errors.push(`Chỉ lấy ${MAX_Q} câu đầu (tối đa mỗi bộ).`); qs.length = MAX_Q; }
  if (!qs.length && !errors.length) return { qs, errors, fatal: 'Không tìm thấy câu trắc nghiệm nào trong file.' };
  return { qs, errors };
}

/** Lớp của một bộ câu hỏi (tương thích bản cũ chỉ có một lớp). @param {{lop?:string,lops?:string[]}} s */
export const setClasses = s => Array.isArray(s?.lops) && s.lops.length ? s.lops.map(String) : s?.lop ? [String(s.lop)] : [];
