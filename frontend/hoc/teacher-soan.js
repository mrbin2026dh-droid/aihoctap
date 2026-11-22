// @ts-check
// Học AI – trình soạn bài dạng mở cho giáo viên: Bài → Hoạt động → Câu hỏi (8 dạng).
// Mỗi thao tác (thêm, sửa, xóa, chuyển) lưu ngay một câu/hoạt động lên máy chủ; máy chủ tự tách đáp án khỏi bài học sinh.
import { ApiError } from './api.js';
import { el, button, confirmBox, noticeBox, withBusy } from './dom.js';
import { QTYPES, DUNG_SAI, checkQuestion } from './soan-core.js?v=20261122e';

/** @typedef {{call:(b:Record<string,unknown>)=>Promise<any>, setStatus:(t:string)=>void, done:(goi?:string)=>void, admin:boolean}} Ctx */
const errText = (/** @type {unknown} */ e) => (e instanceof ApiError ? e.message : 'Chưa kết nối được máy chủ. Thử lại.');
const VI_DU = {
  mot: 'Ví dụ: AI viết sai năm 938, em làm gì? (A, B, C, chọn 1)',
  nhieu: 'Ví dụ: Những việc nào máy làm tốt hơn người? (tích nhiều ô)',
  dung_sai: 'Ví dụ: “AI luôn nói đúng” – Đúng hay Sai?',
  phan_loai: 'Ví dụ: Xếp việc vào nhóm “Máy làm” hoặc “Người làm”',
  ghep: 'Ví dụ: Ghép tình huống với năng lực phù hợp',
  thu_tu: 'Ví dụ: Sắp xếp các bước kiểm tra thông tin AI đưa ra',
  dien: 'Ví dụ: Ai chỉ huy trận Bạch Đằng năm 938?',
  tu_luan: 'Ví dụ: Năng lực em thấy cần nhất là gì, vì sao?'
};
const blank = (/** @type {string} */ type) => ({
  type, prompt: '', giai_thich: '', bat_buoc: true,
  ...(type === 'mot' || type === 'nhieu' ? { options: ['', '', ''], dung: [] } : {}),
  ...(type === 'dung_sai' ? { items: [{ text: '', dap: 'Đúng' }, { text: '', dap: 'Sai' }] } : {}),
  ...(type === 'phan_loai' ? { nhom: ['', ''], items: [{ text: '', dap: '' }, { text: '', dap: '' }] } : {}),
  ...(type === 'ghep' ? { items: [{ text: '', dap: '' }, { text: '', dap: '' }, { text: '', dap: '' }] } : {}),
  ...(type === 'thu_tu' ? { items: [{ text: '' }, { text: '' }, { text: '' }] } : {}),
  ...(type === 'dien' ? { chap_nhan: [''] } : {})
});
let seq = 0;
const uid = (/** @type {string} */ p) => `${p}-${++seq}`;
/** Ô nhập có nhãn + chỗ báo lỗi. @param {string} label @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} inp */
function labeled(label, inp) {
  const f = el('div', '', 't-field'); const l = el('label', label); inp.id ||= uid('sb'); l.htmlFor = inp.id; f.append(l, inp); return f;
}
const input = (/** @type {string} */ v, max = 500) => { const i = /** @type {HTMLInputElement} */ (el('input')); i.type = 'text'; i.value = v; i.maxLength = max; return i; };
const area = (/** @type {string} */ v, max = 2000) => { const t = /** @type {HTMLTextAreaElement} */ (el('textarea')); t.value = v; t.maxLength = max; t.rows = 2; return t; };

