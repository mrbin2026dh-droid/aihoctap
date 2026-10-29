// @ts-check
// Học sinh: Thảo luận trên lớp (kiểu Mentimeter). Thầy cô mở thảo luận → mục Luyện tập hiện thẻ "Thảo luận đang mở" →
// Vào phòng → mỗi trang em gửi từ khóa / ý kiến / bình chọn / chấm điểm 1–5 / đặt câu hỏi. Màn chiếu hiện ẩn danh,
// thầy cô duyệt trước khi hiện. Từ ngữ không phù hợp bị chặn ngay trên máy em.
import * as store from './thi-store.js';
import * as fx from './quiz-fx.js';
import { MAX_LEN, badWord, entriesOf, qaRank, scaleValue, visible } from './tl-core.js';

/** @type {{ma:string,ten:string,lop:string,key:string}|null} */ let me = null;
/** @type {null|(() => void)} */ let stopLop = null, stopInfo = null, stopQa = null, stopVote = null;
/** @type {(() => void)[]} */ let stops = [];
let room = '', playing = '', dismissed = '', probeTimer = 0, lastKey = '', readySeen = '';
/** @type {any} */ let info = null, pub = null;
/** @type {Record<string, string[]>} ý em đã gửi theo trang */ let mine = {};
/** @type {any} */ let qaY = null, qaVotes = null;
/** @type {() => void} */ let onChange = () => {};

export function setOnChange(/** @type {() => void} */ fn) { onChange = fn; }
/** @param {{uid:string,student_name:string,class_code:string}} identity */
export function start(identity) {
  if (!store.enabled()) return;
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, key: store.keyOf(identity.uid) };
  if (me && me.ma === next.ma && stopLop) return;
  stop(); me = next; void probe();
}
async function probe() {
  if (!me || stopLop) return;
  const path = `tl_lop/${store.keyOf(me.lop)}`;
  try { await store.get(path); } catch { clearTimeout(probeTimer); probeTimer = window.setTimeout(() => void probe(), 600000); return; }
  if (!me || stopLop) return;
  stopLop = store.listen(path, d => {
    const code = typeof d === 'string' && /^\d{6}$/.test(d) ? d : '';
    if (code === room) return;
    room = code; info = null; stopInfo?.(); stopInfo = null;
    if (room) stopInfo = store.listen(`tl/${room}/pub`, p => { info = p; banner(); onChange(); if (playing === room) { pub = p; draw(); } }, undefined, { prio: 3 });
    banner(); onChange();
  });
}
export function stop() { clearTimeout(probeTimer); stopLop?.(); stopLop = null; stopInfo?.(); stopInfo = null; leave(); room = ''; info = null; me = null; banner(); onChange(); }
export const active = () => Boolean(room && info && info.phase !== 'end');

