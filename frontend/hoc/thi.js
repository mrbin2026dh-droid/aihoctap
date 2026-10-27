// @ts-check
// Bài thi lấy thẳng từ Google Sheet (apps-script/sheet-exam/Code.gs). Đăng nhập Mã học sinh + PIN → Lấy đề → Nộp → Điểm.
import { SHEET_API } from './sheet-config.js';
import { setState as presence } from './presence.js';
export { SHEET_API };

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @type {{ma:string,pin:string,ma_de?:string,mode?:string,title?:string,student:any,questions:any[]}|null} */ let state = null;
const draftKey = () => 'thi-nhap-' + (state ? state.ma.toLowerCase() + '-' + (state.ma_de || '') : '');

/** Gọi Apps Script; thử lại 3 lần khi mạng/Apps Script bận. @param {Record<string,unknown>} body */
async function call(body) {
  if (!SHEET_API) throw new Error('Chưa cài địa chỉ bài thi. Báo thầy cô.');
  let last = 'Chưa kết nối được. Thử lại.';
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data && data.ok) return data;
      throw Object.assign(new Error(data && data.error ? data.error : last), { final: true });
    } catch (err) {
      if (err && /** @type {any} */ (err).final) throw err;
      last = 'Mạng hoặc hệ thống đang bận. Thử lại.';
      if (i < 3) await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error(last);
}
/** @param {HTMLButtonElement} btn @param {string} label @param {() => Promise<void>} fn */
async function busy(btn, label, fn) {
  const old = btn.textContent; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = label;
  try { await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = old; }
}
function readDraft() { try { return JSON.parse(localStorage.getItem(draftKey()) || '{}'); } catch { return {}; } }
/** @param {Record<string,string>} d */ function saveDraft(d) { try { localStorage.setItem(draftKey(), JSON.stringify(d)); } catch { /* bỏ qua */ } }
function answers() {
  /** @type {Record<string,string>} */ const a = {};
  document.querySelectorAll('#questions input[type=radio]:checked').forEach(el => { const i = /** @type {HTMLInputElement} */ (el); a[i.name] = i.value; });
  return a;
}

function show(/** @type {'login'|'pick'|'wait'|'exam'|'result'} */ v) { $('login').hidden = v !== 'login'; $('pick').hidden = v !== 'pick'; $('wait').hidden = v !== 'wait'; $('exam').hidden = v !== 'exam'; $('result').hidden = v !== 'result'; if (v !== 'wait') clearTimeout(waitTimer); }
let waitTimer = 0;

function renderExam() {
  if (!state) return;
  const s = state.student;
  $('who').textContent = (state.title ? state.title + ' — ' : '') + `${s.name} — Lớp ${s.lop} — ${state.questions.length} câu` + (state.mode === 'thu' ? ' — THI THỬ (làm được nhiều lần)' : '');
  const draft = readDraft(), list = $('questions'); list.replaceChildren();
  state.questions.forEach((q, i) => {
    const li = document.createElement('li'); li.className = 'q';
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.className = 'q-text'; lg.textContent = `Câu ${i + 1}. ${q.text} `;
    const pts = document.createElement('span'); pts.textContent = `(${q.points} điểm)`; lg.append(pts); fs.append(lg);
    for (const [k, t] of Object.entries(q.options || {})) {
      const lab = document.createElement('label'); lab.className = 'opt';
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = q.id; inp.value = k; inp.checked = draft[q.id] === k;
      inp.addEventListener('change', () => { saveDraft(answers()); $('draft-note').textContent = 'Đã lưu nháp trên máy.'; });
      lab.append(inp, document.createTextNode(`${k}. ${t}`)); fs.append(lab);
    }
    li.append(fs); list.append(li);
  });
  $('draft-note').textContent = Object.keys(draft).length ? 'Đã khôi phục bài làm dở trên máy này.' : '';
  show('exam');
}
/** @param {{score:number,total:number,correct?:number,count?:number}|null} r @param {string} [title] */
function renderResult(r, title = 'Đã nộp bài') {
  $('result-title').textContent = title;
  $('result-score').textContent = r ? `${r.score} / ${r.total} điểm` : '';
  $('result-detail').textContent = r && r.count ? `Đúng ${r.correct}/${r.count} câu.` : 'Kết quả đã được ghi vào sổ điểm của thầy cô.';
  show('result'); /** @type {HTMLElement} */ ($('result-title')).focus?.();
}

