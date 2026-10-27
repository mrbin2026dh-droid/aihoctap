// @ts-check
// Tab Thi của học sinh — chạy thẳng trên Firebase (thi-store.js), KHÔNG qua Worker hay Google Sheet:
// danh sách bài (cập nhật tức thì) → phòng chờ (tự vào khi thầy cô bấm Mở) → làm bài (nháp lưu trên máy) → nộp →
// kết quả: số lần thi, điểm, hạng trong lớp — CHỈ khi thầy cô bật "Cho xem điểm" (xem_diem) cho bài đó.
import * as store from './thi-store.js';
import { setState as presence } from './presence.js';
import { el, icon, confirmBox, noticeBox } from './dom.js';
import { SHEET_API } from './sheet-config.js';
import { typeOut } from './typing.js';

/** @typedef {{ma:string,ten:string,lop:string,khoi:number}} Me */
/** @typedef {{tieu_de:string,che_do:'that'|'thu',khoi:number,lop:string,trang_thai:'mo'|'khoa',so_cau:number,xem_diem?:boolean,noi_dung?:'tn'|'tn_th',hinh_thuc?:string,nam_hoc?:string}} Bai */
/** @typedef {{id:string,stt?:number|string,text:string,options:Record<string,string>,answer:string,points:number}} Cau */

/** @type {HTMLElement|null} */ let root = null;
/** @type {Me|null} */ let me = null;
/** @type {Record<string, Bai>} */ let bai = {};
/** @type {Record<string, any>} bài đã nộp của em, theo mã bài */ let mine = {};
/** @type {Record<string, Cau[]>} */ const deCache = {};
/** @type {null|(() => void)} */ let stop = null;
/** @type {{phase:'list'|'wait'|'exam'|'result', id:string, qs:Cau[], result?:any, fresh?:boolean}} */ let cur = { phase: 'list', id: '', qs: [] };
let loaded = false, online = true, pin = '';
/** @type {any} bài thi thử vừa nộp (để Gia sư AI nhận xét) */ let reviewData = null;

const draftKey = (/** @type {string} */ id) => `thi-fb-${store.keyOf(me?.ma || '')}-${id}`;
const readDraft = (/** @type {string} */ id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}'); } catch { return {}; } };
const saveDraft = (/** @type {string} */ id, /** @type {Record<string,string>} */ a) => { try { localStorage.setItem(draftKey(id), JSON.stringify(a)); } catch { /* bỏ qua */ } };
const clearDraft = (/** @type {string} */ id) => { try { localStorage.removeItem(draftKey(id)); } catch { /* bỏ qua */ } };
/** Bài này có dành cho em không: chọn lớp → đúng lớp; chọn khối → cùng khối. @param {Bai} b */
const forMe = b => !!me && (b.lop ? b.lop.trim().toLowerCase() === me.lop.trim().toLowerCase() : (!b.khoi || b.khoi === me.khoi));
/** Thi thử chỉ hiện khi đang mở; thi thật hiện cả khi khóa (vào phòng chờ). */
const visible = () => Object.entries(bai || {}).filter(([, b]) => b && forMe(b) && (b.che_do === 'that' || b.trang_thai === 'mo'))
  .sort((a, b) => (a[1].trang_thai === b[1].trang_thai ? 0 : a[1].trang_thai === 'mo' ? -1 : 1));

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
  if (!stop) stop = store.listen('thi_bai', d => { bai = d || {}; loaded = true; onChange(); }, ok => { online = ok; if (cur.phase === 'list') draw(); });
}
/* ---------- Huy hiệu trên mục Thi: báo có bài đang mở ---------- */
/** @type {null|((n:number)=>void)} */ let badgeCb = null;
/** Số bài đang mở mà em còn làm được (thi thật đã nộp thì không tính). */
function openCount() {
  return visible().filter(([id, b]) => b.trang_thai === 'mo' && !(b.che_do === 'that' && mine[id])).length;
}
function updateBadge() {
  if (!badgeCb || !me) return;
  badgeCb(openCount());
  // Biết em đã nộp bài thi thật nào (một lần) để không báo nhầm.
  const need = visible().filter(([id, b]) => b.trang_thai === 'mo' && b.che_do === 'that' && !(id in mine)).map(([id]) => id);
  if (need.length) { need.forEach(id => { mine[id] = null; }); void Promise.all(need.map(id => store.get(`thi_nop/${id}/${store.keyOf(me?.ma || '')}`).then(v => { mine[id] = v; }).catch(() => { delete mine[id]; }))).then(() => badgeCb && badgeCb(openCount())); }
}
/**
 * Sau khi học sinh đăng nhập: nghe danh sách bài ngay (không cần mở tab Thi) để mục Thi sáng lên khi thầy cô mở bài.
 * @param {{uid:string,student_name:string,class_code:string,grade:number}} identity @param {(n:number)=>void} cb
 */
