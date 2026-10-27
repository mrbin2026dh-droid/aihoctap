// @ts-check
// Tab Thi của học sinh — chạy thẳng trên Firebase (thi-store.js), KHÔNG qua Worker hay Google Sheet:
// danh sách bài (cập nhật tức thì) → phòng chờ (tự vào khi thầy cô bấm Mở) → làm bài (nháp lưu trên máy) → nộp → điểm ngay.
import * as store from './thi-store.js';
import { setState as presence } from './presence.js';
import { el, icon, confirmBox } from './dom.js';

/** @typedef {{ma:string,ten:string,lop:string,khoi:number}} Me */
/** @typedef {{tieu_de:string,che_do:'that'|'thu',khoi:number,lop:string,trang_thai:'mo'|'khoa',so_cau:number}} Bai */
/** @typedef {{id:string,stt?:number|string,text:string,options:Record<string,string>,answer:string,points:number}} Cau */

/** @type {HTMLElement|null} */ let root = null;
/** @type {Me|null} */ let me = null;
/** @type {Record<string, Bai>} */ let bai = {};
/** @type {Record<string, any>} bài đã nộp của em, theo mã bài */ let mine = {};
/** @type {Record<string, Cau[]>} */ const deCache = {};
/** @type {null|(() => void)} */ let stop = null;
/** @type {{phase:'list'|'wait'|'exam'|'result', id:string, qs:Cau[], result?:any}} */ let cur = { phase: 'list', id: '', qs: [] };
let loaded = false, online = true;

const draftKey = (/** @type {string} */ id) => `thi-fb-${store.keyOf(me?.ma || '')}-${id}`;
const readDraft = (/** @type {string} */ id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}'); } catch { return {}; } };
const saveDraft = (/** @type {string} */ id, /** @type {Record<string,string>} */ a) => { try { localStorage.setItem(draftKey(id), JSON.stringify(a)); } catch { /* bỏ qua */ } };
const clearDraft = (/** @type {string} */ id) => { try { localStorage.removeItem(draftKey(id)); } catch { /* bỏ qua */ } };
/** Bài này có dành cho em không: chọn lớp → đúng lớp; chọn khối → cùng khối. @param {Bai} b */
const forMe = b => !!me && (b.lop ? b.lop.trim().toLowerCase() === me.lop.trim().toLowerCase() : (!b.khoi || b.khoi === me.khoi));
/** Thi thử chỉ hiện khi đang mở; thi thật hiện cả khi khóa (vào phòng chờ). */
const visible = () => Object.entries(bai || {}).filter(([, b]) => b && forMe(b) && (b.che_do === 'that' || b.trang_thai === 'mo'))
  .sort((a, b) => (a[1].trang_thai === b[1].trang_thai ? 0 : a[1].trang_thai === 'mo' ? -1 : 1));

/**
 * Vẽ tab Thi. Gọi mỗi lần học sinh mở tab.
 * @param {HTMLElement} target @param {{uid:string,student_name:string,class_code:string,grade:number}} identity
 */
export function render(target, identity) {
  root = target;
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, khoi: Number(identity.grade) || 0 };
  if (!me || me.ma !== next.ma) { mine = {}; cur = { phase: 'list', id: '', qs: [] }; loaded = false; }
  me = next;
  if (cur.phase === 'result') cur = { phase: 'list', id: '', qs: [] };
  draw(); if (cur.phase === 'wait') void presence('phong_cho');
  if (!stop) stop = store.listen('thi_bai', d => { bai = d || {}; loaded = true; onChange(); }, ok => { online = ok; if (cur.phase === 'list') draw(); });
}
/** Rời tab Thi (đăng xuất/đổi tab): dừng nghe. */
export function leave() { if (stop) { stop(); stop = null; } }

function onChange() {
  const b = bai[cur.id];
  if (cur.phase === 'wait' && b && b.trang_thai === 'mo') { void startExam(cur.id); return; }
  if ((cur.phase === 'wait' || cur.phase === 'exam') && !b) { cur = { phase: 'list', id: '', qs: [] }; }
  if (cur.phase === 'exam') { lockBanner(); return; }
  draw();
}
function draw() {
  if (!root) return;
  if (cur.phase === 'list') drawList();
  else if (cur.phase === 'wait') drawWait();
  else if (cur.phase === 'result') drawResult();
  else if (cur.phase === 'exam') { if (cur.qs.length) { drawExam(); void presence('dang_thi'); } else void startExam(cur.id); }   // quay lại tab Thi giữa chừng: bài làm vẫn còn (nháp)
}
const page = (/** @type {string} */ title, /** @type {string} */ sub) => {
  root?.replaceChildren();
  const w = el('div', '', 'thi-wrap'), h = el('div', '', 'thi-head');
  h.append(el('h2', title), el('p', sub, 'meta')); w.append(h); root?.append(w); return w;
};

