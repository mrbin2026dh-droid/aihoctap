// @ts-check
// Thẻ "Học sinh đọc bài" (Tổng quan, giáo viên), thiết kế lại 29/10 cho trường nhiều lớp, nhiều môn:
//  1. Chọn LỚP (giáo viên lớp: chỉ lớp mình; quản trị: từng lớp hoặc cả khối) → 2. MÔN (chỉ hiện khi khối đó có nhiều môn)
//  3. Bảng tổng hợp MỌI BÀI của khối/môn đó: đã đọc hết / đang đọc / chưa đọc / thanh tiến độ lớp → bấm một bài
//  4. Chi tiết từng em của bài đó (nghe tức thì 1 bài, vẽ 50 dòng/lần).
// Dữ liệu: Firebase doc_read/{bài}/{mã} (học sinh tự ghi % đọc) + thi_hs (danh sách lớp). Bảng tổng hợp đọc mỗi bài MỘT lần (không nghe liên tục).
import * as store from './thi-store.js';
import { api } from './api.js';
import * as ui from './teacher-ui.js?v=20261030b';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const sel = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
/** @type {Record<string, any>} */ let reads = {};
/** @type {Record<string, any>} */ let hs = {};
/** @type {{key:string,title:string,grade:number,subject:string}[]} */ let lessons = [];
/** @type {Record<string, Record<string, any>>} doc_read đã đọc cho bảng tổng hợp */ let sumCache = {};
/** @type {null|(() => void)} */ let stop = null;
let started = false, watching = '', limit = ui.PAGE, sumToken = 0;
const lessonKey = (/** @type {string} */ c, /** @type {string} */ l) => `${c}~${l}`.replace(/[.#$[\]/]/g, '_').slice(0, 120);
/** @returns {string[]|null} lớp của giáo viên lớp (null = quản trị) */
function myClasses() { try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); return t && Array.isArray(t.lop) ? t.lop.map(String) : null; } catch { return null; } }
const gradeOf = (/** @type {string} */ lop) => Number(String(lop).match(/^\d+/)?.[0]) || 0;
/** Lớp đang chọn → {grade, classes[]} ("k:9" = cả khối 9). */
function scope() {
  const v = sel('read-lop').value, mine = myClasses();
  const all = [...new Set(Object.values(hs).map(s => String(s?.lop || '')).filter(l => l && (!mine || mine.includes(l))))];
  if (v.startsWith('k:')) { const g = Number(v.slice(2)); return { grade: g, classes: all.filter(l => gradeOf(l) === g) }; }
  return { grade: gradeOf(v), classes: v ? [v] : [] };
}
const inScope = (/** @type {string} */ lop) => scope().classes.includes(lop);

