// @ts-check
// Học sinh: Thảo luận trên lớp (kiểu Mentimeter). Thầy cô mở thảo luận → mục Luyện tập hiện thẻ "Thảo luận đang mở" →
// Vào phòng → mỗi trang em gửi từ khóa / ý kiến / bình chọn / chấm điểm 1–5 / đặt câu hỏi. Màn chiếu hiện ẩn danh,
// thầy cô duyệt trước khi hiện. Từ ngữ không phù hợp bị chặn ngay trên máy em.
import * as store from './thi-store.js';
import * as fx from './quiz-fx.js';
import { MAX_LEN, badWord, entriesOf, qaRank, scaleValue, visible, isQa, isPoll, cotValue, rankValue, MAX_REASON } from './tl-core.js';
import { alive } from './live-room.js';

/** @type {{ma:string,ten:string,lop:string,key:string}|null} */ let me = null;
/** @type {null|(() => void)} */ let stopLop = null, stopInfo = null, stopQa = null, stopVote = null;
/** @type {(() => void)[]} */ let stops = [];
let room = '', playing = '', dismissed = '', probeTimer = 0, tick = 0, lastKey = '', readySeen = '';
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
  tick = window.setInterval(() => { banner(); onChange(); if (playing) draw(); }, 30000);   // phòng treo (giáo viên tắt máy chưa bấm Kết thúc): tự ẩn sau 5 phút
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
export function stop() { clearTimeout(probeTimer); clearInterval(tick); tick = 0; stopLop?.(); stopLop = null; stopInfo?.(); stopInfo = null; leave(); room = ''; info = null; me = null; banner(); onChange(); }
export const active = () => Boolean(room && info && alive(room, info));

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
  if (!pub || pub.phase === 'end' || playing !== room || !alive(playing, pub)) leave();
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

/** Vẽ lại màn thảo luận.
 * @param {boolean} [force] true = ngay sau khi CHÍNH EM gửi xong: luôn vẽ lại để hiện "Em đã gửi".
 *   Lỗi 30/10: em gõ xong bấm Enter (hoặc chạm nút Gửi trên iPhone/iPad – nút không nhận con trỏ) thì con trỏ vẫn nằm trong ô nhập,
 *   chặn "đang gõ dở" bỏ qua lần vẽ lại → màn không báo đã gửi, phải F5 mới thấy. */
