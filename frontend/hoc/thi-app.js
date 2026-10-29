// @ts-check
// Tab Thi của học sinh — chạy thẳng trên Firebase (thi-store.js), KHÔNG qua Worker hay Google Sheet:
// danh sách bài (cập nhật tức thì) → phòng chờ (tự vào khi thầy cô bấm Mở) → làm bài (nháp lưu trên máy) → nộp →
// kết quả: số lần thi, điểm, hạng trong lớp — CHỈ khi thầy cô bật "Cho xem điểm" (xem_diem) cho bài đó.
// THI THẬT theo ca (30/10/2026, docs/ke-hoach/thi-that.md): trạng thái từng em ở thi_tt/{bài}/{mã}: chua_mo → chua_thi → da_thi → thi_lai.
//   Đề không kèm đáp án (Google Sheet chấm), em KHÔNG xem điểm; đảo câu + đảo phương án theo từng em; gửi kèm thứ tự đã đảo (thu_tu) để file minh chứng đúng;
//   đề Trắc nghiệm + Thực hành: phải có file thực hành Sheet xác nhận (thi_th) mới nộp được; nộp bài và đổi trạng thái → Đã thi trong MỘT lần ghi.
import * as store from './thi-store.js';
import { setState as presence } from './presence.js';
import { el, icon, confirmBox, noticeBox } from './dom.js';
import { SHEET_API } from './sheet-config.js';
import { typeOut } from './typing.js';
import { api } from './api.js';

/** @typedef {{ma:string,ten:string,lop:string,khoi:number}} Me */
/** @typedef {{tieu_de:string,che_do:'that'|'thu',khoi:number,lop:string,trang_thai:'mo'|'khoa',so_cau:number,xem_diem?:boolean,noi_dung?:'tn'|'tn_th'|'tn_tl',hinh_thuc?:string,nam_hoc?:string}} Bai */
/** @typedef {{id:string,stt?:number|string,kind?:'tl',text:string,options:Record<string,string>,answer:string,points:number,topic?:string,goi_y?:string}} Cau */

