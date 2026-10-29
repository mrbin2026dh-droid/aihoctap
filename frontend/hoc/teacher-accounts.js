// @ts-check
// Menu "Tài khoản" của giáo viên — dữ liệu nằm trong Google Sheet (apps-script/sheet-exam/Code.gs):
//   Tab Học sinh : trang HocSinh (quản trị: mọi lớp; giáo viên lớp: lớp mình phụ trách). Thêm, sửa, đặt lại PIN, khóa/mở, xóa.
//   Tab Giáo viên: trang GiaoVien (chỉ quản trị). Giáo viên được cấp tài khoản đăng nhập bằng Mã giáo viên + PIN.
// Mỗi thay đổi Sheet tự đẩy lên Firebase, nên học sinh/giáo viên đăng nhập được ngay.
import { SHEET_API } from './sheet-config.js';
import { confirmBox, noticeBox } from './dom.js';
import * as ui from './teacher-ui.js?v=20261030a';
import * as presence from './presence.js?v=20261030a';
import * as db from './db.js';
import * as store from './thi-store.js';
/** Danh sách tài khoản lưu trên máy giáo viên (IndexedDB) để mở menu ngay, cập nhật từ Google Sheet ở nền.
 * Chỉ có mã, tên, lớp, trạng thái (không có mã PIN); xóa khi đăng xuất hoặc khi học sinh đăng nhập trên máy này. */
export const ACC_CACHE = 'acc-cache-v1';
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const inp = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '' }; } catch { return { gv: '', gv_ma: '' }; } };
/** Đang đăng nhập bằng tài khoản giáo viên lớp (không phải quản trị). */
export const isClassTeacher = () => !!cred().gv_ma;

/** @type {{students:any[],teachers:any[],classes:Record<string,number>,admin:boolean,loaded:boolean,limit:number}} */
const st = { students: [], teachers: [], classes: {}, admin: true, loaded: false, limit: ui.PAGE, note: '', at: 0 };
/** @type {{kind:'hs'|'gv', moi:boolean, ma:string}|null} */ let editing = null;

