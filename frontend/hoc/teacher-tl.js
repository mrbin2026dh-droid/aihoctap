// @ts-check
// Tiện ích → tab Thảo luận (kiểu Mentimeter), quy trình giống Luyện tập:
//  1. Tạo bộ thảo luận: AI gợi ý theo bài / tải Excel / tự thêm trang (Đám mây từ khóa, Câu trả lời mở, Bình chọn, Thang điểm 1–5, Hỏi đáp);
//     chọn một hoặc nhiều lớp; lưu trên máy + đồng bộ Firebase tl_bo/{mã băm 64}.
//  2. Mở thảo luận → phòng chờ (mã 6 số, tên em đã vào) → Bắt đầu (đếm ngược 3·2·1) → từng trang: kết quả cập nhật trực tiếp, ẩn danh.
//     Giáo viên: Dừng nhận / Mở lại, Ẩn kết quả, Duyệt / Ẩn từng ý (ẩn một ý thì ẩn mọi ý giống hệt), ẩn từ trong đám mây,
//     đánh dấu câu hỏi đã trả lời, Trang trước / Trang sau, Kết thúc.
//  3. Kết thúc: tổng hợp từng trang, AI gom nhóm ý chính (không gửi tên), tải CSV, lịch sử.
// Chỉ máy có khóa phòng (tl_key) ghi được trạng thái phòng (luật tl_proof), như phòng luyện tập.
import * as store from './thi-store.js';
import { api } from './api.js';
import * as ui from './teacher-ui.js?v=20261030c';
import { confirmBox } from './dom.js';
import * as fx from './quiz-fx.js';
import { MAX_SLIDES, TL_COLUMNS, TYPES, badWord, cleanSlide, cloud, cloudSize, entriesOf, localNotes, parseTlRows, pollCounts, qaRank, scaleStats, slideError, summarize, visible } from './tl-core.js';
import { setClasses } from './quiz-core.js';
import { HB_MS, STALE_MS } from './live-room.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const inp = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const sel = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
/** @typedef {import('./tl-core.js').Slide} Slide */
/** @typedef {{id:string,name:string,lops:string[],cam:string[],slides:Slide[],at:number}} TSet */
const cred = () => { try { return { gv: sessionStorage.getItem('thi-gv-mk') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '', tok: sessionStorage.getItem('aisgk-pwa-teacher') || '' }; } catch { return { gv: '', gv_ma: '', tok: '' }; } };
const who = () => cred().gv_ma || 'admin';
const setsKey = () => `tl-sets-${who().toLowerCase()}`, histKey = () => `tl-hist-${who().toLowerCase()}`, liveKey = () => `tl-live-${who().toLowerCase()}`;
const readLS = (/** @type {string} */ k, /** @type {any} */ d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const writeLS = (/** @type {string} */ k, /** @type {any} */ v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } };
function el(/** @type {string} */ tag, /** @type {string} */ cls = '', /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
function btn(/** @type {string} */ text, /** @type {string} */ cls, /** @type {() => void} */ fn) { const b = /** @type {HTMLButtonElement} */ (el('button', 't-button ' + cls, text)); b.type = 'button'; b.addEventListener('click', fn); return b; }
/** @param {string} msg @param {'error'|'success'|''} [kind] */
function status(msg, kind = '') { const b = $('tl-alert'); $('tl-status').textContent = msg; b.hidden = !msg; b.className = 'notice status thi-alert ' + (kind === 'error' ? 'error' : 'success'); }

/* ---------- Tab Luyện tập | Thảo luận ---------- */
const tabs = [['tab-tools-quiz', 'tools-p-quiz'], ['tab-tools-tl', 'tools-p-tl'], ['tab-tools-td', 'tools-p-td']];
function pickTab(/** @type {string} */ id, focus = false) {
  for (const [t, p] of tabs) { const on = t === id; $(t).setAttribute('aria-selected', String(on)); $(t).tabIndex = on ? 0 : -1; $(p).hidden = !on; }
  try { sessionStorage.setItem('tools-tab', id); } catch { /* bỏ qua */ }
  if (focus) $(id).focus();
  if (id === 'tab-tools-tl') { renderSets(); void syncSets().then(renderSets); void closeOrphan(); }
  document.dispatchEvent(new CustomEvent('tools-tab', { detail: id }));   // tab Thi đua (teacher-thidua.js) tự tải
}
for (const [t] of tabs) {
  $(t).addEventListener('click', () => pickTab(t));
  $(t).addEventListener('keydown', ev => { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; ev.preventDefault(); const i = tabs.findIndex(x => x[0] === t); pickTab(tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0], true); });
}

