// @ts-check
// Tiện ích → Luyện tập trên lớp (kiểu Kahoot / Quizizz), chạy thẳng trên Firebase:
//  1. Giáo viên tạo bộ câu hỏi: AI soạn theo bài, tải file Excel, lấy từ đề thi thử hoặc tự nhập; chọn một hoặc nhiều lớp; lưu lại.
//     Bộ câu hỏi lưu trên máy và đồng bộ lên Firebase (quiz_bo/{mã riêng của giáo viên}) để mở ở máy khác (máy chiếu ở lớp).
//  2. Đến tiết: Mở luyện tập → phòng chờ (mã 6 số, học sinh các lớp đã chọn thấy ngay ở mục Luyện tập) → xem ai đã vào → Bắt đầu.
//  3. Mỗi câu: máy chiếu hiện câu + đồng hồ; học sinh chọn trên điện thoại; hết giờ / cả lớp đã trả lời → đáp án, biểu đồ, xếp hạng.
//     Giáo viên có thể Tạm dừng / Tiếp tục, Hiện đáp án sớm, Kết thúc bất cứ lúc nào.
//  4. Kết thúc: bục vinh danh, danh hiệu, bảng xếp hạng đầy đủ, thống kê từng câu, AI phân tích lớp hiểu bài (không gửi tên), tải CSV.
// Đáp án CHỈ nằm trên máy giáo viên đến lúc công bố. Điểm do máy giáo viên tính theo công thức Kahoot (quiz-core.js).
// Chỉ máy có "khóa phòng" (quiz_key, không ai đọc được) mới ghi được trạng thái phòng (luật Firebase quiz_proof).
import * as store from './thi-store.js';
import { api } from './api.js';
import * as ui from './teacher-ui.js?v=20261030b';
import { confirmBox } from './dom.js';
import { SHEET_API } from './sheet-config.js';
import { L, MAX_Q, QUIZ_COLUMNS, awards, blankScore, classSummary, parseQuizRows, ranked as rankScore, scoreQuestion, setClasses } from './quiz-core.js';
import * as fx from './quiz-fx.js';
import { HB_MS, STALE_MS } from './live-room.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const inp = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const sel = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const SHAPE = /** @type {Record<string,string>} */ ({ A: '▲', B: '◆', C: '●', D: '■' });
/** @typedef {{text:string,opts:Record<string,string>,ans:string,topic?:string,ai?:boolean,explain?:string}} Q */
/** @typedef {{id:string,name:string,lops:string[],lop?:string,lim:number,read?:number,qs:Q[],at:number}} QSet */
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '', tok: sessionStorage.getItem('aisgk-pwa-teacher') || '' }; } catch { return { gv: '', gv_ma: '', tok: '' }; } };
const who = () => cred().gv_ma || 'admin';
const setsKey = () => `qz-sets-${who().toLowerCase()}`, histKey = () => `qz-hist-${who().toLowerCase()}`, liveKey = () => `qz-live-${who().toLowerCase()}`;
const readLS = (/** @type {string} */ k, /** @type {any} */ d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const writeLS = (/** @type {string} */ k, /** @type {any} */ v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } };
/** @param {string} msg @param {'error'|'success'|''} [kind] */
function status(msg, kind = '') { const b = $('qz-alert'); $('qz-status').textContent = msg; b.hidden = !msg; b.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success'); }
function el(/** @type {string} */ tag, /** @type {string} */ cls = '', /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
function btn(/** @type {string} */ text, /** @type {string} */ cls, /** @type {() => void} */ fn) { const b = /** @type {HTMLButtonElement} */ (el('button', 't-button ' + cls, text)); b.type = 'button'; b.addEventListener('click', fn); return b; }

/* ---------- Lưu bộ câu hỏi: trên máy + đồng bộ Firebase ---------- */
/** Mã riêng của giáo viên (băm từ mã + mật khẩu): đường dẫn bí mật, không ai đoán được, không liệt kê được. */
const ownerKey = () => { const c = cred(); const secret = c.gv || c.tok; return secret ? store.sha256(`luyen-tap|${who().toLowerCase()}|${secret}`) : ''; };
/** @param {any} s @returns {QSet} */
const normSet = s => ({ id: String(s.id), name: String(s.name || ''), lops: setClasses(s), lim: Number(s.lim) || 20, read: s.read === undefined ? 3 : Math.max(0, Math.min(8, Number(s.read) || 0)), qs: Array.isArray(s.qs) ? s.qs : Object.values(s.qs || {}), at: Number(s.at) || 0 });
/** @returns {QSet[]} */ const sets = () => /** @type {any[]} */ (readLS(setsKey(), [])).map(normSet);
let synced = false;
async function syncSets() {
  const owner = ownerKey(); if (!owner || !store.enabled()) return;
  try {
    const remote = await store.get(`quiz_bo/${owner}`);
    /** @type {Record<string, QSet>} */ const byId = {}; for (const s of sets()) byId[s.id] = s;
    for (const [id, s] of Object.entries(remote || {})) { if (!s) continue; const r = normSet({ ...s, id }); if (!byId[id] || r.at > byId[id].at) byId[id] = r; }
    const merged = Object.values(byId);
    writeLS(setsKey(), merged);
    for (const s of merged) if (!remote?.[s.id] || Number(remote[s.id].at) < s.at) void store.put(`quiz_bo/${owner}/${s.id}`, pack(s)).catch(() => {});
    synced = true;
  } catch { synced = false; }
}
/** @param {QSet} s */ const pack = s => ({ name: s.name, lops: s.lops, lim: s.lim, read: s.read ?? 3, qs: s.qs.map(q => ({ text: q.text, opts: q.opts, ans: q.ans, topic: q.topic || '' })), at: s.at });
/** @param {QSet} s */
async function saveSet(s) {
  writeLS(setsKey(), [s, ...sets().filter(x => x.id !== s.id)]);
  const owner = ownerKey(); if (!owner) return false;
  try { await store.put(`quiz_bo/${owner}/${s.id}`, pack(s)); return true; } catch { return false; }
}

/* ---------- Danh sách bộ câu hỏi ---------- */
function renderSets() {
  const box = $('qz-sets'); box.replaceChildren();
  const list = sets().sort((a, b) => b.at - a.at);
  if (!list.length) { const li = el('li', 't-card qz-empty'); li.append(el('h3', '', 'Chưa có bộ câu hỏi'), el('p', 't-muted', 'Bấm "Tạo bộ câu hỏi": AI soạn theo bài, tải file Excel hoặc tự nhập.')); box.append(li); }
  for (const s of list) {
    const li = el('li', 't-card qz-set');
    const info = el('div', 'qz-set-info'); info.append(el('h3', '', s.name));
    const meta = el('p', 'qz-set-meta'); meta.append(el('span', '', `${s.qs.length} câu`), el('span', '', `${s.lim} giây/câu`));
    const chips = el('ul', 'qz-lop-chips'); for (const l of s.lops) chips.append(el('li', '', 'Lớp ' + l));
    info.append(meta, chips);
    const acts = el('div', 'qz-set-acts');
    const open = btn('Mở luyện tập', 't-primary qz-open', () => void startRoom(s)); open.setAttribute('aria-label', `Mở luyện tập: ${s.name}`);
    acts.append(open, ui.iconButton({ icon: 'edit', label: `Sửa: ${s.name}`, onClick: () => void openEditor(s) }), ui.iconButton({ icon: 'trash', label: `Xóa: ${s.name}`, danger: true, onClick: () => void removeSet(s) }));
    li.append(info, acts); box.append(li);
  }
  $('qz-sync').textContent = ownerKey() ? (synced ? 'Bộ câu hỏi đã đồng bộ, mở được trên máy khác khi đăng nhập cùng tài khoản.' : 'Bộ câu hỏi đang lưu trên máy này (chưa đồng bộ được lên mạng).') : '';
  const hb = $('qz-history'); hb.replaceChildren();
  const hist = /** @type {any[]} */ (readLS(histKey(), [])).slice(0, 8);
  if (!hist.length) hb.append(el('li', 't-muted', 'Chưa có buổi luyện tập nào.'));
  for (const h of hist) { const li = el('li'); li.append(el('strong', '', `${h.name} · ${(h.lops || [h.lop]).map((/** @type {string} */ x) => 'Lớp ' + x).join(', ')}`), el('span', '', `${new Date(h.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${h.players} em · đúng TB ${h.avg}%${h.muc ? ' · ' + h.muc : ''}`)); hb.append(li); }
}
/** @param {QSet} s */
async function removeSet(s) {
  if (!(await confirmBox({ title: 'Xóa bộ câu hỏi?', body: `"${s.name}" (${s.qs.length} câu) sẽ bị xóa trên máy này và trên mạng. Không khôi phục được.`, okText: 'Xóa bộ câu hỏi', danger: true }))) return;
  writeLS(setsKey(), sets().filter(x => x.id !== s.id));
  const owner = ownerKey(); if (owner) await store.put(`quiz_bo/${owner}/${s.id}`, null).catch(() => {});
  renderSets(); status(`Đã xóa "${s.name}".`, 'success');
}

/* ---------- Soạn bộ câu hỏi ---------- */
/** @type {QSet|null} */ let editing = null;
/** Lớp giáo viên được dùng: giáo viên lớp = lớp phụ trách; quản trị = mọi lớp có học sinh. null = tải lỗi. */
async function classes() {
  try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); if (t && Array.isArray(t.lop) && cred().gv_ma) return t.lop.map(String); } catch { /* bỏ qua */ }
  // Chỉ mục lớp nhỏ (Google Sheet đẩy kèm từ 29/10); chưa có thì đọc cả danh sách học sinh như trước
  const idx = await store.get('thi_lop').catch(() => undefined);
  if (idx && typeof idx === 'object') return [...new Set(Object.values(idx).map((/** @type {any} */ x) => String(x?.lop || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const hs = await store.get('thi_hs').catch(() => undefined);
  if (hs === undefined) return null;
  return [...new Set(Object.values(hs || {}).map((/** @type {any} */ s) => String(s?.lop || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}
/** @param {Partial<Q>} [q] */
function qRow(q = {}) {
  const fs = el('fieldset', 'thi-qe qz-q' + (q.ai ? ' is-ai' : ''));
  const lg = el('legend'); fs.append(lg);
  const uid = Math.random().toString(36).slice(2, 8);
  const field = (/** @type {string} */ label, /** @type {HTMLElement} */ ctl, cls = '') => { const w = el('div', 't-field ' + cls); const l = el('label', '', label); ctl.id = `qz-${uid}-${cls}`; /** @type {HTMLLabelElement} */ (l).htmlFor = ctl.id; w.append(l, ctl); return w; };
  const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'qz-text')); text.maxLength = 300; text.rows = 2; text.value = q.text || '';
  fs.append(field('Câu hỏi', text, 'f-text'));
  const opts = el('div', 'thi-qe-opts');
  for (const k of L) { const i = /** @type {HTMLInputElement} */ (el('input', 'qz-opt')); i.dataset.k = k; i.maxLength = 120; i.value = q.opts?.[k] || ''; opts.append(field('Phương án ' + k, i, 'f-' + k)); }
  fs.append(opts);
  const foot = el('div', 'thi-qe-foot');
  const ans = /** @type {HTMLSelectElement} */ (el('select', 'qz-ans')); for (const k of L) ans.append(new Option(k, k)); ans.value = q.ans || 'A';
  const topic = /** @type {HTMLInputElement} */ (el('input', 'qz-topic')); topic.maxLength = 60; topic.value = q.topic || ''; topic.placeholder = 'Ví dụ: Mã nhị phân';
  const del = ui.iconButton({ icon: 'trash', label: 'Xóa câu này', danger: true, onClick: () => { fs.remove(); qNumber(); } });
  foot.append(field('Đáp án đúng', ans, 'f-ans'), field('Chủ đề', topic, 'f-topic'), del); fs.append(foot);
  if (q.ai) {
    lg.after(el('span', 'thi-qe-ai-tag', 'AI soạn, cần duyệt'));
    if (q.explain) fs.append(el('p', 't-hint thi-qe-explain', 'Giải thích của AI: ' + q.explain));
    const okLab = el('label', 'thi-qe-ok'); const ok = /** @type {HTMLInputElement} */ (el('input', 'qz-ok')); ok.type = 'checkbox';
    ok.addEventListener('change', () => fs.classList.toggle('is-approved', ok.checked)); okLab.append(ok, document.createTextNode(' Đã duyệt câu này')); fs.append(okLab);
  }
  return fs;
}
function qNumber() { const fs = $('qz-list').querySelectorAll('.qz-q'); fs.forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Câu ${i + 1}`; }); $('qz-count').textContent = fs.length ? `${fs.length} câu` : ''; }
/** Thêm câu vào danh sách (bỏ các ô trống đang có). @param {Partial<Q>[]} qs */
function appendQs(qs) { const list = $('qz-list'); for (const f of [...list.querySelectorAll('.qz-q')]) if (!/** @type {HTMLTextAreaElement} */ (f.querySelector('.qz-text')).value.trim()) f.remove(); for (const q of qs) list.append(qRow(q)); qNumber(); }
/** @param {QSet|null} s */
async function openEditor(s) {
  editing = s; $('qz-ed-title').textContent = s ? 'Sửa bộ câu hỏi' : 'Tạo bộ câu hỏi';
  inp('qz-name').value = s?.name || ''; sel('qz-lim').value = String(s?.lim || 20); sel('qz-read').value = String(s?.read ?? 3);
  for (const id of ['qz-name', 'qz-lops']) { $(id).removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; }
  $('qz-form-err').textContent = ''; for (const id of ['qz-ai-box', 'qz-exam-box', 'qz-xl-box']) $(id).hidden = true;
  $('qz-list').replaceChildren(...(s?.qs?.length ? s.qs : [{}]).map(q => qRow(q))); qNumber();
  await ui.showSub('detail-tools');
  await loadLops(s);
  inp('qz-name').focus();
}
/** Danh sách lớp để chọn; lỗi mạng → báo rõ + nút Thử lại (giữ nguyên các câu đã soạn). @param {QSet|null} s */
async function loadLops(s) {
  const box = $('qz-lops');
  const keep = new Set(s ? s.lops : []);
  box.replaceChildren(el('p', 't-muted ld-inline', 'Đang tải danh sách lớp…'));
  const lops = await classes(), chosen = keep;
  box.replaceChildren();
  if (lops === null) { const n = el('div', 'notice error qz-lops-retry'); n.append(el('span', '', 'Chưa tải được danh sách lớp (mạng chậm).'), btn('Thử lại', 'qz-lops-again', () => void loadLops(s))); box.append(n); return; }
  if (!lops.length) { box.append(el('p', 't-muted', 'Chưa có lớp nào có học sinh. Thêm học sinh ở mục Tài khoản trước.')); return; }
  if (lops.length === 1 && !s) chosen.add(lops[0]);
  for (const l of lops) { const lab = el('label', 'qz-lop-pick'); const c = /** @type {HTMLInputElement} */ (el('input')); c.type = 'checkbox'; c.value = l; c.checked = chosen.has(l); lab.append(c, el('span', '', 'Lớp ' + l)); box.append(lab); }
}
const pickedLops = () => [...$('qz-lops').querySelectorAll('input[type=checkbox]:checked')].map(c => /** @type {HTMLInputElement} */ (c).value);
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
  if (out.length > MAX_Q) return { error: `Tối đa ${MAX_Q} câu mỗi bộ.` };
  return { qs: out };
}
$('qz-new').addEventListener('click', () => void openEditor(null));
$('qz-add').addEventListener('click', () => { const r = qRow(); $('qz-list').append(r); qNumber(); /** @type {HTMLElement} */ (r.querySelector('.qz-text')).focus(); });
$('qz-lops').addEventListener('change', () => { $('qz-lops').removeAttribute('aria-invalid'); $('qz-lops-err').textContent = ''; });
$('qz-lops-all').addEventListener('click', () => { const cs = [...$('qz-lops').querySelectorAll('input[type=checkbox]')]; const all = cs.every(c => /** @type {HTMLInputElement} */ (c).checked); cs.forEach(c => { /** @type {HTMLInputElement} */ (c).checked = !all; }); $('qz-lops').removeAttribute('aria-invalid'); $('qz-lops-err').textContent = ''; });
$('qz-form').addEventListener('submit', async ev => {
  ev.preventDefault(); $('qz-form-err').textContent = '';
  const name = inp('qz-name'), lopBox = $('qz-lops');
  for (const n of [name, lopBox]) { n.removeAttribute('aria-invalid'); $(n.id + '-err').textContent = ''; }
  if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); $('qz-name-err').textContent = 'Nhập tên bộ câu hỏi.'; name.focus(); return; }
  const lops = pickedLops();
  if (!lops.length) { lopBox.setAttribute('aria-invalid', 'true'); $('qz-lops-err').textContent = 'Chọn ít nhất một lớp.'; /** @type {HTMLElement|null} */ (lopBox.querySelector('input'))?.focus(); return; }
  const r = collect(); if (r.error) { $('qz-form-err').textContent = r.error; return; }
  const save = /** @type {HTMLButtonElement} */ ($('qz-save')); save.disabled = true; save.setAttribute('aria-busy', 'true'); const label = save.textContent; save.textContent = 'Đang lưu…';
  /** @type {QSet} */ const s = { id: editing?.id || 'qz' + Date.now().toString(36), name: name.value.trim(), lops, lim: Number(sel('qz-lim').value) || 20, read: Number(sel('qz-read').value) || 0, qs: /** @type {Q[]} */ (r.qs), at: Date.now() };
  const online = await saveSet(s);
  save.disabled = false; save.removeAttribute('aria-busy'); save.textContent = label;
  synced = online || synced; renderSets(); void ui.goBack();
  status(`Đã lưu "${s.name}" (${s.qs.length} câu, ${s.lops.map(l => 'lớp ' + l).join(', ')}).` + (online ? '' : ' Chưa đồng bộ lên mạng được: bộ câu hỏi đang lưu trên máy này.'), 'success');
});
/* AI soạn câu hỏi theo bài */
/** @type {{key:string,title:string,grade:number,course_id:string,lesson_id:string}[]} */ let lessons = [];
$('qz-ai').addEventListener('click', async () => {
  $('qz-exam-box').hidden = true; $('qz-xl-box').hidden = true; const box = $('qz-ai-box'); box.hidden = !box.hidden; if (box.hidden) return;
  $('qz-ai-err').textContent = '';
  if (!lessons.length) { sel('qz-ai-lesson').replaceChildren(new Option('Đang tải bài học…', '')); try { const cat = await api('/pwa/catalog'); for (const c of cat?.courses || []) for (const l of c.lessons || []) lessons.push({ key: c.id + '|' + l.id, title: l.title, grade: Number(c.grade) || 0, course_id: c.id, lesson_id: l.id }); } catch { $('qz-ai-err').textContent = 'Chưa tải được danh sách bài học.'; } }
  const grades = new Set(pickedLops().map(l => Number(String(l).match(/^\d+/)?.[0]) || 0)), list = lessons.filter(l => !grades.size || grades.has(l.grade));
  sel('qz-ai-lesson').replaceChildren(...(list.length ? list : lessons).map(l => new Option(`${l.title} · Lớp ${l.grade}`, l.key)));
});
$('qz-ai-go').addEventListener('click', async () => {
  const l = lessons.find(x => x.key === sel('qz-ai-lesson').value); $('qz-ai-err').textContent = '';
  if (!l) { $('qz-ai-err').textContent = 'Chọn bài học.'; return; }
  const n = Number(sel('qz-ai-n').value) || 8, b = /** @type {HTMLButtonElement} */ ($('qz-ai-go')), label = b.textContent;
  b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'AI đang soạn… (10–30 giây)';
  try {
    const c = cred(), nb = Math.ceil(n * 0.4), nh = Math.ceil(n * 0.4);
    const r = await api('/teacher/ai-questions', { method: 'POST', token: c.tok || undefined, timeout: 90000, body: { course_id: l.course_id, lesson_id: l.lesson_id, topic: inp('qz-ai-topic').value.trim(), counts: { 'Biết': nb, 'Hiểu': nh, 'Vận dụng': Math.max(0, n - nb - nh) }, ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
    const qs = (r?.questions || []).map((/** @type {any} */ q) => ({ text: q.text, opts: q.options, ans: q.answer, topic: q.topic, ai: true, explain: q.explain }));
    if (!qs.length) throw new Error('AI chưa soạn được câu nào. Thử lại.');
    appendQs(qs); $('qz-ai-box').hidden = true;
    if (!inp('qz-name').value.trim()) inp('qz-name').value = 'Ôn nhanh: ' + l.title;
    $('qz-form-err').textContent = ''; status(`AI đã soạn ${qs.length} câu.` + (r.kiem_tra ? ' ' + r.kiem_tra : '') + ' Đọc kỹ và đánh dấu "Đã duyệt" từng câu.', 'success');
  } catch (e) { $('qz-ai-err').textContent = e instanceof Error ? e.message : 'AI chưa soạn được.'; }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = label; }
});
/* Tải câu hỏi từ file Excel */
/** @type {Map<string, Promise<void>>} */ const scripts = new Map();
const loadScript = (/** @type {string} */ src) => { if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => { const t = document.createElement('script'); t.src = src; t.onload = () => res(); t.onerror = () => { scripts.delete(src); rej(new Error('Không tải được bộ đọc Excel. Kiểm tra mạng rồi thử lại.')); }; document.head.append(t); })); return /** @type {Promise<void>} */ (scripts.get(src)); };
$('qz-xl').addEventListener('click', () => { $('qz-ai-box').hidden = true; $('qz-exam-box').hidden = true; const box = $('qz-xl-box'); box.hidden = !box.hidden; $('qz-xl-err').textContent = ''; });
$('qz-xl-template').addEventListener('click', async () => {
  try {
    await loadScript('./vendor/write-excel-file.min.js');
    const cell = (/** @type {unknown} */ v, bold = false) => typeof v === 'number' ? { value: v, type: Number, ...(bold ? { fontWeight: 'bold' } : {}) } : { value: String(v ?? ''), ...(bold ? { fontWeight: 'bold' } : {}) };
    const rows = [QUIZ_COLUMNS, [1, '1 byte bằng bao nhiêu bit?', '4', '8', '16', '2', 'B', 'Đơn vị đo thông tin'], [2, 'Thiết bị nào dùng để nhập dữ liệu?', 'Loa', 'Máy in', 'Bàn phím', 'Màn hình', 'C', 'Thiết bị vào ra']];
    const guide = [['Hướng dẫn'], ['Mỗi dòng một câu hỏi trắc nghiệm. Giữ nguyên dòng tiêu đề.'], ['Điền ít nhất phương án A và B. Cột "Đáp án đúng" ghi một chữ cái A, B, C hoặc D.'], [`Tối đa ${MAX_Q} câu mỗi bộ. Có thể tải file mẫu đề thi của mục Thi (chỉ lấy câu trắc nghiệm).`]];
    // @ts-ignore thư viện nạp bằng thẻ script
    await globalThis.writeXlsxFile([{ data: rows.map((r, i) => r.map(v => cell(v, i === 0))), sheet: 'Câu hỏi', columns: [6, 52, 24, 24, 24, 24, 14, 24].map(width => ({ width })), stickyRowsCount: 1 }, { data: guide.map((r, i) => r.map(v => cell(v, i === 0))), sheet: 'Hướng dẫn', columns: [{ width: 100 }] }]).toFile('mau-cau-hoi-luyen-tap.xlsx');
  } catch (e) { $('qz-xl-err').textContent = e instanceof Error ? e.message : 'Chưa tạo được file mẫu.'; }
});
$('qz-xl-file').addEventListener('change', async () => {
  const f = inp('qz-xl-file').files?.[0]; inp('qz-xl-file').value = ''; const err = $('qz-xl-err'); err.textContent = '';
  if (!f) return;
  if (!/\.xlsx$/i.test(f.name)) { err.textContent = 'Chỉ nhận file .xlsx. Hãy dùng file mẫu.'; return; }
  if (f.size > 2 * 1024 * 1024) { err.textContent = 'File lớn hơn 2 MB.'; return; }
  try {
    await loadScript('./vendor/read-excel-file.min.js');
    // @ts-ignore thư viện nạp bằng thẻ script
    const res = await globalThis.readXlsxFile(f);
    const rows = Array.isArray(res) && res.length && res[0] && !Array.isArray(res[0]) && res[0].data ? res[0].data : res;
    const p = parseQuizRows(rows);
    if (p.fatal) { err.textContent = p.fatal; return; }
    appendQs(p.qs); $('qz-xl-box').hidden = p.errors.length === 0;
    if (!inp('qz-name').value.trim()) inp('qz-name').value = f.name.replace(/\.xlsx$/i, '');
    if (p.errors.length) err.textContent = `Đã thêm ${p.qs.length} câu. Bỏ qua: ${p.errors.slice(0, 5).join(' ')}${p.errors.length > 5 ? ' …' : ''}`;
    else status(`Đã thêm ${p.qs.length} câu từ file "${f.name}".`, 'success');
  } catch (e) { err.textContent = e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file. Hãy dùng file .xlsx tải từ mẫu.'; }
});
/* Lấy câu từ đề thi thử đã có (Google Sheet) */
/** @param {Record<string, unknown>} body */
async function sheet(body) {
  const c = cred(); if (!SHEET_API) throw new Error('Chưa cài địa chỉ Google Sheet.');
  const res = await fetch(SHEET_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ gv: c.gv, ...(c.gv_ma ? { gv_ma: c.gv_ma } : {}), ...body }) });
  const d = await res.json(); if (!d?.ok) throw new Error(d?.error || 'Google Sheet chưa trả lời.'); return d;
}
$('qz-from-exam').addEventListener('click', async () => {
  $('qz-ai-box').hidden = true; $('qz-xl-box').hidden = true; const box = $('qz-exam-box'); box.hidden = !box.hidden; if (box.hidden) return;
  $('qz-exam-err').textContent = ''; sel('qz-exam').replaceChildren(new Option('Đang tải…', ''));
  try { const d = await sheet({ action: 'gv_list' }); const ex = (d.exams || []).filter((/** @type {any} */ e) => e.che_do === 'thu'); sel('qz-exam').replaceChildren(...(ex.length ? ex.map((/** @type {any} */ e) => new Option(`${e.tieu_de} (${e.questions} câu)`, e.ma_de)) : [new Option('Chưa có đề thi thử', '')])); }
  catch (e) { $('qz-exam-err').textContent = e instanceof Error ? e.message : 'Chưa tải được.'; }
});
$('qz-exam-go').addEventListener('click', async () => {
  const id = sel('qz-exam').value; if (!id) return; $('qz-exam-err').textContent = '';
  try { const d = await sheet({ action: 'gv_questions', ma_de: id }); appendQs((d.questions || []).filter((/** @type {any} */ q) => q.kind !== 'tl').map((/** @type {any} */ q) => ({ text: q.text, opts: q.options, ans: q.answer, topic: q.topic }))); $('qz-exam-box').hidden = true; }
  catch (e) { $('qz-exam-err').textContent = e instanceof Error ? e.message : 'Chưa lấy được câu hỏi.'; }
});

/* ---------- Phòng luyện tập (máy chiếu) ---------- */
/** @type {null|{room:string,key:string,set:QSet,i:number,phase:'lobby'|'ready'|'intro'|'q'|'pause'|'reveal'|'board'|'end',players:Record<string,{ten:string}>,score:Record<string,import('./quiz-core.js').Score>,stats:any[],lopKeys:string[],stops:(()=>void)[],ansStop?:()=>void,answers:Record<string,any>,timer:number,qAt:number,off:number,end:number,left:number,prevRank:Record<string,number>,muc?:string}} */ let room = null;
const host = $('qz-host'), main = $('qz-h-main'), foot = $('qz-h-foot');
const initials = (/** @type {string} */ v) => String(v || '?').trim().split(/\s+/).slice(-1)[0].slice(0, 1).toUpperCase();
const rnd = (/** @type {number} */ n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
// Bằng chứng MỚI cho mỗi lần ghi (khóa|số đếm): luật yêu cầu bằng chứng đổi trong chính lần ghi đó.
let proofN = 0;
/** @param {Record<string, unknown>} paths */
const write = paths => { if (!room) return Promise.resolve(); return store.patch('', { ...paths, [`quiz_proof/${room.room}`]: `${room.key}|${Date.now().toString(36)}${(++proofN).toString(36)}` }); };
const P = (/** @type {string} */ k) => `quiz/${room?.room}/pub/${k}`;
const ranked = () => room ? rankScore(room.score) : [];
const lopText = (/** @type {string[]} */ ls) => ls.map(l => 'Lớp ' + l).join(', ');

/** Phòng còn treo từ lần trước (tải lại trang giữa chừng): đóng hẳn để học sinh không thấy phòng ma. */
/** Nhịp "phòng còn mở" mỗi phút (pub/hb). Máy giáo viên tắt / đóng trình duyệt chưa bấm Kết thúc → nhịp dừng → học sinh tự thoát sau 5 phút.
 * @param {string} code */
function beat(code) {
  const id = window.setInterval(() => {
    if (!room || room.room !== code || room.phase === 'end') { clearInterval(id); return; }
    void write({ [P('hb')]: store.SERVER_TIME }).then(() => { const live = readLS(liveKey(), null); if (live?.room === code) writeLS(liveKey(), { ...live, hbAt: Date.now() }); }).catch(() => {});
  }, HB_MS);
}
/** @param {boolean} [force] true = mở phòng mới trên máy này. Không force: chỉ đóng khi phòng cũ đã ngừng nhịp (tab khác đang dẫn phòng thì không đóng nhầm). */
async function closeOrphan(force = false) {
  const live = readLS(liveKey(), null); if (!live?.room || !live?.key || room) return;
  if (!force && Date.now() - Number(live.hbAt || 0) < STALE_MS) return;
  const proof = `${live.key}|${Date.now().toString(36)}x`;
  /** @type {Record<string, unknown>} */ const paths = { [`quiz/${live.room}/pub/phase`]: 'end', [`quiz_proof/${live.room}`]: proof };
  for (const lk of live.lopKeys || []) paths[`quiz_lop/${lk}`] = null;
  await store.patch('', paths).catch(() => {});
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
}

/** @param {QSet} s */
async function startRoom(s) {
  if (!store.enabled()) { status('Chưa cài dự án Firebase (presence-config.js).', 'error'); return; }
  if (room) { openHost(); return; }
  if (!s.lops.length) { status('Bộ câu hỏi chưa chọn lớp. Bấm Sửa để chọn lớp.', 'error'); return; }
  await closeOrphan(true);
  const key = [...rnd(24)].map(b => b.toString(16).padStart(2, '0')).join('');
  let code = '';
  for (let t = 0; t < 6 && !code; t++) {
    const c = String(100000 + ([...rnd(4)].reduce((a, b) => a * 256 + b, 0) % 900000));
    try { await store.put(`quiz_key/${c}`, key); code = c; } catch { /* trùng mã → thử mã khác */ }
  }
  if (!code) { status('Chưa tạo được phòng. Kiểm tra mạng rồi thử lại.', 'error'); return; }
  room = { room: code, key, set: s, i: -1, phase: 'lobby', players: {}, score: {}, stats: [], lopKeys: s.lops.map(l => store.keyOf(l)), stops: [], answers: {}, timer: 0, qAt: 0, off: 0, end: 0, left: 0, prevRank: {} };
  /** @type {Record<string, unknown>} */ const paths = { [`quiz/${code}/pub`]: { phase: 'lobby', title: s.name, lops: s.lops, n: s.qs.length, lim: s.lim, at: store.SERVER_TIME, hb: store.SERVER_TIME } };
  for (const lk of room.lopKeys) paths[`quiz_lop/${lk}`] = code;
  try { await write(paths); } catch (e) { status('Chưa mở được phòng: ' + (e instanceof Error ? e.message : ''), 'error'); room = null; return; }
  writeLS(liveKey(), { room: code, key, setId: s.id, lopKeys: room.lopKeys, hbAt: Date.now() });
  beat(code);
  room.stops.push(store.listen(`quiz/${code}/ds`, d => { if (!room) return; room.players = d || {}; for (const [k, v] of Object.entries(room.players)) if (!room.score[k]) room.score[k] = blankScore(String(/** @type {any} */ (v)?.ten || k)); if (room.phase === 'lobby') drawLobby(); else if (room.phase === 'q') drawQ(); }, undefined, { prio: 2 }));
  main.dataset.n = '0'; openHost(); drawLobby();
}
function openHost() { host.hidden = false; document.body.classList.add('qz-hosting'); $('qz-h-close').focus(); }
function drawLobby() {
  if (!room) return;
  $('qz-h-kicker').textContent = `${lopText(room.set.lops)} · ${room.set.qs.length} câu · ${room.set.lim} giây/câu`; $('qz-h-title').textContent = room.set.name;
  const n = Object.keys(room.players).length;
  if (n > Number(main.dataset.n || 0)) fx.sfx.join(); main.dataset.n = String(n);
  const code = el('div', 'qz-code'); code.append(el('span', '', 'Mã phòng'), el('strong', '', room.room.replace(/(\d{3})(\d{3})/, '$1 $2')));
  const hint = el('p', 'qz-hint', `Học sinh ${room.set.lops.map(l => 'lớp ' + l).join(', ')} đăng nhập AI Học Tập → mục Luyện tập → bấm Vào phòng.`);
  const chips = el('ul', 'qz-chips'); chips.setAttribute('aria-label', 'Học sinh đã vào phòng');
  for (const v of Object.values(room.players)) chips.append(el('li', '', String(/** @type {any} */ (v)?.ten || '')));
  const count = el('p', 'qz-count', n ? `${n} học sinh đã vào phòng` : 'Đang chờ học sinh vào phòng…'); count.setAttribute('aria-live', 'polite');
  main.replaceChildren(code, hint, count, chips);
  const go = btn('Bắt đầu', 't-primary qz-big', () => void startGame()); go.disabled = !n; go.id = 'qz-start';
  foot.replaceChildren(go, fx.soundToggle('t-button qz-sound'));
}
/** Bắt đầu: cả lớp cùng thấy đếm ngược 3 · 2 · 1 rồi vào câu 1. */
async function startGame() {
  if (!room || room.phase !== 'lobby') return;
  room.phase = 'ready';
  foot.replaceChildren();
  await write({ [P('phase')]: 'ready', [P('ready')]: store.SERVER_TIME }).catch(() => {});
  $('qz-h-kicker').textContent = `${room.set.qs.length} câu · ${room.set.lim} giây/câu`;
  main.replaceChildren();
  await fx.countdown(host, { title: room.set.name });
  await nextQ();
}
/** Đồng hồ máy chiếu chạy theo hạn room.end. */
function tick() {
  if (!room) return;
  clearInterval(room.timer);
  room.timer = window.setInterval(() => {
    if (!room || room.phase !== 'q') return;
    const left = Math.max(0, room.end - Date.now()), s = Math.ceil(left / 1000);
    const t = main.querySelector('.qz-timer'); if (t && t.textContent !== String(s) && s <= 5 && s > 0) fx.sfx.tick();
    if (t) { t.textContent = String(s); t.classList.toggle('is-low', s <= 5); /** @type {HTMLElement} */ (t).style.setProperty('--p', String(left / (room.set.lim * 1000))); }
    if (left <= 0) void reveal();
  }, 200);
}
async function nextQ() {
  if (!room) return;
  room.i++; if (room.i >= room.set.qs.length) { await endGame(); return; }
  const q = room.set.qs[room.i], k = 'q' + room.i;
  room.answers = {}; room.prevRank = Object.fromEntries(ranked().map((r, i) => [r.k, i + 1]));
  /** @type {Record<string,string>} */ const opts = {}; for (const x of L) if (q.opts[x]) opts[x] = q.opts[x];
  const lim = room.set.lim * 1000, read = Math.max(0, Number(room.set.read ?? 3)) * 1000;
  if (read) {   // Đọc câu hỏi trước (chưa có phương án, máy chủ chưa nhận trả lời), rồi mới mở phương án
    room.phase = 'intro'; const i = room.i;
    await write({ [P('phase')]: 'intro', [P('q')]: { k, i: room.i, text: q.text, read: read }, [P('reveal')]: null, [P('pause')]: null, [P('ready')]: null }).catch(() => {});
    drawIntro(read);
    await new Promise(r => setTimeout(r, read));
    if (!room || room.phase !== 'intro' || room.i !== i) return;
  }
  room.phase = 'q';
  await write({ [P('phase')]: 'q', [P('q')]: { k, i: room.i, text: q.text, opts, lim: room.set.lim, left: lim, at: store.SERVER_TIME }, [P('reveal')]: null, [P('pause')]: null, [P('ready')]: null });
  const at = Number(await store.get(`quiz/${room.room}/pub/q/at`).catch(() => 0)) || Date.now();
  room.qAt = at; room.off = at - Date.now(); room.end = Date.now() + lim;
  room.ansStop?.(); room.ansStop = store.listen(`quiz/${room.room}/ans/${k}`, d => { if (!room || room.phase !== 'q' || room.i !== Number(k.slice(1))) return; room.answers = d || {}; drawQ(); const np = Object.keys(room.players).length; if (np && Object.keys(room.answers).length >= np) void reveal(); }, undefined, { prio: 3 });
  drawQ(true); tick();
}
/** Màn đọc câu hỏi: thẻ câu hỏi lớn + thanh thời gian đọc. @param {number} ms */
function drawIntro(ms) {
  if (!room) return;
  const q = room.set.qs[room.i];
  $('qz-h-kicker').textContent = `Câu ${room.i + 1}/${room.set.qs.length}${q.topic ? ' · ' + q.topic : ''} · Đọc câu hỏi`;
  const card = el('div', 'qz-intro'); const bar = el('span', 'qz-intro-bar'); bar.style.setProperty('--ms', ms + 'ms'); bar.setAttribute('aria-hidden', 'true');
  card.append(el('span', 'qz-intro-n', `Câu ${room.i + 1}`), el('p', 'qz-intro-text', q.text), bar);
  main.replaceChildren(card); main.dataset.i = '';
  foot.replaceChildren(btn('Kết thúc', 'qz-stop', () => void stopEarly()));
  fx.sfx.join();
}
function drawQ(fresh = false) {
  if (!room || room.phase !== 'q') return;
  const q = room.set.qs[room.i];
  $('qz-h-kicker').textContent = `Câu ${room.i + 1}/${room.set.qs.length}${q.topic ? ' · ' + q.topic : ''}`;
  if (fresh || !main.querySelector('.qz-qtext') || main.dataset.i !== String(room.i)) {
    main.dataset.i = String(room.i);
    const top = el('div', 'qz-qtop'); const tm = el('span', 'qz-timer', String(Math.ceil(Math.max(0, room.end - Date.now()) / 1000))); tm.setAttribute('role', 'timer'); tm.setAttribute('aria-label', 'Thời gian còn lại');
    top.append(el('p', 'qz-qtext', q.text), tm);
    const grid = el('ul', 'qz-opts'); for (const x of L) if (q.opts[x]) { const li = el('li', 'qz-opt qz-' + x); li.append(el('b', '', SHAPE[x]), el('span', '', q.opts[x])); grid.append(li); }
    main.replaceChildren(top, grid, el('p', 'qz-count qz-answered', ''));
    foot.replaceChildren(btn('Tạm dừng', 'qz-pause', () => void pause()), btn('Hiện đáp án', 't-primary qz-big qz-reveal', () => void reveal()), btn('Kết thúc', 'qz-stop', () => void stopEarly()));
  }
  /** @type {HTMLElement} */ (main.querySelector('.qz-answered')).textContent = `${Object.keys(room.answers).length}/${Object.keys(room.players).length} em đã trả lời`;
}
async function pause() {
  if (!room || room.phase !== 'q') return;
  room.left = Math.max(1000, room.end - Date.now()); room.phase = 'pause'; clearInterval(room.timer);
  await write({ [P('phase')]: 'pause', [P('pause')]: { left: room.left } }).catch(() => {});
  const box = el('div', 'qz-paused'); box.append(el('strong', '', 'Tạm dừng'), el('span', '', `Còn ${Math.ceil(room.left / 1000)} giây cho câu ${room.i + 1}. Học sinh không trả lời được khi đang tạm dừng.`));
  main.replaceChildren(box);
  foot.replaceChildren(btn('Tiếp tục', 't-primary qz-big qz-resume', () => void resume()), btn('Kết thúc', 'qz-stop', () => void stopEarly()));
}
async function resume() {
  if (!room || room.phase !== 'pause') return;
  const lim = room.set.lim * 1000, newAt = Math.round(Date.now() + room.off - (lim - room.left));   // dời mốc bắt đầu: thời gian tạm dừng không tính vào giờ làm bài
  room.qAt = newAt; room.end = Date.now() + room.left; room.phase = 'q';
  await write({ [P('phase')]: 'q', [P('q/at')]: newAt, [P('q/left')]: room.left, [P('pause')]: null }).catch(() => {});
  drawQ(true); tick();
}
async function reveal() {
  if (!room || room.phase !== 'q') return;
  room.phase = 'reveal'; clearInterval(room.timer);
  const q = room.set.qs[room.i], k = 'q' + room.i;
  const ans = await store.get(`quiz/${room.room}/ans/${k}`).catch(() => null) || room.answers || {};
  const counts = scoreQuestion(room.score, room.players, ans, q, room.qAt, room.set.lim);
  const total = Math.max(1, Object.keys(room.players).length);
  room.stats[room.i] = { text: q.text, opts: q.opts, ans: q.ans, topic: q.topic || '', counts, pct: Math.round(100 * counts[q.ans] / total) };
  const rk = ranked();
  /** @type {Record<string, any>} */ const kq = {}; rk.forEach((r, i) => { kq[r.k] = { p: r.p, c: r.c, r: i + 1, n: rk.length, last: r.last, ok: r.lastOk, streak: r.streak }; });
  await write({ [P('phase')]: 'reveal', [P('reveal')]: { k, ans: q.ans, counts }, [P('top')]: rk.slice(0, 5).map((r, i) => ({ ten: r.ten, p: r.p, up: (room?.prevRank[r.k] || rk.length) - (i + 1) })), [`quiz/${room.room}/kq`]: kq }).catch(() => {});
  drawReveal(counts);
}
/** Màn công bố đáp án: biểu đồ cột số em chọn từng phương án (cột đúng có dấu ✓), các phương án sai mờ đi.
 * @param {Record<string, number>} counts */
function drawReveal(counts) {
  if (!room) return;
  fx.sfx.reveal();
  const q = room.set.qs[room.i], s = room.stats[room.i], total = Object.keys(room.players).length;
  const max = Math.max(1, ...L.map(x => counts[x] || 0));
  const chart = el('div', 'qz-chart'); chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', L.filter(x => q.opts[x]).map(x => `${x}: ${counts[x] || 0} em${x === q.ans ? ' (đúng)' : ''}`).join(', '));
  for (const x of L) if (q.opts[x]) {
    const col = el('div', `qz-col qz-col-${x}${x === q.ans ? ' is-ans' : ''}`);
    const bar = el('span', 'qz-col-bar'); bar.style.setProperty('--hv', String(Math.max(0.03, (counts[x] || 0) / max)));
    const key = el('span', 'qz-col-key'); key.append(el('b', '', SHAPE[x]), ...(x === q.ans ? [el('i', 'qz-check', '✓')] : []));
    const track = el('span', 'qz-col-track'); track.append(el('span', 'qz-col-n', String(counts[x] || 0)), bar); col.append(track, key); chart.append(col);
  }
  const grid = el('ul', 'qz-opts is-reveal');
  for (const x of L) if (q.opts[x]) { const li = el('li', 'qz-opt qz-' + x + (x === q.ans ? ' is-ans' : ' is-dim')); li.append(el('b', '', SHAPE[x]), el('span', '', q.opts[x]), ...(x === q.ans ? [el('i', 'qz-check', '✓')] : [])); grid.append(li); }
  const ok = counts[q.ans] || 0;
  const sum = el('p', 'qz-sum'); sum.append(el('strong', '', `${ok}/${total}`), document.createTextNode(` em trả lời đúng (${s.pct}%)${counts.none ? ` · ${counts.none} em chưa trả lời` : ''}`));
  main.replaceChildren(el('p', 'qz-qtext qz-qtext-sm', q.text), chart, sum, grid);
  $('qz-h-kicker').textContent = `Câu ${room.i + 1}/${room.set.qs.length} · Đáp án`;
  foot.replaceChildren(btn('Bảng xếp hạng', 't-primary qz-big qz-board-btn', () => drawBoard()), btn('Kết thúc', 'qz-stop', () => void stopEarly()));
}
/** Bảng xếp hạng sau mỗi câu: 5 em dẫn đầu, điểm vừa nhận, lên hạng, chuỗi đúng; lời khen khi có chuỗi đúng hoặc lên từ 3 hạng. */
function drawBoard() {
  if (!room) return;
  room.phase = 'board';
  const rk = ranked(), last = room.i + 1 >= room.set.qs.length;
  const board = el('ol', 'qz-board'); board.setAttribute('aria-label', 'Năm bạn dẫn đầu');
  rk.slice(0, 5).forEach((r, i) => {
    const up = room?.i ? (room.prevRank[r.k] || rk.length) - (i + 1) : 0;
    const li = el('li', 'qz-row' + (i === 0 ? ' is-first' : '')); li.style.setProperty('--i', String(i));
    const name = el('span', 'qz-row-name'); name.append(el('span', 'qz-row-ten', r.ten));
    if (r.streak >= 2) name.append(el('small', 'qz-chip qz-chip-streak', `Chuỗi ${r.streak}`));
    li.append(el('span', 'qz-rank-badge', String(i + 1)), el('span', 'qz-av', initials(r.ten)), name,
      el('small', 'qz-row-move' + (up > 0 ? ' is-up' : ''), up > 0 ? `▲ ${up}` : ''),
      el('small', 'qz-row-gain', r.lastOk ? `+${r.last}` : ''), el('strong', 'qz-row-p', String(r.p)));
    board.append(li);
  });
  const cheers = [];
  const streak = [...rk].sort((a, b) => b.streak - a.streak)[0];
  if (streak && streak.streak >= 3) cheers.push(`${streak.ten} đúng ${streak.streak} câu liên tiếp!`);
  if (room.i) { const jump = rk.map((r, i) => ({ r, up: (room?.prevRank[r.k] || rk.length) - (i + 1) })).sort((a, b) => b.up - a.up)[0]; if (jump && jump.up >= 3) cheers.push(`${jump.r.ten} vừa vượt lên ${jump.up} hạng!`); }
  const kids = [el('h3', 'qz-stage-title', 'Bảng xếp hạng'), board];
  if (cheers.length) { const c = el('p', 'qz-cheer'); c.textContent = cheers.join(' '); kids.push(c); }
  if (rk.length > 5) kids.push(el('p', 'qz-hint', `Các bạn khác xem hạng của mình trên điện thoại (${rk.length} em).`));
  main.replaceChildren(...kids);
  $('qz-h-kicker').textContent = `Sau câu ${room.i + 1}/${room.set.qs.length}`;
  foot.replaceChildren(btn(last ? 'Bục vinh danh' : 'Câu tiếp theo', 't-primary qz-big qz-next', () => void nextQ()), ...(last ? [] : [btn('Kết thúc', 'qz-stop', () => void stopEarly())]));
}
async function stopEarly() {
  if (!room || room.phase === 'end') return;
  if (!(await confirmBox({ title: 'Kết thúc luyện tập?', body: `Đang ở câu ${room.i + 1}/${room.set.qs.length}. Kết quả tính đến câu đã công bố đáp án sẽ được giữ và vinh danh.`, okText: 'Kết thúc luyện tập', danger: true }))) return;
  if (room.phase === 'q' || room.phase === 'pause' || room.phase === 'intro') { room.ansStop?.(); room.i--; }   // câu đang dở không tính
  await endGame();
}
async function endGame() {
  if (!room) return;
  room.phase = 'end'; clearInterval(room.timer); room.ansStop?.();
  const rk = ranked(), aw = awards(room.score), players = rk.length, stats = room.stats.filter(Boolean);
  const avg = stats.length ? Math.round(stats.reduce((a, s) => a + s.pct, 0) / stats.length) : 0;
  /** @type {Record<string, any>} */ const kq = {}; rk.forEach((r, i) => { kq[r.k] = { p: r.p, c: r.c, r: i + 1, n: rk.length, best: r.best, giai: aw.filter(a => a.k === r.k).map(a => a.giai) }; });
  /** @type {Record<string, unknown>} */ const paths = { [P('phase')]: 'end', [P('q')]: null, [P('pause')]: null, [P('ready')]: null, [P('podium')]: rk.slice(0, 3).map(r => ({ ten: r.ten, p: r.p, c: r.c })), [P('awards')]: aw.map(a => ({ ten: a.ten, giai: a.giai, chi_tiet: a.chi_tiet })), [P('so_cau')]: stats.length, [`quiz/${room.room}/kq`]: kq };
  for (const lk of room.lopKeys) paths[`quiz_lop/${lk}`] = null;
  await write(paths).catch(() => {});
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
  const hist = /** @type {any[]} */ (readLS(histKey(), [])); hist.unshift({ name: room.set.name, lops: room.set.lops, at: Date.now(), players, avg }); writeLS(histKey(), hist.slice(0, 20));
  void drawPodium();
}
/** Bục vinh danh: hạng 3 → hạng 2 → (trống dồn) → quán quân, pháo giấy. */
async function drawPodium() {
  if (!room) return;
  const rk = ranked(), n = room.stats.filter(Boolean).length, token = room.room + Date.now();
  main.dataset.pod = token;
  $('qz-h-kicker').textContent = 'Kết thúc · Vinh danh';
  const stage = el('ol', 'qz-stage'); stage.setAttribute('aria-label', 'Bục vinh danh');
  /** @type {HTMLElement[]} */ const steps = [];
  for (const place of [2, 1, 3]) {
    const r = rk[place - 1]; if (!r) continue;
    const li = el('li', `qz-step qz-step-${place}`);
    const who = el('div', 'qz-step-who'); who.append(el('span', 'qz-av qz-av-lg', initials(r.ten)), el('span', 'qz-step-name', r.ten), el('strong', 'qz-step-p', `${r.p} điểm`), el('small', '', `${r.c}/${n} câu đúng`));
    const block = el('div', 'qz-step-block'); block.append(el('b', 'qz-step-rank', String(place)));
    li.append(who, block); stage.append(li); steps[place] = li;
  }
  const title = el('h3', 'qz-stage-title', rk.length ? 'Bục vinh danh' : 'Chưa có học sinh tham gia');
  main.replaceChildren(title, stage);
  const details = btn('Xem kết quả chi tiết', 't-primary qz-big qz-details', () => drawDetails());
  foot.replaceChildren(details, btn('Tải kết quả CSV', 'qz-csv', exportCsv));
  const wait = (/** @type {number} */ ms) => new Promise(r => setTimeout(r, ms));
  const alive = () => main.dataset.pod === token && room?.phase === 'end';
  for (const place of [3, 2]) { if (!steps[place]) continue; await wait(place === 3 ? 900 : 2000); if (!alive()) return; steps[place].classList.add('is-on'); fx.sfx.reveal(); }
  if (!steps[1]) return;
  await wait(800); if (!alive()) return; fx.sfx.drum(); await wait(1500); if (!alive()) return;
  steps[1].classList.add('is-on'); fx.sfx.fanfare(); fx.confetti(host);
}
/** Kết quả chi tiết: tóm tắt, danh hiệu, bảng xếp hạng đầy đủ, từng câu (phân bố lựa chọn), AI phân tích. */
function drawDetails() {
  if (!room) return;
  delete main.dataset.pod; host.querySelectorAll('.qfx-confetti').forEach(c => c.remove());
  const rk = ranked(), aw = awards(room.score), stats = room.stats.filter(Boolean), n = stats.length;
  const avg = n ? Math.round(stats.reduce((a, s) => a + s.pct, 0) / n) : 0;
  $('qz-h-kicker').textContent = `Kết quả · ${rk.length} em · ${n} câu · đúng trung bình ${avg}%`;
  const tiles = el('ul', 'qz-tiles');
  for (const [v, lab] of [[String(rk.length), 'học sinh'], [String(n), 'câu đã chơi'], [avg + '%', 'đúng trung bình'], [String(rk[0]?.p ?? 0), 'điểm cao nhất']]) { const li = el('li'); li.append(el('strong', '', v), el('span', '', lab)); tiles.append(li); }
  const kids = [tiles];
  if (aw.length) {
    const awBox = el('ul', 'qz-awards');
    for (const a of aw) { const li = el('li'); li.append(el('span', 'qz-aw-ic', a.giai === 'Quán quân' ? '1' : a.giai === 'Chính xác nhất' ? '✓' : a.giai === 'Nhanh như chớp' ? '»' : '∞'), el('strong', '', a.giai), el('span', 'qz-aw-name', a.ten), el('small', '', a.chi_tiet)); awBox.append(li); }
    kids.push(el('h3', 'qz-sub', 'Danh hiệu'), awBox);
  }
  const list = el('ol', 'qz-rank'); list.setAttribute('aria-label', 'Bảng xếp hạng đầy đủ');
  rk.forEach((r, i) => {
    const li = el('li', 'qz-rank-row');
    const bar = el('span', 'qz-acc'); bar.style.setProperty('--w', (n ? Math.round(100 * r.c / n) : 0) + '%'); bar.setAttribute('aria-hidden', 'true');
    const mid = el('span', 'qz-rank-mid'); mid.append(el('span', 'qz-rank-ten', r.ten), bar);
    li.append(el('span', 'qz-rank-badge', String(i + 1)), mid, el('span', 'qz-rank-c', `${r.c}/${n} đúng`), el('strong', 'qz-rank-p', `${r.p} điểm`));
    list.append(li);
  });
  kids.push(el('h3', 'qz-sub', 'Bảng xếp hạng'), list);
  const qs = el('ol', 'qz-stat'); qs.setAttribute('aria-label', 'Kết quả từng câu');
  stats.forEach((s, i) => {
    const tot = Math.max(1, L.reduce((a, x) => a + (s.counts[x] || 0), 0) + (s.counts.none || 0));
    const li = el('li', 'qz-stat-row' + (s.pct < 50 ? ' is-weak' : s.pct >= 80 ? ' is-good' : ''));
    const head = el('div', 'qz-stat-head'); head.append(el('span', 'qz-stat-i', String(i + 1)), el('span', 'qz-stat-text', s.text), el('strong', 'qz-stat-pct', s.pct + '%'));
    const dist = el('div', 'qz-dist'); dist.setAttribute('role', 'img');
    dist.setAttribute('aria-label', L.filter(x => s.opts[x]).map(x => `${x}: ${s.counts[x] || 0} em${x === s.ans ? ' (đúng)' : ''}`).join(', ') + (s.counts.none ? `, chưa trả lời: ${s.counts.none} em` : ''));
    for (const x of [...L, 'none']) { const c = s.counts[x] || 0; if (!c) continue; const seg = el('span', `qz-seg qz-seg-${x}${x === s.ans ? ' is-ans' : ''}`, `${x === 'none' ? '–' : SHAPE[x]} ${c}`); seg.style.setProperty('--w', (100 * c / tot).toFixed(1) + '%'); dist.append(seg); }
    const wrong = L.filter(x => x !== s.ans && s.counts[x]).sort((a, b) => s.counts[b] - s.counts[a])[0];
    const meta = el('p', 'qz-stat-meta', `Đáp án ${SHAPE[s.ans]} ${s.ans}. ${s.opts[s.ans]}${s.topic ? ' · ' + s.topic : ''}${wrong ? ` · Nhiều em nhầm sang ${SHAPE[wrong]} ${wrong}. ${s.opts[wrong]} (${s.counts[wrong]} em)` : ''}`);
    li.append(head, dist, meta); qs.append(li);
  });
  kids.push(el('h3', 'qz-sub', 'Lớp có hiểu bài không?'), n ? qs : el('p', 'qz-hint', 'Chưa có câu nào được công bố đáp án.'));
  const low = rk.filter(r => n && r.c < Math.ceil(n / 2)).map(r => r.ten);
  if (n) kids.push(el('p', 'qz-help', low.length ? `Cần hỗ trợ thêm (đúng dưới một nửa): ${low.join(', ')}` : 'Mọi em đều đúng từ một nửa số câu trở lên.'));
  const aiBox = el('section', 'qz-ai-out'); aiBox.id = 'qz-ai-out'; kids.push(aiBox);
  main.replaceChildren(...kids); main.scrollTop = 0;
  const aiBtn = btn('AI phân tích lớp hiểu bài', 't-primary thi-ai-btn qz-big', () => void analyze(aiBtn)); aiBtn.id = 'qz-ai-analyze'; aiBtn.disabled = !n;
  foot.replaceChildren(aiBtn, btn('Bục vinh danh', 'qz-podium-btn', () => void drawPodium()), btn('Tải kết quả CSV', 'qz-csv', exportCsv));
}
/** @param {HTMLButtonElement} b */
async function analyze(b) {
  if (!room) return; const out = $('qz-ai-out'), label = b.textContent; b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'AI đang phân tích…';
  try {
    const c = cred(), rk = ranked(), stats = room.stats.filter(Boolean);
    const r = await api('/teacher/ai-quiz', { method: 'POST', token: c.tok || undefined, timeout: 60000, body: { title: room.set.name, players: rk.length, avg_pct: stats.length ? Math.round(stats.reduce((a, s) => a + s.pct, 0) / stats.length) : 0, questions: stats.map(s => ({ text: s.text, opts: s.opts, ans: s.ans, topic: s.topic, pct: s.pct, counts: s.counts })), ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
    out.replaceChildren(); if (r.muc_hieu) out.append(el('p', 'qz-muc', 'Mức hiểu: ' + r.muc_hieu));
    for (const line of String(r.nhan_xet || '').split(/\n+/)) { const p = el('p'); for (const [i, part] of line.split(/\*\*/).entries()) p.append(i % 2 ? el('strong', '', part) : document.createTextNode(part)); out.append(p); }
    room.muc = r.muc_hieu; const hist = /** @type {any[]} */ (readLS(histKey(), [])); if (hist[0]) { hist[0].muc = r.muc_hieu; writeLS(histKey(), hist); }
  } catch (e) {
    // AI chưa trả lời được (hết lượt, mạng, máy chủ AI bận): vẫn có nhận xét tính sẵn từ số liệu buổi chơi.
    const sum = classSummary(room?.stats.filter(Boolean) || []);
    out.replaceChildren(el('p', 'qz-ai-note', `AI chưa trả lời được (${e instanceof Error ? e.message : 'lỗi mạng'}). Dưới đây là nhận xét tính sẵn từ số liệu buổi chơi.`));
    if (sum.muc_hieu) out.append(el('p', 'qz-muc', 'Mức hiểu: ' + sum.muc_hieu));
    for (const m of sum.muc) { out.append(el('h4', 'qz-ai-h', m.lab)); const ul = el('ul'); for (const it of m.items) ul.append(el('li', '', it)); out.append(ul); }
  }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = label; }
}
const csvCell = (/** @type {unknown} */ v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function exportCsv() {
  if (!room) return; const rk = ranked(), n = room.stats.filter(Boolean).length;
  const lines = [['Hạng', 'Học sinh', 'Điểm', 'Số câu đúng', 'Tổng câu', 'Chuỗi đúng dài nhất'], ...rk.map((r, i) => [i + 1, r.ten, r.p, r.c, n, r.best])].map(r => r.map(csvCell).join(','));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `luyen-tap-${room.set.lops.join('-')}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function closeRoom() {
  if (!room) { host.hidden = true; document.body.classList.remove('qz-hosting'); return; }
  if (room.phase !== 'end') {
    if (!(await confirmBox({ title: 'Đóng phòng luyện tập?', body: room.phase === 'lobby' ? 'Học sinh đang chờ sẽ thoát khỏi phòng.' : 'Buổi luyện tập đang diễn ra sẽ dừng, không lưu kết quả.', okText: 'Đóng phòng', danger: true }))) return;
    /** @type {Record<string, unknown>} */ const paths = { [P('phase')]: 'end', [P('q')]: null, [P('pause')]: null }; for (const lk of room.lopKeys) paths[`quiz_lop/${lk}`] = null;
    await write(paths).catch(() => {});
  }
  clearInterval(room.timer); room.ansStop?.(); room.stops.forEach(f => f()); room = null;
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
  host.hidden = true; document.body.classList.remove('qz-hosting'); renderSets(); /** @type {HTMLElement|null} */ (document.querySelector('.qz-open'))?.focus();
}
$('qz-h-close').addEventListener('click', () => void closeRoom());
$('nav-tools').addEventListener('click', () => { renderSets(); status(''); void syncSets().then(renderSets); void closeOrphan(); });
document.getElementById('teacher-logout')?.addEventListener('click', () => { if (room) { room.stops.forEach(f => f()); room.ansStop?.(); clearInterval(room.timer); room = null; host.hidden = true; document.body.classList.remove('qz-hosting'); } synced = false; });
void closeOrphan();   // mở trang giáo viên: đóng phòng treo từ lần trước (máy tắt giữa buổi) nếu đã ngừng nhịp
