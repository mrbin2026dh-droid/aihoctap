// @ts-check
// Học AI – màn học sinh: danh sách bài, làm phiếu theo hoạt động, tự lưu nháp (máy + máy chủ), chốt, nhóm, góp ý, nộp.
import { api, ApiError } from './api.js';
import * as db from './db.js';
import { el, button, withBusy, confirmBox, noticeBox } from './dom.js';
import { fieldMap, optionsOf, isShown, missingForSubmit } from './phieu-core.js';

/** @typedef {{name:string, uid:string, token:()=>Promise<string>, alive:()=>boolean}} Ctx */
/** @typedef {{pack:any, bai:any, nhom:any, gopy:any, gv:any}} State */

const SAVE_MS = 1200;
const errText = (/** @type {unknown} */ e) => (e instanceof ApiError ? e.message : 'Chưa lưu được. Bài vẫn được giữ trên máy.');
const STATUS = { draft: 'Đang làm', submitted: 'Đã nộp', returned: 'Thầy cô đã trả bài' };

/** Danh sách bài Học AI của khối. @param {HTMLElement} box @param {Ctx} ctx */
export async function renderHocAi(box, ctx) {
  box.replaceChildren(el('p', 'Đang tải danh sách bài…', 'meta phieu-loading'));
  box.setAttribute('aria-busy', 'true');
  let packs = [];
  try {
    packs = (await api('/pwa/phieu', { token: await ctx.token() })).packs || [];
  } catch (e) {
    box.removeAttribute('aria-busy');
    if (!ctx.alive()) return;
    box.replaceChildren(emptyCard(e instanceof ApiError && e.status === 404 ? 'Chưa có bài Học AI' : 'Chưa tải được danh sách bài', e instanceof ApiError && e.status === 404 ? 'Thầy cô sẽ đưa bài lên sau.' : errText(e)));
    return;
  }
  box.removeAttribute('aria-busy');
  if (!ctx.alive()) return;
  if (!packs.length) { box.replaceChildren(emptyCard('Chưa có bài Học AI', 'Thầy cô sẽ đưa bài cho khối của em lên đây.')); return; }
  const list = el('div', '', 'lesson-stack phieu-list');
  for (const p of packs) {
    const card = el('article', '', 'lesson-card phieu-card');
    const desc = el('div', '', 'lesson-description');
    desc.append(el('h3', p.title), el('p', `Lớp ${p.grade}${p.so_tiet ? ` · ${p.so_tiet} tiết` : ''}`, 'meta'));
    card.append(desc, button('Vào bài', () => openPack(box, ctx, p.id), 'lesson-open'));
    list.append(card);
  }
  box.replaceChildren(list);
}

/** @param {string} t @param {string} d */
function emptyCard(t, d) { const c = el('div', '', 'empty-state'); c.append(el('h2', t), el('p', d)); return c; }

const localKey = (/** @type {Ctx} */ ctx, /** @type {string} */ goi) => `phieu:${ctx.uid}:${goi}`;

/** Mở một bài. @param {HTMLElement} box @param {Ctx} ctx @param {string} goi @param {string} [actId] */
async function openPack(box, ctx, goi, actId) {
  box.replaceChildren(el('p', 'Đang tải bài…', 'meta phieu-loading'));
  box.setAttribute('aria-busy', 'true');
  /** @type {any} */ let local = null;
  try { local = await db.get('drafts', localKey(ctx, goi)); } catch { local = null; }
  /** @type {State|null} */ let st = null; let offline = false;
  try {
    st = await api(`/pwa/phieu/${goi}`, { token: await ctx.token() });
  } catch (e) {
    if (local?.snap && !(e instanceof ApiError && e.status >= 400)) { st = local.snap; offline = true; }
    else { box.removeAttribute('aria-busy'); if (ctx.alive()) box.replaceChildren(emptyCard('Chưa mở được bài', errText(e)), button('Về danh sách', () => renderHocAi(box, ctx))); return; }
  }
  box.removeAttribute('aria-busy');
  if (!ctx.alive() || !st) return;
  new PackView(box, ctx, goi, st, local?.pending || {}, offline).render(actId);
}

class PackView {
  /** @param {HTMLElement} box @param {Ctx} ctx @param {string} goi @param {State} st @param {Record<string, any>} pending @param {boolean} offline */
  constructor(box, ctx, goi, st, pending, offline) {
    this.box = box; this.ctx = ctx; this.goi = goi; this.st = st; this.offline = offline;
    this.pack = st.pack; this.fm = fieldMap(this.pack);
    this.answers = { ...(st.bai.answers || {}) };
    this.pending = {};
    // Nháp chưa gửi trên máy: áp lên bài (trừ mục đã chốt hoặc bài đã nộp)
    if (this.editable()) for (const [k, v] of Object.entries(pending)) if (this.fm.has(k) && !st.bai.locked?.[k]) { this.answers[k] = v; this.pending[k] = v; }
    this.group = { ...(st.nhom?.answers || {}) };
    this.groupDirty = {};
    /** @type {ReturnType<typeof setTimeout>|undefined} */ this.timer = undefined;
    this.saving = false;
    this.status = el('p', '', 'phieu-status meta'); this.status.setAttribute('role', 'status');
    this.actId = '';
    /** @type {Record<string, number>|undefined} */ this.stepOf = undefined;
    /** @type {Record<string, number>|undefined} */ this.cardPos = undefined;
    /** @type {Record<string, any>|undefined} */ this.fb = undefined;
    this.markFilled = false;
  }
  editable() { return ['draft', 'returned'].includes(this.st.bai.status); }
  locked(/** @type {string} */ id) { return !!this.st.bai.locked?.[id]; }