async function start() {
  if (started) return;
  if (!store.enabled()) { $('read-report-sub').textContent = 'Chưa cài dự án Firebase (presence-config.js).'; return; }
  started = true;
  try {
    const cat = await api('/pwa/catalog');
    lessons = [];
    for (const c of cat?.courses || []) for (const l of c.lessons || []) lessons.push({ key: lessonKey(c.id, l.id), title: String(l.title || ''), grade: Number(c.grade) || 0, subject: String(c.subject_name || c.title || 'Môn học').replace(/\s*\d+$/, '') });
  } catch { lessons = []; }
  hs = (await store.get('thi_hs').catch(() => null)) || {};
  fillClasses(); fillSubjects(); void summary();
}
/** Lớp: nhóm theo khối; quản trị có thêm "Cả khối N". Mặc định: lớp/khối đông học sinh nhất. */
function fillClasses() {
  const mine = myClasses(), lop = sel('read-lop'), keep = lop.value;
  const count = /** @type {Record<string, number>} */ ({});
  for (const s of Object.values(hs)) { const l = String(s?.lop || ''); if (l && (!mine || mine.includes(l))) count[l] = (count[l] || 0) + 1; }
  const classes = Object.keys(count).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const grades = [...new Set(classes.map(gradeOf))].sort((a, b) => b - a);
  lop.replaceChildren();
  if (!classes.length) { lop.append(new Option('Chưa có lớp nào có học sinh', '')); return; }
  for (const g of grades) {
    const og = document.createElement('optgroup'); og.label = `Khối ${g}`;
    const cl = classes.filter(l => gradeOf(l) === g);
    if (!mine && cl.length > 1) og.append(new Option(`Cả khối ${g} (${cl.length} lớp)`, 'k:' + g));
    for (const l of cl) og.append(new Option(`Lớp ${l} (${count[l]} em)`, l));
    lop.append(og);
  }
  const values = [...lop.querySelectorAll('option')].map(o => o.value);
  // Quản trị: chọn lớp MỘT chỗ ở đầu Tổng quan; ô Lớp ở thẻ này ẩn đi và đi theo lựa chọn đó.
  const ov = /** @type {HTMLSelectElement|null} */ (document.getElementById('overview-class'))?.value || '';
  const fieldEl = /** @type {HTMLElement|null} */ (lop.closest('.t-field')); if (fieldEl) fieldEl.hidden = !mine;
  if (!mine) $('read-report-sub').textContent = 'Theo lớp đã chọn ở đầu trang. Bấm một bài để xem từng em.';
  if (!mine && ov && values.includes(ov)) { lop.value = ov; return; }
  if (values.includes(keep)) { lop.value = keep; return; }
  // mặc định: khối (quản trị) hoặc lớp (giáo viên lớp) đông học sinh nhất
  const byGrade = grades.map(g => ({ v: !mine && classes.filter(l => gradeOf(l) === g).length > 1 ? 'k:' + g : classes.find(l => gradeOf(l) === g) || '', n: classes.filter(l => gradeOf(l) === g).reduce((a, l) => a + count[l], 0) })).sort((a, b) => b.n - a.n);
  lop.value = mine ? classes.sort((a, b) => count[b] - count[a])[0] : byGrade[0].v;
}
function fillSubjects() {
  const g = scope().grade, subs = [...new Set(lessons.filter(l => l.grade === g).map(l => l.subject))];
  const s = sel('read-subject'), keep = s.value;
  s.replaceChildren(...subs.map(x => new Option(x, x)));
  if (subs.includes(keep)) s.value = keep;
  $('read-subject-field').hidden = subs.length <= 1;
}
const scopedLessons = () => { const g = scope().grade, sub = sel('read-subject').value; return lessons.filter(l => l.grade === g && (!sub || l.subject === sub || $('read-subject-field').hidden)); };
/** Học sinh trong phạm vi lớp đang chọn: {mã: {ten, lop}} */
const roster = () => Object.fromEntries(Object.entries(hs).filter(([, s]) => s && inScope(String(s.lop || ''))).map(([k, s]) => [k, { ten: String(s.ten || k), lop: String(s.lop || '') }]));

