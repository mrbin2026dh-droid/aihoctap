// @ts-check
// Menu "Tài liệu" của giáo viên: tải file PDF (≤ 10 MB) từ máy tính → Google Drive (qua Google Sheet), chọn tiêu đề, khối.
// Mở xem, chỉnh sửa (tiêu đề, khối, mô tả, thay file), xóa (có xác nhận). Học sinh đúng khối thấy ngay trong mục Tài liệu.
// Quản trị: mọi khối; giáo viên lớp: khối của các lớp phụ trách.
import { SHEET_API } from './sheet-config.js';
import { confirmBox } from './dom.js';
import * as ui from './teacher-ui.js?v=20261029d';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const inp = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const sel = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '' }; } catch { return { gv: '', gv_ma: '' }; } };
const MAX = 10 * 1024 * 1024;
/** Đường dẫn xem file trên Google Drive. @param {string} id */
export const viewUrl = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;

/** @type {{docs:any[], khoi:number[]|null}} */ const st = { docs: [], khoi: null };
/** @type {any|null} */ let editing = null;

/** @param {Record<string, unknown>} body */
async function call(body) {
  if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet.');
  const big = typeof body.data === 'string';
  let last = 'Chưa kết nối được Google Sheet. Thử lại.';
  for (let i = 0; i < (big ? 1 : 3); i++) {   // tải file: không tự gửi lại (tránh tạo trùng)
    try {
      const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...cred(), ...body }) });
      const d = await res.json();
      if (d && d.ok) return d;
      throw Object.assign(new Error(d && d.error ? d.error : last), { final: true });
    } catch (e) {
      if (e && /** @type {any} */ (e).final) throw e;
      last = big ? 'Mạng chậm nên chưa tải lên xong. Kiểm tra mạng rồi bấm Lưu lại.' : 'Mạng hoặc Google Sheet đang bận. Thử lại.';
      if (!big && i < 2) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error(last);
}
/** @param {string} msg @param {'error'|'success'|''} [kind] */
function status(msg, kind = '') { const b = $('docs-alert'); $('docs-status').textContent = msg; b.hidden = !msg; b.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success'); }
const size = (/** @type {number} */ n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
/** @param {any} r */
function apply(r) { st.docs = r.docs || []; st.khoi = r.khoi || null; if (r.fb_error) status('Đã lưu nhưng chưa đẩy được lên Firebase: ' + r.fb_error, 'error'); }

async function load() {
  $('docs-count').textContent = 'Đang tải…';
  try { apply(await call({ action: 'gv_docs' })); render(); }
  catch (e) { $('docs-count').textContent = ''; status(e instanceof Error ? e.message : 'Chưa tải được danh sách.', 'error'); }
}
function khoiOptions() {
  const all = [9, 8, 7, 6], ks = st.khoi ? all.filter(k => st.khoi?.includes(k)) : all;
  for (const id of ['docs-khoi', 'docs-khoi-in']) {
    const s = sel(id), keep = s.value;
    s.replaceChildren(...(id === 'docs-khoi' ? [new Option('Tất cả khối', '')] : []), ...ks.map(k => new Option('Khối ' + k, String(k))));
    if ([...s.options].some(o => o.value === keep)) s.value = keep;
  }
}
function render() {
  khoiOptions();
  const k = sel('docs-khoi').value, rows = st.docs.filter(d => !k || String(d.khoi) === k).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  $('docs-count').textContent = `${rows.length} tài liệu`;
  const body = $('docs-body'); body.replaceChildren();
  if (!rows.length) { const tr = document.createElement('tr'), c = document.createElement('td'); c.colSpan = 5; c.className = 't-muted'; c.textContent = st.docs.length ? 'Không có tài liệu ở khối này.' : 'Chưa có tài liệu. Bấm "Thêm tài liệu" để tải file PDF lên.'; tr.append(c); body.append(tr); return; }
  for (const d of rows) {
    const tr = document.createElement('tr');
    const cell = (/** @type {string} */ l, /** @type {string|Node} */ v) => { const c = document.createElement('td'); c.dataset.label = l; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };
    const t = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = d.tieu_de; t.append(strong); if (d.mo_ta) { const m = document.createElement('p'); m.className = 't-muted'; m.style.margin = '4px 0 0'; m.textContent = d.mo_ta; t.append(m); }
    const acts = document.createElement('div'); acts.className = 't-icon-actions';
    acts.append(
      ui.iconButton({ icon: 'view', label: `Mở xem: ${d.tieu_de}`, onClick: () => window.open(viewUrl(d.file_id), '_blank', 'noopener') }),
      ui.iconButton({ icon: 'edit', label: `Chỉnh sửa: ${d.tieu_de}`, onClick: () => openForm(d) }),
      ui.iconButton({ icon: 'trash', label: `Xóa: ${d.tieu_de}`, danger: true, onClick: () => void remove(d) }));
    tr.append(cell('Tiêu đề', t), cell('Khối', 'Khối ' + d.khoi), cell('File', `${d.ten_file} · ${size(d.size)}`), cell('Cập nhật', d.at ? new Date(d.at).toLocaleDateString('vi-VN') : '—'), cell('Thao tác', acts));
    body.append(tr);
  }
}
/** @param {any} [d] */
function openForm(d) {
  editing = d || null;
  $('docs-dlg-title').textContent = d ? 'Chỉnh sửa tài liệu' : 'Thêm tài liệu';
  inp('docs-title-in').value = d ? d.tieu_de : ''; inp('docs-mota-in').value = d ? d.mo_ta : '';
  khoiOptions(); if (d) sel('docs-khoi-in').value = String(d.khoi); else if (sel('docs-khoi').value) sel('docs-khoi-in').value = sel('docs-khoi').value;
  inp('docs-file-in').value = '';
  $('docs-file-label').textContent = d ? 'Thay file PDF (bỏ trống nếu giữ file cũ)' : 'File PDF (tối đa 10 MB)';
  $('docs-file-hint').textContent = d ? `File hiện tại: ${d.ten_file}` : 'Chọn file PDF trên máy tính.';
  for (const id of ['docs-title', 'docs-file']) { $(id + '-in').removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; }
  $('docs-form-err').textContent = '';
  /** @type {HTMLDialogElement} */ ($('docs-dialog')).showModal(); inp('docs-title-in').focus();
}
/** @param {string} id @param {string} errId @param {string} msg */
const bad = (id, errId, msg) => { inp(id).setAttribute('aria-invalid', 'true'); $(errId).textContent = msg; inp(id).focus(); return false; };
$('docs-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  for (const [id, e] of [['docs-title-in', 'docs-title-err'], ['docs-file-in', 'docs-file-err']]) { inp(id).removeAttribute('aria-invalid'); $(e).textContent = ''; }
  const title = inp('docs-title-in').value.trim(), file = inp('docs-file-in').files?.[0] || null;
  if (!title) { bad('docs-title-in', 'docs-title-err', 'Nhập tiêu đề tài liệu.'); return; }
  if (!editing && !file) { bad('docs-file-in', 'docs-file-err', 'Chọn file PDF.'); return; }
  if (file && !(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) { bad('docs-file-in', 'docs-file-err', 'Chỉ nhận file PDF.'); return; }
  if (file && file.size > MAX) { bad('docs-file-in', 'docs-file-err', `File ${size(file.size)} quá lớn (tối đa 10 MB).`); return; }
  const btn = /** @type {HTMLButtonElement} */ ($('docs-save')), old = btn.textContent;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = file ? 'Đang tải lên…' : 'Đang lưu…'; $('docs-form-err').textContent = '';
  try {
    /** @type {Record<string, unknown>} */ const body = { action: 'gv_doc_save', id: editing ? editing.id : undefined, tieu_de: title, khoi: Number(sel('docs-khoi-in').value), mo_ta: inp('docs-mota-in').value.trim() };
    if (file) {
      body.data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Không đọc được file.')); r.readAsDataURL(file); });
      body.ten_file = file.name; body.mime = 'application/pdf';
    }
    apply(await call(body));
    /** @type {HTMLDialogElement} */ ($('docs-dialog')).close(); render();
    if ($('docs-alert').hidden || !$('docs-alert').classList.contains('error')) status(editing ? 'Đã lưu thay đổi.' : 'Đã thêm tài liệu. Học sinh đúng khối xem được ngay.', 'success');
  } catch (e) { $('docs-form-err').textContent = e instanceof Error ? e.message : 'Chưa lưu được.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = old; }
});
/** @param {any} d */
async function remove(d) {
  const ok = await confirmBox({ title: 'Xóa tài liệu?', body: `"${d.tieu_de}" sẽ bị gỡ khỏi mục Tài liệu của học sinh và file trên Google Drive vào thùng rác.`, okText: 'Xóa tài liệu', danger: true });
  if (!ok) return;
  try { apply(await call({ action: 'gv_doc_delete', id: d.id })); render(); status(`Đã xóa "${d.tieu_de}".`, 'success'); }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa xóa được.', 'error'); }
}
$('docs-add').addEventListener('click', () => openForm());
$('docs-cancel').addEventListener('click', () => /** @type {HTMLDialogElement} */ ($('docs-dialog')).close());
$('docs-khoi').addEventListener('change', render);
$('nav-materials').addEventListener('click', () => void load());
document.getElementById('teacher-logout')?.addEventListener('click', () => { st.docs = []; status(''); });