  /** @param {string} [actId] */
  render(actId) {
    const acts = this.pack.activities || [];
    this.actId = actId && acts.some((/** @type {any} */ a) => a.id === actId) ? actId : acts[0]?.id;
    const head = el('div', '', 'phieu-head');
    const back = button('Về danh sách bài', async () => { await this.flush(); renderHocAi(this.box, this.ctx); }, 'back-button');
    const h = el('h2', this.pack.title, 'phieu-title'); h.tabIndex = -1;
    head.append(back, h, el('p', `Trạng thái: ${STATUS[this.st.bai.status] || 'Đang làm'}`, 'meta'), this.status);
    const nav = el('nav', '', 'phieu-steps'); nav.setAttribute('aria-label', 'Các hoạt động');
    acts.forEach((/** @type {any} */ a, /** @type {number} */ i) => {
      const b = button(`${i + 1}. ${a.title}`, async () => { await this.flush(); this.render(a.id); });
      if (a.id === this.actId) b.setAttribute('aria-current', 'step');
      nav.append(b);
    });
    const parts = [head];
    if (this.offline) parts.push(el('p', 'Đang mất mạng: em vẫn làm tiếp được, bài sẽ gửi khi có mạng.', 'inline-note'));
    if (this.st.gv?.nhan_xet) { const n = el('div', '', 'phieu-note'); n.append(el('h3', 'Nhận xét của thầy cô'), el('p', this.st.gv.nhan_xet)); parts.push(n); }
    parts.push(nav);
    const act = acts.find((/** @type {any} */ a) => a.id === this.actId);
    if (act) parts.push(this.activity(act));
    parts.push(this.footer(acts));
    this.box.replaceChildren(...parts);
    this.setStatus(Object.keys(this.pending).length ? 'Có phần chưa gửi lên máy chủ.' : '');
    if (Object.keys(this.pending).length && !this.offline) this.schedule();
    h.focus();
  }

  /** @param {any} a */
  activity(a) {
    const sec = el('section', '', 'phieu-act');
    const h = el('h3', a.title, 'phieu-act-title'); h.tabIndex = -1;
    sec.append(h);
    if (Array.isArray(a.buoc) && a.buoc.length) { this.steps(a, sec); return sec; }
    if (a.nhiem_vu) sec.append(el('p', a.nhiem_vu, 'phieu-task'));
    for (const b of a.blocks || []) sec.append(this.blockOrNote(b));
    const own = (a.fields || []).filter((/** @type {any} */ f) => f.mode !== 'nhom');
    const grp = (a.fields || []).filter((/** @type {any} */ f) => f.mode === 'nhom');
    if (grp.length) sec.append(this.groupPart(grp));
    if (own.length) {
      const form = el('div', '', 'phieu-form');
      for (const f of own) form.append(this.field(f, this.answers, false));
      sec.append(form);
      this.lockButton(own, sec);
    }
    if (a.peer_review) sec.append(this.peerPart(a.peer_review));
    return sec;
  }
  /** @param {string} b */
  blockOrNote(b) {
    if (this.pack.blocks?.[b]) return renderBlock(this.pack.blocks[b]);
    return el('p', 'Phần này thầy cô sẽ mở trong giờ học.', 'inline-note');
  }
  /** Nút chốt cho các ô có `lock`. @param {any[]} fields @param {HTMLElement} sec */
  lockButton(fields, sec) {
    const lockName = fields.find(f => f.lock)?.lock;
    if (!lockName || !this.editable()) return;
    const ids = fields.filter(f => f.lock === lockName).map(f => f.id);
    if (ids.some(id => !this.locked(id))) {
      const lb = button('Chốt', () => this.lock(lockName, ids, lb), 'primary phieu-lock');
      sec.append(lb);
    } else sec.append(el('p', 'Đã chốt. Cuối bài em sẽ xem lại lựa chọn này.', 'inline-note'));
  }