export function watchBadge(identity, cb) {
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, khoi: Number(identity.grade) || 0 };
  if (!me || me.ma !== next.ma) { mine = {}; cur = { phase: 'list', id: '', qs: [] }; loaded = false; }
  me = next; badgeCb = cb;
  if (!stop) stop = store.listen('thi_bai', d => { bai = d || {}; loaded = true; onChange(); }, ok => { online = ok; if (cur.phase === 'list' && root?.isConnected) draw(); });
  else updateBadge();
}
/** Có bài THI THẬT đang mở cho em mà em chưa nộp → Gia sư AI tạm nghỉ (tự động, không cần thầy cô bật). */
/** Em đang ở màn làm bài (thi thử hoặc thi thật, tab Thi đang hiện) → Gia sư AI tạm nghỉ để kết quả phản ánh đúng sức em. */
export function inExam() { return cur.phase === 'exam' && !!root && root.isConnected && !root.closest('[hidden]'); }
export function realExamOpen() { return visible().some(([id, b]) => b.che_do === 'that' && b.trang_thai === 'mo' && !mine[id]); }
/** @type {null|((review:any)=>Promise<string>)} */ let reviewer = null;
/** app.js cung cấp hàm gọi Gia sư AI nhận xét bài thi thử (cần token Worker). @param {(review:any)=>Promise<string>} fn */
export function setReviewer(fn) { reviewer = fn; }
/** Đăng xuất: dừng nghe, tắt huy hiệu. */
export function stopAll() { if (badgeCb) badgeCb(0); badgeCb = null; leave(); me = null; mine = {}; bai = {}; loaded = false; cur = { phase: 'list', id: '', qs: [] }; }
/** Rời tab Thi (đăng xuất/đổi tab): dừng nghe. */
export function leave() { if (stop) { stop(); stop = null; } }

