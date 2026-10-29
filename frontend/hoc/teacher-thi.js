// @ts-check
// Menu "Thi" của giáo viên — mọi dữ liệu nằm trong một Google Sheet (apps-script/sheet-exam/Code.gs), không qua Worker.
// Tạo bài thi (tiêu đề, thi thật/thử, khối, lớp) → học sinh đúng lớp vào phòng chờ (điểm danh) → Mở thi → theo dõi ai đã nộp.
// Xác thực: app tự gửi PIN giáo viên vừa đăng nhập; giáo viên không phải nhập thêm mật khẩu.
// Trạng thái trực tuyến (đang học / phòng chờ / đang thi / đã nộp) nhận TỨC THÌ từ Firebase (presence.js), không qua Worker.
import { SHEET_API } from './sheet-config.js';
import { parseExamRows, templateRows } from './exam-import.js';
import { confirmBox } from './dom.js';
import * as presence from './presence.js?v=20261030a';
import * as ui from './teacher-ui.js?v=20261030a';
import * as store from './thi-store.js';
import { api } from './api.js';
import { KT_LABELS, autoGrade } from './practical.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const input = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const select = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const button = (/** @type {string} */ id) => /** @type {HTMLButtonElement} */ ($(id));
const getPass = () => { try { return sessionStorage.getItem('thi-gv-mk') || ''; } catch { return ''; } };
/** Giáo viên lớp: kèm Mã giáo viên để Google Sheet chỉ cho thấy các lớp phụ trách. */
const getMa = () => { try { return sessionStorage.getItem('thi-gv-ma') || ''; } catch { return ''; } };
const STATE = { chua: 'Chưa vào', vao: 'Đã vào', nop: 'Đã nộp' };

/** @type {any} */ let info = null;   // danh sách bài thi (gv_list)
/** @type {any} */ let stats = null;  // thống kê một bài (gv_stats)
/** @type {string} */ let editing = '';   // mã bài đang sửa ('' = đang tạo mới)
/** @type {string} */ let current = '';   // mã bài đang xem thống kê
/** @type {{text:string,options:Record<string,string>,answer:string,points:number}[]} */ let trialQuestions = [];
let busyCount = 0;
/* ---------- Dữ liệu tức thì từ Firebase (học sinh vào/nộp ghi thẳng lên đó) ---------- */
/** @type {Record<string, any>|null} */ let fbHs = null;
/** @type {Record<string, any>} */ let fbVao = {};
/** @type {Record<string, any>} */ let fbNop = {};
/** Đề (kèm đáp án) để thầy cô kiểm lại điểm học sinh tự gửi lên. @type {Record<string, any>} */ let fbDe = {};
/** Tính lại điểm một bài nộp từ câu trả lời + đáp án trong đề. Điểm do máy học sinh tính rồi gửi lên,
 *  nên có thể bị sửa; khác nhau → trả {tinh, tong} để thầy cô xem lại. Khớp hoặc thiếu dữ liệu → null.
 * @param {any} rec @param {any} de @param {boolean} [that] thi thật chỉ có trắc nghiệm (app học sinh bỏ câu tự luận) */
export function checkScore(rec, de, that = false) {
  const qs = Array.isArray(de) ? de : Object.values(de || {});
  if (!rec || !qs.length) return null;
  const r2 = (/** @type {number} */ x) => Math.round(x * 100) / 100;
  const ans = rec.tra_loi || {}, tl = rec.tu_luan || {};
  let tinh = 0, tong = 0, tlBad = false;
  for (const q of qs) {
    if (!q || !q.id || (that && q.kind === 'tl')) continue;
    const pts = Number(q.points) || 1; tong += pts;
    if (q.kind === 'tl') { const v = tl[q.id]; if (v) { const d = Number(v.d) || 0; if (d < 0 || d > pts + 1e-9) tlBad = true; tinh += Math.max(0, Math.min(pts, d)); } }
    else if (ans[q.id] && String(ans[q.id]).toUpperCase() === String(q.answer || '').toUpperCase()) tinh += pts;
  }
  tinh = r2(tinh); tong = r2(tong);
  return (tlBad || Math.abs(tinh - Number(rec.diem)) > 0.01 || Math.abs(tong - Number(rec.tong)) > 0.01) ? { tinh, tong } : null;
}
/** @type {Record<string, any>} bài thực hành đã nộp */ let fbTh = {};
/** @type {Array<() => void>} */ let fbStops = [];
/** Dùng Firebase khi Google Sheet đã cài khóa Firebase và đã có danh sách học sinh trên Firebase. */
const useFb = () => !!info?.fb && fbHs !== null && Object.keys(fbHs).length > 0;
const fbRefresh = () => { if (!useFb() || busyCount) return; renderList(); if (caEx) { renderCa(); return; } if (onDetail() && current) { stats = fbStats(current); if (stats) renderStats(); } };
function startFb() {
  if (fbStops.length || !store.enabled()) return;
  fbStops = [store.listen('thi_hs', d => { fbHs = d || {}; fbRefresh(); }, undefined, { prio: 0 })];
  syncExamFb();
}
/** Theo từng bài (không tải cả cây thi_nop của mọi bài — có cả câu trả lời của từng em, rất nặng khi 1000 học sinh):
 *  bài đang mở hoặc đang xem thống kê → nghe tức thì; bài đã khóa → tải một lần. @type {Record<string, {live:boolean, stop:()=>void}>} */
let examFb = {};
function syncExamFb() {
  if (!fbStops.length) return;
  const want = new Map((info?.exams || []).map((/** @type {any} */ e) => [e.ma_de, e.trang_thai === 'mo' || e.ma_de === current]));
  for (const [id, w] of Object.entries(examFb)) if (!want.has(id) || w.live !== want.get(id)) { w.stop(); delete examFb[id]; }
  for (const [id, live] of want) {
    if (!(id in fbDe)) { fbDe[id] = null; void store.get(`thi_de/${id}`).then(d => { fbDe[id] = d || null; fbRefresh(); }).catch(() => { delete fbDe[id]; }); }
    if (examFb[id]) continue;
    /** @type {Array<[string, Record<string, any>]>} */ const parts = [['thi_nop', fbNop], ['thi_vao', fbVao], ['thi_th', fbTh]];
    if (live) { const stops = parts.map(([branch, into]) => store.listen(`${branch}/${id}`, d => { into[id] = d || {}; fbRefresh(); }, undefined, { prio: branch === 'thi_th' ? 1 : 2 })); examFb[id] = { live, stop: () => stops.forEach(f => f()) }; }
    else { let dead = false; examFb[id] = { live, stop: () => { dead = true; } }; for (const [branch, into] of parts) void store.get(`${branch}/${id}`).then(d => { if (!dead) { into[id] = d || {}; fbRefresh(); } }).catch(() => {}); }
  }
}
function stopFb() { fbStops.forEach(f => f()); fbStops = []; Object.values(examFb).forEach(w => w.stop()); examFb = {}; fbHs = null; fbVao = {}; fbNop = {}; fbTh = {}; fbDe = {}; }
/** @param {any} e @param {any} s */
const inScope = (e, s) => e.lop ? String(s.lop || '').trim().toLowerCase() === String(e.lop).trim().toLowerCase() : Number(s.khoi) === Number(e.khoi);
/** Thống kê một bài từ Firebase: ai chưa vào / đã vào / đã nộp + điểm. @param {string} id */
function fbStats(id) {
  const e = (info?.exams || []).find((/** @type {any} */ x) => x.ma_de === id); if (!e) return null;
  const vao = fbVao[id] || {}, nop = fbNop[id] || {};
  const students = Object.entries(fbHs || {}).filter(([, s]) => s && inScope(e, s)).map(([k, s]) => {
    const n = nop[k]; return { name: s.ten, lop: s.lop, ma: s.ma || k, state: n ? 'nop' : (vao[k] ? 'vao' : 'chua'), last: vao[k] ? new Date(Number(vao[k])).toISOString() : '', score: n ? n.diem : null, total: n ? n.tong : null, lan: n ? (Number(n.lan) || 1) : 0, roi: n ? Number(n.roi_tab) || 0 : 0, chk: n && fbDe[id] ? checkScore(n, fbDe[id], e.che_do === 'that') : null, th: (fbTh[id] || {})[k] || null };
  }).sort((a, b) => (a.lop + a.name).localeCompare(b.lop + b.name, 'vi'));
  return { ok: true, exam: e, students };
}
/** Số liệu trên thẻ bài: lấy từ Firebase nếu có. @param {any} e */
function counts(e) {
  if (!useFb()) return e;
  const st = fbStats(e.ma_de)?.students || [];
  return { ...e, total: st.length, vao: st.filter(s => s.state === 'vao').length, nop: st.filter(s => s.state === 'nop').length };
}
/** @type {Record<string, any>} */ let live = {};
let watching = false;
const timeAgo = (/** @type {number} */ at) => { const s = Math.max(0, Math.round((Date.now() - at) / 1000)); return s < 60 ? 'vừa xong' : s < 3600 ? Math.floor(s / 60) + ' phút trước' : new Date(at).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }); };
/** Trạng thái hiển thị: quá 2,5 phút không có nhịp thì coi như mất kết nối. @param {any} p */
const liveLabel = p => !p ? 'Chưa đăng nhập' : p.state === 'offline' ? 'Đã thoát' : (Date.now() - Number(p.at || 0) > presence.STALE_MS ? 'Mất kết nối' : presence.STATES[/** @type {keyof typeof presence.STATES} */ (p.state)] || p.state);
const liveKey = (/** @type {string} */ ma) => Object.keys(live).find(k => k.toLowerCase() === String(ma).toLowerCase()) || '';

/** @param {Record<string,unknown>} body */
async function call(body) {
  if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet bài thi.');
  let last = 'Chưa kết nối được Google Sheet. Thử lại.';
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ gv: getPass(), ...(getMa() ? { gv_ma: getMa() } : {}), ...body }) });
      const data = await res.json();
      if (data && data.ok) return data;
      throw Object.assign(new Error(data && data.error ? data.error : last), { final: true });
    } catch (err) {
      if (err && /** @type {any} */ (err).final) throw err;
      last = 'Mạng hoặc Google Sheet đang bận. Thử lại.';
      if (i < 2) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error(last);
}
/** Phiên cần đăng nhập lại (đăng nhập từ trước bản cập nhật, hoặc vé đã cũ). */
const RELOGIN = /đăng nhập lại|chưa khớp|TOKEN_EXPIRED|INVALID_CUSTOM_TOKEN|INVALID_ID_TOKEN/i;
/** @param {string} msg @param {'error'|'success'|''} kind */
function status(msg, kind = '') {
  const box = $('thi-gv-alert'); $('thi-gv-status').textContent = msg; box.hidden = !msg;
  box.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success');
  button('thi-relogin').hidden = !(kind === 'error' && RELOGIN.test(msg) && !/Đặt lại mật khẩu/.test(msg));
}
/** Đăng nhập lại: dùng đúng nút Đăng xuất của trang giáo viên (xóa phiên cũ, hiện ô PIN). */
const relogin = () => { const b = document.getElementById('teacher-logout'); if (b) b.click(); else location.reload(); };
const td = (/** @type {string} */ label, /** @type {string|Node} */ v, cls = '') => { const c = document.createElement('td'); c.dataset.label = label; if (cls) c.className = cls; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };

/** Danh sách lớp theo khối đang chọn (lấy từ trang HocSinh). */
function fillClasses() {
  if (getMa()) { const ks = [...new Set(Object.values(info?.classes || {}).map(Number))]; if (ks.length && !ks.includes(Number(select('thi-new-khoi').value))) select('thi-new-khoi').value = String(ks[0]); }
  const k = Number(select('thi-new-khoi').value), sel = select('thi-new-lop'), keep = sel.value;
  sel.replaceChildren(...(getMa() ? [] : [new Option('Cả khối ' + k, '')]));   // giáo viên lớp: chỉ chọn lớp mình
  const classes = Object.entries(info?.classes || {}).filter(([, g]) => g === k).map(([c]) => c).sort();
  for (const c of classes) sel.append(new Option('Chỉ lớp ' + c, c));
  if (classes.includes(keep)) sel.value = keep;
  bankHint();
}
function bankHint() {
  const that = select('thi-new-mode').value === 'that', k = select('thi-new-khoi').value;
  $('thi-new-file-row').hidden = that; $('thi-that-fields').hidden = !that;
  const tl = !that && select('thi-thu-nd').value === 'tn_tl';
  $('thi-thu-fields').hidden = that; $('thi-tl-count-f').hidden = !tl; $('thi-tl-fields').hidden = !tl;
  if (tl && !$('thi-tl-list').children.length) tlSync();
  mixSum();
  $('thi-th-fields').hidden = !(that && select('thi-new-nd').value === 'tn_th'); thTotal();
  const n = info?.bank?.[k] ?? null;
  $('thi-new-bank').textContent = that
    ? (n === null ? 'Câu hỏi lấy từ trang DeThi của Google Sheet theo khối đã chọn.' : `Trang DeThi trong Google Sheet có ${n} câu cho khối ${k}.` + (n ? '' : ' Thêm câu vào Sheet trước khi tạo bài.'))
    : (trialQuestions.length ? `Đã nhận ${trialQuestions.length} câu trắc nghiệm từ file Excel.` : 'Tải file Excel đề thi thử (dùng mẫu Excel của app) hoặc bấm "AI soạn đề theo ma trận".');
}