/** Bảng tổng hợp mọi bài của khối/môn: đọc mỗi bài một lần. */
async function summary() {
  const body = $('read-sum-body'), list = scopedLessons(), my = ++sumToken;
  const ls = sel('read-lesson'), keep = ls.value;
  ls.replaceChildren(...(list.length ? list.map(l => new Option(l.title, l.key)) : [new Option('Khối này chưa có bài học', '')]));
  ls.value = list.some(l => l.key === keep) ? keep : (list[0]?.key || '');
  if (!list.length) { body.replaceChildren(row([cellT('Khối này chưa có bài học.', 5, 't-muted')])); watch(); return; }
  body.replaceChildren(row([cellT('Đang tải tiến độ đọc…', 5, 't-muted ld-inline')]));
  watch();
  await Promise.all(list.map(async l => { if (!(l.key in sumCache)) sumCache[l.key] = (await store.get('doc_read/' + l.key).catch(() => null)) || {}; }));
  if (my !== sumToken) return;
  drawSummary();
}
function drawSummary() {
  const body = $('read-sum-body'), list = scopedLessons(), r = roster(), n = Object.keys(r).length;
  body.replaceChildren();
  for (const l of list) {
    const d = sumCache[l.key] || {}; let done = 0, doing = 0;
    for (const k of Object.keys(r)) { const p = Number(d[k]?.pct) || 0; if (p >= 100) done++; else if (p > 0) doing++; }
    const pct = n ? Math.round(100 * done / n) : 0;
    const name = document.createElement('button'); name.type = 'button'; name.className = 'read-sum-open'; name.textContent = l.title;
    name.setAttribute('aria-label', `Xem từng em: ${l.title}`); name.addEventListener('click', () => { sel('read-lesson').value = l.key; watch(); $('read-detail').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    const bar = document.createElement('span'); bar.className = 'read-mini read-mini-lg'; bar.style.setProperty('--pct', pct + '%'); bar.setAttribute('aria-hidden', 'true');
    const prog = document.createElement('span'); prog.className = 'read-mini-wrap'; prog.append(bar, document.createTextNode(`${pct}%`));
    const tr = row([cellN('Bài học', name), cellT(`${done}/${n}`, 1, '', 'Đã đọc hết'), cellT(String(doing), 1, '', 'Đang đọc'), cellT(String(n - done - doing), 1, n - done - doing ? 'read-none' : '', 'Chưa đọc'), cellN('Tiến độ lớp', prog)]);
    if (l.key === watching) tr.classList.add('is-current');
    body.append(tr);
  }
}
function row(/** @type {HTMLElement[]} */ cells) { const tr = document.createElement('tr'); tr.append(...cells); return tr; }
function cellT(/** @type {string} */ text, span = 1, cls = '', label = '') { const c = document.createElement('td'); c.textContent = text; if (span > 1) c.colSpan = span; if (cls) c.className = cls; if (label) c.dataset.label = label; return c; }
function cellN(/** @type {string} */ label, /** @type {Node} */ node) { const c = document.createElement('td'); c.dataset.label = label; c.append(node); return c; }

/** Chi tiết: nghe đúng bài đang chọn. */
function watch() {
  const key = sel('read-lesson').value;
  if (key === watching && stop) { render(); return; }
  stop?.(); stop = null; reads = {}; watching = key; limit = ui.PAGE; render();
  if (key) stop = store.listen('doc_read/' + key, d => { reads = d || {}; if (watching) sumCache[watching] = reads; render(); drawSummary(); }, undefined, { prio: 0 });
}
function render() {
  const r = roster();
  const rows = new Map();
  for (const [k, s] of Object.entries(r)) rows.set(k, { name: s.ten, lop: s.lop, pct: 0, at: 0 });
  for (const [k, v] of Object.entries(reads)) {
    if (!v) continue; const l = String(v.lop || rows.get(k)?.lop || '');
    if (inScope(l)) rows.set(k, { name: String(v.ten || rows.get(k)?.name || k), lop: l, pct: Math.min(100, Number(v.pct) || 0), at: Number(v.at) || 0 });
  }
  const list = [...rows.values()].sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, 'vi'));
  const done = list.filter(x => x.pct >= 100).length, startedN = list.filter(x => x.pct > 0).length;
  const m = $('read-metrics'); m.replaceChildren();
  for (const [k, v] of [['Học sinh', list.length], ['Đã đọc hết', done], ['Đang đọc', startedN - done], ['Chưa đọc', list.length - startedN]]) { const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = String(k); b.textContent = String(v); w.append(a, b); m.append(w); }
  const body = $('read-body'); body.replaceChildren();
  const table = /** @type {HTMLElement} */ (body.closest('table'));
  if (!list.length || !watching) { body.append(row([cellT('Chưa có dữ liệu.', 4, 't-muted')])); if (table) ui.moreRows(table, 0, 0, () => {}); return; }
  const frag = document.createDocumentFragment();
  for (const x of list.slice(0, limit)) {
    const bar = document.createElement('span'); bar.className = 'read-mini'; bar.style.setProperty('--pct', x.pct + '%'); bar.setAttribute('aria-hidden', 'true');
    const pct = document.createElement('span'); pct.className = 'read-mini-wrap'; pct.append(bar, document.createTextNode(x.pct >= 100 ? 'Đọc hết' : x.pct ? x.pct + '%' : 'Chưa đọc'));
    frag.append(row([cellT(x.name, 1, '', 'Học sinh'), cellT(x.lop, 1, '', 'Lớp'), cellN('Đã đọc', pct), cellT(x.at ? new Date(x.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—', 1, '', 'Lúc')]));
  }
  body.append(frag);
  if (table) ui.moreRows(table, Math.min(limit, list.length), list.length, () => { limit += ui.PAGE; render(); });
}
sel('read-lesson').addEventListener('change', () => { watch(); drawSummary(); });
sel('read-lop').addEventListener('change', () => { limit = ui.PAGE; fillSubjects(); void summary(); });
sel('read-subject').addEventListener('change', () => { void summary(); });
document.getElementById('nav-overview')?.addEventListener('click', () => void start());
document.getElementById('teacher-logout')?.addEventListener('click', () => { stop?.(); stop = null; reads = {}; hs = {}; sumCache = {}; watching = ''; started = false; });
// Mở trang đã đăng nhập (Tổng quan là trang đầu): bắt đầu ngay khi thẻ hiện ra.
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) void start(); });
io.observe($('read-report'));