$('login').addEventListener('submit', async ev => {
  ev.preventDefault();
  const ma = /** @type {HTMLInputElement} */ ($('ma')), pin = /** @type {HTMLInputElement} */ ($('pin')), err = $('login-error');
  err.textContent = ''; ma.removeAttribute('aria-invalid'); pin.removeAttribute('aria-invalid');
  if (!ma.value.trim()) { ma.setAttribute('aria-invalid', 'true'); err.textContent = 'Nhập Mã học sinh.'; ma.focus(); return; }
  if (!pin.value.trim()) { pin.setAttribute('aria-invalid', 'true'); err.textContent = 'Nhập Mã PIN.'; pin.focus(); return; }
  const btn = /** @type {HTMLButtonElement} */ (ev.target instanceof HTMLFormElement ? ev.target.querySelector('button[type=submit]') : null);
  await busy(btn, 'Đang đăng nhập…', async () => {
    try {
      const data = await call({ action: 'exams', ma: ma.value.trim(), pin: pin.value.trim() });
      state = { ma: ma.value.trim(), pin: pin.value.trim(), student: data.student, questions: [] };
      pin.value = '';
      renderPick(data.exams || []);
    } catch (e) { err.textContent = e instanceof Error ? e.message : 'Chưa lấy được đề.'; }
  });
});

/** Màn hình chọn bài thi: mỗi bài là một nút. @param {any[]} exams */
function renderPick(exams) {
  if (!state) return;
  state.ma_de = ''; state.questions = [];
  $('pick-who').textContent = `${state.student.name} — Lớp ${state.student.lop}`;
  const ul = $('exam-list'); ul.replaceChildren();
  exams.forEach(e => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.className = 'exam-item'; b.dataset.maDe = e.ma_de;
    const t = document.createElement('strong'); t.textContent = e.tieu_de;
    const kind = e.che_do === 'that' ? 'Thi thật' : 'Thi thử';
    const st = e.done ? `Đã nộp: ${e.score}/${e.total} điểm` : (e.trang_thai === 'mo' ? 'Đang mở — bấm để vào thi' : 'Chưa mở — bấm để vào phòng chờ');
    const m = document.createElement('span'); m.className = 'muted'; m.textContent = `${kind} · ${st}`;
    b.append(t, m); b.addEventListener('click', () => void openExam(e.ma_de, b)); li.append(b); ul.append(li);
  });
  $('pick-empty').hidden = exams.length > 0; $('pick-error').textContent = '';
  show('pick'); void presence('hoc');
}
async function refreshPick() {
  if (!state) return;
  try { const d = await call({ action: 'exams', ma: state.ma, pin: state.pin }); state.student = d.student; renderPick(d.exams || []); }
  catch (e) { $('pick-error').textContent = e instanceof Error ? e.message : 'Chưa tải được danh sách.'; }
}
/** @param {string} maDe @param {HTMLButtonElement} btn */
async function openExam(maDe, btn) {
  if (!state) return;
  btn.disabled = true; $('pick-error').textContent = '';
  try {
    const d = await call({ action: 'exam', ma: state.ma, pin: state.pin, ma_de: maDe });
    state.ma_de = maDe; state.mode = d.mode; state.title = d.title; state.student = d.student; state.questions = d.questions || [];
    enter(d);
  } catch (e) { $('pick-error').textContent = e instanceof Error ? e.message : 'Chưa lấy được đề.'; }
  finally { btn.disabled = false; }
}