/** Năm học: năm trước, năm nay, năm sau (năm học mới bắt đầu tháng 8). */
function fillYears(/** @type {string} */ keep = '') {
  const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1, sel = select('thi-new-nam');
  const list = [y - 1, y, y + 1].map(a => `${a}-${a + 1}`); if (keep && !list.includes(keep)) list.unshift(keep);
  sel.replaceChildren(...list.map(v => new Option(v, v))); sel.value = keep || `${y}-${y + 1}`;
}

/* ---------- Phần tự luận của đề thi thử (Trắc nghiệm + Tự luận): đề + gợi ý đáp án + điểm; AI chấm theo gợi ý ---------- */
/** @param {{text?:string,guide?:string,points?:number,topic?:string,ai?:boolean}} [q] */
function tlRow(q = {}) {
  const fs = document.createElement('fieldset'); fs.className = 'thi-qe thi-tl';
  const lg = document.createElement('legend'); fs.append(lg);
  const uid = Math.random().toString(36).slice(2, 8);
  const field = (/** @type {string} */ label, /** @type {HTMLElement} */ ctl, /** @type {string} */ key) => { const w = document.createElement('div'); w.className = 't-field'; const l = document.createElement('label'); l.textContent = label; ctl.id = 'tl-' + uid + '-' + key; l.htmlFor = ctl.id; w.append(l, ctl); return w; };
  const text = document.createElement('textarea'); text.className = 'tl-text'; text.maxLength = 1000; text.value = q.text || ''; text.placeholder = 'Ví dụ: Nêu hai ví dụ về thiết bị số trong gia đình em và cho biết chúng xử lí thông tin gì.';
  const guide = document.createElement('textarea'); guide.className = 'tl-guide'; guide.maxLength = 2000; guide.rows = 4; guide.value = q.guide || ''; guide.placeholder = '- Ý 1 (0,5 điểm): …\n- Ý 2 (0,5 điểm): …';
  const pts = document.createElement('input'); pts.type = 'number'; pts.min = '0.25'; pts.max = '10'; pts.step = '0.25'; pts.className = 'tl-pts'; pts.value = String(q.points || 1); pts.addEventListener('input', mixSum);
  const topic = document.createElement('input'); topic.className = 'tl-topic'; topic.maxLength = 60; topic.value = q.topic || ''; topic.placeholder = 'Ví dụ: Thiết bị số';
  const del = ui.iconButton({ icon: 'trash', label: 'Xóa câu tự luận này', danger: true, onClick: () => { fs.remove(); tlNumber(); } });
  const foot = document.createElement('div'); foot.className = 'thi-qe-foot'; foot.append(field('Điểm', pts, 'pts'), field('Chủ đề', topic, 'topic'), del);
  fs.append(field('Đề tự luận (học sinh thấy)', text, 'text'), field('Gợi ý đáp án để AI chấm (học sinh không thấy)', guide, 'guide'), foot);
  if (q.ai) {
    fs.classList.add('is-ai'); const tag = document.createElement('span'); tag.className = 'thi-qe-ai-tag'; tag.textContent = 'AI soạn — cần duyệt'; lg.after(tag);
    const okLab = document.createElement('label'); okLab.className = 'thi-qe-ok'; const ok = document.createElement('input'); ok.type = 'checkbox'; ok.className = 'qe-ok';
    ok.addEventListener('change', () => fs.classList.toggle('is-approved', ok.checked)); okLab.append(ok, document.createTextNode(' Đã duyệt: tôi đã kiểm tra đề và gợi ý đáp án')); fs.append(okLab);
  }
  return fs;
}
const tlRows = () => [...$('thi-tl-list').querySelectorAll('.thi-tl')];
function tlNumber() { tlRows().forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Câu tự luận ${i + 1}`; }); input('thi-tl-count').value = String(tlRows().length || 1); mixSum(); }
/** Ô "Số câu tự luận": thêm dòng trống cho đủ; giảm thì chỉ bỏ các dòng trống ở cuối (không xóa câu đã nhập). */
function tlSync() {
  const want = Math.max(1, Math.min(10, Math.floor(Number(input('thi-tl-count').value) || 1))), box = $('thi-tl-list');
  while (tlRows().length < want) box.append(tlRow());
  for (let rows = tlRows(); rows.length > want; rows = tlRows()) { const last = rows[rows.length - 1]; if (/** @type {HTMLTextAreaElement} */ (last.querySelector('.tl-text')).value.trim() || /** @type {HTMLTextAreaElement} */ (last.querySelector('.tl-guide')).value.trim()) break; last.remove(); }
  tlNumber();
}
/** @param {any[]} list */
function tlRender(list) { $('thi-tl-list').replaceChildren(...list.map(q => tlRow(q))); tlNumber(); }
/** @returns {{error?:string, essays?:any[]}} */
function tlCollect() {
  const out = []; let i = 0;
  for (const f of tlRows()) {
    i++; f.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    const q = (/** @type {string} */ c) => /** @type {HTMLInputElement} */ (f.querySelector(c));
    const text = q('.tl-text').value.trim(), guide = q('.tl-guide').value.trim(), points = Number(q('.tl-pts').value) || 0;
    if (!text && !guide) continue;   // dòng trống: bỏ qua
    if (!text) { q('.tl-text').setAttribute('aria-invalid', 'true'); q('.tl-text').focus(); return { error: `Câu tự luận ${i}: nhập đề bài.` }; }
    if (!guide) { q('.tl-guide').setAttribute('aria-invalid', 'true'); q('.tl-guide').focus(); return { error: `Câu tự luận ${i}: nhập gợi ý đáp án để AI chấm.` }; }
    if (points <= 0 || points > 10) { q('.tl-pts').setAttribute('aria-invalid', 'true'); q('.tl-pts').focus(); return { error: `Câu tự luận ${i}: điểm từ 0,25 đến 10.` }; }
    const okBox = /** @type {HTMLInputElement|null} */ (f.querySelector('.qe-ok'));
    if (okBox && !okBox.checked) { okBox.setAttribute('aria-invalid', 'true'); okBox.focus(); return { error: `Câu tự luận ${i} do AI soạn: đọc kỹ rồi đánh dấu "Đã duyệt" trước khi lưu.` }; }
    out.push({ kind: 'tl', text, guide, points, topic: q('.tl-topic').value.trim() });
  }
  return { essays: out };
}
/** Dòng tổng: số câu, điểm trắc nghiệm / tự luận. */
function mixSum() {
  const box = document.getElementById('thi-mix-sum'); if (!box) return;
  const tl = select('thi-new-mode').value === 'thu' && select('thi-thu-nd').value === 'tn_tl';
  box.hidden = !tl; if (!tl) return;
  const r2 = (/** @type {number} */ x) => Math.round(x * 100) / 100;
  const mc = qeLoaded ? [...$('thi-qe-list').querySelectorAll('.thi-qe')].map(f => Number(/** @type {HTMLInputElement} */ (f.querySelector('.qe-pts')).value) || 0) : trialQuestions.map(q => Number(q.points) || 1);
  const es = tlRows().filter(f => /** @type {HTMLTextAreaElement} */ (f.querySelector('.tl-text')).value.trim()).map(f => Number(/** @type {HTMLInputElement} */ (f.querySelector('.tl-pts')).value) || 0);
  const a = r2(mc.reduce((x, y) => x + y, 0)), b = r2(es.reduce((x, y) => x + y, 0));
  box.textContent = `Trắc nghiệm: ${mc.length} câu (${a} điểm) · Tự luận: ${es.length} câu (${b} điểm) · Tổng: ${r2(a + b)} điểm`;
}

/* ---------- Sửa câu hỏi / đáp án (khi Chỉnh sửa bài thi) ---------- */
/** @type {boolean} */ let qeLoaded = false;
/** @param {{text?:string,options?:Record<string,string>,answer?:string,points?:number,topic?:string,level?:string,ai?:boolean,explain?:string}} [q] */
function qeRow(q = {}) {
  const fs = document.createElement('fieldset'); fs.className = 'thi-qe';
  const lg = document.createElement('legend'); fs.append(lg);
  const uid = Math.random().toString(36).slice(2, 8);
  const field = (/** @type {string} */ label, /** @type {HTMLElement} */ ctl) => { const w = document.createElement('div'); w.className = 't-field'; const l = document.createElement('label'); l.textContent = label; ctl.id = 'qe-' + uid + '-' + label.replace(/\W/g, ''); l.htmlFor = ctl.id; w.append(l, ctl); return w; };
  const text = document.createElement('textarea'); text.className = 'qe-text'; text.value = q.text || ''; text.maxLength = 1000;
  fs.append(field('Đề bài', text));
  const opts = document.createElement('div'); opts.className = 'thi-qe-opts';
  for (const L of ['A', 'B', 'C', 'D']) { const i = document.createElement('input'); i.className = 'qe-opt'; i.dataset.k = L; i.value = q.options?.[L] || ''; i.maxLength = 300; opts.append(field('Phương án ' + L, i)); }
  fs.append(opts);
  const foot = document.createElement('div'); foot.className = 'thi-qe-foot';
  const ans = document.createElement('select'); ans.className = 'qe-ans'; for (const L of ['A', 'B', 'C', 'D']) ans.append(new Option(L, L)); ans.value = String(q.answer || 'A').toUpperCase();
  const pts = document.createElement('input'); pts.type = 'number'; pts.min = '0.25'; pts.step = '0.25'; pts.className = 'qe-pts'; pts.value = String(q.points || 1);
  const del = ui.iconButton({ icon: 'trash', label: 'Xóa câu này', danger: true, onClick: () => { fs.remove(); qeNumber(); } });
  const topic = document.createElement('input'); topic.className = 'qe-topic'; topic.maxLength = 60; topic.value = q.topic || ''; topic.placeholder = 'Ví dụ: Mã nhị phân';
  const lvl = document.createElement('select'); lvl.className = 'qe-level'; for (const v of ['', 'Biết', 'Hiểu', 'Vận dụng']) lvl.append(new Option(v || '—', v)); lvl.value = q.level || '';
  foot.append(field('Đáp án đúng', ans), field('Điểm', pts), field('Chủ đề', topic), field('Mức độ', lvl), del); fs.append(foot);
  if (q.ai) {   // câu AI soạn: giáo viên phải đọc và đánh dấu Đã duyệt mới lưu được
    fs.classList.add('is-ai'); fs.dataset.ai = '1';
    const tag = document.createElement('span'); tag.className = 'thi-qe-ai-tag'; tag.textContent = 'AI soạn — cần duyệt'; lg.after(tag);
    if (q.explain) { const ex = document.createElement('p'); ex.className = 't-hint thi-qe-explain'; ex.textContent = 'Giải thích của AI: ' + q.explain; fs.append(ex); }
    const okLab = document.createElement('label'); okLab.className = 'thi-qe-ok'; const ok = document.createElement('input'); ok.type = 'checkbox'; ok.className = 'qe-ok';
    ok.addEventListener('change', () => fs.classList.toggle('is-approved', ok.checked)); okLab.append(ok, document.createTextNode(' Đã duyệt: tôi đã kiểm tra đề bài, phương án và đáp án đúng')); fs.append(okLab);
  }
  return fs;
}
function qeNumber() { $('thi-qe-list').querySelectorAll('.thi-qe').forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Câu ${i + 1}`; }); mixSum(); }
/** @param {any[]} qs */
function qeRender(qs) { const box = $('thi-qe-list'); box.replaceChildren(...qs.map(q => qeRow(q))); qeNumber(); $('thi-q-editor').hidden = false; qeLoaded = true; mixSum(); }
/** Đọc câu hỏi từ trình sửa; lỗi → trả {error}. */
function qeCollect(allowEmpty = false) {
  const out = []; let i = 0;
  for (const f of $('thi-qe-list').querySelectorAll('.thi-qe')) {
    i++;
    const text = /** @type {HTMLTextAreaElement} */ (f.querySelector('.qe-text')).value.trim();
    /** @type {Record<string,string>} */ const options = {};
    f.querySelectorAll('.qe-opt').forEach(n => { const v = /** @type {HTMLInputElement} */ (n).value.trim(); if (v) options[/** @type {HTMLElement} */ (n).dataset.k || ''] = v; });
    const answer = /** @type {HTMLSelectElement} */ (f.querySelector('.qe-ans')).value, points = Number(/** @type {HTMLInputElement} */ (f.querySelector('.qe-pts')).value) || 1;
    const bad = (/** @type {string} */ m) => { const t = /** @type {HTMLElement} */ (f.querySelector(m === 'text' ? '.qe-text' : m === 'opt' ? '.qe-opt' : '.qe-ans')); t.setAttribute('aria-invalid', 'true'); t.focus(); };
    f.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    if (!text) { bad('text'); return { error: `Câu ${i}: nhập đề bài.` }; }
    if (Object.keys(options).length < 2) { bad('opt'); return { error: `Câu ${i}: cần ít nhất 2 phương án.` }; }
    if (!options[answer]) { bad('ans'); return { error: `Câu ${i}: đáp án đúng ${answer} chưa có nội dung.` }; }
    const okBox = /** @type {HTMLInputElement|null} */ (f.querySelector('.qe-ok'));
    if (okBox && !okBox.checked) { okBox.setAttribute('aria-invalid', 'true'); okBox.focus(); return { error: `Câu ${i} do AI soạn: đọc kỹ rồi đánh dấu "Đã duyệt" trước khi lưu.` }; }
    const topic = /** @type {HTMLInputElement} */ (f.querySelector('.qe-topic')).value.trim(), level = /** @type {HTMLSelectElement} */ (f.querySelector('.qe-level')).value;
    out.push({ text, options, answer, points, topic, level });
  }
  if (!out.length && !allowEmpty) return { error: 'Bài thi cần ít nhất một câu hỏi.' };
  return { questions: out };
}
async function qeLoad(/** @type {any} */ e) {
  qeLoaded = false; $('thi-q-editor').hidden = false; $('thi-qe-list').replaceChildren(Object.assign(document.createElement('p'), { className: 't-muted ld-box', textContent: 'Đang tải câu hỏi…' }));
  $('thi-qe-note').textContent = e.che_do === 'that' ? `Câu hỏi thi thật dùng chung trang DeThi của khối ${e.khoi}: lưu ở đây sẽ thay các câu khối ${e.khoi} trong Google Sheet.` : 'Sửa đề bài, phương án, đáp án đúng, điểm rồi bấm Lưu thay đổi.';
  try {
    const r = await call({ action: 'gv_questions', ma_de: e.ma_de }); if (editing !== e.ma_de) return;
    const all = r.questions || [], es = all.filter((/** @type {any} */ q) => q.kind === 'tl');
    qeRender(all.filter((/** @type {any} */ q) => q.kind !== 'tl'));
    if (es.length) { select('thi-thu-nd').value = 'tn_tl'; tlRender(es); bankHint(); }
  }
  catch (err) { $('thi-qe-list').replaceChildren(Object.assign(document.createElement('p'), { className: 't-muted', textContent: err instanceof Error ? err.message : 'Chưa tải được câu hỏi.' })); }
}