/** Tạo bài mới (hộp thoại nhập tên, khối). @param {Ctx} ctx @param {HTMLElement} box */
export async function createLesson(ctx, box) {
  box.replaceChildren();
  const form = el('form', '', 't-card sb-card'); form.noValidate = true;
  form.append(el('h3', 'Tạo bài mới'));
  const t = input('', 200); t.required = true;
  const g = /** @type {HTMLSelectElement} */ (el('select')); for (const k of [9, 8, 7, 6]) g.append(new Option(`Lớp ${k}`, String(k)));
  const err = el('p', '', 'field-error'); err.id = uid('sb-err'); err.hidden = true; t.setAttribute('aria-describedby', err.id);
  const fT = labeled('Tên bài', t); fT.append(err);
  const save = el('button', 'Tạo bài', 't-button t-primary'); save.type = 'submit';
  const actions = el('div', '', 't-actions'); actions.append(save, button('Hủy', () => ctx.done(), 't-button'));
  form.append(fT, labeled('Khối', g), actions);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!t.value.trim()) { err.textContent = 'Nhập tên bài.'; err.hidden = false; t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
    await withBusy(save, 'Đang tạo…', async () => {
      try { const r = await ctx.call({ op: 'soan', viec: 'tao_bai', title: t.value.trim(), grade: Number(g.value) }); ctx.setStatus('Đã tạo bài. Thêm hoạt động và câu hỏi.'); openBuilder(ctx, box, r.goi, r.soan); }
      catch (er) { err.textContent = errText(er); err.hidden = false; }
    });
  });
  box.append(form); t.focus();
}

/** Mở trình soạn một bài. @param {Ctx} ctx @param {HTMLElement} box @param {string} goi @param {any} [m] */
export async function openBuilder(ctx, box, goi, m) {
  if (!m) {
    box.replaceChildren(el('p', 'Đang tải bài…', 't-muted')); box.setAttribute('aria-busy', 'true');
    try { m = (await ctx.call({ op: 'soan_doc', goi })).soan; } catch (e) { box.removeAttribute('aria-busy'); box.replaceChildren(el('p', errText(e), 't-muted')); return; }
    box.removeAttribute('aria-busy');
    if (!m) { box.replaceChildren(el('p', 'Bài này làm bằng trình soạn cũ nên không sửa ở đây được. Hãy nhập bài mẫu từ tệp hoặc tạo bài mới.', 't-muted'), button('Đóng', () => ctx.done(), 't-button')); return; }
  }
  new Builder(ctx, box, m).render();
}

class Builder {
  /** @param {Ctx} ctx @param {HTMLElement} box @param {any} m */
  constructor(ctx, box, m) { this.ctx = ctx; this.box = box; this.m = m; /** @type {string} */ this.editing = ''; /** @type {any} */ this.draft = null; }
  /** Gửi một thao tác soạn; thành công thì vẽ lại từ dữ liệu máy chủ. @param {Record<string, unknown>} body @param {string} ok */
  async op(body, ok) {
    const r = await this.ctx.call({ op: 'soan', goi: this.m.id, ...body });
    this.m = r.soan; this.ctx.setStatus(ok); return r;
  }
  render(focus = '') {
    const m = this.m, ro = !this.ctx.admin, parts = [];
    const head = el('div', '', 'phieu-gv-row');
    const h = el('h3', `Soạn bài: ${m.title}`); h.tabIndex = -1;
    head.append(h, button('Đóng', () => this.ctx.done(m.id), 't-button'));
    parts.push(head);
    if (ro) parts.push(el('p', 'Chỉ giáo viên quản trị sửa được bài dùng chung.', 't-muted'));
    // Tên bài, khối
    if (!ro) {
      const f = el('form', '', 't-card sb-card sb-bai'); f.noValidate = true;
      const t = input(m.title, 200); const g = /** @type {HTMLSelectElement} */ (el('select'));
      for (const k of [9, 8, 7, 6]) g.append(new Option(`Lớp ${k}`, String(k))); g.value = String(m.grade);
      const s = el('button', 'Lưu tên bài', 't-button'); s.type = 'submit';
      f.append(labeled('Tên bài', t), labeled('Khối', g), s);
      f.addEventListener('submit', async e => { e.preventDefault(); await withBusy(s, 'Đang lưu…', async () => { try { await this.op({ viec: 'sua_bai', title: t.value, grade: Number(g.value) }, 'Đã lưu tên bài.'); this.render(); } catch (er) { await noticeBox({ title: 'Chưa lưu được', body: errText(er) }); } }); });
      parts.push(f);
    }
    (m.activities || []).forEach((/** @type {any} */ a, /** @type {number} */ ai) => parts.push(this.activity(a, ai, ro)));
    if (!m.activities?.length) parts.push(el('p', 'Bài chưa có hoạt động. Thêm hoạt động đầu tiên ở dưới.', 't-muted'));
    if (!ro) parts.push(this.addActivity());
    this.box.replaceChildren(...parts);
    const target = focus ? /** @type {HTMLElement|null} */ (this.box.querySelector(focus)) : h;
    target?.focus();
  }