/** Vào bài: phòng chờ (bài đang khóa, tự hỏi lại 5 giây một lần) → làm bài, hoặc báo đã nộp. @param {any} data */
function enter(data) {
  if (!state) return;
  if (data.waiting) {
    $('wait-text').textContent = `${data.title || 'Bài thi'} — ${data.student.name}, lớp ${data.student.lop}. Thầy cô chưa mở thi.`;
    show('wait'); void presence('phong_cho');
    clearTimeout(waitTimer);
    waitTimer = window.setTimeout(async () => {
      if (!state) return;
      try { const d = await call({ action: 'exam', ma: state.ma, pin: state.pin, ma_de: state.ma_de }); state.mode = d.mode; state.title = d.title; state.student = d.student; state.questions = d.questions || []; enter(d); }
      catch (e) { await refreshPick(); $('pick-error').textContent = e instanceof Error ? e.message : 'Chưa lấy được đề.'; }
    }, 5000);
    return;
  }
  if (data.student.done && data.mode !== 'thu') { renderResult(null, 'Em đã nộp bài này rồi'); void presence('da_nop'); return; }
  renderExam(); void presence('dang_thi');
}

$('submit').addEventListener('click', () => {
  if (!state) return;
  const n = Object.keys(answers()).length, total = state.questions.length;
  $('confirm-text').textContent = n < total ? `Em mới làm ${n}/${total} câu. ${state.mode === 'thu' ? 'Đây là thi thử, em làm lại được.' : 'Nộp rồi thì không làm lại được.'}` : `Em đã làm đủ ${total} câu. ${state.mode === 'thu' ? 'Đây là thi thử, em làm lại được.' : 'Nộp rồi thì không làm lại được.'}`;
  /** @type {HTMLDialogElement} */ ($('confirm')).showModal();
});
$('confirm-cancel').addEventListener('click', () => /** @type {HTMLDialogElement} */ ($('confirm')).close());
$('confirm-ok').addEventListener('click', async () => {
  /** @type {HTMLDialogElement} */ ($('confirm')).close();
  if (!state) return;
  const btn = /** @type {HTMLButtonElement} */ ($('submit')); $('submit-error').textContent = '';
  await busy(btn, 'Đang nộp…', async () => {
    try {
      const r = await call({ action: 'submit', ma: state?.ma, pin: state?.pin, ma_de: state?.ma_de, answers: answers() });
      try { localStorage.removeItem(draftKey()); } catch { /* bỏ qua */ }
      renderResult(r); void presence('da_nop');
    } catch (e) { $('submit-error').textContent = (e instanceof Error ? e.message : 'Chưa nộp được.') + ' Bài làm vẫn còn trên máy.'; }
  });
});
$('pick-refresh').addEventListener('click', () => void refreshPick());
$('wait-back').addEventListener('click', () => void refreshPick());
const reset = () => { state = null; /** @type {HTMLFormElement} */ ($('login')).reset(); $('login-error').textContent = ''; show('login'); $('ma').focus(); };
$('logout').addEventListener('click', () => void refreshPick());   // "Thoát" bài đang làm → về danh sách bài thi (bài làm dở vẫn lưu nháp)
$('pick-exit').addEventListener('click', () => { if (document.body.classList.contains('embedded')) { void presence('hoc'); state = null; show('login'); $('login-error').textContent = 'Đã thoát. Bấm "Đăng nhập" để vào lại.'; $('pin').focus(); } else reset(); });
$('done').addEventListener('click', () => void refreshPick());
$('result-title').setAttribute('tabindex', '-1');

// Chế độ nhúng trong app (tab Thi): dùng Mã học sinh + PIN vừa đăng nhập, vào thẳng đề.
(function auto() {
  if (!/[?&]auto=1/.test(location.search)) return;
  let c = null; try { c = JSON.parse(sessionStorage.getItem('thi-cred') || 'null'); } catch { /* bỏ qua */ }
  document.body.classList.add('embedded');
  const head = document.querySelector('.head'); if (head) /** @type {HTMLElement} */ (head).hidden = true;
  if (!c || !c.ma || !c.pin) return;
  /** @type {HTMLInputElement} */ ($('ma')).value = c.ma; /** @type {HTMLInputElement} */ ($('pin')).value = c.pin;
  /** @type {HTMLFormElement} */ ($('login')).requestSubmit();
})();
