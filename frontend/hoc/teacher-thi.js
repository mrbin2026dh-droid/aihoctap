// @ts-check
// Menu "Thi" của giáo viên: điều khiển bài thi trong Google Sheet (thi thử/thật, mở/khóa, xem học sinh vào thi, cho thi lại).
import { SHEET_API } from './sheet-config.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const KEY = 'thi-gv-mk';
const getPass = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const setPass = (/** @type {string} */ v) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* bỏ qua */ } };

/** @param {Record<string,unknown>} body */
async function call(body) {
  if (!SHEET_API) throw new Error('Chưa cài địa chỉ bài thi.');
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
const status = (/** @type {string} */ m, bad = false) => { const n = $('thi-gv-status'); n.textContent = m; n.classList.toggle('error', bad); };
const td = (/** @type {string} */ label, /** @type {string|Node} */ v, cls = '') => { const c = document.createElement('td'); c.dataset.label = label; if (cls) c.className = cls; if (typeof v === 'string') c.textContent = v; else c.append(v); return c; };
const when = (/** @type {string} */ iso) => { if (!iso) return 'Chưa vào'; const d = new Date(iso); return isNaN(+d) ? iso : d.toLocaleString('vi-VN', { hour12: false }); };

/** @param {any} d */
function render(d) {
  $('thi-gv-panel').hidden = false;
  /** @type {HTMLSelectElement} */ ($('thi-gv-mode')).value = d.che_do;
  const open = d.trang_thai === 'mo';
  $('thi-gv-sub').textContent = `${d.che_do === 'that' ? 'Thi thật' : 'Thi thử'} — đang ${open ? 'MỞ' : 'KHÓA'} — ${d.questions} câu hỏi`;
  /** @type {HTMLButtonElement} */ ($('thi-gv-open')).disabled = open;
  /** @type {HTMLButtonElement} */ ($('thi-gv-lock')).disabled = !open;
  const sts = d.students || [], done = sts.filter((/** @type {any} */ s) => /đã thi/i.test(s.status)).length, logged = sts.filter((/** @type {any} */ s) => s.last).length;
  const m = $('thi-gv-metrics'); m.replaceChildren();
  for (const [k, v] of [['Học sinh', sts.length], ['Đã vào thi', logged], ['Đã nộp (thi thật)', done]]) {
    const w = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = String(k); b.textContent = String(v); w.append(a, b); m.append(w);
  }
  const body = $('thi-gv-body'); body.replaceChildren();
  if (!sts.length) { const tr = document.createElement('tr'); const c = td('', 'Sheet chưa có học sinh.', 't-muted'); c.colSpan = 6; tr.append(c); body.append(tr); return; }
  for (const s of sts) {
    const tr = document.createElement('tr');
    const act = document.createElement('button'); act.type = 'button'; act.className = 't-button'; act.textContent = 'Cho thi lại'; act.disabled = !/đã thi/i.test(s.status);
    act.addEventListener('click', async () => { act.disabled = true; try { render(await call({ action: 'gv_reset', ma: s.ma })); status('Đã cho ' + s.name + ' thi lại.'); } catch (e) { status(e instanceof Error ? e.message : 'Chưa thực hiện được.', true); act.disabled = false; } });
    tr.append(td('Học sinh', s.name + ' (' + s.ma + ')'), td('Lớp', s.lop), td('Vào thi gần nhất', when(s.last)), td('Trạng thái', s.status), td('Điểm', s.score === null || s.score === undefined ? '—' : `${s.score}/${s.total}`, 't-number'), td('Thao tác', act));
    body.append(tr);
  }
}

/** @param {() => Promise<any>} fn @param {string} ok */
async function run(fn, ok) {
  status('Đang kết nối Google Sheet…');
  try { render(await fn()); status(ok); } catch (e) {
    const msg = e instanceof Error ? e.message : 'Chưa kết nối được.';
    status(msg, true); if (/mật khẩu/i.test(msg)) { setPass(''); $('thi-gv-panel').hidden = true; }
  }
}
const load = () => run(() => call({ action: 'gv_info' }), 'Đã cập nhật ' + new Date().toLocaleTimeString('vi-VN', { hour12: false }) + '.');

$('thi-gv-form').addEventListener('submit', ev => {
  ev.preventDefault();
  const p = /** @type {HTMLInputElement} */ ($('thi-gv-pass')), v = p.value.trim();
  if (!v) { p.setAttribute('aria-invalid', 'true'); status('Nhập mật khẩu giáo viên của bài thi.', true); p.focus(); return; }
  p.removeAttribute('aria-invalid'); setPass(v); p.value = ''; void load();
});
$('thi-gv-refresh').addEventListener('click', () => void load());
$('thi-gv-open').addEventListener('click', () => void run(() => call({ action: 'gv_set', trang_thai: 'mo', che_do: /** @type {HTMLSelectElement} */ ($('thi-gv-mode')).value }), 'Đã MỞ thi.'));
$('thi-gv-lock').addEventListener('click', () => void run(() => call({ action: 'gv_set', trang_thai: 'khoa' }), 'Đã KHÓA thi.'));
$('thi-gv-mode').addEventListener('change', () => void run(() => call({ action: 'gv_set', che_do: /** @type {HTMLSelectElement} */ ($('thi-gv-mode')).value }), 'Đã đổi hình thức thi.'));
$('nav-sheetexam').addEventListener('click', () => { if (getPass()) void load(); });