  /** Hoạt động chia bước: thanh bước, hướng dẫn đánh số, học liệu, ô hoặc thẻ. @param {any} a @param {HTMLElement} sec */
  steps(a, sec) {
    const list = a.buoc;
    /** @type {Record<string, number>} */ const pos = (this.stepOf ||= {});
    const i = Math.min(pos[a.id] || 0, list.length - 1);
    const go = async (/** @type {number} */ k) => { await this.flush(); pos[a.id] = k; this.render(a.id); };
    if (list.length > 1) {
      const nav = el('nav', '', 'phieu-buoc'); nav.setAttribute('aria-label', 'Các bước');
      list.forEach((/** @type {any} */ b, /** @type {number} */ k) => {
        const btn = button(`Bước ${k + 1}. ${b.tieu_de}`, () => go(k));
        if (k === i) btn.setAttribute('aria-current', 'step');
        nav.append(btn);
      });
      sec.append(nav);
    }
    const b = list[i];
    this.markFilled = !!b.danh_dau;
    if (b.mo_dau) sec.append(el('p', b.mo_dau, 'phieu-mo-dau'));
    if (b.huong_dan?.length) {
      const box = el('div', '', 'phieu-hd'); box.append(el('p', 'Em làm:', 'phieu-hd-title'));
      const ol = el('ol'); for (const t of b.huong_dan) ol.append(el('li', t)); box.append(ol); sec.append(box);
    }
    if (b.luu_y) sec.append(el('p', b.luu_y, 'inline-note'));
    for (const k of b.blocks || []) sec.append(this.blockOrNote(k));
    const fields = (b.fields || []).map((/** @type {string} */ id) => this.fm.get(id)).filter(Boolean);
    if (fields.length) {
      const form = el('div', '', 'phieu-form');
      for (const f of fields) form.append(this.field(f, this.answers, false));
      sec.append(form);
      this.lockButton(fields, sec);
    }
    if (b.the?.length) sec.append(this.cards(a, b.the));
    if (i < list.length - 1) sec.append(button(`Sang bước ${i + 2}: ${list[i + 1].tieu_de}`, () => go(i + 1), 'phieu-next'));
  }

  /** Thẻ làm lần lượt (ví dụ sáu tình huống), có nút Kiểm tra. @param {any} a @param {any[]} the */
  cards(a, the) {
    /** @type {Record<string, number>} */ const pos = (this.cardPos ||= {});
    const i = Math.min(pos[a.id] || 0, the.length - 1);
    const t = the[i];
    const card = el('article', '', 'phieu-the');
    card.append(el('p', `${t.ten} · ${i + 1}/${the.length}`, 'phieu-the-so'));
    if (t.noi_dung) card.append(el('p', t.noi_dung, 'phieu-the-nd'));
    if (t.goi_y) card.append(el('p', t.goi_y, 'meta phieu-goi-y'));
    const done = !!this.st.bai.kiem?.[t.kiem] || !!this.fb?.[t.kiem];
    const fb = this.fb?.[t.kiem];
    const form = el('div', '', 'phieu-form');
    let shown = 0;
    for (const id of t.fields || []) {
      const f = this.fm.get(id); if (!f) continue;
      if ((t.sau_kiem || []).includes(id) && !done) continue;
      const node = this.field({ ...f, label: String(f.label).replace(/^Tình huống \d+: /, '') }, this.answers, false);
      const kq = fb?.ket_qua?.find((/** @type {any} */ x) => x.field === id);
      if (kq) node.append(el('p', (kq.dung ? 'Đúng. ' : 'Chưa đúng. ') + kq.giai_thich, kq.dung ? 'phieu-ok' : 'phieu-chua'));
      if (!node.hidden) shown++;
      form.append(node);
    }
    if (!shown) form.append(el('p', 'Em làm bước trước rồi quay lại đây.', 'inline-note'));
    card.append(form);
    const out = el('div', '', 'phieu-fb'); out.setAttribute('role', 'status');
    if (this.fb?.[t.kiem]) this.showFeedback(out, this.fb[t.kiem]);
    if (t.kiem && this.editable()) {
      const kt = button(t.nut ? (done ? `${t.nut} lại` : t.nut) : (done ? 'Kiểm tra lại' : 'Kiểm tra'), () => this.check(a, t, kt), 'primary phieu-kiem');
      card.append(kt);
    }
    card.append(out);
    const row = el('div', '', 'phieu-the-nav');
    const go = async (/** @type {number} */ k) => { await this.flush(); pos[a.id] = k; this.render(a.id); };
    if (i > 0) row.append(button(`‹ ${the[i - 1].ten}`, () => go(i - 1)));
    if (i < the.length - 1) row.append(button(`${the[i + 1].ten} ›`, () => go(i + 1), 'phieu-the-tiep'));
    card.append(row);
    return card;
  }
  /** Gửi kiểm tra một thẻ. @param {any} a @param {any} t @param {HTMLButtonElement} btn */
  async check(a, t, btn) {
    const need = (t.fields || []).filter((/** @type {string} */ id) => this.fm.has(id) && isShown(this.fm.get(id), this.answers) && !(t.sau_kiem || []).includes(id) && !(t.tu_chon || []).includes(id) && !id.endsWith('_loi'));
    const miss = need.filter((/** @type {string} */ id) => { const v = this.answers[id]; return Array.isArray(v) ? !v.length : !String(v ?? '').trim(); });
    if (miss.length) { for (const id of miss) this.showErr([id], 'Em hãy trả lời ô này trước.'); /** @type {HTMLElement|null} */ (this.box.querySelector('[aria-invalid="true"]'))?.focus(); return; }
    let got = null;
    await withBusy(btn, 'Đang kiểm tra…', async () => {
      await this.flush();
      if (Object.keys(this.pending).length) { this.setStatus('Chưa gửi được bài. Kiểm tra mạng rồi thử lại.'); return; }
      try {
        got = await api(`/pwa/phieu/${this.goi}/kiem`, { method: 'POST', token: await this.ctx.token(), body: { the: t.kiem } });
      } catch (e) { this.setStatus(errText(e)); }
    });
    if (!got) return;
    const r = /** @type {any} */ (got);
    if (r.rev) this.st.bai.rev = r.rev;
    this.st.bai.kiem = { ...(this.st.bai.kiem || {}), [t.kiem]: this.st.bai.kiem?.[t.kiem] || { at: Date.now() } };
    (this.fb ||= {})[t.kiem] = r;
    this.render(a.id);
    /** @type {HTMLElement|null} */ (this.box.querySelector('.phieu-fb'))?.focus();
    if (r.chi_ghi) this.setStatus('Đã lưu bản đầu. Sang bước tiếp theo để tự kiểm tra và sửa.');
  }
  /** @param {HTMLElement} out @param {any} r */
  showFeedback(out, r) {
    out.tabIndex = -1;
    if (r.chi_ghi) { out.append(el('p', 'Đã lưu bản đầu. Thầy cô sẽ xem cả bản đầu và bản em sửa.', 'phieu-ok')); return; }
    const kq = r.ket_qua || [];
    const dung = kq.filter((/** @type {any} */ x) => x.dung).length;
    if (kq.length > 1) out.append(el('p', `Em đúng ${dung}/${kq.length}. Xem giải thích dưới từng câu.`, dung === kq.length ? 'phieu-ok' : 'phieu-chua'));
    if (r.ten) out.append(el('p', `Kiến thức: ${r.ten}.`, 'phieu-ten'));
    if (r.chot) out.append(el('p', r.chot, 'phieu-chot'));
    if (dung < kq.length) out.append(el('p', 'Em sửa lại rồi bấm Kiểm tra lại.', 'meta'));
  }