  /** @param {any} a @param {number} ai @param {boolean} ro */
  activity(a, ai, ro) {
    const sec = el('section', '', 't-card sb-card sb-hd'); sec.dataset.hd = a.id;
    sec.append(el('h4', `Hoạt động ${ai + 1}: ${a.title}`, 'sb-hd-title'));
    if (!ro) {
      const f = el('form', '', 'sb-hd-form'); f.noValidate = true;
      const t = input(a.title, 200); const hd = input(a.huong_dan || '', 500);
      const s = el('button', 'Lưu hoạt động', 't-button'); s.type = 'submit';
      const tools = el('div', '', 't-actions');
      tools.append(s,
        button('Lên', () => this.simple({ viec: 'chuyen_hd', hd: a.id, huong: -1 }, 'Đã chuyển hoạt động.'), 't-button'),
        button('Xuống', () => this.simple({ viec: 'chuyen_hd', hd: a.id, huong: 1 }, 'Đã chuyển hoạt động.'), 't-button'),
        button('Xóa hoạt động', async () => {
          const ok = await confirmBox({ title: 'Xóa hoạt động?', body: `“${a.title}” và ${a.questions.length} câu hỏi trong đó sẽ không hiện cho học sinh nữa. Bài các em đã làm vẫn được giữ.`, okText: 'Xóa hoạt động', danger: true });
          if (ok) await this.simple({ viec: 'xoa_hd', hd: a.id }, 'Đã xóa hoạt động.');
        }, 't-button t-danger'));
      f.append(labeled('Tên hoạt động', t), labeled('Hướng dẫn cho học sinh (một câu, có thể để trống)', hd), tools);
      f.addEventListener('submit', async e => { e.preventDefault(); await withBusy(s, 'Đang lưu…', async () => { try { await this.op({ viec: 'sua_hd', hd: a.id, title: t.value, huong_dan: hd.value }, 'Đã lưu hoạt động.'); this.render(); } catch (er) { await noticeBox({ title: 'Chưa lưu được', body: errText(er) }); } }); });
      sec.append(f);
    } else if (a.huong_dan) sec.append(el('p', a.huong_dan, 't-muted'));
    const list = el('ol', '', 'sb-cau-list');
    a.questions.forEach((/** @type {any} */ q, /** @type {number} */ qi) => {
      const li = el('li', '', 'sb-cau'); li.dataset.cau = q.id;
      if (this.editing === q.id) li.append(this.form(this.draft, a));
      else {
        const sum = el('div', '', 'sb-cau-sum');
        sum.append(el('span', QTYPES[/** @type {keyof typeof QTYPES} */ (q.type)] || q.type, 't-badge'), el('p', q.prompt, 'sb-cau-de'));
        li.append(sum);
        if (!ro) {
          const tools = el('div', '', 't-actions sb-cau-tools');
          tools.append(button('Sửa', () => { this.editing = q.id; this.draft = JSON.parse(JSON.stringify(q)); this.render(`[data-cau="${q.id}"] textarea`); }, 't-button'),
            button('Lên', () => this.simple({ viec: 'chuyen_cau', cau_id: q.id, huong: -1 }, 'Đã chuyển câu hỏi.'), 't-button'),
            button('Xuống', () => this.simple({ viec: 'chuyen_cau', cau_id: q.id, huong: 1 }, 'Đã chuyển câu hỏi.'), 't-button'),
            button('Xóa', () => this.remove(q, qi), 't-button t-danger'));
          li.append(tools);
        }
      }
      list.append(li);
    });
    sec.append(a.questions.length ? list : el('p', 'Chưa có câu hỏi.', 't-muted'));
    if (!ro) {
      if (this.editing === 'new:' + a.id) sec.append(this.form(this.draft, a));
      else if (this.editing === 'pick:' + a.id) sec.append(this.picker(a));
      else sec.append(button('Thêm câu hỏi', () => { this.editing = 'pick:' + a.id; this.render(`[data-hd="${a.id}"] .sb-pick button`); }, 't-button t-primary sb-them-cau'));
    }
    return sec;
  }
  /** Chọn dạng câu hỏi mới. @param {any} a */
  picker(a) {
    const box = el('div', '', 'sb-pick'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Chọn dạng câu hỏi');
    box.append(el('p', 'Chọn dạng câu hỏi:', 'sb-pick-title'));
    for (const [k, name] of Object.entries(QTYPES)) {
      const b = button('', () => { this.editing = 'new:' + a.id; this.draft = blank(k); this.render(`[data-hd="${a.id}"] .sb-form textarea`); }, 't-button sb-pick-btn');
      b.dataset.loai = k; b.append(el('strong', name), el('span', VI_DU[/** @type {keyof typeof VI_DU} */ (k)], 'sb-pick-vd'));
      box.append(b);
    }
    box.append(button('Hủy', () => { this.editing = ''; this.render(); }, 't-button'));
    return box;
  }
  /** @param {Record<string, unknown>} body @param {string} ok */
  async simple(body, ok) {
    try { await this.op(body, ok); this.editing = ''; this.render(); }
    catch (e) { await noticeBox({ title: 'Chưa thực hiện được', body: errText(e) }); }
  }
  /** @param {any} q @param {number} qi */
  async remove(q, qi) {
    let so = 0;
    try { so = (await this.ctx.call({ op: 'soan', viec: 'dem', goi: this.m.id, cau_id: q.id })).so || 0; } catch { so = 0; }
    const ok = await confirmBox({ title: `Xóa câu ${qi + 1}?`, body: `“${q.prompt.slice(0, 120)}”. ${so ? `${so} học sinh đã làm câu này; bài làm của các em vẫn được giữ.` : 'Chưa học sinh nào làm câu này.'}`, okText: 'Xóa câu', danger: true });
    if (ok) await this.simple({ viec: 'xoa_cau', cau_id: q.id }, 'Đã xóa câu hỏi.');
  }

  /** Biểu mẫu soạn một câu (mới hoặc sửa). @param {any} q @param {any} a */
  form(q, a) {
    const f = el('form', '', 'sb-form'); f.noValidate = true;
    f.append(el('p', `Dạng: ${QTYPES[/** @type {keyof typeof QTYPES} */ (q.type)]}`, 'sb-form-loai'));
    /** @type {Record<string, HTMLElement>} */ const errs = {};
    const errBox = (/** @type {string} */ key, /** @type {HTMLElement} */ host) => { const p = el('p', '', 'field-error'); p.id = uid('sb-e'); p.hidden = true; host.append(p); errs[key] = p; host.dataset.key = key; return p; };
    const de = area(q.prompt); de.rows = 3; de.addEventListener('input', () => { q.prompt = de.value; });
    const fDe = labeled('Nội dung câu hỏi', de); errBox('prompt', fDe); de.setAttribute('aria-describedby', errs.prompt.id); f.append(fDe);
    const body = el('div', '', 'sb-form-body'); f.append(body);
    const redraw = () => { body.replaceChildren(this.typeEditor(q)); };
    redraw();
    for (const k of ['options', 'dung', 'items', 'nhom', 'chap_nhan']) errBox(k, body);
    if (q.type !== 'tu_luan') {
      const gt = area(q.giai_thich || '', 1000); gt.addEventListener('input', () => { q.giai_thich = gt.value; });
      const fGt = labeled('Giải thích (học sinh thấy sau khi bấm Kiểm tra)', gt); errBox('giai_thich', fGt); f.append(fGt);
    }
    const bb = /** @type {HTMLInputElement} */ (el('input')); bb.type = 'checkbox'; bb.checked = q.bat_buoc !== false; bb.addEventListener('change', () => { q.bat_buoc = bb.checked; });
    const lb = el('label', '', 'sb-check'); lb.append(bb, el('span', 'Học sinh phải trả lời câu này trước khi nộp')); f.append(lb);
    const save = el('button', 'Lưu câu hỏi', 't-button t-primary'); save.type = 'submit';
    const actions = el('div', '', 't-actions'); actions.append(save, button('Hủy', () => { this.editing = ''; this.draft = null; this.render(); }, 't-button'));
    f.append(actions);
    const show = (/** @type {{field:string,msg:string}} */ er) => {
      for (const p of Object.values(errs)) { p.hidden = true; p.textContent = ''; }
      f.querySelectorAll('[aria-invalid="true"]').forEach(x => x.setAttribute('aria-invalid', 'false'));
      const p = errs[er.field] || errs.prompt; p.textContent = er.msg; p.hidden = false;
      const host = /** @type {HTMLElement} */ (p.parentElement);
      const inp = /** @type {HTMLElement|null} */ (host.querySelector('input, textarea, select'));
      inp?.setAttribute('aria-invalid', 'true'); inp?.focus();
    };
    f.addEventListener('input', () => {   // sửa xong thì bỏ báo lỗi
      for (const p of Object.values(errs)) { p.hidden = true; p.textContent = ''; }
      f.querySelectorAll('[aria-invalid="true"]').forEach(x => x.setAttribute('aria-invalid', 'false'));
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const er = checkQuestion(q); if (er) { show(er); return; }
      await withBusy(save, 'Đang lưu…', async () => {
        try {
          await this.op({ viec: 'luu_cau', hd: a.id, cau: q }, 'Đã lưu câu hỏi.');
          this.editing = ''; this.draft = null; this.render(`[data-hd="${a.id}"] .sb-them-cau`);
        } catch (x) { if (x instanceof ApiError && x.code === 'SOAN_SAI') show({ field: /** @type {any} */ (x).field || 'prompt', msg: x.message }); else await noticeBox({ title: 'Chưa lưu được', body: errText(x) }); }
      });
    });
    return f;
  }

  /** Phần riêng của từng dạng câu. @param {any} q */
  typeEditor(q) {
    const wrap = el('div', '', 'sb-type');
    const again = () => { const host = /** @type {HTMLElement} */ (wrap.parentElement); const keep = [...host.querySelectorAll(':scope > .field-error')]; host.replaceChildren(this.typeEditor(q), ...keep); };
    const rowTools = (/** @type {any[]} */ arr, /** @type {number} */ i, min = 2) => {
      const t = el('div', '', 'sb-row-tools');
      if (arr.length > min) t.append(button('Bỏ', () => { arr.splice(i, 1); if (q.dung) q.dung = q.dung.filter((/** @type {number} */ x) => x !== i).map((/** @type {number} */ x) => (x > i ? x - 1 : x)); again(); }, 't-button sb-bo'));
      return t;
    };
    if (q.type === 'mot' || q.type === 'nhieu') {
      wrap.append(el('p', q.type === 'mot' ? 'Nhập các lựa chọn, đánh dấu 1 đáp án đúng. Không đánh dấu nếu là câu hỏi ý kiến (không chấm).' : 'Nhập các lựa chọn, đánh dấu tất cả đáp án đúng.', 't-muted'));
      q.options.forEach((/** @type {string} */ o, /** @type {number} */ i) => {
        const row = el('div', '', 'sb-row');
        const mark = /** @type {HTMLInputElement} */ (el('input')); mark.type = 'checkbox'; mark.checked = q.dung.includes(i);
        mark.setAttribute('aria-label', `Lựa chọn ${i + 1} là đáp án đúng`);
        mark.addEventListener('change', () => { q.dung = q.type === 'mot' ? (mark.checked ? [i] : []) : (mark.checked ? [...q.dung, i] : q.dung.filter((/** @type {number} */ x) => x !== i)); if (q.type === 'mot') again(); });
        const lab = el('label', '', 'sb-dung'); lab.append(mark, el('span', 'Đúng'));
        const t = input(o); t.setAttribute('aria-label', `Lựa chọn ${i + 1}`); t.addEventListener('input', () => { q.options[i] = t.value; });
        row.append(el('span', String.fromCharCode(65 + i), 'sb-key'), t, lab, rowTools(q.options, i)); wrap.append(row);
      });
      if (q.options.length < 8) wrap.append(button('Thêm lựa chọn', () => { q.options.push(''); again(); }, 't-button'));
    } else if (q.type === 'dung_sai' || q.type === 'phan_loai' || q.type === 'ghep') {
      if (q.type === 'phan_loai') {
        const g = el('div', '', 'sb-nhom'); g.append(el('p', 'Tên các nhóm (2 đến 4 nhóm):', 't-muted'));
        q.nhom.forEach((/** @type {string} */ n, /** @type {number} */ i) => {
          const t = input(n, 120); t.setAttribute('aria-label', `Tên nhóm ${i + 1}`);
          t.addEventListener('change', () => { const old = q.nhom[i]; q.nhom[i] = t.value.trim(); for (const it of q.items) if (it.dap === old) it.dap = q.nhom[i]; again(); });
          g.append(t);
        });
        if (q.nhom.length < 4) g.append(button('Thêm nhóm', () => { q.nhom.push(''); again(); }, 't-button'));
        wrap.append(g);
      }
      wrap.append(el('p', q.type === 'dung_sai' ? 'Mỗi dòng là một ý; chọn Đúng hoặc Sai.' : q.type === 'phan_loai' ? 'Mỗi dòng là một việc; chọn nhóm đúng.' : 'Mỗi dòng gồm vế trái và vế ghép đúng bên phải. Máy tự xáo vế phải cho học sinh.', 't-muted'));
      q.items.forEach((/** @type {any} */ it, /** @type {number} */ i) => {
        const row = el('div', '', 'sb-row');
        const t = input(it.text); t.setAttribute('aria-label', `Dòng ${i + 1}`); t.addEventListener('input', () => { it.text = t.value; });
        let right;
        if (q.type === 'ghep') { right = input(it.dap || ''); right.setAttribute('aria-label', `Vế ghép đúng của dòng ${i + 1}`); right.addEventListener('input', () => { it.dap = right.value; }); }
        else {
          right = /** @type {HTMLSelectElement} */ (el('select')); right.setAttribute('aria-label', `Đáp án dòng ${i + 1}`);
          const opts = q.type === 'dung_sai' ? DUNG_SAI : q.nhom.filter((/** @type {string} */ x) => x.trim());
          if (q.type === 'phan_loai') right.append(new Option('Chọn nhóm', ''));
          for (const o of opts) right.append(new Option(o, o));
          right.value = it.dap || ''; right.addEventListener('change', () => { it.dap = /** @type {HTMLSelectElement} */ (right).value; });
        }
        row.append(el('span', String(i + 1), 'sb-key'), t, right, rowTools(q.items, i)); wrap.append(row);
      });
      if (q.items.length < 12) wrap.append(button('Thêm dòng', () => { q.items.push(q.type === 'dung_sai' ? { text: '', dap: 'Đúng' } : { text: '', dap: '' }); again(); }, 't-button'));
    } else if (q.type === 'thu_tu') {
      wrap.append(el('p', 'Nhập các bước theo đúng thứ tự (bước 1 ở trên cùng). Máy tự xáo cho học sinh sắp xếp lại.', 't-muted'));
      q.items.forEach((/** @type {any} */ it, /** @type {number} */ i) => {
        const row = el('div', '', 'sb-row');
        const t = input(it.text); t.setAttribute('aria-label', `Bước ${i + 1}`); t.addEventListener('input', () => { it.text = t.value; });
        const tools = rowTools(q.items, i);
        if (i > 0) tools.prepend(button('Lên', () => { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; again(); }, 't-button'));
        row.append(el('span', `Bước ${i + 1}`, 'sb-key'), t, tools); wrap.append(row);
      });
      if (q.items.length < 12) wrap.append(button('Thêm bước', () => { q.items.push({ text: '' }); again(); }, 't-button'));
    } else if (q.type === 'dien') {
      const t = area(q.chap_nhan.join('\n'), 1000); t.rows = 3;
      t.addEventListener('input', () => { q.chap_nhan = t.value.split('\n'); });
      wrap.append(labeled('Đáp án được chấp nhận (mỗi dòng một cách viết; không phân biệt chữ hoa, có phân biệt dấu)', t));
    } else wrap.append(el('p', 'Học sinh tự viết câu trả lời. Máy không chấm; thầy cô đọc bài và đánh giá.', 't-muted'));
    return wrap;
  }

  addActivity() {
    const f = el('form', '', 't-card sb-card sb-them-hd'); f.noValidate = true;
    f.append(el('h4', 'Thêm hoạt động'));
    const t = input('', 200); const hd = input('', 500);
    const err = el('p', '', 'field-error'); err.id = uid('sb-err'); err.hidden = true; t.setAttribute('aria-describedby', err.id);
    const fT = labeled('Tên hoạt động', t); fT.append(err);
    const s = el('button', 'Thêm hoạt động', 't-button t-primary'); s.type = 'submit';
    f.append(fT, labeled('Hướng dẫn cho học sinh (một câu, có thể để trống)', hd), s);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!t.value.trim()) { err.textContent = 'Nhập tên hoạt động.'; err.hidden = false; t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
      await withBusy(s, 'Đang thêm…', async () => {
        try { await this.op({ viec: 'them_hd', title: t.value.trim(), huong_dan: hd.value.trim() }, 'Đã thêm hoạt động.'); this.render('.sb-hd:last-of-type .sb-them-cau'); }
        catch (er) { err.textContent = errText(er); err.hidden = false; }
      });
    });
    return f;
  }
}

