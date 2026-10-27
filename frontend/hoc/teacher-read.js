// @ts-check
// Thẻ "Học sinh đọc bài" (Tổng quan, giáo viên): đọc Firebase doc_read (học sinh tự ghi % đọc khi cuộn bài) + thi_hs (danh sách lớp).
import * as store from './thi-store.js';
import { api } from './api.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @type {Record<string, Record<string, any>>} */ let reads = {};
/** @type {Record<string, any>} */ let hs = {};
/** @type {Record<string, string>} */ let titles = {};
/** @type {null|(() => void)} */ let stop = null;

async function start() {
  if (stop || !store.enabled()) { if (!store.enabled()) $('read-report-sub').textContent = 'Chưa cài dự án Firebase (presence-config.js).'; return; }
  try {
    const cat = await api('/pwa/catalog');
    for (const c of cat?.courses || []) for (const l of c.lessons || []) titles[`${c.id}~${l.id}`.replace(/[.#$[\]/]/g, '_')] = `${l.title} · Lớp ${c.grade}`;
  } catch { /* vẫn hiện mã bài */ }
  hs = (await store.get('thi_hs').catch(() => null)) || {};
  stop = store.listen('doc_read', d => { reads = d || {}; render(); });
}
function render() {
  const ls = /** @type {HTMLSelectElement} */ ($('read-lesson')), keep = ls.value, keys = Object.keys(reads).sort((a, b) => (titles[a] || a).localeCompare(titles[b] || b, 'vi'));
  ls.replaceChildren(...(keys.length ? keys.map(k => new Option(titles[k] || k, k)) : [new Option('Chưa có học sinh nào đọc bài', '')]));
  if (keys.includes(keep)) ls.value = keep;
  const lop = /** @type {HTMLSelectElement} */ ($('read-lop')), keepL = lop.value;
  const lops = [...new Set(Object.values(hs).map(s => String(s?.lop || '')).filter(Boolean))].sort();
  lop.replaceChildren(new Option('Tất cả lớp', ''), ...lops.map(l => new Option('Lớp ' + l, l))); if (lops.includes(keepL)) lop.value = keepL;
  const r = reads[ls.value] || {};
  // Mọi học sinh của lớp (kể cả em chưa đọc) + em có đọc mà chưa có trong danh sách.
  const rows = new Map();
  for (const [k, s] of Object.entries(hs)) if (s && (!lop.value || s.lop === lop.value)) rows.set(k, { name: s.ten, lop: s.lop, pct: 0, at: 0 });
  for (const [k, v] of Object.entries(r)) if (v && (!lop.value || v.lop === lop.value)) rows.set(k, { name: v.ten || rows.get(k)?.name || k, lop: v.lop || rows.get(k)?.lop || '', pct: Number(v.pct) || 0, at: Number(v.at) || 0 });
  const list = [...rows.values()].sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, 'vi'));
  const done = list.filter(x => x.pct >= 100).length, started = list.filter(x => x.pct > 0).length;
  const m = $('read-metrics'); m.replaceChildren();
  for (const [k, v] of [['Học sinh', list.length], ['Đã đọc hết', done], ['Đang đọc', started - done], ['Chưa đọc', list.length - started]]) { const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = String(k); b.textContent = String(v); w.append(a, b); m.append(w); }
  const body = $('read-body'); body.replaceChildren();
  if (!list.length || !ls.value) { const tr = document.createElement('tr'), c = document.createElement('td'); c.colSpan = 4; c.className = 't-muted'; c.textContent = 'Chưa có dữ liệu.'; tr.append(c); body.append(tr); return; }
  for (const x of list) {
    const tr = document.createElement('tr');
    const cell = (/** @type {string} */ l, /** @type {string|Node} */ v) => { const c = document.createElement('td'); c.dataset.label = l; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };
    const bar = document.createElement('span'); bar.className = 'read-mini'; bar.style.setProperty('--pct', x.pct + '%'); bar.setAttribute('aria-hidden', 'true');
    const pct = document.createElement('span'); pct.className = 'read-mini-wrap'; pct.append(bar, document.createTextNode(x.pct >= 100 ? 'Đọc hết' : x.pct ? x.pct + '%' : 'Chưa đọc'));
    tr.append(cell('Học sinh', x.name), cell('Lớp', x.lop), cell('Đã đọc', pct), cell('Lúc', x.at ? new Date(x.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'));
    body.append(tr);
  }
}
$('read-lesson').addEventListener('change', render);
$('read-lop').addEventListener('change', render);
document.getElementById('nav-overview')?.addEventListener('click', () => void start());
document.getElementById('teacher-logout')?.addEventListener('click', () => { stop?.(); stop = null; reads = {}; });
// Mở trang đã đăng nhập (Tổng quan là trang đầu): bắt đầu ngay khi thẻ hiện ra.
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); void start(); } });
io.observe($('read-report'));