function t(/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
function b(/** @type {string} */ text, /** @type {string} */ cls, /** @type {() => void} */ fn) { const x = /** @type {HTMLButtonElement} */ (t('button', cls, text)); x.type = 'button'; x.addEventListener('click', fn); return x; }

/** Thẻ trong mục Luyện tập. @param {HTMLElement} target */
export function renderPanel(target) {
  target.replaceChildren();
  if (!me || !active()) return;
  const card = t('article', 'lt-card tl-card');
  const head = t('div', 'lt-card-head'); head.append(t('span', 'lt-live', info.phase === 'lobby' ? 'Thảo luận đang mở' : 'Đang thảo luận'), t('span', 'lt-code', 'Mã phòng ' + room.replace(/(\d{3})(\d{3})/, '$1 $2')));
  card.append(head, t('h2', 'lt-title', String(info.title || 'Thảo luận')), t('p', 'lt-meta', `${Number(info.n) || 0} câu hỏi · ý kiến hiện ẩn danh`), b(playing === room ? 'Quay lại phòng' : 'Vào phòng', 'primary lt-join tl-join', () => void join()));
  target.append(card);
}
function banner() {
  let bn = document.getElementById('tl-banner');
  const quizShown = !!document.getElementById('lt-banner') && !document.getElementById('lt-banner')?.hidden;
  const show = active() && !!me && dismissed !== room && playing !== room && document.getElementById('practice-view')?.hidden !== false && !quizShown;
  if (!show) { if (bn) bn.hidden = true; return; }
  if (!bn) {
    bn = t('div', 'lt-banner tl-banner'); bn.id = 'tl-banner'; bn.setAttribute('role', 'status');
    const mid = t('div', 'lt-banner-mid'); mid.append(t('strong', 'lt-banner-title', ''), t('span', '', 'Thầy cô đang mở thảo luận trên lớp.'));
    bn.append(t('span', 'lt-banner-dot', ''), mid, b('Vào phòng', 'primary lt-banner-join tl-banner-join', () => void join()), b('×', 'lt-banner-x', () => { dismissed = room; banner(); }));
    /** @type {HTMLElement} */ (bn.querySelector('.lt-banner-x')).setAttribute('aria-label', 'Ẩn thông báo thảo luận');
    document.body.append(bn);
  }
  /** @type {HTMLElement} */ (bn.querySelector('.lt-banner-title')).textContent = String(info?.title || 'Thảo luận');
  bn.hidden = false;
}
export function refreshBanner() { banner(); }

function overlay() {
  let o = document.getElementById('tl-play');
  if (!o) {
    o = t('div', 'lt-play tl-play'); o.id = 'tl-play'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Thảo luận');
    const header = t('header', 'lt-top'); header.append(t('strong', 'lt-top-title'), fx.soundToggle('lt-sound'), b('×', 'lt-close', () => close()));
    /** @type {HTMLElement} */ (header.querySelector('.lt-close')).setAttribute('aria-label', 'Thoát màn hình thảo luận');
    const main = t('main', 'lt-main tl-main'); main.setAttribute('aria-live', 'polite');
    o.append(header, main); document.body.append(o);
  }
  return o;
}
function close() {
  if (!pub || pub.phase === 'end' || playing !== room) leave();
  else { const o = document.getElementById('tl-play'); if (o) o.hidden = true; document.body.classList.remove('lt-playing'); }
  banner(); onChange();
}
async function join() {
  if (!me || !room) return;
  if (playing && playing !== room) leave();
  const o = overlay(); o.hidden = false; document.body.classList.add('lt-playing'); banner();
  if (playing === room) { lastKey = ''; draw(); return; }
  playing = room; mine = {};
  /** @type {HTMLElement} */ (o.querySelector('.tl-main')).replaceChildren(t('p', 'lt-wait', 'Đang vào phòng…'));
  await store.put(`tl/${playing}/ds/${me.key}`, { ten: me.ten, at: store.SERVER_TIME }).catch(() => { /* đã vào trước đó */ });
  stops.forEach(f => f()); stops = [];
  pub = info;
  stops.push(store.listen(`tl/${playing}/pub`, d => { pub = d; draw(); }, undefined, { prio: 3 }));
  onChange(); lastKey = ''; draw();
  /** @type {HTMLElement} */ (o.querySelector('.lt-close')).focus();
}
function leave() { playing = ''; stops.forEach(f => f()); stops = []; stopQa?.(); stopVote?.(); stopQa = stopVote = null; pub = null; lastKey = ''; readySeen = ''; qaY = qaVotes = null; const o = document.getElementById('tl-play'); if (o) o.hidden = true; document.body.classList.remove('lt-playing'); }

/** Nghe danh sách câu hỏi + phiếu cho trang Hỏi đáp. @param {string} k */
function watchQa(k) {
  const key = `${playing}|${k}`;
  if (/** @type {any} */ (watchQa).key === key) return;
  stopQa?.(); stopVote?.(); qaY = qaVotes = null; /** @type {any} */ (watchQa).key = key;
  stopQa = store.listen(`tl/${playing}/y/${k}`, d => { qaY = d; lastKey = ''; draw(); }, undefined, { prio: 2 });
  stopVote = store.listen(`tl/${playing}/vote/${k}`, d => { qaVotes = d; lastKey = ''; draw(); }, undefined, { prio: 1 });
}
function unwatchQa() { stopQa?.(); stopVote?.(); stopQa = stopVote = null; /** @type {any} */ (watchQa).key = ''; }

/** Lần đầu vào một trang: đọc lại các ý em đã gửi (tải lại trang vẫn đúng số ý). @param {string} k */
async function restore(k) {
  if (!me || mine[k]) return;
  mine[k] = [];
  const d = await store.get(`tl/${playing}/y/${k}/${me.key}`).catch(() => null);
  mine[k] = Object.values(d || {}).map((/** @type {any} */ e) => String(e?.v || ''));
  lastKey = ''; draw();
}

function draw() {
  const o = document.getElementById('tl-play'); if (!o || o.hidden || !pub) return;
  /** @type {HTMLElement} */ (o.querySelector('.lt-top-title')).textContent = pub.title || 'Thảo luận';
  const main = /** @type {HTMLElement} */ (o.querySelector('.tl-main'));
  const s = pub.slide || {}, k = String(s.k || '');
  const key = JSON.stringify([pub.phase, k, mine[k]?.length ?? -1, s.type === 'qa' ? [qaY, qaVotes, pub.ok, pub.an, pub.done] : 0]);
  if (key === lastKey) return;
  // đang gõ dở: không vẽ lại đè lên ô nhập (chỉ vẽ khi đổi trang / đổi trạng thái)
  const typing = document.activeElement && main.contains(document.activeElement) && /** @type {HTMLElement} */ (document.activeElement).matches('input,textarea') && /** @type {HTMLElement} */ (main.querySelector('[data-k]'))?.dataset.k === k && pub.phase === 'open';
  if (typing && s.type !== 'qa') return;
  lastKey = key;
  if (pub.phase !== 'open' && pub.phase !== 'closed' || s.type !== 'qa') unwatchQa();
  if (pub.phase === 'lobby') { main.replaceChildren(t('span', 'lt-avatar', String(me?.ten || '?').trim().split(/\s+/).slice(-1)[0].slice(0, 1).toUpperCase()), t('p', 'lt-name', me?.ten || ''), t('h2', 'lt-big', 'Em đã vào phòng thảo luận'), t('p', 'lt-wait', 'Ý kiến của em hiện ẩn danh trên màn chiếu. Chờ thầy cô bắt đầu.'), t('span', 'lt-pulse', '')); return; }
  if (pub.phase === 'ready') { main.replaceChildren(t('h2', 'lt-big', 'Chuẩn bị!')); if (readySeen !== String(pub.ready)) { readySeen = String(pub.ready); void fx.countdown(o, { title: String(pub.title || 'Chuẩn bị!') }); } return; }
  if (pub.phase === 'end') { main.replaceChildren(t('span', 'lt-res-ic tl-end-ic', '✓'), t('h2', 'lt-big', 'Buổi thảo luận kết thúc'), t('p', 'lt-wait', 'Cảm ơn em đã chia sẻ ý kiến!'), b('Đóng', 'primary lt-done', () => close())); return; }
  if (!k) return;
  if (!mine[k]) { void restore(k); main.replaceChildren(t('p', 'lt-wait', 'Đang tải…')); return; }
  const box = t('div', 'tl-slide'); box.dataset.k = k;
  box.append(t('span', 'lt-idx', `Câu ${Number(pub.i) + 1}/${pub.n}`), t('p', 'lt-q tl-q', String(s.text || '')));
  if (s.type === 'qa') watchQa(k);
  if (pub.phase === 'closed' && s.type !== 'qa') { box.append(t('p', 'tl-note', 'Thầy cô đã dừng nhận ý kiến cho câu này. Nhìn lên màn chiếu nhé.')); main.replaceChildren(box); return; }
  const sent = mine[k], max = Number(s.max) || 1;
  if (s.type === 'cloud' || s.type === 'open' || s.type === 'qa') {
    if (sent.length) { const ul = t('ul', 'tl-mine'); ul.setAttribute('aria-label', 'Ý em đã gửi'); for (const v of sent) ul.append(t('li', '', v)); box.append(t('p', 'tl-ok', s.type === 'qa' ? 'Câu hỏi em đã gửi:' : 'Em đã gửi:'), ul); }
    if (pub.phase === 'open' && sent.length < (s.type === 'open' ? 1 : max)) box.append(textForm(s, k, sent.length));
    else if (s.type !== 'qa') box.append(t('p', 'lt-wait', s.mod && s.type === 'open' ? 'Cảm ơn em! Thầy cô duyệt rồi mới hiện lên màn chiếu.' : 'Cảm ơn em! Nhìn lên màn chiếu nhé.'));
    if (s.type === 'qa') box.append(qaList(k, pub.phase === 'open'));
  } else if (s.type === 'poll') {
    if (sent.length) box.append(t('p', 'tl-ok', `Em đã chọn: ${(s.opts || [])[Number(sent[0])] || ''}`), t('p', 'lt-wait', 'Cảm ơn em! Nhìn lên màn chiếu nhé.'));
    else box.append(pollForm(s, k));
  } else if (s.type === 'scale') {
    if (sent.length) box.append(t('p', 'tl-ok', 'Em đã chấm điểm. Cảm ơn em!'));
    else box.append(scaleForm(s, k));
  }
  main.replaceChildren(box);
}

/** @param {string} k @param {number} n @param {string} v @param {HTMLElement} err @param {HTMLButtonElement} btn */
async function send(k, n, v, err, btn) {
  if (!me || !playing || pub?.phase !== 'open' || pub?.slide?.k !== k) { err.textContent = 'Thầy cô đã dừng nhận ý kiến.'; return false; }
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); const label = btn.textContent; btn.textContent = 'Đang gửi…';
  try { await store.put(`tl/${playing}/y/${k}/${me.key}/${n}`, { v, t: store.SERVER_TIME }); (mine[k] ||= []).push(v); fx.sfx.join(); lastKey = ''; draw(); return true; }
  catch { err.textContent = 'Chưa gửi được (thầy cô đã dừng nhận hoặc mạng chậm). Thử lại.'; return false; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
}
/** Ô nhập từ khóa / ý kiến / câu hỏi: hiện ĐỦ số ô còn được gửi (câu cho 3 từ khóa → 3 ô), gửi một lần. @param {any} s @param {string} k @param {number} n số ý đã gửi */
function textForm(s, k, n) {
  const f = t('form', 'tl-form'); f.noValidate = true;
  const lim = MAX_LEN[s.type] || 200, multi = s.type !== 'cloud', total = s.type === 'open' ? 1 : Math.max(1, Number(s.max) || 1), left = Math.max(1, total - n);
  /** @type {(HTMLInputElement|HTMLTextAreaElement)[]} */ const inputs = [];
  const errs = [];
  for (let j = 0; j < left; j++) {
    const idx = n + j + 1, id = `tl-in-${k}-${idx}`;
    const wrap = t('div', 'tl-field');
    const lab = /** @type {HTMLLabelElement} */ (t('label', 'tl-label', s.type === 'cloud' ? `Từ khóa ${idx}${total > 1 ? `/${total}` : ''}` : s.type === 'qa' ? `Câu hỏi ${idx}${total > 1 ? `/${total}` : ''}` : 'Ý kiến của em')); lab.htmlFor = id;
    const inp = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (t(multi ? 'textarea' : 'input', 'tl-input')); inp.id = id; inp.maxLength = lim; inp.setAttribute('aria-describedby', id + '-err');
    if (multi) /** @type {HTMLTextAreaElement} */ (inp).rows = 2; else { inp.setAttribute('autocomplete', 'off'); inp.setAttribute('enterkeyhint', j === left - 1 ? 'send' : 'next'); }
    inp.placeholder = s.type === 'cloud' ? 'Một từ hoặc cụm từ ngắn' : '';
    const err = t('p', 'tl-err', ''); err.id = id + '-err';
    inp.addEventListener('input', () => { err.textContent = ''; inp.removeAttribute('aria-invalid'); });
    wrap.append(lab, inp, err); f.append(wrap); inputs.push(inp); errs.push(err);
  }
  const hint = t('p', 'tl-hint', s.type === 'cloud' ? `Mỗi ô tối đa ${lim} ký tự. Không bắt buộc điền hết các ô.` : `Tối đa ${lim} ký tự.`);
  const status = t('p', 'tl-err', ''); status.setAttribute('role', 'alert');
  const btn = /** @type {HTMLButtonElement} */ (t('button', 'primary tl-send', s.type === 'qa' ? 'Gửi câu hỏi' : 'Gửi')); btn.type = 'submit';
  f.addEventListener('submit', async ev => {
    ev.preventDefault(); status.textContent = '';
    /** @type {string[]} */ const vals = []; let bad = -1;
    inputs.forEach((inp, j) => {
      const v = inp.value.replace(/\s+/g, ' ').trim(); if (!v) return;
      const why = v.length > lim ? `Tối đa ${lim} ký tự.` : badWord(v, pub?.cam || []) ? 'Có từ ngữ không phù hợp. Em sửa lại nhé.' : '';
      if (why) { errs[j].textContent = why; inp.setAttribute('aria-invalid', 'true'); if (bad < 0) bad = j; } else vals.push(v);
    });
    if (bad >= 0) { inputs[bad].focus(); return; }
    const uniq = [...new Map(vals.map(v => [v.toLowerCase(), v])).values()];
    if (!uniq.length) { errs[0].textContent = s.type === 'cloud' ? 'Nhập ít nhất một từ khóa.' : 'Nhập nội dung trước khi gửi.'; inputs[0].setAttribute('aria-invalid', 'true'); inputs[0].focus(); return; }
    await sendMany(k, n, uniq, status, btn);
  });
  f.append(hint, status, btn); return f;
}
/** Gửi nhiều ý một lượt (mỗi ý một ô trên máy chủ: …/y/{câu}/{mã}/{số}). @param {string} k @param {number} n @param {string[]} vals @param {HTMLElement} err @param {HTMLButtonElement} btn */
async function sendMany(k, n, vals, err, btn) {
  if (!me || !playing || pub?.phase !== 'open' || pub?.slide?.k !== k) { err.textContent = 'Thầy cô đã dừng nhận ý kiến.'; return; }
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); const label = btn.textContent; btn.textContent = 'Đang gửi…';
  let sent = 0;
  try { for (const [j, v] of vals.entries()) { await store.put(`tl/${playing}/y/${k}/${me.key}/${n + j}`, { v, t: store.SERVER_TIME }); (mine[k] ||= []).push(v); sent++; } fx.sfx.join(); }
  catch { err.textContent = sent ? `Đã gửi ${sent} ý; ý còn lại chưa gửi được (thầy cô đã dừng nhận hoặc mạng chậm).` : 'Chưa gửi được (thầy cô đã dừng nhận hoặc mạng chậm). Thử lại.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
  if (sent) { lastKey = ''; draw(); }
}
/** @param {any} s @param {string} k */
function pollForm(s, k) {
  const f = t('form', 'tl-form'); f.noValidate = true;
  const fs = t('fieldset', 'tl-poll'); fs.append(t('legend', 'vh', 'Chọn một ý'));
  (s.opts || []).forEach((/** @type {string} */ o, /** @type {number} */ i) => { const lab = t('label', 'tl-choice'); const r = /** @type {HTMLInputElement} */ (t('input', '')); r.type = 'radio'; r.name = 'tl-poll-' + k; r.value = String(i); lab.append(r, t('span', '', o)); fs.append(lab); });
  const err = t('p', 'tl-err', ''); err.setAttribute('role', 'alert');
  const btn = /** @type {HTMLButtonElement} */ (t('button', 'primary tl-send', 'Gửi bình chọn')); btn.type = 'submit';
  f.addEventListener('change', () => { err.textContent = ''; });
  f.addEventListener('submit', ev => { ev.preventDefault(); const c = /** @type {HTMLInputElement|null} */ (f.querySelector('input:checked')); if (!c) { err.textContent = 'Chọn một ý trước khi gửi.'; return; } void send(k, 0, c.value, err, btn); });
  f.append(fs, err, btn); return f;
}
/** @param {any} s @param {string} k */
function scaleForm(s, k) {
  const f = t('form', 'tl-form'); f.noValidate = true;
  (s.items || []).forEach((/** @type {string} */ it, /** @type {number} */ i) => {
    const fs = t('fieldset', 'tl-scale'); fs.append(t('legend', '', it));
    const row = t('div', 'tl-scale-row');
    for (let x = 1; x <= 5; x++) { const lab = t('label', 'tl-dot'); const r = /** @type {HTMLInputElement} */ (t('input', '')); r.type = 'radio'; r.name = `tl-sc-${k}-${i}`; r.value = String(x); lab.append(r, t('span', '', String(x))); row.append(lab); }
    fs.append(row, t('p', 'tl-scale-ends', '1 = rất thấp · 5 = rất cao')); f.append(fs);
  });
  const err = t('p', 'tl-err', ''); err.setAttribute('role', 'alert');
  const btn = /** @type {HTMLButtonElement} */ (t('button', 'primary tl-send', 'Gửi điểm')); btn.type = 'submit';
  f.addEventListener('change', () => { err.textContent = ''; });
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const scores = (s.items || []).map((/** @type {string} */ _, /** @type {number} */ i) => Number(/** @type {HTMLInputElement|null} */ (f.querySelector(`input[name="tl-sc-${k}-${i}"]:checked`))?.value || 0));
    const v = scaleValue(scores); if (!v) { err.textContent = 'Chấm điểm đủ các tiêu chí.'; return; }
    void send(k, 0, v, err, btn);
  });
  f.append(err, btn); return f;
}
/** Danh sách câu hỏi các bạn (đã được duyệt), bấm "Cùng thắc mắc". @param {string} k @param {boolean} open */
function qaList(k, open) {
  const wrap = t('section', 'tl-qa'); wrap.append(t('h3', 'lt-sub', 'Câu hỏi của cả lớp'));
  const list = visible(entriesOf(qaY), pub?.an || {}).filter(e => (!pub?.slide?.mod || pub?.ok?.[e.id]) && !badWord(e.v, pub?.cam || []));
  const ranked = qaRank(list, qaVotes || {}, pub?.done || {});
  if (!ranked.length) { wrap.append(t('p', 'lt-wait', 'Chưa có câu hỏi nào hiện lên. Em đặt câu hỏi ở trên nhé.')); return wrap; }
  const ul = t('ul', 'tl-qa-list');
  for (const q of ranked) {
    const li = t('li', q.done ? 'is-done' : ''), mineVote = !!qaVotes?.[q.id]?.[me?.key || ''];
    const v = /** @type {HTMLButtonElement} */ (b(`▲ ${q.votes}`, 'tl-vote' + (mineVote ? ' is-on' : ''), async () => {
      if (!me || !open) return; v.disabled = true;
      await store.put(`tl/${playing}/vote/${k}/${q.id}/${me.key}`, mineVote ? null : true).catch(() => {}); v.disabled = false;
    }));
    v.setAttribute('aria-pressed', String(mineVote)); v.setAttribute('aria-label', `Cùng thắc mắc: ${q.v} (${q.votes} phiếu)`); v.disabled = !open || q.ma === me?.key;
    li.append(v, t('span', 'tl-qa-text', q.v), ...(q.done ? [t('small', 'tl-qa-done', 'Đã trả lời')] : []));
    ul.append(li);
  }
  wrap.append(ul); return wrap;
}