  /**
   * Một trường. @param {any} f @param {Record<string, any>} ans @param {boolean} isGroup
   * @returns {HTMLElement}
   */
  field(f, ans, isGroup) {
    if (f.type === 'heading') return el('h4', f.label, 'phieu-sub');
    const wrap = el('div', '', 'phieu-field field');
    wrap.dataset.field = f.id;
    wrap.hidden = !isShown(f, ans);
    const id = `pf-${f.id}`;
    const off = !this.editable() || (!isGroup && this.locked(f.id)) || (isGroup && !this.st.nhom);
    const err = el('p', '', 'field-error'); err.id = `${id}-err`; err.hidden = true;
    const note = [];
    if (!isGroup && this.locked(f.id)) note.push('đã chốt');
    if (f.type === 'multi' && f.exact) note.push(`chọn đúng ${f.exact}`);
    const filled = (/** @type {any} */ v) => wrap.classList.toggle('is-filled', Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '');
    if (this.markFilled) { wrap.classList.add('can-mark'); filled(ans[f.id]); }
    const onChange = (/** @type {any} */ v) => { if (this.markFilled) filled(v); if (isGroup) this.setGroup(f.id, v); else this.set(f.id, v); err.hidden = true; err.textContent = ''; wrap.querySelectorAll('[aria-invalid]').forEach(x => x.setAttribute('aria-invalid', 'false')); };
    if (f.type === 'text' || f.type === 'textarea') {
      const lab = el('label', f.label); lab.htmlFor = id;
      const inp = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (el(f.type === 'text' ? 'input' : 'textarea'));
      if (f.type === 'text') /** @type {HTMLInputElement} */ (inp).type = f.kieu === 'ngay' ? 'date' : 'text';
      inp.id = id; inp.name = f.id; inp.value = String(ans[f.id] ?? ''); inp.maxLength = f.max || 2000; inp.disabled = off;
      if (f.type === 'textarea') /** @type {HTMLTextAreaElement} */ (inp).rows = 3;
      if (f.required && !isGroup) inp.setAttribute('aria-required', 'true');
      inp.setAttribute('aria-describedby', err.id);
      inp.addEventListener('input', () => onChange(inp.value));
      wrap.append(lab, inp);
    } else if (f.kieu === 'chon') {
      const lab = el('label', f.label); lab.htmlFor = id;
      const sel = /** @type {HTMLSelectElement} */ (el('select'));
      sel.id = id; sel.name = f.id; sel.disabled = off; sel.setAttribute('aria-describedby', err.id);
      sel.append(new Option('Chọn…', ''));
      for (const o of optionsOf(this.pack, f)) sel.append(new Option(o, o));
      sel.value = String(ans[f.id] ?? '');
      sel.addEventListener('change', () => onChange(sel.value));
      wrap.append(lab, sel);
    } else {
      const fs = el('fieldset', '', f.kieu === 'nut' ? 'phieu-choice is-nut' : 'phieu-choice');
      const lg = el('legend', f.label); fs.append(lg);
      fs.setAttribute('aria-describedby', err.id);
      const multi = f.type === 'multi' || f.type === 'members';
      const opts = f.type === 'members' ? Object.entries(this.st.nhom?.members || {}).map(([u, n]) => ({ v: u, t: String(n) })) : optionsOf(this.pack, f).map(o => ({ v: o, t: o }));
      if (f.type === 'members' && !opts.length) fs.append(el('p', 'Vào nhóm để chọn bạn.', 'meta'));
      const cur = ans[f.id];
      const checked = (/** @type {string} */ v) => (multi ? Array.isArray(cur) && cur.includes(v) : cur === v);
      for (const o of opts) {
        const lab = el('label', '', 'option');
        const inp = /** @type {HTMLInputElement} */ (el('input'));
        inp.type = multi ? 'checkbox' : 'radio'; inp.name = `${id}-${isGroup ? 'g' : 'c'}`; inp.value = o.v; inp.checked = checked(o.v); inp.disabled = off;
        inp.addEventListener('change', () => {
          if (!multi) return onChange(inp.value);
          const vals = [...fs.querySelectorAll('input:checked')].map(x => /** @type {HTMLInputElement} */ (x).value);
          const max = f.exact || f.max_members || 99;
          if (vals.length > max) { inp.checked = false; err.textContent = `Chỉ chọn tối đa ${max}.`; err.hidden = false; return; }
          onChange(vals);
        });
        lab.append(inp, el('span', o.t)); fs.append(lab);
      }
      if (f.allow_custom) {
        const lab = el('label', 'Hoặc tự ghi'); const inp = /** @type {HTMLInputElement} */ (el('input'));
        inp.id = `${id}-tu-ghi`; lab.htmlFor = inp.id; inp.maxLength = 120; inp.disabled = off;
        inp.value = typeof cur === 'string' && !opts.some(o => o.v === cur) ? cur : '';
        inp.addEventListener('input', () => { fs.querySelectorAll('input[type=radio]').forEach(x => { /** @type {HTMLInputElement} */ (x).checked = false; }); onChange(inp.value); });
        fs.append(lab, inp);
      }
      wrap.append(fs);
    }
    if (note.length) wrap.append(el('p', note.join(' · '), 'meta phieu-hint'));
    if (isGroup && this.st.nhom?.by?.[f.id]) wrap.append(el('p', `Người ghi gần nhất: ${this.st.nhom.members?.[this.st.nhom.by[f.id]] || 'bạn trong nhóm'}`, 'meta phieu-hint'));
    wrap.append(err);
    return wrap;
  }

