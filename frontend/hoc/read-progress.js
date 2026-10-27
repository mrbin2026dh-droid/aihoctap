// @ts-check
// Thanh đọc bài: neo tên bài + thanh tiến độ "% đã đọc" ngay trên nội dung (dính dưới thanh trên cùng khi cuộn), như các LMS.
// Ghi % đọc cao nhất của mỗi em lên Firebase doc_read/{bài}/{mã} (chỉ tăng, mỗi 10%) để giáo viên theo dõi ai đã đọc bài.
import * as store from './thi-store.js';

/** @type {{key:string,uid:string,ten:string,lop:string,max:number,sent:number}|null} */ let cur = null;
let bar = /** @type {HTMLElement|null} */ (null), raf = 0;
const lsKey = (/** @type {string} */ uid, /** @type {string} */ key) => `read-${store.keyOf(uid)}-${key}`;
/** Khóa Firebase của một bài (không có . # $ [ ] /). @param {string} course @param {string} lesson */
export const lessonKey = (course, lesson) => `${course}~${lesson}`.replace(/[.#$[\]/]/g, '_').slice(0, 120);

function ensureBar() {
  if (bar) return bar;
  const content = document.getElementById('lesson-content'); if (!content) return null;
  bar = document.createElement('div'); bar.id = 'read-bar'; bar.className = 'read-bar';
  bar.innerHTML = '<span class="read-title"></span><span class="read-track" role="progressbar" aria-label="Tiến độ đọc bài" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="read-fill"></span></span><span class="read-pct">0%</span>';
  content.before(bar);
  addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule);
  return bar;
}
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }
/** Phần trăm nội dung đã cuộn qua (đáy màn hình so với đáy nội dung). */
function percent() {
  const c = document.getElementById('lesson-content'); if (!c || c.hidden || !c.offsetHeight) return 0;
  const r = c.getBoundingClientRect(), seen = innerHeight - r.top, total = r.height;
  return Math.max(0, Math.min(100, Math.round(seen / total * 100)));
}
function update() {
  const b = bar, view = document.getElementById('lesson-view'), c = document.getElementById('lesson-content');
  if (!b || !cur) return;
  const on = !!view && !view.hidden && !!c && !c.hidden;
  b.hidden = !on; if (!on) return;
  if (c) b.style.maxWidth = c.offsetWidth + 'px';   // thẳng hàng với khung nội dung bài
  const t = /** @type {HTMLElement|null} */ (document.querySelector('.topbar')), pos = t ? getComputedStyle(t).position : '';
  b.style.setProperty('--read-top', `${t && (pos === 'sticky' || pos === 'fixed') ? Math.round(t.getBoundingClientRect().height) : 0}px`);
  const p = Math.max(percent(), 0); if (p > cur.max) { cur.max = p; try { localStorage.setItem(lsKey(cur.uid, cur.key), String(p)); } catch { /* bỏ qua */ } }
  const shown = Math.max(p, 0);
  /** @type {HTMLElement} */ (b.querySelector('.read-fill')).style.width = shown + '%';
  /** @type {HTMLElement} */ (b.querySelector('.read-pct')).textContent = (cur.max >= 100 ? 'Đã đọc hết' : `Đã đọc ${cur.max}%`);
  b.querySelector('.read-track')?.setAttribute('aria-valuenow', String(cur.max));
  b.classList.toggle('is-done', cur.max >= 100);
  // Gửi lên Firebase khi vượt mốc 10% mới (hoặc đọc hết).
  const step = cur.max >= 100 ? 100 : Math.floor(cur.max / 10) * 10;
  if (step > cur.sent && step >= 10) { cur.sent = step; void store.put(`doc_read/${cur.key}/${store.keyOf(cur.uid)}`, { pct: step, ten: cur.ten, lop: cur.lop, at: store.SERVER_TIME }).catch(() => { if (cur) cur.sent = 0; }); }
}
/**
 * Bắt đầu theo dõi một bài học (gọi sau khi vẽ nội dung).
 * @param {{course_id:string,lesson_id:string,title:string}} lesson @param {{uid:string,student_name:string,class_code:string}|null} identity
 */
export function track(lesson, identity) {
  const b = ensureBar(); if (!b) return;
  /** @type {HTMLElement} */ (b.querySelector('.read-title')).textContent = lesson.title;
  if (!identity) { cur = { key: lessonKey(lesson.course_id, lesson.lesson_id), uid: '', ten: '', lop: '', max: 0, sent: 999 }; schedule(); return; }   // chưa đăng nhập: chỉ hiện tiến độ
  const key = lessonKey(lesson.course_id, lesson.lesson_id);
  let max = 0; try { max = Number(localStorage.getItem(lsKey(identity.uid, key))) || 0; } catch { /* bỏ qua */ }
  cur = { key, uid: identity.uid, ten: identity.student_name, lop: identity.class_code, max, sent: store.enabled() ? (max >= 100 ? 100 : Math.floor(max / 10) * 10) : 999 };
  schedule();
}
/** Gọi khi đổi chế độ (Học bài / Làm bài tập) hoặc rời bài. */
export const refresh = () => schedule();