/* ---------- Lưu bộ thảo luận ---------- */
const ownerKey = () => { const c = cred(); const secret = c.gv || c.tok; return secret ? store.sha256(`thao-luan|${who().toLowerCase()}|${secret}`) : ''; };
/** @param {any} s @returns {TSet} */
const normSet = s => ({ id: String(s.id), name: String(s.name || ''), lops: setClasses(s), cam: (Array.isArray(s.cam) ? s.cam : Object.values(s.cam || {})).map(String).filter(Boolean).slice(0, 40), slides: (Array.isArray(s.slides) ? s.slides : Object.values(s.slides || {})).map(cleanSlide), at: Number(s.at) || 0 });
/** @returns {TSet[]} */ const sets = () => /** @type {any[]} */ (readLS(setsKey(), [])).map(normSet);
/** @param {TSet} s */ const pack = s => ({ name: s.name, lops: s.lops, cam: s.cam, slides: s.slides, at: s.at });
let synced = false;
async function syncSets() {
  const owner = ownerKey(); if (!owner || !store.enabled()) return;
  try {
    const remote = await store.get(`tl_bo/${owner}`);
    /** @type {Record<string, TSet>} */ const byId = {}; for (const s of sets()) byId[s.id] = s;
    for (const [id, s] of Object.entries(remote || {})) { if (!s) continue; const r = normSet({ ...s, id }); if (!byId[id] || r.at > byId[id].at) byId[id] = r; }
    const merged = Object.values(byId); writeLS(setsKey(), merged);
    for (const s of merged) if (!remote?.[s.id] || Number(remote[s.id].at) < s.at) void store.put(`tl_bo/${owner}/${s.id}`, pack(s)).catch(() => {});
    synced = true;
  } catch { synced = false; }
}
/** @param {TSet} s */
async function saveSet(s) {
  writeLS(setsKey(), [s, ...sets().filter(x => x.id !== s.id)]);
  const owner = ownerKey(); if (!owner) return false;
  try { await store.put(`tl_bo/${owner}/${s.id}`, pack(s)); return true; } catch { return false; }
}
const typeCount = (/** @type {TSet} */ s) => Object.entries(s.slides.reduce((/** @type {Record<string,number>} */ a, x) => { a[x.type] = (a[x.type] || 0) + 1; return a; }, {})).map(([k, v]) => `${v} ${TYPES[/** @type {keyof typeof TYPES} */ (k)].toLowerCase()}`).join(', ');
function renderSets() {
  const box = $('tl-sets'); box.replaceChildren();
  const list = sets().sort((a, b) => b.at - a.at);
  if (!list.length) { const li = el('li', 't-card qz-empty tl-empty'); li.append(el('h3', '', 'Chưa có bộ thảo luận'), el('p', 't-muted', 'Bấm "Tạo bộ thảo luận": AI gợi ý theo bài, tải file Excel hoặc tự thêm câu hỏi.')); box.append(li); }
  for (const s of list) {
    const li = el('li', 't-card qz-set tl-set');
    const info = el('div', 'qz-set-info'); info.append(el('h3', '', s.name));
    const meta = el('p', 'qz-set-meta'); meta.append(el('span', '', `${s.slides.length} câu hỏi`), el('span', '', typeCount(s)));
    const chips = el('ul', 'qz-lop-chips'); for (const l of s.lops) chips.append(el('li', '', 'Lớp ' + l));
    info.append(meta, chips);
    const acts = el('div', 'qz-set-acts');
    const open = btn('Mở thảo luận', 't-primary qz-open tl-open', () => void startRoom(s)); open.setAttribute('aria-label', `Mở thảo luận: ${s.name}`);
    acts.append(open, ui.iconButton({ icon: 'edit', label: `Sửa: ${s.name}`, onClick: () => void openEditor(s) }), ui.iconButton({ icon: 'trash', label: `Xóa: ${s.name}`, danger: true, onClick: () => void removeSet(s) }));
    li.append(info, acts); box.append(li);
  }
  $('tl-sync').textContent = ownerKey() ? (synced ? 'Bộ thảo luận đã đồng bộ, mở được trên máy khác khi đăng nhập cùng tài khoản.' : 'Bộ thảo luận đang lưu trên máy này (chưa đồng bộ được lên mạng).') : '';
  const hb = $('tl-history'); hb.replaceChildren();
  const hist = /** @type {any[]} */ (readLS(histKey(), [])).slice(0, 8);
  if (!hist.length) hb.append(el('li', 't-muted', 'Chưa có buổi thảo luận nào.'));
  for (const h of hist) { const li = el('li'); li.append(el('strong', '', `${h.name} · ${(h.lops || []).map((/** @type {string} */ x) => 'Lớp ' + x).join(', ')}`), el('span', '', `${new Date(h.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${h.players} em · ${h.ideas} ý kiến`)); hb.append(li); }
}
/** @param {TSet} s */
async function removeSet(s) {
  if (!(await confirmBox({ title: 'Xóa bộ thảo luận?', body: `"${s.name}" (${s.slides.length} câu hỏi) sẽ bị xóa trên máy này và trên mạng. Không khôi phục được.`, okText: 'Xóa bộ thảo luận', danger: true }))) return;
  writeLS(setsKey(), sets().filter(x => x.id !== s.id));
  const owner = ownerKey(); if (owner) await store.put(`tl_bo/${owner}/${s.id}`, null).catch(() => {});
  renderSets(); status(`Đã xóa "${s.name}".`, 'success');
}

