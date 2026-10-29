// @ts-check
// Menu "Hiệu quả" (giáo viên): minh chứng hiệu quả học tập từ dữ liệu THẬT trên Firebase, máy tính (không AI):
//  - Tiến bộ thi thử: điểm lần đầu (dau) so với điểm cao nhất (cao_nhat) của từng em.
//  - Bản đồ năng lực lớp: cộng nang_luc/{mã}.topics của các em trong lớp.
//  - Đọc bài: % em đọc hết bài (doc_read).
//  - Học sinh cần hỗ trợ; xuất CSV (UTF-8) để đưa vào hồ sơ.
// Giáo viên lớp chỉ thấy lớp mình phụ trách.
import * as store from './thi-store.js';
import { SHEET_API } from './sheet-config.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const pct = (/** @type {number} */ a, /** @type {number} */ b) => b ? Math.round(100 * a / b) : 0;
/** @returns {string[]|null} */
function myClasses() { try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); return t && Array.isArray(t.lop) ? t.lop.map(String) : null; } catch { return null; } }
/** @type {{hs:Record<string,any>, bai:Record<string,any>, nop:Record<string,any>, nl:Record<string,any>, dr:Record<string,any>}|null} */ let data = null;
/** @type {any[]} */ let rows = [];

/** Tính toàn bộ số liệu cho một lớp (rỗng = mọi lớp trong phạm vi). Hàm thuần, có test. @param {any} d @param {string} lop @param {string[]|null} mine */
export function compute(d, lop, mine) {
  const inLop = (/** @type {any} */ s) => s && (!lop || String(s.lop) === lop) && (!mine || mine.includes(String(s.lop)));
  const students = Object.entries(d.hs || {}).filter(([, s]) => inLop(s)).map(([k, s]) => ({ k, ma: s.ma || k, ten: s.ten || k, lop: s.lop || '' }));
  const keys = new Set(students.map(s => s.k));
  // Thi thử: lần đầu vs cao nhất
  const trials = Object.entries(d.bai || {}).filter(([, b]) => b && b.che_do === 'thu');
  /** @type {any[]} */ const exams = []; /** @type {Record<string, {n:number, dau:number, best:number}>} */ const per = {};
  for (const [id, b] of trials) {
    const recs = Object.entries(d.nop?.[id] || {}).filter(([k, r]) => keys.has(k) && r && Number(r.tong) > 0);
    if (!recs.length) continue;
    let sd = 0, sb = 0, up = 0;
    for (const [k, r] of recs) {
      const t = Number(r.tong), dau = pct(Number(r.dau ?? r.diem) || 0, t), best = pct(Number(r.cao_nhat ?? r.diem) || 0, t);
      sd += dau; sb += best; if (best > dau) up++;
      const p = per[k] || { n: 0, dau: 0, best: 0 }; p.n++; p.dau += dau; p.best += best; per[k] = p;
    }
    exams.push({ id, ten: b.tieu_de, n: recs.length, dau: Math.round(sd / recs.length), best: Math.round(sb / recs.length), up });
  }
  // Bản đồ năng lực lớp
  /** @type {Record<string,{ten:string,d:number,n:number,weak:number}>} */ const topics = {};
  /** @type {Record<string, number>} */ const mastery = {};
  for (const s of students) {
    const t = d.nl?.[s.k]?.topics; if (!t) continue;
    let dd = 0, nn = 0;
    for (const [key, v] of Object.entries(t)) { const r = topics[key] || { ten: String(v?.ten || key), d: 0, n: 0, weak: 0 }; r.d += Number(v?.d) || 0; r.n += Number(v?.n) || 0; if (pct(Number(v?.d) || 0, Number(v?.n) || 0) < 50) r.weak++; topics[key] = r; dd += Number(v?.d) || 0; nn += Number(v?.n) || 0; }
    if (nn) mastery[s.k] = pct(dd, nn);
  }
  const topicList = Object.values(topics).filter(t => t.n > 0).map(t => ({ ...t, pct: pct(t.d, t.n) })).sort((a, b) => a.pct - b.pct);
  // Đọc bài
  /** @type {Record<string, {sum:number, n:number, done:number}>} */ const reads = {};
  for (const lesson of Object.values(d.dr || {})) for (const [k, v] of Object.entries(lesson || {})) { if (!keys.has(k)) continue; const r = reads[k] || { sum: 0, n: 0, done: 0 }; r.sum += Number(v?.pct) || 0; r.n++; if (Number(v?.pct) >= 100) r.done++; reads[k] = r; }
  // Theo từng em
  const people = students.map(s => {
    const p = per[s.k], r = reads[s.k];
    const weak = Object.values(d.nl?.[s.k]?.topics || {}).map((/** @type {any} */ v) => ({ ten: String(v?.ten || ''), p: pct(Number(v?.d) || 0, Number(v?.n) || 0) })).filter(x => x.p < 50).sort((a, b) => a.p - b.p).slice(0, 3).map(x => `${x.ten} (${x.p}%)`);
    return { ...s, thi: p ? p.n : 0, dau: p ? Math.round(p.dau / p.n) : null, best: p ? Math.round(p.best / p.n) : null, doc: r ? Math.round(r.sum / r.n) : null, doc_het: r ? r.done : 0, nang_luc: mastery[s.k] ?? null, yeu: weak };
  });
  const did = people.filter(x => x.dau !== null);
  const avgDau = did.length ? Math.round(did.reduce((a, x) => a + /** @type {number} */ (x.dau), 0) / did.length) : null;
  const avgBest = did.length ? Math.round(did.reduce((a, x) => a + /** @type {number} */ (x.best), 0) / did.length) : null;
  const readers = people.filter(x => x.doc !== null);
  const help = people.filter(x => (x.nang_luc !== null && x.nang_luc < 50) || (x.best !== null && x.best < 50)).sort((a, b) => (a.nang_luc ?? a.best ?? 0) - (b.nang_luc ?? b.best ?? 0));
  return {
    students: students.length, exams, topics: topicList, people, help,
    metrics: { lam_thi: did.length, dau: avgDau, best: avgBest, tien_bo: avgDau !== null && avgBest !== null ? avgBest - avgDau : null, tien_bo_em: did.filter(x => /** @type {number} */ (x.best) > /** @type {number} */ (x.dau)).length, doc_bai: readers.length ? Math.round(readers.reduce((a, x) => a + /** @type {number} */ (x.doc), 0) / readers.length) : null, co_nang_luc: Object.keys(mastery).length }
  };
}