/** @type {HTMLElement|null} */ let root = null;
/** @type {Me|null} */ let me = null;
/** @type {Record<string, Bai>} */ let bai = {};
/** @type {Record<string, any>} bài đã nộp của em, theo mã bài */ let mine = {};
/** @type {Record<string, Cau[]>} */ const deCache = {};
/** @type {null|(() => void)} */ let stop = null;
/** @type {{phase:'list'|'wait'|'exam'|'result', id:string, qs:Cau[], result?:any, fresh?:boolean}} */ let cur = { phase: 'list', id: '', qs: [] };
let loaded = false, online = true, pin = '';
/** Trạng thái thi thật của em theo bài: {tt, lan, ly_do} (thi_tt/{bài}/{mã}). @type {Record<string, any>} */ let tts = {};
/** File thực hành Sheet đã xác nhận: {ten_file, size, at, file_id}. @type {Record<string, any>} */ let ths = {};
/** @type {Record<string, () => void>} */ let ttStops = {};
const isReal = (/** @type {Bai|undefined} */ b) => !!b && b.che_do === 'that';
const ttOf = (/** @type {string} */ id) => String(tts[id]?.tt || 'chua_mo');
/** Em làm bài này được không: thi thật theo trạng thái của em; thi thử theo trạng thái mở của bài. @param {string} id */
const canTake = id => { const b = bai[id]; return !!b && (isReal(b) ? (ttOf(id) === 'chua_thi' || ttOf(id) === 'thi_lai') : b.trang_thai === 'mo'); };
const TT_LABEL = /** @type {Record<string,string>} */ ({ chua_mo: 'Chưa mở thi', chua_thi: 'Đang mở', da_thi: 'Đã thi', thi_lai: 'Thi lại' });
const fmtFull = (/** @type {number} */ t) => t ? new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false }) : '';
const kb = (/** @type {number} */ n) => n >= 1048576 ? `${Math.round(n / 104857.6) / 10} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
/** Nghe trạng thái thi thật của em cho từng bài thi thật dành cho em (bài khác thì thôi). */
function syncTt() {
  if (!me) return;
  const key = store.keyOf(me.ma), want = new Set(Object.entries(bai || {}).filter(([, b]) => b && isReal(b) && forMe(b)).map(([id]) => id));
  for (const id of Object.keys(ttStops)) if (!want.has(id)) { ttStops[id](); delete ttStops[id]; delete tts[id]; }
  for (const id of want) if (!ttStops[id]) ttStops[id] = store.listen(`thi_tt/${id}/${key}`, d => { tts[id] = d || null; onChange(); }, undefined, { prio: 1 });
}
/** Ghi tiến độ cho màn giáo viên (tối đa 1 lần / 4 giây). */
let tdTimer = 0, tdLast = '';
function pushProgress(/** @type {string} */ id, /** @type {number} */ n, /** @type {number} */ tong) {
  if (!me || !isReal(bai[id]) || !canTake(id)) return;
  const th = !!ths[id], sig = `${id}|${n}|${tong}|${th}`; if (sig === tdLast) return;
  clearTimeout(tdTimer); tdTimer = window.setTimeout(() => { tdLast = sig; void store.put(`thi_tien_do/${id}/${store.keyOf(me?.ma || '')}`, { n, tong, th, at: store.SERVER_TIME }).catch(() => {}); }, 1200);
}
/** Báo Worker để đánh dấu máy vào thi từ ngoài mạng trường (không chặn, lỗi bỏ qua). @param {string} id */
const pingIp = id => { if (me) void api('/thi/ip', { method: 'POST', body: { ma_de: id, ma: me.ma }, timeout: 8000 }).catch(() => {}); };
/** @type {any} bài thi thử vừa nộp (để Gia sư AI nhận xét) */ let reviewData = null;
const isTl = (/** @type {Cau} */ q) => q.kind === 'tl';
/** Hạt giống đảo câu/phương án: mã em + bài + lần thi (thi lại → thứ tự mới). @param {string} id */
const seedOf = id => `${store.keyOf(me?.ma || '')}|${id}|${Number(tts[id]?.lan) || 0}`;
const MAX_TL = 3000;
const r2 = (/** @type {number} */ x) => Math.round(x * 100) / 100;

/** Khóa chủ đề an toàn cho Firebase (dùng chung với Bản đồ năng lực). @param {string} t */
export const topicKey = t => String(t || '').normalize('NFC').toLowerCase().trim().replace(/[.#$[\]/\s]+/g, '_').slice(0, 60);
/** Xáo trộn có hạt giống (cùng em + cùng bài → cùng thứ tự, tải lại trang không đổi). @template T @param {T[]} arr @param {string} seedText @returns {T[]} */
export function seededShuffle(arr, seedText) {
  let h = 2166136261; for (const ch of String(seedText)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
/** Số lần rời màn hình bài thi thật (lưu trên máy, tải lại trang không mất). */
const leaveKey = (/** @type {string} */ id) => `thi-roi-${store.keyOf(me?.ma || '')}-${id}`;
const leaves = (/** @type {string} */ id) => { try { return Number(localStorage.getItem(leaveKey(id))) || 0; } catch { return 0; } };
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || cur.phase !== 'exam' || !inExam() || bai[cur.id]?.che_do !== 'that') return;
  const n = leaves(cur.id) + 1; try { localStorage.setItem(leaveKey(cur.id), String(n)); } catch { /* bỏ qua */ }
  const box = root?.querySelector('.thi-leave'); if (box) box.textContent = `Em đã rời màn hình bài thi ${n} lần. Thầy cô sẽ thấy số lần này.`;
});
const draftKey = (/** @type {string} */ id) => `thi-fb-${store.keyOf(me?.ma || '')}-${id}`;
const readDraft = (/** @type {string} */ id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}'); } catch { return {}; } };
const saveDraft = (/** @type {string} */ id, /** @type {Record<string,string>} */ a) => { try { localStorage.setItem(draftKey(id), JSON.stringify(a)); } catch { /* bỏ qua */ } };
const clearDraft = (/** @type {string} */ id) => { try { localStorage.removeItem(draftKey(id)); } catch { /* bỏ qua */ } };
/** Bài này có dành cho em không: chọn lớp → đúng lớp; chọn khối → cùng khối. @param {Bai} b */
const forMe = b => !!me && (b.lop ? b.lop.trim().toLowerCase() === me.lop.trim().toLowerCase() : (!b.khoi || b.khoi === me.khoi));
/** Thi thử chỉ hiện khi đang mở; thi thật hiện khi đã có trạng thái cho em, hoặc bài tạo trong 30 ngày (thẻ "Chưa mở thi"). Bài làm được xếp trước. */
const recent = (/** @type {any} */ b) => { const t = Date.parse(String(b?.tao_luc || '')); return !t || Date.now() - t < 30 * 86400000; };
const visible = () => Object.entries(bai || {}).filter(([id, b]) => b && forMe(b) && (isReal(b) ? (!!tts[id] || recent(b)) : b.trang_thai === 'mo'))
  .sort((a, b) => Number(canTake(b[0])) - Number(canTake(a[0])));

/**
 * Vẽ tab Thi. Gọi mỗi lần học sinh mở tab.
 * @param {HTMLElement} target @param {{uid:string,student_name:string,class_code:string,grade:number}} identity
 */
export function render(target, identity, studentPin = '') {
  root = target; pin = studentPin || pin;
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, khoi: Number(identity.grade) || 0 };
  if (!me || me.ma !== next.ma) { mine = {}; cur = { phase: 'list', id: '', qs: [] }; loaded = false; }
  me = next;
  if (cur.phase === 'result') cur = { phase: 'list', id: '', qs: [] };   // mở lại tab Thi → về danh sách (nút Kết quả trên thẻ)
  draw(); if (cur.phase === 'wait') void presence('phong_cho');
  if (!stop) stop = store.listen('thi_bai', d => { bai = d || {}; loaded = true; syncTt(); onChange(); }, ok => { online = ok; if (cur.phase === 'list') draw(); });
  else syncTt();
}
/* ---------- Huy hiệu trên mục Thi: báo có bài đang mở ---------- */
/** @type {null|((n:number)=>void)} */ let badgeCb = null;
/** Số bài đang mở mà em còn làm được (thi thật đã nộp thì không tính). */
function openCount() {
  return visible().filter(([id]) => canTake(id)).length;
}
function updateBadge() {
  if (!badgeCb || !me) return;
  badgeCb(openCount());
}
/**
 * Sau khi học sinh đăng nhập: nghe danh sách bài ngay (không cần mở tab Thi) để mục Thi sáng lên khi thầy cô mở bài.
 * @param {{uid:string,student_name:string,class_code:string,grade:number}} identity @param {(n:number)=>void} cb
 */
export function watchBadge(identity, cb) {
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, khoi: Number(identity.grade) || 0 };
  if (!me || me.ma !== next.ma) { mine = {}; cur = { phase: 'list', id: '', qs: [] }; loaded = false; }
  me = next; badgeCb = cb;
  if (!stop) stop = store.listen('thi_bai', d => { bai = d || {}; loaded = true; syncTt(); onChange(); }, ok => { online = ok; if (cur.phase === 'list' && root?.isConnected) draw(); });
  else { syncTt(); updateBadge(); }
}
/** Có bài THI THẬT đang mở cho em mà em chưa nộp → Gia sư AI tạm nghỉ (tự động, không cần thầy cô bật). */
/** Em đang ở màn làm bài (thi thử hoặc thi thật, tab Thi đang hiện) → Gia sư AI tạm nghỉ để kết quả phản ánh đúng sức em. */
export function inExam() { return cur.phase === 'exam' && !!root && root.isConnected && !root.closest('[hidden]'); }
export function realExamOpen() { return visible().some(([id, b]) => isReal(b) && canTake(id)); }
/** Mã các bài thi thật em đang được mở (để app tự mở tab Thi một lần). */
export function realOpenIds() { return visible().filter(([id, b]) => isReal(b) && canTake(id)).map(([id]) => id + ':' + ttOf(id)); }
/**
 * Bản đồ năng lực: cộng dồn đúng/tổng theo chủ đề từ lần nộp gần nhất của mỗi bài thi thử/thi thật dành cho em.
 * @returns {Promise<Record<string,{ten:string,d:number,n:number}>>}
 */
export async function myTopics() {
  if (!me || !store.enabled()) return {};
  const ids = Object.entries(bai || {}).filter(([, b]) => b && forMe(b) && !isReal(b)).map(([id]) => id);   // thi thật: em không xem điểm → không đưa vào Bản đồ năng lực
  await Promise.all(ids.filter(id => !mine[id]).map(id => store.get(`thi_nop/${id}/${store.keyOf(me?.ma || '')}`).then(v => { if (v) mine[id] = v; }).catch(() => {})));
  /** @type {Record<string,{ten:string,d:number,n:number}>} */ const out = {};
  for (const id of ids) for (const [k, v] of Object.entries(mine[id]?.chu_de || {})) { const r = out[k] || { ten: String(v?.ten || k), d: 0, n: 0 }; r.d += Number(v?.d) || 0; r.n += Number(v?.n) || 0; out[k] = r; }
  return out;
}
/** @type {null|((review:any)=>Promise<string>)} */ let reviewer = null;
/** app.js cung cấp hàm gọi Gia sư AI nhận xét bài thi thử (cần token Worker). @param {(review:any)=>Promise<string>} fn */
export function setReviewer(fn) { reviewer = fn; }
/** @type {null|((payload:any)=>Promise<{items:{diem:number,nhan_xet:string}[],tong_ket?:string}>)} */ let grader = null;
/** app.js cung cấp hàm nhờ AI chấm tự luận (cần token Worker). @param {(payload:any)=>Promise<any>} fn */
export function setGrader(fn) { grader = fn; }
/** Lý do lần chấm AI gần nhất bị lỗi (Worker gửi về), để em và thầy cô biết vì sao. */ let gradeErr = '';
/** AI chấm các câu tự luận theo gợi ý đáp án của thầy cô. Lỗi → null (bài vẫn nộp, chấm lại sau). @param {string} title @param {Cau[]} qs @param {Record<string,string>} a */
async function gradeEssays(title, qs, a) {
  if (!grader || !qs.length) return null;
  try {
    const r = await grader({ title, ma_de: cur.id, items: qs.map(q => ({ id: q.id, text: q.text, guide: q.goi_y || '', answer: String(a[q.id] || '').slice(0, MAX_TL), max: Number(q.points) || 1 })) });
    gradeErr = '';
    return r && Array.isArray(r.items) && r.items.length === qs.length ? r : null;
  } catch (e) { gradeErr = e instanceof Error && e.message && !/^(offline|no token)$/.test(e.message) ? e.message : (e instanceof Error && e.message === 'offline' ? 'Máy đang mất mạng.' : ''); return null; }
}
/** Bài làm tự luận + điểm AI → bản ghi tu_luan. @param {Cau[]} qs @param {Record<string,string>} a @param {any} g */
function tlRecord(qs, a, g) {
  /** @type {Record<string, any>} */ const out = {};
  qs.forEach((q, k) => { const max = Number(q.points) || 1, it = g?.items?.[k]; const d = it ? Math.max(0, Math.min(max, Math.round((Number(it.diem) || 0) * 4) / 4)) : 0; out[q.id] = { tl: String(a[q.id] || '').slice(0, MAX_TL), d, max, ...(it && it.nhan_xet ? { nx: String(it.nhan_xet).slice(0, 600) } : {}) }; });
  return out;
}
/** Đăng xuất: dừng nghe, tắt huy hiệu. */
export function stopAll() { if (badgeCb) badgeCb(0); badgeCb = null; leave(); Object.values(ttStops).forEach(f => f()); ttStops = {}; tts = {}; ths = {}; me = null; mine = {}; bai = {}; loaded = false; cur = { phase: 'list', id: '', qs: [] }; }
/** Rời tab Thi (đăng xuất/đổi tab): dừng nghe. */
export function leave() { if (stop) { stop(); stop = null; } }

let lastSeen = '';
function onChange() {
  updateBadge();
  if (!root || !root.isConnected || root.closest('[hidden]')) return;   // tab Thi đang ẩn: chỉ cập nhật huy hiệu
  const b = bai[cur.id];
  // Trang kết quả: chỉ vẽ lại khi chính bài này đổi (ví dụ thầy cô bật/tắt Cho xem điểm), tránh nháy màn hình.
  if (cur.phase === 'result') { const sig = JSON.stringify(b || null); if (sig === lastSeen) return; lastSeen = sig; }
  if (cur.phase === 'wait' && b && canTake(cur.id)) { void startExam(cur.id); return; }
  if ((cur.phase === 'wait' || cur.phase === 'exam') && !b) { cur = { phase: 'list', id: '', qs: [] }; }
  if (cur.phase === 'exam') { lockBanner(); if (isReal(b) && ttOf(cur.id) === 'da_thi' && !root?.querySelector('.thi-submit[aria-busy=true]')) { cur = { phase: 'list', id: '', qs: [] }; draw(); } return; }
  draw();
}
function draw() {
  if (!root) return;
  if (cur.phase === 'list') drawList();
  else if (cur.phase === 'wait') drawWait();
  else if (cur.phase === 'result') void showStats(cur.id, cur.fresh);
  else if (cur.phase === 'exam') { if (cur.qs.length) { drawExam(); void presence('dang_thi'); } else void startExam(cur.id); }   // quay lại tab Thi giữa chừng: bài làm vẫn còn (nháp)
}
const page = (/** @type {string} */ title, /** @type {string} */ sub) => {
  root?.replaceChildren();
  const w = el('div', '', 'thi-wrap'), h = el('div', '', 'thi-head');
  h.append(el('h2', title), el('p', sub, 'meta')); w.append(h); root?.append(w); return w;
};

/* ---------- Danh sách bài (giống thẻ bài thi của giáo viên) ---------- */
const best = (/** @type {any} */ r) => r ? Number(r.cao_nhat ?? r.diem) || 0 : 0;
const lanOf = (/** @type {any} */ r) => r ? Number(r.lan) || 1 : 0;
/** @param {string} text @param {string} [cls] */
const chip = (text, cls = '') => el('span', text, 'thi-chip' + (cls ? ' ' + cls : ''));
/** @param {string} text @param {string} cls @param {() => void} fn */
function btn(text, cls, fn) { const b = /** @type {HTMLButtonElement} */ (el('button', text, cls)); b.type = 'button'; b.addEventListener('click', fn); return b; }
function drawList() {
  if (!me) return;
  const w = page('Bài thi', `${me.ten} · Lớp ${me.lop}`);
  if (!loaded) { w.append(el('p', online ? 'Đang tải bài thi…' : 'Đang chờ mạng…', 'meta thi-loading')); return; }
  const list = visible();
  if (!list.length) {
    const box = el('div', '', 'empty-state thi-empty'); box.append(icon('exam', 'ic empty-ic'), el('h3', 'Chưa có bài thi'), el('p', 'Khi thầy cô mở bài thi cho lớp em, bài sẽ tự hiện ở đây.'));
    w.append(box); return;
  }
  const nOpen = list.filter(([id]) => canTake(id)).length;
  w.append(el('p', nOpen ? `${nOpen} bài đang mở — bấm Vào thi để làm.` : 'Chưa có bài nào đang mở.', 'thi-summary' + (nOpen ? ' is-open' : '')));
  const ul = el('ul', '', 'thi-list');
  for (const [id, b] of list) {
    if (isReal(b)) { ul.append(realCard(id, b)); continue; }
    const done = mine[id], open = b.trang_thai === 'mo', that = b.che_do === 'that', xem = !!b.xem_diem;
    // Loại thi = màu viền + nhãn đầu thẻ (thật: cam, thử: xanh ngọc); trạng thái = huy hiệu có chấm sáng / ổ khóa.
    const card = el('li', '', `thi-card ${that ? 'is-real' : 'is-trial'}${open ? ' is-open' : ' is-closed'}`); card.dataset.id = id;
    const info = el('div', '', 'thi-card-info');
    const kind = el('span', that ? 'THI THẬT' : 'THI THỬ', 'thi-kind'); kind.prepend(icon(that ? 'trophy' : 'repeat', 'ic'));
    const state = el('span', '', 'thi-state ' + (open ? 'is-open' : 'is-locked'));
    if (open) { const dot = el('span', '', 'thi-dot'); dot.setAttribute('aria-hidden', 'true'); state.append(dot, document.createTextNode('Đang mở')); }
    else { state.append(icon('lock', 'ic'), document.createTextNode('Chưa mở')); }
    const tags = el('div', '', 'thi-tags');
    tags.append(state, chip(b.lop ? 'Lớp ' + b.lop : 'Khối ' + b.khoi));
    const parts = [`${b.so_cau} câu`];
    if (done) parts.push(`Đã thi ${lanOf(done)} lần`);
    if (done && xem) parts.push(`Điểm cao nhất ${best(done)}/${done.tong}`);
    else if (done) parts.push('Đã nộp');
    info.append(kind, el('h3', b.tieu_de, 'thi-card-title'), tags, el('p', parts.join(' · '), 'meta thi-card-meta'));
    const acts = el('div', '', 'thi-card-actions');
    if (done && xem) {   // nút biểu tượng thống kê: điểm, số lần thi, xếp hạng lớp
      const sb = btn('', 'thi-icon-btn', () => void showStats(id)); sb.append(icon('chart', 'ic')); sb.setAttribute('aria-label', 'Kết quả và xếp hạng: ' + b.tieu_de); sb.title = 'Kết quả và xếp hạng'; acts.append(sb);
    }
    if (that && done) { if (!xem) acts.append(el('span', 'Đã nộp bài', 'meta thi-done')); }
    else if (open) acts.append(btn(done ? 'Làm lại' : 'Vào thi', 'primary thi-go', () => void openExam(id)));
    else acts.append(el('span', 'Chờ thầy cô mở', 'meta thi-done'));   // chưa mở: không có nút, tránh vào nhầm
    card.append(info, acts); ul.append(card);
  }
  w.append(ul);
  // Lấy bài em đã nộp (một lần, song song) để hiện số lần thi và điểm trên thẻ.
  const need = list.map(([id]) => id).filter(id => !(id in mine));
  if (need.length) {
    need.forEach(id => { mine[id] = null; });
    void Promise.all(need.map(id => store.get(`thi_nop/${id}/${store.keyOf(me?.ma || '')}`).then(v => { mine[id] = v; }).catch(() => { delete mine[id]; })))
      .then(() => { if (cur.phase === 'list' && need.some(id => mine[id])) drawList(); });
  }
}

/** Thẻ bài THI THẬT theo trạng thái của em (không bao giờ có điểm). @param {string} id @param {Bai} b */
function realCard(id, b) {
  const t = ttOf(id), st = tts[id] || {}, take = canTake(id);
  const card = el('li', '', `thi-card is-real${take ? ' is-open' : ' is-closed'}`); card.dataset.id = id; card.dataset.tt = t;
  const info = el('div', '', 'thi-card-info');
  const kind = el('span', 'THI THẬT', 'thi-kind'); kind.prepend(icon('trophy', 'ic'));
  const state = el('span', '', 'thi-state thi-tt-' + t);
  if (take) { const dot = el('span', '', 'thi-dot'); dot.setAttribute('aria-hidden', 'true'); state.append(dot, document.createTextNode(TT_LABEL[t])); }
  else state.append(icon(t === 'da_thi' ? 'check' : 'lock', 'ic'), document.createTextNode(TT_LABEL[t] || 'Chưa mở thi'));
  const tags = el('div', '', 'thi-tags'); tags.append(state, chip(b.lop ? 'Lớp ' + b.lop : 'Khối ' + b.khoi));
  const parts = [b.noi_dung === 'tn_th' ? 'Trắc nghiệm + Thực hành' : b.noi_dung === 'tn_tl' ? 'Trắc nghiệm + Tự luận' : 'Trắc nghiệm', `${b.so_cau} câu`];
  const note = t === 'da_thi' ? `Em đã nộp bài${st.nop_luc ? ' lúc ' + fmtFull(Number(st.nop_luc)) : ''}.` : t === 'thi_lai' ? 'Thầy cô cho em thi lại.' : t === 'chua_thi' ? 'Thầy cô đã mở thi cho em.' : 'Thầy cô sẽ mở khi tới lượt lớp em.';
  info.append(kind, el('h3', b.tieu_de, 'thi-card-title'), tags, el('p', parts.join(' · '), 'meta thi-card-meta'), el('p', note, 'meta thi-card-note'));
  const acts = el('div', '', 'thi-card-actions');
  if (take) acts.append(btn(t === 'thi_lai' ? 'Vào thi lại' : 'Vào thi', 'primary thi-go', () => void openExam(id)));
  card.append(info, acts); return card;
}
/** @param {string} id */
async function openExam(id) {
  const b = bai[id]; if (!b || !me) return;
  if (isReal(b)) {   // thi thật: đọc lại trạng thái mới nhất (thầy cô có thể vừa đóng/mở) rồi mới cho vào
    const v = await store.get(`thi_tt/${id}/${store.keyOf(me.ma)}`).catch(() => undefined);
    if (v !== undefined) tts[id] = v;
    if (!canTake(id)) { drawList(); return; }
    void store.put(`thi_vao/${id}/${store.keyOf(me.ma)}`, store.SERVER_TIME).catch(() => {});   // giáo viên thấy em đã vào thi
    pingIp(id); await startExam(id); return;
  }
  if (b.trang_thai !== 'mo') return;   // thi thử: chỉ vào được khi thầy cô đã mở
  void store.put(`thi_vao/${id}/${store.keyOf(me.ma)}`, store.SERVER_TIME).catch(() => {});   // điểm danh
  await startExam(id);
}
/* ---------- Phòng chờ ---------- */
function drawWait() {
  const b = bai[cur.id]; if (!b) return;
  const w = page(b.tieu_de, 'Phòng chờ thi');
  const box = el('div', '', 'thi-waitbox');
  const dot = el('span', '', 'thi-pulse'); dot.setAttribute('aria-hidden', 'true');
  const p = el('p', 'Em đã vào phòng thi. Khi thầy cô bấm Mở, bài thi tự hiện — không cần bấm gì.');
  p.setAttribute('role', 'status');
  box.append(dot, p); w.append(box, backBtn('Chọn bài khác'));
}
const backBtn = (/** @type {string} */ text) => { const b = el('button', text, 'thi-back thi-btn-ghost'); /** @type {HTMLButtonElement} */ (b).type = 'button'; b.addEventListener('click', () => { cur = { phase: 'list', id: '', qs: [] }; void presence('hoc'); draw(); }); return b; };

/* ---------- Làm bài ---------- */
/** @param {string} id */
async function startExam(id) {
  const b = bai[id]; if (!b || !root) return;
  cur = { phase: 'exam', id, qs: [] };
  // Luôn tải đề mới (thầy cô có thể vừa sửa câu hỏi/đáp án); mất mạng thì dùng bản đã tải trước đó.
  if (!deCache[id]) { const w = page(b.tieu_de, 'Đang tải đề…'); w.append(el('p', 'Đang tải đề…', 'meta thi-loading')); }
  try { const d = await store.get('thi_de/' + id); deCache[id] = (Array.isArray(d) ? d : Object.values(d || {})).filter(Boolean); }
  catch (e) { if (!deCache[id]) { const w2 = page(b.tieu_de, ''); w2.append(el('p', (e instanceof Error ? e.message : 'Chưa tải được đề.'), 'thi-error'), backBtn('Về danh sách')); return; } }
  if (cur.id === id && cur.phase === 'exam' && !deCache[id].length) { const w3 = page(b.tieu_de, ''); w3.append(el('p', 'Bài thi chưa có câu hỏi. Em báo thầy cô nhé.', 'thi-error'), backBtn('Về danh sách')); return; }
  if (cur.id !== id || cur.phase !== 'exam') return;
  // Thi thật: mỗi em (và mỗi lần thi) một thứ tự câu và phương án khác nhau, không xem bài nhau; tự luận để sau trắc nghiệm.
  cur.qs = isReal(b) ? [...seededShuffle(deCache[id].filter(q => !isTl(q)), seedOf(id)), ...deCache[id].filter(isTl)] : [...deCache[id].filter(q => !isTl(q)), ...deCache[id].filter(isTl)];
  if (isReal(b)) void store.get(`thi_th/${id}/${store.keyOf(me?.ma || '')}`).then(v => { ths[id] = v || null; if (cur.id === id && cur.phase === 'exam') { updatePractical(); root?.dispatchEvent(new Event('thi:th')); } }).catch(() => {});
  drawExam(); void presence('dang_thi');
}
/** Thứ tự phương án em thấy: thi thật đảo theo em + bài + lần thi; thi thử giữ nguyên. @param {Cau} q @returns {[string,string][]} */
function optOrder(q) { const opts = Object.entries(q.options || {}); return isReal(bai[cur.id]) ? seededShuffle(opts, `${seedOf(cur.id)}|${q.id}`) : opts; }
/** Thứ tự đã đảo gửi kèm bài nộp: q = mã câu trắc nghiệm theo thứ tự em thấy; o = phương án gốc theo thứ tự em thấy ("CADB"). */
function thuTu() { const o = /** @type {Record<string,string>} */ ({}); const q = cur.qs.filter(x => !isTl(x)).map(x => { o[x.id] = optOrder(x).map(([k]) => k).join(''); return x.id; }); return { q, o }; }
function answers() {
  /** @type {Record<string,string>} */ const a = {};
  root?.querySelectorAll('.thi-form input[type=radio]:checked').forEach(n => { const i = /** @type {HTMLInputElement} */ (n); a[i.name] = i.value; });
  root?.querySelectorAll('.thi-form textarea.thi-tl-input').forEach(n => { const t = /** @type {HTMLTextAreaElement} */ (n); if (t.value.trim()) a[t.name] = t.value.slice(0, MAX_TL); });
  return a;
}
/** Chiều cao thanh trên cùng của app (để thanh tiêu đề bài thi neo ngay bên dưới). */
function syncTop() { const t = /** @type {HTMLElement|null} */ (document.querySelector('.topbar')); const pos = t ? getComputedStyle(t).position : ''; root?.style.setProperty('--thi-top', `${t && (pos === 'sticky' || pos === 'fixed') ? Math.round(t.getBoundingClientRect().height) : 0}px`); }   // thanh trên cùng có neo thì đặt ngay dưới, không thì sát mép trên
window.addEventListener('resize', () => { if (cur.phase === 'exam') syncTop(); });
function drawExam() {
  const b = bai[cur.id]; if (!b || !me) return;
  root?.replaceChildren(); syncTop();
  window.dispatchEvent(new CustomEvent('thi:exam'));   // app.js đóng khung Gia sư AI
  const w = el('div', '', 'thi-wrap thi-exam'); root?.append(w);
  // Thanh neo: tên bài, loại thi, tiến độ, bảng số câu 1…N (bấm để nhảy tới câu; câu đã làm được tô).
  const head = el('div', '', 'thi-sticky');
  const top = el('div', '', 'thi-sticky-top');
  const tt = el('div', '', 'thi-sticky-title'); tt.append(el('h2', b.tieu_de), el('span', b.che_do === 'that' ? 'Thi thật · nộp một lần' : 'Thi thử · làm lại được', 'thi-chip ' + (b.che_do === 'that' ? 'is-real' : 'is-trial')));
  const count = el('span', '', 'thi-count'); count.setAttribute('aria-live', 'polite');
  top.append(tt, count);
  const nav = el('nav', '', 'thi-qnav'); nav.setAttribute('aria-label', 'Chọn câu hỏi');
  head.append(top, nav); w.append(head, el('div', '', 'thi-lock'));
  if (b.che_do === 'that') { const lv = el('p', leaves(cur.id) ? `Em đã rời màn hình bài thi ${leaves(cur.id)} lần. Thầy cô sẽ thấy số lần này.` : 'Bài thi thật: thứ tự câu và phương án của mỗi bạn khác nhau. Không rời khỏi màn hình khi đang làm.', 'thi-leave'); lv.setAttribute('role', 'status'); w.append(lv); }
  const draft = readDraft(cur.id);
  const f = /** @type {HTMLFormElement} */ (el('form', '', 'thi-form')); f.noValidate = true;
  const mixed = cur.qs.some(isTl) && cur.qs.some(q => !isTl(q));
  cur.qs.forEach((q, i) => {
    if (mixed && (i === 0 || isTl(q) !== isTl(cur.qs[i - 1]))) f.append(el('h3', isTl(q) ? 'PHẦN II. TỰ LUẬN' : 'PHẦN I. TRẮC NGHIỆM', 'thi-part'));
    if (isTl(q)) { f.append(essayBox(q, i, draft)); addNav(q, i, /** @type {HTMLElement} */ (f.lastElementChild)); return; }
    const fs = el('fieldset', '', 'question thi-q'); fs.id = `thi-q-${i + 1}`;
    const lg = el('legend', `Câu ${i + 1}. ${q.text}`); lg.append(el('span', ` (${q.points} điểm)`, 'thi-pts')); fs.append(lg);
    const that = b.che_do === 'that', opts = Object.entries(q.options || {});
    (that ? optOrder(q) : opts).forEach(([k, t], pos) => {
      const lab = el('label', '', 'option'); const inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.type = 'radio'; inp.name = q.id; inp.value = k; inp.checked = draft[q.id] === k;   // giá trị = phương án gốc (chấm đúng), nhãn = vị trí hiển thị
      lab.append(inp, document.createTextNode(`${that ? 'ABCD'[pos] : k}. ${t}`)); fs.append(lab);
    });
    f.append(fs); addNav(q, i, fs);
  });
  /** @param {Cau} q @param {number} i @param {HTMLElement} fs */
  function addNav(q, i, fs) {
    const nb = /** @type {HTMLButtonElement} */ (el('button', String(i + 1), 'thi-qbtn' + (isTl(q) ? ' is-tl' : ''))); nb.type = 'button'; nb.dataset.q = q.id;
    nb.addEventListener('click', () => { fs.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); /** @type {HTMLInputElement|null} */ (fs.querySelector('input:checked') || fs.querySelector('input') || fs.querySelector('textarea'))?.focus({ preventScroll: true }); });
    nav.append(nb);
  }
  const bar = el('div', '', 'thi-bar');
  const err = el('p', '', 'thi-error'); err.setAttribute('role', 'alert');
  const submit = /** @type {HTMLButtonElement} */ (el('button', 'Nộp bài', 'primary thi-submit')); submit.type = 'submit';
  const exit = /** @type {HTMLButtonElement} */ (el('button', 'Thoát', 'thi-back thi-btn-ghost')); exit.type = 'button';
  let typing = 0;   // gõ tự luận: lưu nháp sau khi ngừng gõ 0,4 giây
  const update = () => {
    if (cur.phase !== 'exam' || !cur.qs || !cur.qs.length) return;
    const a = answers(), n = Object.keys(a).length;
    count.textContent = `Đã làm ${n}/${cur.qs.length}` + (b.noi_dung === 'tn_th' && isReal(b) ? ` · Thực hành: ${ths[cur.id] ? 'đã nộp ✓' : 'chưa nộp'}` : '');
    pushProgress(cur.id, n, cur.qs.length);
    nav.querySelectorAll('.thi-qbtn').forEach((x, i) => { const q = cur.qs[i]; if (!q) return; const done = !!a[q.id]; x.classList.toggle('is-done', done); if (done) x.classList.remove('is-missing'); x.setAttribute('aria-label', `Câu ${i + 1}, ${done ? 'đã làm' : 'chưa làm'}`); });
    f.querySelectorAll('.thi-q.is-missing').forEach(fs => { const t = /** @type {HTMLTextAreaElement|null} */ (fs.querySelector('textarea')); if (fs.querySelector('input:checked') || (t && t.value.trim())) fs.classList.remove('is-missing'); });
  };
  exit.addEventListener('click', () => { clearTimeout(typing); cur = { phase: 'list', id: '', qs: [] }; void presence('hoc'); draw(); });
  f.addEventListener('change', () => { saveDraft(cur.id, answers()); update(); });
  f.addEventListener('input', ev => { if (!(/** @type {HTMLElement} */ (ev.target)).matches('textarea')) return; clearTimeout(typing); typing = window.setTimeout(() => { saveDraft(cur.id, answers()); update(); }, 400); });
  f.addEventListener('submit', ev => { ev.preventDefault(); clearTimeout(typing); void doSubmit(submit, err); });
  bar.append(exit, submit);
  if (b.noi_dung === 'tn_th' && isReal(b)) {   // hai phần: Thực hành (làm trên Word/Excel/PowerPoint rồi tải lên) và Trắc nghiệm; nộp bài cần đủ cả hai
    const tabs = el('div', '', 'thi-parts'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Phần bài thi');
    const pTh = practical(cur.id), pTn = el('div', '', 'thi-part-panel'); pTh.classList.add('thi-part-panel');
    pTh.id = 'thi-panel-th'; pTn.id = 'thi-panel-tn'; pTh.setAttribute('role', 'tabpanel'); pTn.setAttribute('role', 'tabpanel');
    const tab = (/** @type {string} */ label, /** @type {HTMLElement} */ panel) => { const t = /** @type {HTMLButtonElement} */ (el('button', label, 'thi-part-tab')); t.type = 'button'; t.setAttribute('role', 'tab'); t.setAttribute('aria-controls', panel.id); t.id = panel.id + '-tab'; panel.setAttribute('aria-labelledby', t.id); return t; };
    const tTh = tab('Phần 1 · Thực hành', pTh), tTn = tab('Phần 2 · Trắc nghiệm', pTn);
    const pick = (/** @type {'th'|'tn'} */ k) => { for (const [t, p, on] of /** @type {[HTMLElement,HTMLElement,boolean][]} */ ([[tTh, pTh, k === 'th'], [tTn, pTn, k === 'tn']])) { t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; p.hidden = !on; } nav.hidden = k === 'th'; };
    tTh.addEventListener('click', () => pick('th')); tTn.addEventListener('click', () => pick('tn'));
    tabs.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { const nx = ev.target === tTh ? tTn : tTh; nx.click(); nx.focus(); } });
    tabs.append(tTh, tTn); head.append(tabs);
    pTn.append(...[...f.childNodes]);   // câu hỏi trắc nghiệm vào Phần 2
    f.append(pTh, pTn); pick(ths[cur.id] ? 'tn' : 'th');
    w.addEventListener('thi:goto-th', () => { pick('th'); tTh.focus(); });
    root?.addEventListener('thi:th', () => update());
  } else if (b.noi_dung === 'tn_th') f.append(practical(cur.id));
  f.append(err, bar); w.append(f); update(); lockBanner();
}
/** Phần thực hành: làm bài trên máy (Word, Excel, PowerPoint…), chọn file, tải lên Google Drive của thầy cô (qua Google Sheet).
 *  Thi thật: "đã nộp" chỉ khi Sheet xác nhận (thi_th có mã file), không dựa vào trình duyệt. @param {string} id */
function practical(id) {
  const box = el('section', '', 'thi-practical'); box.setAttribute('aria-labelledby', 'thi-th-title');
  const h = el('h3', 'Bài thực hành'); h.id = 'thi-th-title';
  const b0 = bai[id], kind = b0?.loai_th, real = isReal(b0);
  const task = b0?.de_th ? el('p', b0.de_th, 'thi-th-task') : null;
  const steps = real ? el('ol', '', 'thi-th-steps') : null;
  if (steps) for (const t of ['Làm bài thực hành trên máy (Word, Excel hoặc PowerPoint) và lưu lại.', 'Bấm "Chọn file", chọn đúng file bài làm.', 'Bấm "Tải bài thực hành lên". Thấy dòng "Đã nhận" là xong, rồi làm Phần 2.']) steps.append(el('li', t));
  const inp = /** @type {HTMLInputElement} */ (el('input')); inp.type = 'file'; inp.id = 'thi-th-file';
  inp.accept = kind === 'python' ? '.py,.txt' : '.docx,.xlsx,.pptx,.pdf';
  const lab = el('label', kind === 'python' ? 'Chọn file chương trình Python (.py, tối đa 10 MB)' : 'Chọn file bài làm: Word (.docx), Excel (.xlsx), PowerPoint (.pptx) hoặc PDF – tối đa 10 MB'); lab.setAttribute('for', 'thi-th-file');
  const st = el('p', '', 'meta thi-th-status'); st.setAttribute('role', 'status'); st.id = 'thi-th-status'; inp.setAttribute('aria-describedby', st.id);
  const show = () => {
    const v = real ? ths[id] : null;
    if (v && v.ten_file) { st.classList.remove('is-bad'); st.classList.add('is-ok'); st.textContent = `Đã nhận: ${v.ten_file}${v.size ? ', ' + kb(Number(v.size)) : ''}${v.at ? ', lúc ' + fmtFull(Number(v.at)) : ''}. Nộp lại file khác được nếu cần.`; }
    else if (real) { st.classList.remove('is-ok'); st.textContent = 'Chưa nộp bài thực hành.'; }
    else { const done = (() => { try { return localStorage.getItem(`thi-th-${store.keyOf(me?.ma || '')}-${id}`) || ''; } catch { return ''; } })(); if (done) st.textContent = `Đã nộp file: ${done}. Có thể nộp lại file khác.`; }
  };
  show(); box.addEventListener('thi:th-show', show);
  const up = btn('Tải bài thực hành lên', 'primary thi-th-up', async () => {
    const file = inp.files?.[0]; st.classList.remove('is-bad', 'is-ok');
    const ext = (file?.name.match(/\.([A-Za-z0-9]+)$/) || ['', ''])[1].toLowerCase();
    const allowed = kind === 'python' ? ['py', 'txt'] : ['docx', 'xlsx', 'pptx', 'pdf'];
    if (!file) { st.textContent = 'Chọn file trước.'; st.classList.add('is-bad'); inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
    if (!allowed.includes(ext)) { st.textContent = kind === 'python' ? 'Chỉ nhận file .py.' : 'Chỉ nhận file Word (.docx), Excel (.xlsx), PowerPoint (.pptx) hoặc PDF.'; st.classList.add('is-bad'); inp.setAttribute('aria-invalid', 'true'); return; }
    if (!file.size) { st.textContent = 'File rỗng. Lưu bài rồi chọn lại.'; st.classList.add('is-bad'); return; }
    if (file.size > 10 * 1024 * 1024) { st.textContent = 'File quá lớn (tối đa 10 MB).'; st.classList.add('is-bad'); return; }
    inp.removeAttribute('aria-invalid');
    up.disabled = true; up.setAttribute('aria-busy', 'true'); const old = up.textContent; up.textContent = 'Đang tải lên…'; st.textContent = `Đang tải ${file.name} lên…`;
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Không đọc được file.')); r.readAsDataURL(file); });
      const resp = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'nop_th', ma: me?.ma, pin, ma_de: id, ten_file: file.name, mime: file.type, data }) });
      const d = await resp.json().catch(() => ({}));
      if (!d.ok) throw new Error(d.error || 'Chưa tải lên được, thử lại.');
      if (real) {   // xác nhận lại trên Firebase (Sheet đã ghi thi_th) rồi mới báo xong
        const v = await store.get(`thi_th/${id}/${store.keyOf(me?.ma || '')}`).catch(() => null);
        ths[id] = v && v.file_id ? v : { ten_file: d.ten_file || file.name, size: d.size || file.size, at: d.at || Date.now(), file_id: d.id };
        root?.dispatchEvent(new Event('thi:th'));
      } else { try { localStorage.setItem(`thi-th-${store.keyOf(me?.ma || '')}-${id}`, file.name); } catch { /* bỏ qua */ } }
      inp.value = ''; show(); if (!real) st.textContent = `Đã nộp file: ${file.name}.`;
    } catch (e) { st.textContent = (e instanceof Error ? e.message : 'Chưa tải lên được.') + ' Bài làm trên máy vẫn còn, em bấm tải lên lần nữa.'; st.classList.add('is-bad'); }
    finally { up.disabled = false; up.removeAttribute('aria-busy'); up.textContent = old; }
  });
  box.append(h, ...(task ? [task] : []), ...(steps ? [steps] : []), lab, inp, up, st); return box;
}
/** Cập nhật dòng trạng thái thực hành (khi Sheet xác nhận file). */
function updatePractical() { root?.querySelector('.thi-practical')?.dispatchEvent(new Event('thi:th-show')); }
/** Câu tự luận: đề + khung gõ kẻ dòng chấm như giấy thi (tự cao theo bài làm). @param {Cau} q @param {number} i @param {Record<string,string>} draft */
function essayBox(q, i, draft) {
  const fs = el('fieldset', '', 'question thi-q thi-tl-q'); fs.id = `thi-q-${i + 1}`;
  const lg = el('legend', `Câu ${i + 1}. ${q.text}`); lg.append(el('span', ` (${q.points} điểm)`, 'thi-pts')); fs.append(lg);
  const id = `thi-tl-${q.id}`;
  const lab = el('label', 'Bài làm của em', 'thi-tl-label'); lab.setAttribute('for', id);
  const ta = /** @type {HTMLTextAreaElement} */ (el('textarea', '', 'thi-tl-input')); ta.id = id; ta.name = q.id; ta.maxLength = MAX_TL; ta.rows = 6; ta.spellcheck = true; ta.value = draft[q.id] || '';
  ta.setAttribute('autocapitalize', 'sentences');
  const cnt = el('p', '', 'meta thi-tl-count'); cnt.id = id + '-n'; cnt.setAttribute('aria-live', 'polite'); ta.setAttribute('aria-describedby', cnt.id);
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight, 0) + 2}px`; cnt.textContent = `${ta.value.length}/${MAX_TL} ký tự`; };
  ta.addEventListener('input', grow); requestAnimationFrame(grow);
  const paper = el('div', '', 'thi-tl-paper'); paper.append(ta);
  fs.append(lab, paper, cnt); return fs;
}
function lockBanner() {
  const box = root?.querySelector('.thi-lock'); const b = bai[cur.id]; if (!box) return;
  box.textContent = !b ? '' : isReal(b) ? (canTake(cur.id) ? '' : ttOf(cur.id) === 'da_thi' ? 'Em đã nộp bài này.' : 'Thầy cô đã đóng thi lớp em. Bài làm vẫn được giữ trên máy; khi thầy cô mở lại, em nộp tiếp.') : (b.trang_thai !== 'mo' ? 'Thầy cô đang tạm khóa bài thi. Bài làm vẫn được giữ trên máy, chờ mở lại rồi nộp.' : '');
}
/** @param {HTMLButtonElement} btn @param {HTMLElement} err */
async function doSubmit(btn, err) {
  const b = bai[cur.id]; if (!b || !me) return;
  const a = answers(), total = cur.qs.length;
  // Bắt buộc làm hết: chỉ ra các câu còn sót, tô đỏ và đưa tới câu đầu tiên.
  const missing = cur.qs.map((q, i) => (a[q.id] && (!isTl(q) || a[q.id].trim().length > 1) ? 0 : i + 1)).filter(Boolean);
  if (missing.length) {
    root?.querySelectorAll('.thi-qbtn').forEach((x, i) => x.classList.toggle('is-missing', missing.includes(i + 1)));
    missing.forEach(n => document.getElementById(`thi-q-${n}`)?.classList.add('is-missing'));
    await noticeBox({ title: `Còn ${missing.length} câu chưa làm`, body: `Em chưa làm câu ${missing.join(', ')}. Làm hết các câu rồi mới nộp được.`, okText: 'Làm tiếp' }).catch(() => {});
    const first = document.getElementById(`thi-q-${missing[0]}`);
    first?.scrollIntoView({ block: 'start' }); /** @type {HTMLInputElement|null} */ (first?.querySelector('input') || first?.querySelector('textarea'))?.focus({ preventScroll: true });
    return;
  }
  if (isReal(b)) { await submitReal(btn, err, a); return; }
  const ok = await confirmBox({ title: 'Nộp bài?', body: `Em đã làm đủ ${total} câu. ` + (b.che_do === 'thu' ? 'Đây là thi thử, em làm lại được.' : 'Nộp rồi thì không làm lại được.'), okText: 'Nộp bài', cancelText: 'Xem lại' });
  if (!ok) return;
  const mcq = cur.qs.filter(q => !isTl(q)), ess = cur.qs.filter(isTl);
  const right = (/** @type {Cau} */ q) => !!a[q.id] && a[q.id].toUpperCase() === String(q.answer || '').toUpperCase();
  let diem = 0, tong = 0, dung = 0;
  for (const q of cur.qs) { const pts = Number(q.points) || 1; tong += pts; if (!isTl(q) && right(q)) { diem += pts; dung++; } }
  const diemTn = r2(diem); tong = r2(tong);
  btn.disabled = true; err.textContent = '';
  /** @type {Record<string, any>|null} */ let tuLuan = null, choCham = false;
  if (ess.length) {   // AI chấm tự luận trước khi ghi (một lần ghi, có đủ điểm)
    btn.textContent = 'AI đang chấm tự luận…';
    const wait = el('p', 'AI đang chấm phần tự luận theo gợi ý của thầy cô, em chờ khoảng 10–20 giây…', 'meta thi-grading'); wait.setAttribute('role', 'status'); err.before(wait);
    const g = await gradeEssays(b.tieu_de, ess, a); wait.remove();
    tuLuan = tlRecord(ess, a, g); choCham = !g;
    diem += Object.values(tuLuan).reduce((x, v) => x + v.d, 0);
  }
  diem = r2(diem);
  btn.textContent = 'Đang nộp…';
  try {
    const key = store.keyOf(me.ma);
    const prev = mine[cur.id] !== undefined && mine[cur.id] !== null ? mine[cur.id] : await store.get(`thi_nop/${cur.id}/${key}`).catch(() => null);
    // Theo chủ đề (Bản đồ năng lực): code đếm đúng/tổng mỗi chủ đề của bài.
    /** @type {Record<string,{ten:string,d:number,n:number}>} */ const chu_de = {};
    for (const q of cur.qs) { const t = String(q.topic || '').trim(); if (!t) continue; const k = topicKey(t), r = chu_de[k] || { ten: t.slice(0, 60), d: 0, n: 0 }; r.n++; if (isTl(q)) { const v = tuLuan?.[q.id]; if (v && !choCham) r.d = r2(r.d + v.d / v.max); } else if (right(q)) r.d++; chu_de[k] = r; }
    /** @type {Record<string,string>} chỉ đáp án trắc nghiệm (bài làm tự luận nằm ở tu_luan) */ const traLoi = {}; for (const q of mcq) if (a[q.id]) traLoi[q.id] = a[q.id];
    /** @type {Record<string, any>} */ const rec = { ma: me.ma, ten: me.ten, lop: me.lop, diem, tong, dung, so_cau: total, lan: lanOf(prev) + 1, cao_nhat: Math.max(diem, prev ? best(prev) : 0), dau: prev ? Number(prev.dau ?? prev.diem) || 0 : diem, tra_loi: traLoi, at: store.SERVER_TIME };
    if (tuLuan) { rec.tu_luan = tuLuan; rec.diem_tn = diemTn; rec.cho_cham = choCham; }
    if (Object.keys(chu_de).length) rec.chu_de = chu_de;
    if (b.che_do === 'that') rec.roi_tab = leaves(cur.id);
    await store.put(`thi_nop/${cur.id}/${key}`, rec);
    clearDraft(cur.id); mine[cur.id] = { ...rec, at: Date.now() };
    void presence('da_nop');
    reviewData = { id: cur.id, title: b.tieu_de, rec, items: cur.qs.map((q, i) => ({ stt: i + 1, text: q.text, topic: q.topic || '', dung: isTl(q) ? !!tuLuan && !choCham && tuLuan[q.id].d >= tuLuan[q.id].max / 2 : right(q), bo_trong: !a[q.id] })) };
    if (b.xem_diem) await showStats(cur.id, true);
    else { cur = { phase: 'result', id: cur.id, qs: cur.qs, result: rec, fresh: true }; drawResult(); }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    // Luật Firebase từ chối: thi thật đã nộp, hoặc thầy cô vừa khóa bài.
    const status = Number(/** @type {any} */ (e)?.status) || 0;
    if (status === 401 || status === 403) err.textContent = b.che_do === 'that' && mine[cur.id] ? 'Em đã nộp bài này rồi.' : (bai[cur.id]?.trang_thai !== 'mo' ? 'Thầy cô đang khóa bài thi. Bài làm vẫn còn trên máy, chờ mở lại rồi bấm Nộp bài.' : 'Chưa nộp được. Bài làm vẫn còn trên máy, bấm Nộp bài lần nữa.');
    else err.textContent = (msg || 'Chưa nộp được.') + ' Bài làm vẫn còn trên máy, bấm Nộp bài lần nữa.';
    btn.disabled = false; btn.textContent = 'Nộp bài';
  }
}
/** Nộp THI THẬT: kiểm đủ file thực hành (Sheet xác nhận) → xác nhận → AI gợi ý điểm tự luận (em không thấy) → ghi bài nộp + đổi trạng thái → Đã thi trong một lần.
 *  Máy em không chấm điểm trắc nghiệm (không có đáp án); gửi kèm thứ tự câu/phương án đã đảo để file minh chứng đúng. @param {HTMLButtonElement} btn @param {HTMLElement} err @param {Record<string,string>} a */
