// @ts-check
// Học sinh: BẢNG THI ĐUA LUYỆN TẬP của lớp em (mục Luyện tập). Điểm tính bằng thidua-core.js, cùng mã với màn giáo viên.
// Em thấy: hạng và điểm của mình, top 10 của lớp (tên rút gọn), danh hiệu Chăm chỉ / Tiến bộ. Không hiện hạng các bạn ngoài top 10.
import * as store from './thi-store.js';
import { monthVN, monthLabel, prevMonth, shortName, sessionsOf, rankMonth, gapTop10, fmt } from './thidua-core.js';

/** @type {{ma:string,ten:string,lop:string,key:string}|null} */ let me = null;
/** @type {Record<string, {at:number, data:any}>} */ let cache = {};
let month = '', loading = '';
/** @type {() => void} */ let onChange = () => {};
const FRESH_MS = 60 * 1000;

export function setOnChange(/** @type {() => void} */ fn) { onChange = fn; }
/** @param {{uid:string,student_name:string,class_code:string}} identity */
export function start(identity) {
  if (!store.enabled() || !identity?.class_code) return;
  me = { ma: identity.uid, ten: identity.student_name, lop: identity.class_code, key: store.keyOf(identity.uid) };
  month = monthVN(); cache = {};
}
export function stop() { me = null; cache = {}; month = ''; }
/** Kết thúc buổi luyện tập → tải lại bảng ngay. */
export function invalidate() { cache = {}; onChange(); }

async function load(/** @type {string} */ m) {
  if (!me || loading === m) return;
  loading = m;
  try { const d = await store.get(`quiz_kq_lop/${store.keyOf(me.lop)}/${m}`); cache[m] = { at: Date.now(), data: d }; }
  catch { cache[m] = { at: Date.now(), data: cache[m]?.data ?? null }; }
  finally { loading = ''; }
  onChange();
}

function t(/** @type {string} */ tag, /** @type {string} */ cls = '', /** @type {string} */ text = '') { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }

