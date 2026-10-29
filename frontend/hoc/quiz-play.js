// @ts-check
// Học sinh: mục Luyện tập = các buổi luyện tập thầy cô đang mở cho lớp em (kiểu Kahoot / Quizizz, chạy trên Firebase).
// Thầy cô mở phòng → mục Luyện tập hiện thẻ "Vào phòng" (và thông báo nhỏ ở các mục khác) → phòng chờ → thầy cô bắt đầu →
// mỗi câu em chọn đáp án trên điện thoại → xem đúng/sai, điểm, hạng → kết thúc: hạng, danh hiệu, bục vinh danh.
// Em không thấy đáp án trước (chỉ máy giáo viên giữ đáp án đến lúc công bố).
import * as store from './thi-store.js';
import * as fx from './quiz-fx.js';
fx.setDefault(false);   // điện thoại học sinh mặc định im lặng; em tự bật âm thanh nếu muốn

const L = ['A', 'B', 'C', 'D'];
const SHAPE = /** @type {Record<string,string>} */ ({ A: '▲', B: '◆', C: '●', D: '■' });
/** @type {{ma:string,ten:string,lop:string}|null} */ let me = null;
/** @type {null|(() => void)} */ let stopLop = null, stopInfo = null;
/** @type {(() => void)[]} */ let stops = [];
let room = '', playing = '', dismissed = '';
/** @type {any} */ let info = null, pub = null, mine = null;
let players = 0;
/** @type {Record<string,string>} */ let chosen = {};
let timer = 0, lastKey = '', qSeen = '', qEnd = 0, readySeen = '', fxSeen = '';
/** @type {() => void} */ let onChange = () => {};

/** App gọi để vẽ lại mục Luyện tập khi có / hết buổi luyện tập. @param {() => void} fn */
export function setOnChange(fn) { onChange = fn; }
/** Sau khi đăng nhập: nghe buổi luyện tập của lớp em. @param {{uid:string,student_name:string,class_code:string}} identity */
export function start(identity) {
  if (!store.enabled()) return;
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code };
  if (me && me.ma === next.ma && stopLop) return;
  stop(); me = next;
  void probe();
}
/** Thử đọc một lần trước khi nghe liên tục (luật Firebase chưa có nhánh này thì thử lại sau 10 phút, không báo lỗi liên tục). */
let probeTimer = 0;
async function probe() {
  if (!me || stopLop) return;
  const path = `quiz_lop/${store.keyOf(me.lop)}`;
  try { await store.get(path); } catch { clearTimeout(probeTimer); probeTimer = window.setTimeout(() => void probe(), 600000); return; }
  if (!me || stopLop) return;
  stopLop = store.listen(path, d => {
    const code = typeof d === 'string' && /^\d{6}$/.test(d) ? d : '';
    if (code === room) return;
    room = code; info = null; stopInfo?.(); stopInfo = null;
    if (room) stopInfo = store.listen(`quiz/${room}/pub`, p => { info = p; banner(); onChange(); if (playing === room) { pub = p; draw(); } }, undefined, { prio: 3 });
    banner(); onChange();
  });
}
/** Đăng xuất. */
export function stop() { clearTimeout(probeTimer); stopLop?.(); stopLop = null; stopInfo?.(); stopInfo = null; leaveRoom(); room = ''; info = null; me = null; banner(); onChange(); }
/** Đang có buổi luyện tập cho lớp em không. */
export const active = () => Boolean(room && info && info.phase !== 'end');