function draw(force = false) {
  const o = document.getElementById('tl-play'); if (!o || o.hidden || !pub) return;
  /** @type {HTMLElement} */ (o.querySelector('.lt-top-title')).textContent = pub.title || 'Thảo luận';
  const main = /** @type {HTMLElement} */ (o.querySelector('.tl-main'));
  const s = pub.slide || {}, k = String(s.k || '');
  const dead = pub.phase !== 'end' && !alive(playing, pub);
  const key = JSON.stringify([pub.phase, k, mine[k]?.length ?? -1, isQa(s.type) ? [qaY, qaVotes, pub.ok, pub.an, pub.done] : 0, pub.lo ?? null, pub.kq ?? null, dead]);
  if (key === lastKey) return;
  if (dead) { lastKey = key; unwatchQa(); main.replaceChildren(t('span', 'lt-res-ic tl-end-ic', '✓'), t('h2', 'lt-big', 'Phòng thảo luận đã đóng'), t('p', 'lt-wait', 'Thầy cô đã rời phòng. Ý kiến em gửi đã được lưu.'), b('Đóng', 'primary lt-done', () => close())); return; }
  // đang gõ dở: không vẽ lại đè lên ô nhập (chỉ vẽ khi đổi trang / đổi trạng thái)
  const typing = document.activeElement && main.contains(document.activeElement) && /** @type {HTMLElement} */ (document.activeElement).matches('input,textarea') && /** @type {HTMLElement} */ (main.querySelector('[data-k]'))?.dataset.k === k && pub.phase === 'open';
  if (typing && !force && !isQa(s.type)) return;
  lastKey = key;
  // Hỏi đáp: danh sách câu hỏi đổi liên tục khi bạn khác gửi/bình chọn → giữ nguyên chữ em đang gõ dở và vị trí con trỏ khi vẽ lại.
  /** @type {Record<string,string>} */ const keep = {}; let focusId = '', selA = 0, selB = 0;
  if (!force) for (const el of /** @type {NodeListOf<HTMLInputElement|HTMLTextAreaElement>} */ (main.querySelectorAll(`.tl-slide[data-k="${CSS.escape(k)}"] .tl-input`))) {
    if (el.value) keep[el.id] = el.value;
    if (el === document.activeElement) { focusId = el.id; selA = el.selectionStart ?? el.value.length; selB = el.selectionEnd ?? selA; }
  }
  if (pub.phase !== 'open' && pub.phase !== 'closed' || !isQa(s.type)) unwatchQa();
  if (pub.phase === 'lobby') { main.replaceChildren(t('span', 'lt-avatar', String(me?.ten || '?').trim().split(/\s+/).slice(-1)[0].slice(0, 1).toUpperCase()), t('p', 'lt-name', me?.ten || ''), t('h2', 'lt-big', 'Em đã vào phòng thảo luận'), t('p', 'lt-wait', 'Ý kiến của em hiện ẩn danh trên màn chiếu. Chờ thầy cô bắt đầu.'), t('span', 'lt-pulse', '')); return; }
  if (pub.phase === 'ready') { main.replaceChildren(t('h2', 'lt-big', 'Chuẩn bị!')); if (readySeen !== String(pub.ready)) { readySeen = String(pub.ready); void fx.countdown(o, { title: String(pub.title || 'Chuẩn bị!') }); } return; }
  if (pub.phase === 'end') { main.replaceChildren(t('span', 'lt-res-ic tl-end-ic', '✓'), t('h2', 'lt-big', 'Buổi thảo luận kết thúc'), t('p', 'lt-wait', 'Cảm ơn em đã chia sẻ ý kiến!'), b('Đóng', 'primary lt-done', () => close())); return; }
  if (!k) return;
  if (!mine[k]) { void restore(k); main.replaceChildren(t('p', 'lt-wait', 'Đang tải…')); return; }
  const box = t('div', 'tl-slide'); box.dataset.k = k;
  box.append(t('span', 'lt-idx', `Câu ${Number(pub.i) + 1}/${pub.n}`), t('p', 'lt-q tl-q', String(s.text || '')));
  if (isQa(s.type)) watchQa(k);
  if (pub.phase === 'closed' && !isQa(s.type)) { box.append(t('p', 'tl-note', pub.kq?.k === k ? 'Thầy cô đã dừng nhận ý kiến cho câu này.' : 'Thầy cô đã dừng nhận ý kiến cho câu này. Nhìn lên màn chiếu nhé.')); if (pub.kq?.k === k) box.append(kqView(s, pub.kq)); main.replaceChildren(box); return; }
  const sent = mine[k], max = Number(s.max) || 1;
  if (s.type === 'cloud' || s.type === 'open' || isQa(s.type)) {
    if (sent.length) { const ul = t('ul', 'tl-mine'); ul.setAttribute('aria-label', 'Ý em đã gửi'); for (const v of sent) ul.append(t('li', '', v)); box.append(t('p', 'tl-ok', s.type === 'qa' ? 'Câu hỏi em đã gửi:' : s.type === 'tuong' ? 'Ý tưởng em đã gửi:' : 'Em đã gửi:'), ul); }
    if (pub.phase === 'open' && sent.length < (s.type === 'open' ? 1 : max)) box.append(textForm(s, k, sent.length));
    else if (!isQa(s.type)) box.append(t('p', 'lt-wait', s.mod && s.type === 'open' ? 'Cảm ơn em! Thầy cô duyệt rồi mới hiện lên màn chiếu.' : 'Cảm ơn em! Nhìn lên màn chiếu nhé.'));
    if (isQa(s.type)) box.append(qaList(k, pub.phase === 'open'));
  } else if (isPoll(s.type)) {
    if (sent.length) box.append(t('p', 'tl-ok', `Em đã chọn: ${(s.opts || [])[Number(sent[0])] || ''}`), t('p', 'lt-wait', 'Cảm ơn em! Nhìn lên màn chiếu nhé.'));
    else box.append(pollForm(s, k));
  } else if (s.type === 'scale') {
    if (sent.length) box.append(t('p', 'tl-ok', 'Em đã chấm điểm. Cảm ơn em!'));
    else box.append(scaleForm(s, k));
  } else if (s.type === 'cot') {
    if (sent.length) box.append(t('p', 'tl-ok', 'Em đã xếp xong. Nhìn lên màn chiếu xem cả lớp chọn thế nào nhé.'));
    else box.append(cotForm(s, k));
  } else if (s.type === 'tranh') {
    if (sent.length) { const m = /^([01])\|(.*)$/.exec(sent[0]) || []; box.append(t('p', 'tl-ok', `Em chọn: ${(s.opts || [])[Number(m[1])] || ''}`), t('p', 'tl-mine-ly', m[2] || ''), t('p', 'lt-wait', 'Cảm ơn em! Thầy cô có thể rút lí do của em để cả lớp bàn.')); }
    else box.append(tranhForm(s, k));
  } else if (s.type === 'loi') {
    if (sent.length) box.append(t('p', 'tl-ok', `Em đã chọn: "${(s.items || [])[Number(sent[0])] || ''}"`));
    else box.append(loiForm(s, k));
    if (pub.lo !== undefined && pub.lo !== null) box.append(t('p', 'tl-loi-dap', `Chỗ sai là: "${(s.items || [])[Number(pub.lo)] || ''}"${sent.length ? (Number(sent[0]) === Number(pub.lo) ? ' · Em đã tìm đúng!' : ' · Lần sau em đọc kĩ hơn nhé.') : ''}`));
  } else if (s.type === 'xh') {
    if (sent.length) box.append(t('p', 'tl-ok', 'Em đã xếp hạng. Nhìn lên màn chiếu xem thứ tự chung của lớp nhé.'));
    else box.append(xhForm(s, k));
  }
  if (pub.kq?.k === k) box.append(kqView(s, pub.kq));
  main.replaceChildren(box);
  for (const [id, v] of Object.entries(keep)) { const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id)); if (el && main.contains(el)) el.value = v; }
  if (focusId) { const el = /** @type {HTMLInputElement|null} */ (document.getElementById(focusId)); if (el && main.contains(el)) { el.focus(); try { el.setSelectionRange(selA, selB); } catch { /* bỏ qua */ } } }
}