/* ---------- Soạn bộ thảo luận ---------- */
/** @type {TSet|null} */ let editing = null;
async function classes() {
  try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); if (t && Array.isArray(t.lop) && cred().gv_ma) return t.lop.map(String); } catch { /* bỏ qua */ }
  // Chỉ mục lớp nhỏ (Google Sheet đẩy kèm từ 29/10); chưa có thì đọc cả danh sách học sinh như trước
  const idx = await store.get('thi_lop').catch(() => undefined);
  if (idx && typeof idx === 'object') return [...new Set(Object.values(idx).map((/** @type {any} */ x) => String(x?.lop || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const hs = await store.get('thi_hs').catch(() => undefined);
  if (hs === undefined) return null;
  return [...new Set(Object.values(hs || {}).map((/** @type {any} */ s) => String(s?.lop || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}
const TYPE_HINT = /** @type {Record<string,string>} */ ({ cloud: 'Mỗi em gửi 1–3 từ khóa ngắn (≤ 25 ký tự). Từ được gửi nhiều hiện to hơn.', open: 'Mỗi em gửi một ý kiến (≤ 200 ký tự).', poll: 'Mỗi em chọn một ý. Không có đáp án đúng sai.', scale: 'Mỗi em chấm 1–5 cho từng tiêu chí.', qa: 'Học sinh đặt câu hỏi, các bạn bấm "Cùng thắc mắc" để đẩy câu hỏi lên.' });
/** Một trang trong trình soạn. @param {Partial<Slide>} [s] */
function slideRow(s = { type: 'open' }) {
  const type = /** @type {keyof typeof TYPES} */ (s.type && s.type in TYPES ? s.type : 'open');
  const fs = el('fieldset', 'thi-qe tl-slide-ed'); fs.dataset.type = type;
  const lg = el('legend'); fs.append(lg);
  const uid = Math.random().toString(36).slice(2, 8);
  const field = (/** @type {string} */ label, /** @type {HTMLElement} */ ctl, cls = '') => { const w = el('div', 't-field ' + cls); const l = /** @type {HTMLLabelElement} */ (el('label', '', label)); ctl.id = `tl-${uid}-${cls || Math.random().toString(36).slice(2, 6)}`; l.htmlFor = ctl.id; w.append(l, ctl); return w; };
  const head = el('div', 'tl-ed-head');
  const ts = /** @type {HTMLSelectElement} */ (el('select', 'tl-type')); for (const [k, v] of Object.entries(TYPES)) ts.append(new Option(v, k)); ts.value = type;
  ts.addEventListener('change', () => { const cur = readSlide(fs); fs.replaceWith(slideRow({ ...cur, type: /** @type {any} */ (ts.value) })); slideNumber(); });
  head.append(field('Loại', ts, 'f-type'), ui.iconButton({ icon: 'trash', label: 'Xóa trang này', danger: true, onClick: () => { fs.remove(); slideNumber(); } }));
  fs.append(head, el('p', 't-hint tl-type-hint', TYPE_HINT[type]));
  const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'tl-text')); text.maxLength = 300; text.rows = 2; text.value = s.text || '';
  fs.append(field('Câu hỏi thảo luận', text, 'f-text'));
  if (type === 'poll' || type === 'scale') {
    const list = (type === 'poll' ? s.opts : s.items) || [];
    const grid = el('div', 'thi-qe-opts tl-opts');
    for (let i = 0; i < 6; i++) { const o = /** @type {HTMLInputElement} */ (el('input', 'tl-opt')); o.maxLength = 80; o.value = list[i] || ''; grid.append(field(`${type === 'poll' ? 'Lựa chọn' : 'Tiêu chí'} ${i + 1}`, o, 'f-o' + i)); }
    fs.append(el('p', 't-hint tl-opts-hint', type === 'poll' ? 'Điền ít nhất 2 lựa chọn; các ô còn lại để trống nếu không dùng.' : 'Điền ít nhất 1 tiêu chí; học sinh chấm 1–5 cho từng tiêu chí.'), grid);
  }
  if (type === 'cloud' || type === 'qa') {
    const mx = /** @type {HTMLSelectElement} */ (el('select', 'tl-max')); for (const v of [1, 2, 3]) mx.append(new Option(`${v} ${type === 'cloud' ? 'từ khóa' : 'câu hỏi'}`, String(v))); mx.value = String(s.max || (type === 'cloud' ? 3 : 2));
    fs.append(field('Mỗi em gửi tối đa', mx, 'f-max'));
  }
  if (type === 'open' || type === 'qa') {
    const lab = el('label', 'thi-qe-ok tl-mod'); const c = /** @type {HTMLInputElement} */ (el('input', 'tl-mod-in')); c.type = 'checkbox'; c.checked = s.mod !== false;
    lab.append(c, document.createTextNode(' Duyệt trước khi hiện lên màn chiếu (nên bật với học sinh THCS)')); fs.append(lab);
  }
  return fs;
}
/** @param {Element} fs @returns {Slide} */
function readSlide(fs) {
  const type = /** @type {any} */ (/** @type {HTMLSelectElement} */ (fs.querySelector('.tl-type')).value);
  const list = [...fs.querySelectorAll('.tl-opt')].map(x => /** @type {HTMLInputElement} */ (x).value);
  return cleanSlide({ type, text: /** @type {HTMLTextAreaElement} */ (fs.querySelector('.tl-text')).value, opts: list, items: list, max: /** @type {HTMLSelectElement|null} */ (fs.querySelector('.tl-max'))?.value, mod: /** @type {HTMLInputElement|null} */ (fs.querySelector('.tl-mod-in'))?.checked });
}
function slideNumber() { const fs = $('tl-list').querySelectorAll('.tl-slide-ed'); fs.forEach((f, i) => { const lg = f.querySelector('legend'); if (lg) lg.textContent = `Câu ${i + 1}`; }); $('tl-count').textContent = fs.length ? `${fs.length} câu hỏi` : ''; }
/** @param {Partial<Slide>[]} list */
function appendSlides(list) { for (const f of [...$('tl-list').querySelectorAll('.tl-slide-ed')]) if (!/** @type {HTMLTextAreaElement} */ (f.querySelector('.tl-text')).value.trim()) f.remove(); for (const s of list) $('tl-list').append(slideRow(s)); slideNumber(); }
/** @param {TSet|null} s */
async function openEditor(s) {
  editing = s; $('tl-ed-title').textContent = s ? 'Sửa bộ thảo luận' : 'Tạo bộ thảo luận';
  inp('tl-name').value = s?.name || ''; inp('tl-cam').value = (s?.cam || []).join(', ');
  for (const id of ['tl-name', 'tl-lops']) { $(id).removeAttribute('aria-invalid'); $(id + '-err').textContent = ''; }
  $('tl-form-err').textContent = ''; for (const id of ['tl-ai-box', 'tl-xl-box']) $(id).hidden = true;
  $('tl-list').replaceChildren(...(s?.slides?.length ? s.slides : [{ type: 'cloud' }]).map(x => slideRow(x))); slideNumber();
  await ui.showSub('detail-tl');
  await loadLops(s); inp('tl-name').focus();
}
/** @param {TSet|null} s */
async function loadLops(s) {
  const box = $('tl-lops'), chosen = new Set(s ? s.lops : []);
  box.replaceChildren(el('p', 't-muted ld-inline', 'Đang tải danh sách lớp…'));
  const lops = await classes(); box.replaceChildren();
  if (lops === null) { const n = el('div', 'notice error qz-lops-retry'); n.append(el('span', '', 'Chưa tải được danh sách lớp (mạng chậm).'), btn('Thử lại', 'tl-lops-again', () => void loadLops(s))); box.append(n); return; }
  if (!lops.length) { box.append(el('p', 't-muted', 'Chưa có lớp nào có học sinh. Thêm học sinh ở mục Tài khoản trước.')); return; }
  if (lops.length === 1 && !s) chosen.add(lops[0]);
  for (const l of lops) { const lab = el('label', 'qz-lop-pick'); const c = /** @type {HTMLInputElement} */ (el('input')); c.type = 'checkbox'; c.value = l; c.checked = chosen.has(l); lab.append(c, el('span', '', 'Lớp ' + l)); box.append(lab); }
}
const pickedLops = () => [...$('tl-lops').querySelectorAll('input[type=checkbox]:checked')].map(c => /** @type {HTMLInputElement} */ (c).value);
$('tl-new').addEventListener('click', () => void openEditor(null));
$('tl-list').addEventListener('input', ev => { $('tl-form-err').textContent = ''; /** @type {HTMLElement} */ (ev.target).removeAttribute?.('aria-invalid'); });
for (const b of document.querySelectorAll('.tl-add-type')) b.addEventListener('click', () => { const r = slideRow({ type: /** @type {any} */ (/** @type {HTMLElement} */ (b).dataset.type) }); $('tl-list').append(r); slideNumber(); r.scrollIntoView({ block: 'nearest' }); /** @type {HTMLElement} */ (r.querySelector('.tl-text')).focus(); });
$('tl-lops').addEventListener('change', () => { $('tl-lops').removeAttribute('aria-invalid'); $('tl-lops-err').textContent = ''; });
$('tl-lops-all').addEventListener('click', () => { const cs = [...$('tl-lops').querySelectorAll('input[type=checkbox]')]; const all = cs.every(c => /** @type {HTMLInputElement} */ (c).checked); cs.forEach(c => { /** @type {HTMLInputElement} */ (c).checked = !all; }); $('tl-lops').removeAttribute('aria-invalid'); $('tl-lops-err').textContent = ''; });
$('tl-form').addEventListener('submit', async ev => {
  ev.preventDefault(); $('tl-form-err').textContent = '';
  const name = inp('tl-name'), lopBox = $('tl-lops');
  for (const n of [name, lopBox]) { n.removeAttribute('aria-invalid'); $(n.id + '-err').textContent = ''; }
  if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); $('tl-name-err').textContent = 'Nhập tên bộ thảo luận.'; name.focus(); return; }
  const lops = pickedLops();
  if (!lops.length) { lopBox.setAttribute('aria-invalid', 'true'); $('tl-lops-err').textContent = 'Chọn ít nhất một lớp.'; /** @type {HTMLElement|null} */ (lopBox.querySelector('input'))?.focus(); return; }
  const rows = [...$('tl-list').querySelectorAll('.tl-slide-ed')];
  if (!rows.length) { $('tl-form-err').textContent = 'Thêm ít nhất một câu hỏi.'; return; }
  if (rows.length > MAX_SLIDES) { $('tl-form-err').textContent = `Tối đa ${MAX_SLIDES} câu hỏi mỗi bộ.`; return; }
  /** @type {Slide[]} */ const slides = [];
  for (const [i, f] of rows.entries()) {
    const s = readSlide(f), err = slideError(s);
    if (err) { $('tl-form-err').textContent = `Câu ${i + 1}: ${err}`; const t = /** @type {HTMLElement} */ (f.querySelector(s.text ? '.tl-opt' : '.tl-text') || f.querySelector('.tl-text')); t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
    slides.push(s);
  }
  const save = /** @type {HTMLButtonElement} */ ($('tl-save')); save.disabled = true; save.setAttribute('aria-busy', 'true'); const label = save.textContent; save.textContent = 'Đang lưu…';
  /** @type {TSet} */ const s = { id: editing?.id || 'tl' + Date.now().toString(36), name: name.value.trim(), lops, cam: inp('tl-cam').value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).slice(0, 40), slides, at: Date.now() };
  const online = await saveSet(s);
  save.disabled = false; save.removeAttribute('aria-busy'); save.textContent = label;
  synced = online || synced; renderSets(); void ui.goBack(); pickTab('tab-tools-tl');
  status(`Đã lưu "${s.name}" (${s.slides.length} câu hỏi, ${s.lops.map(l => 'lớp ' + l).join(', ')}).` + (online ? '' : ' Chưa đồng bộ lên mạng được: bộ thảo luận đang lưu trên máy này.'), 'success');
});
/* AI gợi ý câu hỏi thảo luận */
/** @type {{key:string,title:string,grade:number,course_id:string,lesson_id:string}[]} */ let lessons = [];
$('tl-ai').addEventListener('click', async () => {
  $('tl-xl-box').hidden = true; const box = $('tl-ai-box'); box.hidden = !box.hidden; if (box.hidden) return;
  $('tl-ai-err').textContent = '';
  if (!lessons.length) { sel('tl-ai-lesson').replaceChildren(new Option('Đang tải bài học…', '')); try { const cat = await api('/pwa/catalog'); for (const c of cat?.courses || []) for (const l of c.lessons || []) lessons.push({ key: c.id + '|' + l.id, title: l.title, grade: Number(c.grade) || 0, course_id: c.id, lesson_id: l.id }); } catch { $('tl-ai-err').textContent = 'Chưa tải được danh sách bài học.'; } }
  const grades = new Set(pickedLops().map(l => Number(String(l).match(/^\d+/)?.[0]) || 0)), list = lessons.filter(l => !grades.size || grades.has(l.grade));
  sel('tl-ai-lesson').replaceChildren(...(list.length ? list : lessons).map(l => new Option(`${l.title} · Lớp ${l.grade}`, l.key)));
});
$('tl-ai-go').addEventListener('click', async () => {
  const l = lessons.find(x => x.key === sel('tl-ai-lesson').value); $('tl-ai-err').textContent = '';
  if (!l) { $('tl-ai-err').textContent = 'Chọn bài học.'; return; }
  const nIn = inp('tl-ai-n'), nVal = Number(nIn.value); nIn.removeAttribute('aria-invalid');
  if (!Number.isInteger(nVal) || nVal < 1 || nVal > 10) { nIn.setAttribute('aria-invalid', 'true'); $('tl-ai-err').textContent = 'Nhập số câu hỏi từ 1 đến 10.'; nIn.focus(); return; }
  const b = /** @type {HTMLButtonElement} */ ($('tl-ai-go')), label = b.textContent; b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'AI đang gợi ý… (10–30 giây)';
  try {
    const c = cred();
    const r = await api('/teacher/ai-tl', { method: 'POST', token: c.tok || undefined, timeout: 90000, body: { mode: 'goi_y', course_id: l.course_id, lesson_id: l.lesson_id, n: nVal, topic: inp('tl-ai-topic').value.trim(), ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
    const list = (r?.slides || []).map(cleanSlide).filter((/** @type {Slide} */ s) => !slideError(s));
    if (!list.length) throw new Error('AI chưa gợi ý được câu hỏi. Thử lại.');
    appendSlides(list); $('tl-ai-box').hidden = true;
    if (!inp('tl-name').value.trim()) inp('tl-name').value = 'Thảo luận: ' + l.title;
    status(`AI đã gợi ý ${list.length} câu hỏi. Đọc lại, sửa cho phù hợp lớp trước khi lưu.`, 'success');
  } catch (e) { $('tl-ai-err').textContent = e instanceof Error ? e.message : 'AI chưa gợi ý được.'; }
  finally { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = label; }
});
/* Excel */
/** @type {Map<string, Promise<void>>} */ const scripts = new Map();
const loadScript = (/** @type {string} */ src) => { if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => { const t = document.createElement('script'); t.src = src; t.onload = () => res(); t.onerror = () => { scripts.delete(src); rej(new Error('Không tải được bộ đọc Excel. Kiểm tra mạng rồi thử lại.')); }; document.head.append(t); })); return /** @type {Promise<void>} */ (scripts.get(src)); };
$('tl-xl').addEventListener('click', () => { $('tl-ai-box').hidden = true; const box = $('tl-xl-box'); box.hidden = !box.hidden; $('tl-xl-err').textContent = ''; });
$('tl-xl-template').addEventListener('click', async () => {
  try {
    await loadScript('./vendor/write-excel-file.min.js');
    const cell = (/** @type {unknown} */ v, bold = false) => typeof v === 'number' ? { value: v, type: Number, ...(bold ? { fontWeight: 'bold' } : {}) } : { value: String(v ?? ''), ...(bold ? { fontWeight: 'bold' } : {}) };
    const rows = [TL_COLUMNS, [1, 'Đám mây', 'Nghĩ đến Internet, em nghĩ đến từ gì?', '', '', '', '', '', '', 2], [2, 'Trả lời mở', 'Theo em, dùng mạng xã hội có lợi gì cho học tập?', '', '', '', '', '', '', ''], [3, 'Bình chọn', 'Mỗi ngày em dùng Internet bao lâu?', 'Dưới 1 giờ', '1–2 giờ', '2–4 giờ', 'Trên 4 giờ', '', '', ''], [4, 'Thang điểm', 'Em tự đánh giá sau bài học', 'Hiểu bài', 'Hứng thú', 'Tự tin làm bài', '', '', '', ''], [5, 'Hỏi đáp', 'Em còn thắc mắc gì về bài học?', '', '', '', '', '', '', 2]];
    const guide = [['Hướng dẫn'], ['Mỗi dòng một câu hỏi. Giữ nguyên dòng tiêu đề.'], ['Cột Loại: Đám mây, Trả lời mở, Bình chọn, Thang điểm, Hỏi đáp.'], ['Bình chọn: ghi 2–6 lựa chọn. Thang điểm: ghi 1–6 tiêu chí (học sinh chấm 1–5).'], ['Số ý mỗi em: dùng cho Đám mây và Hỏi đáp (1–3).'], [`Tối đa ${MAX_SLIDES} câu hỏi mỗi bộ.`]];
    // @ts-ignore thư viện nạp bằng thẻ script
    await globalThis.writeXlsxFile([{ data: rows.map((r, i) => r.map(v => cell(v, i === 0))), sheet: 'Thảo luận', columns: [6, 14, 48, 18, 18, 18, 18, 18, 18, 12].map(width => ({ width })), stickyRowsCount: 1 }, { data: guide.map((r, i) => r.map(v => cell(v, i === 0))), sheet: 'Hướng dẫn', columns: [{ width: 100 }] }]).toFile('mau-thao-luan.xlsx');
  } catch (e) { $('tl-xl-err').textContent = e instanceof Error ? e.message : 'Chưa tạo được file mẫu.'; }
});
$('tl-xl-file').addEventListener('change', async () => {
  const f = inp('tl-xl-file').files?.[0]; inp('tl-xl-file').value = ''; const err = $('tl-xl-err'); err.textContent = '';
  if (!f) return;
  if (!/\.xlsx$/i.test(f.name)) { err.textContent = 'Chỉ nhận file .xlsx. Hãy dùng file mẫu.'; return; }
  if (f.size > 2 * 1024 * 1024) { err.textContent = 'File lớn hơn 2 MB.'; return; }
  try {
    await loadScript('./vendor/read-excel-file.min.js');
    // @ts-ignore thư viện nạp bằng thẻ script
    const res = await globalThis.readXlsxFile(f);
    const rows = Array.isArray(res) && res.length && res[0] && !Array.isArray(res[0]) && res[0].data ? res[0].data : res;
    const p = parseTlRows(rows);
    if (p.fatal) { err.textContent = p.fatal; return; }
    appendSlides(p.slides); $('tl-xl-box').hidden = p.errors.length === 0;
    if (!inp('tl-name').value.trim()) inp('tl-name').value = f.name.replace(/\.xlsx$/i, '');
    if (p.errors.length) err.textContent = `Đã thêm ${p.slides.length} câu hỏi. Bỏ qua: ${p.errors.slice(0, 5).join(' ')}${p.errors.length > 5 ? ' …' : ''}`;
    else status(`Đã thêm ${p.slides.length} câu hỏi từ file "${f.name}".`, 'success');
  } catch (e) { err.textContent = e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file. Hãy dùng file .xlsx tải từ mẫu.'; }
});

/* ---------- Phòng thảo luận (máy chiếu) ---------- */
/** @typedef {{ok:Record<string,boolean>,an:Record<string,boolean>,anw:string[],done:Record<string,boolean>}} SlideState */
/** @type {null|{room:string,key:string,set:TSet,i:number,phase:'lobby'|'ready'|'open'|'closed'|'end',players:Record<string,{ten:string}>,y:Record<string,any>,votes:Record<string,any>,st:Record<string,SlideState>,hide:boolean,names:boolean,lopKeys:string[],stops:(()=>void)[],yStop?:()=>void,vStop?:()=>void,raf:number,seen:Set<string>}} */ let room = null;
const host = $('tl-host'), main = $('tl-h-main'), foot = $('tl-h-foot');
const rnd = (/** @type {number} */ n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
let proofN = 0;
/** @param {Record<string, unknown>} paths */
const write = paths => { if (!room) return Promise.resolve(); return store.patch('', { ...paths, [`tl_proof/${room.room}`]: `${room.key}|${Date.now().toString(36)}${(++proofN).toString(36)}` }); };
const P = (/** @type {string} */ k) => `tl/${room?.room}/pub/${k}`;
const K = (/** @type {number} */ i) => 's' + i;
const initials = (/** @type {string} */ v) => String(v || '?').trim().split(/\s+/).slice(-1)[0].slice(0, 1).toUpperCase();
const nameOf = (/** @type {string} */ ma) => String(room?.players?.[ma]?.ten || ma);
const stOf = (/** @type {number} */ i) => { if (!room) return { ok: {}, an: {}, anw: [], done: {} }; return room.st[K(i)] ||= { ok: {}, an: {}, anw: [], done: {} }; };

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
  /** @type {Record<string, unknown>} */ const paths = { [`tl/${live.room}/pub/phase`]: 'end', [`tl_proof/${live.room}`]: `${live.key}|${Date.now().toString(36)}x` };
  for (const lk of live.lopKeys || []) paths[`tl_lop/${lk}`] = null;
  await store.patch('', paths).catch(() => {});
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
}
/** @param {TSet} s */
async function startRoom(s) {
  if (!store.enabled()) { status('Chưa cài dự án Firebase (presence-config.js).', 'error'); return; }
  if (room) { openHost(); return; }
  if (!s.lops.length) { status('Bộ thảo luận chưa chọn lớp. Bấm Sửa để chọn lớp.', 'error'); return; }
  await closeOrphan(true);
  const key = [...rnd(24)].map(b => b.toString(16).padStart(2, '0')).join('');
  let code = '';
  for (let t = 0; t < 6 && !code; t++) { const c = String(100000 + ([...rnd(4)].reduce((a, b) => a * 256 + b, 0) % 900000)); try { await store.put(`tl_key/${c}`, key); code = c; } catch { /* trùng mã */ } }
  if (!code) { status('Chưa tạo được phòng. Kiểm tra mạng rồi thử lại.', 'error'); return; }
  room = { room: code, key, set: s, i: -1, phase: 'lobby', players: {}, y: {}, votes: {}, st: {}, hide: false, names: false, lopKeys: s.lops.map(l => store.keyOf(l)), stops: [], raf: 0, seen: new Set() };
  /** @type {Record<string, unknown>} */ const paths = { [`tl/${code}/pub`]: { phase: 'lobby', title: s.name, lops: s.lops, n: s.slides.length, cam: s.cam, at: store.SERVER_TIME, hb: store.SERVER_TIME } };
  for (const lk of room.lopKeys) paths[`tl_lop/${lk}`] = code;
  try { await write(paths); } catch (e) { status('Chưa mở được phòng: ' + (e instanceof Error ? e.message : ''), 'error'); room = null; return; }
  writeLS(liveKey(), { room: code, key, setId: s.id, lopKeys: room.lopKeys, hbAt: Date.now() });
  beat(code);
  room.stops.push(store.listen(`tl/${code}/ds`, d => { if (!room) return; const before = Object.keys(room.players).length; room.players = d || {}; if (Object.keys(room.players).length > before) fx.sfx.join(); if (room.phase === 'lobby') drawLobby(); else schedule(); }, undefined, { prio: 2 }));
  main.dataset.n = '0'; openHost(); drawLobby();
}
function openHost() { host.hidden = false; document.body.classList.add('qz-hosting'); $('tl-h-close').focus(); }
function drawLobby() {
  if (!room) return;
  $('tl-h-kicker').textContent = `${room.set.lops.map(l => 'Lớp ' + l).join(', ')} · ${room.set.slides.length} câu hỏi · ẩn danh`; $('tl-h-title').textContent = room.set.name;
  const n = Object.keys(room.players).length;
  const code = el('div', 'qz-code'); code.append(el('span', '', 'Mã phòng'), el('strong', '', room.room.replace(/(\d{3})(\d{3})/, '$1 $2')));
  const hint = el('p', 'qz-hint', `Học sinh ${room.set.lops.map(l => 'lớp ' + l).join(', ')} đăng nhập AI Học Tập → mục Luyện tập → thẻ Thảo luận → Vào phòng.`);
  const chips = el('ul', 'qz-chips'); chips.setAttribute('aria-label', 'Học sinh đã vào phòng'); for (const v of Object.values(room.players)) chips.append(el('li', '', String(/** @type {any} */ (v)?.ten || '')));
  const count = el('p', 'qz-count', n ? `${n} học sinh đã vào phòng` : 'Đang chờ học sinh vào phòng…'); count.setAttribute('aria-live', 'polite');
  main.replaceChildren(code, hint, count, chips);
  const go = btn('Bắt đầu', 't-primary qz-big', () => void startTalk()); go.disabled = !n; go.id = 'tl-start';
  foot.replaceChildren(go, fx.soundToggle('t-button qz-sound'));
}
async function startTalk() {
  if (!room || room.phase !== 'lobby') return;
  room.phase = 'ready'; foot.replaceChildren(); main.replaceChildren();
  await write({ [P('phase')]: 'ready', [P('ready')]: store.SERVER_TIME }).catch(() => {});
  await fx.countdown(host, { title: room.set.name });
  await goSlide(0);
}
/** Chuyển trang: phát câu hỏi + trạng thái duyệt/ẩn của trang đó, nghe ý kiến trang đó. @param {number} i */
async function goSlide(i) {
  if (!room || i < 0 || i >= room.set.slides.length) return;
  room.i = i; room.phase = 'open'; room.hide = false;
  const s = room.set.slides[i], k = K(i), st = stOf(i);
  room.y = {}; room.votes = {}; room.yStop?.(); room.vStop?.(); room.vStop = undefined;
  await write({ [P('phase')]: 'open', [P('i')]: i, [P('slide')]: { k, ...s }, [P('hide')]: false, [P('ok')]: st.ok, [P('an')]: st.an, [P('anw')]: st.anw, [P('done')]: st.done, [P('ready')]: null }).catch(() => {});
  room.yStop = store.listen(`tl/${room.room}/y/${k}`, d => { if (!room || room.i !== i) return; room.y = d || {}; noteNew(); schedule(); }, undefined, { prio: 3 });
  if (s.type === 'qa') room.vStop = store.listen(`tl/${room.room}/vote/${k}`, d => { if (!room || room.i !== i) return; room.votes = d || {}; schedule(); }, undefined, { prio: 2 });
  drawSlide();
}
/** Tiếng "tách" nhẹ khi có ý mới. */
function noteNew() { if (!room) return; let fresh = false; for (const e of entriesOf(room.y)) if (!room.seen.has(e.id)) { room.seen.add(e.id); fresh = true; } if (fresh) fx.sfx.tick(); }
function schedule() { if (!room || room.raf) return; room.raf = requestAnimationFrame(() => { if (!room) return; room.raf = 0; if (room.phase === 'open' || room.phase === 'closed') drawSlide(); }); }
/** Lưu trạng thái duyệt/ẩn của trang hiện tại lên phòng. @param {Partial<SlideState>} patch */
async function setSt(patch) {
  if (!room) return; const st = stOf(room.i); Object.assign(st, patch);
  /** @type {Record<string, unknown>} */ const paths = {}; for (const k of Object.keys(patch)) paths[P(k)] = /** @type {any} */ (st)[k];
  schedule(); await write(paths).catch(() => {});
}

/** Vẽ kết quả một trang (dùng cho trình chiếu trực tiếp và màn tổng kết). @param {Slide} s @param {ReturnType<typeof entriesOf>} list @param {SlideState} st @param {any} votes @param {boolean} live */
function renderResult(s, list, st, votes, live) {
  const cam = room?.set.cam || [];
  const box = el('div', 'tl-res tl-res-' + s.type);
  if (s.type === 'cloud') {
    const words = cloud(list.map(e => e.v), st.anw, cam);
    if (!words.length) { box.append(el('p', 'tl-empty-res', 'Chưa có từ khóa nào.')); return box; }
    const max = words[0].n, wrap = el('ul', 'tl-cloud'); wrap.setAttribute('aria-label', 'Đám mây từ khóa');
    // xếp từ to ở giữa: chèn lần lượt trái/phải
    const order = []; words.forEach((w, j) => { if (j % 2) order.push(w); else order.unshift(w); });
    order.forEach((w, j) => {
      const li = el('li', 'tl-word tl-c' + (j % 6)); li.style.setProperty('--fs', cloudSize(w.n, max, 18, live ? 84 : 48) + 'px');
      if (live) { const b = btn(w.w, 'tl-word-btn', () => void hideWord(w.w)); b.setAttribute('aria-label', `${w.w}: ${w.n} lần. Bấm để ẩn từ này`); b.title = `${w.n} lần · bấm để ẩn`; li.append(b); } else li.append(el('span', '', w.w));
      wrap.append(li);
    });
    box.append(wrap); return box;
  }
  if (s.type === 'poll') {
    const c = pollCounts(list.map(e => e.v), (s.opts || []).length), tot = c.reduce((a, b) => a + b, 0), max = Math.max(1, ...c);
    const ul = el('ul', 'tl-bars');
    (s.opts || []).forEach((o, j) => { const li = el('li', 'tl-bar tl-c' + (j % 6)); const fill = el('span', 'tl-bar-fill'); fill.style.setProperty('--w', Math.round(100 * c[j] / max) + '%'); li.append(el('span', 'tl-bar-label', o), fill, el('strong', 'tl-bar-n', `${c[j]} · ${tot ? Math.round(100 * c[j] / tot) : 0}%`)); ul.append(li); });
    box.append(ul); return box;
  }
  if (s.type === 'scale') {
    const sc = scaleStats(list.map(e => e.v), (s.items || []).length);
    const ul = el('ul', 'tl-scales');
    (s.items || []).forEach((it, j) => {
      const li = el('li', 'tl-scale-row'); const track = el('span', 'tl-scale-track'); track.setAttribute('aria-hidden', 'true');
      const dot = el('span', 'tl-scale-dot'); dot.style.setProperty('--x', ((sc[j].avg - 1) / 4 * 100 || 0) + '%'); track.append(dot);
      li.append(el('span', 'tl-scale-label', it), track, el('strong', 'tl-scale-avg', sc[j].n ? `${String(sc[j].avg).replace('.', ',')}/5` : '–'), el('small', 'tl-scale-n', `${sc[j].n} em`)); ul.append(li);
    });
    box.append(el('p', 'tl-scale-ends', '1 · rất thấp ←→ rất cao · 5'), ul); return box;
  }
  const shown = visible(list, st.an).filter(e => !badWord(e.v, cam));
  const wall = s.mod ? shown.filter(e => st.ok[e.id]) : shown;
  if (s.type === 'qa') {
    const ranked = qaRank(wall, votes || {}, st.done);
    if (!ranked.length) { box.append(el('p', 'tl-empty-res', s.mod ? 'Chưa có câu hỏi nào được duyệt.' : 'Chưa có câu hỏi nào.')); return box; }
    const ul = el('ol', 'tl-qa-wall');
    for (const q of ranked) {
      const li = el('li', q.done ? 'is-done' : ''); li.append(el('span', 'tl-qa-votes', `▲ ${q.votes}`), el('span', 'tl-qa-q', q.v));
      if (live) li.append(btn(q.done ? 'Bỏ đánh dấu' : 'Đã trả lời', 'tl-done-btn', () => void setSt({ done: { ...stOf(room?.i || 0).done, [q.id]: !q.done } })), ui.iconButton({ icon: 'trash', label: `Ẩn câu hỏi: ${q.v}`, danger: true, onClick: () => void setSt({ an: { ...stOf(room?.i || 0).an, [q.id]: true } }) }));
      ul.append(li);
    }
    box.append(ul); return box;
  }
  if (!wall.length) { box.append(el('p', 'tl-empty-res', s.mod ? 'Chưa có ý kiến nào được duyệt.' : 'Chưa có ý kiến nào.')); return box; }
  const ul = el('ul', 'tl-wall');
  [...wall].reverse().forEach((e, j) => { const li = el('li', 'tl-note tl-c' + (j % 6)); li.append(el('p', '', e.v)); if (live) li.append(ui.iconButton({ icon: 'trash', label: `Ẩn ý kiến: ${e.v}`, danger: true, onClick: () => void setSt({ an: { ...stOf(room?.i || 0).an, [e.id]: true } }) })); ul.append(li); });
  box.append(ul); return box;
}
/** @param {string} w */
async function hideWord(w) {
  if (!room) return;
  if (!(await confirmBox({ title: 'Ẩn từ này?', body: `"${w}" sẽ không hiện trên màn chiếu nữa (vẫn còn trong kết quả của thầy cô).`, okText: 'Ẩn từ', danger: true }))) return;
  await setSt({ anw: [...new Set([...stOf(room.i).anw, w])] });
}
/** Hàng chờ duyệt (câu mở / hỏi đáp có bật duyệt): chỉ hiện chữ, tên chỉ hiện khi thầy cô bật "Hiện tên". */
function queue() {
  if (!room) return null;
  const s = room.set.slides[room.i]; if (!(s.type === 'open' || s.type === 'qa') || !s.mod) return null;
  const st = stOf(room.i), list = entriesOf(room.y).filter(e => !st.ok[e.id] && !st.an[e.id]);
  const box = el('section', 'tl-queue'); box.setAttribute('aria-label', 'Ý kiến chờ duyệt');
  const head = el('div', 'tl-queue-head'); head.append(el('h3', '', `Chờ duyệt (${list.length})`));
  const names = btn(room.names ? 'Ẩn tên' : 'Hiện tên', 'tl-names', () => { if (room) { room.names = !room.names; drawSlide(); } }); names.setAttribute('aria-pressed', String(room.names));
  head.append(names);
  if (list.length > 1) head.append(btn('Duyệt tất cả', 't-primary tl-ok-all', () => { const ok = { ...st.ok }; for (const e of list) if (!badWord(e.v, room?.set.cam || [])) ok[e.id] = true; void setSt({ ok }); }));
  box.append(head);
  if (!list.length) { box.append(el('p', 'tl-empty-res', 'Không có ý nào đang chờ.')); return box; }
  const ul = el('ul', 'tl-queue-list');
  for (const e of list.slice(-30).reverse()) {
    const bad = badWord(e.v, room.set.cam);
    const li = el('li', bad ? 'is-bad' : ''); const txt = el('div', 'tl-q-text'); txt.append(el('p', '', e.v));
    if (bad) txt.append(el('small', 'tl-flag', 'Bộ lọc nghi từ ngữ không phù hợp'));
    if (room.names) txt.append(el('small', 'tl-who', nameOf(e.ma)));
    li.append(txt, btn('Duyệt', 't-primary tl-ok', () => void setSt({ ok: { ...stOf(room?.i || 0).ok, [e.id]: true } })), btn('Ẩn', 'tl-hide', () => void setSt({ an: { ...stOf(room?.i || 0).an, [e.id]: true } })));
    ul.append(li);
  }
  box.append(ul); return box;
}
function drawSlide() {
  if (!room || room.i < 0) return;
  const s = room.set.slides[room.i], list = entriesOf(room.y), people = new Set(list.map(e => e.ma)).size, total = Object.keys(room.players).length;
  $('tl-h-kicker').textContent = `Câu ${room.i + 1}/${room.set.slides.length} · ${TYPES[s.type]}${room.phase === 'closed' ? ' · Đã dừng nhận' : ''}`;
  const keepScroll = main.scrollTop;
  const card = el('div', 'tl-qcard'); card.append(el('p', 'tl-qtext', s.text), el('p', 'tl-qmeta', `${people}/${total} em đã gửi${s.type === 'cloud' ? ` · ${list.length} từ` : ''}`));
  const kids = [card];
  if (room.hide) { const h = el('div', 'tl-hidden-res'); h.append(el('strong', '', 'Kết quả đang ẩn'), el('span', '', 'Học sinh vẫn gửi bình thường. Bấm "Hiện kết quả" khi muốn cả lớp cùng xem.')); kids.push(h); }
  else kids.push(renderResult(s, list, stOf(room.i), room.votes, true));
  const q = queue(); if (q) kids.push(q);
  main.replaceChildren(...kids); main.scrollTop = keepScroll;
  const last = room.i + 1 >= room.set.slides.length;
  const prev = btn('Câu trước', 'tl-prev', () => void goSlide((room?.i || 0) - 1)); prev.disabled = room.i === 0;
  const toggle = btn(room.phase === 'closed' ? 'Mở lại nhận ý kiến' : 'Dừng nhận ý kiến', 'tl-toggle', () => void toggleOpen());
  const hideB = btn(room.hide ? 'Hiện kết quả' : 'Ẩn kết quả', 'tl-hide-res', () => void toggleHide()); hideB.setAttribute('aria-pressed', String(room.hide));
  const next = btn(last ? 'Kết thúc' : 'Câu tiếp theo', 't-primary qz-big tl-next', () => void (last ? endTalk() : goSlide((room?.i || 0) + 1)));
  foot.replaceChildren(prev, toggle, hideB, next, ...(last ? [] : [btn('Kết thúc', 'qz-stop tl-stop', () => void endTalk())]));
}
async function toggleOpen() { if (!room) return; room.phase = room.phase === 'closed' ? 'open' : 'closed'; await write({ [P('phase')]: room.phase }).catch(() => {}); drawSlide(); }
async function toggleHide() { if (!room) return; room.hide = !room.hide; await write({ [P('hide')]: room.hide }).catch(() => {}); drawSlide(); }

/* ---------- Kết thúc: tổng hợp ---------- */
/** @type {{slides:Slide[], lists:ReturnType<typeof entriesOf>[], sts:SlideState[], votes:any[]}|null} */ let result = null;
async function endTalk() {
  if (!room || room.phase === 'end') return;
  if (!(await confirmBox({ title: 'Kết thúc thảo luận?', body: 'Học sinh sẽ không gửi ý kiến được nữa. Kết quả các câu được tổng hợp để thầy cô xem lại.', okText: 'Kết thúc thảo luận' }))) return;
  room.yStop?.(); room.vStop?.(); room.phase = 'end';
  const slides = room.set.slides;
  // đọc lại toàn bộ ý kiến của mọi câu (cả các câu đã đi qua)
  const all = await store.get(`tl/${room.room}/y`).catch(() => null) || {};
  const votes = await store.get(`tl/${room.room}/vote`).catch(() => null) || {};
  result = { slides, lists: slides.map((_, i) => entriesOf(all[K(i)])), sts: slides.map((_, i) => stOf(i)), votes: slides.map((_, i) => votes[K(i)] || {}) };
  /** @type {Record<string, unknown>} */ const paths = { [P('phase')]: 'end', [P('slide')]: null };
  for (const lk of room.lopKeys) paths[`tl_lop/${lk}`] = null;
  await write(paths).catch(() => {});
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
  const ideas = result.lists.reduce((a, l) => a + l.length, 0), players = Object.keys(room.players).length;
  const hist = /** @type {any[]} */ (readLS(histKey(), [])); hist.unshift({ name: room.set.name, lops: room.set.lops, at: Date.now(), players, ideas }); writeLS(histKey(), hist.slice(0, 20));
  fx.sfx.fanfare(); drawEnd();
}
const sums = () => result ? result.slides.map((s, i) => summarize(s, result?.lists[i] || [], { ...(result?.sts[i] || {}), votes: result?.votes[i], cam: room?.set.cam || [] })) : [];
function drawEnd() {
  if (!room || !result) return;
  const players = Object.keys(room.players).length, ideas = result.lists.reduce((a, l) => a + l.length, 0);
  $('tl-h-kicker').textContent = `Kết thúc · ${players} em · ${ideas} ý kiến`;
  const tiles = el('ul', 'qz-tiles'); for (const [v, lab] of [[String(players), 'học sinh'], [String(result.slides.length), 'câu hỏi'], [String(ideas), 'lượt gửi'], [String(new Set(result.lists.flat().map(e => e.ma)).size), 'em đã gửi ý']]) { const li = el('li'); li.append(el('strong', '', v), el('span', '', lab)); tiles.append(li); }
  const kids = [el('h3', 'qz-stage-title', 'Tổng kết thảo luận'), tiles];
  result.slides.forEach((s, i) => {
    const sec = el('section', 'tl-sum'); const h = el('div', 'tl-sum-head'); h.append(el('span', 'qz-stat-i', String(i + 1)), el('div', 'tl-sum-t'), el('small', 'tl-sum-type', TYPES[s.type]));
    /** @type {HTMLElement} */ (h.querySelector('.tl-sum-t')).append(el('strong', '', s.text), el('small', '', `${new Set(result?.lists[i].map(e => e.ma)).size} em · ${result?.lists[i].length} lượt gửi`));
    sec.append(h, renderResult(s, result?.lists[i] || [], result?.sts[i] || { ok: {}, an: {}, anw: [], done: {} }, result?.votes[i], false)); kids.push(sec);
  });
  const aiBox = el('section', 'qz-ai-out tl-ai-out'); aiBox.id = 'tl-ai-out'; kids.push(aiBox);
  main.replaceChildren(...kids); main.scrollTop = 0;
  const aiBtn = btn('AI tổng hợp ý kiến', 't-primary thi-ai-btn qz-big', () => void analyze(aiBtn)); aiBtn.id = 'tl-ai-analyze'; aiBtn.disabled = !ideas;
  foot.replaceChildren(aiBtn, btn('Tải kết quả CSV', 'tl-csv', exportCsv));
}
/** @param {HTMLButtonElement} b */
async function analyze(b) {
  if (!room || !result) return; const out = $('tl-ai-out'), label = b.textContent; b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'AI đang tổng hợp…';
  const ss = sums();
  try {
    const c = cred();
    // Chỉ gửi chữ và số liệu, KHÔNG gửi tên / mã học sinh.
    const slides = result.slides.map((s, i) => { const r = /** @type {any} */ (ss[i]); return { type: s.type, text: s.text, people: r.people, opts: s.opts, items: s.items, counts: r.counts, avg: r.scale?.map((/** @type {any} */ x) => x.avg), words: r.cloud, texts: (r.open || r.qa || []).map((/** @type {any} */ e) => e.v) }; });
    const r = await api('/teacher/ai-tl', { method: 'POST', token: c.tok || undefined, timeout: 60000, body: { mode: 'tong_hop', title: room.set.name, slides, ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
    out.replaceChildren(el('h4', 'qz-ai-h', 'Tóm tắt'), el('p', '', String(r.tong_ket || '')));
    for (const t of r.trang || []) {
      out.append(el('h4', 'qz-ai-h', `Câu ${t.so}`)); const ul = el('ul');
      for (const g of t.nhom || []) ul.append(el('li', '', `${g.ten} (${g.so_y} ý)${g.vi_du ? ` — ví dụ: "${g.vi_du}"` : ''}`));
      if (t.luu_y) ul.append(el('li', 'tl-luu-y', 'Cần làm rõ: ' + t.luu_y));
      out.append(ul);
    }
  } catch (e) {
    out.replaceChildren(el('p', 'qz-ai-note', `AI chưa trả lời được (${e instanceof Error ? e.message : 'lỗi mạng'}). Dưới đây là tổng hợp tính sẵn.`));
    const ul = el('ul'); for (const line of localNotes(result.slides, ss)) ul.append(el('li', '', line)); out.append(ul);
  } finally { b.disabled = false; b.removeAttribute('aria-busy'); b.textContent = label; }
}
const csvCell = (/** @type {unknown} */ v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function exportCsv() {
  if (!room || !result) return;
  const rows = [['Câu', 'Loại', 'Câu hỏi', 'Học sinh', 'Nội dung gửi', 'Trạng thái']];
  result.slides.forEach((s, i) => {
    for (const e of result?.lists[i] || []) {
      const st = result?.sts[i]; const v = s.type === 'poll' ? (s.opts || [])[Number(e.v)] || e.v : s.type === 'scale' ? (s.items || []).map((it, j) => `${it}: ${e.v.split('|')[j] || ''}`).join('; ') : e.v;
      rows.push([String(i + 1), TYPES[s.type], s.text, nameOf(e.ma), v, st?.an[e.id] ? 'Đã ẩn' : (s.mod && (s.type === 'open' || s.type === 'qa')) ? (st?.ok[e.id] ? 'Đã duyệt' : 'Chưa duyệt') : '']);
    }
  });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `thao-luan-${room.set.lops.join('-')}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function closeRoom() {
  if (!room) { host.hidden = true; document.body.classList.remove('qz-hosting'); return; }
  if (room.phase !== 'end') {
    if (!(await confirmBox({ title: 'Đóng phòng thảo luận?', body: room.phase === 'lobby' ? 'Học sinh đang chờ sẽ thoát khỏi phòng.' : 'Buổi thảo luận đang diễn ra sẽ dừng, không lưu tổng kết.', okText: 'Đóng phòng', danger: true }))) return;
    /** @type {Record<string, unknown>} */ const paths = { [P('phase')]: 'end', [P('slide')]: null }; for (const lk of room.lopKeys) paths[`tl_lop/${lk}`] = null;
    await write(paths).catch(() => {});
  }
  cancelAnimationFrame(room.raf); room.yStop?.(); room.vStop?.(); room.stops.forEach(f => f()); room = null; result = null;
  try { localStorage.removeItem(liveKey()); } catch { /* bỏ qua */ }
  host.hidden = true; document.body.classList.remove('qz-hosting'); renderSets(); /** @type {HTMLElement|null} */ (document.querySelector('.tl-open'))?.focus();
}
$('tl-h-close').addEventListener('click', () => void closeRoom());
$('nav-tools').addEventListener('click', () => { let t = 'tab-tools-quiz'; try { t = sessionStorage.getItem('tools-tab') || t; } catch { /* bỏ qua */ } pickTab(tabs.some(x => x[0] === t) ? t : 'tab-tools-quiz'); status(''); });
document.getElementById('teacher-logout')?.addEventListener('click', () => { if (room) { room.stops.forEach(f => f()); room.yStop?.(); room.vStop?.(); room = null; host.hidden = true; document.body.classList.remove('qz-hosting'); } synced = false; });
void closeOrphan();   // mở trang giáo viên: đóng phòng treo từ lần trước (máy tắt giữa buổi) nếu đã ngừng nhịp
