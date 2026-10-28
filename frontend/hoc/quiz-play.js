// @ts-check
// Học sinh chơi "Trò chơi câu hỏi" do giáo viên điều khiển trên lớp (Firebase, không qua Worker):
// thầy cô mở phòng cho lớp → app hiện thẻ "Vào chơi" → em chọn đáp án trên điện thoại → xem đúng/sai, điểm, hạng.
// Em không thấy đáp án trước (chỉ máy giáo viên giữ đáp án đến lúc công bố).
import * as store from './thi-store.js';

const L = ['A', 'B', 'C', 'D'];
/** @type {{ma:string,ten:string,lop:string}|null} */ let me = null;
/** @type {null|(() => void)} */ let stopLop = null;
/** @type {(() => void)[]} */ let stops = [];
let room = '', dismissed = '', playing = '';   // room = phòng đang mời lớp; playing = phòng em đã vào (giữ đến khi em đóng, kể cả khi thầy cô kết thúc)
/** @type {any} */ let pub = null; /** @type {any} */ let mine = null;
/** @type {Record<string,string>} */ let chosen = {};
let timer = 0, lastPhaseKey = '';

/** Sau khi đăng nhập: nghe phòng chơi của lớp em. @param {{uid:string,student_name:string,class_code:string}} identity */
export function start(identity) {
  if (!store.enabled()) return;
  const next = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code };
  if (me && me.ma === next.ma && stopLop) return;
  stop(); me = next;
  void probe();
}
/** Thử đọc một lần trước khi nghe liên tục: luật Firebase chưa có nhánh trò chơi (chưa đăng luật mới) thì không nghe → không báo lỗi liên tục; thử lại sau 10 phút. */
let probeTimer = 0;
async function probe() {
  if (!me || stopLop) return;
  const path = `quiz_lop/${store.keyOf(me.lop)}`;
  try { await store.get(path); }
  catch { clearTimeout(probeTimer); probeTimer = window.setTimeout(() => void probe(), 600000); return; }
  if (!me || stopLop) return;
  stopLop = store.listen(path, d => { room = typeof d === 'string' && /^\d{6}$/.test(d) ? d : ''; banner(); });
}
/** Đăng xuất. */
export function stop() { clearTimeout(probeTimer); stopLop?.(); stopLop = null; leaveRoom(); room = ''; me = null; banner(); }

function banner() {
  let b = document.getElementById('qz-banner');
  const show = !!room && !!me && dismissed !== room && document.getElementById('qz-play')?.hidden !== false;
  if (!show) { if (b) b.hidden = true; return; }
  if (!b) {
    b = document.createElement('div'); b.id = 'qz-banner'; b.className = 'qz-banner'; b.setAttribute('role', 'status');
    const dot = document.createElement('span'); dot.className = 'qz-banner-dot'; dot.setAttribute('aria-hidden', 'true');
    const mid = document.createElement('div');
    const stg = document.createElement('strong'); stg.textContent = 'Thầy cô đang mở trò chơi câu hỏi';
    const sub = document.createElement('span'); sub.textContent = 'Bấm Vào chơi để tham gia cùng lớp.';
    mid.append(stg, sub);
    const btnJoin = document.createElement('button'); btnJoin.type = 'button'; btnJoin.className = 'primary qz-join'; btnJoin.textContent = 'Vào chơi';
    const btnX = document.createElement('button'); btnX.type = 'button'; btnX.className = 'qz-banner-x'; btnX.setAttribute('aria-label', 'Ẩn thông báo trò chơi'); btnX.textContent = '×';
    b.append(dot, mid, btnJoin, btnX);
    document.body.append(b);
    b.querySelector('.qz-join')?.addEventListener('click', () => void join());
    b.querySelector('.qz-banner-x')?.addEventListener('click', () => { dismissed = room; banner(); });
  }
  b.hidden = false;
}

