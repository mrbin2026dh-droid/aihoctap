// @ts-check
// Menu "Thi" của giáo viên — mọi dữ liệu nằm trong một Google Sheet (apps-script/sheet-exam/Code.gs), không qua Worker.
// Tạo bài thi (tiêu đề, thi thật/thử, khối, lớp) → học sinh đúng lớp vào phòng chờ (điểm danh) → Mở thi → theo dõi ai đã nộp.
// Xác thực: app tự gửi PIN giáo viên vừa đăng nhập; giáo viên không phải nhập thêm mật khẩu.
import { SHEET_API } from './sheet-config.js';
import { parseExamRows, templateRows } from './exam-import.js';
import { confirmBox } from './dom.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const input = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const select = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const button = (/** @type {string} */ id) => /** @type {HTMLButtonElement} */ ($(id));
const getPass = () => { try { return sessionStorage.getItem('thi-gv-mk') || ''; } catch { return ''; } };
const STATE = { chua: 'Chưa vào', vao: 'Đã vào', nop: 'Đã nộp' };

/** @type {any} */ let info = null;
/** @type {{text:string,options:Record<string,string>,answer:string,points:number}[]} */ let trialQuestions = [];
let busyCount = 0;

/** @param {Record<string,unknown>} body */
async function call(body) {
  if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet bài thi.');
  let last = 'Chưa kết nối được Google Sheet. Thử lại.';
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ gv: getPass(), ...body }) });
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
/** @param {string} msg @param {'error'|'success'|''} kind */
function status(msg, kind = '') {
  const n = $('thi-gv-status'); n.textContent = msg; n.hidden = !msg;
  n.className = 'notice status ' + (kind === 'error' ? 'error' : 'success');
}
const td = (/** @type {string} */ label, /** @type {string|Node} */ v, cls = '') => { const c = document.createElement('td'); c.dataset.label = label; if (cls) c.className = cls; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };

/** Danh sách lớp theo khối đang chọn (lấy từ trang HocSinh). */
function fillClasses() {
  const k = Number(select('thi-new-khoi').value), sel = select('thi-new-lop'), keep = sel.value;
  sel.replaceChildren(new Option('Cả khối ' + k, ''));
  const classes = Object.entries(info?.classes || {}).filter(([, g]) => g === k).map(([c]) => c).sort();
  for (const c of classes) sel.append(new Option('Chỉ lớp ' + c, c));
  if (classes.includes(keep)) sel.value = keep;
  bankHint();
}
function bankHint() {
  const that = select('thi-new-mode').value === 'that', k = select('thi-new-khoi').value;
  $('thi-new-file-row').hidden = that;
  const n = info?.bank?.[k] ?? null;
  $('thi-new-bank').textContent = that
    ? (n === null ? 'Câu hỏi lấy từ trang DeThi của Google Sheet theo khối đã chọn.' : `Trang DeThi trong Google Sheet có ${n} câu cho khối ${k}.` + (n ? '' : ' Thêm câu vào Sheet trước khi tạo bài.'))
    : (trialQuestions.length ? `Đã nhận ${trialQuestions.length} câu trắc nghiệm từ file Excel.` : 'Tải file Excel đề thi thử (dùng mẫu Excel của app).');
}

