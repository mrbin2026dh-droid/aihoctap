// @ts-check
// Bản đồ năng lực của học sinh: mỗi CHỦ ĐỀ một ô màu theo tỉ lệ câu đúng (code tính, không dùng AI) —
// gộp bài luyện tập (máy chủ tính từ lượt làm gần nhất mỗi bài) + thi thử/thi thật (Firebase thi_nop/chu_de).
// Ô yếu có nút "Ôn bài" và "Hỏi Gia sư"; chủ đề yếu được gửi kèm cho Gia sư AI để em được củng cố đúng chỗ.
// Bản tóm tắt ghi lên Firebase nang_luc/{mã} để giáo viên xem bản đồ cả lớp (trang Hiệu quả).
import * as store from './thi-store.js';
import { topicKey } from './thi-app.js';
import { el, icon, button, withIcon } from './dom.js';

export const GOOD = 80, MID = 50;
/** @typedef {{key:string,ten:string,d:number,n:number,pct:number,lessons:{course_id:string,lesson_id:string,title:string}[],src:string[]}} Topic */

/** Mức của một chủ đề. @param {number} pct */
export const level = pct => pct >= GOOD ? { cls: 'is-good', label: 'Vững' } : pct >= MID ? { cls: 'is-mid', label: 'Đang học' } : { cls: 'is-weak', label: 'Cần ôn' };

/**
 * Gộp hai nguồn theo chủ đề (không phân biệt hoa thường).
 * @param {{topic:string,correct:number,total:number,lessons?:any[]}[]} practice
 * @param {Record<string,{ten:string,d:number,n:number}>} exams
 * @returns {Topic[]}
 */
export function merge(practice, exams) {
  /** @type {Map<string, {ten:string,d:number,n:number,lessons:any[],src:Set<string>}>} */ const m = new Map();
  for (const p of practice || []) {
    const k = topicKey(p.topic); if (!k || !(Number(p.total) > 0)) continue;
    const r = m.get(k) || { ten: String(p.topic).trim(), d: 0, n: 0, lessons: [], src: new Set() };
    r.d += Number(p.correct) || 0; r.n += Number(p.total) || 0; r.src.add('Luyện tập');
    for (const l of p.lessons || []) if (l && !r.lessons.some(x => x.lesson_id === l.lesson_id && x.course_id === l.course_id)) r.lessons.push(l);
    m.set(k, r);
  }
  for (const [k0, v] of Object.entries(exams || {})) {
    const k = topicKey(v?.ten || k0); if (!k || !(Number(v?.n) > 0)) continue;
    const r = m.get(k) || { ten: String(v.ten || k0).trim(), d: 0, n: 0, lessons: [], src: new Set() };
    r.d += Number(v.d) || 0; r.n += Number(v.n) || 0; r.src.add('Thi'); m.set(k, r);
  }
  return [...m].map(([key, r]) => ({ key, ten: r.ten, d: r.d, n: r.n, pct: Math.round(100 * r.d / r.n), lessons: r.lessons.slice(0, 3), src: [...r.src] }))
    .sort((a, b) => a.pct - b.pct || b.n - a.n);
}

const lsKey = (/** @type {string} */ uid) => `nang-luc-${store.keyOf(uid)}`;
/** Chủ đề còn yếu (dưới 80%) gửi kèm Gia sư AI, ví dụ "Mã nhị phân (40%)". @param {string} uid @returns {string[]} */
export function weakTopics(uid) {
  try { const list = /** @type {Topic[]} */ (JSON.parse(localStorage.getItem(lsKey(uid)) || '[]')); return list.filter(t => t.pct < GOOD).slice(0, 3).map(t => `${t.ten} (${t.pct}%)`); } catch { return []; }
}

/**
 * Lưu trên máy + ghi tóm tắt lên Firebase (chỉ khi đổi). @param {{uid:string,student_name:string,class_code:string}} id @param {Topic[]} list
 */
export async function publish(id, list) {
  try { localStorage.setItem(lsKey(id.uid), JSON.stringify(list.slice(0, 40))); } catch { /* bỏ qua */ }
  if (!store.enabled() || !list.length) return;
  /** @type {Record<string,{ten:string,d:number,n:number}>} */ const topics = {};
  for (const t of list.slice(0, 40)) topics[t.key] = { ten: t.ten.slice(0, 60), d: t.d, n: t.n };
  const sig = JSON.stringify(topics), sk = lsKey(id.uid) + '-sent';
  try { if (localStorage.getItem(sk) === sig) return; } catch { /* bỏ qua */ }
  await store.put(`nang_luc/${store.keyOf(id.uid)}`, { at: store.SERVER_TIME, ten: String(id.student_name || '').slice(0, 100), lop: String(id.class_code || '').slice(0, 20), topics });
  try { localStorage.setItem(sk, sig); } catch { /* bỏ qua */ }
}

/**
 * Bảng "Bản đồ năng lực".
 * @param {Topic[]} list
 * @param {{onReview:(t:Topic)=>void, onAsk:(t:Topic)=>void}} act
 */
export function render(list, act) {
  const sec = el('section', '', 'panel mastery-panel'); sec.setAttribute('aria-labelledby', 'mastery-title');
  const head = el('div', '', 'mastery-head');
  const h = el('h2', 'Bản đồ năng lực', 'panel-title'); h.id = 'mastery-title';
  const legend = el('div', '', 'mastery-legend');
  for (const [cls, label] of [['is-good', `Vững ≥ ${GOOD}%`], ['is-mid', `Đang học ${MID}–${GOOD - 1}%`], ['is-weak', `Cần ôn < ${MID}%`]]) { const c = el('span', label, 'mastery-chip ' + cls); legend.append(c); }
  head.append(h, legend); sec.append(head, el('p', 'Màu theo tỉ lệ câu đúng từng chủ đề ở bài luyện tập và bài thi (máy tự tính).', 'meta'));
  if (!list.length) { sec.append(el('p', 'Làm bài luyện tập hoặc thi thử để thấy bản đồ năng lực của em.', 'mastery-empty')); return sec; }
  const weakest = list.find(t => t.pct < GOOD);
  if (weakest) {
    const tip = el('div', '', 'mastery-tip ' + level(weakest.pct).cls); tip.setAttribute('role', 'note');
    const txt = el('div', ''); txt.append(el('strong', 'Hôm nay em nên ôn: ' + weakest.ten), el('span', ` — đúng ${weakest.d}/${weakest.n} câu (${weakest.pct}%).`));
    tip.append(icon('target', 'ic'), txt); sec.append(tip);
  }
  const grid = el('ul', '', 'mastery-grid');
  for (const t of list) {
    const lv = level(t.pct), li = el('li', '', 'mastery-tile ' + lv.cls);
    const top = el('div', '', 'mastery-top'); top.append(el('h3', t.ten), el('strong', t.pct + '%', 'mastery-pct'));
    const bar = el('span', '', 'mastery-bar'); bar.setAttribute('aria-hidden', 'true'); bar.style.setProperty('--pct', t.pct + '%');
    li.append(top, bar, el('p', `${lv.label} · đúng ${t.d}/${t.n} câu · ${t.src.join(' + ')}`, 'meta'));
    if (t.pct < GOOD && t.lessons.length) {
      const row = el('div', '', 'mastery-acts');
      row.append(withIcon(button('Ôn bài', () => act.onReview(t), 'quiet'), 'repeat'), withIcon(button('Hỏi Gia sư', () => act.onAsk(t), 'quiet'), 'spark'));
      li.append(row);
    }
    grid.append(li);
  }
  sec.append(grid);
  return sec;
}
