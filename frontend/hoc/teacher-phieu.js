// @ts-check
// Học AI – trang giáo viên: bài theo lớp, mở học liệu trong giờ, xem bài (bản trước/sau), đánh giá 4 YCCĐ, trả bài, CSV,
// và trình soạn gói (sửa mọi nội dung, ẩn thay vì xóa, khôi phục bản gốc, nhập gói/đáp án mới). Chỉ đọc/ghi qua Worker.
import { api, ApiError } from './api.js';
import { el, button, confirmBox, noticeBox, withBusy } from './dom.js';
import { fieldMap, optionsOf, missingForSubmit, csvSafe, lopKey } from './phieu-core.js?v=20261122e';
import { createLesson, openBuilder, importLesson } from './teacher-soan.js?v=20261122f';

const MUC = [['', 'Chưa đánh giá'], ['chua_thay', 'Chưa thấy minh chứng'], ['dat', 'Đạt'], ['kha', 'Khá'], ['tot', 'Tốt']];
const MUC_TEN = Object.fromEntries(MUC);
const STATUS = { draft: 'Đang làm', submitted: 'Đã nộp', returned: 'Đã trả bài' };
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const cred = () => { try { return { tok: sessionStorage.getItem('aisgk-pwa-teacher') || '', gv_ma: sessionStorage.getItem('thi-gv-ma') || '', gv: sessionStorage.getItem('thi-gv-mk') || '' }; } catch { return { tok: '', gv_ma: '', gv: '' }; } };
const myClasses = () => { try { const t = JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); return t && Array.isArray(t.lop) ? t.lop.map(String) : []; } catch { return []; } };
const errText = (/** @type {unknown} */ e) => (e instanceof ApiError ? e.message : 'Chưa kết nối được máy chủ. Thử lại.');

/** Gọi route giáo viên Học AI. @param {Record<string, unknown>} body */
async function call(body) {
  const c = cred();
  return api('/pwa/teacher/phieu', { method: 'POST', token: c.tok || undefined, timeout: 60000, body: { ...body, ...(c.tok ? {} : { gv_ma: c.gv_ma, gv_pin: c.gv }) } });
}

/** @type {{packs:any[], admin:boolean, goi:string, lop:string, data:any, classes:string[]}} */
const st = { packs: [], admin: false, goi: '', lop: '', data: null, classes: [] };

function root() { return $('hocai-root'); }
/** @param {string} t */
function setStatus(t) { const s = $('hocai-status'); if (s) s.textContent = t; }

/** Tải danh sách bài. */
export async function load() {
  const box = root(); if (!box) return;
  box.replaceChildren(el('p', 'Đang tải bài Học AI…', 't-muted')); box.setAttribute('aria-busy', 'true');
  try {
    const r = await call({ op: 'ds' });
    st.packs = r.packs || []; st.admin = !!r.admin;
  } catch (e) {
    box.removeAttribute('aria-busy');
    box.replaceChildren(el('p', e instanceof ApiError && e.status === 404 ? 'Chức năng Học AI chưa được bật trên máy chủ.' : errText(e), 't-muted'));
    if (e instanceof ApiError && e.status !== 404) box.append(button('Thử lại', load, 't-button'));
    return;
  }
  box.removeAttribute('aria-busy');
  renderHome();
}

