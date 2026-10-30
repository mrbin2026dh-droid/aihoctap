// @ts-check
// Giáo viên: tab "Thi đua" trong Tiện ích – Bảng thi đua Luyện tập theo LỚP và THÁNG (30/10/2026).
// Điểm tính bằng thidua-core.js (cùng mã với máy học sinh). Giáo viên thấy đủ cả lớp, từng buổi được tính / không tính,
// danh hiệu, tải Excel (CSV) để vào sổ, Chốt tháng (lưu bản chốt kèm thời điểm làm minh chứng), bỏ một buổi khỏi thi đua (có xác nhận).
import * as store from './thi-store.js';
import { confirmBox } from './dom.js';
import { monthVN, monthLabel, prevMonth, sessionsOf, rankMonth, fmt } from './thidua-core.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const sel = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const btn = (/** @type {string} */ id) => /** @type {HTMLButtonElement} */ ($(id));
function el(/** @type {string} */ tag, /** @type {string} */ cls = '', /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '', tok: sessionStorage.getItem('aisgk-pwa-teacher') || '' }; } catch { return { gv: '', gv_ma: '', tok: '' }; } };
const who = () => cred().gv_ma || 'admin';
/** Cùng công thức với teacher-quiz.js: lịch sử buổi (quiz_ls) nằm dưới đường dẫn bí mật của giáo viên. */
const ownerKey = () => { const c = cred(); const secret = c.gv || c.tok; return secret ? store.sha256(`luyen-tap|${who().toLowerCase()}|${secret}`) : ''; };
const when = (/** @type {number} */ t) => t ? new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const day = (/** @type {number} */ t) => t ? new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
/** @param {string} msg @param {'error'|'success'|''} [kind] */
function status(msg, kind = '') { const b = $('td-alert'); $('td-status').textContent = msg; b.hidden = !msg; b.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success'); }

/** @type {{lk:string, lop:string, thang:string, data:any, ls:any, chot:any}|null} */ let cur = null;
let inited = false, loadSeq = 0;

/** Lớp giáo viên được dùng (giống mục Luyện tập): giáo viên lớp = lớp phụ trách; quản trị = mọi lớp có học sinh. */
async function classes() {
  try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); if (t && Array.isArray(t.lop) && cred().gv_ma) return t.lop.map(String); } catch { /* bỏ qua */ }
  const idx = await store.get('thi_lop').catch(() => undefined);
  if (idx && typeof idx === 'object') return [...new Set(Object.values(idx).map((/** @type {any} */ x) => String(x?.lop || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const hs = await store.get('thi_hs').catch(() => undefined);
  return [...new Set(Object.values(hs || {}).map((/** @type {any} */ s) => String(s?.lop || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}
async function init() {
  if (inited) return; inited = true;
  const m = sel('td-thang'); let x = monthVN();
  for (let i = 0; i < 6; i++) { m.append(new Option(i === 0 ? `Tháng này (${monthLabel(x).slice(6)})` : monthLabel(x).replace(/^t/, 'T'), x)); x = prevMonth(x); }
  const ls = await classes();
  const l = sel('td-lop'); l.replaceChildren(...(ls.length ? ls.map(v => new Option('Lớp ' + v, v)) : [new Option('Chưa có lớp', '')]));
  try { const last = sessionStorage.getItem('td-lop'); if (last && ls.includes(last)) l.value = last; } catch { /* bỏ qua */ }
}
export async function open() { if (!store.enabled()) { status('Chưa cài dự án Firebase (presence-config.js).', 'error'); return; } await init(); await load(); }

async function load() {
  const lop = sel('td-lop').value, thang = sel('td-thang').value; if (!lop) { render(); return; }
  try { sessionStorage.setItem('td-lop', lop); } catch { /* bỏ qua */ }
  const seq = ++loadSeq, lk = store.keyOf(lop), owner = ownerKey();
  $('td-body').replaceChildren(rowMsg('Đang tải bảng thi đua…')); btn('td-reload').setAttribute('aria-busy', 'true');
  try {
    const [data, ls] = await Promise.all([store.get(`quiz_kq_lop/${lk}/${thang}`), owner ? store.get(`quiz_ls/${owner}`).catch(() => null) : Promise.resolve(null)]);
    if (seq !== loadSeq) return;
    cur = { lk, lop, thang, data, ls: ls || {}, chot: (ls || {})[`chot_${lk}_${thang}`] || null };
    status(''); render();
  } catch (e) { if (seq === loadSeq) { cur = null; $('td-body').replaceChildren(rowMsg('Chưa tải được. Kiểm tra mạng rồi bấm Tải lại.')); status('Chưa tải được bảng thi đua: ' + (e instanceof Error ? e.message : ''), 'error'); } }
  finally { if (seq === loadSeq) btn('td-reload').removeAttribute('aria-busy'); }
}
const rowMsg = (/** @type {string} */ m) => { const tr = el('tr'); const td = el('td', 't-muted', m); /** @type {HTMLTableCellElement} */ (td).colSpan = 6; tr.append(td); return tr; };
const td = (/** @type {string} */ label, /** @type {string|Node} */ v, cls = '') => { const c = el('td', cls); c.dataset.label = label; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };
/** Danh sách cho bản chốt / so sánh thay đổi sau khi chốt. @param {ReturnType<typeof rankMonth>} R */
const snap = R => R.rows.map(r => ({ hang: r.hang, ma: r.k, ten: r.ten, diem: r.diem, buoi: r.buoi, dung: r.dung, tong: r.tong }));

function render() {
  const sessions = sessionsOf(cur?.data), R = rankMonth(sessions);
  const all = R.rows.length + R.chua.length;
  const metrics = $('td-metrics'); metrics.replaceChildren();
  for (const [k, v] of [['Buổi luyện tập', String(R.K)], ['Buổi được tính (cao nhất)', R.K ? `${R.N}/${R.K}` : '–'], ['Được xếp hạng', `${R.rows.length}/${all} em`], ['Điểm TB lớp', R.tbLop]]) { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); metrics.append(d); }
  $('td-rule').textContent = R.K ? `Điểm buổi = số câu đúng ÷ số câu × 10. Điểm tháng = trung bình ${R.N} buổi cao nhất của mỗi em (60% của ${R.K} buổi, làm tròn lên). Cần tham gia ít nhất ${R.N} buổi để được xếp hạng. Bằng điểm: xét số buổi tham gia, rồi số câu đúng.` : '';
  // Bản chốt
  const ch = cur?.chot, changed = ch && JSON.stringify(ch.rows || []) !== JSON.stringify(snap(R));
  $('td-chot-info').textContent = ch ? `Đã chốt lúc ${when(Number(ch.at))}${changed ? '. Dữ liệu đã thay đổi sau khi chốt (có buổi được thêm hoặc bỏ), bấm Chốt lại nếu muốn cập nhật.' : '.'}` : '';
  $('td-chot-info').className = 't-muted td-chot-info' + (changed ? ' is-warn' : '');
  btn('td-chot').textContent = ch ? 'Chốt lại' : 'Chốt tháng'; btn('td-chot').disabled = !R.rows.length; btn('td-csv').disabled = !all;
  // Danh hiệu
  const aw = $('td-awards'); aw.replaceChildren();
  if (R.chamChi.length) { const p = el('p', 'td-t-award'); p.append(el('strong', '', 'Chăm chỉ nhất: '), document.createTextNode(`${R.chamChi.map(r => r.ten).join(', ')} (${R.chamChi[0].buoi}/${R.K} buổi)`)); aw.append(p); }
  if (R.tienBo.length) { const p = el('p', 'td-t-award'); p.append(el('strong', '', 'Tiến bộ nhất: '), document.createTextNode(`${R.tienBo.map(e => e.row.ten).join(', ')} (buổi cuối hơn buổi đầu ${fmt(R.tienBo[0].tang)} điểm)`)); aw.append(p); }
  // Bảng xếp hạng
  const body = $('td-body'); body.replaceChildren();
  if (!cur?.lop) body.append(rowMsg('Chọn lớp.'));
  else if (!R.K) body.append(rowMsg(`${monthLabel(cur.thang).replace(/^t/, 'T')}: lớp ${cur.lop} chưa có buổi Luyện tập trên lớp nào. Mở Luyện tập cho lớp này, kết thúc buổi là kết quả tự vào bảng.`));
  else if (!R.rows.length) body.append(rowMsg(`Chưa em nào đủ ${R.N} buổi để được xếp hạng.`));
  for (const r of R.rows) {
    const tr = el('tr', r.hang <= 3 ? `td-top td-top-${r.hang}` : r.hang <= 10 ? 'td-top10' : '');
    const nm = el('div', 'td-t-name'); nm.append(el('strong', '', r.ten), el('small', '', r.k.toUpperCase()));
    const rk = el('span', 'td-t-rank' + (r.hang <= 3 ? ` td-t-rank-${r.hang}` : ''), String(r.hang));
    tr.append(td('Hạng', rk, 't-number'), td('Học sinh', nm), td('Điểm tháng', el('strong', 'td-t-score', r.diem), 't-number'), td('Buổi tham gia', `${r.buoi}/${R.K}`, 't-number'), td('Câu đúng', `${r.dung}/${r.tong}`, 't-number'), td('Các buổi', chips(r)));
    body.append(tr);
  }
  const chua = $('td-chua'); chua.replaceChildren();
  $('td-chua-card').hidden = !R.chua.length;
  for (const r of R.chua) { const li = el('li'); li.append(el('strong', '', r.ten), el('span', '', ` · ${r.buoi}/${R.K} buổi, cần thêm ${r.thieu} buổi`)); chua.append(li); }
  // Các buổi trong tháng
  const bl = $('td-buoi'); bl.replaceChildren();
  $('td-buoi-card').hidden = !sessions.length;
  for (const s of [...sessions].reverse()) {
    const li = el('li', 'td-buoi-row'), n = Object.keys(s.kq).length;
    const tot = Object.values(s.kq).reduce((a, e) => a + e.c, 0);
    const info = el('div'); info.append(el('strong', '', s.bo || 'Luyện tập'), el('span', 't-muted', ` · ${when(s.at)} · ${s.so_cau} câu · ${n} em · đúng TB ${n ? fmt(Math.round(1000 * tot / (n * s.so_cau))) : '–'}`));
    li.append(info);
    const key = cur?.ls?.[s.room]?.key;
    if (key) {
      const b = /** @type {HTMLButtonElement} */ (el('button', 't-button td-bo', 'Bỏ khỏi thi đua')); b.type = 'button';
      b.addEventListener('click', () => void removeSession(s, String(key), b));
      b.setAttribute('aria-label', `Bỏ buổi ${s.bo} lúc ${when(s.at)} khỏi bảng thi đua`); li.append(b);
    } else li.append(el('small', 't-muted td-bo-note', 'Buổi do tài khoản khác mở'));
    bl.append(li);
  }
}
/** Điểm từng buổi của một em: ✓ = buổi được tính vào điểm tháng. @param {import('./thidua-core.js').Row} r */
function chips(r) {
  const w = el('div', 'td-chips');
  for (const b of r.cacBuoi) { const c = el('span', 'td-chip' + (b.tinh ? ' is-on' : ''), `${day(b.at)}: ${fmt(Math.round(1000 * b.c / b.n))}${b.tinh ? ' ✓' : ''}`); c.title = `${b.bo}: đúng ${b.c}/${b.n} câu${b.tinh ? ' (được tính)' : ' (không tính)'}`; w.append(c); }
  return w;
}
/** @param {import('./thidua-core.js').Session} s @param {string} key @param {HTMLButtonElement} b */
async function removeSession(s, key, b) {
  if (!cur) return;
  if (!(await confirmBox({ title: 'Bỏ buổi này khỏi thi đua?', body: `Buổi "${s.bo}" lúc ${when(s.at)} (${Object.keys(s.kq).length} em) sẽ không còn tính vào Bảng thi đua lớp ${cur.lop} ${monthLabel(cur.thang)}. Điểm tháng của cả lớp được tính lại. Không hoàn tác được.`, okText: 'Bỏ khỏi thi đua', danger: true }))) return;
  b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'Đang bỏ…';
  try {
    await store.patch('', { [`quiz_kq_lop/${cur.lk}/${cur.thang}/${s.room}`]: null, [`quiz_proof/${s.room}`]: `${key}|${Date.now().toString(36)}r` });
    await load(); status(`Đã bỏ buổi "${s.bo}" khỏi Bảng thi đua. Điểm tháng đã tính lại.`, 'success');
  } catch (e) { status('Chưa bỏ được buổi này: ' + (e instanceof Error ? e.message : ''), 'error'); b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = 'Bỏ khỏi thi đua'; }
}
const csvCell = (/** @type {unknown} */ v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function csv() {
  if (!cur) return;
  const sessions = sessionsOf(cur.data), R = rankMonth(sessions);
  const head = ['Hạng', 'Mã học sinh', 'Họ và tên', 'Điểm tháng (thang 10)', 'Số buổi tham gia', 'Số buổi được tính', 'Số câu đúng', 'Tổng số câu', ...sessions.map(s => `${day(s.at)} ${s.bo} (${s.so_cau} câu)`)];
  /** @param {import('./thidua-core.js').Row} r @param {string} hang */
  const line = (r, hang) => [hang, r.k.toUpperCase(), r.ten, r.du ? r.diem : '', r.buoi, r.tinh, r.dung, r.tong, ...sessions.map(s => { const e = s.kq[r.k]; if (!e) return 'vắng'; const b = r.cacBuoi.find(x => x.room === s.room); return `${e.c}/${s.so_cau}${b?.tinh ? ' (tính)' : ''}`; })];
  const rows = [[`Bảng thi đua Luyện tập – Lớp ${cur.lop} – ${monthLabel(cur.thang)}`], [`Xuất lúc ${when(Date.now())}${cur.chot ? ` · Đã chốt lúc ${when(Number(cur.chot.at))}` : ''}`],
    [`Cách tính: điểm buổi = số câu đúng ÷ số câu × 10; điểm tháng = trung bình ${R.N} buổi cao nhất (60% của ${R.K} buổi); cần ít nhất ${R.N} buổi để xếp hạng; bằng điểm xét số buổi tham gia rồi số câu đúng.`], [],
    head, ...R.rows.map(r => line(r, String(r.hang))), ...R.chua.map(r => line(r, 'Chưa đủ buổi'))];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `thi-dua-${cur.lop}-${cur.thang}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function chot() {
  if (!cur) return;
  const owner = ownerKey(); if (!owner) { status('Đăng nhập lại để chốt tháng.', 'error'); return; }
  const R = rankMonth(sessionsOf(cur.data));
  if (!(await confirmBox({ title: `Chốt Bảng thi đua ${monthLabel(cur.thang)}?`, body: `Lưu bản chốt xếp hạng lớp ${cur.lop} (${R.rows.length} em được xếp hạng, ${R.K} buổi) kèm thời điểm chốt để làm minh chứng. Sau đó tải Excel để vào sổ.`, okText: cur.chot ? 'Chốt lại' : 'Chốt tháng' }))) return;
  const b = btn('td-chot'); b.disabled = true; b.setAttribute('aria-busy', 'true');
  try {
    await store.put(`quiz_ls/${owner}/chot_${cur.lk}_${cur.thang}`, { at: store.SERVER_TIME, lop: cur.lop, thang: cur.thang, K: R.K, N: R.N, rows: snap(R) });
    const lop = cur.lop, th = cur.thang; await load(); status(`Đã chốt Bảng thi đua lớp ${lop} ${monthLabel(th)}. Bấm Tải Excel để vào sổ.`, 'success');
  } catch (e) { status('Chưa chốt được: ' + (e instanceof Error ? e.message : ''), 'error'); }
  finally { b.removeAttribute('aria-busy'); b.disabled = false; }
}
sel('td-lop').addEventListener('change', () => void load());
sel('td-thang').addEventListener('change', () => void load());
btn('td-reload').addEventListener('click', () => void load());
btn('td-csv').addEventListener('click', csv);
btn('td-chot').addEventListener('click', () => void chot());
document.addEventListener('tools-tab', ev => { if (/** @type {CustomEvent} */ (ev).detail === 'tab-tools-td') void open(); });
document.addEventListener('thidua-saved', () => { if (!$('tools-p-td').hidden) void load(); });
document.getElementById('teacher-logout')?.addEventListener('click', () => { cur = null; inited = false; sel('td-lop').replaceChildren(); sel('td-thang').replaceChildren(); });