const KIND = { that: 'Thi thật', thu: 'Thi thử' };
const sel = (/** @type {any} */ e) => e.lop ? 'lớp ' + e.lop : 'khối ' + e.khoi;
function metric(/** @type {HTMLElement} */ m, /** @type {[string, number][]} */ items) {
  m.replaceChildren();
  for (const [k, v] of items) { const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = k; b.textContent = String(v); w.append(a, b); m.append(w); }
}
/** Danh sách bài thi: mỗi bài một thẻ với các nút biểu tượng. */
function renderList() {
  const box = $('thi-list'); box.replaceChildren();
  const exams = info?.exams || [];
  if (!info) { if (busyCount) { const p = document.createElement('p'); p.className = 't-muted ld-box'; p.textContent = 'Đang tải danh sách bài thi từ Google Sheet…'; box.append(p); } return; }   // lỗi → khối tải biến mất, thông báo lỗi ở trên
  if (!exams.length) { const p = document.createElement('p'); p.className = 't-muted'; p.textContent = 'Chưa có bài thi nào. Mở tab "Tạo đề thi" để tạo bài đầu tiên.'; box.append(p); return; }
  for (const e0 of exams) {
    const e = counts(e0), open = e.trang_thai === 'mo';
    const card = document.createElement('article'); card.className = 't-card t-list-item'; card.dataset.maDe = e.ma_de;
    const left = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = e.tieu_de;
    const tags = document.createElement('p');
    for (const [t, bad] of (e.che_do === 'that' ? [[KIND.that, false], [sel(e), false], [e.noi_dung === 'tn_th' ? 'Trắc nghiệm + Thực hành' : e.noi_dung === 'tn_tl' ? 'Trắc nghiệm + Tự luận' : 'Trắc nghiệm', false]] : [[KIND[/** @type {'that'|'thu'} */ (e.che_do)], false], [sel(e), false], [open ? 'Đang MỞ' : 'Đang KHÓA', !open], [e.xem_diem ? 'Cho xem điểm' : 'Ẩn điểm', false]])) { const b = document.createElement('span'); b.className = 't-badge' + (bad ? ' t-badge-error' : ''); b.textContent = String(t); tags.append(b, ' '); }
    const meta = document.createElement('p'); meta.className = 't-muted'; meta.textContent = `${e.questions} câu · ${e.total} học sinh · đã vào ${e.vao + e.nop} · đã nộp ${e.nop}`;
    left.append(h, tags, meta);
    const acts = document.createElement('div'); acts.className = 't-icon-actions';
    const bStats = ui.iconButton({ icon: 'stats', label: (e.che_do === 'that' ? 'Theo dõi ca thi: ' : 'Thống kê: ') + e.tieu_de, onClick: () => void openStats(e.ma_de) });
    const bEdit = ui.iconButton({ icon: 'edit', label: `Chỉnh sửa: ${e.tieu_de}`, onClick: () => startEdit(e) });
    const bLock = ui.iconButton({ icon: open ? 'lock' : 'unlock', label: (open ? 'Khóa thi: ' : 'Mở thi: ') + e.tieu_de, onClick: () => void run(bLock, () => call({ action: 'gv_set', ma_de: e.ma_de, trang_thai: open ? 'khoa' : 'mo' }), open ? 'Đã KHÓA thi.' : 'Đã MỞ thi.') });
    const xem = !!e.xem_diem;
    const bXem = ui.iconButton({ icon: xem ? 'view' : 'viewoff', label: (xem ? 'Ẩn điểm với học sinh: ' : 'Cho học sinh xem điểm, xếp hạng: ') + e.tieu_de, onClick: () => void run(bXem, () => call({ action: 'gv_set', ma_de: e.ma_de, xem_diem: xem ? 'khong' : 'co' }), xem ? 'Đã ẩn điểm: học sinh chỉ thấy "Đã nộp bài".' : 'Đã cho xem điểm: học sinh thấy điểm, số lần thi và xếp hạng trong lớp.') });
    bXem.setAttribute('aria-pressed', String(xem));
    const bDel = ui.iconButton({ icon: 'trash', label: `Xóa: ${e.tieu_de}`, danger: true, onClick: () => void deleteExam(e, bDel) });
    if (e.che_do === 'that') acts.append(bStats, bEdit, bDel); else acts.append(bStats, bEdit, bLock, bXem, bDel);   // thi thật: mở/đóng theo từng lớp trong "Theo dõi ca thi"; học sinh không xem điểm
    card.append(left, acts); box.append(card);
  }
}
/** Thống kê một bài: học sinh thuộc đối tượng, ai đã vào/nộp, điểm. */
function renderStats() {
  const ex = stats?.exam; if (!ex) return;
  if (ex.che_do === 'that' && caEx) { renderCa(); return; }
  const open = ex.trang_thai === 'mo';
  $('thi-gv-title').textContent = ex.tieu_de;
  $('thi-gv-sub').textContent = `${KIND[/** @type {'that'|'thu'} */ (ex.che_do)]} · ${sel(ex)} · ${ex.questions} câu · đang ${open ? 'MỞ' : 'KHÓA'}`;
  button('thi-gv-toggle').textContent = open ? 'Khóa thi' : 'Mở thi'; button('thi-gv-toggle').dataset.to = open ? 'khoa' : 'mo';
  $('thi-st-tabs').hidden = ex.che_do !== 'that'; if (ex.che_do !== 'that') stTab('kq');
  renderTrack();
  const head = document.querySelector('#thi-gv-table thead th:last-child'); if (head) { head.textContent = ex.che_do === 'thu' ? 'Số lần thi' : 'Thao tác'; head.className = ex.che_do === 'thu' ? 't-number' : ''; }
  const sts = stats.students || [];
  const cnt = (/** @type {string} */ st) => sts.filter((/** @type {any} */ s) => s.state === st).length;
  metric($('thi-gv-metrics'), [['Học sinh của bài', sts.length], ['Đã vào phòng thi', cnt('vao') + cnt('nop')], ['Đã nộp', cnt('nop')], ['Chưa vào', cnt('chua')]]);
  const only = input('thi-gv-only').checked, rows = only ? sts.filter((/** @type {any} */ s) => s.state === 'chua') : sts;
  const body = $('thi-gv-body'); body.replaceChildren();
  if (!rows.length) { const tr = document.createElement('tr'); const c = td('', only ? 'Các em đã vào đủ.' : 'Không có học sinh nào thuộc lớp/khối này trong trang HocSinh.', 't-muted'); c.colSpan = 6; tr.append(c); body.append(tr); }
  for (const s of rows) {
    const tr = document.createElement('tr');
    const badge = document.createElement('span'); badge.className = 't-badge' + (s.state === 'chua' ? ' t-badge-error' : ''); badge.textContent = STATE[/** @type {keyof typeof STATE} */ (s.state)] || s.state;
    /** @type {string|Node} */ let last;
    if (ex.che_do === 'thu') last = s.lan ? `${s.lan} lần` : '—';   // thi thử: thi thoải mái, chỉ cần biết số lần
    else {
      const act = document.createElement('button'); act.type = 'button'; act.className = 't-button'; act.textContent = 'Cho thi lại';
      act.hidden = s.state !== 'nop';
      act.addEventListener('click', async () => {
        if (!(await confirmBox({ title: 'Cho thi lại?', body: `Bài nộp của ${s.name} trong "${ex.tieu_de}" sẽ bị hủy (điểm cũ vẫn lưu trong trang KetQua với dấu Hủy). Em được làm lại từ đầu.`, okText: 'Cho thi lại' }))) return;
        void run(act, () => call({ action: 'gv_reset', ma_de: ex.ma_de, ma: s.ma }), `Đã cho ${s.name} thi lại.`);
      });
      last = s.state === 'nop' ? act : '—';
    }
    tr.append(td('Học sinh', `${s.name} (${s.ma})`), td('Lớp', s.lop), td('Bài thi', badge), td('Trực tuyến', liveLabel(live[liveKey(s.ma)])), td('Điểm', s.score === null || s.score === undefined ? '—' : `${s.score}/${s.total}` + (s.chk ? ` ⚠ tính lại ${s.chk.tinh}/${s.chk.tong}` : ''), 't-number' + (s.chk ? ' thi-score-bad' : '')), td(ex.che_do === 'thu' ? 'Số lần thi' : 'Thao tác', last, ex.che_do === 'thu' ? 't-number' : ''));
    body.append(tr);
  }
}
/** Tab "Theo dõi nộp bài" (thi thật): ba cột Chưa vào / Đang làm / Đã nộp, cập nhật tức thì. */
function renderTrack() {
  const ex = stats?.exam, box = $('thi-track'); if (!ex || !box) return;
  const sts = stats.students || [], th = ex.noi_dung === 'tn_th';
  const time = (/** @type {string} */ iso) => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  /** @param {string} title @param {any[]} list @param {string} cls @param {(s:any)=>string} note */
  const col = (title, list, cls, note) => {
    const sec = document.createElement('section'); sec.className = cls;
    const h = document.createElement('h3'); h.append(title); const n = document.createElement('span'); n.textContent = String(list.length); h.append(n); sec.append(h);
    const ul = document.createElement('ul');
    if (!list.length) { const li = document.createElement('li'); li.className = 't-muted'; li.textContent = 'Không có'; ul.append(li); }
    for (const s of list) {
      const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = `${s.name} · ${s.lop}`; const b = document.createElement('small'); b.textContent = note(s); li.append(a, b);
      if (th && s.th) { const g = document.createElement('button'); g.type = 'button'; g.className = 't-button th-grade-btn'; g.textContent = s.th.diem_th !== undefined ? `Thực hành ${s.th.diem_th}/${s.th.tong_th ?? '?'} · Chấm lại` : 'Chấm thực hành'; g.addEventListener('click', () => void openTh(ex, s)); li.append(g); }
      ul.append(li);
    }
    sec.append(ul); return sec;
  };
  box.replaceChildren(
    col('Chưa vào', sts.filter((/** @type {any} */ s) => s.state === 'chua'), 'is-wait', () => ''),
    col('Đang làm', sts.filter((/** @type {any} */ s) => s.state === 'vao'), 'is-doing', s => s.last ? 'vào ' + time(s.last) : ''),
    col('Đã nộp', sts.filter((/** @type {any} */ s) => s.state === 'nop'), 'is-done', s => (s.score !== null ? `${s.score}/${s.total}` + (s.chk ? ` ⚠ tính lại ${s.chk.tinh}/${s.chk.tong}` : '') : '') + (s.roi ? ` · rời màn hình ${s.roi} lần` : '') + (th ? (s.th ? ' · đã nộp thực hành' : ' · chưa nộp thực hành') : '')));
}
/** @param {'kq'|'td'} t */
function stTab(t) { for (const k of ['kq', 'td']) { const b = button('tab-thi-' + k), on = k === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('tabpanel-thi-' + k).hidden = !on; } }
function render() { renderList(); if (stats) renderStats(); fillClasses(); }
const onDetail = () => { const d = document.getElementById('detail-sheetexam'); return !!d && !d.hidden; };