/** @param {HTMLElement} target */
export function renderPanel(target) {
  target.replaceChildren();
  if (!me) return;
  if (!month) month = monthVN();
  const c = cache[month];
  if (!c || Date.now() - c.at > FRESH_MS) void load(month);
  const card = t('section', 'td-card'); card.setAttribute('aria-labelledby', 'td-title');
  const head = t('div', 'td-head');
  const h = t('h2', 'td-title', 'Bảng thi đua'); h.id = 'td-title';
  const sub = t('p', 'td-sub', `Lớp ${me.lop} · ${monthLabel(month)}`);
  const seg = t('div', 'td-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Chọn tháng');
  for (const [m, label] of [[monthVN(), 'Tháng này'], [prevMonth(monthVN()), 'Tháng trước']]) {
    const b = /** @type {HTMLButtonElement} */ (t('button', 'td-seg-btn', label)); b.type = 'button'; b.setAttribute('aria-pressed', String(month === m));
    b.addEventListener('click', () => { month = m; onChange(); }); seg.append(b);
  }
  const hl = t('div', 'td-head-l'); hl.append(h, sub); head.append(hl, seg); card.append(head);
  if (!c) { card.append(t('p', 'td-loading', 'Đang tải bảng thi đua…')); target.append(card); return; }
  const R = rankMonth(sessionsOf(c.data));
  if (!R.K) {
    card.append(t('p', 'td-empty', month === monthVN() ? 'Tháng này lớp em chưa có buổi luyện tập nào. Khi thầy cô mở Luyện tập trên lớp, kết quả sẽ vào bảng thi đua.' : 'Tháng trước lớp em không có buổi luyện tập nào.'));
    card.append(rules(R)); target.append(card); return;
  }
  // Thẻ của em
  const mine = R.rows.find(r => r.k === me?.key) || R.chua.find(r => r.k === me?.key);
  const you = t('div', 'td-you' + (mine?.du && mine.hang <= 3 ? ' is-top' : ''));
  const rk = t('div', 'td-you-rank');
  if (mine?.du) { rk.append(t('small', '', 'Hạng của em'), t('strong', '', String(mine.hang)), t('small', '', `/${R.rows.length} bạn`)); }
  else rk.append(t('small', '', 'Hạng của em'), t('strong', 'td-dash', '–'));
  const info = t('div', 'td-you-info');
  if (mine) {
    info.append(t('p', 'td-you-score', mine.du ? `${mine.diem} điểm` : `Đã tham gia ${mine.buoi}/${R.K} buổi`));
    info.append(t('p', 'td-you-meta', `Tham gia ${mine.buoi}/${R.K} buổi · đúng ${mine.dung}/${mine.tong} câu`));
    const gap = gapTop10(R.rows, mine);
    const msg = !mine.du ? `Tham gia thêm ${mine.thieu} buổi để được xếp hạng.`
      : mine.hang === 1 ? 'Em đang dẫn đầu lớp. Giữ vững phong độ nhé!'
      : mine.hang <= 10 ? 'Em đang trong top 10. Cố gắng thêm để lên hạng!'
      : gap?.bang ? 'Em bằng điểm bạn hạng 10. Tham gia thêm buổi để vượt lên.'
      : `Còn ${gap?.diem} điểm nữa là vào top 10.`;
    info.append(t('p', 'td-you-msg', msg));
  } else info.append(t('p', 'td-you-score', 'Em chưa tham gia buổi nào'), t('p', 'td-you-msg', `Vào phòng khi thầy cô mở Luyện tập để có tên trên bảng. Cần ${R.N} buổi để được xếp hạng.`));
  you.append(rk, info); card.append(you);
  // Top 10
  const top = R.rows.filter(r => r.hang <= 10);
  if (top.length) {
    card.append(t('h3', 'td-h3', 'Top 10 của lớp'));
    const pod = t('ol', 'td-podium'); pod.setAttribute('aria-label', 'Ba bạn dẫn đầu');
    const podRows = top.filter(x => x.hang <= 3).slice(0, 3);
    for (const r of podRows) {
      const li = t('li', `td-pod td-pod-${r.hang}` + (r.k === me.key ? ' is-me' : ''));
      li.append(t('span', 'td-medal', String(r.hang)), t('span', 'td-pod-name', shortName(r.ten) + (r.k === me.key ? ' (em)' : '')), t('strong', 'td-pod-score', r.diem));
      li.setAttribute('aria-label', `Hạng ${r.hang}: ${shortName(r.ten)}, ${r.diem} điểm`); pod.append(li);
    }
    card.append(pod);
    const rest = top.filter(x => !podRows.includes(x));
    if (rest.length) {
      const ol = t('ol', 'td-list');
      for (const r of rest) {
        const li = t('li', r.k === me.key ? 'is-me' : '');
        li.append(t('span', 'td-n', String(r.hang)), t('span', 'td-name', shortName(r.ten) + (r.k === me.key ? ' (em)' : '')), t('span', 'td-b', `${r.buoi} buổi`), t('strong', 'td-s', r.diem));
        ol.append(li);
      }
      card.append(ol);
    }
  } else card.append(t('p', 'td-empty', `Chưa bạn nào đủ ${R.N} buổi để được xếp hạng.`));
  // Danh hiệu
  if (R.chamChi.length || R.tienBo.length) {
    const aw = t('div', 'td-awards');
    if (R.chamChi.length) { const x = t('p', 'td-award td-award-cc'); x.append(t('strong', '', 'Chăm chỉ nhất'), t('span', '', `${R.chamChi.map(r => shortName(r.ten)).join(', ')} · ${R.chamChi[0].buoi} buổi`)); aw.append(x); }
    if (R.tienBo.length) { const x = t('p', 'td-award td-award-tb'); x.append(t('strong', '', 'Tiến bộ nhất'), t('span', '', `${R.tienBo.map(e => shortName(e.row.ten)).join(', ')} · tăng ${fmt(R.tienBo[0].tang)} điểm`)); aw.append(x); }
    card.append(aw);
  }
  card.append(rules(R));
  target.append(card);
}
/** Cách tính, viết ngắn cho học sinh. @param {{K:number,N:number}} R */
function rules(R) {
  const d = t('details', 'td-rules'); d.append(t('summary', '', 'Cách tính điểm thi đua'));
  const ul = t('ul');
  for (const x of [
    'Mỗi buổi Luyện tập trên lớp: điểm = số câu đúng ÷ số câu × 10. Bấm nhanh hay chậm không ảnh hưởng.',
    `Điểm tháng = trung bình các buổi cao nhất của em. Tháng này lớp đã luyện ${R.K} buổi, tính ${R.N || 1} buổi cao nhất.`,
    `Cần tham gia ít nhất ${R.N || 1} buổi để được xếp hạng.`,
    'Bằng điểm: bạn tham gia nhiều buổi hơn xếp trên, rồi đến bạn đúng nhiều câu hơn.',
    'Thảo luận không tính điểm thi đua.'
  ]) ul.append(t('li', '', x));
  d.append(ul); return d;
}