/* ---------- Danh sách bài ---------- */
function drawList() {
  if (!me) return;
  const w = page('Bài thi', `${me.ten} · Lớp ${me.lop}`);
  if (!loaded) { w.append(el('p', online ? 'Đang tải bài thi…' : 'Đang chờ mạng…', 'meta thi-loading')); return; }
  const list = visible();
  if (!list.length) {
    const box = el('div', '', 'empty-state thi-empty'); box.append(icon('exam', 'ic empty-ic'), el('h3', 'Chưa có bài thi'), el('p', 'Khi thầy cô mở bài thi cho lớp em, bài sẽ tự hiện ở đây.'));
    w.append(box); return;
  }
  const ul = el('ul', '', 'thi-list');
  for (const [id, b] of list) {
    const done = mine[id];
    const btn = /** @type {HTMLButtonElement} */ (el('button', '', 'thi-card')); btn.type = 'button'; btn.dataset.id = id;
    const top = el('div', '', 'thi-card-top');
    top.append(el('strong', b.tieu_de), el('span', b.che_do === 'that' ? 'Thi thật' : 'Thi thử', 'thi-chip ' + (b.che_do === 'that' ? 'is-real' : 'is-trial')));
    const st = done && b.che_do === 'that' ? `Đã nộp · ${done.diem}/${done.tong} điểm`
      : b.trang_thai === 'mo' ? `Đang mở · ${b.so_cau} câu${done ? ` · lần trước ${done.diem}/${done.tong}` : ''}` : 'Chưa mở · bấm để vào phòng chờ';
    const meta = el('span', st, 'meta thi-card-meta' + (b.trang_thai === 'mo' && !(done && b.che_do === 'that') ? ' is-open' : ''));
    btn.append(top, meta); btn.addEventListener('click', () => void open(id));
    const li = el('li'); li.append(btn); ul.append(li);
  }
  w.append(ul);
  // Lấy điểm các bài em đã nộp (một lần, song song) để hiện ngay trên thẻ.
  const need = list.map(([id]) => id).filter(id => !(id in mine));
  if (need.length) {
    need.forEach(id => { mine[id] = null; });
    void Promise.all(need.map(id => store.get(`thi_nop/${id}/${store.keyOf(me?.ma || '')}`).then(v => { mine[id] = v; }).catch(() => { delete mine[id]; })))
      .then(() => { if (cur.phase === 'list' && need.some(id => mine[id])) drawList(); });
  }
}

/** @param {string} id */
async function open(id) {
  const b = bai[id]; if (!b || !me) return;
  if (b.che_do === 'that' && mine[id]) { cur = { phase: 'result', id, qs: [], result: { ...mine[id], already: true } }; drawResult(); return; }
  void store.put(`thi_vao/${id}/${store.keyOf(me.ma)}`, store.SERVER_TIME).catch(() => {});   // điểm danh
  if (b.trang_thai !== 'mo') { cur = { phase: 'wait', id, qs: [] }; drawWait(); void presence('phong_cho'); return; }
  await startExam(id);
}

/* ---------- Phòng chờ ---------- */
function drawWait() {
  const b = bai[cur.id]; if (!b) return;
  const w = page(b.tieu_de, 'Phòng chờ thi');
  const box = el('div', '', 'thi-waitbox');
  const dot = el('span', '', 'thi-pulse'); dot.setAttribute('aria-hidden', 'true');
  const p = el('p', 'Em đã vào phòng thi. Khi thầy cô bấm Mở, bài thi tự hiện — không cần bấm gì.');
  p.setAttribute('role', 'status');
  box.append(dot, p); w.append(box, backBtn('Chọn bài khác'));
}
const backBtn = (/** @type {string} */ text) => { const b = el('button', text, 'thi-back'); /** @type {HTMLButtonElement} */ (b).type = 'button'; b.addEventListener('click', () => { cur = { phase: 'list', id: '', qs: [] }; void presence('hoc'); draw(); }); return b; };