/** Mở trang thống kê NGAY (dùng số liệu sẵn có của thẻ), rồi tải chi tiết từng em từ Google Sheet ở nền. */
async function openStats(/** @type {string} */ maDe) {
  current = maDe; stats = null; stTab('kq'); syncExamFb();
  const e = (info?.exams || []).find((/** @type {any} */ x) => x.ma_de === maDe);
  if (e) {
    $('thi-gv-title').textContent = e.tieu_de;
    $('thi-gv-sub').textContent = `${KIND[/** @type {'that'|'thu'} */ (e.che_do)]} · ${sel(e)} · ${e.questions} câu · đang ${e.trang_thai === 'mo' ? 'MỞ' : 'KHÓA'}`;
    metric($('thi-gv-metrics'), [['Học sinh của bài', e.total], ['Đã vào phòng thi', e.vao + e.nop], ['Đã nộp', e.nop], ['Chưa vào', e.total - e.vao - e.nop]]);
    button('thi-gv-toggle').textContent = e.trang_thai === 'mo' ? 'Khóa thi' : 'Mở thi'; button('thi-gv-toggle').dataset.to = e.trang_thai === 'mo' ? 'khoa' : 'mo';
  }
  const body = $('thi-gv-body'); body.replaceChildren(); const tr = document.createElement('tr'); const c = td('', 'Đang tải danh sách học sinh từ Google Sheet…', 't-muted'); c.colSpan = 6; tr.append(c); body.append(tr);
  showCa(e?.che_do === 'that');
  await ui.showSub('detail-sheetexam');
  if (e?.che_do === 'that') { openCa(e); return; }
  if (useFb()) { stats = fbStats(maDe); if (stats) renderStats(); return; }   // tức thì, không chờ Google Sheet
  await run(button('thi-gv-refresh'), () => call({ action: 'gv_stats', ma_de: maDe }), '');
}
async function deleteExam(/** @type {any} */ e, /** @type {HTMLButtonElement} */ btn) {
  const ok = await confirmBox({ title: 'Xóa bài thi?', body: `Bài "${e.tieu_de}" sẽ ẩn khỏi danh sách và học sinh không còn thấy. Điểm đã nộp vẫn giữ trong trang KetQua của Google Sheet.`, okText: 'Xóa bài thi', danger: true });
  if (ok) await run(btn, () => call({ action: 'gv_delete', ma_de: e.ma_de }), 'Đã xóa bài thi.');
}
/** Chuyển giữa hai tab: Danh sách / Tạo đề thi. @param {'list'|'new'} t */
function tab(t) {
  for (const k of ['list', 'new']) { const b = button('tab-thi-' + k), on = k === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('tabpanel-thi-' + k).hidden = !on; }
}
/** Mở form ở chế độ sửa: đổi tiêu đề, khối, lớp; thi thử có thể tải lại Excel để thay đề. @param {any} e */
function startEdit(e) {
  editing = e.ma_de; trialQuestions = [];
  input('thi-new-title').value = e.tieu_de; select('thi-new-mode').value = e.che_do; select('thi-new-mode').disabled = true;
  select('thi-new-khoi').value = String(e.khoi); fillClasses(); select('thi-new-lop').value = e.lop || '';
  $('thi-form-title').textContent = 'Chỉnh sửa bài thi';
  $('thi-form-sub').textContent = 'Sửa thông tin và câu hỏi, đáp án bên dưới rồi bấm Lưu thay đổi.' + (e.che_do === 'thu' ? ' Hoặc tải file Excel mới để thay cả đề.' : '');
  fillYears(e.nam_hoc || ''); if (e.hinh_thuc) select('thi-new-ht').value = e.hinh_thuc; select('thi-new-nd').value = e.noi_dung === 'tn_th' ? 'tn_th' : 'tn';
  thLoad(e.thuc_hanh); select('thi-thu-nd').value = e.noi_dung === 'tn_tl' ? 'tn_tl' : 'tn'; $('thi-tl-list').replaceChildren();
  button('thi-new-create').textContent = 'Lưu thay đổi'; $('thi-new-cancel').hidden = false; bankHint(); tab('new'); input('thi-new-title').focus();
  void qeLoad(e);
}
function endEdit() {
  editing = ''; trialQuestions = []; input('thi-new-title').value = ''; input('thi-new-file').value = ''; select('thi-new-mode').disabled = false;
  $('thi-form-title').textContent = 'Tạo đề thi'; $('thi-form-sub').textContent = 'Bài mới luôn ở trạng thái khóa cho đến khi bấm Mở thi. Có thể tạo nhiều bài cho nhiều lớp cùng lúc.';
  button('thi-new-create').textContent = 'Tạo bài thi'; $('thi-new-cancel').hidden = true; bankHint();
  $('thi-q-editor').hidden = true; $('thi-qe-list').replaceChildren(); qeLoaded = false; fillYears(); select('thi-new-nd').value = 'tn'; thLoad(null); select('thi-thu-nd').value = 'tn'; $('thi-tl-list').replaceChildren(); input('thi-tl-count').value = '2'; bankHint();
}

/** @param {HTMLButtonElement|null} btn @param {() => Promise<any>} fn @param {string} okMsg */
async function run(btn, fn, okMsg) {
  if (!getPass()) { status('Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.', 'error'); return; }
  busyCount++; document.body.classList.add('t-busy'); if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try {
    const r = await fn();
    if (r.students) stats = r; else { info = r; if (stats && !r.exams.some((/** @type {any} */ x) => x.ma_de === stats.exam.ma_de)) stats = null; syncExamFb(); }
    if (useFb() && current && onDetail()) stats = fbStats(current);
    render();
    if (r.fb_error) status('Đã lưu vào Google Sheet nhưng chưa đẩy được lên Firebase: ' + r.fb_error, 'error');
    else if (info && info.fb === false && !okMsg) status('Chưa nối Firebase nên học sinh chưa thấy bài. Mở Google Sheet → menu Bài thi → Cài khóa Firebase.', 'error');
    else status(okMsg, okMsg ? 'success' : '');
  }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa kết nối được Google Sheet.', 'error'); }
  finally { busyCount--; if (!busyCount) document.body.classList.remove('t-busy'); if (btn) { btn.removeAttribute('aria-busy'); btn.disabled = false; render(); } }
}
const load = () => run(null, () => call({ action: 'gv_list' }), '');
/** Làm mới màn hình đang xem (danh sách hoặc thống kê). */
const reload = () => (onDetail() && current) ? run(null, () => call({ action: 'gv_stats', ma_de: current }), '') : load();

/* ---------- Trực tuyến (Firebase, tức thì) ---------- */
/** Bảng trực tuyến riêng đã bỏ: trạng thái trực tuyến hiện ở cột "Trực tuyến" của trang Thống kê. */
function renderLive() { if (caEx) renderCa(); else if (stats) renderStats(); }
/** Dòng báo trạng thái Firebase: chỉ hiện khi có vấn đề. @param {string} msg @param {boolean} show @param {boolean} [relog] */
function liveMsg(msg, show, relog = false) { $('thi-live-status').textContent = msg; $('thi-live-line').hidden = !show; button('thi-live-relogin').hidden = !relog; }
async function startLive() {
  if (watching) return;
  await ensureTeacherTicket().catch(() => false);   // có vé thì dùng, không có vẫn nghe được (luật cho đọc presence công khai)
  liveMsg('', false);
  watching = true;
  /** @type {Record<string,string>} */ let prev = {};
  void presence.watch(map => {
    live = map; renderLive();
    // Có em vừa nộp → lấy điểm từ Google Sheet ngay, không chờ chu kỳ.
    const justSubmitted = Object.entries(map).some(([k, p]) => p.state === 'da_nop' && prev[k] !== 'da_nop');
    prev = Object.fromEntries(Object.entries(map).map(([k, p]) => [k, p.state]));
    if (justSubmitted && info && !busyCount) void reload();
  }, (st, why) => {
    liveMsg(st === 'live' ? 'Trạng thái trực tuyến đang cập nhật tức thì từ Firebase.' : (why || 'Mất kết nối Firebase.'), st !== 'live');
    if (st === 'off' && /Chưa có vé/.test(why || '')) watching = false;
  });
}
/** Vé Firebase của giáo viên: lấy từ lần đăng nhập; nếu chưa có thì đổi token Worker (còn hạn 1 giờ) đang giữ trong phiên. */
async function ensureTeacherTicket() {
  try { if (localStorage.getItem('aisgk-presence-gv')) return true; } catch { /* bỏ qua */ }
  if (pendingTicket) return pendingTicket;
  let t = ''; let had = false;
  try { const v = sessionStorage.getItem('aisgk-presence-gv-ticket'); had = v !== null; t = v || ''; } catch { /* bỏ qua */ }
  if (had && !t) { noKey = true; return false; }   // Worker đăng nhập được nhưng chưa cài khóa PRESENCE_*
  return t ? presence.startTeacher(t) : false;
}
/** @type {Promise<boolean>|null} */ let pendingTicket = null;
let noKey = false;
window.addEventListener('thi-gv-login', ev => { const t = /** @type {CustomEvent} */ (ev).detail?.token; noKey = !t; if (t) { watching = false; pendingTicket = presence.startTeacher(t).finally(() => { pendingTicket = null; }); } });
$('thi-relogin').addEventListener('click', relogin);
document.getElementById('teacher-logout')?.addEventListener('click', () => { presence.stopWatch(); stopFb(); closeCa(); watching = false; info = null; live = {}; status(''); });
$('thi-live-relogin').addEventListener('click', relogin);
setInterval(() => { if (watching) renderLive(); }, 30000);   // cập nhật "x phút trước" và "Mất kết nối"