/** @param {Record<string, unknown>} body */
async function call(body) {
  if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet.');
  let last = 'Chưa kết nối được Google Sheet. Thử lại.';
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...cred(), ...body }) });
      const d = await res.json();
      if (d && d.ok) return d;
      throw Object.assign(new Error(d && d.error ? d.error : last), { final: true });
    } catch (e) {
      if (e && /** @type {any} */ (e).final) throw e;
      last = 'Mạng hoặc Google Sheet đang bận. Thử lại.';
      if (i < 2) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error(last);
}
/** @param {string} msg @param {'error'|'success'|''} [kind] */
function status(msg, kind = '') { const b = $('acc-alert'); $('acc-status').textContent = msg; b.hidden = !msg; b.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success'); }
const td = (/** @type {string} */ label, /** @type {string|Node} */ v) => { const c = document.createElement('td'); c.dataset.label = label; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };
const badge = (/** @type {string} */ t) => { const b = document.createElement('span'); b.className = 't-badge' + (t === 'Khóa' ? ' t-badge-error' : ''); b.textContent = t; return b; };

/** @param {any} r */
function apply(r) {
  if (r.students) { st.students = r.students; st.classes = r.classes || {}; st.admin = r.admin !== false; }
  if (r.teachers) st.teachers = r.teachers;
  if (r.fb_error) status('Đã lưu vào Google Sheet nhưng chưa đẩy được lên Firebase: ' + r.fb_error, 'error');
  if (st.loaded && (r.students || r.teachers)) saveCache();
}
const who = () => cred().gv_ma || 'admin';
function saveCache() { st.at = Date.now(); db.put('meta', ACC_CACHE, { who: who(), at: st.at, students: st.students, classes: st.classes, admin: st.admin, teachers: st.teachers }).catch(() => {}); }
const hhmm = (/** @type {number} */ t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
let loading = false;
async function load() {
  if (loading) return;
  // 1. Hiện ngay danh sách đã lưu trên máy (18.000 học sinh: không chờ Google Sheet 3–6 giây)
  if (!st.loaded) {
    /** @type {any} */ let c = null; try { c = await db.get('meta', ACC_CACHE); } catch { /* không có bộ nhớ */ }
    if (c && c.who === who() && Array.isArray(c.students)) {
      st.students = c.students; st.classes = c.classes || {}; st.admin = c.admin !== false; st.teachers = c.teachers || []; st.at = Number(c.at) || 0;
      $('tab-acc-gv').hidden = !st.admin; if (!st.admin) tab('hs');
      st.loaded = true; st.note = ' · Đang cập nhật…'; render(); startLive();
    } else $('acc-hs-count').textContent = 'Đang tải danh sách học sinh…';
  }
  // 2. Cập nhật từ Google Sheet ở nền
  loading = true;
  try {
    apply(await call({ action: 'gv_students' }));
    $('tab-acc-gv').hidden = !st.admin; if (!st.admin) tab('hs');
    if (st.admin) apply(await call({ action: 'gv_teachers' }));
    st.loaded = true; st.note = ''; status(''); saveCache(); render(); startLive(); void checkSync();
  } catch (e) {
    if (st.loaded) { st.note = ` · Danh sách lưu lúc ${hhmm(st.at)} (chưa cập nhật được)`; render(); }
    else $('acc-hs-count').textContent = '';
    status(e instanceof Error ? e.message : 'Chưa tải được danh sách.', 'error');
  } finally { loading = false; }
}
/** Học sinh có trong Google Sheet nhưng CHƯA có trên Firebase (thường do dán thẳng vào Sheet): chưa đăng nhập được,
 * chưa hiện ở Thảo luận, Luyện tập, Tổng quan. So mã bằng danh sách khóa (shallow), không tải cả cây. */
export function missingOnFirebase(/** @type {any[]} */ students, /** @type {string[]} */ fbKeys) {
  const have = new Set(fbKeys.map(k => String(k).toLowerCase()));
  return students.filter(s => s.trang_thai !== 'Khóa' && !have.has(store.keyOf(s.ma)));
}
async function checkSync() {
  const box = $('acc-sync'); if (!box || !store.enabled() || !st.students.length) return;
  let ks; try { ks = await store.keys('thi_hs'); } catch { return; }
  const miss = missingOnFirebase(st.students, ks);
  box.hidden = !miss.length; if (!miss.length) return;
  const lops = [...new Set(miss.map(s => s.lop))].sort(collator.compare);
  $('acc-sync-text').textContent = `${miss.length} học sinh có trong Google Sheet nhưng chưa có trên Firebase (lớp ${lops.slice(0, 8).join(', ')}${lops.length > 8 ? '…' : ''}): các em chưa đăng nhập được và chưa hiện ở Thảo luận, Luyện tập, Tổng quan. Thường do dán thẳng vào Sheet.`;
}
$('acc-sync-btn')?.addEventListener('click', async () => {
  const b = /** @type {HTMLButtonElement} */ ($('acc-sync-btn')), old = b.textContent;
  b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'Đang đẩy lên Firebase…';
  try { const r = await call({ action: 'gv_publish' }); if (r.fb_error) throw new Error(r.fb_error); await checkSync(); if ($('acc-sync').hidden) status('Đã đẩy danh sách học sinh lên Firebase. Các em đăng nhập được ngay.', 'success'); }
  catch (e) { status('Chưa đẩy được: ' + (e instanceof Error ? e.message : 'lỗi mạng'), 'error'); }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = old; }
});
/* ---------- Trực tuyến + thời gian học (Firebase: presence, thoi_gian) ---------- */
/** Ngày bắt đầu đo thời gian học (trước ngày này chưa có số liệu, không suy đoán). */
export const TRACK_FROM = '2026-10-29';
/** @type {Record<string, any>} */ let live = {};
/** @type {{days:string[], byDay: Record<string, Record<string, number>>}} */ let mins = { days: [], byDay: {} };
let offLive = /** @type {null | (() => void)} */ (null), minTimer = 0, liveTimer = 0;
const key = (/** @type {string} */ m) => String(m || '').trim().toLowerCase();
/** Trạng thái trực tuyến của một em. @param {string} ma */
export function onlineOf(ma, now = Date.now(), map = live) {
  const p = map[key(ma)] || map[ma];
  if (!p) return { on: false, label: 'Chưa đăng nhập', at: 0 };
  const at = Number(p.at || 0);
  if (p.state === 'offline' || now - at > presence.STALE_MS) return { on: false, label: 'Ngoại tuyến', at };
  return { on: true, label: presence.STATES[/** @type {keyof typeof presence.STATES} */ (p.state)] || 'Đang học', at };
}
/** Phút học hôm nay, 7 ngày, số ngày có học (≥ 5 phút). @param {string} ma */
export function minutesOf(ma, m = mins) {
  const k = key(ma), today = m.days[0];
  let week = 0, daysOn = 0;
  for (const d of m.days) { const v = m.byDay[d]?.[k] || 0; week += v; if (v >= 5) daysOn++; }
  return { today: today ? m.byDay[today]?.[k] || 0 : 0, week, daysOn };
}
/** Mức chuyên cần theo luật rõ ràng (giáo viên kiểm lại được), dùng số phút app mở trên màn hình khi em học/thi.
 * @param {{week:number, daysOn:number}} x @returns {{muc:'cham'|'deu'|'it'|'chua', ten:string, giai_thich:string}} */
export function diligence(x) {
  if (x.week >= 90 && x.daysOn >= 3) return { muc: 'cham', ten: 'Chăm', giai_thich: `${x.week} phút, ${x.daysOn} ngày có học trong 7 ngày` };
  if (x.week >= 30) return { muc: 'deu', ten: 'Có học', giai_thich: `${x.week} phút trong 7 ngày` };
  if (x.week > 0) return { muc: 'it', ten: 'Học ít', giai_thich: `chỉ ${x.week} phút trong 7 ngày` };
  return { muc: 'chua', ten: 'Chưa học', giai_thich: 'chưa mở app học trong 7 ngày (tính từ ngày bắt đầu đo)' };
}
const ago = (/** @type {number} */ at, now = Date.now()) => {
  if (!at) return '';
  const m = Math.round((now - at) / 60000);
  return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
};
const fmtMin = (/** @type {number} */ v) => v >= 60 ? `${Math.floor(v / 60)} giờ ${v % 60 ? (v % 60) + ' phút' : ''}`.trim() : `${v} phút`;
function liveCell(/** @type {string} */ ma) {
  const o = onlineOf(ma), w = document.createElement('span');
  w.className = 'acc-live ' + (o.on ? 'is-on' : 'is-off');
  const dot = document.createElement('span'); dot.className = 'acc-dot'; dot.setAttribute('aria-hidden', 'true');
  const t = document.createElement('span'); t.textContent = o.label;
  w.append(dot, t);
  if (!o.on && o.at) { const s = document.createElement('small'); s.textContent = ago(o.at); w.append(s); }
  return w;
}
function dilBadge(/** @type {string} */ ma) {
  const d = diligence(minutesOf(ma)), b = document.createElement('span');
  b.className = 'acc-dil acc-dil-' + d.muc; b.textContent = d.ten; b.title = d.giai_thich;
  return b;
}
/** Bộ lọc học sinh (tách riêng để kiểm thử). */
export function filterStudents(/** @type {any[]} */ list, /** @type {{lop?:string,q?:string,online?:string,act?:string,sort?:string}} */ f, now = Date.now(), map = live, m = mins) {
  const q = (f.q || '').trim().toLowerCase();
  const rows = list.filter(s => {
    if (f.lop && s.lop !== f.lop) return false;
    if (q && !(s.ma + ' ' + s.ten).toLowerCase().includes(q)) return false;
    const on = onlineOf(s.ma, now, map).on, x = minutesOf(s.ma, m);
    if (f.online === 'on' && !on) return false;
    if (f.online === 'off' && on) return false;
    if (f.act === 'today' && x.today < 1) return false;
    if (f.act === 'not_today' && x.today >= 1) return false;
    if (f.act === 'none7' && x.week > 0) return false;
    if (f.act === 'low7' && !(x.week < 30)) return false;
    return true;
  });
  const by = f.sort || 'ten';
  const cmpName = (/** @type {any} */ a, /** @type {any} */ b) => collator.compare(String(a.ten), String(b.ten));
  rows.sort((a, b) => {
    if (by === 'lop') return collator.compare(String(a.lop), String(b.lop)) || cmpName(a, b);
    if (by === 'online') return Number(onlineOf(b.ma, now, map).on) - Number(onlineOf(a.ma, now, map).on) || cmpName(a, b);
    if (by === 'today') return minutesOf(b.ma, m).today - minutesOf(a.ma, m).today || cmpName(a, b);
    if (by === 'week') return minutesOf(b.ma, m).week - minutesOf(a.ma, m).week || cmpName(a, b);
    if (by === 'week_asc') return minutesOf(a.ma, m).week - minutesOf(b.ma, m).week || cmpName(a, b);
    return cmpName(a, b);
  });
  return rows;
}
/** Số liệu thẻ thống kê. */
export function statsOf(/** @type {any[]} */ list, now = Date.now(), map = live, m = mins) {
  let on = 0, today = 0, none7 = 0, minToday = 0;
  for (const s of list) { if (onlineOf(s.ma, now, map).on) on++; const x = minutesOf(s.ma, m); if (x.today >= 1) today++; if (x.week === 0) none7++; minToday += x.today; }
  return { total: list.length, on, off: list.length - on, today, none7, avgToday: list.length ? Math.round(minToday / list.length) : 0 };
}
function scope() { const lop = /** @type {HTMLSelectElement} */ ($('acc-hs-lop')).value; return lop ? st.students.filter(s => s.lop === lop) : st.students; }
function renderStats() {
  const box = $('acc-hs-stats'); if (!box) return;
  const x = statsOf(scope());
  const cards = /** @type {const} */ ([
    ['total', 'Học sinh', x.total, '', ''],
    ['on', 'Đang trực tuyến', x.on, 'online:on', 'is-on'],
    ['off', 'Ngoại tuyến', x.off, 'online:off', 'is-off'],
    ['today', 'Có học hôm nay', x.today, 'act:today', ''],
    ['none7', mins.days.length && mins.days[mins.days.length - 1] < TRACK_FROM ? `Chưa học (từ ${TRACK_FROM.slice(8)}/${TRACK_FROM.slice(5, 7)})` : 'Chưa học 7 ngày', x.none7, 'act:none7', 'is-warn']]);
  box.replaceChildren(...cards.map(([id, label, n, flt, cls]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'acc-stat ' + cls; b.dataset.stat = id;
    const [fk, fv] = flt ? flt.split(':') : ['', ''];
    const cur = fk ? /** @type {HTMLSelectElement} */ ($('acc-hs-' + fk)).value : '';
    b.setAttribute('aria-pressed', String(!!fk && cur === fv));
    const num = document.createElement('strong'); num.textContent = String(n);
    const lb = document.createElement('span'); lb.textContent = label;
    b.append(num, lb);
    if (id === 'total') { const sm = document.createElement('small'); sm.textContent = `TB hôm nay ${fmtMin(x.avgToday)}/em`; b.append(sm); }
    b.addEventListener('click', () => {
      for (const k of ['online', 'act']) /** @type {HTMLSelectElement} */ ($('acc-hs-' + k)).value = '';
      if (fk && cur !== fv) /** @type {HTMLSelectElement} */ ($('acc-hs-' + fk)).value = fv;
      refilter();
    });
    return b;
  }));
}
/** Cập nhật cột Trực tuyến tại chỗ (không vẽ lại cả bảng → không mất vị trí bấm). */
function updateLive() {
  if (!st.loaded) return;
  const f = /** @type {HTMLSelectElement} */ ($('acc-hs-online')).value, sort = /** @type {HTMLSelectElement} */ ($('acc-hs-sort')).value;
  if (f || sort === 'online') { clearTimeout(liveTimer); liveTimer = window.setTimeout(render, 3000); return; }
  for (const tr of $('acc-hs-body').querySelectorAll('tr[data-ma]')) {
    const c = tr.querySelector('td[data-col=live]'); if (c) c.replaceChildren(liveCell(/** @type {HTMLElement} */ (tr).dataset.ma || ''));
  }
  renderStats();
}
/** Cập nhật số phút tại chỗ (không vẽ lại bảng → nút đang bấm không bị thay). Lọc/sắp xếp theo phút thì vẽ lại. */
function updateMinutes() {
  if (!st.loaded) return;
  const act = /** @type {HTMLSelectElement} */ ($('acc-hs-act')).value, sort = /** @type {HTMLSelectElement} */ ($('acc-hs-sort')).value;
  if (act || ['today', 'week', 'week_asc'].includes(sort)) { render(); return; }
  for (const tr of $('acc-hs-body').querySelectorAll('tr[data-ma]')) {
    const ma = /** @type {HTMLElement} */ (tr).dataset.ma || '', x = minutesOf(ma);
    const set = (/** @type {string} */ label, /** @type {string|Node} */ v) => { const c = tr.querySelector(`td[data-label="${label}"]`); if (c) { if (typeof v === 'string') c.textContent = v; else c.replaceChildren(v); } };
    set('Hôm nay', fmtMin(x.today)); set('7 ngày', fmtMin(x.week)); set('Chuyên cần', dilBadge(ma));
  }
  renderStats();
}
async function loadMinutes() {
  let next = mins;
  try { next = await presence.minutes(7); } catch { /* giữ số cũ */ }
  if (JSON.stringify(next) === JSON.stringify(mins)) return;
  mins = next; updateMinutes();
}
function startLive() {
  if (!offLive) offLive = presence.listen(map => { live = map; updateLive(); });
  void loadMinutes();
  clearInterval(minTimer); minTimer = window.setInterval(() => { if (!$('view-accounts').hidden && document.visibilityState === 'visible') void loadMinutes(); else updateLive(); }, 60000);
}

function render() {
  // Học sinh
  const sel = /** @type {HTMLSelectElement} */ ($('acc-hs-lop')), keep = sel.value;
  // Lớp nhóm theo khối, ghi sĩ số (trường 18.000 học sinh có hàng trăm lớp: danh sách phẳng rất khó tìm)
  const cnt = /** @type {Record<string, number>} */ ({}); for (const x of st.students) cnt[x.lop] = (cnt[x.lop] || 0) + 1;
  const lops = [...new Set([...Object.keys(st.classes), ...Object.keys(cnt)])].filter(Boolean).sort(collator.compare);
  const gOf = (/** @type {string} */ l) => Number(String(l).match(/^\d+/)?.[0]) || 0;
  sel.replaceChildren(new Option(`Tất cả các lớp (${st.students.length} em)`, ''));
  for (const g of [...new Set(lops.map(gOf))].sort((a, b) => b - a)) { const og = document.createElement('optgroup'); og.label = g ? `Khối ${g}` : 'Khác'; for (const l of lops.filter(x => gOf(x) === g)) og.append(new Option(`Lớp ${l} (${cnt[l] || 0} em)`, l)); sel.append(og); }
  if (lops.includes(keep)) sel.value = keep;
  const val = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id)).value;
  const rows = filterStudents(st.students, { lop: sel.value, q: inp('acc-hs-search').value, online: val('acc-hs-online'), act: val('acc-hs-act'), sort: val('acc-hs-sort') });
  const all = scope().length;
  $('acc-hs-count').textContent = (rows.length === all ? `${rows.length} học sinh` : `Đang lọc: ${rows.length} / ${all} học sinh`) + (st.admin ? '' : ' của lớp thầy cô phụ trách') + ` · Thời gian học tính từ ${TRACK_FROM.split('-').reverse().join('/')}, chỉ đếm phút app mở trên màn hình.` + st.note;
  renderStats();
  const body = $('acc-hs-body'); body.replaceChildren();
  if (!rows.length) { const tr = document.createElement('tr'); const c = td('', st.students.length ? 'Không có học sinh khớp bộ lọc.' : 'Chưa có học sinh. Bấm "Thêm học sinh".'); c.colSpan = 8; c.className = 't-muted'; tr.append(c); body.append(tr); }
  // Vẽ từng trang 50 dòng (1000 học sinh × 4 nút = 4000 nút → treo nếu vẽ hết mỗi lần gõ tìm kiếm).
  const frag = document.createDocumentFragment();
  for (const s of rows.slice(0, st.limit)) {
    const tr = document.createElement('tr'), acts = document.createElement('div'); acts.className = 't-icon-actions';
    tr.dataset.ma = s.ma;
    acts.append(
      ui.iconButton({ icon: 'edit', label: `Sửa: ${s.ten}`, onClick: () => openForm('hs', s) }),
      ui.iconButton({ icon: 'key', label: `Đặt lại mã PIN: ${s.ten}`, onClick: () => openForm('hs', s, true) }),
      ui.iconButton({ icon: s.trang_thai === 'Khóa' ? 'unlock' : 'lock', label: (s.trang_thai === 'Khóa' ? 'Mở khóa: ' : 'Khóa: ') + s.ten, onClick: () => void toggleLock('hs', s) }),
      ui.iconButton({ icon: 'trash', label: `Xóa: ${s.ten}`, danger: true, onClick: () => void remove('hs', s) }));
    const x = minutesOf(s.ma), liveTd = td('Trực tuyến', liveCell(s.ma)); liveTd.dataset.col = 'live';
    const tToday = td('Hôm nay', fmtMin(x.today)), tWeek = td('7 ngày', fmtMin(x.week));
    tToday.className = tWeek.className = 'acc-num';
    tr.append(td('Mã học sinh', s.ma), td('Họ và tên', s.ten), td('Lớp', s.lop), liveTd, tToday, tWeek, td('Chuyên cần', dilBadge(s.ma)), td('Thao tác', acts));
    if (s.trang_thai === 'Khóa') tr.cells[1].append(' ', badge('Khóa'));
    frag.append(tr);
  }
  body.append(frag);
  ui.moreRows($('acc-hs-table'), Math.min(st.limit, rows.length), rows.length, () => { st.limit += ui.PAGE; render(); });
  // Giáo viên
  const gb = $('acc-gv-body'); gb.replaceChildren();
  if (!st.teachers.length) { const tr = document.createElement('tr'); const c = td('', 'Chưa có giáo viên. Bấm "Thêm giáo viên".'); c.colSpan = 5; c.className = 't-muted'; tr.append(c); gb.append(tr); }
  for (const t of st.teachers) {
    const tr = document.createElement('tr'), acts = document.createElement('div'); acts.className = 't-icon-actions';
    acts.append(
      ui.iconButton({ icon: 'edit', label: `Sửa: ${t.ten}`, onClick: () => openForm('gv', t) }),
      ui.iconButton({ icon: 'key', label: `Đặt lại mã PIN: ${t.ten}`, onClick: () => openForm('gv', t, true) }),
      ui.iconButton({ icon: t.trang_thai === 'Khóa' ? 'unlock' : 'lock', label: (t.trang_thai === 'Khóa' ? 'Mở khóa: ' : 'Khóa: ') + t.ten, onClick: () => void toggleLock('gv', t) }),
      ui.iconButton({ icon: 'trash', label: `Xóa: ${t.ten}`, danger: true, onClick: () => void remove('gv', t) }));
    tr.append(td('Mã giáo viên', t.ma), td('Họ và tên', t.ten), td('Lớp phụ trách', (t.lop || []).join(', ')), td('Trạng thái', badge(t.trang_thai)), td('Thao tác', acts)); gb.append(tr);
  }
}
/** @param {'hs'|'gv'} t */
function tab(t) { for (const k of ['hs', 'gv']) { const b = $('tab-acc-' + k), on = k === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('tabpanel-acc-' + k).hidden = !on; } }