/** @param {string} k @param {number} n @param {string} v @param {HTMLElement} err @param {HTMLButtonElement} btn */
async function send(k, n, v, err, btn) {
  if (!me || !playing || pub?.phase !== 'open' || pub?.slide?.k !== k) { err.textContent = 'Thầy cô đã dừng nhận ý kiến.'; return false; }
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); const label = btn.textContent; btn.textContent = 'Đang gửi…';
  try { await store.put(`tl/${playing}/y/${k}/${me.key}/${n}`, { v, t: store.SERVER_TIME }); (mine[k] ||= []).push(v); fx.sfx.join(); lastKey = ''; draw(true); return true; }
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
    const lab = /** @type {HTMLLabelElement} */ (t('label', 'tl-label', s.type === 'cloud' ? `Từ khóa ${idx}${total > 1 ? `/${total}` : ''}` : s.type === 'qa' ? `Câu hỏi ${idx}${total > 1 ? `/${total}` : ''}` : s.type === 'tuong' ? `Ý tưởng ${idx}${total > 1 ? `/${total}` : ''}` : 'Ý kiến của em')); lab.htmlFor = id;
    const inp = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (t(multi ? 'textarea' : 'input', 'tl-input')); inp.id = id; inp.maxLength = lim; inp.setAttribute('aria-describedby', id + '-err');
    if (multi) /** @type {HTMLTextAreaElement} */ (inp).rows = 2; else { inp.setAttribute('autocomplete', 'off'); inp.setAttribute('enterkeyhint', j === left - 1 ? 'send' : 'next'); }
    inp.placeholder = s.type === 'cloud' ? 'Một từ hoặc cụm từ ngắn' : '';
    const err = t('p', 'tl-err', ''); err.id = id + '-err';
    inp.addEventListener('input', () => { err.textContent = ''; inp.removeAttribute('aria-invalid'); });
    wrap.append(lab, inp, err); f.append(wrap); inputs.push(inp); errs.push(err);
  }
  const hint = t('p', 'tl-hint', s.type === 'cloud' ? `Mỗi ô tối đa ${lim} ký tự. Không bắt buộc điền hết các ô.` : `Tối đa ${lim} ký tự.`);
  const status = t('p', 'tl-err', ''); status.setAttribute('role', 'alert');
  const btn = /** @type {HTMLButtonElement} */ (t('button', 'primary tl-send', s.type === 'qa' ? 'Gửi câu hỏi' : s.type === 'tuong' ? 'Gửi ý tưởng' : 'Gửi')); btn.type = 'submit';
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
  if (sent) { lastKey = ''; draw(true); }
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
/**
 * Kết quả cả lớp do thầy cô công bố (ẩn danh): vẽ gọn trên điện thoại, cùng nội dung với màn chiếu.
 * @param {any} s trang hiện tại @param {any} r pub.kq
 */