  /** Cập nhật câu trả lời cá nhân và hẹn lưu. @param {string} id @param {any} v */
  set(id, v) {
    this.answers[id] = v; this.pending[id] = v;
    this.refreshShown(this.answers);
    this.keepLocal();
    this.setStatus('Đang lưu…');
    this.schedule();
  }
  /** @param {string} id @param {any} v */
  setGroup(id, v) { this.group[id] = v; this.groupDirty[id] = v; this.refreshShown(this.group); }
  /** @param {Record<string, any>} ans */
  refreshShown(ans) {
    for (const w of this.box.querySelectorAll('.phieu-field')) {
      const f = this.fm.get(/** @type {HTMLElement} */ (w).dataset.field || '');
      if (f?.show_if) /** @type {HTMLElement} */ (w).hidden = !isShown(f, ans);
    }
  }
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush(); }, SAVE_MS); }
  keepLocal() { db.put('drafts', localKey(this.ctx, this.goi), { pending: this.pending, snap: { ...this.st, bai: { ...this.st.bai, answers: this.answers } }, at: Date.now() }).catch(() => {}); }
  /** @param {string} t */
  setStatus(t) { this.status.textContent = t; }

  /** Gửi phần thay đổi lên máy chủ. */
  async flush() {
    clearTimeout(this.timer);
    const send = { ...this.pending };
    if (!Object.keys(send).length || this.saving || !this.editable()) return;
    this.saving = true;
    try {
      const r = await api(`/pwa/phieu/${this.goi}/draft`, { method: 'PUT', token: await this.ctx.token(), body: { rev: this.st.bai.rev, answers: send } });
      this.st.bai.rev = r.rev; this.st.bai.answers = { ...(this.st.bai.answers || {}), ...send };
      for (const [k, v] of Object.entries(send)) if (JSON.stringify(this.pending[k]) === JSON.stringify(v)) delete this.pending[k];
      this.offline = false;
      this.keepLocal();
      this.setStatus(Object.keys(this.pending).length ? 'Đang lưu…' : 'Đã lưu.');
      if (Object.keys(this.pending).length) this.schedule();
      // Học liệu mở theo câu trả lời (ví dụ trang 2): tải lại để nhận nội dung
      if ((this.pack.reveal || []).some((/** @type {any} */ x) => x.after_field && send[x.after_field] && (this.pack.locked_blocks || []).includes(x.block))) await this.reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REV_CONFLICT') { await this.reload('Bài vừa được lưu từ máy khác. Đã tải bản mới và giữ phần em vừa sửa.'); }
      else if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        const f = e.code === 'FIELD_LOCKED' || e.code === 'NOT_EDITABLE' ? null : this.showErr(Object.keys(send), e.message);
        if (!f) for (const k of Object.keys(send)) delete this.pending[k];
        this.keepLocal(); this.setStatus(e.message);
      } else this.setStatus('Chưa gửi được. Bài vẫn giữ trên máy, sẽ gửi lại khi có mạng.');
    } finally { this.saving = false; }
  }
  /** Hiện lỗi dưới trường đầu tiên trong danh sách. @param {string[]} ids @param {string} msg */
  showErr(ids, msg) {
    for (const id of ids) {
      const w = /** @type {HTMLElement|null} */ (this.box.querySelector(`[data-field="${id}"]`));
      if (!w) continue;
      const er = /** @type {HTMLElement} */ (w.querySelector('.field-error'));
      er.textContent = msg; er.hidden = false;
      const inp = w.querySelector('input, textarea, fieldset'); inp?.setAttribute('aria-invalid', 'true');
      return w;
    }
    return null;
  }
  /** Tải lại từ máy chủ, giữ phần chưa gửi. @param {string} [msg] */
  async reload(msg) {
    try {
      const st = await api(`/pwa/phieu/${this.goi}`, { token: await this.ctx.token() });
      const keep = { ...this.pending };
      const v = new PackView(this.box, this.ctx, this.goi, st, keep, false);
      v.render(this.actId);
      if (msg) v.setStatus(msg);
    } catch (e) { this.setStatus(errText(e)); }
  }

  /** @param {string} name @param {string[]} ids @param {HTMLButtonElement} btn */
  async lock(name, ids, btn) {
    const miss = ids.filter(id => { const v = this.answers[id]; const f = this.fm.get(id); return v === null || v === undefined || (Array.isArray(v) ? (f.exact ? v.length !== f.exact : !v.length) : !String(v).trim()); });
    if (miss.length) { this.showErr(miss, 'Hãy trả lời mục này trước khi chốt.'); /** @type {HTMLElement|null} */ (this.box.querySelector(`[data-field="${miss[0]}"] input, [data-field="${miss[0]}"] textarea`))?.focus(); return; }
    if (!(await confirmBox({ title: 'Chốt lựa chọn đầu giờ?', body: 'Sau khi chốt, em không sửa được lựa chọn này. Cuối giờ em sẽ so sánh với suy nghĩ mới.', okText: 'Chốt lựa chọn' }))) return;
    await withBusy(btn, 'Đang chốt…', async () => {
      await this.flush();
      try {
        const r = await api(`/pwa/phieu/${this.goi}/lock`, { method: 'POST', token: await this.ctx.token(), body: { rev: this.st.bai.rev, lock: name } });
        this.st.bai.rev = r.rev; this.st.bai.locked = r.locked;
      } catch (e) { await noticeBox({ title: 'Chưa chốt được', body: errText(e) }); return; }
    });
    this.render(this.actId);
  }

  /** Phần nhóm: chọn số nhóm, sửa chung, lưu. @param {any[]} fields */
  groupPart(fields) {
    const sec = el('div', '', 'phieu-group');
    sec.append(el('h4', 'Phiếu nhóm', 'phieu-sub'));
    const so = this.st.nhom?.so;
    const row = el('div', '', 'phieu-row');
    const lab = el('label', 'Số nhóm'); const inp = /** @type {HTMLInputElement} */ (el('input'));
    inp.id = `pg-so-${this.actId}`; lab.htmlFor = inp.id; inp.type = 'number'; inp.min = '1'; inp.max = '20'; inp.required = true; inp.inputMode = 'numeric'; inp.value = so ? String(so) : '';
    const err = el('p', '', 'field-error'); err.id = inp.id + '-err'; err.hidden = true; inp.setAttribute('aria-describedby', err.id);
    lab.append(inp);
    const join = button(so ? 'Đổi nhóm' : 'Vào nhóm', async () => {
      const n = Number(inp.value);
      if (!Number.isInteger(n) || n < 1 || n > 20) { err.textContent = 'Nhập số nhóm từ 1 đến 20.'; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
      inp.setAttribute('aria-invalid', 'false'); err.hidden = true;
      await withBusy(join, 'Đang vào nhóm…', async () => {
        try { await api(`/pwa/phieu/${this.goi}/nhom`, { method: 'PUT', token: await this.ctx.token(), body: { so: n } }); }
        catch (e) { err.textContent = errText(e); err.hidden = false; return; }
      });
      await this.reload(`Đã vào nhóm ${n}.`);
    });
    row.append(lab, join);
    sec.append(row, err);
    if (!this.st.nhom) { sec.append(el('p', 'Nhập số nhóm thầy cô chia để cùng làm phần này.', 'meta')); return sec; }
    sec.append(el('p', 'Thành viên: ' + Object.values(this.st.nhom.members || {}).join(', '), 'meta'));
    const form = el('div', '', 'phieu-form');
    for (const f of fields) form.append(this.field(f, this.group, true));
    sec.append(form);
    if (this.editable()) {
      const save = button('Lưu phần nhóm', async () => {
        const send = { ...this.groupDirty };
        if (!Object.keys(send).length) { this.setStatus('Phần nhóm chưa có thay đổi.'); return; }
        await withBusy(save, 'Đang lưu…', async () => {
          try {
            const r = await api(`/pwa/phieu/${this.goi}/nhom`, { method: 'PUT', token: await this.ctx.token(), body: { so: this.st.nhom.so, rev: this.st.nhom.rev, answers: send } });
            this.st.nhom = { ...this.st.nhom, ...r }; this.groupDirty = {}; this.setStatus('Đã lưu phần nhóm.');
          } catch (e) {
            if (e instanceof ApiError && e.code === 'REV_CONFLICT') await noticeBox({ title: 'Bạn trong nhóm vừa lưu', body: 'Hãy tải lại để xem bản mới rồi sửa tiếp phần của em.', okText: 'Đã hiểu' });
            else if (!this.showErr(Object.keys(send), errText(e))) this.setStatus(errText(e));
          }
        });
      }, 'primary');
      sec.append(save);
    }
    return sec;
  }

  /** Góp ý cho bạn cùng nhóm và xem góp ý mình nhận được. @param {any} pr */
  peerPart(pr) {
    const sec = el('div', '', 'phieu-group');
    sec.append(el('h4', 'Bạn góp ý', 'phieu-sub'));
    const got = Object.values(this.st.gopy || {});
    if (got.length) {
      const box = el('div', '', 'phieu-note');
      box.append(el('p', 'Góp ý em nhận được (của bạn, không phải điểm):', 'meta'));
      for (const g of got) for (const t of pr.targets) {
        const x = /** @type {any} */ (g)['g' + t.goal]; if (!x) continue;
        const lines = t.kiem.map((/** @type {string} */ k, /** @type {number} */ i) => `${x.checks?.[i] ? 'Có' : 'Chưa'}: ${k}`);
        box.append(el('p', `${/** @type {any} */ (g).name || 'Bạn'} · Mục tiêu ${t.goal}: ${lines.join('; ')}${x.text ? '. ' + x.text : ''}`));
      }
      sec.append(box);
    }
    const others = Object.entries(this.st.nhom?.members || {}).filter(([u]) => u !== this.st.bai.uid);
    if (!this.st.nhom) { sec.append(el('p', 'Vào nhóm để góp ý cho bạn.', 'meta')); return sec; }
    if (!others.length) { sec.append(el('p', 'Nhóm chưa có bạn khác.', 'meta')); return sec; }
    const lab = el('label', 'Chọn bạn để góp ý'); const sel = /** @type {HTMLSelectElement} */ (el('select'));
    sel.id = 'pr-ban'; lab.htmlFor = sel.id; sel.append(new Option('Chọn bạn', ''));
    for (const [u, n] of others) sel.append(new Option(String(n), u));
    lab.append(sel);
    const area = el('div', '', 'phieu-form');
    sel.addEventListener('change', async () => {
      area.replaceChildren(); if (!sel.value) return;
      area.setAttribute('aria-busy', 'true'); area.append(el('p', 'Đang tải mục tiêu của bạn…', 'meta'));
      try {
        const r = await api(`/pwa/phieu/${this.goi}/gopy?uid=${encodeURIComponent(sel.value)}`, { token: await this.ctx.token() });
        area.replaceChildren();
        for (const t of pr.targets) area.append(this.peerForm(t, r, sel.value));
      } catch (e) { area.replaceChildren(el('p', errText(e), 'field-error')); }
      area.removeAttribute('aria-busy');
    });
    sec.append(lab, area);
    return sec;
  }
  /** @param {any} t @param {any} r @param {string} uid */
  peerForm(t, r, uid) {
    const fs = el('fieldset', '', 'phieu-choice');
    fs.append(el('legend', `Mục tiêu ${t.goal} của ${r.name}`));
    for (const id of t.fields) { const f = this.fm.get(id); if (f && r.answers[id]) fs.append(el('p', `${f.label}: ${Array.isArray(r.answers[id]) ? r.answers[id].join(', ') : r.answers[id]}`)); }
    if (!t.fields.some((/** @type {string} */ id) => r.answers[id])) fs.append(el('p', 'Bạn chưa viết mục tiêu này.', 'meta'));
    const boxes = t.kiem.map((/** @type {string} */ k, /** @type {number} */ i) => { const l = el('label', '', 'option'); const c = /** @type {HTMLInputElement} */ (el('input')); c.type = 'checkbox'; c.name = `pr-${t.goal}-${i}`; l.append(c, el('span', k)); fs.append(l); return c; });
    const lab = el('label', 'Một gợi ý sửa'); const tx = /** @type {HTMLTextAreaElement} */ (el('textarea')); tx.id = `pr-tx-${t.goal}`; lab.htmlFor = tx.id; tx.maxLength = 600; tx.rows = 2; lab.append(tx);
    const msg = el('p', '', 'meta'); msg.setAttribute('role', 'status');
    const send = button('Gửi góp ý', async () => {
      await withBusy(send, 'Đang gửi…', async () => {
        try { await api(`/pwa/phieu/${this.goi}/gopy`, { method: 'POST', token: await this.ctx.token(), body: { uid, goal: t.goal, checks: boxes.map((/** @type {HTMLInputElement} */ c) => c.checked), text: tx.value.trim() } }); msg.textContent = 'Đã gửi góp ý.'; }
        catch (e) { msg.textContent = errText(e); }
      });
    });
    fs.append(lab, send, msg);
    return fs;
  }

  /** Nút nộp ở cuối và chuyển hoạt động. @param {any[]} acts */
  footer(acts) {
    const bar = el('div', '', 'submit-bar phieu-foot');
    const i = acts.findIndex(a => a.id === this.actId);
    if (i < acts.length - 1) bar.append(button('Hoạt động tiếp theo', async () => { await this.flush(); this.render(acts[i + 1].id); }));
    if (this.editable()) {
      const sb = button('Nộp bài', () => this.submit(sb), 'primary');
      bar.append(sb);
    }
    return bar;
  }
  /** @param {HTMLButtonElement} btn */
  async submit(btn) {
    const miss = missingForSubmit(this.pack, this.answers);
    if (miss.length) {
      const f0 = this.fm.get(miss[0]);
      const act = (this.pack.activities || []).find((/** @type {any} */ a) => (a.fields || []).some((/** @type {any} */ f) => f.id === miss[0]));
      await noticeBox({ title: 'Còn mục chưa trả lời', body: `Còn ${miss.length} mục cần trả lời. Mục đầu tiên: "${f0?.label || miss[0]}" ở hoạt động "${act?.title || ''}".`, okText: 'Đến mục đó' });
      if (act) {
        // Đưa tới đúng bước và đúng thẻ chứa mục còn thiếu
        (act.buoc || []).forEach((/** @type {any} */ b, /** @type {number} */ k) => {
          if ((b.fields || []).includes(miss[0])) (this.stepOf ||= {})[act.id] = k;
          (b.the || []).forEach((/** @type {any} */ t, /** @type {number} */ j) => { if ((t.fields || []).includes(miss[0])) { (this.stepOf ||= {})[act.id] = k; (this.cardPos ||= {})[act.id] = j; } });
        });
        this.render(act.id);
      }
      for (const id of miss) this.showErr([id], 'Mục này cần trả lời.');
      /** @type {HTMLElement|null} */ (this.box.querySelector('[aria-invalid="true"]'))?.focus();
      return;
    }
    if (!(await confirmBox({ title: 'Nộp bài?', body: 'Sau khi nộp, em chỉ sửa được khi thầy cô trả bài.', okText: 'Nộp bài' }))) return;
    await withBusy(btn, 'Đang nộp…', async () => {
      await this.flush();
      if (Object.keys(this.pending).length) { await noticeBox({ title: 'Chưa nộp được', body: 'Bài chưa gửi hết lên máy chủ. Kiểm tra mạng rồi nộp lại.' }); return; }
      try {
        await api(`/pwa/phieu/${this.goi}/submit`, { method: 'POST', token: await this.ctx.token(), body: { rev: this.st.bai.rev } });
        await noticeBox({ title: 'Đã nộp bài', body: 'Thầy cô sẽ xem và nhận xét bài của em.' });
        await this.reload();
      } catch (e) { await noticeBox({ title: 'Chưa nộp được', body: errText(e) }); }
    });
  }
}