/** Một ô CSV an toàn (chặn công thức khi mở bằng Excel). @param {unknown} v */
export const csvCell = v => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function load() {
  if (!store.enabled()) { $('eff-status').textContent = 'Chưa cài dự án Firebase (presence-config.js).'; return; }
  $('eff-status').textContent = 'Đang tải số liệu…'; /** @type {HTMLButtonElement} */ ($('eff-csv')).disabled = true;
  try {
    const [hs, bai, nl, dr] = await Promise.all([store.get('thi_hs'), store.get('thi_bai'), store.get('nang_luc').catch(() => null), store.get('doc_read').catch(() => null)]);
    const nop = {}; await Promise.all(Object.entries(bai || {}).filter(([, b]) => b && b.che_do === 'thu').map(([id]) => store.get('thi_nop/' + id).then(v => { /** @type {any} */ (nop)[id] = v || {}; }).catch(() => {})));
    data = { hs: hs || {}, bai: bai || {}, nop, nl: nl || {}, dr: dr || {} };
    const mine = myClasses(), sel = /** @type {HTMLSelectElement} */ ($('eff-lop')), keep = sel.value;
    const lops = [...new Set(Object.values(data.hs).map((/** @type {any} */ s) => String(s?.lop || '')).filter(l => l && (!mine || mine.includes(l))))].sort();
    sel.replaceChildren(...(mine && lops.length === 1 ? [] : [new Option(mine ? 'Các lớp của tôi' : 'Tất cả lớp', '')]), ...lops.map(l => new Option('Lớp ' + l, l))); if (lops.includes(keep)) sel.value = keep;
    render();
  } catch (e) {
    const st = $('eff-status'), again = document.createElement('button');
    again.type = 'button'; again.className = 't-button eff-retry'; again.textContent = 'Thử lại'; again.addEventListener('click', () => void load());
    st.replaceChildren(document.createTextNode((e instanceof Error ? e.message : 'Chưa tải được số liệu.') + ' '), again);
  }
}
function render() {
  if (!data) return;
  const r = compute(data, /** @type {HTMLSelectElement} */ ($('eff-lop')).value, myClasses()); rows = r.people;
  const m = r.metrics, fmt = (/** @type {number|null} */ v, suf = '%') => v === null ? '—' : v + suf;
  const box = $('eff-metrics'); box.replaceChildren();
  for (const [k, v, note] of /** @type {[string,string,string][]} */ ([['Học sinh', String(r.students), `${m.lam_thi} em đã làm thi thử`], ['Tiến bộ thi thử', m.tien_bo === null ? '—' : (m.tien_bo >= 0 ? '+' : '') + m.tien_bo + ' điểm %', `Lần đầu ${fmt(m.dau)} → cao nhất ${fmt(m.best)} · ${m.tien_bo_em} em tiến bộ`], ['Đọc bài trung bình', fmt(m.doc_bai), 'phần lý thuyết các bài đã mở'], ['Có Bản đồ năng lực', String(m.co_nang_luc), `cần hỗ trợ: ${r.help.length} em`]])) {
    const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'), c = document.createElement('p'); a.textContent = k; b.textContent = v; c.className = 't-muted eff-note'; c.textContent = note; w.append(a, b, c); box.append(w);
  }
  const tl = $('eff-topics'); tl.replaceChildren();
  if (!r.topics.length) { const li = document.createElement('li'); li.className = 't-muted'; li.textContent = 'Chưa có dữ liệu. Bản đồ xuất hiện khi học sinh làm bài luyện tập/thi có gắn chủ đề.'; tl.append(li); }
  for (const t of r.topics.slice(0, 20)) {
    const li = document.createElement('li'); li.className = 'eff-topic ' + (t.pct >= 80 ? 'is-good' : t.pct >= 50 ? 'is-mid' : 'is-weak');
    const name = document.createElement('span'); name.className = 'eff-topic-name'; name.textContent = t.ten;
    const bar = document.createElement('span'); bar.className = 'eff-bar'; bar.style.setProperty('--pct', t.pct + '%'); bar.setAttribute('aria-hidden', 'true');
    const v = document.createElement('strong'); v.textContent = t.pct + '%';
    const n = document.createElement('small'); n.textContent = `${t.d}/${t.n} câu · ${t.weak} em dưới 50%`;
    li.append(name, bar, v, n); tl.append(li);
  }
  const eb = $('eff-exams-body'); eb.replaceChildren();
  if (!r.exams.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.className = 't-muted'; td.textContent = 'Chưa có bài thi thử nào được làm.'; tr.append(td); eb.append(tr); }
  for (const e of r.exams) { const tr = document.createElement('tr'); for (const [l, v] of [['Bài thi thử', e.ten], ['Số em làm', String(e.n)], ['Lần đầu TB', e.dau + '%'], ['Cao nhất TB', e.best + '%'], ['Tiến bộ', `${e.best - e.dau >= 0 ? '+' : ''}${e.best - e.dau} · ${e.up} em`]]) { const td = document.createElement('td'); td.dataset.label = l; td.textContent = v; tr.append(td); } eb.append(tr); }
  const hl = $('eff-help'); hl.replaceChildren();
  if (!r.help.length) { const li = document.createElement('li'); li.className = 't-muted'; li.textContent = 'Không có em nào dưới 50%.'; hl.append(li); }
  for (const p of r.help.slice(0, 15)) { const li = document.createElement('li'); const a = document.createElement('strong'); a.textContent = `${p.ten} · ${p.lop}`; const b = document.createElement('span'); b.textContent = [p.nang_luc !== null ? `năng lực ${p.nang_luc}%` : '', p.best !== null ? `thi thử ${p.best}%` : '', p.yeu.length ? 'yếu: ' + p.yeu.join(', ') : ''].filter(Boolean).join(' · '); li.append(a, b); hl.append(li); }
  $('eff-status').textContent = `${r.students} học sinh · ${r.exams.length} bài thi thử có kết quả`; /** @type {HTMLButtonElement} */ ($('eff-csv')).disabled = !rows.length;
}
/* ---------- Bộ não AI (VPS): báo cáo tuần từng lớp, đọc từ Google Sheet (trang NaoAI) ---------- */
/** @type {any[]|null} */ let brain = null;
async function loadBrain() {
  const box = $('eff-brain'); box.replaceChildren(Object.assign(document.createElement('p'), { className: 't-muted ld-box', textContent: 'Đang tải báo cáo…' }));
  try {
    const c = (() => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '' }; } catch { return { gv: '', gv_ma: '' }; } })();
    if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet.');
    const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'gv_brain', gv: c.gv, ...(c.gv_ma ? { gv_ma: c.gv_ma } : {}) }) });
    const d = await res.json(); if (!d?.ok) throw new Error(d?.error || 'Google Sheet chưa trả lời.');
    brain = d.reports || [];
  } catch (e) { brain = null; box.replaceChildren(Object.assign(document.createElement('p'), { className: 't-muted', textContent: e instanceof Error ? e.message : 'Chưa tải được báo cáo.' })); return; }
  renderBrain();
}
/** Hiển thị markdown đơn giản (in đậm, gạch đầu dòng) bằng DOM, không chèn HTML. @param {HTMLElement} box @param {string} md */
export function mdInto(box, md) {
  let ul = null;
  for (const raw of String(md || '').split(/\n/)) {
    const line = raw.trim(); if (!line) { ul = null; continue; }
    const bullet = /^[-*•]\s+/.test(line), text = line.replace(/^[-*•]\s+/, '').replace(/^#+\s*/, '');
    const node = document.createElement(bullet ? 'li' : 'p');
    text.split('**').forEach((part, i) => node.append(i % 2 ? Object.assign(document.createElement('strong'), { textContent: part }) : document.createTextNode(part)));
    if (bullet) { if (!ul) { ul = document.createElement('ul'); box.append(ul); } ul.append(node); } else { ul = null; box.append(node); }
  }
}
function renderBrain() {
  const box = $('eff-brain'); box.replaceChildren(); if (!brain) return;
  const lop = /** @type {HTMLSelectElement} */ ($('eff-lop')).value, list = brain.filter(r => !lop || String(r.lop).toLowerCase() === lop.toLowerCase());
  if (!list.length) { const p = document.createElement('p'); p.className = 't-muted'; p.textContent = brain.length ? 'Chưa có báo cáo cho lớp này.' : 'Chưa có báo cáo. Bộ não AI chạy trên VPS mỗi tối 21:00 (xem docs/huong-dan-vps-bo-nao-ai.md).'; box.append(p); return; }
  for (const r of list) {
    const art = document.createElement('article'); art.className = 'brain-report';
    const h = document.createElement('h4'); h.textContent = `Lớp ${r.lop}`; const t = document.createElement('small'); t.className = 't-muted'; t.textContent = r.at ? ' · cập nhật ' + new Date(r.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; h.append(t);
    const body = document.createElement('div'); body.className = 'brain-md'; mdInto(body, r.md);
    art.append(h, body);
    const risk = r.facts?.can_chu_y || [];
    if (risk.length) { const d = document.createElement('details'); const s = document.createElement('summary'); s.textContent = `Học sinh cần chú ý (${risk.length})`; const ul = document.createElement('ul'); for (const x of risk) { const li = document.createElement('li'); li.textContent = `${x.ten}: ${(x.ly_do || []).join(', ')}`; ul.append(li); } d.append(s, ul); art.append(d); }
    box.append(art);
  }
}
$('eff-lop').addEventListener('change', () => { render(); renderBrain(); });
$('eff-csv').addEventListener('click', () => {
  const head = ['Mã học sinh', 'Họ tên', 'Lớp', 'Số bài thi thử đã làm', 'Điểm lần đầu TB (%)', 'Điểm cao nhất TB (%)', 'Tiến bộ (điểm %)', 'Đọc bài TB (%)', 'Số bài đọc hết', 'Năng lực chung (%)', 'Chủ đề yếu'];
  const lines = [head, ...rows.map(p => [p.ma, p.ten, p.lop, p.thi, p.dau ?? '', p.best ?? '', p.dau !== null && p.best !== null ? p.best - p.dau : '', p.doc ?? '', p.doc_het, p.nang_luc ?? '', p.yeu.join('; ')])].map(r => r.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hieu-qua-${/** @type {HTMLSelectElement} */ ($('eff-lop')).value || 'tat-ca'}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});
$('nav-effect').addEventListener('click', () => { void load(); void loadBrain(); });
document.getElementById('teacher-logout')?.addEventListener('click', () => { data = null; rows = []; brain = null; });