async function submitReal(btn, err, a) {
  const id = cur.id, b = bai[id]; if (!b || !me) return;
  const key = store.keyOf(me.ma);
  if (!canTake(id)) { lockBanner(); err.textContent = ttOf(id) === 'da_thi' ? 'Em đã nộp bài này rồi.' : 'Thầy cô chưa mở (hoặc đã đóng) thi cho em. Bài làm vẫn còn trên máy.'; return; }
  if (b.noi_dung === 'tn_th') {   // phải có file thực hành Sheet đã xác nhận (đọc lại cho chắc)
    const v = await store.get(`thi_th/${id}/${key}`).catch(() => undefined);
    if (v !== undefined) ths[id] = v;
    if (!ths[id] || !ths[id].file_id) {
      await noticeBox({ title: 'Em chưa nộp bài thực hành', body: 'Bài thi có hai phần. Em làm bài thực hành trên máy, tải file lên ở Phần 1, thấy dòng "Đã nhận" rồi mới nộp bài được.', okText: 'Tới phần Thực hành' }).catch(() => {});
      root?.querySelector('.thi-exam')?.dispatchEvent(new Event('thi:goto-th')); return;
    }
  }
  const nTn = cur.qs.filter(q => !isTl(q)).length, nTl = cur.qs.length - nTn;
  const parts = [`${nTn} câu trắc nghiệm`]; if (nTl) parts.push(`${nTl} câu tự luận`); if (b.noi_dung === 'tn_th') parts.push(`bài thực hành (${ths[id].ten_file})`);
  const ok = await confirmBox({ title: 'Nộp bài thi?', body: `Em đã làm đủ ${parts.join(', ')}. Nộp rồi thì không làm lại được.`, okText: 'Nộp bài', cancelText: 'Xem lại' });
  if (!ok) return;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); err.textContent = '';
  const ess = cur.qs.filter(isTl), mcq = cur.qs.filter(q => !isTl(q));
  /** @type {Record<string, any>|null} */ let tuLuan = null, choCham = false;
  if (ess.length) {   // AI gợi ý điểm tự luận cho thầy cô (em không thấy điểm); lỗi → vẫn nộp, thầy cô chấm tay
    btn.textContent = 'Đang lưu bài tự luận…';
    const g = await gradeEssays(b.tieu_de, ess, a); tuLuan = tlRecord(ess, a, g); choCham = !g;
  }
  btn.textContent = 'Đang nộp…';
  /** @type {Record<string,string>} */ const traLoi = {}; for (const q of mcq) if (a[q.id]) traLoi[q.id] = a[q.id];
  const lan = (Number(tts[id]?.lan) || 0) + 1;
  /** @type {Record<string, any>} */ const rec = { ma: me.ma, ten: me.ten, lop: me.lop, lan, so_cau: cur.qs.length, tra_loi: traLoi, thu_tu: thuTu(), roi_tab: leaves(id), at: store.SERVER_TIME };
  if (tuLuan) { rec.tu_luan = tuLuan; rec.cho_cham = choCham; }
  try {
    await store.patch('', { [`thi_nop/${id}/${key}`]: rec, [`thi_tt/${id}/${key}/tt`]: 'da_thi', [`thi_tt/${id}/${key}/nop_luc`]: store.SERVER_TIME, [`thi_tt/${id}/${key}/lan`]: lan });
    clearDraft(id); try { localStorage.removeItem(leaveKey(id)); localStorage.removeItem(`thi-th-${store.keyOf(me?.ma || '')}-${id}`); } catch { /* bỏ qua */ }
    const at = Date.now(); tts[id] = { ...(tts[id] || {}), tt: 'da_thi', lan, nop_luc: at }; mine[id] = { ...rec, at };
    void presence('da_nop'); pingIp(id);
    cur = { phase: 'result', id, qs: cur.qs, result: { ...rec, at }, fresh: true }; drawResult();
  } catch (e) {
    const status = Number(/** @type {any} */ (e)?.status) || 0;
    if (status === 401 || status === 403) {
      const t = await store.get(`thi_tt/${id}/${key}`).catch(() => null); if (t !== undefined) tts[id] = t;
      err.textContent = ttOf(id) === 'da_thi' ? 'Em đã nộp bài này rồi.' : !canTake(id) ? 'Thầy cô đã đóng thi lớp em. Bài làm vẫn còn trên máy; báo thầy cô để mở lại rồi bấm Nộp bài.' : (b.noi_dung === 'tn_th' ? 'Hệ thống chưa thấy file thực hành của em. Em tải lại file ở Phần 1 rồi nộp.' : 'Chưa nộp được. Bài làm vẫn còn trên máy, bấm Nộp bài lần nữa.');
    } else err.textContent = (e instanceof Error && e.message ? e.message : 'Chưa nộp được.') + ' Bài làm vẫn còn trên máy, bấm Nộp bài lần nữa.';
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Nộp bài';
  }
}
/** Chấm lại phần tự luận khi lần nộp trước AI chưa chấm được (thi thử: ghi đè được khi bài còn mở). @param {HTMLButtonElement} btn @param {HTMLElement} msg */
async function regrade(btn, msg) {
  const b = bai[cur.id], r = cur.result; if (!b || !me || !r?.tu_luan) return;
  const qs = (deCache[cur.id] || []).filter(isTl).filter(q => r.tu_luan[q.id]);
  if (!qs.length) { try { const d = await store.get('thi_de/' + cur.id); deCache[cur.id] = (Array.isArray(d) ? d : Object.values(d || {})).filter(Boolean); } catch { /* mạng */ } }
  const list = (deCache[cur.id] || []).filter(isTl).filter(q => r.tu_luan[q.id]);
  if (!list.length) { msg.textContent = 'Chưa tải được đề. Kiểm tra mạng rồi thử lại.'; return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'AI đang chấm…'; msg.textContent = '';
  /** @type {Record<string,string>} */ const a = {}; for (const q of list) a[q.id] = r.tu_luan[q.id].tl;
  const g = await gradeEssays(b.tieu_de, list, a);
  if (!g) { msg.textContent = 'AI vẫn chưa chấm được. ' + (gradeErr ? `Lý do: ${gradeErr}` : 'Thử lại sau ít phút.'); btn.disabled = false; btn.textContent = old; return; }
  const tl = tlRecord(list, a, g), diem = r2((Number(r.diem_tn) || 0) + Object.values(tl).reduce((x, v) => x + v.d, 0));
  /** @type {Record<string, any>} */ const rec = { ma: r.ma, ten: r.ten, lop: r.lop, diem, tong: r.tong, dung: r.dung, so_cau: r.so_cau, lan: r.lan, cao_nhat: Math.max(Number(r.cao_nhat) || 0, diem), dau: r.lan > 1 ? r.dau : diem, tra_loi: r.tra_loi || {}, tu_luan: tl, diem_tn: Number(r.diem_tn) || 0, cho_cham: false, at: store.SERVER_TIME };
  if (r.chu_de) rec.chu_de = r.chu_de;
  try { await store.put(`thi_nop/${cur.id}/${store.keyOf(me.ma)}`, rec); mine[cur.id] = { ...rec, at: Date.now() }; cur.result = mine[cur.id]; await showStats(cur.id, cur.fresh); }
  catch { msg.textContent = b.trang_thai !== 'mo' ? 'Thầy cô đã khóa bài nên chưa ghi lại được điểm.' : 'Chưa ghi được điểm. Thử lại.'; btn.disabled = false; btn.textContent = old; }
}
/** Kết quả phần tự luận: điểm + nhận xét của AI từng câu; chưa chấm được → nút Chấm lại. @param {any} r */
function essayResult(r) {
  const box = el('section', '', 'thi-tl-result'); box.setAttribute('aria-labelledby', 'thi-tlr-title');
  const h = el('h3', 'Phần tự luận — AI chấm theo gợi ý của thầy cô'); h.id = 'thi-tlr-title'; box.append(h);
  const qs = (deCache[cur.id] || []).filter(isTl), byId = Object.fromEntries(qs.map((q, i) => [q.id, { q, i }]));
  if (r.cho_cham) {
    const msg = el('p', 'AI chưa chấm được phần tự luận (mạng hoặc AI đang bận). Bài làm của em đã được lưu.', 'thi-tl-pending'); msg.setAttribute('role', 'status');
    const note = el('p', '', 'meta'); note.setAttribute('aria-live', 'polite');
    box.append(msg, btn('Chấm lại phần tự luận', 'primary thi-tl-regrade', () => void regrade(/** @type {HTMLButtonElement} */ (box.querySelector('.thi-tl-regrade')), note)), note);
    return box;
  }
  const ol = el('ol', '', 'thi-tl-items');
  Object.entries(r.tu_luan || {}).forEach(([qid, v], k) => {
    const li = el('li', '', 'thi-tl-item'); const info = byId[qid];
    li.append(el('p', `${info ? info.q.text : 'Câu tự luận ' + (k + 1)}`, 'thi-tl-q'), el('p', `${v.d} / ${v.max} điểm`, 'thi-tl-score'));
    if (v.nx) li.append(el('p', v.nx, 'thi-tl-nx'));
    ol.append(li);
  });
  box.append(ol); return box;
}

/* ---------- Kết quả: số lần thi, điểm, hạng trong lớp ---------- */
/** Trang kết quả. Chỉ dùng khi thầy cô cho xem điểm. @param {string} id @param {boolean} [fresh] vừa nộp xong */
async function showStats(id, fresh = false) {
  const b = bai[id]; if (!b || !me) return;
  if (!b.xem_diem || isReal(b)) { cur = { phase: 'result', id, qs: [], result: mine[id], fresh }; drawResult(); return; }
  const again = cur.phase === 'result' && cur.id === id && !!root?.querySelector('.thi-stats');
  cur = { phase: 'result', id, qs: [], result: mine[id], fresh }; lastSeen = JSON.stringify(b);
  if (!again) { const w = page(b.tieu_de, 'Đang tải kết quả…'); w.append(el('p', 'Đang tải kết quả…', 'meta thi-loading')); }
  /** @type {Record<string, any>} */ let all = {};
  try { all = (await store.get('thi_nop/' + id)) || {}; } catch { /* vẫn hiện điểm của em */ }
  if (cur.phase !== 'result' || cur.id !== id) return;
  const myKey = store.keyOf(me.ma), mineRec = all[myKey] || mine[id];
  if (mineRec) { all[myKey] = mineRec; mine[id] = mineRec; }
  cur.result = mineRec; drawResult(all);
}
/** @param {Record<string, any>} [all] bài nộp của cả bài thi (để xếp hạng) */
function drawResult(all) {
  const b = bai[cur.id], r = cur.result || {};
  const xem = !!b?.xem_diem;
  const w = page(b ? b.tieu_de : 'Bài thi', cur.fresh ? 'Đã nộp bài' : 'Kết quả của em');
  if (isReal(b)) {   // thi thật: em không xem điểm (tránh áp lực); chỉ xác nhận đã nộp và giờ nộp
    const card = el('div', '', 'thi-result thi-done-card'); card.setAttribute('role', 'status');
    const at = Number(r.at) || Number(tts[cur.id]?.nop_luc) || 0;
    card.append(icon('check', 'ic thi-result-ic'), el('p', 'Em đã nộp bài thành công', 'thi-result-title'), el('p', at ? `Nộp lúc ${fmtFull(at)}` : 'Bài đã được ghi nhận.', 'meta'), el('p', 'Thầy cô sẽ chấm và nhận xét sau. Em có thể nghỉ, không cần làm gì thêm.', 'meta'));
    w.append(card); actions(w, b); card.tabIndex = -1; card.focus?.(); return;
  }
  if (!xem) {
    const card = el('div', '', 'thi-result'); card.setAttribute('role', 'status');
    card.append(icon('check', 'ic thi-result-ic'), el('p', 'Đã nộp bài', 'thi-result-title'), el('p', 'Thầy cô sẽ công bố điểm sau.', 'meta'));
    w.append(card); if (r.cho_cham && r.tu_luan) w.append(essayResult(r)); actions(w, b); card.tabIndex = -1; card.focus?.(); return;
  }
  // Xếp hạng trong lớp theo điểm cao nhất; bằng điểm thì ai nộp trước đứng trước.
  const cls = Object.entries(all || { [store.keyOf(me?.ma || '')]: r }).map(([k, v]) => ({ k, ...v }))
    .filter(v => String(v.lop || '').trim().toLowerCase() === String(me?.lop || '').trim().toLowerCase())
    .sort((x, y) => best(y) - best(x) || (Number(x.at) || 0) - (Number(y.at) || 0));
  const myKey = store.keyOf(me?.ma || ''), rank = cls.findIndex(v => v.k === myKey) + 1;
  const avg = cls.length ? Math.round(cls.reduce((s, v) => s + best(v), 0) / cls.length * 10) / 10 : 0;
  const hero = el('div', '', 'thi-result thi-hero'); hero.setAttribute('role', 'status');
  const nTl = r.tu_luan ? Object.keys(r.tu_luan).length : 0;
  hero.append(el('p', cur.fresh ? 'Điểm lần này' : 'Điểm lần gần nhất', 'meta'), el('p', `${r.diem} / ${r.tong}`, 'thi-score'), el('p', nTl ? `Trắc nghiệm đúng ${r.dung}/${r.so_cau - nTl} câu · Tự luận ${r.cho_cham ? 'chưa chấm' : r2(Object.values(r.tu_luan).reduce((/** @type {number} */ x, /** @type {any} */ v) => x + (Number(v.d) || 0), 0)) + ' điểm'}` : `Đúng ${r.dung}/${r.so_cau} câu`, 'meta'));
  w.append(hero);
  if (nTl) w.append(essayResult(r));
  const grid = el('div', '', 'stat-grid stat-grid-4 thi-stats');
  /** @param {string} ic @param {string} v @param {string} label */
  const tile = (ic, v, label) => { const t = el('div', '', 'stat-tile'); const i = el('span', '', 'stat-ic'); i.append(icon(ic, 'ic')); t.append(i, el('span', v, 'stat-value'), el('span', label, 'stat-label')); return t; };
  grid.append(tile('trophy', rank ? `${rank}/${cls.length}` : '—', `Hạng trong lớp ${me?.lop || ''}`), tile('target', `${best(r)}`, 'Điểm cao nhất'), tile('repeat', `${lanOf(r)}`, 'Số lần thi'), tile('chart', `${avg}`, 'Điểm trung bình lớp'));
  w.append(grid);
  if (cls.length) {
    const board = el('section', '', 'thi-board'); board.setAttribute('aria-label', 'Bảng xếp hạng lớp');
    board.append(el('h3', `Bảng xếp hạng lớp ${me?.lop || ''}`));
    const ol = el('ol', '', 'thi-rank');
    const show = cls.slice(0, 10); if (rank > 10) show.push(cls[rank - 1]);
    for (const v of show) {
      const pos = cls.indexOf(v) + 1, li = el('li', '', 'thi-rank-row' + (v.k === myKey ? ' is-me' : '') + (pos <= 3 ? ' is-top' : ''));
      const bar = el('span', '', 'thi-rank-bar'); bar.style.setProperty('--pct', `${Math.round(best(v) / (Number(v.tong) || 1) * 100)}%`);
      li.append(el('span', String(pos), 'thi-rank-pos'), el('span', v.k === myKey ? `${v.ten || v.ma} (em)` : String(v.ten || v.ma), 'thi-rank-name'), bar, el('span', `${best(v)}`, 'thi-rank-score'));
      ol.append(li);
    }
    board.append(ol); w.append(board);
  }
  if (b && b.noi_dung === 'tn_th') {   // điểm thực hành do thầy cô chấm (máy + AI gợi ý, thầy cô quyết định)
    const thp = el('p', 'Bài thực hành: thầy cô đang chấm.', 'meta thi-th-score'); thp.setAttribute('role', 'status'); w.append(thp);
    void store.get(`thi_th/${cur.id}/${store.keyOf(me?.ma || '')}`).then(v => { if (!thp.isConnected) return; thp.textContent = !v ? 'Em chưa nộp bài thực hành.' : (typeof v.diem_th === 'number' ? `Điểm thực hành: ${v.diem_th} / ${v.tong_th ?? '?'}` : 'Bài thực hành: thầy cô đang chấm.'); }).catch(() => {});
  }
  if (b && b.che_do === 'thu' && cur.fresh && reviewData && reviewData.id === cur.id) w.append(reviewBox(reviewData));
  actions(w, b); hero.tabIndex = -1; hero.focus?.();
}
/** Nhận xét bài thi thử: tóm tắt ngay (câu sai/bỏ trống), rồi Gia sư AI nhận xét có hiệu ứng gõ chữ. @param {any} rv */
function reviewBox(rv) {
  const box = el('section', '', 'thi-review'); box.setAttribute('aria-labelledby', 'thi-rv-title');
  const head = el('div', '', 'thi-review-head'); const av = el('span', '', 'thi-review-av'); av.append(icon('spark', 'ic'));
  const h = el('h3', 'Nhận xét của Gia sư AI'); h.id = 'thi-rv-title'; head.append(av, h); box.append(head);
  const wrong = rv.items.filter((/** @type {any} */ x) => !x.dung);
  box.append(el('p', wrong.length ? `Em cần xem lại ${wrong.length} câu: ${wrong.map((/** @type {any} */ x) => x.stt).join(', ')}.` : 'Em làm đúng tất cả các câu. Rất tốt!', 'meta'));
  const msg = el('div', '', 'thi-review-msg'); box.append(msg);
  if (!reviewer) { msg.append(el('p', 'Đăng nhập lại để Gia sư AI nhận xét chi tiết.', 'meta')); return box; }
  const dots = el('p', 'Gia sư AI đang đọc bài của em', 'meta thi-typing-dots'); msg.append(dots);
  const payload = { title: rv.title, diem: rv.rec.diem, tong: rv.rec.tong, dung: rv.rec.dung, so_cau: rv.rec.so_cau, items: rv.items };
  void reviewer(payload).then(text => {
    if (!box.isConnected) return;
    if (!text) { msg.replaceChildren(el('p', 'Gia sư AI chưa nhận xét được lúc này. Em xem các câu sai ở trên và ôn lại bài nhé.', 'meta')); return; }
    void typeOut(msg, text);
  }).catch(() => { msg.replaceChildren(el('p', 'Gia sư AI chưa nhận xét được lúc này.', 'meta')); });
  return box;
}
/** @param {HTMLElement} w @param {Bai|undefined} b */
function actions(w, b) {
  const row = el('div', '', 'thi-actions');
  if (b && b.che_do === 'thu' && b.trang_thai === 'mo') row.append(btn('Làm lại', 'primary', () => void startExam(cur.id)));
  row.append(backBtn('Về danh sách bài thi')); w.append(row);
}