/** Học liệu: thẻ, danh sách, bảng. @param {any} b */
export function renderBlock(b) {
  const sec = el('section', '', 'phieu-block');
  sec.append(el('h4', b.title, 'phieu-sub'));
  for (const t of b.text || []) sec.append(el('p', t, 'meta'));
  if (b.type === 'table') {
    const wrap = el('div', '', 'table-wrap'); const tb = el('table'); const tr = el('tr');
    for (const c of b.columns || []) tr.append(el('th', c));
    const thead = el('thead'); thead.append(tr); tb.append(thead);
    const body = el('tbody');
    for (const r of b.rows || []) { const row = el('tr'); for (const v of Object.values(r)) row.append(el('td', Array.isArray(v) ? v.join(' ') : String(v ?? ''))); body.append(row); }
    tb.append(body); wrap.append(tb); sec.append(wrap);
    return sec;
  }
  const grid = el('div', '', b.type === 'cards' ? 'phieu-cards' : 'phieu-items');
  for (const it of b.items || []) {
    const c = el('div', '', 'phieu-item');
    if (typeof it === 'string') c.append(el('p', it));
    else for (const [k, v] of Object.entries(it)) {
      if (k === 'id') continue;
      if (Array.isArray(v)) for (const p of v) c.append(el('p', String(p)));
      else c.append(el(k === 'ten' ? 'strong' : 'p', String(v)));
    }
    grid.append(c);
  }
  sec.append(grid);
  return sec;
}