function renderHome() {
  const box = root();
  const bar = el('div', '', 't-toolbar phieu-gv-bar');
  const f1 = el('div', '', 't-field'); const l1 = el('label', 'Bài'); const s1 = /** @type {HTMLSelectElement} */ (el('select'));
  s1.id = 'hocai-goi'; l1.htmlFor = s1.id;
  for (const p of st.packs) s1.append(new Option(`Lớp ${p.grade} · ${p.title}${p.an ? ' (đang ẩn)' : ''}`, p.id));
  if (st.goi) s1.value = st.goi; else st.goi = s1.value;
  f1.append(l1, s1);
  const f2 = el('div', '', 't-field'); const l2 = el('label', 'Lớp'); const s2 = /** @type {HTMLSelectElement} */ (el('select'));
  s2.id = 'hocai-lop'; l2.htmlFor = s2.id; f2.append(l2, s2);
  const status = el('p', '', 't-muted'); status.id = 'hocai-status'; status.setAttribute('role', 'status');
  const view = button('Xem lớp', () => openClass(view), 't-button t-primary');
  bar.append(f1, f2, view);
  const tools = el('div', '', 'phieu-gv-tools');
  const ctx = { call, setStatus, admin: st.admin, done: (/** @type {string|undefined} */ goi) => { if (goi) st.goi = goi; void load(); } };
  if (st.admin) tools.append(button('Tạo bài mới', () => createLesson(ctx, $('hocai-class')), 't-button t-primary'));
  if (st.packs.length) tools.append(button(st.admin ? 'Sửa bài' : 'Xem bài', () => openBuilder(ctx, $('hocai-class'), st.goi), 't-button'));
  if (st.admin && st.packs.length) {
    const del = button('Xóa bài', async () => {
      const p = st.packs.find(x => x.id === st.goi); if (!p) return;
      let so = 0;
      try { so = (await call({ op: 'soan', viec: 'dem_bai', goi: p.id })).so || 0; } catch { so = 0; }
      const ok = await confirmBox({ title: 'Xóa bài?', body: `${p.title} (lớp ${p.grade}) sẽ không còn trong danh sách của thầy cô và học sinh. ${so ? so + ' học sinh đã làm bài này; bài làm của các em vẫn được lưu trên máy chủ.' : 'Chưa học sinh nào làm bài này.'}`, okText: 'Xóa bài', danger: true });
      if (!ok) return;
      await withBusy(del, 'Đang xóa…', async () => {
        try { await call({ op: 'soan', viec: 'xoa_bai', goi: p.id }); st.goi = ''; setStatus('Đã xóa bài.'); await load(); }
        catch (e) { await noticeBox({ title: 'Chưa xóa được', body: errText(e) }); }
      });
    }, 't-button t-danger');
    tools.append(del);
  }
  if (st.admin) tools.append(button('Nhập bài từ tệp', () => importLesson(ctx), 't-button'));
  if (st.admin && st.packs.length) {
    const cur = () => st.packs.find(x => x.id === st.goi);
    const hide = button(cur()?.an ? 'Hiện bài với học sinh' : 'Ẩn bài với học sinh', async () => {
      const p = cur(); if (!p) return;
      const an = !p.an;
      const ok = await confirmBox({ title: an ? 'Ẩn bài với học sinh?' : 'Hiện bài với học sinh?', body: `${p.title} (lớp ${p.grade}). ${an ? 'Học sinh sẽ không thấy bài này nữa. Bài các em đã làm vẫn được giữ.' : 'Học sinh khối ' + p.grade + ' sẽ thấy lại bài này.'}`, okText: an ? 'Ẩn bài' : 'Hiện bài', danger: an });
      if (!ok) return;
      await withBusy(hide, 'Đang lưu…', async () => {
        try { await call({ op: 'goi_an', goi: p.id, an }); p.an = an; setStatus(an ? 'Đã ẩn bài với học sinh.' : 'Đã hiện bài với học sinh.'); }
        catch (e) { await noticeBox({ title: 'Chưa lưu được', body: errText(e) }); }
      });
      renderHome();
    }, 't-button');
    tools.append(hide);
  }
  const list = el('div', ''); list.id = 'hocai-class';
  box.replaceChildren(bar, tools, status, list);
  if (!st.packs.length) { list.append(el('p', st.admin ? 'Chưa có bài. Bấm "Tạo bài mới" để soạn bài đầu tiên.' : 'Chưa có bài Học AI.', 't-muted')); view.disabled = true; return; }
  const fillClasses = async () => {
    s2.replaceChildren(new Option('Đang tải lớp…', '')); s2.disabled = true;
    try {
      const r = await call({ op: 'cac_lop', goi: s1.value });
      const mine = myClasses();
      const keys = new Map(mine.map(c => [lopKey(c), c]));
      for (const k of r.classes || []) if (!keys.has(k)) keys.set(k, k.toUpperCase());
      st.classes = [...keys.keys()];
      s2.replaceChildren(...[...keys].map(([k, label]) => new Option(label, k)));
      if (!keys.size) s2.append(new Option('Chưa có lớp nào làm bài', ''));
      if (st.lop && keys.has(st.lop)) s2.value = st.lop;
    } catch (e) { s2.replaceChildren(new Option('Chưa tải được lớp', '')); setStatus(errText(e)); }
    s2.disabled = false;
  };
  s1.addEventListener('change', () => { st.goi = s1.value; renderHome(); });
  void fillClasses().then(() => { if (st.lop && s2.value === st.lop) void openClass(view); });
}