function t(/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
function b(/** @type {string} */ text, /** @type {string} */ cls, /** @type {() => void} */ fn) { const x = /** @type {HTMLButtonElement} */ (t('button', cls, text)); x.type = 'button'; x.addEventListener('click', fn); return x; }

/** Vẽ mục Luyện tập. @param {HTMLElement} target */
export function renderPanel(target, otherActive = false) {
  target.replaceChildren();
  if (!me) return;
  if (!active()) {
    if (otherActive) return;   // đang có buổi thảo luận: không hiện thẻ "chưa có"

    const card = t('div', 'lt-empty');
    card.append(t('span', 'lt-empty-ic', '◆'), t('h2', '', 'Chưa có buổi luyện tập hay thảo luận'), t('p', '', 'Khi thầy cô mở luyện tập hoặc thảo luận trên lớp, buổi đó hiện ở đây. Em bấm Vào phòng để tham gia.'));
    target.append(card); return;
  }
  const card = t('article', 'lt-card');
  const head = t('div', 'lt-card-head'); head.append(t('span', 'lt-live', info.phase === 'lobby' ? 'Đang mở phòng' : 'Đang diễn ra'), t('span', 'lt-code', 'Mã phòng ' + room.replace(/(\d{3})(\d{3})/, '$1 $2')));
  const meta = t('p', 'lt-meta', `${Number(info.n) || 0} câu · ${Number(info.lim) || 20} giây/câu`);
  card.append(head, t('h2', 'lt-title', String(info.title || 'Luyện tập')), meta, b(playing === room ? 'Quay lại phòng' : 'Vào phòng', 'primary lt-join', () => void join()));
  target.append(card);
}

function banner() {
  let bn = document.getElementById('lt-banner');
  const inPractice = !document.getElementById('practice-view')?.hidden;
  const show = active() && !!me && dismissed !== room && playing !== room && !inPractice;
  if (!show) { if (bn) bn.hidden = true; return; }
  if (!bn) {
    bn = t('div', 'lt-banner'); bn.id = 'lt-banner'; bn.setAttribute('role', 'status');
    const mid = t('div', 'lt-banner-mid'); mid.append(t('strong', 'lt-banner-title', ''), t('span', '', 'Thầy cô đang mở luyện tập trên lớp.'));
    bn.append(t('span', 'lt-banner-dot', ''), mid, b('Vào phòng', 'primary lt-banner-join', () => void join()), b('×', 'lt-banner-x', () => { dismissed = room; banner(); }));
    /** @type {HTMLElement} */ (bn.querySelector('.lt-banner-x')).setAttribute('aria-label', 'Ẩn thông báo luyện tập');
    document.body.append(bn);
  }
  /** @type {HTMLElement} */ (bn.querySelector('.lt-banner-title')).textContent = String(info?.title || 'Luyện tập');
  bn.hidden = false;
}
/** Gọi khi đổi mục trong app (ẩn thông báo khi đang ở mục Luyện tập). */
export function refreshBanner() { banner(); }

function overlay() {
  let o = document.getElementById('lt-play');
  if (!o) {
    o = t('div', 'lt-play'); o.id = 'lt-play'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Luyện tập');
    const header = t('header', 'lt-top');
    const score = t('span', 'lt-score'); score.setAttribute('aria-live', 'polite');
    header.append(t('strong', 'lt-top-title'), score, fx.soundToggle('lt-sound'), b('×', 'lt-close', () => closeOverlay()));
    /** @type {HTMLElement} */ (header.querySelector('.lt-close')).setAttribute('aria-label', 'Thoát màn hình luyện tập');
    const main = t('main', 'lt-main'); main.setAttribute('aria-live', 'polite');
    o.append(header, main);
    document.body.append(o);
  }
  return o;
}
function closeOverlay() {
  if (!pub || pub.phase === 'end' || playing !== room) leaveRoom();
  else { const o = document.getElementById('lt-play'); if (o) o.hidden = true; document.body.classList.remove('lt-playing'); }
  banner(); onChange();
}
async function join() {
  if (!me || !room) return;
  if (playing && playing !== room) leaveRoom();
  const o = overlay(); o.hidden = false; document.body.classList.add('lt-playing'); banner();
  if (playing === room) { lastKey = ''; draw(); return; }
  playing = room;
  /** @type {HTMLElement} */ (o.querySelector('.lt-main')).replaceChildren(t('p', 'lt-wait', 'Đang vào phòng…'));
  await store.put(`quiz/${playing}/ds/${store.keyOf(me.ma)}`, { ten: me.ten, at: store.SERVER_TIME }).catch(() => { /* đã vào trước đó */ });
  stops.forEach(f => f()); stops = [];
  pub = info;
  stops.push(store.listen(`quiz/${playing}/pub`, d => { pub = d; draw(); }, undefined, { prio: 3 }));
  stops.push(store.listen(`quiz/${playing}/ds`, d => { players = Object.keys(d || {}).length; if (pub?.phase === 'lobby') { lastKey = ''; draw(); } }, undefined, { prio: 1 }));
  stops.push(store.listen(`quiz/${playing}/kq/${store.keyOf(me.ma)}`, d => { mine = d; drawScore(); if (pub?.phase === 'reveal' || pub?.phase === 'end') { lastKey = ''; draw(); } }, undefined, { prio: 2 }));
  onChange();
  /** @type {HTMLElement} */ (o.querySelector('.lt-close')).focus();
}
function leaveRoom() { playing = ''; stops.forEach(f => f()); stops = []; clearInterval(timer); pub = null; mine = null; chosen = {}; lastKey = ''; qSeen = ''; readySeen = ''; fxSeen = ''; const o = document.getElementById('lt-play'); if (o) o.hidden = true; document.body.classList.remove('lt-playing'); }
function drawScore() { const s = document.querySelector('#lt-play .lt-score'); if (s) s.textContent = mine ? `${mine.p} điểm · hạng ${mine.r}/${mine.n}` : ''; }
const initials = (/** @type {string} */ s) => String(s || '?').trim().split(/\s+/).slice(-1)[0].slice(0, 1).toUpperCase();

function draw() {
  const o = document.getElementById('lt-play'); if (!o || o.hidden || !pub) return;
  /** @type {HTMLElement} */ (o.querySelector('.lt-top-title')).textContent = pub.title || 'Luyện tập';
  drawScore();
  const main = /** @type {HTMLElement} */ (o.querySelector('.lt-main'));
  const k = pub.q?.k || pub.reveal?.k || '';
  const key = `${pub.phase}|${k}|${chosen[k] || ''}|${mine?.p ?? ''}|${pub.phase === 'lobby' ? players : ''}|${pub.q?.at || ''}`;
  if (key === lastKey) return; lastKey = key;
  clearInterval(timer);
  if (pub.phase === 'lobby') {
    const av = t('span', 'lt-avatar', initials(me?.ten || ''));
    main.replaceChildren(av, t('p', 'lt-name', me?.ten || ''), t('h2', 'lt-big', 'Em đã vào phòng'), t('p', 'lt-wait', 'Nhìn lên màn chiếu, chờ thầy cô bắt đầu.'), t('p', 'lt-count', players ? `${players} bạn đã vào phòng` : ''), t('span', 'lt-pulse', ''));
    return;
  }
  if (pub.phase === 'ready') {
    main.replaceChildren(t('h2', 'lt-big', 'Chuẩn bị!'), t('p', 'lt-wait', 'Câu hỏi đầu tiên sắp hiện.'));
    if (readySeen !== String(pub.ready)) { readySeen = String(pub.ready); void fx.countdown(o, { title: String(pub.title || 'Chuẩn bị!') }); }
    return;
  }
  if (pub.phase === 'intro' && pub.q) {
    const q = pub.q, bar = t('span', 'lt-intro-bar'); bar.style.setProperty('--ms', (Number(q.read) || 3000) + 'ms'); bar.setAttribute('aria-hidden', 'true');
    main.replaceChildren(t('span', 'lt-idx lt-intro-n', `Câu ${Number(q.i) + 1}/${pub.n}`), t('p', 'lt-q lt-intro-q', q.text || ''), bar, t('p', 'lt-wait', 'Đọc kỹ câu hỏi. Các phương án sắp hiện.'));
    return;
  }
  if (pub.phase === 'pause') {
    main.replaceChildren(t('span', 'lt-pause-ic', 'II'), t('h2', 'lt-big', 'Tạm dừng'), t('p', 'lt-wait', 'Thầy cô đang tạm dừng. Chờ tiếp tục nhé.'));
    return;
  }
  if (pub.phase === 'q' && pub.q) {
    const q = pub.q, my = chosen[q.k];
    const stamp = `${q.k}|${q.at}`;
    if (qSeen !== stamp) { qSeen = stamp; qEnd = Date.now() + (Number(q.left) || Number(q.lim || 20) * 1000); }   // câu mới hoặc vừa tiếp tục sau tạm dừng
    const head = t('div', 'lt-head');
    const tm = t('span', 'lt-timer', String(Math.ceil(Math.max(0, qEnd - Date.now()) / 1000))); tm.setAttribute('role', 'timer'); tm.setAttribute('aria-label', 'Thời gian còn lại');
    head.append(t('span', 'lt-idx', `Câu ${Number(q.i) + 1}/${pub.n}`), tm);
    const grid = t('div', 'lt-opts');
    for (const x of L) if (q.opts?.[x]) {
      const bt = /** @type {HTMLButtonElement} */ (t('button', `lt-opt lt-${x}${my === x ? ' is-chosen' : ''}`)); bt.type = 'button'; bt.disabled = !!my;
      bt.append(t('b', '', SHAPE[x]), t('span', '', q.opts[x])); bt.setAttribute('aria-label', `Phương án ${x}: ${q.opts[x]}`);
      bt.addEventListener('click', () => void answer(q.k, x)); grid.append(bt);
    }
    const hint = my ? `Em đã chọn ${SHAPE[my]} ${my}. Chờ thầy cô công bố đáp án…` : 'Chọn một đáp án. Trả lời đúng và nhanh được nhiều điểm hơn.';
    main.replaceChildren(head, t('p', 'lt-q', q.text || ''), grid, t('p', 'lt-wait', hint));
    timer = window.setInterval(() => {
      const left = Math.max(0, qEnd - Date.now()); tm.textContent = String(Math.ceil(left / 1000)); tm.style.setProperty('--p', String(left / (Number(q.lim || 20) * 1000)));
      if (left <= 0) { clearInterval(timer); grid.querySelectorAll('button').forEach(x => { /** @type {HTMLButtonElement} */ (x).disabled = true; }); if (!chosen[q.k]) { const w = main.querySelector('.lt-wait'); if (w) w.textContent = 'Hết giờ.'; } }
    }, 200);
    return;
  }
  if (pub.phase === 'reveal' && pub.reveal) {
    const r = pub.reveal, my = chosen[r.k], ok = !!my && my === r.ans;
    if (fxSeen !== 'r' + r.k) { fxSeen = 'r' + r.k; if (my) (ok ? fx.sfx.correct : fx.sfx.wrong)(); }
    const box = t('div', 'lt-result ' + (ok ? 'is-ok' : my ? 'is-bad' : 'is-none'));
    box.append(t('span', 'lt-res-ic', ok ? '✓' : my ? '✕' : '–'), t('strong', '', ok ? 'Chính xác!' : my ? 'Chưa đúng' : 'Em chưa trả lời'));
    if (ok && mine?.last) box.append(t('span', 'lt-gain', `+${mine.last} điểm`));
    if (!ok) box.append(t('span', 'lt-res-ans', `Đáp án đúng: ${SHAPE[r.ans] || ''} ${r.ans}`));
    if (ok && mine?.streak >= 2) box.append(t('span', 'lt-streak', `Chuỗi đúng ${mine.streak} câu`));
    if (mine) box.append(t('span', 'lt-res-rank', `Em đang hạng ${mine.r}/${mine.n} · ${mine.p} điểm`));
    const top = t('ol', 'lt-top5'); top.setAttribute('aria-label', 'Năm bạn dẫn đầu');
    Object.values(pub.top || {}).forEach((x, i) => { const li = t('li', i === 0 ? 'is-first' : ''); li.append(t('b', '', String(i + 1)), t('span', '', x.ten), t('strong', '', String(x.p))); top.append(li); });
    main.replaceChildren(box, t('h3', 'lt-sub', 'Bảng xếp hạng'), top, t('p', 'lt-wait', 'Nhìn lên màn chiếu, chờ câu tiếp theo…'));
    return;
  }
  if (pub.phase === 'end') {
    const r = Number(mine?.r) || 0, n = Number(mine?.n) || 0, total = Number(pub.so_cau) || Number(pub.n) || 0;
    const box = t('div', 'lt-result is-end' + (r && r <= 3 ? ' is-top lt-top-' + r : ''));
    box.append(t('span', 'lt-medal', r ? String(r) : '★'), t('strong', '', r ? (r === 1 ? 'Quán quân!' : r <= 3 ? `Hạng ${r}. Xuất sắc!` : `Hạng ${r}/${n}`) : 'Buổi luyện tập kết thúc'));
    if (mine) box.append(t('span', 'lt-res-rank', `${mine.p} điểm · đúng ${mine.c}/${total} câu`));
    const kids = [box];
    const giai = Array.isArray(mine?.giai) ? mine.giai : Object.values(mine?.giai || {});
    if (giai.length) { const ul = t('ul', 'lt-awards'); for (const g of giai) ul.append(t('li', '', String(g))); kids.push(t('h3', 'lt-sub', 'Danh hiệu của em'), ul); }
    const pod = Object.values(pub.podium || {});
    if (pod.length) {
      const ol = t('ol', 'lt-stage'); ol.setAttribute('aria-label', 'Bục vinh danh');
      for (const place of [2, 1, 3]) { const p = pod[place - 1]; if (!p) continue; const li = t('li', 'lt-step lt-step-' + place); li.append(t('span', 'lt-step-name', p.ten), t('small', '', `${p.p} điểm`), t('b', 'lt-step-block', String(place))); ol.append(li); }
      kids.push(t('h3', 'lt-sub', 'Bục vinh danh'), ol);
    }
    const pct = total && mine ? mine.c / total : 0;
    kids.push(t('p', 'lt-wait', !mine ? 'Cảm ơn em đã tham gia.' : pct >= 0.8 ? 'Em nắm bài rất chắc. Tiếp tục phát huy!' : pct >= 0.5 ? 'Em làm khá tốt. Xem lại các câu sai để chắc hơn nhé.' : 'Em cần ôn lại bài. Hỏi Gia sư AI hoặc thầy cô ở các câu còn sai nhé.'));
    kids.push(b('Đóng', 'primary lt-done', () => closeOverlay()));
    main.replaceChildren(...kids);
    if (fxSeen !== 'end' && mine) { fxSeen = 'end'; if (r && r <= 3) { fx.sfx.fanfare(); fx.confetti(o); } }
  }
}
/** @param {string} k @param {string} x */
async function answer(k, x) {
  if (!me || !playing || chosen[k] || pub?.phase !== 'q') return;
  chosen[k] = x; lastKey = ''; draw();
  try { await store.put(`quiz/${playing}/ans/${k}/${store.keyOf(me.ma)}`, { a: x, t: store.SERVER_TIME }); }
  catch { const w = document.querySelector('#lt-play .lt-wait'); if (w) w.textContent = 'Hết giờ hoặc mạng chậm, câu trả lời chưa được ghi.'; }
}