function overlay() {
  let o = document.getElementById('qz-play');
  if (!o) {
    o = document.createElement('div'); o.id = 'qz-play'; o.className = 'qz-play'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Trò chơi câu hỏi');
    const header = document.createElement('header'); header.className = 'qz-p-top';
    const title = document.createElement('strong'); title.className = 'qz-p-title';
    const score = document.createElement('span'); score.className = 'qz-p-score'; score.setAttribute('aria-live', 'polite');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'qz-p-close'; close.setAttribute('aria-label', 'Thoát trò chơi'); close.textContent = '×';
    header.append(title, score, close);
    const main = document.createElement('main'); main.className = 'qz-p-main'; main.setAttribute('aria-live', 'polite');
    o.append(header, main);
    document.body.append(o);
    o.querySelector('.qz-p-close')?.addEventListener('click', () => { if (pub?.phase === 'end' || playing !== room) leaveRoom(); else if (o) o.hidden = true; document.body.classList.remove('qz-playing'); banner(); });
  }
  return o;
}
async function join() {
  if (!me || !room) return;
  if (playing && playing !== room) leaveRoom();
  playing = room;
  const o = overlay(); o.hidden = false; document.body.classList.add('qz-playing'); banner();
  /** @type {HTMLElement} */ (o.querySelector('.qz-p-main')).replaceChildren(text('p', 'qz-p-wait', 'Đang vào phòng…'));
  await store.put(`quiz/${playing}/ds/${store.keyOf(me.ma)}`, { ten: me.ten, at: store.SERVER_TIME }).catch(() => { /* đã vào trước đó */ });
  stops.forEach(f => f()); stops = [];
  stops.push(store.listen(`quiz/${playing}/pub`, d => { pub = d; draw(); }));
  stops.push(store.listen(`quiz/${playing}/kq/${store.keyOf(me.ma)}`, d => { mine = d; drawScore(); if (pub?.phase === 'reveal' || pub?.phase === 'end') draw(); }));
  /** @type {HTMLElement} */ (o.querySelector('.qz-p-close')).focus();
}
function leaveRoom() { playing = ''; stops.forEach(f => f()); stops = []; clearInterval(timer); pub = null; mine = null; chosen = {}; lastPhaseKey = ''; const o = document.getElementById('qz-play'); if (o) o.hidden = true; document.body.classList.remove('qz-playing'); }
function text(/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ t) { const n = document.createElement(tag); n.className = cls; n.textContent = t; return n; }
function drawScore() { const s = document.querySelector('#qz-play .qz-p-score'); if (s) s.textContent = mine ? `${mine.p} điểm · hạng ${mine.r}/${mine.n}` : ''; }
function draw() {
  const o = document.getElementById('qz-play'); if (!o || o.hidden || !pub) return;
  /** @type {HTMLElement} */ (o.querySelector('.qz-p-title')).textContent = pub.title || 'Trò chơi câu hỏi';
  drawScore();
  const main = /** @type {HTMLElement} */ (o.querySelector('.qz-p-main')), key = `${pub.phase}|${pub.q?.k || pub.reveal?.k || ''}|${chosen[pub.q?.k] || ''}|${mine?.p ?? ''}`;
  if (key === lastPhaseKey) return; lastPhaseKey = key;
  clearInterval(timer);
  if (pub.phase === 'lobby') { main.replaceChildren(text('span', 'qz-p-pulse', ''), text('p', 'qz-p-wait', 'Em đã vào phòng. Chờ thầy cô bắt đầu…')); return; }
  if (pub.phase === 'q' && pub.q) {
    const q = pub.q, k = q.k, my = chosen[k];
    const head = document.createElement('div'); head.className = 'qz-p-head';
    const tm = text('span', 'qz-p-timer', String(q.lim)); head.append(text('span', 'qz-p-idx', `Câu ${Number(q.i) + 1}/${pub.n}`), tm);
    const qt = text('p', 'qz-p-q', q.text || '');
    const grid = document.createElement('div'); grid.className = 'qz-p-opts';
    for (const x of L) if (q.opts?.[x]) {
      const b = /** @type {HTMLButtonElement} */ (document.createElement('button')); b.type = 'button'; b.className = `qz-p-opt qz-${x}${my === x ? ' is-chosen' : ''}`; b.disabled = !!my;
      b.append(text('b', '', x), text('span', '', q.opts[x])); b.setAttribute('aria-label', `Phương án ${x}: ${q.opts[x]}`);
      b.addEventListener('click', () => void answer(k, x)); grid.append(b);
    }
    main.replaceChildren(head, qt, grid, text('p', 'qz-p-wait', my ? `Em đã chọn ${my}. Chờ hết giờ…` : 'Chọn một đáp án — trả lời nhanh được thêm điểm.'));
    const end = Date.now() + Number(q.lim || 20) * 1000;
    timer = window.setInterval(() => { const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); tm.textContent = String(left); if (left <= 0) { clearInterval(timer); grid.querySelectorAll('button').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; }); } }, 250);
    return;
  }
  if (pub.phase === 'reveal' && pub.reveal) {
    const my = chosen[pub.reveal.k], ok = my && my === pub.reveal.ans;
    const box = text('div', 'qz-p-result ' + (ok ? 'is-ok' : 'is-bad'), '');
    box.append(text('strong', '', ok ? 'Chính xác!' : my ? 'Chưa đúng' : 'Em chưa trả lời'), text('span', '', `Đáp án đúng: ${pub.reveal.ans}`));
    const top = document.createElement('ol'); top.className = 'qz-p-top5'; for (const t of Object.values(pub.top || {})) { const li = document.createElement('li'); li.append(text('span', '', t.ten), text('strong', '', String(t.p))); top.append(li); }
    main.replaceChildren(box, text('p', 'qz-p-wait', mine ? `Em có ${mine.p} điểm · hạng ${mine.r}/${mine.n}` : ''), text('h3', 'qz-p-sub', 'Bảng xếp hạng'), top);
    return;
  }
  if (pub.phase === 'end') {
    const box = text('div', 'qz-p-result is-end', '');
    box.append(text('strong', '', mine ? `Hạng ${mine.r}/${mine.n}` : 'Trò chơi kết thúc'), text('span', '', mine ? `${mine.p} điểm · đúng ${mine.c} câu` : 'Cảm ơn em đã tham gia.'));
    main.replaceChildren(box, text('p', 'qz-p-wait', 'Thầy cô sẽ cùng lớp xem lại các câu nhiều bạn sai.'));
  }
}
/** @param {string} k @param {string} x */
async function answer(k, x) {
  if (!me || !playing || chosen[k]) return;
  chosen[k] = x; lastPhaseKey = ''; draw();
  try { await store.put(`quiz/${playing}/ans/${k}/${store.keyOf(me.ma)}`, { a: x, t: store.SERVER_TIME }); }
  catch { const w = document.querySelector('#qz-play .qz-p-wait'); if (w) w.textContent = 'Hết giờ hoặc mạng chậm — câu trả lời chưa được ghi.'; }
}
