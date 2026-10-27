// @ts-check
// Nút nổi "Hỏi thầy cô" (góc phải dưới): mở Zalo của giáo viên để học sinh nhờ hỗ trợ.
// Thầy cô nhập số Zalo trong trang giáo viên (Cài đặt → Hỗ trợ Zalo) → Google Sheet → Firebase ho_tro (ai cũng đọc được).
// Giáo viên lớp nhập Zalo riêng → học sinh lớp đó thấy Zalo của thầy cô lớp mình; không có thì dùng Zalo chung của trường.
import * as store from './thi-store.js';

const LS = 'ho-tro-cache';
/** @type {{zalo?:string,ten?:string,lop?:Record<string,{zalo?:string,ten?:string}>}|null} */ let data = null;
let cls = '';
/** Chỉ nhận đường dẫn zalo.me hợp lệ (không chèn được liên kết lạ). @param {unknown} u */
export const safeZalo = u => /^https:\/\/zalo\.me\/[A-Za-z0-9/_-]{3,80}$/.test(String(u || '')) ? String(u) : '';
const ICON = '<svg class="zalo-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 8.5h7 M8.5 11.5h4.5"/></svg>';

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
  if (!data) return null;
  const mine = cls && data.lop ? data.lop[store.keyOf(cls)] : null;
  if (mine && safeZalo(mine.zalo)) return mine;
  return safeZalo(data.zalo) ? data : null;
}
function paint() {
  let a = /** @type {HTMLAnchorElement|null} */ (document.getElementById('zalo-help'));
  const p = pick(), url = p ? safeZalo(p.zalo) : '';
  if (!url) { if (a) a.hidden = true; return; }
  if (!a) {
    a = document.createElement('a'); a.id = 'zalo-help'; a.className = 'zalo-fab'; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.innerHTML = `<span class="zalo-ring" aria-hidden="true"></span>${ICON}<span class="zalo-label"></span>`;
    document.body.append(a);
  }
  const who = p?.ten ? String(p.ten).slice(0, 40) : 'thầy cô';
  a.hidden = false; a.href = url;
  /** @type {HTMLElement} */ (a.querySelector('.zalo-label')).textContent = 'Hỏi ' + who;
  a.setAttribute('aria-label', `Nhắn Zalo cho ${who} để được hỗ trợ (mở Zalo)`); a.title = `Nhắn Zalo cho ${who}`;
}
