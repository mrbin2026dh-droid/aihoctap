// @ts-check
// Tab Thi của học sinh — chạy thẳng trên Firebase (thi-store.js), KHÔNG qua Worker hay Google Sheet:
// danh sách bài (cập nhật tức thì) → phòng chờ (tự vào khi thầy cô bấm Mở) → làm bài (nháp lưu trên máy) → nộp →
// kết quả: số lần thi, điểm, hạng trong lớp — CHỈ khi thầy cô bật "Cho xem điểm" (xem_diem) cho bài đó.
import * as store from './thi-store.js';
import { setState as presence } from './presence.js';
import { el, icon, confirmBox } from './dom.js';

/** @typedef {{ma:string,ten:string,lop:string,khoi:number}} Me */
/** @typedef {{tieu_de:string,che_do:'that'|'thu',khoi:number,lop:string,trang_thai:'mo'|'khoa',so_cau:number,xem_diem?:boolean}} Bai */
/** @typedef {{id:string,stt?:number|string,text:string,options:Record<string,string>,answer:string,points:number}} Cau */

/** @type {HTMLElement|null} */ let root = null;
/** @type {Me|null} */ let me = null;
/** @type {Record<string, Bai>} */ let bai = {};
/** @type {Record<string, any>} bài đã nộp của em, theo mã bài */ let mine = {};
/** @type {Record<string, Cau[]>} */ const deCache = {};
/** @type {null|(() => void)} */ let stop = null;
/** @type {{phase:'list'|'wait'|'exam'|'result', id:string, qs:Cau[], result?:any, fresh?:boolean}} */ let cur = { phase: 'list', id: '', qs: [] };
let loaded = false, online = true;

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
export function render(target, identity) {
  root = target;
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, khoi: Number(identity.grade) || 0 };
  if (!me || me.ma !== next.ma) { mine = {}; cur = { phase: 'list', id: '', qs: [] }; loaded = false; }
  me = next;
  if (cur.phase === 'result') cur = { phase: 'list', id: '', qs: [] };   // mở lại tab Thi → về danh sách (nút Kết quả trên thẻ)
  draw(); if (cur.phase === 'wait') void presence('phong_cho');
  if (!stop) stop = store.listen('thi_bai', d => { bai = d || {}; loaded = true; onChange(); }, ok => { online = ok; if (cur.phase === 'list') draw(); });
}
/** Rời tab Thi (đăng xuất/đổi tab): dừng nghe. */
export function leave() { if (stop) { stop(); stop = null; } }

