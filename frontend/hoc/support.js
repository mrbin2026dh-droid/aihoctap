// @ts-check
// Nút trợ giúp nhỏ (góc phải dưới): mở khung "Trợ giúp nhanh" với câu hỏi có sẵn (trả lời tức thì, không tốn AI); cuối khung có nút nhắn Zalo giáo viên.
// Thầy cô nhập số Zalo trong trang giáo viên (Cài đặt → Hỗ trợ Zalo) → Google Sheet → Firebase ho_tro (ai cũng đọc được).
// Giáo viên lớp nhập Zalo riêng → học sinh lớp đó thấy Zalo của thầy cô lớp mình; không có thì dùng Zalo chung của trường.
import * as store from './thi-store.js';
import { SUPPORT_CONFIG } from './support-config.js';
import { FAQ, GROUPS } from './help-faq.js';

const LS = 'ho-tro-cache';
/** @type {{zalo?:string,ten?:string,lop?:Record<string,{zalo?:string,ten?:string}>}|null} */ let data = null;
let cls = '';
/** Chỉ nhận đường dẫn zalo.me hợp lệ (không chèn được liên kết lạ). @param {unknown} u */
export const safeZalo = u => /^https:\/\/zalo\.me\/[A-Za-z0-9/_-]{3,80}$/.test(String(u || '')) ? String(u) : '';