/** @param {HTMLButtonElement} btn */
async function openClass(btn) {
  const s1 = /** @type {HTMLSelectElement} */ ($('hocai-goi')), s2 = /** @type {HTMLSelectElement} */ ($('hocai-lop'));
  if (!s2.value) { setStatus('Chọn lớp trước.'); s2.focus(); return; }
  st.goi = s1.value; st.lop = s2.value;
  await withBusy(btn, 'Đang tải…', async () => {
    try { st.data = await call({ op: 'lop', goi: st.goi, lop: st.lop }); setStatus(''); }
    catch (e) { setStatus(errText(e)); st.data = null; }
  });
  renderClass();
}

const studentsOf = (/** @type {any} */ d) => Object.entries(d.bai || {}).map(([uid, b]) => ({ uid, ...(/** @type {any} */ (b)) })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));

function renderClass() {
  const box = $('hocai-class'); if (!box) return;
  const d = st.data; if (!d) { box.replaceChildren(); return; }
  const pack = d.pack; const parts = [];
  // Học liệu mở trong giờ
  const gvReveal = (pack.reveal || []).filter((/** @type {any} */ r) => r.by === 'gv' || r.or_by === 'gv');
  if (gvReveal.length) {
    const sec = el('section', '', 'phieu-gv-sec'); sec.append(el('h3', 'Học liệu mở trong giờ'));
    for (const r of gvReveal) {
      const b = pack.blocks?.[r.block]; if (!b) continue;
      const open = !!d.mo?.[r.block];
      const row = el('div', '', 'phieu-gv-row');
      row.append(el('span', `${b.title}: ${open ? 'đã mở cho lớp' : 'chưa mở'}`));
      const act = button(open ? 'Đóng lại' : 'Mở cho lớp', async () => {
        const ok = await confirmBox({ title: open ? 'Đóng học liệu?' : 'Mở học liệu cho lớp?', body: `${open ? 'Học sinh' : 'Mọi học sinh'} lớp ${st.lop.toUpperCase()} ${open ? 'sẽ không còn thấy' : 'sẽ thấy'} "${b.title}".`, okText: open ? 'Đóng lại' : 'Mở cho lớp' });
        if (!ok) return;
        await withBusy(act, 'Đang lưu…', async () => {
          try { await call({ op: 'mo', goi: st.goi, lop: st.lop, block: r.block, open: !open }); d.mo = { ...(d.mo || {}) }; if (open) delete d.mo[r.block]; else d.mo[r.block] = Date.now(); }
          catch (e) { await noticeBox({ title: 'Chưa lưu được', body: errText(e) }); }
        });
        renderClass();
      }, 't-button');
      row.append(act); sec.append(row);
    }
    parts.push(sec);
  }
  // Hoạt động 1: cả lớp chọn thẻ nào (thay giơ tay; chiếu lên bảng)
  const hs = studentsOf(d);
  const the = optionsOf(pack, fieldMap(pack).get('hd1_chon') || {});
  if (the.length) {
    const dem = the.map(t => hs.filter(s => s.locked?.hd1_chon && Array.isArray(s.answers?.hd1_chon) && s.answers.hd1_chon.includes(t)).length);
    const daChot = hs.filter(s => s.locked?.hd1_chon).length;
    const top = [...dem].sort((a, b) => b - a)[2] || 0;
    const sec1 = el('section', '', 'phieu-gv-sec');
    sec1.append(el('h3', `Hoạt động 1: cả lớp chọn thẻ nào (${daChot} bài đã chốt)`));
    const ul = el('ul', '', 'phieu-gv-chart');
    the.forEach((t, i) => {
      const li = el('li'); const lab = el('span', `${dem[i] && dem[i] >= top ? '★ ' : ''}${t}`);
      const bar = /** @type {HTMLProgressElement} */ (el('progress')); bar.max = Math.max(1, daChot); bar.value = dem[i]; bar.setAttribute('aria-label', `${t}: ${dem[i]}`);
      li.append(lab, bar, el('span', String(dem[i]), 'phieu-gv-num')); ul.append(li);
    });
    sec1.append(ul, el('p', '★ là 3 thẻ nhiều bài chọn nhất. Chưa nói đúng sai, cuối bài cả lớp xem lại.', 't-muted'));
    parts.push(sec1);
  }
  // Các phần có nút Kiểm tra: lần đầu (trước khi xem giải thích) lớp làm đúng bao nhiêu, câu nào hay sai nhất
  const ths = (pack.activities || []).filter((/** @type {any} */ a) => !a.an).flatMap((/** @type {any} */ a) => (a.buoc || []).flatMap((/** @type {any} */ b) => (b.the || []).filter((/** @type {any} */ t) => t.kiem && !t.chi_ghi).map((/** @type {any} */ t) => ({ ...t, hd: a.title }))));
  if (ths.length) {
    const sec2 = el('section', '', 'phieu-gv-sec');
    sec2.append(el('h3', 'Kết quả Kiểm tra lần đầu (trước khi học sinh xem giải thích)'));
    if (!d.dapan?.kiem) sec2.append(el('p', 'Chưa nạp tệp đáp án nên chưa tính được đúng sai.', 't-muted'));
    const wrap = el('div', '', 't-table-wrap'); const tb = el('table', '', 't-table');
    tb.append(el('caption', 'Dùng để chọn chỗ cần giảng thêm. Không dùng để cho điểm.'));
    const tr = el('tr'); for (const h of ['Phần', 'Đã kiểm tra', 'Đúng hết ngay lần đầu', 'Câu nhiều bài sai nhất']) { const th = el('th', h); th.setAttribute('scope', 'col'); tr.append(th); }
    const thead = el('thead'); thead.append(tr); tb.append(thead);
    const body = el('tbody');
    const fmap = fieldMap(pack);
    for (const t of ths) {
      const da = d.dapan?.kiem?.[t.kiem]?.dap_an || {};
      const lam = hs.filter(s => s.kiem?.[t.kiem]);
      /** @type {Record<string, number>} */ const sai = {};
      let dungHet = 0;
      for (const s of lam) {
        const first = s.kiem[t.kiem];
        const ids = Object.keys(da).filter(id => first[id] !== undefined);
        const bad = ids.filter(id => JSON.stringify(first[id]) !== JSON.stringify(da[id]));
        if (ids.length && !bad.length) dungHet++;
        for (const id of bad) sai[id] = (sai[id] || 0) + 1;
      }
      const worst = Object.entries(sai).sort((x, y) => y[1] - x[1])[0];
      const row = el('tr'); const th = el('th', `${t.hd} – ${t.ten}`); th.setAttribute('scope', 'row'); row.append(th);
      row.append(el('td', String(lam.length)), el('td', Object.keys(da).length ? `${dungHet}/${lam.length}` : '—'),
        el('td', worst ? `${String(fmap.get(worst[0])?.label || worst[0]).slice(0, 70)} (${worst[1]} bài)` : '—'));
      body.append(row);
    }
    tb.append(body); wrap.append(tb); sec2.append(wrap); parts.push(sec2);
  }
  // Bảng lớp
  const list = studentsOf(d);
  const sec = el('section', '', 'phieu-gv-sec');
  const head = el('div', '', 'phieu-gv-row'); head.append(el('h3', `Lớp ${st.lop.toUpperCase()}: ${list.length} học sinh đã mở bài`), button('Xuất CSV (Excel)', () => exportCsv(), 't-button'));
  sec.append(head);
  if (!list.length) sec.append(el('p', 'Chưa có học sinh nào mở bài.', 't-muted'));
  else {
    const wrap = el('div', '', 't-table-wrap'); const tb = el('table', '', 't-table');
    const cap = el('caption', 'Mức do giáo viên chọn; không có điểm tự động.'); tb.append(cap);
    const tr = el('tr'); for (const h of ['Học sinh', 'Trạng thái', ...(pack.yccd || []).map((/** @type {any} */ y) => y.code), 'Nhóm', 'Thao tác']) { const th = el('th', h); th.setAttribute('scope', 'col'); tr.append(th); }
    const thead = el('thead'); thead.append(tr); tb.append(thead);
    const body = el('tbody');
    for (const s of list) {
      const g = d.gv?.[s.uid] || {};
      const row = el('tr');
      row.append(el('td', s.name || s.uid), el('td', STATUS[/** @type {keyof typeof STATUS} */ (s.status)] || s.status));
      for (const y of pack.yccd || []) row.append(el('td', MUC_TEN[g.muc?.[y.code] || ''] || ''));
      row.append(el('td', s.nhom ? s.nhom.slice(1) : ''));
      const td = el('td'); td.append(button('Xem bài', () => openStudent(s.uid), 't-button')); row.append(td);
      body.append(row);
    }
    tb.append(body); wrap.append(tb); sec.append(wrap);
  }
  parts.push(sec);
  // Đáp án và gợi ý (chỉ giáo viên)
  if (d.dapan) { const det = el('details', '', 'phieu-gv-sec'); det.append(el('summary', 'Đáp án và gợi ý cho giáo viên')); det.append(renderDapan(d.dapan)); parts.push(det); }
  box.replaceChildren(...parts);
}