/* ---------- Hộp thoại thêm / sửa / đặt lại PIN ---------- */
/** @param {'hs'|'gv'} kind @param {any} [x] @param {boolean} [pinOnly] */
function openForm(kind, x, pinOnly = false) {
  editing = { kind, moi: !x, ma: x ? x.ma : '' };
  const who = kind === 'hs' ? 'học sinh' : 'giáo viên';
  $('acc-dlg-title').textContent = pinOnly ? `Đặt lại mã PIN: ${x.ten}` : (x ? `Sửa ${who}` : `Thêm ${who}`);
  $('acc-lop-label').textContent = kind === 'hs' ? 'Lớp' : 'Lớp phụ trách';
  $('acc-lop-hint').textContent = kind === 'hs' ? (st.admin ? 'Ví dụ 9A (bắt đầu bằng khối).' : 'Lớp thầy cô phụ trách: ' + Object.keys(st.classes).join(', ')) : 'Nhiều lớp cách nhau dấu phẩy, ví dụ 9A, 9B.';
  inp('acc-ma').value = x ? x.ma : ''; inp('acc-ma').readOnly = !!x;
  inp('acc-ten').value = x ? x.ten : ''; inp('acc-lop').value = x ? (kind === 'gv' ? (x.lop || []).join(', ') : x.lop) : (kind === 'hs' && !st.admin ? Object.keys(st.classes)[0] || '' : '');
  inp('acc-pin').value = ''; inp('acc-pin').required = !x || pinOnly;
  $('acc-pin-label').textContent = x && !pinOnly ? 'Mã PIN mới (bỏ trống nếu giữ nguyên)' : 'Mã PIN';
  for (const id of ['acc-ma', 'acc-ten', 'acc-lop']) $(id).closest('.t-field')?.toggleAttribute('hidden', pinOnly);
  for (const id of ['acc-ma', 'acc-ten', 'acc-lop', 'acc-pin']) { inp(id).removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; }
  $('acc-form-err').textContent = '';
  /** @type {HTMLDialogElement} */ ($('acc-dialog')).showModal();
  (pinOnly ? inp('acc-pin') : x ? inp('acc-ten') : inp('acc-ma')).focus();
}
/** @param {string} id @param {string} msg */
const bad = (id, msg) => { inp(id).setAttribute('aria-invalid', 'true'); $(id + '-err').textContent = msg; inp(id).focus(); return false; };
function validate() {
  for (const id of ['acc-ma', 'acc-ten', 'acc-lop', 'acc-pin']) { inp(id).removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; }
  const ma = inp('acc-ma').value.trim(), ten = inp('acc-ten').value.trim(), lop = inp('acc-lop').value.trim(), pin = inp('acc-pin').value.trim();
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(ma)) return bad('acc-ma', 'Mã 2–32 ký tự, chỉ gồm chữ, số, - và _.');
  if (!ten) return bad('acc-ten', 'Nhập họ và tên.');
  if (!lop) return bad('acc-lop', editing?.kind === 'gv' ? 'Nhập ít nhất một lớp phụ trách.' : 'Nhập lớp, ví dụ 9A.');
  if (editing?.kind === 'hs' && !/^\d/.test(lop)) return bad('acc-lop', 'Lớp phải bắt đầu bằng khối, ví dụ 9A.');
  if ((inp('acc-pin').required || pin) && (pin.length < 6 || pin.length > 16)) return bad('acc-pin', 'Mã PIN từ 6 đến 16 ký tự.');
  return true;
}
$('acc-form').addEventListener('submit', async ev => {
  ev.preventDefault(); if (!editing || !validate()) return;
  const btn = /** @type {HTMLButtonElement} */ ($('acc-save')), old = btn.textContent;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Đang lưu…'; $('acc-form-err').textContent = '';
  try {
    const body = { ma: inp('acc-ma').value.trim(), ten: inp('acc-ten').value.trim(), lop: inp('acc-lop').value.trim(), pin: inp('acc-pin').value.trim() || undefined, moi: editing.moi };
    apply(await call({ action: editing.kind === 'hs' ? 'gv_student_save' : 'gv_teacher_save', ...body }));
    /** @type {HTMLDialogElement} */ ($('acc-dialog')).close(); render();
    if (!$('acc-alert').classList.contains('error') || $('acc-alert').hidden) status(editing.moi ? 'Đã thêm tài khoản. Có thể đăng nhập ngay.' : 'Đã lưu thay đổi.', 'success');
  } catch (e) { $('acc-form-err').textContent = e instanceof Error ? e.message : 'Chưa lưu được.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = old; }
});
$('acc-cancel').addEventListener('click', () => /** @type {HTMLDialogElement} */ ($('acc-dialog')).close());

/** @param {'hs'|'gv'} kind @param {any} x */
async function toggleLock(kind, x) {
  const lock = x.trang_thai !== 'Khóa', who = kind === 'hs' ? 'học sinh' : 'giáo viên';
  const ok = await confirmBox({ title: lock ? `Khóa tài khoản ${who}?` : `Mở khóa tài khoản ${who}?`, body: lock ? `${x.ten} (${x.ma}) sẽ không đăng nhập được cho đến khi mở khóa.` : `${x.ten} (${x.ma}) đăng nhập lại được.`, okText: lock ? 'Khóa' : 'Mở khóa', danger: lock });
  if (!ok) return;
  try {
    const lop = kind === 'gv' ? (x.lop || []).join(', ') : x.lop;
    apply(await call({ action: kind === 'hs' ? 'gv_student_save' : 'gv_teacher_save', ma: x.ma, ten: x.ten, lop, trang_thai: lock ? 'Khóa' : 'Hoạt động' }));
    render(); status(lock ? `Đã khóa ${x.ten}.` : `Đã mở khóa ${x.ten}.`, 'success');
  } catch (e) { status(e instanceof Error ? e.message : 'Chưa thực hiện được.', 'error'); }
}
/** @param {'hs'|'gv'} kind @param {any} x */
async function remove(kind, x) {
  const who = kind === 'hs' ? 'học sinh' : 'giáo viên';
  const ok = await confirmBox({ title: `Xóa tài khoản ${who}?`, body: `Xóa ${x.ten} (${x.ma}) khỏi Google Sheet. ${kind === 'hs' ? 'Điểm đã nộp vẫn còn trong trang KetQua.' : 'Giáo viên này không đăng nhập được nữa.'} Không hoàn tác được.`, okText: 'Xóa tài khoản', danger: true });
  if (!ok) return;
  try { apply(await call({ action: kind === 'hs' ? 'gv_student_delete' : 'gv_teacher_delete', ma: x.ma })); render(); status(`Đã xóa ${x.ten}.`, 'success'); }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa xóa được.', 'error'); }
}

$('acc-hs-add').addEventListener('click', () => openForm('hs'));
$('acc-gv-add').addEventListener('click', () => openForm('gv'));
for (const k of /** @type {const} */ (['hs', 'gv'])) $('tab-acc-' + k).addEventListener('click', () => tab(k));
const refilter = () => { st.limit = ui.PAGE; render(); };
$('acc-hs-search').addEventListener('input', ui.debounce(refilter));
$('acc-hs-lop').addEventListener('change', refilter);
for (const id of ['acc-hs-online', 'acc-hs-act', 'acc-hs-sort']) $(id).addEventListener('change', refilter);
$('nav-accounts').addEventListener('click', () => void load());
document.getElementById('teacher-logout')?.addEventListener('click', () => { db.remove('meta', ACC_CACHE).catch(() => {}); st.students = []; st.teachers = []; st.loaded = false; st.at = 0; st.note = ''; status(''); offLive?.(); offLive = null; clearInterval(minTimer); live = {}; });

/* ---------- Giáo viên lớp: Cài đặt → Đổi mã PIN (trang GiaoVien trong Google Sheet) ---------- */
{
  const dlg = /** @type {HTMLDialogElement} */ ($('gv-pin-dialog'));
  const fields = ['gv-pin-old', 'gv-pin-new', 'gv-pin-again'];
  const clear = () => { for (const id of fields) { inp(id).removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; } $('gv-pin-err').textContent = ''; };
  const bad = (/** @type {string} */ id, /** @type {string} */ msg) => { inp(id).setAttribute('aria-invalid', 'true'); $(id + '-err').textContent = msg; inp(id).focus(); };
  $('act-gv-pin').addEventListener('click', () => { /** @type {any} */ ($('nav-profile')).hidePopover?.(); for (const id of fields) inp(id).value = ''; clear(); dlg.showModal(); inp('gv-pin-old').focus(); });
  $('gv-pin-cancel').addEventListener('click', () => dlg.close());
  $('gv-pin-form').addEventListener('submit', async ev => {
    ev.preventDefault(); clear();
    const old = inp('gv-pin-old').value.trim(), np = inp('gv-pin-new').value.trim(), again = inp('gv-pin-again').value.trim();
    if (old.length < 6) return bad('gv-pin-old', 'Nhập mã PIN hiện tại.');
    if (np.length < 6 || np.length > 16) return bad('gv-pin-new', 'Mã PIN từ 6 đến 16 ký tự.');
    if (np === old) return bad('gv-pin-new', 'Mã PIN mới phải khác mã hiện tại.');
    if (again !== np) return bad('gv-pin-again', 'Hai lần nhập chưa khớp.');
    const btn = /** @type {HTMLButtonElement} */ ($('gv-pin-save')), label = btn.textContent;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Đang đổi…';
    try {
      await call({ action: 'gv_repin', gv: old, new_gv: np });
      try { sessionStorage.setItem('thi-gv-mk', np); } catch { /* bỏ qua */ }
      dlg.close(); void noticeBox({ title: 'Đã đổi mã PIN', body: 'Lần sau thầy cô đăng nhập bằng mã PIN mới.', okText: 'Đóng' });
    } catch (e) { const m = e instanceof Error ? e.message : 'Chưa đổi được mã PIN.'; if (/PIN/.test(m) && /khớp|sai|chưa đúng/i.test(m)) bad('gv-pin-old', 'Mã PIN hiện tại chưa đúng.'); else $('gv-pin-err').textContent = m; }
    finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
  });
}

/* ---------- Cài đặt → Hỗ trợ học sinh qua Zalo (quản trị: chung cả trường; giáo viên lớp: riêng lớp mình) ---------- */
{
  const dlg = /** @type {HTMLDialogElement} */ ($('support-dialog'));
  const zaloOk = (/** @type {string} */ x) => !x || /^https:\/\/zalo\.me\/[A-Za-z0-9/_-]{3,80}$/.test(x) || /^(0|\+?84)\d{9,10}$/.test(x.replace(/[\s.\-()]/g, ''));
  const reset = () => { inp('support-zalo').removeAttribute('aria-invalid'); $('support-zalo-err').textContent = ''; $('support-err').textContent = ''; };
  $('act-support').addEventListener('click', async () => {
    /** @type {any} */ ($('nav-profile')).hidePopover?.(); reset();
    const cls = isClassTeacher();
    $('support-ten-field').hidden = cls;   // giáo viên lớp: dùng tên trong tài khoản
    $('support-sub').textContent = cls ? 'Học sinh các lớp thầy cô phụ trách thấy nút "Hỏi thầy cô", bấm vào là mở Zalo nhắn cho thầy cô.' : 'Zalo chung của trường: học sinh lớp chưa có Zalo riêng của giáo viên lớp sẽ thấy số này.';
    inp('support-zalo').value = ''; inp('support-ten').value = ''; inp('support-zalo').placeholder = 'Đang tải…';
    dlg.showModal(); inp('support-zalo').focus();
    try { const r = await call({ action: 'gv_support' }); inp('support-zalo').value = String(r.zalo || '').replace('https://zalo.me/', ''); inp('support-ten').value = r.ten || ''; }
    catch (e) { $('support-err').textContent = e instanceof Error ? e.message : 'Chưa tải được.'; }
    finally { inp('support-zalo').placeholder = '0912345678'; }
  });
  $('support-cancel').addEventListener('click', () => dlg.close());
  $('support-form').addEventListener('submit', async ev => {
    ev.preventDefault(); reset();
    const z = inp('support-zalo').value.trim();
    if (!zaloOk(z)) { inp('support-zalo').setAttribute('aria-invalid', 'true'); $('support-zalo-err').textContent = 'Nhập số điện thoại Zalo (ví dụ 0912345678) hoặc đường dẫn https://zalo.me/…'; inp('support-zalo').focus(); return; }
    const btn = /** @type {HTMLButtonElement} */ ($('support-save')), label = btn.textContent;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Đang lưu…';
    try {
      const r = await call({ action: 'gv_support_save', zalo: z, ten: inp('support-ten').value.trim() });
      dlg.close();
      void noticeBox({ title: r.zalo ? 'Đã lưu Zalo hỗ trợ' : 'Đã bỏ Zalo riêng', body: r.fb_error ? 'Đã lưu vào Google Sheet nhưng chưa đẩy được lên Firebase: ' + r.fb_error : (r.zalo ? 'Học sinh thấy nút "Hỏi thầy cô" ngay khi mở lại ứng dụng.' : 'Học sinh thấy Zalo mặc định của ứng dụng.'), okText: 'Đóng' });
    } catch (e) { $('support-err').textContent = e instanceof Error ? e.message : 'Chưa lưu được.'; }
    finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
  });
}