/** Đổi lớp của học sinh đang đăng nhập (rỗng = chưa đăng nhập). @param {string} c */
export function setClass(c) { cls = String(c || ''); paint(); }
/** Đọc cấu hình (bản lưu trên máy trước, rồi Firebase). */
export async function init() {
  try { data = JSON.parse(localStorage.getItem(LS) || 'null'); } catch { data = null; }
  paint();
  if (!store.enabled()) return;
  try { data = (await store.get('ho_tro')) || null; try { localStorage.setItem(LS, JSON.stringify(data)); } catch { /* bỏ qua */ } paint(); } catch { /* ngoại tuyến: dùng bản đã lưu */ }
}
function pick() {
  const fallback = safeZalo(SUPPORT_CONFIG.zalo) ? SUPPORT_CONFIG : null;
  if (!data) return fallback;
  const mine = cls && data.lop ? data.lop[store.keyOf(cls)] : null;
  if (mine && safeZalo(mine.zalo)) return mine;
  return safeZalo(data.zalo) ? data : fallback;
}
const SVG = 'http://www.w3.org/2000/svg';
/** @param {string} d @param {string} [cls] */
function icon(d, cls = 'help-ic') {
  const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.append(p); return s;
}
const D_HELP = 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.6 M12 16.6h.01';
const D_X = 'M6 6l12 12 M18 6L6 18';
/** @param {string} tag @param {string} [cls] @param {string} [text] */
const mk = (tag, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
/** @type {HTMLElement|null} */ let panel = null;
/** @type {HTMLButtonElement|null} */ let fab = null;
let group = GROUPS[0].id;
const asked = new Set();
const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;

/** @param {boolean} on */
function toggle(on) {
  if (!panel || !fab) return;
  panel.hidden = !on; fab.setAttribute('aria-expanded', String(on)); document.body.classList.toggle('help-open', on);
  if (on) /** @type {HTMLElement} */ (panel.querySelector('.help-close')).focus(); else fab.focus();
}
/** @param {'bot'|'me'} who @param {string} text */
function bubble(who, text) {
  const log = /** @type {HTMLElement} */ (panel?.querySelector('.help-log'));
  const b = mk('div', 'help-msg help-' + who);
  text.split('\n').forEach(line => b.append(mk('p', '', line)));
  log.append(b); log.scrollTop = log.scrollHeight; return b;
}
/** @param {number} i */
function ask(i) {
  const item = FAQ[i]; if (!item || !panel) return;
  asked.add(i); bubble('me', item.q); renderChips();
  const log = /** @type {HTMLElement} */ (panel.querySelector('.help-log'));
  const typing = mk('div', 'help-msg help-bot help-typing'); typing.setAttribute('aria-hidden', 'true'); typing.append(mk('i'), mk('i'), mk('i'));
  log.append(typing); log.scrollTop = log.scrollHeight;
  setTimeout(() => { typing.remove(); bubble('bot', item.a); }, reduce() ? 0 : 520);
}
function renderChips() {
  if (!panel) return;
  const tabs = /** @type {HTMLElement} */ (panel.querySelector('.help-tabs')), list = /** @type {HTMLElement} */ (panel.querySelector('.help-chips'));
  tabs.replaceChildren(...GROUPS.map(g => { const b = mk('button', 'help-tab', g.label); b.type = 'button'; b.setAttribute('aria-pressed', String(g.id === group)); b.onclick = () => { group = g.id; renderChips(); }; return b; }));
  list.replaceChildren(...FAQ.map((f, i) => ({f, i})).filter(x => x.f.g === group).map(({f, i}) => { const b = mk('button', 'help-chip' + (asked.has(i) ? ' done' : ''), f.q); b.type = 'button'; b.onclick = () => ask(i); return b; }));
}
function build() {
  fab = /** @type {HTMLButtonElement} */ (mk('button', 'help-fab')); fab.id = 'help-fab'; fab.type = 'button';
  fab.setAttribute('aria-label', 'Trợ giúp nhanh'); fab.title = 'Trợ giúp nhanh'; fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'help-panel');
  fab.append(icon(D_HELP), mk('span', 'help-ring'));
  fab.onclick = () => toggle(Boolean(panel?.hidden));
  panel = mk('section', 'help-panel'); panel.id = 'help-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'help-title');
  const head = mk('header', 'help-head'), tt = mk('div'); const h = mk('h2', '', 'Trợ giúp nhanh'); h.id = 'help-title';
  tt.append(h, mk('p', '', 'Chọn một câu hỏi, mình trả lời ngay.'));
  const close = mk('button', 'help-close'); close.type = 'button'; close.setAttribute('aria-label', 'Đóng trợ giúp'); close.append(icon(D_X)); close.onclick = () => toggle(false);
  head.append(tt, close);
  const log = mk('div', 'help-log'); log.setAttribute('aria-live', 'polite');
  const foot = mk('div', 'help-foot'); foot.append(mk('div', 'help-tabs'), mk('div', 'help-chips'));
  const z = /** @type {HTMLAnchorElement} */ (mk('a', 'help-zalo')); z.id = 'zalo-help'; z.target = '_blank'; z.rel = 'noopener noreferrer'; z.hidden = true; z.append(mk('span', 'help-zalo-text'));
  foot.append(z);
  panel.append(head, log, foot);
  document.body.append(fab, panel);
  bubble('bot', 'Xin chào! Mình giới thiệu nhanh về ứng dụng AI Học Tập. Em hoặc thầy cô chọn câu hỏi bên dưới nhé.');
  renderChips();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && !panel.hidden) toggle(false); });
  document.addEventListener('pointerdown', e => { const t = /** @type {Node} */ (e.target); if (panel && !panel.hidden && !panel.contains(t) && !fab?.contains(t)) toggle(false); });
}
function paint() {
  if (!panel) build();
  const z = /** @type {HTMLAnchorElement} */ (document.getElementById('zalo-help'));
  const p = pick(), url = p ? safeZalo(p.zalo) : '';
  if (!url) { z.hidden = true; return; }
  const who = p?.ten ? String(p.ten).slice(0, 40) : 'thầy cô';
  z.hidden = false; z.href = url;
  /** @type {HTMLElement} */ (z.querySelector('.help-zalo-text')).textContent = 'Nhắn Zalo cho ' + who;
  z.setAttribute('aria-label', `Nhắn Zalo cho ${who} để được hỗ trợ (mở Zalo)`);
}