let lastSeen = '';
function onChange() {
  updateBadge();
  if (!root || !root.isConnected || root.closest('[hidden]')) return;   // tab Thi đang ẩn: chỉ cập nhật huy hiệu
  const b = bai[cur.id];
  // Trang kết quả: chỉ vẽ lại khi chính bài này đổi (ví dụ thầy cô bật/tắt Cho xem điểm), tránh nháy màn hình.
  if (cur.phase === 'result') { const sig = JSON.stringify(b || null); if (sig === lastSeen) return; lastSeen = sig; }
  if (cur.phase === 'wait' && b && b.trang_thai === 'mo') { void startExam(cur.id); return; }
  if ((cur.phase === 'wait' || cur.phase === 'exam') && !b) { cur = { phase: 'list', id: '', qs: [] }; }
  if (cur.phase === 'exam') { lockBanner(); return; }
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
  const nOpen = list.filter(([, b]) => b.trang_thai === 'mo').length;
  w.append(el('p', nOpen ? `${nOpen} bài đang mở — bấm Vào thi để làm.` : 'Chưa có bài nào đang mở.', 'thi-summary' + (nOpen ? ' is-open' : '')));
  const ul = el('ul', '', 'thi-list');
  for (const [id, b] of list) {
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

/** @param {string} id */
async function openExam(id) {
  const b = bai[id]; if (!b || !me) return;
  if (b.che_do === 'that') {   // thi thật: chắc chắn em chưa nộp (dữ liệu có thể chưa tải xong) rồi mới cho vào
    if (!mine[id]) { const v = await store.get(`thi_nop/${id}/${store.keyOf(me.ma)}`).catch(() => null); if (v) mine[id] = v; }
    if (mine[id]) { if (b.xem_diem) await showStats(id); else drawList(); return; }
  }
  if (b.trang_thai !== 'mo') return;   // chỉ vào được khi thầy cô đã mở
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
  cur.qs = deCache[id];
  drawExam(); void presence('dang_thi');
}
function answers() {
  /** @type {Record<string,string>} */ const a = {};
  root?.querySelectorAll('.thi-form input[type=radio]:checked').forEach(n => { const i = /** @type {HTMLInputElement} */ (n); a[i.name] = i.value; });
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
  const draft = readDraft(cur.id);
  const f = /** @type {HTMLFormElement} */ (el('form', '', 'thi-form')); f.noValidate = true;
  cur.qs.forEach((q, i) => {
    const fs = el('fieldset', '', 'question thi-q'); fs.id = `thi-q-${i + 1}`;
    const lg = el('legend', `Câu ${i + 1}. ${q.text}`); lg.append(el('span', ` (${q.points} điểm)`, 'thi-pts')); fs.append(lg);
    for (const [k, t] of Object.entries(q.options || {})) {
      const lab = el('label', '', 'option'); const inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.type = 'radio'; inp.name = q.id; inp.value = k; inp.checked = draft[q.id] === k;
      lab.append(inp, document.createTextNode(`${k}. ${t}`)); fs.append(lab);
    }
    f.append(fs);
    const nb = /** @type {HTMLButtonElement} */ (el('button', String(i + 1), 'thi-qbtn')); nb.type = 'button'; nb.dataset.q = q.id;
    nb.addEventListener('click', () => { fs.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); /** @type {HTMLInputElement|null} */ (fs.querySelector('input:checked') || fs.querySelector('input'))?.focus({ preventScroll: true }); });
    nav.append(nb);
  });
  const bar = el('div', '', 'thi-bar');
  const err = el('p', '', 'thi-error'); err.setAttribute('role', 'alert');
  const submit = /** @type {HTMLButtonElement} */ (el('button', 'Nộp bài', 'primary thi-submit')); submit.type = 'submit';
  const exit = /** @type {HTMLButtonElement} */ (el('button', 'Thoát', 'thi-back thi-btn-ghost')); exit.type = 'button';
  exit.addEventListener('click', () => { cur = { phase: 'list', id: '', qs: [] }; void presence('hoc'); draw(); });
  const update = () => {
    const a = answers(), n = Object.keys(a).length;
    count.textContent = `Đã làm ${n}/${cur.qs.length}`;
    nav.querySelectorAll('.thi-qbtn').forEach((x, i) => { const done = !!a[cur.qs[i].id]; x.classList.toggle('is-done', done); if (done) x.classList.remove('is-missing'); x.setAttribute('aria-label', `Câu ${i + 1}, ${done ? 'đã làm' : 'chưa làm'}`); });
    f.querySelectorAll('.thi-q.is-missing').forEach(fs => { if (fs.querySelector('input:checked')) fs.classList.remove('is-missing'); });
  };
  f.addEventListener('change', () => { saveDraft(cur.id, answers()); update(); });
  f.addEventListener('submit', ev => { ev.preventDefault(); void doSubmit(submit, err); });
  bar.append(exit, submit);
  if (b.noi_dung === 'tn_th') f.append(practical(cur.id));
  f.append(err, bar); w.append(f); update(); lockBanner();
}
/** Phần thực hành: chọn file, tải lên Google Drive của thầy cô (qua Google Sheet). @param {string} id */
function practical(id) {
  const box = el('section', '', 'thi-practical'); box.setAttribute('aria-labelledby', 'thi-th-title');
  const h = el('h3', 'Bài thực hành'); h.id = 'thi-th-title';
  const inp = /** @type {HTMLInputElement} */ (el('input')); inp.type = 'file'; inp.id = 'thi-th-file';
  const lab = el('label', 'Chọn file bài làm (tối đa 10 MB)'); lab.setAttribute('for', 'thi-th-file');
  const st = el('p', '', 'meta thi-th-status'); st.setAttribute('role', 'status');
  const done = (() => { try { return localStorage.getItem(`thi-th-${store.keyOf(me?.ma || '')}-${id}`) || ''; } catch { return ''; } })();
  if (done) st.textContent = `Đã nộp file: ${done}. Có thể nộp lại file khác.`;
  const up = btn('Tải bài thực hành lên', 'thi-btn-ghost thi-th-up', async () => {
    const file = inp.files?.[0]; st.classList.remove('is-bad');
    if (!file) { st.textContent = 'Chọn file trước.'; st.classList.add('is-bad'); inp.focus(); return; }
    if (file.size > 10 * 1024 * 1024) { st.textContent = 'File quá lớn (tối đa 10 MB).'; st.classList.add('is-bad'); return; }
    up.disabled = true; up.setAttribute('aria-busy', 'true'); const old = up.textContent; up.textContent = 'Đang tải lên…';
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Không đọc được file.')); r.readAsDataURL(file); });
      const resp = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'nop_th', ma: me?.ma, pin, ma_de: id, ten_file: file.name, mime: file.type, data }) });
      const d = await resp.json().catch(() => ({}));
      if (!d.ok) throw new Error(d.error || 'Chưa tải lên được, thử lại.');
      try { localStorage.setItem(`thi-th-${store.keyOf(me?.ma || '')}-${id}`, file.name); } catch { /* bỏ qua */ }
      st.textContent = `Đã nộp file: ${file.name}.`;
    } catch (e) { st.textContent = (e instanceof Error ? e.message : 'Chưa tải lên được.'); st.classList.add('is-bad'); }
    finally { up.disabled = false; up.removeAttribute('aria-busy'); up.textContent = old; }
  });
  box.append(h, lab, inp, up, st); return box;
}
function lockBanner() {
  const box = root?.querySelector('.thi-lock'); const b = bai[cur.id]; if (!box) return;
  box.textContent = b && b.trang_thai !== 'mo' ? 'Thầy cô đang tạm khóa bài thi. Bài làm vẫn được giữ trên máy, chờ mở lại rồi nộp.' : '';
}
/** @param {HTMLButtonElement} btn @param {HTMLElement} err */
async function doSubmit(btn, err) {
  const b = bai[cur.id]; if (!b || !me) return;
  const a = answers(), total = cur.qs.length;
  // Bắt buộc làm hết: chỉ ra các câu còn sót, tô đỏ và đưa tới câu đầu tiên.
  const missing = cur.qs.map((q, i) => (a[q.id] ? 0 : i + 1)).filter(Boolean);
  if (missing.length) {
    root?.querySelectorAll('.thi-qbtn').forEach((x, i) => x.classList.toggle('is-missing', missing.includes(i + 1)));
    missing.forEach(n => document.getElementById(`thi-q-${n}`)?.classList.add('is-missing'));
    await noticeBox({ title: `Còn ${missing.length} câu chưa làm`, body: `Em chưa làm câu ${missing.join(', ')}. Làm hết các câu rồi mới nộp được.`, okText: 'Làm tiếp' }).catch(() => {});
    const first = document.getElementById(`thi-q-${missing[0]}`);
    first?.scrollIntoView({ block: 'start' }); /** @type {HTMLInputElement|null} */ (first?.querySelector('input'))?.focus({ preventScroll: true });
    return;
  }
  const ok = await confirmBox({ title: 'Nộp bài?', body: `Em đã làm đủ ${total} câu. ` + (b.che_do === 'thu' ? 'Đây là thi thử, em làm lại được.' : 'Nộp rồi thì không làm lại được.'), okText: 'Nộp bài', cancelText: 'Xem lại' });
  if (!ok) return;
  let diem = 0, tong = 0, dung = 0;
  for (const q of cur.qs) { const pts = Number(q.points) || 1; tong += pts; if (a[q.id] && a[q.id].toUpperCase() === String(q.answer || '').toUpperCase()) { diem += pts; dung++; } }
  diem = Math.round(diem * 100) / 100; tong = Math.round(tong * 100) / 100;
  btn.disabled = true; btn.textContent = 'Đang nộp…'; err.textContent = '';
  try {
    const key = store.keyOf(me.ma);
    const prev = mine[cur.id] !== undefined && mine[cur.id] !== null ? mine[cur.id] : await store.get(`thi_nop/${cur.id}/${key}`).catch(() => null);
    const rec = { ma: me.ma, ten: me.ten, lop: me.lop, diem, tong, dung, so_cau: total, lan: lanOf(prev) + 1, cao_nhat: Math.max(diem, prev ? best(prev) : 0), tra_loi: a, at: store.SERVER_TIME };
    await store.put(`thi_nop/${cur.id}/${key}`, rec);
    clearDraft(cur.id); mine[cur.id] = { ...rec, at: Date.now() };
    void presence('da_nop');
    reviewData = { id: cur.id, title: b.tieu_de, rec, items: cur.qs.map((q, i) => ({ stt: i + 1, text: q.text, dung: !!a[q.id] && a[q.id].toUpperCase() === String(q.answer || '').toUpperCase(), bo_trong: !a[q.id] })) };
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

/* ---------- Kết quả: số lần thi, điểm, hạng trong lớp ---------- */
/** Trang kết quả. Chỉ dùng khi thầy cô cho xem điểm. @param {string} id @param {boolean} [fresh] vừa nộp xong */
async function showStats(id, fresh = false) {
  const b = bai[id]; if (!b || !me) return;
  if (!b.xem_diem) { cur = { phase: 'result', id, qs: [], result: mine[id], fresh }; drawResult(); return; }
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
  if (!xem) {
    const card = el('div', '', 'thi-result'); card.setAttribute('role', 'status');
    card.append(icon('check', 'ic thi-result-ic'), el('p', 'Đã nộp bài', 'thi-result-title'), el('p', 'Thầy cô sẽ công bố điểm sau.', 'meta'));
    w.append(card); actions(w, b); card.tabIndex = -1; card.focus?.(); return;
  }
  // Xếp hạng trong lớp theo điểm cao nhất; bằng điểm thì ai nộp trước đứng trước.
  const cls = Object.entries(all || { [store.keyOf(me?.ma || '')]: r }).map(([k, v]) => ({ k, ...v }))
    .filter(v => String(v.lop || '').trim().toLowerCase() === String(me?.lop || '').trim().toLowerCase())
    .sort((x, y) => best(y) - best(x) || (Number(x.at) || 0) - (Number(y.at) || 0));
  const myKey = store.keyOf(me?.ma || ''), rank = cls.findIndex(v => v.k === myKey) + 1;
  const avg = cls.length ? Math.round(cls.reduce((s, v) => s + best(v), 0) / cls.length * 10) / 10 : 0;
  const hero = el('div', '', 'thi-result thi-hero'); hero.setAttribute('role', 'status');
  hero.append(el('p', cur.fresh ? 'Điểm lần này' : 'Điểm lần gần nhất', 'meta'), el('p', `${r.diem} / ${r.tong}`, 'thi-score'), el('p', `Đúng ${r.dung}/${r.so_cau} câu`, 'meta'));
  w.append(hero);
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