function render() {
  const ex = info?.exam;
  $('thi-gv-current').hidden = !ex;
  if (!ex) { fillClasses(); return; }
  const open = ex.trang_thai === 'mo';
  $('thi-gv-title').textContent = ex.tieu_de;
  $('thi-gv-sub').textContent = `${ex.che_do === 'that' ? 'Thi thật' : 'Thi thử'} · ${ex.lop ? 'lớp ' + ex.lop : 'khối ' + ex.khoi} · ${ex.questions} câu · đang ${open ? 'MỞ' : 'KHÓA'}`;
  button('thi-gv-open').disabled = open; button('thi-gv-lock').disabled = !open;
  const sts = (info.students || []).filter((/** @type {any} */ s) => s.in_scope);
  const cnt = (/** @type {string} */ st) => sts.filter((/** @type {any} */ s) => s.state === st).length;
  const m = $('thi-gv-metrics'); m.replaceChildren();
  for (const [k, v] of [['Học sinh của bài', sts.length], ['Đã vào phòng thi', cnt('vao') + cnt('nop')], ['Đã nộp', cnt('nop')], ['Chưa vào', cnt('chua')]]) {
    const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = String(k); b.textContent = String(v); w.append(a, b); m.append(w);
  }
  const only = input('thi-gv-only').checked, rows = only ? sts.filter((/** @type {any} */ s) => s.state === 'chua') : sts;
  const body = $('thi-gv-body'); body.replaceChildren();
  if (!rows.length) { const tr = document.createElement('tr'); const c = td('', only ? 'Các em đã vào đủ.' : 'Không có học sinh nào thuộc lớp/khối này trong trang HocSinh.', 't-muted'); c.colSpan = 5; tr.append(c); body.append(tr); }
  for (const s of rows) {
    const tr = document.createElement('tr');
    const badge = document.createElement('span'); badge.className = 't-badge' + (s.state === 'chua' ? ' t-badge-error' : ''); badge.textContent = STATE[/** @type {keyof typeof STATE} */ (s.state)] || s.state;
    const act = document.createElement('button'); act.type = 'button'; act.className = 't-button'; act.textContent = 'Cho thi lại'; act.disabled = s.state !== 'nop' || ex.che_do !== 'that';
    act.addEventListener('click', () => void run(act, () => call({ action: 'gv_reset', ma: s.ma }), `Đã cho ${s.name} thi lại.`));
    tr.append(td('Học sinh', `${s.name} (${s.ma})`), td('Lớp', s.lop), td('Trạng thái', badge), td('Điểm', s.score === null || s.score === undefined ? '—' : `${s.score}/${s.total}`, 't-number'), td('Thao tác', act));
    body.append(tr);
  }
  fillClasses();
}

/** @param {HTMLButtonElement|null} btn @param {() => Promise<any>} fn @param {string} okMsg */
async function run(btn, fn, okMsg) {
  if (!getPass()) { status('Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.', 'error'); return; }
  busyCount++; if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try { info = await fn(); render(); status(okMsg, okMsg ? 'success' : ''); }
  catch (e) { status(e instanceof Error ? e.message : 'Chưa kết nối được Google Sheet.', 'error'); }
  finally { busyCount--; if (btn) { btn.removeAttribute('aria-busy'); btn.disabled = false; render(); } }
}
const load = (quiet = false) => run(null, () => call({ action: 'gv_info' }), quiet ? '' : '');

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
  if (mode === 'thu' && !trialQuestions.length) { status('Tải file Excel đề thi thử lên trước.', 'error'); input('thi-new-file').focus(); return; }
  if (info?.exam && !(await confirmBox({ title: 'Thay bài thi đang có?', body: `Bài "${info.exam.tieu_de}" sẽ được thay bằng bài mới. Kết quả cũ vẫn giữ trong trang KetQua.`, okText: 'Tạo bài mới' }))) return;
  await run(button('thi-new-create'), () => call({ action: 'gv_create', tieu_de: title.value.trim(), che_do: mode, khoi: Number(select('thi-new-khoi').value), lop: select('thi-new-lop').value, questions: mode === 'thu' ? trialQuestions : undefined }), 'Đã tạo bài thi. Học sinh vào phòng chờ; khi đủ mặt bấm Mở thi.');
});
$('thi-gv-open').addEventListener('click', () => void run(button('thi-gv-open'), () => call({ action: 'gv_set', trang_thai: 'mo' }), 'Đã MỞ thi.'));
$('thi-gv-lock').addEventListener('click', () => void run(button('thi-gv-lock'), () => call({ action: 'gv_set', trang_thai: 'khoa' }), 'Đã KHÓA thi.'));
$('thi-gv-refresh').addEventListener('click', () => void run(button('thi-gv-refresh'), () => call({ action: 'gv_info' }), ''));
input('thi-gv-only').addEventListener('change', render);
$('nav-sheetexam').addEventListener('click', () => void load());
// Giáo viên đổi PIN: báo Google Sheet PIN mới (xác thực bằng PIN cũ) để menu Thi tiếp tục dùng được.
window.addEventListener('thi-gv-repin', ev => {
  const d = /** @type {CustomEvent} */ (ev).detail || {};
  void call({ gv: d.oldPin, action: 'gv_repin', new_gv: d.newPin }).then(() => { try { sessionStorage.setItem('thi-gv-mk', d.newPin); } catch { /* bỏ qua */ } }, () => { /* Sheet sẽ báo khi mở menu Thi */ });
});
// Tự cập nhật điểm danh / bài nộp mỗi 10 giây khi đang mở menu Thi.
setInterval(() => {
  const v = document.getElementById('view-sheetexam');
  if (v && !v.hidden && document.visibilityState === 'visible' && !busyCount && info?.exam && getPass()) void load(true);
}, 10000);
fillClasses();