/* ---------- Đề thi thử từ Excel (cùng mẫu với phần Về nhà) ---------- */
/** @type {Map<string, Promise<void>>} */ const scripts = new Map();
function loadScript(/** @type {string} */ src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => { const t = document.createElement('script'); t.src = src; t.onload = () => resolve(); t.onerror = () => { scripts.delete(src); reject(new Error('Không tải được bộ đọc Excel. Kiểm tra mạng rồi thử lại.')); }; document.head.append(t); }));
  return /** @type {Promise<void>} */ (scripts.get(src));
}
$('thi-new-template').addEventListener('click', async () => {
  try {
    await loadScript('./vendor/write-excel-file.min.js');
    const cell = (/** @type {unknown} */ v, bold = false) => typeof v === 'number' ? { value: v, type: Number } : { value: String(v ?? ''), ...(bold ? { fontWeight: 'bold' } : {}) };
    const t = templateRows();
    // @ts-ignore thư viện nạp bằng thẻ script
    await globalThis.writeXlsxFile([{ data: t.questions.map((r, i) => r.map(v => cell(v, i === 0))), sheet: 'Câu hỏi', stickyRowsCount: 1 }, { data: t.guide.map(r => r.map(v => cell(v))), sheet: 'Hướng dẫn' }]).toFile('mau-de-thi-thu.xlsx');
  } catch (e) { status(e instanceof Error ? e.message : 'Chưa tải được mẫu.', 'error'); }
});
input('thi-new-file').addEventListener('change', async () => {
  const f = input('thi-new-file').files?.[0]; trialQuestions = []; bankHint();
  if (!f) return;
  if (!/\.xlsx$/i.test(f.name) || f.size > 2 * 1024 * 1024) { status('Chỉ nhận file .xlsx dưới 2 MB, theo mẫu Excel của app.', 'error'); return; }
  try {
    await loadScript('./vendor/read-excel-file.min.js');
    // @ts-ignore thư viện nạp bằng thẻ script
    const r = await globalThis.readXlsxFile(f);
    const rows = Array.isArray(r) && r.length && r[0] && !Array.isArray(r[0]) && r[0].data ? r[0].data : r;
    const parsed = parseExamRows(rows);
    if (!parsed.valid) { status(parsed.fatal || 'File có dòng chưa đúng mẫu. Sửa rồi tải lại.', 'error'); return; }
    trialQuestions = parsed.questions.filter(q => q.kind === 'choice').map(q => ({ text: q.prompt, options: q.options, answer: q.correct_answer, points: q.points, topic: q.topic }));
    const essays = parsed.questions.filter(q => q.kind === 'text').map(q => ({ text: q.prompt, guide: q.hint, points: q.points, topic: q.topic }));
    if (trialQuestions.length) { qeRender(trialQuestions); qeNote(); }   // đề trong file Excel hiện ra để thầy cô xem lại, sửa trước khi lưu
    if (essays.length) { select('thi-thu-nd').value = 'tn_tl'; tlRender(essays); }   // câu TL: cột Gợi ý = gợi ý đáp án để AI chấm
    const noGuide = essays.filter(q => !q.guide).length;
    status(`Đã nhận ${trialQuestions.length} câu trắc nghiệm` + (essays.length ? ` và ${essays.length} câu tự luận` + (noGuide ? ` (${noGuide} câu chưa có gợi ý đáp án — nhập ở Phần tự luận)` : '') : '') + '.', trialQuestions.length || essays.length ? 'success' : 'error');
  } catch (e) { status(e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file Excel.', 'error'); }
  bankHint();
});

/* ---------- Tiêu chí chấm thực hành (khi tạo/sửa bài thi thật Trắc nghiệm + Thực hành) ---------- */
/** @param {{mo_ta?:string,diem?:number,kt?:{type:string,a:string,b:string}|null}} [t] */
function thRow(t = {}) {
  const row = document.createElement('fieldset'); row.className = 'thi-th-row';
  const lg = document.createElement('legend'); row.append(lg);
  const uid = Math.random().toString(36).slice(2, 8);
  const field = (/** @type {string} */ label, /** @type {HTMLElement} */ ctl, cls = '') => { const w = document.createElement('div'); w.className = 't-field ' + cls; const l = document.createElement('label'); l.textContent = label; ctl.id = 'th-' + uid + '-' + cls; l.htmlFor = ctl.id; w.append(l, ctl); return w; };
  const mo = document.createElement('input'); mo.className = 'th-mo'; mo.maxLength = 200; mo.value = t.mo_ta || ''; mo.placeholder = 'Ví dụ: Ô D11 dùng hàm SUM tính tổng';
  const dm = document.createElement('input'); dm.className = 'th-diem'; dm.type = 'number'; dm.min = '0.25'; dm.step = '0.25'; dm.max = '100'; dm.value = String(t.diem || 1); dm.addEventListener('input', thTotal);
  const kt = document.createElement('select'); kt.className = 'th-kt'; kt.append(new Option('Không (chấm tay / AI gợi ý)', ''));
  for (const [k, v] of Object.entries(KT_LABELS)) kt.append(new Option(v.label, k));
  kt.value = t.kt?.type || '';
  const a = document.createElement('input'); a.className = 'th-a'; a.maxLength = 200; a.value = t.kt?.a || '';
  const b = document.createElement('textarea'); b.className = 'th-b'; b.maxLength = 2000; b.rows = 2; b.value = t.kt?.b || '';
  const fa = field('Tham số', a, 'th-fa'), fb = field('Mong đợi', b, 'th-fb');
  const sync = () => { const L = KT_LABELS[/** @type {keyof typeof KT_LABELS} */ (kt.value)]; fa.hidden = !L; fb.hidden = !L || !L.b; if (L) { /** @type {HTMLElement} */ (fa.querySelector('label')).textContent = L.a; /** @type {HTMLElement} */ (fb.querySelector('label')).textContent = L.b; } };
  kt.addEventListener('change', sync);
  const del = ui.iconButton({ icon: 'trash', label: 'Xóa tiêu chí này', danger: true, onClick: () => { row.remove(); thNumber(); thTotal(); } });
  row.append(field('Mô tả tiêu chí', mo, 'th-fmo'), field('Điểm', dm, 'th-fdm'), field('Kiểm tra tự động', kt, 'th-fkt'), fa, fb, del); sync();
  return row;
}
function thNumber() { $('thi-th-list').querySelectorAll('.thi-th-row').forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Tiêu chí ${i + 1}`; }); }
function thTotal() { let t = 0; $('thi-th-list').querySelectorAll('.th-diem').forEach(n => { t += Number(/** @type {HTMLInputElement} */ (n).value) || 0; }); $('thi-th-total').textContent = t ? `Tổng điểm thực hành: ${Math.round(t * 100) / 100}` : ''; }
/** @param {any} th */
function thLoad(th) {
  select('thi-th-loai').value = th?.loai || 'excel'; input('thi-th-de').value = th?.de || '';
  const list = $('thi-th-list'); list.replaceChildren(...(th?.tieu_chi?.length ? th.tieu_chi : [{}]).map((/** @type {any} */ t) => thRow(t))); thNumber(); thTotal();
}
/** @returns {{error?:string, value?:any}} */
function thCollect() {
  const de = input('thi-th-de'); de.removeAttribute('aria-invalid'); $('thi-th-de-err').textContent = '';
  if (!de.value.trim()) { de.setAttribute('aria-invalid', 'true'); $('thi-th-de-err').textContent = 'Nhập đề bài thực hành cho học sinh.'; de.focus(); return { error: 'Nhập đề bài thực hành.' }; }
  const tieu_chi = []; let i = 0;
  for (const f of $('thi-th-list').querySelectorAll('.thi-th-row')) {
    i++; f.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    const q = (/** @type {string} */ c) => /** @type {HTMLInputElement} */ (f.querySelector(c));
    const mo = q('.th-mo').value.trim(), diem = Number(q('.th-diem').value) || 0, type = q('.th-kt').value, a = q('.th-a').value.trim(), b = q('.th-b').value;
    if (!mo) { q('.th-mo').setAttribute('aria-invalid', 'true'); q('.th-mo').focus(); return { error: `Tiêu chí ${i}: nhập mô tả.` }; }
    if (diem <= 0) { q('.th-diem').setAttribute('aria-invalid', 'true'); q('.th-diem').focus(); return { error: `Tiêu chí ${i}: điểm phải lớn hơn 0.` }; }
    if (type && !a && type !== 'py_test') { q('.th-a').setAttribute('aria-invalid', 'true'); q('.th-a').focus(); return { error: `Tiêu chí ${i}: nhập ${KT_LABELS[/** @type {keyof typeof KT_LABELS} */ (type)].a.toLowerCase()}.` }; }
    if ((type === 'excel_value' || type === 'py_test') && !b.trim()) { q('.th-b').setAttribute('aria-invalid', 'true'); q('.th-b').focus(); return { error: `Tiêu chí ${i}: nhập kết quả mong đợi.` }; }
    tieu_chi.push({ mo_ta: mo, diem, kt: type ? { type, a, b } : null });
  }
  if (!tieu_chi.length) return { error: 'Thêm ít nhất một tiêu chí chấm thực hành.' };
  return { value: { loai: select('thi-th-loai').value, de: de.value.trim(), tieu_chi } };
}
$('thi-th-add').addEventListener('click', () => { const r = thRow(); $('thi-th-list').append(r); thNumber(); thTotal(); /** @type {HTMLElement} */ (r.querySelector('.th-mo')).focus(); });
select('thi-new-nd').addEventListener('change', bankHint);
select('thi-thu-nd').addEventListener('change', bankHint);
input('thi-tl-count').addEventListener('change', tlSync);
$('thi-tl-add').addEventListener('click', () => { const r = tlRow(); $('thi-tl-list').append(r); tlNumber(); /** @type {HTMLElement} */ (r.querySelector('.tl-text')).focus(); });
$('thi-tl-list').addEventListener('input', ev => { if (/** @type {HTMLElement} */ (ev.target).classList.contains('tl-text')) mixSum(); });
$('thi-qe-list').addEventListener('input', ev => { if (/** @type {HTMLElement} */ (ev.target).classList.contains('qe-pts')) mixSum(); });
thLoad(null);

/* ---------- Chấm thực hành: máy kiểm tra → AI gợi ý → giáo viên quyết định ---------- */
const thDlg = /** @type {HTMLDialogElement} */ ($('th-dialog'));
/** @type {{ex:any, s:any, th:any, auto:any, file:any}|null} */ let thCur = null;
function thSum() { if (!thCur) return; let d = 0; $('th-items').querySelectorAll('.th-score').forEach(n => { d += Number(/** @type {HTMLInputElement} */ (n).value) || 0; }); const max = thCur.th.tieu_chi.reduce((/** @type {number} */ a, /** @type {any} */ t) => a + t.diem, 0); $('th-sum').textContent = `Tổng: ${Math.round(d * 100) / 100} / ${max} điểm`; }
/** @param {any} ex @param {any} s */
async function openTh(ex, s) {
  thCur = null; $('th-items').replaceChildren(); $('th-err').textContent = ''; input('th-nhanxet').value = ''; $('th-preview').textContent = ''; $('th-sum').textContent = '';
  $('th-sub').textContent = `${s.name} · Lớp ${s.lop} · ${ex.tieu_de}`; $('th-status').textContent = 'Đang tải bài làm…';
  button('th-save').disabled = true; button('th-ai').disabled = true; thDlg.showModal();
  try {
    const r = await call({ action: 'gv_th_get', ma_de: ex.ma_de, ma: s.ma });
    const th = r.thuc_hanh || { loai: 'khac', tieu_chi: [] };
    if (!th.tieu_chi.length) { $('th-status').textContent = 'Bài thi chưa có tiêu chí chấm thực hành. Sửa bài thi để thêm tiêu chí.'; return; }
    $('th-status').textContent = /\.(py|txt)$/i.test(r.file.ten) ? 'Đang chạy chương trình Python của em (lần đầu mất 10–20 giây)…' : 'Máy đang kiểm tra bài làm…';
    const auto = await autoGrade(th, r.file);
    thCur = { ex, s, th, auto, file: r.file };
    $('th-preview').textContent = auto.preview; $('th-status').textContent = `File: ${r.file.ten}. Máy đã kiểm tra ${auto.results.filter((/** @type {any} */ x) => x.ok !== null).length}/${th.tieu_chi.length} tiêu chí.`;
    const box = $('th-items');
    th.tieu_chi.forEach((/** @type {any} */ t, i) => {
      const res = auto.results[i], prev = r.cham?.chi_tiet?.[i];
      const row = document.createElement('div'); row.className = 'th-item ' + (res.ok === true ? 'is-ok' : res.ok === false ? 'is-bad' : 'is-manual');
      const h = document.createElement('p'); h.className = 'th-item-title'; h.textContent = `${i + 1}. ${t.mo_ta} (tối đa ${t.diem} điểm)`;
      const badge = document.createElement('p'); badge.className = 'th-item-auto'; badge.textContent = (res.ok === true ? 'Máy kiểm tra: ĐẠT — ' : res.ok === false ? 'Máy kiểm tra: CHƯA ĐẠT — ' : '') + res.detail;
      const sc = document.createElement('input'); sc.type = 'number'; sc.className = 'th-score'; sc.min = '0'; sc.max = String(t.diem); sc.step = '0.25'; sc.id = 'th-sc-' + i; sc.setAttribute('aria-label', `Điểm tiêu chí ${i + 1}`);
      sc.value = prev ? String(prev.diem) : res.ok === true ? String(t.diem) : res.ok === false ? '0' : ''; sc.addEventListener('input', thSum);
      const nx = document.createElement('input'); nx.className = 'th-nx'; nx.maxLength = 300; nx.placeholder = 'Nhận xét ngắn'; nx.value = prev?.nhan_xet || ''; nx.setAttribute('aria-label', `Nhận xét tiêu chí ${i + 1}`);
      const line = document.createElement('div'); line.className = 'th-item-line'; line.append(sc, nx);
      row.append(h, badge, line); box.append(row);
    });
    if (r.cham?.nhan_xet) input('th-nhanxet').value = r.cham.nhan_xet;
    thSum(); button('th-save').disabled = false; button('th-ai').disabled = false;
  } catch (e) { $('th-status').textContent = ''; $('th-err').textContent = e instanceof Error ? e.message : 'Chưa tải được bài làm.'; }
}
$('th-cancel').addEventListener('click', () => thDlg.close());
$('th-ai').addEventListener('click', async () => {
  if (!thCur) return; const btn = button('th-ai'), label = btn.textContent; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'AI đang đọc bài…'; $('th-err').textContent = '';
  try {
    const tok = (() => { try { return sessionStorage.getItem('aisgk-pwa-teacher') || ''; } catch { return ''; } })();
    const th = thCur.th, auto = thCur.auto;
    const r = await api('/teacher/ai-practical', { method: 'POST', token: tok || undefined, timeout: 60000, body: { kind: auto.kind, task: th.de, rubric: th.tieu_chi.map((/** @type {any} */ t) => ({ mo_ta: t.mo_ta, diem: t.diem })), evidence: auto.evidence, auto: th.tieu_chi.map((/** @type {any} */ t, /** @type {number} */ i) => auto.results[i].ok === null ? null : { mo_ta: t.mo_ta, ok: auto.results[i].ok }).filter(Boolean), ...(tok ? {} : { gv_ma: getMa(), gv_pin: getPass() }) } });
    $('th-items').querySelectorAll('.th-item').forEach((row, i) => {
      const it = r.items?.[i]; if (!it) return;
      const sc = /** @type {HTMLInputElement} */ (row.querySelector('.th-score')), nx = /** @type {HTMLInputElement} */ (row.querySelector('.th-nx'));
      if (auto.results[i].ok === null) { sc.value = String(it.diem); row.classList.add('is-ai'); }   // máy đã kiểm tra thì giữ kết quả máy
      if (!nx.value) nx.value = it.nhan_xet || '';
    });
    if (!input('th-nhanxet').value.trim() && r.tong_ket) input('th-nhanxet').value = r.tong_ket;
    thSum(); $('th-status').textContent = 'AI đã gợi ý điểm cho các tiêu chí chấm tay (viền tím). Thầy cô xem lại, sửa nếu cần rồi bấm Lưu.';
  } catch (e) { $('th-err').textContent = e instanceof Error ? e.message : 'AI chưa gợi ý được.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
});
$('th-form').addEventListener('submit', async ev => {
  ev.preventDefault(); if (!thCur) return; $('th-err').textContent = '';
  const items = []; let i = 0;
  for (const row of $('th-items').querySelectorAll('.th-item')) {
    const sc = /** @type {HTMLInputElement} */ (row.querySelector('.th-score')), max = thCur.th.tieu_chi[i].diem; sc.removeAttribute('aria-invalid');
    const v = sc.value.trim() === '' ? NaN : Number(sc.value);
    if (!Number.isFinite(v) || v < 0 || v > max) { sc.setAttribute('aria-invalid', 'true'); sc.focus(); $('th-err').textContent = `Tiêu chí ${i + 1}: nhập điểm từ 0 đến ${max}.`; return; }
    items.push({ diem: v, nhan_xet: /** @type {HTMLInputElement} */ (row.querySelector('.th-nx')).value.trim() }); i++;
  }
  const btn = button('th-save'), label = btn.textContent; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Đang lưu…';
  try {
    const r = await call({ action: 'gv_th_save', ma_de: thCur.ex.ma_de, ma: thCur.s.ma, chi_tiet: items, nhan_xet: input('th-nhanxet').value.trim() });
    const id = thCur.ex.ma_de, k = store.keyOf(thCur.s.ma); fbTh[id] = { ...(fbTh[id] || {}), [k]: { ...((fbTh[id] || {})[k] || {}), diem_th: r.diem, tong_th: r.tong } };
    thDlg.close(); status(`Đã lưu điểm thực hành của ${thCur.s.name}: ${r.diem}/${r.tong}.`, 'success'); if (useFb() && current) { stats = fbStats(current); if (stats) renderStats(); }
  } catch (e) { $('th-err').textContent = e instanceof Error ? e.message : 'Chưa lưu được.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
});

/* ---------- AI soạn đề theo ma trận (giáo viên duyệt từng câu trước khi lưu) ---------- */
function qeNote() { if (!editing) $('thi-qe-note').textContent = 'Xem lại, sửa câu hỏi rồi bấm Tạo bài thi. Câu do AI soạn cần đánh dấu "Đã duyệt".'; }
/** @type {{key:string,title:string,grade:number,course_id:string,lesson_id:string}[]} */ let aiLessons = [];
const aiDlg = /** @type {HTMLDialogElement} */ ($('ai-q-dialog'));
const aiNum = (/** @type {string} */ id) => Math.max(0, Math.floor(Number(input(id).value) || 0));
const aiTotal = () => { const t = aiNum('ai-q-biet') + aiNum('ai-q-hieu') + aiNum('ai-q-vd'); $('ai-q-total').textContent = `Tổng ${t} câu`; return t; };
async function openAi() {
  for (const id of ['ai-q-err', 'ai-q-lesson-err', 'ai-q-matrix-err']) $(id).textContent = '';
  const withTl = select('thi-new-mode').value === 'thu' && select('thi-thu-nd').value === 'tn_tl';
  $('ai-q-tl-f').hidden = !withTl; $('ai-q-sub').textContent = withTl ? 'AI soạn câu trắc nghiệm và câu tự luận (kèm gợi ý đáp án) bám nội dung bài học. Thầy cô đọc, sửa và đánh dấu Đã duyệt từng câu trước khi lưu.' : 'AI soạn câu trắc nghiệm bám nội dung bài học. Thầy cô đọc, sửa và đánh dấu Đã duyệt từng câu trước khi lưu.';
  aiDlg.showModal(); aiTotal();
  const sl = select('ai-q-lesson'), khoi = Number(select('thi-new-khoi').value) || 0;
  if (!aiLessons.length) {
    try { const cat = await api('/pwa/catalog'); aiLessons = []; for (const c of cat?.courses || []) for (const l of c.lessons || []) aiLessons.push({ key: c.id + '|' + l.id, title: l.title, grade: Number(c.grade) || 0, course_id: c.id, lesson_id: l.id }); }
    catch { $('ai-q-err').textContent = 'Chưa tải được danh sách bài học. Kiểm tra mạng rồi mở lại.'; }
  }
  const list = aiLessons.filter(l => !khoi || l.grade === khoi);
  sl.replaceChildren(...(list.length ? [new Option('Chọn bài học', ''), ...list.map(l => new Option(`${l.title} · Lớp ${l.grade}`, l.key))] : [new Option(aiLessons.length ? `Chưa có bài học khối ${khoi}` : 'Chưa có bài học', '')]));
  sl.focus();
}
for (const id of ['ai-q-biet', 'ai-q-hieu', 'ai-q-vd']) input(id).addEventListener('input', aiTotal);
$('thi-new-ai').addEventListener('click', () => void openAi());
$('thi-qe-ai').addEventListener('click', () => void openAi());
$('ai-q-cancel').addEventListener('click', () => aiDlg.close());
$('ai-q-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  for (const id of ['ai-q-err', 'ai-q-lesson-err', 'ai-q-matrix-err']) $(id).textContent = '';
  const sl = select('ai-q-lesson'), l = aiLessons.find(x => x.key === sl.value), total = aiTotal();
  if (!l) { sl.setAttribute('aria-invalid', 'true'); $('ai-q-lesson-err').textContent = 'Chọn bài học để AI soạn câu hỏi.'; sl.focus(); return; }
  sl.removeAttribute('aria-invalid');
  const essays = $('ai-q-tl-f').hidden ? 0 : Math.max(0, Math.min(5, aiNum('ai-q-tl')));
  if ((!total && !essays) || total > 20) { $('ai-q-matrix-err').textContent = essays ? 'Trắc nghiệm tối đa 20 câu.' : 'Chọn từ 1 đến 20 câu.'; input('ai-q-biet').focus(); return; }
  const btn = button('ai-q-go'), label = btn.textContent; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'AI đang soạn… (10–30 giây)';
  try {
    const tok = (() => { try { return sessionStorage.getItem('aisgk-pwa-teacher') || ''; } catch { return ''; } })();
    const r = await api('/teacher/ai-questions', { method: 'POST', token: tok || undefined, timeout: 90000, body: { course_id: l.course_id, lesson_id: l.lesson_id, topic: input('ai-q-topic').value.trim(), counts: { 'Biết': aiNum('ai-q-biet'), 'Hiểu': aiNum('ai-q-hieu'), 'Vận dụng': aiNum('ai-q-vd') }, essays, ...(tok ? {} : { gv_ma: getMa(), gv_pin: getPass() }) } });
    const qs = Array.isArray(r?.questions) ? r.questions : [], es = Array.isArray(r?.essays) ? r.essays : [];
    if (!qs.length && !es.length) throw new Error('AI chưa soạn được câu nào. Thử lại.');
    if (!qeLoaded) qeRender([]);
    const box = $('thi-qe-list'); for (const q of qs) box.append(qeRow({ ...q, ai: true })); qeNumber(); qeNote();
    if (es.length) { const tb = $('thi-tl-list'); tlRows().forEach(f => { if (!/** @type {HTMLTextAreaElement} */ (f.querySelector('.tl-text')).value.trim() && !/** @type {HTMLTextAreaElement} */ (f.querySelector('.tl-guide')).value.trim()) f.remove(); }); for (const q of es) tb.append(tlRow({ ...q, ai: true })); tlNumber(); }
    aiDlg.close();
    status(`AI đã soạn ${qs.length} câu trắc nghiệm` + (es.length ? ` và ${es.length} câu tự luận` : '') + ` (bài "${r.lesson_title || l.title}"). Đọc kỹ, sửa nếu cần và đánh dấu "Đã duyệt" từng câu.` + (typeof r.remaining === 'number' ? ` Còn ${r.remaining} lượt AI hôm nay.` : '') + (r.kiem_tra ? ' ' + r.kiem_tra : ''), 'success');
    /** @type {HTMLElement|null} */ (box.querySelector('.thi-qe.is-ai:not(.is-approved) .qe-text'))?.focus();
  } catch (e) { $('ai-q-err').textContent = e instanceof Error ? e.message : 'AI chưa soạn được. Thử lại.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
});

/* ---------- Sự kiện ---------- */
select('thi-new-khoi').addEventListener('change', fillClasses);
select('thi-new-mode').addEventListener('change', () => { if (!editing && select('thi-new-mode').value === 'that' && qeLoaded) { $('thi-q-editor').hidden = true; $('thi-qe-list').replaceChildren(); qeLoaded = false; } bankHint(); });
$('thi-new-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const title = input('thi-new-title'), mode = select('thi-new-mode').value;
  if (!title.value.trim()) { title.setAttribute('aria-invalid', 'true'); status('Nhập tiêu đề bài thi.', 'error'); title.focus(); return; }
  title.removeAttribute('aria-invalid');
  const base = { tieu_de: title.value.trim(), khoi: Number(select('thi-new-khoi').value), lop: select('thi-new-lop').value,
    ...(mode === 'that' ? { nam_hoc: select('thi-new-nam').value, hinh_thuc: select('thi-new-ht').value, noi_dung: select('thi-new-nd').value } : {}) };
  if (mode === 'that' && select('thi-new-nd').value === 'tn_th') { const th = thCollect(); if (th.error) { status(th.error, 'error'); return; } /** @type {any} */ (base).thuc_hanh = th.value; }
  const withTl = mode === 'thu' && select('thi-thu-nd').value === 'tn_tl';
  /** @type {any[]} */ let essays = [];
  if (withTl) { const t = tlCollect(); if (t.error) { status(t.error, 'error'); return; } essays = t.essays || []; if (!essays.length) { status('Nhập ít nhất một câu tự luận (đề + gợi ý đáp án), hoặc chọn Nội dung thi là Trắc nghiệm.', 'error'); /** @type {HTMLElement|null} */ ($('thi-tl-list').querySelector('.tl-text'))?.focus(); return; } }
  if (editing) {
    let questions;
    if (qeLoaded) { const r = qeCollect(withTl); if (r.error) { status(r.error, 'error'); return; } questions = /** @type {any[]} */ (r.questions).concat(mode === 'thu' ? essays : []); }
    await run(button('thi-new-create'), () => call({ action: 'gv_update', ma_de: editing, ...base, questions }), 'Đã lưu thay đổi.');
    if (!$('thi-gv-alert').classList.contains('error')) { endEdit(); tab('list'); }
    return;
  }
  let questions = mode === 'thu' ? trialQuestions : undefined;
  if (mode === 'thu' && qeLoaded) { const r = qeCollect(withTl); if (r.error) { status(r.error, 'error'); return; } questions = r.questions; }
  if (mode === 'thu') questions = /** @type {any[]} */ (questions || []).concat(essays);
  if (mode === 'thu' && !(questions || []).length) { status('Tải file Excel đề thi thử hoặc bấm "AI soạn đề theo ma trận".', 'error'); input('thi-new-file').focus(); return; }
  await run(button('thi-new-create'), () => call({ action: 'gv_create', ...base, che_do: mode, questions }), mode === 'that' ? 'Đã tạo bài thi thật (đề đã chụp lại từ ngân hàng câu hỏi, đảo câu và đảo đáp án cho từng em). Tới giờ thi: bấm Theo dõi ca thi → chọn lớp → Mở thi cho lớp.' : 'Đã tạo bài thi. Học sinh vào phòng chờ; khi đủ mặt bấm Mở thi.');
  if (!$('thi-gv-alert').classList.contains('error')) { endEdit(); tab('list'); }
});
$('thi-new-cancel').addEventListener('click', () => { endEdit(); tab('list'); });
$('thi-qe-add').addEventListener('click', () => { const r = qeRow(); $('thi-qe-list').append(r); qeNumber(); /** @type {HTMLElement} */ (r.querySelector('.qe-text')).focus(); });
for (const k of /** @type {const} */ (['list', 'new'])) $('tab-thi-' + k).addEventListener('click', () => { if (k === 'list' && editing) endEdit(); tab(k); });
$('thi-gv-toggle').addEventListener('click', () => { const to = button('thi-gv-toggle').dataset.to; void run(button('thi-gv-toggle'), useFb() ? () => call({ action: 'gv_set', ma_de: current, trang_thai: to }) : async () => { await call({ action: 'gv_set', ma_de: current, trang_thai: to }); return call({ action: 'gv_stats', ma_de: current }); }, to === 'mo' ? 'Đã MỞ thi.' : 'Đã KHÓA thi.'); });
$('thi-gv-refresh').addEventListener('click', () => void run(button('thi-gv-refresh'), () => call({ action: useFb() ? 'gv_list' : 'gv_stats', ma_de: current }), ''));
$('thi-publish').addEventListener('click', () => void run(button('thi-publish'), () => call({ action: 'gv_publish' }), 'Đã cập nhật lên Firebase: học sinh thấy ngay danh sách bài, đề và tài khoản mới.'));
$('thi-list-refresh').addEventListener('click', () => void load());
for (const k of /** @type {const} */ (['kq', 'td'])) $('tab-thi-' + k).addEventListener('click', () => stTab(k));
$('act-sheetexam-back').addEventListener('click', () => { stats = null; closeCa(); void ui.showSub('list-sheetexam'); void load(); });
input('thi-gv-only').addEventListener('change', renderStats);
$('nav-sheetexam').addEventListener('click', () => { stats = null; startFb(); void load(); void startLive(); });
// Giáo viên đổi PIN: báo Google Sheet PIN mới (xác thực bằng PIN cũ) để menu Thi tiếp tục dùng được.
window.addEventListener('thi-gv-repin', ev => {
  const d = /** @type {CustomEvent} */ (ev).detail || {};
  void call({ gv: d.oldPin, action: 'gv_repin', new_gv: d.newPin }).then(() => { try { sessionStorage.setItem('thi-gv-mk', d.newPin); } catch { /* bỏ qua */ } }, () => { /* Sheet sẽ báo khi mở menu Thi */ });
});
// Chưa nối Firebase: danh sách / thống kê lấy lại từ Google Sheet mỗi 20 giây (trạng thái trực tuyến đã tức thì qua Firebase).
setInterval(() => {
  const v = document.getElementById('view-sheetexam');
  if (useFb()) return;   // đã cập nhật tức thì qua Firebase
  if (v && !v.hidden && document.visibilityState === 'visible' && !busyCount && info && getPass() && !editing) void reload();
}, 20000);
fillClasses(); fillYears();

/* ---------- THI THẬT: Theo dõi ca thi (30/10/2026, docs/ke-hoach/thi-that.md bản 3) ----------
 * Trạng thái từng em (thi_tt/{bài}/{mã}): Chưa mở thi → Chưa thi (giáo viên mở lớp/em) → Đã thi (em nộp) → Thi lại (giáo viên cho).
 * Màn này nghe tức thì: thi_tt, thi_vao (đã vào), thi_tien_do (TN x/y, thực hành), thi_drive (Sheet đã lưu Drive), thi_ip (ngoài mạng trường), presence.
 * Ghi chú vắng, điểm (chỉ giáo viên) và đường dẫn Drive lấy từ Google Sheet (gv_ca / gv_luu); lý do sức khỏe không đưa lên Firebase công khai. */
const TT_TEN = /** @type {Record<string,string>} */ ({ chua_mo: 'Chưa mở thi', chua_thi: 'Chưa thi', da_thi: 'Đã thi', thi_lai: 'Thi lại' });
/** @type {any} */ let caEx = null;
/** @type {Record<string, any>} */ let caTt = {}, caTd = {}, caDr = {}, caIp = {};
/** @type {{vang:Record<string,any>,drive:Record<string,string>,diem:Record<string,any>}} */ let caInfo = { vang: {}, drive: {}, diem: {} };
let caIpCfg = '', caTtLoaded = false, caLuuTimer = 0;
/** @type {Array<() => void>} */ let caStops = [];
const caKey = (/** @type {string} */ ma) => store.keyOf(ma);
const hms = (/** @type {number} */ t) => t ? new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
/** Hiện/ẩn khối Theo dõi ca thi và các phần của thi thử. @param {boolean} on */
function showCa(on) {
  $('ca-thi').hidden = !on;
  for (const id of ['thi-gv-metrics', 'thi-st-tabs', 'tabpanel-thi-kq', 'tabpanel-thi-td']) { const n = document.getElementById(id); if (n) n.hidden = on || (id === 'tabpanel-thi-td' ? true : n.hidden); }
  if (!on) { $('thi-gv-metrics').hidden = false; $('tabpanel-thi-kq').hidden = false; }
  button('thi-gv-toggle').hidden = on;
}
/** Lớp của bài: bài cho một lớp → lớp đó; bài cho cả khối → các lớp khối đó có trong danh sách học sinh. @param {any} e */
function caClasses(e) {
  if (e.lop) return [String(e.lop)];
  const set = new Set(Object.values(fbHs || {}).filter((/** @type {any} */ x) => x && Number(x.khoi) === Number(e.khoi)).map((/** @type {any} */ x) => String(x.lop)));
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}
function openCa(/** @type {any} */ e) {
  closeCa(); caEx = e; caTtLoaded = false; current = e.ma_de;
  $('thi-gv-sub').textContent = `${KIND.that} · ${sel(e)} · ${e.questions} câu · ${e.noi_dung === 'tn_th' ? 'Trắc nghiệm + Thực hành' : e.noi_dung === 'tn_tl' ? 'Trắc nghiệm + Tự luận' : 'Trắc nghiệm'}`;
  fillCaLop();
  const id = e.ma_de;
  caStops = [
    store.listen(`thi_tt/${id}`, d => { const next = d || {}; if (caTtLoaded) caToasts(caTt, next); caTt = next; caTtLoaded = true; renderCa(); }, undefined, { prio: 3 }),
    store.listen(`thi_tien_do/${id}`, d => { caTd = d || {}; renderCa(); }, undefined, { prio: 2 }),
    store.listen(`thi_drive/${id}`, d => { caDr = d || {}; renderCa(); }, undefined, { prio: 2 }),
    store.listen(`thi_ip/${id}`, d => { caIp = d || {}; renderCa(); }, undefined, { prio: 1 })
  ];
  void store.get('thi_cfg/ip_truong').then(v => { caIpCfg = String(v || ''); renderCaIp(); }).catch(() => {});
  syncExamFb();   // thi_vao, thi_th, thi_nop của bài này nghe tức thì
  void caLoadInfo('gv_ca');
  renderCa();
}
function closeCa() { caStops.forEach(f => f()); caStops = []; caEx = null; caTt = {}; caTd = {}; caDr = {}; caIp = {}; caInfo = { vang: {}, drive: {}, diem: {} }; clearTimeout(caLuuTimer); const t = document.getElementById('ca-toasts'); if (t) t.replaceChildren(); }
function fillCaLop() {
  if (!caEx) return;
  const selEl = select('ca-lop'), keep = selEl.value, list = caClasses(caEx);
  selEl.replaceChildren(...(list.length ? list.map(l => new Option('Lớp ' + l, l)) : [new Option('Chưa có lớp nào của khối này', '')]));
  if (list.includes(keep)) selEl.value = keep;
}
/** Ghi chú vắng, Drive, điểm từ Google Sheet. gv_luu = kéo bài vừa nộp về, chấm, lưu Drive ngay. @param {'gv_ca'|'gv_luu'} action */
async function caLoadInfo(action) {
  if (!caEx || !getPass()) return;
  const id = caEx.ma_de;
  try { const r = await call({ action, ma_de: id }); if (caEx && caEx.ma_de === id) { caInfo = { vang: r.vang || {}, drive: r.drive || {}, diem: r.diem || {} }; renderCa(); } if (r.fb_error) status('Google Sheet chưa lưu được bài lên Drive: ' + r.fb_error, 'error'); }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa kết nối được Google Sheet.', 'error'); }
}
/** Có em vừa nộp → thông báo + nhờ Sheet lưu Drive ngay (gộp nhiều em trong 3 giây). @param {Record<string,any>} prev @param {Record<string,any>} next */
function caToasts(prev, next) {
  const box = $('ca-toasts'); let any = false;
  for (const [k, v] of Object.entries(next)) {
    if (!v || v.tt !== 'da_thi' || prev[k]?.tt === 'da_thi') continue;
    any = true;
    const hs = (fbHs || {})[k] || {}, t = document.createElement('div'); t.className = 'ca-toast'; t.setAttribute('role', 'status'); t.dataset.k = k;
    const msg = document.createElement('p'); msg.textContent = `${hs.ten || k} (${hs.lop || v.lop || ''}) đã nộp bài lúc ${hms(Number(v.nop_luc) || Date.now())}${Number(v.lan) > 1 ? ` · lần ${v.lan}` : ''}.`;
    const open = document.createElement('a'); open.className = 't-button ca-drive'; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Đang lưu lên Drive…'; open.setAttribute('aria-disabled', 'true');
    const x = ui.iconButton({ icon: 'close', label: 'Đóng thông báo', onClick: () => t.remove() });
    t.append(msg, open, x); box.prepend(t);
    while (box.children.length > 5) box.lastElementChild?.remove();
  }
  if (any) { clearTimeout(caLuuTimer); caLuuTimer = window.setTimeout(() => void caLoadInfo('gv_luu'), 3000); }
}
/** Liên kết Drive của một em (Sheet ghi thi_drive sau khi lưu xong và kiểm đủ file). @param {string} k */
const caDriveUrl = k => String(caDr[k]?.thu_muc || caInfo.drive[k] || '');
function renderCaIp() { const t = document.getElementById('ca-ip-text'); if (t) t.textContent = caIpCfg ? `IP mạng trường: ${caIpCfg.split(',').join(', ')}.` : 'Chưa cài IP mạng trường (không bắt buộc).'; }
function renderCa() {
  if (!caEx || $('ca-thi').hidden) return;
  const e = caEx, lop = select('ca-lop').value, th = e.noi_dung === 'tn_th';
  if (select('ca-lop').options.length <= 1 && !lop) fillCaLop();
  const vao = fbVao[e.ma_de] || {}, ths = fbTh[e.ma_de] || {}, loc = select('ca-loc').value;
  const sts = Object.entries(fbHs || {}).filter(([, x]) => x && String(x.lop).toLowerCase() === String(lop).toLowerCase())
    .map(([k, x]) => { const t = String(caTt[k]?.tt || 'chua_mo'), p = live[liveKey(x.ma || k)];
      const online = !!p && p.state !== 'offline' && Date.now() - Number(p.at || 0) <= presence.STALE_MS;
      return { k, ma: x.ma || k, ten: x.ten || k, lop: x.lop, tt: t, st: caTt[k] || {}, vao: Number(vao[k]) || 0, td: caTd[k], th: !!ths[k] || !!caTd[k]?.th, dr: caDr[k], ngoai: caIp[k]?.ngoai === true, vang: caInfo.vang[k], diem: caInfo.diem[k], online, live: liveLabel(p) }; })
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  const doing = (/** @type {any} */ s) => (s.tt === 'chua_thi' || s.tt === 'thi_lai') && (s.vao || s.td);
  const m = { si: sts.length, vao: sts.filter(s => s.vao || s.tt === 'da_thi').length, lam: sts.filter(doing).length, nop: sts.filter(s => s.tt === 'da_thi').length, mo: sts.filter(s => s.tt === 'chua_thi' || s.tt === 'thi_lai').length, vang: sts.filter(s => s.vang).length };
  const chuaVao = sts.filter(s => (s.tt === 'chua_thi' || s.tt === 'thi_lai') && !s.vao && !s.td).length;
  metric($('ca-metrics'), [['Sĩ số', m.si], ['Đã vào thi', m.vao], ['Đang làm', m.lam], ['Đã nộp', m.nop], ['Chưa vào', chuaVao], ['Vắng (ghi chú)', m.vang]]);
  button('ca-mo').disabled = !lop || !sts.some(s => s.tt === 'chua_mo'); button('ca-dong').disabled = !lop || !m.mo;
  $('ca-help').textContent = !useFb() ? 'Theo dõi ca thi cần danh sách học sinh trên Firebase. Vào Tài khoản → Đẩy lên Firebase (hoặc nút Cập nhật lên Firebase ở danh sách bài thi), rồi mở lại.' : !lop ? 'Chọn lớp thi.' : m.mo ? `Lớp ${lop} đang thi: ${m.nop}/${m.si} em đã nộp. Không đếm giờ – chờ các em làm xong rồi bấm Đóng thi lớp này.` : m.nop ? `Lớp ${lop} đã thi: ${m.nop}/${m.si} em đã nộp.` : `Lớp ${lop} chưa mở thi. Khi các em đã ngồi vào máy, bấm Mở thi cho lớp.`;
  const rows = sts.filter(s => !loc || (loc === 'chua_vao' && (s.tt === 'chua_thi' || s.tt === 'thi_lai') && !s.vao && !s.td) || (loc === 'dang_lam' && doing(s)) || (loc === 'da_nop' && s.tt === 'da_thi') || (loc === 'vang' && s.vang) || (loc === 'ngoai' && s.ngoai));
  const body = $('ca-body'); body.replaceChildren();
  if (!rows.length) { const tr = document.createElement('tr'); const c = td('', !useFb() ? 'Chưa có danh sách học sinh trên Firebase.' : !lop ? 'Chọn lớp thi.' : !sts.length ? 'Lớp này chưa có học sinh trên Firebase (Tài khoản → Đẩy lên Firebase).' : 'Không có học sinh khớp bộ lọc.', 't-muted'); c.colSpan = 7; tr.append(c); body.append(tr); }
  const sm = (/** @type {string} */ t, cls = '') => { const x = document.createElement('small'); x.textContent = t; if (cls) x.className = cls; return x; };
  for (const s of rows) {
    const tr = document.createElement('tr'); tr.dataset.k = s.k; tr.dataset.tt = s.tt;
    const who = document.createElement('div'); const nm = document.createElement('strong'); nm.textContent = s.ten; who.append(nm, sm(s.ma));
    const st = document.createElement('div'); const bd = document.createElement('span'); bd.className = 't-badge ca-tt ca-tt-' + s.tt; bd.textContent = TT_TEN[s.tt] || s.tt; st.append(bd, sm(s.live, s.online ? 'ca-on' : ''));
    if (s.tt === 'thi_lai' && s.st.ly_do) st.append(sm('Lý do: ' + s.st.ly_do));
    const pg = document.createElement('div');
    if (s.vao) pg.append(sm('Vào lúc ' + hms(s.vao)));
    if (s.td && (s.tt === 'chua_thi' || s.tt === 'thi_lai')) pg.append(sm(`Trắc nghiệm ${s.td.n}/${s.td.tong}`));
    if (th) pg.append(sm(s.th ? 'Thực hành: đã nộp ✓' : 'Thực hành: chưa nộp', s.th ? 'ca-ok' : ''));
    if (s.ngoai) { const b2 = document.createElement('span'); b2.className = 't-badge t-badge-error'; b2.textContent = 'Ngoài mạng trường'; pg.append(b2); }
    if (!pg.childNodes.length) pg.append(sm('—'));
    const nop = document.createElement('div');
    if (s.tt === 'da_thi') { nop.append(sm('Đã nộp ' + hms(Number(s.st.nop_luc)), 'ca-ok')); if (Number(s.st.lan) > 1) nop.append(sm('Lần ' + s.st.lan)); if (s.diem) nop.append(sm(`Điểm (Sheet chấm): ${s.diem.diem}/${s.diem.tong}`)); }
    else nop.append(sm('—'));
    const dv = document.createElement('div'), url = caDriveUrl(s.k);
    if (url) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.className = 't-button ca-drive'; a.textContent = 'Mở bài trên Drive'; a.setAttribute('aria-label', `Mở bài của ${s.ten} trên Google Drive`); dv.append(a, sm(`Bài làm ${s.dr?.txt === false ? '✗' : '✓'}${th ? ` · Thực hành ${s.dr?.th ? '✓' : '✗ chưa thấy file'}` : ''}`, s.dr && th && !s.dr.th ? 'ca-bad' : 'ca-ok')); }
    else if (s.tt === 'da_thi') dv.append(sm('Đang lưu lên Drive…'));
    else dv.append(sm('—'));
    const note = document.createElement('div'); note.append(sm(s.vang ? `${s.vang.ly_do}${s.vang.ghi ? ': ' + s.vang.ghi : ''}` : '—'));
    const acts = document.createElement('div'); acts.className = 'ca-acts';
    const tb = (/** @type {string} */ text, /** @type {() => void} */ fn, aria = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = 't-button'; b.textContent = text; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', fn); return b; };
    if (s.tt === 'chua_mo') acts.append(tb('Mở cho em', () => void caLenh('mo_em', s), `Mở thi cho ${s.ten}`));
    if (s.tt === 'da_thi') acts.append(tb('Cho thi lại', () => openThiLai(s), `Cho ${s.ten} thi lại`));
    if (s.tt !== 'da_thi') acts.append(tb(s.vang ? 'Sửa ghi chú' : 'Ghi chú vắng', () => openVang(s), `Ghi chú vắng: ${s.ten}`));
    tr.append(td('Học sinh', who), td('Trạng thái', st), td('Tiến độ', pg), td('Nộp bài', nop), td('Bài trên Drive', dv), td('Ghi chú', note), td('Thao tác', acts));
    body.append(tr);
  }
  // Thông báo nộp: bật nút Drive khi Sheet đã lưu
  for (const t of /** @type {HTMLElement[]} */ ([...$('ca-toasts').querySelectorAll('.ca-toast')])) { const a = /** @type {HTMLAnchorElement} */ (t.querySelector('.ca-drive')), u = caDriveUrl(t.dataset.k || ''); if (a && u && !a.href) { a.href = u; a.textContent = 'Mở bài trên Drive'; a.removeAttribute('aria-disabled'); } }
}
/** Gửi lệnh ca thi lên Google Sheet (Sheet ghi Firebase). @param {'mo_lop'|'dong_lop'|'mo_em'|'thi_lai'} lenh @param {any} [s] @param {Record<string,string>} [extra] */
async function caLenh(lenh, s, extra = {}) {
  if (!caEx) return false;
  const lop = select('ca-lop').value, btnEl = lenh === 'mo_lop' ? button('ca-mo') : lenh === 'dong_lop' ? button('ca-dong') : null;
  if (btnEl) { btnEl.disabled = true; btnEl.setAttribute('aria-busy', 'true'); }
  try {
    const r = await call({ action: 'gv_tt', ma_de: caEx.ma_de, lenh, lop, ma: s ? s.ma : undefined, ...extra });
    status(lenh === 'mo_lop' ? `Đã mở thi cho lớp ${lop} (${r.n} em). Các em thấy nút Vào thi ngay.` : lenh === 'dong_lop' ? `Đã đóng thi lớp ${lop}.` : lenh === 'mo_em' ? `Đã mở thi cho ${s.ten}.` : `Đã cho ${s.ten} thi lại.`, 'success');
    return true;
  } catch (e) { status(e instanceof Error ? e.message : 'Chưa kết nối được Google Sheet.', 'error'); return false; }
  finally { if (btnEl) { btnEl.removeAttribute('aria-busy'); renderCa(); } }
}
$('ca-lop').addEventListener('change', renderCa);
$('ca-loc').addEventListener('change', renderCa);
$('ca-mo').addEventListener('click', async () => {
  const lop = select('ca-lop').value; if (!caEx || !lop) return;
  const n = Object.entries(fbHs || {}).filter(([k, x]) => x && String(x.lop).toLowerCase() === lop.toLowerCase() && String(caTt[k]?.tt || 'chua_mo') === 'chua_mo').length;
  if (await confirmBox({ title: `Mở thi cho lớp ${lop}?`, body: `${n} em sẽ thấy nút Vào thi "${caEx.tieu_de}" ngay. Em đã thi giữ nguyên. Không đếm giờ.`, okText: 'Mở thi cho lớp' })) void caLenh('mo_lop');
});
$('ca-dong').addEventListener('click', async () => {
  const lop = select('ca-lop').value; if (!caEx || !lop) return;
  const vao = fbVao[caEx.ma_de] || {}, list = Object.entries(fbHs || {}).filter(([k, x]) => x && String(x.lop).toLowerCase() === lop.toLowerCase() && ['chua_thi', 'thi_lai'].includes(String(caTt[k]?.tt)));
  const lam = list.filter(([k]) => vao[k] || caTd[k]).length, chua = list.length - lam;
  if (await confirmBox({ title: `Đóng thi lớp ${lop}?`, body: (lam ? `Còn ${lam} em đang làm bài. ` : '') + (chua ? `${chua} em chưa vào thi. ` : '') + 'Các em này về Chưa mở thi (bài làm dở vẫn giữ trên máy); thi bù bằng "Mở cho em" ở ca sau.', okText: 'Đóng thi lớp' })) void caLenh('dong_lop');
});
$('ca-ip').addEventListener('click', async () => {
  const b = button('ca-ip'); b.disabled = true; b.setAttribute('aria-busy', 'true');
  try { const r = await api('/thi/my-ip', { timeout: 10000 }); const x = await call({ action: 'gv_ip_truong', ip: r.ip }); caIpCfg = String(x.ip_truong || ''); renderCaIp(); status('Đã lưu IP mạng trường. Máy vào thi từ mạng khác sẽ có nhãn "Ngoài mạng trường".', 'success'); }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa đọc được IP.', 'error'); }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); }
});
/* Ghi chú vắng */
const vangDlg = /** @type {HTMLDialogElement} */ ($('vang-dialog')); /** @type {any} */ let vangFor = null;
function openVang(/** @type {any} */ s) {
  vangFor = s; $('vang-who').textContent = `${s.ten} (${s.ma}) · Lớp ${s.lop}`;
  select('vang-ly-do').value = s.vang?.ly_do || ''; input('vang-ghi').value = s.vang?.ghi || ''; $('vang-err').textContent = '';
  for (const id of ['vang-ly-do', 'vang-ghi']) $(id).removeAttribute('aria-invalid');
  button('vang-xoa').hidden = !s.vang; vangDlg.showModal(); select('vang-ly-do').focus();
}
async function saveVang(/** @type {string} */ ly, /** @type {string} */ ghi) {
  if (!caEx || !vangFor) return;
  const b = button('vang-luu'); b.disabled = true; b.setAttribute('aria-busy', 'true');
  try { const r = await call({ action: 'gv_vang', ma_de: caEx.ma_de, ma: vangFor.ma, ly_do: ly, ghi }); caInfo = { vang: r.vang || {}, drive: r.drive || {}, diem: r.diem || {} }; vangDlg.close(); renderCa(); status(ly ? `Đã ghi ${vangFor.ten} vắng: ${ly}.` : `Đã bỏ ghi chú vắng của ${vangFor.ten}.`, 'success'); }
  catch (e) { $('vang-err').textContent = e instanceof Error ? e.message : 'Chưa lưu được.'; }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); }
}
$('vang-form').addEventListener('submit', ev => {
  ev.preventDefault(); const ly = select('vang-ly-do').value, ghi = input('vang-ghi').value.trim();
  for (const id of ['vang-ly-do', 'vang-ghi']) $(id).removeAttribute('aria-invalid');
  if (!ly) { $('vang-ly-do').setAttribute('aria-invalid', 'true'); $('vang-err').textContent = 'Chọn lý do vắng.'; select('vang-ly-do').focus(); return; }
  if (ly === 'Khác' && !ghi) { $('vang-ghi').setAttribute('aria-invalid', 'true'); $('vang-err').textContent = 'Ghi rõ lý do khác.'; input('vang-ghi').focus(); return; }
  void saveVang(ly, ghi);
});
$('vang-xoa').addEventListener('click', () => void saveVang('', ''));
$('vang-huy').addEventListener('click', () => vangDlg.close());
select('vang-ly-do').addEventListener('change', () => { $('vang-err').textContent = ''; $('vang-ly-do').removeAttribute('aria-invalid'); });
/* Cho thi lại */
const tlDlg2 = /** @type {HTMLDialogElement} */ ($('thilai-dialog')); /** @type {any} */ let tlFor = null;
function openThiLai(/** @type {any} */ s) { tlFor = s; $('thilai-who').textContent = `${s.ten} (${s.ma}) · Lớp ${s.lop} · đã nộp lúc ${hms(Number(s.st.nop_luc))}`; select('thilai-ly-do').value = ''; input('thilai-ghi').value = ''; $('thilai-err').textContent = ''; $('thilai-ly-do').removeAttribute('aria-invalid'); tlDlg2.showModal(); select('thilai-ly-do').focus(); }
$('thilai-form').addEventListener('submit', async ev => {
  ev.preventDefault(); const ly = select('thilai-ly-do').value;
  if (!ly) { $('thilai-ly-do').setAttribute('aria-invalid', 'true'); $('thilai-err').textContent = 'Chọn lý do cho thi lại.'; select('thilai-ly-do').focus(); return; }
  const b = button('thilai-luu'); b.disabled = true; b.setAttribute('aria-busy', 'true');
  const ok = await caLenh('thi_lai', tlFor, { ly_do: ly, ghi: input('thilai-ghi').value.trim() });
  b.disabled = false; b.removeAttribute('aria-busy'); if (ok) tlDlg2.close(); else $('thilai-err').textContent = $('thi-gv-status')?.textContent || 'Chưa lưu được.';
});
$('thilai-huy').addEventListener('click', () => tlDlg2.close());
select('thilai-ly-do').addEventListener('change', () => { $('thilai-err').textContent = ''; $('thilai-ly-do').removeAttribute('aria-invalid'); });

