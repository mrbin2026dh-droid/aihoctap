// @ts-check
// Menu "Thi" của giáo viên — mọi dữ liệu nằm trong một Google Sheet (apps-script/sheet-exam/Code.gs), không qua Worker.
// Tạo bài thi (tiêu đề, thi thật/thử, khối, lớp) → học sinh đúng lớp vào phòng chờ (điểm danh) → Mở thi → theo dõi ai đã nộp.
// Xác thực: app tự gửi PIN giáo viên vừa đăng nhập; giáo viên không phải nhập thêm mật khẩu.
// Trạng thái trực tuyến (đang học / phòng chờ / đang thi / đã nộp) nhận TỨC THÌ từ Firebase (presence.js), không qua Worker.
import { SHEET_API } from './sheet-config.js';
import { parseExamRows, templateRows } from './exam-import.js';
import { confirmBox } from './dom.js';
import * as presence from './presence.js?v=20261027m';
import * as ui from './teacher-ui.js?v=20261027m';
import * as store from './thi-store.js';

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
/** @type {Record<string, any>} bài thực hành đã nộp */ let fbTh = {};
/** @type {Array<() => void>} */ let fbStops = [];
/** Dùng Firebase khi Google Sheet đã cài khóa Firebase và đã có danh sách học sinh trên Firebase. */
const useFb = () => !!info?.fb && fbHs !== null && Object.keys(fbHs).length > 0;
function startFb() {
  if (fbStops.length || !store.enabled()) return;
  const refresh = () => { if (!useFb() || busyCount) return; renderList(); if (onDetail() && current) { stats = fbStats(current); if (stats) renderStats(); } };
  fbStops = [store.listen('thi_hs', d => { fbHs = d || {}; refresh(); }), store.listen('thi_vao', d => { fbVao = d || {}; refresh(); }), store.listen('thi_nop', d => { fbNop = d || {}; refresh(); }), store.listen('thi_th', d => { fbTh = d || {}; refresh(); })];
}
function stopFb() { fbStops.forEach(f => f()); fbStops = []; fbHs = null; fbVao = {}; fbNop = {}; fbTh = {}; }
/** @param {any} e @param {any} s */
const inScope = (e, s) => e.lop ? String(s.lop || '').trim().toLowerCase() === String(e.lop).trim().toLowerCase() : Number(s.khoi) === Number(e.khoi);
/** Thống kê một bài từ Firebase: ai chưa vào / đã vào / đã nộp + điểm. @param {string} id */
function fbStats(id) {
  const e = (info?.exams || []).find((/** @type {any} */ x) => x.ma_de === id); if (!e) return null;
  const vao = fbVao[id] || {}, nop = fbNop[id] || {};
  const students = Object.entries(fbHs || {}).filter(([, s]) => s && inScope(e, s)).map(([k, s]) => {
    const n = nop[k]; return { name: s.ten, lop: s.lop, ma: s.ma || k, state: n ? 'nop' : (vao[k] ? 'vao' : 'chua'), last: vao[k] ? new Date(Number(vao[k])).toISOString() : '', score: n ? n.diem : null, total: n ? n.tong : null, lan: n ? (Number(n.lan) || 1) : 0, th: (fbTh[id] || {})[k] || null };
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
  const n = info?.bank?.[k] ?? null;
  $('thi-new-bank').textContent = that
    ? (n === null ? 'Câu hỏi lấy từ trang DeThi của Google Sheet theo khối đã chọn.' : `Trang DeThi trong Google Sheet có ${n} câu cho khối ${k}.` + (n ? '' : ' Thêm câu vào Sheet trước khi tạo bài.'))
    : (trialQuestions.length ? `Đã nhận ${trialQuestions.length} câu trắc nghiệm từ file Excel.` : 'Tải file Excel đề thi thử (dùng mẫu Excel của app).');
}

/** Năm học: năm trước, năm nay, năm sau (năm học mới bắt đầu tháng 8). */
function fillYears(/** @type {string} */ keep = '') {
  const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1, sel = select('thi-new-nam');
  const list = [y - 1, y, y + 1].map(a => `${a}-${a + 1}`); if (keep && !list.includes(keep)) list.unshift(keep);
  sel.replaceChildren(...list.map(v => new Option(v, v))); sel.value = keep || `${y}-${y + 1}`;
}

/* ---------- Sửa câu hỏi / đáp án (khi Chỉnh sửa bài thi) ---------- */
/** @type {boolean} */ let qeLoaded = false;
/** @param {{text?:string,options?:Record<string,string>,answer?:string,points?:number}} [q] */
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
  foot.append(field('Đáp án đúng', ans), field('Điểm', pts), del); fs.append(foot);
  return fs;
}
function qeNumber() { $('thi-qe-list').querySelectorAll('.thi-qe').forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Câu ${i + 1}`; }); }
/** @param {any[]} qs */
function qeRender(qs) { const box = $('thi-qe-list'); box.replaceChildren(...qs.map(q => qeRow(q))); qeNumber(); $('thi-q-editor').hidden = false; qeLoaded = true; }
/** Đọc câu hỏi từ trình sửa; lỗi → trả {error}. */
function qeCollect() {
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
    out.push({ text, options, answer, points });
  }
  if (!out.length) return { error: 'Bài thi cần ít nhất một câu hỏi.' };
  return { questions: out };
}
async function qeLoad(/** @type {any} */ e) {
  qeLoaded = false; $('thi-q-editor').hidden = false; $('thi-qe-list').replaceChildren(Object.assign(document.createElement('p'), { className: 't-muted', textContent: 'Đang tải câu hỏi…' }));
  $('thi-qe-note').textContent = e.che_do === 'that' ? `Câu hỏi thi thật dùng chung trang DeThi của khối ${e.khoi}: lưu ở đây sẽ thay các câu khối ${e.khoi} trong Google Sheet.` : 'Sửa đề bài, phương án, đáp án đúng, điểm rồi bấm Lưu thay đổi.';
  try { const r = await call({ action: 'gv_questions', ma_de: e.ma_de }); if (editing === e.ma_de) qeRender(r.questions || []); }
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
  if (!info) return;
  if (!exams.length) { const p = document.createElement('p'); p.className = 't-muted'; p.textContent = 'Chưa có bài thi nào. Mở tab "Tạo đề thi" để tạo bài đầu tiên.'; box.append(p); return; }
  for (const e0 of exams) {
    const e = counts(e0), open = e.trang_thai === 'mo';
    const card = document.createElement('article'); card.className = 't-card t-list-item'; card.dataset.maDe = e.ma_de;
    const left = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = e.tieu_de;
    const tags = document.createElement('p');
    for (const [t, bad] of [[KIND[/** @type {'that'|'thu'} */ (e.che_do)], false], [sel(e), false], [open ? 'Đang MỞ' : 'Đang KHÓA', !open], [e.xem_diem ? 'Cho xem điểm' : 'Ẩn điểm', false]]) { const b = document.createElement('span'); b.className = 't-badge' + (bad ? ' t-badge-error' : ''); b.textContent = String(t); tags.append(b, ' '); }
    const meta = document.createElement('p'); meta.className = 't-muted'; meta.textContent = `${e.questions} câu · ${e.total} học sinh · đã vào ${e.vao + e.nop} · đã nộp ${e.nop}`;
    left.append(h, tags, meta);
    const acts = document.createElement('div'); acts.className = 't-icon-actions';
    const bStats = ui.iconButton({ icon: 'stats', label: `Thống kê: ${e.tieu_de}`, onClick: () => void openStats(e.ma_de) });
    const bEdit = ui.iconButton({ icon: 'edit', label: `Chỉnh sửa: ${e.tieu_de}`, onClick: () => startEdit(e) });
    const bLock = ui.iconButton({ icon: open ? 'lock' : 'unlock', label: (open ? 'Khóa thi: ' : 'Mở thi: ') + e.tieu_de, onClick: () => void run(bLock, () => call({ action: 'gv_set', ma_de: e.ma_de, trang_thai: open ? 'khoa' : 'mo' }), open ? 'Đã KHÓA thi.' : 'Đã MỞ thi.') });
    const xem = !!e.xem_diem;
    const bXem = ui.iconButton({ icon: xem ? 'view' : 'viewoff', label: (xem ? 'Ẩn điểm với học sinh: ' : 'Cho học sinh xem điểm, xếp hạng: ') + e.tieu_de, onClick: () => void run(bXem, () => call({ action: 'gv_set', ma_de: e.ma_de, xem_diem: xem ? 'khong' : 'co' }), xem ? 'Đã ẩn điểm: học sinh chỉ thấy "Đã nộp bài".' : 'Đã cho xem điểm: học sinh thấy điểm, số lần thi và xếp hạng trong lớp.') });
    bXem.setAttribute('aria-pressed', String(xem));
    const bDel = ui.iconButton({ icon: 'trash', label: `Xóa: ${e.tieu_de}`, danger: true, onClick: () => void deleteExam(e, bDel) });
    acts.append(bStats, bEdit, bLock, bXem, bDel); card.append(left, acts); box.append(card);
  }
}
/** Thống kê một bài: học sinh thuộc đối tượng, ai đã vào/nộp, điểm. */
function renderStats() {
  const ex = stats?.exam; if (!ex) return;
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
    tr.append(td('Học sinh', `${s.name} (${s.ma})`), td('Lớp', s.lop), td('Bài thi', badge), td('Trực tuyến', liveLabel(live[liveKey(s.ma)])), td('Điểm', s.score === null || s.score === undefined ? '—' : `${s.score}/${s.total}`, 't-number'), td(ex.che_do === 'thu' ? 'Số lần thi' : 'Thao tác', last, ex.che_do === 'thu' ? 't-number' : ''));
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
    for (const s of list) { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = `${s.name} · ${s.lop}`; const b = document.createElement('small'); b.textContent = note(s); li.append(a, b); ul.append(li); }
    sec.append(ul); return sec;
  };
  box.replaceChildren(
    col('Chưa vào', sts.filter((/** @type {any} */ s) => s.state === 'chua'), 'is-wait', () => ''),
    col('Đang làm', sts.filter((/** @type {any} */ s) => s.state === 'vao'), 'is-doing', s => s.last ? 'vào ' + time(s.last) : ''),
    col('Đã nộp', sts.filter((/** @type {any} */ s) => s.state === 'nop'), 'is-done', s => (s.score !== null ? `${s.score}/${s.total}` : '') + (th ? (s.th ? ' · đã nộp thực hành' : ' · chưa nộp thực hành') : '')));
}
/** @param {'kq'|'td'} t */
function stTab(t) { for (const k of ['kq', 'td']) { const b = button('tab-thi-' + k), on = k === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('tabpanel-thi-' + k).hidden = !on; } }
function render() { renderList(); if (stats) renderStats(); fillClasses(); }
const onDetail = () => { const d = document.getElementById('detail-sheetexam'); return !!d && !d.hidden; };

/** Mở trang thống kê NGAY (dùng số liệu sẵn có của thẻ), rồi tải chi tiết từng em từ Google Sheet ở nền. */
async function openStats(/** @type {string} */ maDe) {
  current = maDe; stats = null; stTab('kq');
  const e = (info?.exams || []).find((/** @type {any} */ x) => x.ma_de === maDe);
  if (e) {
    $('thi-gv-title').textContent = e.tieu_de;
    $('thi-gv-sub').textContent = `${KIND[/** @type {'that'|'thu'} */ (e.che_do)]} · ${sel(e)} · ${e.questions} câu · đang ${e.trang_thai === 'mo' ? 'MỞ' : 'KHÓA'}`;
    metric($('thi-gv-metrics'), [['Học sinh của bài', e.total], ['Đã vào phòng thi', e.vao + e.nop], ['Đã nộp', e.nop], ['Chưa vào', e.total - e.vao - e.nop]]);
    button('thi-gv-toggle').textContent = e.trang_thai === 'mo' ? 'Khóa thi' : 'Mở thi'; button('thi-gv-toggle').dataset.to = e.trang_thai === 'mo' ? 'khoa' : 'mo';
  }
  const body = $('thi-gv-body'); body.replaceChildren(); const tr = document.createElement('tr'); const c = td('', 'Đang tải danh sách học sinh từ Google Sheet…', 't-muted'); c.colSpan = 6; tr.append(c); body.append(tr);
  await ui.showSub('detail-sheetexam');
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
  button('thi-new-create').textContent = 'Lưu thay đổi'; $('thi-new-cancel').hidden = false; bankHint(); tab('new'); input('thi-new-title').focus();
  void qeLoad(e);
}
function endEdit() {
  editing = ''; trialQuestions = []; input('thi-new-title').value = ''; input('thi-new-file').value = ''; select('thi-new-mode').disabled = false;
  $('thi-form-title').textContent = 'Tạo đề thi'; $('thi-form-sub').textContent = 'Bài mới luôn ở trạng thái khóa cho đến khi bấm Mở thi. Có thể tạo nhiều bài cho nhiều lớp cùng lúc.';
  button('thi-new-create').textContent = 'Tạo bài thi'; $('thi-new-cancel').hidden = true; bankHint();
  $('thi-q-editor').hidden = true; $('thi-qe-list').replaceChildren(); qeLoaded = false; fillYears(); select('thi-new-nd').value = 'tn';
}

/** @param {HTMLButtonElement|null} btn @param {() => Promise<any>} fn @param {string} okMsg */
async function run(btn, fn, okMsg) {
  if (!getPass()) { status('Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.', 'error'); return; }
  busyCount++; if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try {
    const r = await fn();
    if (r.students) stats = r; else { info = r; if (stats && !r.exams.some((/** @type {any} */ x) => x.ma_de === stats.exam.ma_de)) stats = null; }
    if (useFb() && current && onDetail()) stats = fbStats(current);
    render();
    if (r.fb_error) status('Đã lưu vào Google Sheet nhưng chưa đẩy được lên Firebase: ' + r.fb_error, 'error');
    else if (info && info.fb === false && !okMsg) status('Chưa nối Firebase nên học sinh chưa thấy bài. Mở Google Sheet → menu Bài thi → Cài khóa Firebase.', 'error');
    else status(okMsg, okMsg ? 'success' : '');
  }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa kết nối được Google Sheet.', 'error'); }
  finally { busyCount--; if (btn) { btn.removeAttribute('aria-busy'); btn.disabled = false; render(); } }
}
const load = () => run(null, () => call({ action: 'gv_list' }), '');
/** Làm mới màn hình đang xem (danh sách hoặc thống kê). */
const reload = () => (onDetail() && current) ? run(null, () => call({ action: 'gv_stats', ma_de: current }), '') : load();

/* ---------- Trực tuyến (Firebase, tức thì) ---------- */
/** Bảng trực tuyến riêng đã bỏ: trạng thái trực tuyến hiện ở cột "Trực tuyến" của trang Thống kê. */
function renderLive() { if (stats) renderStats(); }
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
document.getElementById('teacher-logout')?.addEventListener('click', () => { presence.stopWatch(); stopFb(); watching = false; info = null; live = {}; status(''); });
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
    trialQuestions = parsed.questions.filter(q => q.kind === 'choice').map(q => ({ text: q.prompt, options: q.options, answer: q.correct_answer, points: q.points }));
    if (editing && trialQuestions.length) qeRender(trialQuestions);   // đang sửa: đề trong file Excel thay vào trình sửa
    const skipped = parsed.questions.length - trialQuestions.length;
    status(`Đã nhận ${trialQuestions.length} câu trắc nghiệm.` + (skipped ? ` Bỏ qua ${skipped} câu tự luận (thi thử chỉ chấm trắc nghiệm).` : ''), trialQuestions.length ? 'success' : 'error');
  } catch (e) { status(e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file Excel.', 'error'); }
  bankHint();
});

/* ---------- Sự kiện ---------- */
select('thi-new-khoi').addEventListener('change', fillClasses);
select('thi-new-mode').addEventListener('change', bankHint);
$('thi-new-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const title = input('thi-new-title'), mode = select('thi-new-mode').value;
  if (!title.value.trim()) { title.setAttribute('aria-invalid', 'true'); status('Nhập tiêu đề bài thi.', 'error'); title.focus(); return; }
  title.removeAttribute('aria-invalid');
  const base = { tieu_de: title.value.trim(), khoi: Number(select('thi-new-khoi').value), lop: select('thi-new-lop').value,
    ...(mode === 'that' ? { nam_hoc: select('thi-new-nam').value, hinh_thuc: select('thi-new-ht').value, noi_dung: select('thi-new-nd').value } : {}) };
  if (editing) {
    let questions;
    if (qeLoaded) { const r = qeCollect(); if (r.error) { status(r.error, 'error'); return; } questions = r.questions; }
    await run(button('thi-new-create'), () => call({ action: 'gv_update', ma_de: editing, ...base, questions }), 'Đã lưu thay đổi.');
    if (!$('thi-gv-alert').classList.contains('error')) { endEdit(); tab('list'); }
    return;
  }
  if (mode === 'thu' && !trialQuestions.length) { status('Tải file Excel đề thi thử lên trước.', 'error'); input('thi-new-file').focus(); return; }
  await run(button('thi-new-create'), () => call({ action: 'gv_create', ...base, che_do: mode, questions: mode === 'thu' ? trialQuestions : undefined }), 'Đã tạo bài thi. Học sinh vào phòng chờ; khi đủ mặt bấm Mở thi.');
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
$('act-sheetexam-back').addEventListener('click', () => { stats = null; void ui.showSub('list-sheetexam'); void load(); });
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
