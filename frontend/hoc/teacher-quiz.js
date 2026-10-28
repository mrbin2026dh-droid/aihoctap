// @ts-check
// Menu "Tiện ích" → Trò chơi câu hỏi (giáo viên điều khiển, như Kahoot) chạy thẳng trên Firebase:
//  - Giáo viên tạo bộ câu hỏi (AI soạn theo bài / lấy từ đề thi thử / tự nhập), lưu trên máy.
//  - Trình chiếu: tạo phòng 6 số; học sinh lớp đó mở app là thấy trò chơi (quiz_lop/{lớp}).
//  - Mỗi câu: máy chiếu hiện câu + đồng hồ; học sinh chọn trên điện thoại; hết giờ → đáp án, biểu đồ, bảng xếp hạng.
//  - Đáp án CHỈ nằm trên máy giáo viên, đến lúc công bố mới gửi xuống. Điểm = đúng + nhanh (máy giáo viên tính).
//  - Kết thúc: bục vinh danh, thống kê từng câu, AI phân tích lớp có hiểu bài không (chỉ gửi số liệu, không gửi tên).
// Chỉ giáo viên có "khóa phòng" (quiz_key, không ai đọc được) mới điều khiển được phòng (luật Firebase quiz_proof).
import * as store from './thi-store.js';
import { api } from './api.js';
import * as ui from './teacher-ui.js?v=20261029a';
import { confirmBox } from './dom.js';
import { SHEET_API } from './sheet-config.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const inp = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const sel = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const L = ['A', 'B', 'C', 'D'];
/** @typedef {{text:string,opts:Record<string,string>,ans:string,topic?:string,ai?:boolean,explain?:string}} Q */
/** @typedef {{id:string,name:string,lop:string,lim:number,qs:Q[],at:number}} QSet */
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '', tok: sessionStorage.getItem('aisgk-pwa-teacher') || '' }; } catch { return { gv: '', gv_ma: '', tok: '' }; } };
const who = () => cred().gv_ma || 'admin';
const setsKey = () => `qz-sets-${who().toLowerCase()}`, histKey = () => `qz-hist-${who().toLowerCase()}`, liveKey = () => `qz-live-${who().toLowerCase()}`;
const readLS = (/** @type {string} */ k, /** @type {any} */ d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const writeLS = (/** @type {string} */ k, /** @type {any} */ v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } };
/** @param {string} msg @param {'error'|'success'|''} [kind] */
function status(msg, kind = '') { const b = $('qz-alert'); $('qz-status').textContent = msg; b.hidden = !msg; b.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success'); }

/** Điểm một câu: đúng được 500 + tối đa 500 theo tốc độ. Hàm thuần, có test. @param {boolean} ok @param {number} ms @param {number} limSec */
export const points = (ok, ms, limSec) => ok ? 500 + Math.round(500 * Math.max(0, 1 - Math.max(0, ms) / (limSec * 1000))) : 0;

/* ---------- Danh sách bộ câu hỏi ---------- */
/** @returns {QSet[]} */ const sets = () => readLS(setsKey(), []);
function renderSets() {
  const box = $('qz-sets'); box.replaceChildren();
  const list = sets().sort((a, b) => b.at - a.at);
  if (!list.length) { const li = document.createElement('li'); li.className = 't-muted'; li.textContent = 'Chưa có bộ câu hỏi. Bấm "Tạo bộ câu hỏi" — AI có thể soạn giúp theo bài học.'; box.append(li); }
  for (const s of list) {
    const li = document.createElement('li'); li.className = 't-card t-list-item qz-set';
    const info = document.createElement('div'); const h = document.createElement('h3'); h.textContent = s.name; const p = document.createElement('p'); p.className = 't-muted'; p.textContent = `Lớp ${s.lop} · ${s.qs.length} câu · ${s.lim} giây/câu`; info.append(h, p);
    const acts = document.createElement('div'); acts.className = 't-icon-actions';
    const play = document.createElement('button'); play.type = 'button'; play.className = 't-button t-primary qz-play'; play.textContent = 'Trình chiếu'; play.addEventListener('click', () => void startRoom(s));
    acts.append(play, ui.iconButton({ icon: 'edit', label: `Sửa: ${s.name}`, onClick: () => openEditor(s) }), ui.iconButton({ icon: 'trash', label: `Xóa: ${s.name}`, danger: true, onClick: () => void removeSet(s) }));
    li.append(info, acts); box.append(li);
  }
  const hb = $('qz-history'); hb.replaceChildren();
  const hist = /** @type {any[]} */ (readLS(histKey(), [])).slice(0, 8);
  if (!hist.length) { const li = document.createElement('li'); li.className = 't-muted'; li.textContent = 'Chưa có lần chơi nào.'; hb.append(li); }
  for (const h of hist) { const li = document.createElement('li'); const a = document.createElement('strong'); a.textContent = `${h.name} · Lớp ${h.lop}`; const b = document.createElement('span'); b.textContent = `${new Date(h.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${h.players} em · đúng TB ${h.avg}%${h.muc ? ' · ' + h.muc : ''}`; li.append(a, b); hb.append(li); }
}
/** @param {QSet} s */
async function removeSet(s) {
  if (!(await confirmBox({ title: 'Xóa bộ câu hỏi?', body: `"${s.name}" (${s.qs.length} câu) sẽ bị xóa khỏi máy này.`, okText: 'Xóa bộ câu hỏi', danger: true }))) return;
  writeLS(setsKey(), sets().filter(x => x.id !== s.id)); renderSets(); status(`Đã xóa "${s.name}".`, 'success');
}

/* ---------- Soạn bộ câu hỏi ---------- */
/** @type {QSet|null} */ let editing = null;
/** Lớp giáo viên được dùng: giáo viên lớp = lớp phụ trách; quản trị = mọi lớp có học sinh. */
async function classes() {
  try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); if (t && Array.isArray(t.lop) && cred().gv_ma) return t.lop.map(String); } catch { /* bỏ qua */ }
  const hs = await store.get('thi_hs').catch(() => undefined);
  if (hs === undefined) return null;   // tải lỗi ≠ chưa có học sinh
  return [...new Set(Object.values(hs || {}).map((/** @type {any} */ s) => String(s?.lop || '')).filter(Boolean))].sort();
}
/** @param {Partial<Q>} [q] */
function qRow(q = {}) {
  const fs = document.createElement('fieldset'); fs.className = 'thi-qe qz-q' + (q.ai ? ' is-ai' : '');
  const lg = document.createElement('legend'); fs.append(lg);
  const uid = Math.random().toString(36).slice(2, 8);
  const field = (/** @type {string} */ label, /** @type {HTMLElement} */ ctl, cls = '') => { const w = document.createElement('div'); w.className = 't-field ' + cls; const l = document.createElement('label'); l.textContent = label; ctl.id = `qz-${uid}-${cls || label.length}`; l.htmlFor = ctl.id; w.append(l, ctl); return w; };
  const text = document.createElement('textarea'); text.className = 'qz-text'; text.maxLength = 300; text.rows = 2; text.value = q.text || '';
  fs.append(field('Câu hỏi', text, 'f-text'));
  const opts = document.createElement('div'); opts.className = 'thi-qe-opts';
  for (const k of L) { const i = document.createElement('input'); i.className = 'qz-opt'; i.dataset.k = k; i.maxLength = 120; i.value = q.opts?.[k] || ''; opts.append(field('Phương án ' + k, i, 'f-' + k)); }
  fs.append(opts);
  const foot = document.createElement('div'); foot.className = 'thi-qe-foot';
  const ans = document.createElement('select'); ans.className = 'qz-ans'; for (const k of L) ans.append(new Option(k, k)); ans.value = q.ans || 'A';
  const topic = document.createElement('input'); topic.className = 'qz-topic'; topic.maxLength = 60; topic.value = q.topic || ''; topic.placeholder = 'Ví dụ: Mã nhị phân';
  const del = ui.iconButton({ icon: 'trash', label: 'Xóa câu này', danger: true, onClick: () => { fs.remove(); qNumber(); } });
  foot.append(field('Đáp án đúng', ans, 'f-ans'), field('Chủ đề', topic, 'f-topic'), del); fs.append(foot);
  if (q.ai) {
    const tag = document.createElement('span'); tag.className = 'thi-qe-ai-tag'; tag.textContent = 'AI soạn — cần duyệt'; lg.after(tag);
    if (q.explain) { const ex = document.createElement('p'); ex.className = 't-hint thi-qe-explain'; ex.textContent = 'Giải thích của AI: ' + q.explain; fs.append(ex); }
    const okLab = document.createElement('label'); okLab.className = 'thi-qe-ok'; const ok = document.createElement('input'); ok.type = 'checkbox'; ok.className = 'qz-ok';
    ok.addEventListener('change', () => fs.classList.toggle('is-approved', ok.checked)); okLab.append(ok, document.createTextNode(' Đã duyệt câu này')); fs.append(okLab);
  }
  return fs;
}
function qNumber() { $('qz-list').querySelectorAll('.qz-q').forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Câu ${i + 1}`; }); }
/** @param {QSet|null} s */
async function openEditor(s) {
  editing = s; $('qz-ed-title').textContent = s ? 'Sửa bộ câu hỏi' : 'Tạo bộ câu hỏi';
  inp('qz-name').value = s?.name || ''; sel('qz-lim').value = String(s?.lim || 20);
  for (const id of ['qz-name', 'qz-lop']) { $(id).removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; }
  $('qz-form-err').textContent = ''; $('qz-ai-box').hidden = true; $('qz-exam-box').hidden = true;
  $('qz-list').replaceChildren(...(s?.qs?.length ? s.qs : [{}]).map(q => qRow(q))); qNumber();
  await ui.showSub('detail-tools');
  const lops = await classes(), ls = sel('qz-lop');
  ls.replaceChildren(...(lops === null ? [new Option('Chưa tải được danh sách lớp. Kiểm tra mạng, bấm Quay lại rồi mở lại.', '')] : lops.length ? lops.map(l => new Option('Lớp ' + l, l)) : [new Option('Chưa có lớp (thêm học sinh trước)', '')]));
  if (s?.lop && lops?.includes(s.lop)) ls.value = s.lop;
  inp('qz-name').focus();
}
/** @returns {{error?:string, qs?:Q[]}} */
function collect() {
  const out = []; let i = 0;
  for (const f of $('qz-list').querySelectorAll('.qz-q')) {
    i++; f.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    const t = /** @type {HTMLTextAreaElement} */ (f.querySelector('.qz-text')), text = t.value.trim();
    /** @type {Record<string,string>} */ const opts = {}; f.querySelectorAll('.qz-opt').forEach(n => { const v = /** @type {HTMLInputElement} */ (n).value.trim(); if (v) opts[/** @type {HTMLElement} */ (n).dataset.k || ''] = v; });
    const a = /** @type {HTMLSelectElement} */ (f.querySelector('.qz-ans')), ok = /** @type {HTMLInputElement|null} */ (f.querySelector('.qz-ok'));
    if (!text) { t.setAttribute('aria-invalid', 'true'); t.focus(); return { error: `Câu ${i}: nhập câu hỏi.` }; }
    if (Object.keys(opts).length < 2) { /** @type {HTMLElement} */ (f.querySelector('.qz-opt')).setAttribute('aria-invalid', 'true'); return { error: `Câu ${i}: cần ít nhất 2 phương án.` }; }
    if (!opts[a.value]) { a.setAttribute('aria-invalid', 'true'); a.focus(); return { error: `Câu ${i}: đáp án đúng ${a.value} chưa có nội dung.` }; }
    if (ok && !ok.checked) { ok.setAttribute('aria-invalid', 'true'); ok.focus(); return { error: `Câu ${i} do AI soạn: đọc kỹ rồi đánh dấu "Đã duyệt".` }; }
    out.push({ text, opts, ans: a.value, topic: /** @type {HTMLInputElement} */ (f.querySelector('.qz-topic')).value.trim() });
  }
  if (!out.length) return { error: 'Thêm ít nhất một câu hỏi.' };
  if (out.length > 50) return { error: 'Tối đa 50 câu mỗi bộ.' };
  return { qs: out };
}
$('qz-new').addEventListener('click', () => void openEditor(null));
$('qz-add').addEventListener('click', () => { const r = qRow(); $('qz-list').append(r); qNumber(); /** @type {HTMLElement} */ (r.querySelector('.qz-text')).focus(); });
$('qz-form').addEventListener('submit', ev => {
  ev.preventDefault(); $('qz-form-err').textContent = '';
  const name = inp('qz-name'), lop = sel('qz-lop');
  for (const n of [name, lop]) { n.removeAttribute('aria-invalid'); $(n.id + '-err').textContent = ''; }
  if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); $('qz-name-err').textContent = 'Nhập tên bộ câu hỏi.'; name.focus(); return; }
  if (!lop.value) { lop.setAttribute('aria-invalid', 'true'); $('qz-lop-err').textContent = 'Chọn lớp chơi.'; lop.focus(); return; }
  const r = collect(); if (r.error) { $('qz-form-err').textContent = r.error; return; }
  /** @type {QSet} */ const s = { id: editing?.id || 'qz' + Date.now().toString(36), name: name.value.trim(), lop: lop.value, lim: Number(sel('qz-lim').value) || 20, qs: /** @type {Q[]} */ (r.qs), at: Date.now() };
  writeLS(setsKey(), [s, ...sets().filter(x => x.id !== s.id)]);
  renderSets(); void ui.goBack(); status(`Đã lưu "${s.name}" (${s.qs.length} câu). Bấm Trình chiếu để chơi.`, 'success');
});
/* AI soạn câu hỏi theo bài (dùng chung endpoint AI soạn đề) */
/** @type {{key:string,title:string,grade:number,course_id:string,lesson_id:string}[]} */ let lessons = [];
$('qz-ai').addEventListener('click', async () => {
  $('qz-exam-box').hidden = true; const box = $('qz-ai-box'); box.hidden = !box.hidden; if (box.hidden) return;
  $('qz-ai-err').textContent = '';
  if (!lessons.length) { try { const cat = await api('/pwa/catalog'); for (const c of cat?.courses || []) for (const l of c.lessons || []) lessons.push({ key: c.id + '|' + l.id, title: l.title, grade: Number(c.grade) || 0, course_id: c.id, lesson_id: l.id }); } catch { $('qz-ai-err').textContent = 'Chưa tải được danh sách bài học.'; } }
  const g = Number(String(sel('qz-lop').value).match(/^\d+/)?.[0]) || 0, list = lessons.filter(l => !g || l.grade === g);
  sel('qz-ai-lesson').replaceChildren(...list.map(l => new Option(`${l.title} · Lớp ${l.grade}`, l.key)));
});
$('qz-ai-go').addEventListener('click', async () => {
  const l = lessons.find(x => x.key === sel('qz-ai-lesson').value); $('qz-ai-err').textContent = '';
  if (!l) { $('qz-ai-err').textContent = 'Chọn bài học.'; return; }
  const n = Number(sel('qz-ai-n').value) || 8, btn = /** @type {HTMLButtonElement} */ ($('qz-ai-go')), label = btn.textContent;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'AI đang soạn… (10–30 giây)';
  try {
    const c = cred(), b = Math.ceil(n * 0.4), h = Math.ceil(n * 0.4);
    const r = await api('/teacher/ai-questions', { method: 'POST', token: c.tok || undefined, timeout: 90000, body: { course_id: l.course_id, lesson_id: l.lesson_id, topic: inp('qz-ai-topic').value.trim(), counts: { 'Biết': b, 'Hiểu': h, 'Vận dụng': Math.max(0, n - b - h) }, ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
    const qs = (r?.questions || []).map((/** @type {any} */ q) => ({ text: q.text, opts: q.options, ans: q.answer, topic: q.topic, ai: true, explain: q.explain }));
    if (!qs.length) throw new Error('AI chưa soạn được câu nào. Thử lại.');
    const list = $('qz-list'); for (const f of [...list.querySelectorAll('.qz-q')]) if (!/** @type {HTMLTextAreaElement} */ (f.querySelector('.qz-text')).value.trim()) f.remove();
    for (const q of qs) list.append(qRow(q)); qNumber(); $('qz-ai-box').hidden = true;
    if (!inp('qz-name').value.trim()) inp('qz-name').value = 'Ôn nhanh: ' + l.title;
  } catch (e) { $('qz-ai-err').textContent = e instanceof Error ? e.message : 'AI chưa soạn được.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
});
/* Lấy câu từ đề thi thử đã có (Google Sheet) */
/** @param {Record<string, unknown>} body */
async function sheet(body) {
  const c = cred(); if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet.');
  const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ gv: c.gv, ...(c.gv_ma ? { gv_ma: c.gv_ma } : {}), ...body }) });
  const d = await res.json(); if (!d?.ok) throw new Error(d?.error || 'Google Sheet chưa trả lời.'); return d;
}
$('qz-from-exam').addEventListener('click', async () => {
  $('qz-ai-box').hidden = true; const box = $('qz-exam-box'); box.hidden = !box.hidden; if (box.hidden) return;
  $('qz-exam-err').textContent = ''; sel('qz-exam').replaceChildren(new Option('Đang tải…', ''));
  try { const d = await sheet({ action: 'gv_list' }); const ex = (d.exams || []).filter((/** @type {any} */ e) => e.che_do === 'thu'); sel('qz-exam').replaceChildren(...(ex.length ? ex.map((/** @type {any} */ e) => new Option(`${e.tieu_de} (${e.questions} câu)`, e.ma_de)) : [new Option('Chưa có đề thi thử', '')])); }
  catch (e) { $('qz-exam-err').textContent = e instanceof Error ? e.message : 'Chưa tải được.'; }
});
$('qz-exam-go').addEventListener('click', async () => {
  const id = sel('qz-exam').value; if (!id) return; $('qz-exam-err').textContent = '';
  try {
    const d = await sheet({ action: 'gv_questions', ma_de: id });
    const list = $('qz-list'); for (const f of [...list.querySelectorAll('.qz-q')]) if (!/** @type {HTMLTextAreaElement} */ (f.querySelector('.qz-text')).value.trim()) f.remove();
    for (const q of d.questions || []) list.append(qRow({ text: q.text, opts: q.options, ans: q.answer, topic: q.topic })); qNumber(); $('qz-exam-box').hidden = true;
  } catch (e) { $('qz-exam-err').textContent = e instanceof Error ? e.message : 'Chưa lấy được câu hỏi.'; }
});

/* ---------- Trình chiếu (phòng chơi) ---------- */
/** @type {null|{room:string,key:string,set:QSet,i:number,phase:string,players:Record<string,{ten:string}>,score:Record<string,{p:number,c:number,ten:string}>,stats:any[],lopKey:string,stops:(()=>void)[],ansStop?:()=>void,answers:Record<string,any>,timer:number,qAt:number,muc?:string}} */ let room = null;
const host = $('qz-host'), main = $('qz-h-main'), foot = $('qz-h-foot');
const rnd = (/** @type {number} */ n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
/** Ghi trạng thái phòng kèm bằng chứng khóa (luật Firebase chỉ cho chủ phòng). @param {Record<string, unknown>} paths */
// Bằng chứng MỚI cho mỗi lần ghi (khóa|số đếm): luật yêu cầu bằng chứng đổi trong chính lần ghi đó, nên ai chỉ ghi trạng thái mà không biết khóa sẽ bị chặn.
let proofN = 0;
const write = paths => { if (!room) return Promise.resolve(); return store.patch('', { ...paths, [`quiz_proof/${room.room}`]: `${room.key}|${Date.now().toString(36)}${(++proofN).toString(36)}` }); };
function el(/** @type {string} */ tag, /** @type {string} */ cls = '', /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
function btn(/** @type {string} */ text, /** @type {string} */ cls, /** @type {() => void} */ fn) { const b = /** @type {HTMLButtonElement} */ (el('button', 't-button ' + cls, text)); b.type = 'button'; b.addEventListener('click', fn); return b; }
const ranked = () => room ? Object.entries(room.score).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.p - a.p || b.c - a.c || a.ten.localeCompare(b.ten, 'vi')) : [];

/** @param {QSet} s */
async function startRoom(s) {
  if (!store.enabled()) { status('Chưa cài dự án Firebase (presence-config.js).', 'error'); return; }
  if (room) { openHost(); return; }
  const key = [...rnd(24)].map(b => b.toString(16).padStart(2, '0')).join('');
  let code = '';
  for (let t = 0; t < 6 && !code; t++) {
    const c = String(100000 + ([...rnd(4)].reduce((a, b) => a * 256 + b, 0) % 900000));
    try { await store.put(`quiz_key/${c}`, key); code = c; } catch { /* trùng mã → thử mã khác */ }
  }
  if (!code) { status('Chưa tạo được phòng chơi. Kiểm tra mạng rồi thử lại.', 'error'); return; }
  room = { room: code, key, set: s, i: -1, phase: 'lobby', players: {}, score: {}, stats: [], lopKey: store.keyOf(s.lop), stops: [], answers: {}, timer: 0, qAt: 0 };
  try {
    await write({ [`quiz/${code}/pub`]: { phase: 'lobby', title: s.name, lop: s.lop, n: s.qs.length, at: store.SERVER_TIME }, [`quiz_lop/${room.lopKey}`]: code });
  } catch (e) { status('Chưa mở được phòng: ' + (e instanceof Error ? e.message : ''), 'error'); room = null; return; }
  writeLS(liveKey(), { room: code, key, setId: s.id });
  room.stops.push(store.listen(`quiz/${code}/ds`, d => { if (!room) return; room.players = d || {}; for (const [k, v] of Object.entries(room.players)) if (!room.score[k]) room.score[k] = { p: 0, c: 0, ten: String(/** @type {any} */ (v)?.ten || k) }; if (room.phase === 'lobby') drawLobby(); }));
  openHost(); drawLobby();
}
function openHost() { host.hidden = false; document.body.classList.add('qz-hosting'); $('qz-h-close').focus(); }
function drawLobby() {
  if (!room) return;
  $('qz-h-kicker').textContent = `Lớp ${room.set.lop} · ${room.set.qs.length} câu · ${room.set.lim} giây/câu`; $('qz-h-title').textContent = room.set.name;
  const n = Object.keys(room.players).length;
  const code = el('div', 'qz-code'); code.append(el('span', '', 'Mã phòng'), el('strong', '', room.room.replace(/(\d{3})(\d{3})/, '$1 $2')));
  const hint = el('p', 'qz-hint', `Học sinh lớp ${room.set.lop} mở ứng dụng AI Học Tập → thấy "Trò chơi câu hỏi" → bấm Vào chơi.`);
  const chips = el('ul', 'qz-chips'); for (const v of Object.values(room.players)) chips.append(el('li', '', String(/** @type {any} */ (v)?.ten || '')));
  main.replaceChildren(code, hint, el('p', 'qz-count', `${n} học sinh đã vào`), chips);
  const go = btn('Bắt đầu', 't-primary qz-big', () => void nextQ()); go.disabled = !n; go.id = 'qz-start';
  foot.replaceChildren(go);
}
async function nextQ() {
  if (!room) return;
  room.i++; if (room.i >= room.set.qs.length) { await endGame(); return; }
  const q = room.set.qs[room.i], k = 'q' + room.i;
  room.phase = 'q'; room.answers = {};
  /** @type {Record<string,string>} */ const opts = {}; for (const x of L) if (q.opts[x]) opts[x] = q.opts[x];
  await write({ [`quiz/${room.room}/pub/phase`]: 'q', [`quiz/${room.room}/pub/q`]: { k, i: room.i, text: q.text, opts, lim: room.set.lim, at: store.SERVER_TIME }, [`quiz/${room.room}/pub/reveal`]: null, [`quiz/${room.room}/pub/at`]: store.SERVER_TIME });
  const pub = await store.get(`quiz/${room.room}/pub/q/at`).catch(() => null); room.qAt = Number(pub) || Date.now();
  room.ansStop?.(); room.ansStop = store.listen(`quiz/${room.room}/ans/${k}`, d => { if (!room || room.phase !== 'q' || room.i !== Number(k.slice(1))) return; room.answers = d || {}; drawQ(); if (Object.keys(room.answers).length >= Object.keys(room.players).length && Object.keys(room.players).length) void reveal(); });
  const end = Date.now() + room.set.lim * 1000; clearInterval(room.timer);
  room.timer = window.setInterval(() => { const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); const t = main.querySelector('.qz-timer'); if (t) t.textContent = String(left); if (left <= 0) void reveal(); }, 250);
  drawQ();
}
function drawQ() {
  if (!room) return;
  const q = room.set.qs[room.i];
  $('qz-h-kicker').textContent = `Câu ${room.i + 1}/${room.set.qs.length}${q.topic ? ' · ' + q.topic : ''}`;
  if (!main.querySelector('.qz-qtext') || main.dataset.i !== String(room.i)) {
    main.dataset.i = String(room.i);
    const top = el('div', 'qz-qtop'); top.append(el('p', 'qz-qtext', q.text), el('span', 'qz-timer', String(room.set.lim)));
    const grid = el('ul', 'qz-opts'); for (const x of L) if (q.opts[x]) { const li = el('li', 'qz-opt qz-' + x); li.append(el('b', '', x), el('span', '', q.opts[x])); grid.append(li); }
    main.replaceChildren(top, grid, el('p', 'qz-count qz-answered', ''));
    foot.replaceChildren(btn('Hiện đáp án', 'qz-big', () => void reveal()));
  }
  /** @type {HTMLElement} */ (main.querySelector('.qz-answered')).textContent = `${Object.keys(room.answers).length}/${Object.keys(room.players).length} em đã trả lời`;
}
async function reveal() {
  if (!room || room.phase !== 'q') return;
  room.phase = 'reveal'; clearInterval(room.timer);
  const q = room.set.qs[room.i], k = 'q' + room.i, ans = await store.get(`quiz/${room.room}/ans/${k}`).catch(() => null) || room.answers || {};
  /** @type {Record<string, number>} */ const counts = { A: 0, B: 0, C: 0, D: 0, none: 0 };
  for (const [m, v] of Object.entries(ans)) {
    const a = String(/** @type {any} */ (v)?.a || ''), ok = a === q.ans, ms = Number(/** @type {any} */ (v)?.t) - room.qAt;
    if (counts[a] !== undefined) counts[a]++;
    const sc = room.score[m] || (room.score[m] = { p: 0, c: 0, ten: String(room.players[m]?.ten || m) });
    sc.p += points(ok, ms, room.set.lim); if (ok) sc.c++;
  }
  counts.none = Math.max(0, Object.keys(room.players).length - Object.keys(ans).length);
  const total = Object.keys(room.players).length || 1;
  room.stats[room.i] = { text: q.text, opts: q.opts, ans: q.ans, topic: q.topic || '', counts, pct: Math.round(100 * counts[q.ans] / total), wrong: Object.entries(ans).filter(([, v]) => /** @type {any} */ (v)?.a !== q.ans).map(([m]) => m) };
  const rk = ranked();
  /** @type {Record<string, any>} */ const kq = {}; rk.forEach((r, i) => { kq[r.k] = { p: r.p, c: r.c, r: i + 1, n: rk.length }; });
  await write({ [`quiz/${room.room}/pub/phase`]: 'reveal', [`quiz/${room.room}/pub/reveal`]: { k, ans: q.ans, counts }, [`quiz/${room.room}/pub/top`]: rk.slice(0, 5).map(r => ({ ten: r.ten, p: r.p })), [`quiz/${room.room}/kq`]: kq }).catch(() => {});
  drawReveal(counts);
}
/** @param {Record<string, number>} counts */
function drawReveal(counts) {
  if (!room) return;
  const q = room.set.qs[room.i], max = Math.max(1, ...L.map(x => counts[x] || 0));
  const grid = el('ul', 'qz-opts is-reveal');
  for (const x of L) if (q.opts[x]) {
    const li = el('li', 'qz-opt qz-' + x + (x === q.ans ? ' is-ans' : ' is-dim')); li.append(el('b', '', x), el('span', '', q.opts[x]));
    const bar = el('span', 'qz-bar'); bar.style.setProperty('--pct', Math.round(100 * (counts[x] || 0) / max) + '%'); const n = el('em', 'qz-n', String(counts[x] || 0)); li.append(bar, n); grid.append(li);
  }
  const top = el('ol', 'qz-top'); for (const r of ranked().slice(0, 5)) { const li = el('li'); li.append(el('span', '', r.ten), el('strong', '', String(r.p))); top.append(li); }
  const s = room.stats[room.i];
  main.replaceChildren(el('p', 'qz-qtext', q.text), grid, el('p', 'qz-count', `Đúng ${s.pct}% · đáp án ${q.ans}${counts.none ? ` · ${counts.none} em chưa trả lời` : ''}`), el('h3', 'qz-sub', 'Bảng xếp hạng'), top);
  foot.replaceChildren(btn(room.i + 1 >= room.set.qs.length ? 'Xem kết quả' : 'Câu tiếp theo', 't-primary qz-big', () => void nextQ()));
}
async function endGame() {
  if (!room) return;
  room.phase = 'end'; clearInterval(room.timer);
  await write({ [`quiz/${room.room}/pub/phase`]: 'end', [`quiz/${room.room}/pub/q`]: null, [`quiz_lop/${room.lopKey}`]: null }).catch(() => {});
  const rk = ranked(), players = rk.length, avg = room.stats.length ? Math.round(room.stats.reduce((a, s) => a + s.pct, 0) / room.stats.length) : 0;
  const hist = /** @type {any[]} */ (readLS(histKey(), [])); hist.unshift({ name: room.set.name, lop: room.set.lop, at: Date.now(), players, avg }); writeLS(histKey(), hist.slice(0, 20));
  $('qz-h-kicker').textContent = `Kết thúc · ${players} em · đúng trung bình ${avg}%`;
  const pod = el('ol', 'qz-podium'); rk.slice(0, 3).forEach((r, i) => { const li = el('li', 'qz-pod qz-pod-' + (i + 1)); li.append(el('b', '', String(i + 1)), el('span', '', r.ten), el('strong', '', r.p + ' điểm')); pod.append(li); });
  const table = el('table', 't-table qz-stat'); const th = el('thead'); const tr0 = el('tr'); for (const h of ['Câu', 'Chủ đề', 'Đúng', 'Phương án sai chọn nhiều nhất']) tr0.append(el('th', '', h)); th.append(tr0); table.append(th);
  const tb = el('tbody');
  room.stats.forEach((s, i) => {
    const wrong = L.filter(x => x !== s.ans && s.counts[x]).sort((a, b) => s.counts[b] - s.counts[a])[0];
    const tr = el('tr', s.pct < 50 ? 'is-weak' : ''); for (const [lab, v] of [['Câu', `${i + 1}. ${s.text}`], ['Chủ đề', s.topic || '—'], ['Đúng', s.pct + '%'], ['Phương án sai chọn nhiều nhất', wrong ? `${wrong}. ${s.opts[wrong]} (${s.counts[wrong]} em)` : '—']]) { const td = el('td', '', v); td.dataset.label = lab; tr.append(td); } tb.append(tr);
  });
  table.append(tb);
  const low = rk.filter(r => room && r.c < Math.ceil(room.stats.length / 2)).map(r => r.ten);
  const help = el('p', 'qz-count', low.length ? `Cần hỗ trợ thêm (đúng dưới một nửa): ${low.join(', ')}` : 'Mọi em đều đúng từ một nửa số câu trở lên.');
  const aiBox = el('section', 'qz-ai-out'); aiBox.id = 'qz-ai-out';
  main.replaceChildren(pod, el('h3', 'qz-sub', 'Lớp có hiểu bài không?'), table, help, aiBox);
  const aiBtn = btn('AI phân tích lớp hiểu bài', 't-primary thi-ai-btn qz-big', () => void analyze(aiBtn)); aiBtn.id = 'qz-ai-analyze';
  foot.replaceChildren(aiBtn, btn('Tải kết quả CSV', '', exportCsv));
}
/** @param {HTMLButtonElement} b */
async function analyze(b) {
  if (!room) return; const out = $('qz-ai-out'), label = b.textContent; b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'AI đang phân tích…';
  try {
    const c = cred(), rk = ranked();
    const r = await api('/teacher/ai-quiz', { method: 'POST', token: c.tok || undefined, timeout: 60000, body: { title: room.set.name, players: rk.length, avg_pct: room.stats.length ? Math.round(room.stats.reduce((a, s) => a + s.pct, 0) / room.stats.length) : 0, questions: room.stats.map(s => ({ text: s.text, opts: s.opts, ans: s.ans, topic: s.topic, pct: s.pct, counts: s.counts })), ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
    out.replaceChildren(); if (r.muc_hieu) out.append(el('p', 'qz-muc', 'Mức hiểu: ' + r.muc_hieu));
    for (const line of String(r.nhan_xet || '').split(/\n+/)) { const p = el('p'); for (const [i, part] of line.split(/\*\*/).entries()) p.append(i % 2 ? el('strong', '', part) : document.createTextNode(part)); out.append(p); }
    room.muc = r.muc_hieu; const hist = /** @type {any[]} */ (readLS(histKey(), [])); if (hist[0]) { hist[0].muc = r.muc_hieu; writeLS(histKey(), hist); }
  } catch (e) { out.replaceChildren(el('p', 'notice error', e instanceof Error ? e.message : 'AI chưa phân tích được.')); }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = label; }
}
const csvCell = (/** @type {unknown} */ v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function exportCsv() {
  if (!room) return; const rk = ranked();
  const lines = [['Hạng', 'Học sinh', 'Điểm', 'Số câu đúng', 'Tổng câu'], ...rk.map((r, i) => [i + 1, r.ten, r.p, r.c, room?.stats.length])].map(r => r.map(csvCell).join(','));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `tro-choi-${room.set.lop}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function closeRoom() {
  if (!room) { host.hidden = true; return; }
  if (room.phase !== 'end' && !(await confirmBox({ title: 'Đóng phòng chơi?', body: 'Trò chơi đang diễn ra sẽ kết thúc, học sinh không chơi tiếp được.', okText: 'Đóng phòng', danger: true }))) return;
  if (room.phase !== 'end') await write({ [`quiz/${room.room}/pub/phase`]: 'end', [`quiz_lop/${room.lopKey}`]: null }).catch(() => {});
  clearInterval(room.timer); room.ansStop?.(); room.stops.forEach(f => f()); room = null;
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
  host.hidden = true; document.body.classList.remove('qz-hosting'); renderSets(); /** @type {HTMLElement|null} */ (document.querySelector('.qz-play'))?.focus();
}
$('qz-h-close').addEventListener('click', () => void closeRoom());
$('nav-tools').addEventListener('click', () => { renderSets(); status(''); });
document.getElementById('teacher-logout')?.addEventListener('click', () => { if (room) { room.stops.forEach(f => f()); clearInterval(room.timer); room = null; host.hidden = true; } });