/** Nhập bài soạn từ tệp JSON (ví dụ bài mẫu). @param {Ctx} ctx */
export function importLesson(ctx) {
  const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
  f.addEventListener('change', async () => {
    const file = f.files?.[0]; if (!file) return;
    if (file.size > 400000) { await noticeBox({ title: 'Tệp quá lớn', body: 'Tệp bài phải nhỏ hơn 400 KB.' }); return; }
    let m; try { m = JSON.parse(await file.text()); } catch { await noticeBox({ title: 'Tệp không đọc được', body: 'Tệp không đúng định dạng JSON.' }); return; }
    const n = (m.activities || []).reduce((/** @type {number} */ s, /** @type {any} */ a) => s + (a.questions || []).length, 0);
    if (!(await confirmBox({ title: 'Nhập bài từ tệp?', body: `${m.title || 'Bài'} (lớp ${m.grade || '?'}): ${(m.activities || []).length} hoạt động, ${n} câu hỏi. Nếu đã có bài cùng mã, nội dung sẽ được thay; bài học sinh đã làm vẫn được giữ.`, okText: 'Nhập bài' }))) return;
    try { const r = await ctx.call({ op: 'soan', viec: 'nhap', soan: m }); ctx.setStatus('Đã nhập bài.'); ctx.done(r.goi); }
    catch (e) { await noticeBox({ title: 'Chưa nhập được', body: errText(e) }); }
  });
  f.click();
}
