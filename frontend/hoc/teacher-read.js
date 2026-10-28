// @ts-check
// Thẻ "Học sinh đọc bài" (Tổng quan, giáo viên): đọc Firebase doc_read/{bài} (học sinh tự ghi % đọc khi cuộn bài) + thi_hs (danh sách lớp).
// Chỉ nghe MỘT bài đang chọn (không tải cả cây doc_read của mọi bài × mọi học sinh). Bảng vẽ từng trang 50 dòng.
// Giáo viên lớp chỉ thấy lớp mình phụ trách.
import * as store from './thi-store.js';
import { api } from './api.js';
import * as ui from './teacher-ui.js?v=20261029a';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @type {Record<string, any>} */ let reads = {};
/** @type {Record<string, any>} */ let hs = {};
/** @type {{key:string,title:string,grade:number}[]} */ let lessons = [];
/** @type {null|(() => void)} */ let stop = null;
let started = false, watching = '', limit = ui.PAGE;
const lessonKey = (/** @type {string} */ c, /** @type {string} */ l) => `${c}~${l}`.replace(/[.#$[\]/]/g, '_').slice(0, 120);
/** Lớp của giáo viên lớp (null = quản trị, thấy mọi lớp). @returns {string[]|null} */
function myClasses() { try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); return t && Array.isArray(t.lop) ? t.lop.map(String) : null; } catch { return null; } }
const gradeOf = (/** @type {string} */ lop) => Number(String(lop).match(/^\d+/)?.[0]) || 0;

async function start() {
  if (started) return;
  if (!store.enabled()) { $('read-report-sub').textContent = 'Chưa cài dự án Firebase (presence-config.js).'; return; }
  started = true;
  try {
    const cat = await api('/pwa/catalog');
    lessons = [];
    for (const c of cat?.courses || []) for (const l of c.lessons || []) lessons.push({ key: lessonKey(c.id, l.id), title: `${l.title} · Lớp ${c.grade}`, grade: Number(c.grade) || 0 });
  } catch { lessons = []; }
  hs = (await store.get('thi_hs').catch(() => null)) || {};
  fillSelects(); watch();
}
function fillSelects() {
  const mine = myClasses(), grades = mine ? new Set(mine.map(gradeOf)) : null;
  const ls = /** @type {HTMLSelectElement} */ ($('read-lesson')), keep = ls.value;
  const list = lessons.filter(l => !grades || grades.has(l.grade));
  ls.replaceChildren(...(list.length ? list.map(l => new Option(l.title, l.key)) : [new Option('Chưa tải được danh sách bài', '')]));
  if (list.some(l => l.key === keep)) ls.value = keep;
  const lop = /** @type {HTMLSelectElement} */ ($('read-lop')), keepL = lop.value;
  const lops = [...new Set(Object.values(hs).map(s => String(s?.lop || '')).filter(l => l && (!mine || mine.includes(l))))].sort();
  lop.replaceChildren(...(mine ? [] : [new Option('Tất cả lớp', '')]), ...lops.map(l => new Option('Lớp ' + l, l)));
  if (lops.includes(keepL)) lop.value = keepL;
  else { const g = list.find(l => l.key === ls.value)?.grade; const first = lops.find(l => gradeOf(l) === g); if (first) lop.value = first; }
}
/** Nghe đúng bài đang chọn. */
function watch() {
  const key = /** @type {HTMLSelectElement} */ ($('read-lesson')).value;
  if (key === watching && stop) { render(); return; }
  stop?.(); stop = null; reads = {}; watching = key; limit = ui.PAGE; render();
  if (key) stop = store.listen('doc_read/' + key, d => { reads = d || {}; render(); });
}
function render() {
  const lopSel = /** @type {HTMLSelectElement} */ ($('read-lop')), lop = lopSel.value, mine = myClasses();
  const g = lessons.find(l => l.key === watching)?.grade || 0;   // bài lớp 9 → chỉ tính học sinh khối 9
  const okLop = (/** @type {string} */ l) => (!lop || l === lop) && (!mine || mine.includes(l)) && (!g || gradeOf(l) === g);
  // Mọi học sinh của lớp (kể cả em chưa đọc) + em có đọc mà chưa có trong danh sách.
  const rows = new Map();
  for (const [k, s] of Object.entries(hs)) if (s && okLop(String(s.lop || ''))) rows.set(k, { name: String(s.ten || k), lop: String(s.lop || ''), pct: 0, at: 0 });
  for (const [k, v] of Object.entries(reads)) {
    if (!v) continue; const l = String(v.lop || rows.get(k)?.lop || '');
    if (okLop(l)) rows.set(k, { name: String(v.ten || rows.get(k)?.name || k), lop: l, pct: Math.min(100, Number(v.pct) || 0), at: Number(v.at) || 0 });
  }
  const list = [...rows.values()].sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, 'vi'));
  const done = list.filter(x => x.pct >= 100).length, startedN = list.filter(x => x.pct > 0).length;
  const m = $('read-metrics'); m.replaceChildren();
  for (const [k, v] of [['Học sinh', list.length], ['Đã đọc hết', done], ['Đang đọc', startedN - done], ['Chưa đọc', list.length - startedN]]) { const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = String(k); b.textContent = String(v); w.append(a, b); m.append(w); }
  const body = $('read-body'); body.replaceChildren();
  const table = /** @type {HTMLElement} */ (body.closest('table'));
  if (!list.length || !watching) { const tr = document.createElement('tr'), c = document.createElement('td'); c.colSpan = 4; c.className = 't-muted'; c.textContent = 'Chưa có dữ liệu.'; tr.append(c); body.append(tr); if (table) ui.moreRows(table, 0, 0, () => {}); return; }
  const frag = document.createDocumentFragment();
  for (const x of list.slice(0, limit)) {
    const tr = document.createElement('tr');
    const cell = (/** @type {string} */ l, /** @type {string|Node} */ v) => { const c = document.createElement('td'); c.dataset.label = l; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };
    const bar = document.createElement('span'); bar.className = 'read-mini'; bar.style.setProperty('--pct', x.pct + '%'); bar.setAttribute('aria-hidden', 'true');
    const pct = document.createElement('span'); pct.className = 'read-mini-wrap'; pct.append(bar, document.createTextNode(x.pct >= 100 ? 'Đọc hết' : x.pct ? x.pct + '%' : 'Chưa đọc'));
    tr.append(cell('Học sinh', x.name), cell('Lớp', x.lop), cell('Đã đọc', pct), cell('Lúc', x.at ? new Date(x.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'));
    frag.append(tr);
  }
  body.append(frag);
  if (table) ui.moreRows(table, Math.min(limit, list.length), list.length, () => { limit += ui.PAGE; render(); });
}
$('read-lesson').addEventListener('change', () => { fillSelects(); watch(); });
$('read-lop').addEventListener('change', () => { limit = ui.PAGE; render(); });
document.getElementById('nav-overview')?.addEventListener('click', () => void start());
document.getElementById('teacher-logout')?.addEventListener('click', () => { stop?.(); stop = null; reads = {}; hs = {}; watching = ''; started = false; });
// Mở trang đã đăng nhập (Tổng quan là trang đầu): bắt đầu ngay khi thẻ hiện ra.
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) void start(); });
io.observe($('read-report'));