/** Hiển thị gói đáp án dạng chung (mọi khóa → đoạn văn). @param {any} x @returns {HTMLElement} */
function renderDapan(x) {
  const out = el('div', '', 'phieu-dapan');
  const walk = (/** @type {any} */ v, /** @type {HTMLElement} */ into, /** @type {string} */ label) => {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean' || typeof v === 'number') return;
    if (typeof v === 'string') { into.append(el('p', label ? `${label}: ${v}` : v)); return; }
    if (Array.isArray(v)) { for (const i of v) walk(i, into, ''); return; }
    const sub = el('div', '', 'phieu-dapan-sub'); if (label) sub.append(el('h4', label));
    for (const [k, vv] of Object.entries(v)) if (!['id', 'schema', 'rev', 'ban_goc', 'chi_gv', 'sua_luc', 'cho_phep'].includes(k)) walk(vv, sub, k);
    into.append(sub);
  };
  walk(x, out, '');
  return out;
}

/** Trường cá nhân/nhóm thành văn bản. @param {any} pack @param {any} f @param {any} v @param {Record<string,string>} [members] */
function valText(pack, f, v, members = {}) {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.map(x => (f.type === 'members' ? members[x] || x : x)).join('; ');
  return String(v);
}

/** Chi tiết một học sinh. @param {string} uid */
async function openStudent(uid) {
  const d = st.data; const pack = d.pack; const s = d.bai[uid]; const box = $('hocai-class');
  const fm = fieldMap(pack); const g = d.gv?.[uid] || {};
  const nhom = s.nhom ? d.nhom?.[s.nhom] : null;
  const wrap = el('section', '', 'phieu-gv-sec');
  const back = button('Về danh sách lớp', () => renderClass(), 't-button');
  const h = el('h3', `${s.name || uid} · ${STATUS[/** @type {keyof typeof STATUS} */ (s.status)] || s.status}`); h.tabIndex = -1;
  wrap.append(back, h);
  const miss = missingForSubmit(pack, s.answers || {});
  wrap.append(el('p', miss.length ? `Còn ${miss.length} mục bắt buộc chưa trả lời.` : 'Đã trả lời đủ các mục bắt buộc.', 't-muted'));
  // Lịch sử nộp: bản trước và bản sau (9.A3.2)
  let ls = {};
  try { ls = (await call({ op: 'lich_su', goi: st.goi, lop: st.lop, uid })).ls || {}; } catch { ls = {}; }
  const revs = Object.keys(ls).map(Number).sort((a, b) => a - b);
  // Câu trả lời theo hoạt động
  for (const a of pack.activities || []) {
    const det = el('details', '', 'phieu-gv-act'); det.open = true;
    det.append(el('summary', a.title));
    const tb = el('table', '', 't-table'); const tbody = el('tbody');
    for (const f of a.fields || []) {
      if (f.type === 'heading') continue;
      const v = f.mode === 'nhom' ? nhom?.answers?.[f.id] : s.answers?.[f.id];
      const tr = el('tr');
      const th = el('th', f.label); th.setAttribute('scope', 'row');
      const tags = [f.evidence?.code, f.mode === 'nhom' ? 'nhóm' : '', s.locked?.[f.id] ? 'đã chốt' : '', f.an ? 'đang ẩn' : ''].filter(Boolean).join(' · ');
      const td = el('td', valText(pack, f, v, nhom?.members) || '—');
      if (f.mode === 'nhom' && nhom?.by?.[f.id]) td.append(el('small', ` (ghi: ${nhom.members?.[nhom.by[f.id]] || 'bạn'})`, 't-muted'));
      if (revs.length > 1 && f.mode !== 'nhom') {
        const first = ls[revs[0]]?.answers?.[f.id];
        if (JSON.stringify(first) !== JSON.stringify(v) && first !== undefined) td.append(el('p', `Bản nộp lần đầu: ${valText(pack, f, first)}`, 't-muted phieu-truoc'));
      }
      const k0 = Object.values(s.kiem || {}).find((/** @type {any} */ x) => x && f.id in x);
      if (k0 && JSON.stringify(/** @type {any} */ (k0)[f.id]) !== JSON.stringify(v)) td.append(el('p', `Lần đầu (trước khi xem giải thích): ${valText(pack, f, /** @type {any} */ (k0)[f.id])}`, 't-muted phieu-truoc'));
      tr.append(th, td, el('td', tags, 't-muted')); tbody.append(tr);
    }
    tb.append(tbody); det.append(tb);
    if (a.peer_review) {
      const got = d.gopy?.[uid] || {};
      for (const [, x] of Object.entries(got)) for (const t of a.peer_review.targets) {
        const v = /** @type {any} */ (x)['g' + t.goal]; if (!v) continue;
        det.append(el('p', `Góp ý của bạn ${/** @type {any} */ (x).name || ''} cho mục tiêu ${t.goal}: ${t.kiem.map((/** @type {string} */ k, /** @type {number} */ i) => `${v.checks?.[i] ? 'Có' : 'Chưa'} – ${k}`).join('; ')}${v.text ? '. ' + v.text : ''} (của bạn, không tính cho chủ phiếu)`, 't-muted'));
      }
    }
    wrap.append(det);
  }
  // Đánh giá
  const form = el('form', '', 't-form phieu-gv-form'); form.noValidate = true;
  form.append(el('h3', 'Nhận xét theo yêu cầu cần đạt'));
  /** @type {Record<string, HTMLSelectElement>} */ const sels = {};
  for (const y of pack.yccd || []) {
    const fld = el('div', '', 't-field'); const lab = el('label', `${y.code}. ${y.text}`); const se = /** @type {HTMLSelectElement} */ (el('select'));
    se.id = `hocai-muc-${y.code.replace(/\W/g, '_')}`; lab.htmlFor = se.id;
    for (const [v, t] of MUC) se.append(new Option(t, v));
    se.value = g.muc?.[y.code] || ''; sels[y.code] = se; fld.append(lab, se); form.append(fld);
  }
  const mk = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ val, /** @type {number} */ max) => { const fld = el('div', '', 't-field'); const lab = el('label', label); const tx = /** @type {HTMLTextAreaElement} */ (el('textarea')); tx.id = id; lab.htmlFor = id; tx.maxLength = max; tx.rows = 3; tx.value = val || ''; fld.append(lab, tx); form.append(fld); return tx; };
  const nx = mk('hocai-nx', 'Nhận xét gửi học sinh (học sinh thấy khi trả bài)', g.nhan_xet, 2000);
  const tb = mk('hocai-tb', 'Ghi nhận trình bày miệng, quan sát trong giờ (chỉ giáo viên)', g.trinh_bay, 1000);
  const msg = el('p', '', 't-muted'); msg.setAttribute('role', 'status');
  const save = el('button', 'Lưu đánh giá', 't-button t-primary'); save.type = 'submit';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    await withBusy(save, 'Đang lưu…', async () => {
      const muc = Object.fromEntries(Object.entries(sels).map(([k, se]) => [k, se.value]));
      try { await call({ op: 'danh_gia', goi: st.goi, lop: st.lop, uid, muc, nhan_xet: nx.value.trim(), trinh_bay: tb.value.trim() }); d.gv = { ...(d.gv || {}), [uid]: { muc: Object.fromEntries(Object.entries(muc).filter(([, v]) => v)), nhan_xet: nx.value.trim(), trinh_bay: tb.value.trim() } }; msg.textContent = 'Đã lưu đánh giá.'; }
      catch (err) { msg.textContent = errText(err); }
    });
  });
  const acts = el('div', '', 't-actions'); acts.append(save);
  if (s.status === 'submitted') {
    const ret = button('Trả bài để học sinh sửa', async () => {
      const ok = await confirmBox({ title: 'Trả bài?', body: `${s.name || uid} sẽ sửa tiếp được bài. Bản đã nộp vẫn được lưu để so sánh.`, okText: 'Trả bài' });
      if (!ok) return;
      await withBusy(ret, 'Đang trả bài…', async () => {
        try { await call({ op: 'tra_bai', goi: st.goi, lop: st.lop, uid }); s.status = 'returned'; msg.textContent = 'Đã trả bài.'; ret.remove(); }
        catch (err) { msg.textContent = errText(err); }
      });
    }, 't-button');
    acts.append(ret);
  }
  form.append(acts, msg);
  wrap.append(form);
  box.replaceChildren(wrap);
  h.focus();
}