function onChange() {
  const b = bai[cur.id];
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
  const ul = el('ul', '', 'thi-list');
  for (const [id, b] of list) {
    const done = mine[id], open = b.trang_thai === 'mo', that = b.che_do === 'that', xem = !!b.xem_diem;
    const card = el('li', '', 'thi-card' + (open ? ' is-open' : '')); card.dataset.id = id;
    const info = el('div', '', 'thi-card-info');
    const tags = el('div', '', 'thi-tags');
    tags.append(chip(that ? 'Thi thật' : 'Thi thử', that ? 'is-real' : 'is-trial'), chip(b.lop ? 'Lớp ' + b.lop : 'Khối ' + b.khoi), chip(open ? 'Đang mở' : 'Chưa mở', open ? 'is-open' : 'is-locked'));
    const parts = [`${b.so_cau} câu`];
    if (done) parts.push(`Đã thi ${lanOf(done)} lần`);
    if (done && xem) parts.push(`Điểm cao nhất ${best(done)}/${done.tong}`);
    else if (done) parts.push('Đã nộp');
    info.append(el('h3', b.tieu_de, 'thi-card-title'), tags, el('p', parts.join(' · '), 'meta thi-card-meta'));
    const acts = el('div', '', 'thi-card-actions');
    if (done && xem) acts.append(btn('Kết quả', 'thi-btn-ghost', () => void showStats(id)));
    if (that && done) { if (!xem) acts.append(el('span', 'Đã nộp bài', 'meta thi-done')); }
    else acts.append(btn(open ? (done ? 'Làm lại' : 'Vào thi') : 'Vào phòng chờ', 'primary thi-go', () => void openExam(id)));
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
  if (b.che_do === 'that' && mine[id]) { if (b.xem_diem) await showStats(id); return; }
  void store.put(`thi_vao/${id}/${store.keyOf(me.ma)}`, store.SERVER_TIME).catch(() => {});   // điểm danh
  if (b.trang_thai !== 'mo') { cur = { phase: 'wait', id, qs: [] }; drawWait(); void presence('phong_cho'); return; }
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
  if (!deCache[id]) {
    const w = page(b.tieu_de, 'Đang tải đề…'); w.append(el('p', 'Đang tải đề…', 'meta thi-loading'));
    try { const d = await store.get('thi_de/' + id); deCache[id] = (Array.isArray(d) ? d : Object.values(d || {})).filter(Boolean); }
    catch (e) { const w2 = page(b.tieu_de, ''); w2.append(el('p', (e instanceof Error ? e.message : 'Chưa tải được đề.'), 'thi-error'), backBtn('Về danh sách')); return; }
  }
  if (cur.id !== id || cur.phase !== 'exam') return;
  cur.qs = deCache[id];
  drawExam(); void presence('dang_thi');
}
function answers() {
  /** @type {Record<string,string>} */ const a = {};
  root?.querySelectorAll('.thi-form input[type=radio]:checked').forEach(n => { const i = /** @type {HTMLInputElement} */ (n); a[i.name] = i.value; });
  return a;
}
function drawExam() {
  const b = bai[cur.id]; if (!b || !me) return;
  const w = page(b.tieu_de, `${b.che_do === 'that' ? 'Thi thật · nộp một lần' : 'Thi thử · làm lại được'} · ${cur.qs.length} câu`);
  w.append(el('div', '', 'thi-lock'));
  const draft = readDraft(cur.id);
  const f = /** @type {HTMLFormElement} */ (el('form', '', 'thi-form')); f.noValidate = true;
  cur.qs.forEach((q, i) => {
    const fs = el('fieldset', '', 'question');
    const lg = el('legend', `Câu ${i + 1}. ${q.text}`); lg.append(el('span', ` (${q.points} điểm)`, 'thi-pts')); fs.append(lg);
    for (const [k, t] of Object.entries(q.options || {})) {
      const lab = el('label', '', 'option'); const inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.type = 'radio'; inp.name = q.id; inp.value = k; inp.checked = draft[q.id] === k;
      lab.append(inp, document.createTextNode(`${k}. ${t}`)); fs.append(lab);
    }
    f.append(fs);
  });
  const bar = el('div', '', 'thi-bar'); const count = el('span', '', 'meta thi-count'); count.setAttribute('aria-live', 'polite');
  const err = el('p', '', 'thi-error'); err.setAttribute('role', 'alert');
  const submit = /** @type {HTMLButtonElement} */ (el('button', 'Nộp bài', 'primary thi-submit')); submit.type = 'submit';
  const exit = /** @type {HTMLButtonElement} */ (el('button', 'Thoát', 'thi-back thi-btn-ghost')); exit.type = 'button';
  exit.addEventListener('click', () => { cur = { phase: 'list', id: '', qs: [] }; void presence('hoc'); draw(); });
  const update = () => { const n = Object.keys(answers()).length; count.textContent = `Đã làm ${n}/${cur.qs.length} câu`; };
  f.addEventListener('change', () => { saveDraft(cur.id, answers()); update(); });
  f.addEventListener('submit', ev => { ev.preventDefault(); void doSubmit(submit, err); });
  bar.append(count, exit, submit); f.append(err, bar); w.append(f); update(); lockBanner();
}
function lockBanner() {
  const box = root?.querySelector('.thi-lock'); const b = bai[cur.id]; if (!box) return;
  box.textContent = b && b.trang_thai !== 'mo' ? 'Thầy cô đang tạm khóa bài thi. Bài làm vẫn được giữ trên máy, chờ mở lại rồi nộp.' : '';
}
/** @param {HTMLButtonElement} btn @param {HTMLElement} err */
async function doSubmit(btn, err) {
  const b = bai[cur.id]; if (!b || !me) return;
  const a = answers(), n = Object.keys(a).length, total = cur.qs.length;
  const ok = await confirmBox({ title: 'Nộp bài?', body: (n < total ? `Em mới làm ${n}/${total} câu. ` : `Em đã làm đủ ${total} câu. `) + (b.che_do === 'thu' ? 'Đây là thi thử, em làm lại được.' : 'Nộp rồi thì không làm lại được.'), okText: 'Nộp bài', cancelText: 'Làm tiếp' });
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
    if (b.xem_diem) await showStats(cur.id, true);
    else { cur = { phase: 'result', id: cur.id, qs: cur.qs, result: rec, fresh: true }; drawResult(); }
  } catch (e) {
    err.textContent = (e instanceof Error ? e.message : 'Chưa nộp được.') + ' Bài làm vẫn còn trên máy, bấm Nộp bài lần nữa.';
    btn.disabled = false; btn.textContent = 'Nộp bài';
  }
}

/* ---------- Kết quả: số lần thi, điểm, hạng trong lớp ---------- */
/** Trang kết quả. Chỉ dùng khi thầy cô cho xem điểm. @param {string} id @param {boolean} [fresh] vừa nộp xong */
async function showStats(id, fresh = false) {
  const b = bai[id]; if (!b || !me) return;
  if (!b.xem_diem) { cur = { phase: 'result', id, qs: [], result: mine[id], fresh }; drawResult(); return; }
  cur = { phase: 'result', id, qs: [], result: mine[id], fresh };
  const w = page(b.tieu_de, 'Đang tải kết quả…'); w.append(el('p', 'Đang tải kết quả…', 'meta thi-loading'));
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
  actions(w, b); hero.tabIndex = -1; hero.focus?.();
}
/** @param {HTMLElement} w @param {Bai|undefined} b */
function actions(w, b) {
  const row = el('div', '', 'thi-actions');
  if (b && b.che_do === 'thu' && b.trang_thai === 'mo') row.append(btn('Làm lại', 'primary', () => void startExam(cur.id)));
  row.append(backBtn('Về danh sách bài thi')); w.append(row);
}
