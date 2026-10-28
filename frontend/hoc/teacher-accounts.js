// @ts-check
// Menu "Tài khoản" của giáo viên — dữ liệu nằm trong Google Sheet (apps-script/sheet-exam/Code.gs):
//   Tab Học sinh : trang HocSinh (quản trị: mọi lớp; giáo viên lớp: lớp mình phụ trách). Thêm, sửa, đặt lại PIN, khóa/mở, xóa.
//   Tab Giáo viên: trang GiaoVien (chỉ quản trị). Giáo viên được cấp tài khoản đăng nhập bằng Mã giáo viên + PIN.
// Mỗi thay đổi Sheet tự đẩy lên Firebase, nên học sinh/giáo viên đăng nhập được ngay.
import { SHEET_API } from './sheet-config.js';
import { confirmBox, noticeBox } from './dom.js';
import * as ui from './teacher-ui.js?v=20261028a';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const inp = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '' }; } catch { return { gv: '', gv_ma: '' }; } };
/** Đang đăng nhập bằng tài khoản giáo viên lớp (không phải quản trị). */
export const isClassTeacher = () => !!cred().gv_ma;

/** @type {{students:any[],teachers:any[],classes:Record<string,number>,admin:boolean,loaded:boolean,limit:number}} */
const st = { students: [], teachers: [], classes: {}, admin: true, loaded: false, limit: ui.PAGE };
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
}
async function load() {
  $('acc-hs-count').textContent = 'Đang tải…';
  try {
    apply(await call({ action: 'gv_students' }));
    $('tab-acc-gv').hidden = !st.admin; if (!st.admin) tab('hs');
    if (st.admin) apply(await call({ action: 'gv_teachers' }));
    st.loaded = true; status(''); render();
  } catch (e) { $('acc-hs-count').textContent = ''; status(e instanceof Error ? e.message : 'Chưa tải được danh sách.', 'error'); }
}
function render() {
  // Học sinh
  const sel = /** @type {HTMLSelectElement} */ ($('acc-hs-lop')), keep = sel.value, lops = Object.keys(st.classes).sort();
  sel.replaceChildren(new Option('Tất cả các lớp', ''), ...lops.map(l => new Option('Lớp ' + l, l))); if (lops.includes(keep)) sel.value = keep;
  const q = inp('acc-hs-search').value.trim().toLowerCase();
  const rows = st.students.filter(s => (!sel.value || s.lop === sel.value) && (!q || (s.ma + ' ' + s.ten).toLowerCase().includes(q)));
  $('acc-hs-count').textContent = `${rows.length} học sinh` + (st.admin ? '' : ' của lớp thầy cô phụ trách');
  const body = $('acc-hs-body'); body.replaceChildren();
  if (!rows.length) { const tr = document.createElement('tr'); const c = td('', st.students.length ? 'Không có học sinh khớp bộ lọc.' : 'Chưa có học sinh. Bấm "Thêm học sinh".'); c.colSpan = 5; c.className = 't-muted'; tr.append(c); body.append(tr); }
  // Vẽ từng trang 50 dòng (1000 học sinh × 4 nút = 4000 nút → treo nếu vẽ hết mỗi lần gõ tìm kiếm).
  const frag = document.createDocumentFragment();
  for (const s of rows.slice(0, st.limit)) {
    const tr = document.createElement('tr'), acts = document.createElement('div'); acts.className = 't-icon-actions';
    acts.append(
      ui.iconButton({ icon: 'edit', label: `Sửa: ${s.ten}`, onClick: () => openForm('hs', s) }),
      ui.iconButton({ icon: 'key', label: `Đặt lại mã PIN: ${s.ten}`, onClick: () => openForm('hs', s, true) }),
      ui.iconButton({ icon: s.trang_thai === 'Khóa' ? 'unlock' : 'lock', label: (s.trang_thai === 'Khóa' ? 'Mở khóa: ' : 'Khóa: ') + s.ten, onClick: () => void toggleLock('hs', s) }),
      ui.iconButton({ icon: 'trash', label: `Xóa: ${s.ten}`, danger: true, onClick: () => void remove('hs', s) }));
    tr.append(td('Mã học sinh', s.ma), td('Họ và tên', s.ten), td('Lớp', s.lop), td('Trạng thái', badge(s.trang_thai)), td('Thao tác', acts)); frag.append(tr);
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
$('nav-accounts').addEventListener('click', () => void load());
document.getElementById('teacher-logout')?.addEventListener('click', () => { st.students = []; st.teachers = []; st.loaded = false; status(''); });

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