/** CSV theo lớp: 4 cột YCCĐ, phần thiếu, nhận xét, mọi câu trả lời. Mở được bằng Excel (UTF-8 có BOM). */
function exportCsv() {
  const d = st.data; if (!d) return;
  const pack = d.pack; const fields = [...fieldMap(pack).values()].filter(f => f.type !== 'heading');
  const head = ['Mã học sinh', 'Họ tên', 'Lớp', 'Trạng thái', ...(pack.yccd || []).map((/** @type {any} */ y) => y.code), 'Số mục bắt buộc còn thiếu', 'Nhận xét', 'Ghi nhận trình bày', 'Nhóm', ...fields.map(f => `${f.label} [${f.id}]`)];
  const rows = [head.map(csvSafe).join(',')];
  for (const s of studentsOf(d)) {
    const g = d.gv?.[s.uid] || {}; const nh = s.nhom ? d.nhom?.[s.nhom] : null;
    rows.push([s.uid, s.name, s.class_code, STATUS[/** @type {keyof typeof STATUS} */ (s.status)] || s.status, ...(pack.yccd || []).map((/** @type {any} */ y) => MUC_TEN[g.muc?.[y.code] || '']), missingForSubmit(pack, s.answers || {}).length, g.nhan_xet, g.trinh_bay, s.nhom ? s.nhom.slice(1) : '',
      ...fields.map(f => valText(pack, f, f.mode === 'nhom' ? nh?.answers?.[f.id] : s.answers?.[f.id], nh?.members))].map(csvSafe).join(','));
  }
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hoc-ai-${st.goi}-${st.lop}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus('Đã tạo tệp CSV.');
}

const nav = document.getElementById('nav-hocai');
if (nav) nav.addEventListener('click', () => { void load(); });