/* ---------- Làm bài ---------- */
/** @param {string} id */
async function startExam(id) {
  const b = bai[id]; if (!b || !root) return;
  cur = { phase: 'exam', id, qs: [] };
  if (!deCache[id]) {
    const w = page(b.tieu_de, 'Đang tải đề…'); w.append(el('p', 'Đang tải đề…', 'meta thi-loading'));
    try { const d = await store.get('thi_de/' + id); deCache[id] = (Array.isArray(d) ? d : Object.values(d || {})).filter(Boolean); }
    catch (e) { const w2 = page(b.tieu_de, ''); w2.append(el('p', (e instanceof Error ? e.message : 'Chưa tải được đề.'), 'thi-error'), backBtn('Về danh sách')); return; }
  }
  if (cur.id !== id || cur.phase !== 'exam') return;
  cur.qs = deCache[id];
  drawExam(); void presence('dang_thi');
}
function answers() {
  /** @type {Record<string,string>} */ const a = {};
  root?.querySelectorAll('.thi-form input[type=radio]:checked').forEach(n => { const i = /** @type {HTMLInputElement} */ (n); a[i.name] = i.value; });
  return a;
}
function drawExam() {
  const b = bai[cur.id]; if (!b || !me) return;
  const w = page(b.tieu_de, `${b.che_do === 'that' ? 'Thi thật · nộp một lần' : 'Thi thử · làm lại được'} · ${cur.qs.length} câu`);
  w.append(el('div', '', 'thi-lock'));
  const draft = readDraft(cur.id);
  const f = /** @type {HTMLFormElement} */ (el('form', '', 'thi-form')); f.noValidate = true;
  cur.qs.forEach((q, i) => {
    const fs = el('fieldset', '', 'question');
    const lg = el('legend', `Câu ${i + 1}. ${q.text}`); lg.append(el('span', ` (${q.points} điểm)`, 'thi-pts')); fs.append(lg);
    for (const [k, t] of Object.entries(q.options || {})) {
      const lab = el('label', '', 'option'); const inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.type = 'radio'; inp.name = q.id; inp.value = k; inp.checked = draft[q.id] === k;
      lab.append(inp, document.createTextNode(`${k}. ${t}`)); fs.append(lab);
    }
    f.append(fs);
  });
  const bar = el('div', '', 'thi-bar'); const count = el('span', '', 'meta thi-count'); count.setAttribute('aria-live', 'polite');
  const err = el('p', '', 'thi-error'); err.setAttribute('role', 'alert');
  const submit = /** @type {HTMLButtonElement} */ (el('button', 'Nộp bài', 'primary thi-submit')); submit.type = 'submit';
  const exit = /** @type {HTMLButtonElement} */ (el('button', 'Thoát', 'thi-back')); exit.type = 'button';
  exit.addEventListener('click', () => { cur = { phase: 'list', id: '', qs: [] }; void presence('hoc'); draw(); });
  const update = () => { const n = Object.keys(answers()).length; count.textContent = `Đã làm ${n}/${cur.qs.length} câu`; };
  f.addEventListener('change', () => { saveDraft(cur.id, answers()); update(); });
  f.addEventListener('submit', ev => { ev.preventDefault(); void doSubmit(submit, err); });
  bar.append(count, exit, submit); f.append(err, bar); w.append(f); update(); lockBanner();
}
function lockBanner() {
  const box = root?.querySelector('.thi-lock'); const b = bai[cur.id]; if (!box) return;
  box.textContent = b && b.trang_thai !== 'mo' ? 'Thầy cô đang tạm khóa bài thi. Bài làm vẫn được giữ trên máy, chờ mở lại rồi nộp.' : '';
}
/** @param {HTMLButtonElement} btn @param {HTMLElement} err */
async function doSubmit(btn, err) {
  const b = bai[cur.id]; if (!b || !me) return;
  const a = answers(), n = Object.keys(a).length, total = cur.qs.length;
  const ok = await confirmBox({ title: 'Nộp bài?', body: (n < total ? `Em mới làm ${n}/${total} câu. ` : `Em đã làm đủ ${total} câu. `) + (b.che_do === 'thu' ? 'Đây là thi thử, em làm lại được.' : 'Nộp rồi thì không làm lại được.'), okText: 'Nộp bài', cancelText: 'Làm tiếp' });
  if (!ok) return;
  let diem = 0, tong = 0, dung = 0;
  for (const q of cur.qs) { const pts = Number(q.points) || 1; tong += pts; if (a[q.id] && a[q.id].toUpperCase() === String(q.answer || '').toUpperCase()) { diem += pts; dung++; } }
  diem = Math.round(diem * 100) / 100; tong = Math.round(tong * 100) / 100;
  const rec = { ma: me.ma, ten: me.ten, lop: me.lop, diem, tong, dung, so_cau: total, tra_loi: a, at: store.SERVER_TIME };
  btn.disabled = true; btn.textContent = 'Đang nộp…'; err.textContent = '';
  try {
    await store.put(`thi_nop/${cur.id}/${store.keyOf(me.ma)}`, rec);
    clearDraft(cur.id); mine[cur.id] = { ...rec, at: Date.now() };
    cur = { phase: 'result', id: cur.id, qs: cur.qs, result: rec }; drawResult(); void presence('da_nop');
  } catch (e) {
    err.textContent = (e instanceof Error ? e.message : 'Chưa nộp được.') + ' Bài làm vẫn còn trên máy, bấm Nộp bài lần nữa.';
    btn.disabled = false; btn.textContent = 'Nộp bài';
  }
}

/* ---------- Kết quả ---------- */
function drawResult() {
  const b = bai[cur.id], r = cur.result || {};
  const w = page(b ? b.tieu_de : 'Bài thi', r.already ? 'Em đã nộp bài này rồi' : 'Đã nộp bài');
  const card = el('div', '', 'thi-result'); card.setAttribute('role', 'status');
  card.append(el('p', `${r.diem} / ${r.tong}`, 'thi-score'), el('p', `điểm · đúng ${r.dung}/${r.so_cau} câu`, 'meta'));
  w.append(card);
  const row = el('div', '', 'thi-actions');
  if (b && b.che_do === 'thu' && b.trang_thai === 'mo') { const again = el('button', 'Làm lại', 'primary'); /** @type {HTMLButtonElement} */ (again).type = 'button'; again.addEventListener('click', () => void startExam(cur.id)); row.append(again); }
  row.append(backBtn('Về danh sách bài thi')); w.append(row);
  /** @type {HTMLElement|null} */ (card).tabIndex = -1; card.focus?.();
}