function kqView(s, r) {
  const sec = t('section', 'tl-kq'); sec.setAttribute('aria-label', 'Kết quả cả lớp');
  sec.append(t('h3', 'tl-kq-h', 'Kết quả cả lớp'), t('p', 'tl-kq-n', `${r.people || 0} em đã gửi`));
  /** @param {string[]} labels @param {number[]} c @param {number} [mark] */
  const bars = (labels, c, mark = -1) => {
    const tot = (c || []).reduce((a, b) => a + b, 0), max = Math.max(1, ...(c || [0])), ul = t('ul', 'tl-kq-bars');
    labels.forEach((o, j) => {
      const n = (c || [])[j] || 0, li = t('li', 'tl-kq-bar' + (j === mark ? ' is-dap' : ''));
      const fill = t('span', 'tl-kq-fill'); fill.style.setProperty('--w', Math.round(100 * n / max) + '%');
      li.append(fill, t('span', 'tl-kq-label', (j === mark ? '✓ ' : '') + o), t('strong', 'tl-kq-num', `${n} · ${tot ? Math.round(100 * n / tot) : 0}%`)); ul.append(li);
    });
    return ul;
  };
  if (s.type === 'poll') sec.append(bars(s.opts || [], r.counts));
  else if (s.type === 'lai') { sec.append(t('h4', 'tl-kq-sub', 'Trước'), bars(s.opts || [], r.before || []), t('h4', 'tl-kq-sub', 'Bây giờ'), bars(s.opts || [], r.counts)); }
  else if (s.type === 'loi') { sec.append(bars(s.items || [], r.counts, r.lo ?? -1)); if (r.lo !== undefined && r.lo !== null) sec.append(t('p', 'tl-loi-dap', `Chỗ sai: "${(s.items || [])[Number(r.lo)] || ''}"`)); }
  else if (s.type === 'tranh') {
    sec.append(bars(s.opts || [], r.sides));
    if (r.pick) [0, 1].forEach(i => { if (r.pick[i]) sec.append(t('p', 'tl-kq-ly', `${(s.opts || [])[i]}: “${r.pick[i]}”`)); });
  } else if (s.type === 'cot') {
    const A = (s.opts || [])[0] || 'A', B = (s.opts || [])[1] || 'B';
    sec.append(t('p', 'tl-kq-n', `A · ${A}   |   B · ${B}`));
    const ul = t('ul', 'tl-kq-cot');
    (s.items || []).forEach((/** @type {string} */ it, /** @type {number} */ j) => {
      const c = (r.cot || [])[j] || { a: 0, b: 0 }, tot = c.a + c.b, pa = tot ? Math.round(100 * c.a / tot) : 0;
      const li = t('li', 'tl-kq-cot-row'); const bar = t('span', 'tl-kq-cot-bar'); bar.style.setProperty('--a', pa + '%'); bar.setAttribute('aria-hidden', 'true');
      li.append(t('span', 'tl-kq-label', it), bar, t('strong', 'tl-kq-num', `A ${c.a} · B ${c.b}`)); ul.append(li);
    });
    sec.append(ul);
  } else if (s.type === 'xh') {
    const ol = t('ol', 'tl-kq-xh'); for (const j of r.rank?.order || []) ol.append(t('li', '', (s.items || [])[j] || ''));
    sec.append(t('p', 'tl-kq-n', 'Thứ tự chung của lớp (trên cùng là quan trọng nhất)'), ol);
  } else if (s.type === 'scale') {
    const ul = t('ul', 'tl-kq-list'); (s.items || []).forEach((/** @type {string} */ it, /** @type {number} */ j) => ul.append(t('li', '', `${it}: ${String((r.avg || [])[j] || 0).replace('.', ',')}/5`))); sec.append(ul);
  } else if (s.type === 'cloud') {
    const ul = t('ul', 'tl-kq-cloud'); const max = Math.max(1, ...(r.cloud || []).map((/** @type {any} */ w) => w.n));
    for (const w of r.cloud || []) { const li = t('li', 'tl-kq-word tl-kq-w' + Math.min(4, Math.ceil(4 * w.n / max)), w.w); li.title = `${w.n} lần`; ul.append(li); }
    sec.append(ul);
  } else if (isQa(s.type)) {
    const ul = t('ul', 'tl-kq-list'); for (const q of r.qa || []) ul.append(t('li', q.done ? 'is-done' : '', `${s.type === 'tuong' ? '♥' : '▲'} ${q.votes} · ${q.v}`)); sec.append(ul);
  } else if (s.type === 'open') {
    const ul = t('ul', 'tl-kq-list'); for (const v of r.open || []) ul.append(t('li', '', v)); sec.append(ul);
  }
  return sec;
}
/** Nút gửi + chỗ báo lỗi dùng chung. @param {string} label */
function sendBar(label) { const err = t('p', 'tl-err', ''); err.setAttribute('role', 'alert'); const btn = /** @type {HTMLButtonElement} */ (t('button', 'primary tl-send', label)); btn.type = 'submit'; return { err, btn }; }
/** Xếp hai cột: mỗi dòng chọn A hoặc B. @param {any} s @param {string} k */
function cotForm(s, k) {
  const f = t('form', 'tl-form tl-cot-form'); f.noValidate = true;
  const A = (s.opts || [])[0] || 'A', B = (s.opts || [])[1] || 'B';
  f.append(t('p', 'tl-hint', `Mỗi dòng chọn: A · ${A} hoặc B · ${B}.`));
  (s.items || []).forEach((/** @type {string} */ it, /** @type {number} */ i) => {
    const fs = t('fieldset', 'tl-cot-row'); fs.append(t('legend', '', it));
    const row = t('div', 'tl-cot-pick');
    for (const [v, lab] of [['A', A], ['B', B]]) { const l = t('label', 'tl-choice tl-cot-opt'); const r = /** @type {HTMLInputElement} */ (t('input', '')); r.type = 'radio'; r.name = `tl-cot-${k}-${i}`; r.value = v; l.append(r, t('span', 'tl-cot-key', v), t('span', '', lab)); row.append(l); }
    fs.append(row); f.append(fs);
  });
  const { err, btn } = sendBar('Gửi');
  f.addEventListener('change', () => { err.textContent = ''; });
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const picks = (s.items || []).map((/** @type {string} */ _, /** @type {number} */ i) => /** @type {HTMLInputElement|null} */ (f.querySelector(`input[name="tl-cot-${k}-${i}"]:checked`))?.value || '');
    const miss = picks.findIndex((/** @type {string} */ x) => !x);
    if (miss >= 0) { err.textContent = `Em chưa chọn cột cho dòng ${miss + 1}.`; /** @type {HTMLInputElement|null} */ (f.querySelector(`input[name="tl-cot-${k}-${miss}"]`))?.focus(); return; }
    void send(k, 0, cotValue(/** @type {any} */ (picks)), err, btn);
  });
  f.append(err, btn); return f;
}
/** Tranh luận hai phía: chọn phía + một lí do. @param {any} s @param {string} k */
function tranhForm(s, k) {
  const f = t('form', 'tl-form'); f.noValidate = true;
  const fs = t('fieldset', 'tl-poll'); fs.append(t('legend', 'vh', 'Em chọn phía nào'));
  (s.opts || []).forEach((/** @type {string} */ o, /** @type {number} */ i) => { const lab = t('label', 'tl-choice'); const r = /** @type {HTMLInputElement} */ (t('input', '')); r.type = 'radio'; r.name = 'tl-tr-' + k; r.value = String(i); lab.append(r, t('span', '', o)); fs.append(lab); });
  const id = `tl-ly-${k}`; const lab = /** @type {HTMLLabelElement} */ (t('label', 'tl-label', 'Lí do của em')); lab.htmlFor = id;
  const ta = /** @type {HTMLTextAreaElement} */ (t('textarea', 'tl-input')); ta.id = id; ta.rows = 2; ta.maxLength = MAX_REASON; ta.setAttribute('aria-describedby', id + '-err');
  const fe = t('p', 'tl-err', ''); fe.id = id + '-err';
  const { err, btn } = sendBar('Gửi');
  f.addEventListener('input', () => { err.textContent = ''; fe.textContent = ''; ta.removeAttribute('aria-invalid'); });
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const c = /** @type {HTMLInputElement|null} */ (f.querySelector(`input[name="tl-tr-${k}"]:checked`));
    if (!c) { err.textContent = 'Chọn một phía trước khi gửi.'; return; }
    const v = ta.value.replace(/\s+/g, ' ').trim();
    if (!v) { fe.textContent = 'Ghi một lí do ngắn.'; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
    if (badWord(v, pub?.cam || [])) { fe.textContent = 'Có từ ngữ không phù hợp. Em sửa lại nhé.'; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
    void send(k, 0, `${c.value}|${v}`, err, btn);
  });
  f.append(fs, lab, ta, fe, t('p', 'tl-hint', `Tối đa ${MAX_REASON} ký tự.`), err, btn); return f;
}
/** Bắt lỗi: bấm vào cụm em cho là sai. @param {any} s @param {string} k */
function loiForm(s, k) {
  const f = t('form', 'tl-form'); f.noValidate = true;
  const fs = t('fieldset', 'tl-loi-pick'); fs.append(t('legend', '', 'Bấm vào cụm từ em cho là sai'));
  (s.items || []).forEach((/** @type {string} */ it, /** @type {number} */ i) => { const lab = t('label', 'tl-loi-opt'); const r = /** @type {HTMLInputElement} */ (t('input', '')); r.type = 'radio'; r.name = 'tl-loi-' + k; r.value = String(i); lab.append(r, t('span', '', it)); fs.append(lab); });
  const { err, btn } = sendBar('Gửi');
  f.addEventListener('change', () => { err.textContent = ''; });
  f.addEventListener('submit', ev => { ev.preventDefault(); const c = /** @type {HTMLInputElement|null} */ (f.querySelector('input:checked')); if (!c) { err.textContent = 'Bấm chọn một cụm từ trước khi gửi.'; return; } void send(k, 0, c.value, err, btn); });
  f.append(fs, err, btn); return f;
}
/** Xếp hạng: mỗi mục một thứ hạng, không trùng. @param {any} s @param {string} k */
function xhForm(s, k) {
  const f = t('form', 'tl-form'); f.noValidate = true; const n = (s.items || []).length;
  f.append(t('p', 'tl-hint', `Chọn thứ hạng cho từng mục: 1 là quan trọng nhất, ${n} là ít quan trọng nhất. Không chọn trùng hạng.`));
  /** @type {HTMLSelectElement[]} */ const sels = [];
  (s.items || []).forEach((/** @type {string} */ it, /** @type {number} */ i) => {
    const w = t('div', 'tl-field tl-xh-row'); const id = `tl-xh-${k}-${i}`;
    const lab = /** @type {HTMLLabelElement} */ (t('label', 'tl-label', it)); lab.htmlFor = id;
    const sel = /** @type {HTMLSelectElement} */ (t('select', 'tl-xh-sel')); sel.id = id; sel.append(new Option('Hạng…', ''));
    for (let x = 1; x <= n; x++) sel.append(new Option(`Hạng ${x}`, String(x)));
    w.append(lab, sel); f.append(w); sels.push(sel);
  });
  const { err, btn } = sendBar('Gửi xếp hạng');
  f.addEventListener('change', () => { err.textContent = ''; });
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const ranks = sels.map(x => Number(x.value) || 0);
    const miss = ranks.findIndex(x => !x); if (miss >= 0) { err.textContent = `Chọn hạng cho "${(s.items || [])[miss]}".`; sels[miss].focus(); return; }
    const v = rankValue(ranks); if (!v) { err.textContent = 'Hai mục đang trùng hạng. Mỗi hạng chỉ dùng một lần.'; return; }
    void send(k, 0, v, err, btn);
  });
  f.append(err, btn); return f;
}
/** Danh sách câu hỏi các bạn (đã được duyệt), bấm "Cùng thắc mắc". @param {string} k @param {boolean} open */
function qaList(k, open) {
  const wallT = pub?.slide?.type === 'tuong';
  const wrap = t('section', 'tl-qa'); wrap.append(t('h3', 'lt-sub', wallT ? 'Ý tưởng của cả lớp' : 'Câu hỏi của cả lớp'));
  const list = visible(entriesOf(qaY), pub?.an || {}).filter(e => (!pub?.slide?.mod || pub?.ok?.[e.id]) && !badWord(e.v, pub?.cam || []));
  const ranked = qaRank(list, qaVotes || {}, pub?.done || {});
  if (!ranked.length) { wrap.append(t('p', 'lt-wait', wallT ? 'Chưa có ý tưởng nào hiện lên. Em gửi ý tưởng ở trên nhé.' : 'Chưa có câu hỏi nào hiện lên. Em đặt câu hỏi ở trên nhé.')); return wrap; }
  const ul = t('ul', 'tl-qa-list');
  for (const q of ranked) {
    const li = t('li', q.done ? 'is-done' : ''), mineVote = !!qaVotes?.[q.id]?.[me?.key || ''];
    const v = /** @type {HTMLButtonElement} */ (b(`${wallT ? '♥' : '▲'} ${q.votes}`, 'tl-vote' + (mineVote ? ' is-on' : ''), async () => {
      if (!me || !open) return; v.disabled = true;
      await store.put(`tl/${playing}/vote/${k}/${q.id}/${me.key}`, mineVote ? null : true).catch(() => {}); v.disabled = false;
    }));
    v.setAttribute('aria-pressed', String(mineVote)); v.setAttribute('aria-label', `${wallT ? 'Thích ý tưởng' : 'Cùng thắc mắc'}: ${q.v} (${q.votes} ${wallT ? 'tim' : 'phiếu'})`); v.disabled = !open || q.ma === me?.key;
    li.append(v, t('span', 'tl-qa-text', q.v), ...(q.done ? [t('small', 'tl-qa-done', 'Đã trả lời')] : []));
    ul.append(li);
  }
  wrap.append(ul); return wrap;
}
