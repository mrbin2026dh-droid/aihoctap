// @ts-check
// Cài ứng dụng + mở đúng trình duyệt.
// 1) Mở link trong Zalo/Facebook/Messenger…: trình duyệt trong ứng dụng không cài được app, hay mất đăng nhập
//    → màn hình "Mở AI Học Tập bằng trình duyệt" (Android: mở thẳng Chrome; iPhone: thử mở Safari, kèm hướng dẫn).
// 2) Gợi ý cài CHỈ khi chắc máy chưa cài: Chrome/Edge/Cốc Cốc báo "beforeinstallprompt" (trình duyệt chỉ báo khi chưa cài
//    hoặc đã gỡ); iPhone Safari không cho biết đã cài hay chưa → nhắc tối đa 1 lần/7 ngày, bấm "Đã cài rồi" thì thôi 60 ngày.
// 3) Nút cài ở thanh trên mở bảng hướng dẫn đúng thiết bị; đang mở bằng app (standalone) thì ẩn nút.

const UA = navigator.userAgent || '';
export const isIOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/i.test(UA);
/** Trình duyệt nằm trong ứng dụng khác (không cài được PWA). @param {string} [ua] */
export function inAppName(ua = UA) {
  if (/Zalo/i.test(ua)) return 'Zalo';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/TikTok|musical_ly|Bytedance/i.test(ua)) return 'TikTok';
  if (/Line\//i.test(ua)) return 'Line';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  if (/\bGSA\//i.test(ua)) return 'Google';
  if (isAndroid && /;\s?wv\)/i.test(ua)) return 'ứng dụng';
  return '';
}
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || /** @type {any} */ (navigator).standalone === true;

const LS = { later: 'cai-app-de-sau', done: 'cai-app-da-cai', stay: 'trinh-duyet-o-lai' };
const DAY = 864e5;
const get = (/** @type {Storage} */ s, /** @type {string} */ k) => { try { return Number(s.getItem(k) || 0); } catch { return 0; } };
const set = (/** @type {Storage} */ s, /** @type {string} */ k, /** @type {number} */ v) => { try { s.setItem(k, String(v)); } catch { /* chế độ riêng tư */ } };

/** @type {(Event & {prompt:()=>Promise<void>, userChoice:Promise<{outcome:string}>})|null} */ let deferred = null;
let installedNow = false;
/** @type {(msg:string, err?:boolean)=>void} */ let notify = () => {};
/** @type {()=>boolean} */ let busy = () => false;

const SVG = 'http://www.w3.org/2000/svg';
/** @param {string} d */
function ic(d) { const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ins-ic'); const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.append(p); return s; }
const I = {
  share: 'M12 3v12 M7.5 7.5 12 3l4.5 4.5 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  plus: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M12 8v8 M8 12h8',
  dots: 'M12 5h.01 M12 12h.01 M12 19h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  install: 'M12 4v10 M7.5 9.5 12 14l4.5-4.5 M4 18h16',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', wifi: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 20h.01', refresh: 'M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'
};
/** @param {string} tag @param {string} [cls] @param {string} [text] */
const mk = (tag, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
/** @param {string} text @param {string} cls @param {()=>void} fn */
const btn = (text, cls, fn) => { const b = /** @type {HTMLButtonElement} */ (mk('button', cls, text)); b.type = 'button'; b.onclick = fn; return b; };
const brandHead = (/** @type {string} */ sub) => { const h = mk('div', 'ins-brand'); const img = /** @type {HTMLImageElement} */ (mk('img')); img.src = './icons/icon-192.png'; img.alt = ''; img.width = 56; img.height = 56; const t = mk('div'); t.append(mk('strong', '', 'AI Học Tập'), mk('span', '', sub)); h.append(img, t); return h; };

async function copyLink() {
  try { await navigator.clipboard.writeText(location.href); notify('Đã sao chép link. Mở Chrome hoặc Safari rồi dán vào ô địa chỉ.'); }
  catch { window.prompt('Sao chép link này:', location.href); }
}

/* ---------- 1) Đang mở trong Zalo/Facebook… ---------- */
/** Link mở thẳng Chrome trên Android (giữ nguyên trang đang xem; máy không có Chrome thì mở trình duyệt mặc định). @param {URL|Location} u */
export const chromeIntentUrl = u => `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
function openInBrowser() {
  if (isAndroid) location.href = chromeIntentUrl(location);
  else if (isIOS) location.href = 'x-safari-' + location.href;   // iOS 17+: mở thẳng Safari; ứng dụng chặn thì hiện hướng dẫn bên dưới
  setTimeout(() => { if (!document.hidden) document.getElementById('bg-steps')?.removeAttribute('hidden'); }, 1200);
}
/** @param {string} name */
function browserGate(name) {
  if (document.getElementById('browser-gate')) return;
  const ov = mk('div', 'browser-gate'); ov.id = 'browser-gate'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'bg-title');
  const card = mk('div', 'bg-card');
  const logo = /** @type {HTMLImageElement} */ (mk('img', 'bg-logo')); logo.src = './icons/icon-192.png'; logo.alt = ''; logo.width = 72; logo.height = 72;
  const h = mk('h2', '', 'Mở AI Học Tập bằng trình duyệt'); h.id = 'bg-title';
  const browser = isIOS ? 'Safari' : 'Chrome';
  const p = mk('p', 'bg-lead', `Em đang mở link trong ${name}. ${browser} giúp đăng nhập ổn định, cài ứng dụng và học cả khi mất mạng.`);
  const go = btn(`Mở bằng ${browser}`, 'bg-primary', openInBrowser);
  const stay = btn('Ở lại trình duyệt hiện tại', 'bg-secondary', () => { set(sessionStorage, LS.stay, Date.now()); ov.remove(); document.body.classList.remove('browser-gate-open'); });
  const steps = mk('ol', 'bg-steps'); steps.id = 'bg-steps'; steps.hidden = true;
  const s1 = mk('li'); s1.append(mk('span', '', 'Bấm nút '), ic(I.dots), mk('b', '', ' ở góc trên bên phải.'));
  const s2 = mk('li'); s2.append(mk('span', '', 'Chọn '), mk('b', '', isIOS ? '“Mở bằng trình duyệt” hoặc “Mở trong Safari”.' : '“Mở bằng trình duyệt” (Chrome).'));
  steps.append(s1, s2);
  const copy = btn('Sao chép link', 'bg-link', () => void copyLink()); copy.prepend(ic(I.link));
  card.append(logo, h, p, go, stay, steps, copy, mk('p', 'bg-note', 'AI Học Tập giữ nguyên đúng trang em đang xem.'));
  ov.append(card); document.body.append(ov); document.body.classList.add('browser-gate-open');
  go.focus();
}

/* ---------- 2) Bảng hướng dẫn cài ---------- */
function benefits() {
  const ul = mk('ul', 'ins-benefits');
  for (const [d, t] of [[I.bolt, 'Mở nhanh từ màn hình chính'], [I.wifi, 'Học bài đã tải khi mất mạng'], [I.refresh, 'Tự cập nhật bản mới']]) { const li = mk('li'); li.append(ic(d), mk('span', '', t)); ul.append(li); }
  return ul;
}
/** @param {[string, string, string][]} rows */
function steps(rows) {
  const ol = mk('ol', 'ins-steps');
  rows.forEach(([d, a, b], i) => { const li = mk('li'); const n = mk('span', 'ins-n', String(i + 1)); const tx = mk('span', 'ins-tx'); tx.append(mk('span', '', a + ' '), mk('b', '', b)); li.append(n, tx, ic(d)); ol.append(li); });
  return ol;
}
async function promptInstall() {
  if (!deferred) return false;
  const ev = deferred; deferred = null;
  await ev.prompt();
  const r = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (r.outcome === 'accepted') { installedNow = true; set(localStorage, LS.done, Date.now()); notify('Đã cài AI Học Tập. Mở từ biểu tượng trên màn hình nhé!'); }
  render(); return true;
}
export function openGuide() {
  const dlg = /** @type {HTMLDialogElement|null} */ (document.getElementById('install-help-dialog'));
  if (!dlg) return;
  const body = /** @type {HTMLElement} */ (dlg.querySelector('.ins-body'));
  body.replaceChildren();
  const name = inAppName();
  if (isStandalone() || installedNow) {
    body.append(brandHead('Đang dùng ứng dụng'), mk('p', 'ins-ok', installedNow ? 'Đã cài xong. Em mở AI Học Tập từ biểu tượng trên màn hình.' : 'Em đang dùng AI Học Tập ở chế độ ứng dụng. Không cần cài thêm.'));
  } else if (name) {
    body.append(brandHead('Mở bằng trình duyệt để cài'), mk('p', 'ins-lead', `Trình duyệt trong ${name} không cài được ứng dụng.`), steps([[I.dots, 'Bấm nút', '⋯ ở góc trên bên phải'], [I.link, 'Chọn', isIOS ? '“Mở trong Safari”' : '“Mở bằng trình duyệt”'], [I.install, 'Bấm lại', 'Cài ứng dụng']]));
    body.append(btn(`Mở bằng ${isIOS ? 'Safari' : 'Chrome'}`, 'ins-primary', openInBrowser));
  } else if (deferred) {
    body.append(brandHead('Miễn phí · không cần kho ứng dụng'), benefits(), btn('Cài ngay', 'ins-primary', () => { void promptInstall().then(() => dlg.close()); }));
  } else if (isIOS) {
    body.append(brandHead('Cài trên iPhone / iPad bằng Safari'), benefits(), steps([[I.share, 'Bấm nút', 'Chia sẻ ở thanh dưới Safari'], [I.plus, 'Chọn', '“Thêm vào MH chính”'], [I.check, 'Bấm', '“Thêm” ở góc trên']]));
    body.append(btn('Em đã cài rồi', 'ins-secondary', () => { set(localStorage, LS.done, Date.now()); dlg.close(); render(); }));
  } else if (isAndroid) {
    body.append(brandHead('Cài trên điện thoại Android'), benefits(), steps([[I.dots, 'Mở bằng Chrome, bấm nút', '⋮ góc trên'], [I.install, 'Chọn', '“Cài đặt ứng dụng” hoặc “Thêm vào MH chính”'], [I.check, 'Bấm', '“Cài đặt”']]));
  } else {
    body.append(brandHead('Cài trên máy tính'), benefits(), steps([[I.install, 'Chrome / Edge: bấm biểu tượng', 'Cài đặt ở cuối thanh địa chỉ'], [I.dots, 'Hoặc mở menu ⋮ → ', '“Cài đặt AI Học Tập”'], [I.check, 'Bấm', '“Cài đặt”']]));
  }
  body.append(mk('p', 'ins-note', 'Bài học chỉ học offline được sau khi em đã mở/tải bài lúc có mạng.'));
  if (!dlg.open) dlg.showModal();
}

/* ---------- 3) Gợi ý cài (chỉ khi chưa cài) ---------- */
function nudgeAllowed() {
  if (isStandalone() || installedNow || inAppName() || busy()) return false;
  if (Date.now() - get(localStorage, LS.later) < 7 * DAY) return false;
  if (Date.now() - get(localStorage, LS.done) < 60 * DAY) return false;
  return Boolean(deferred) || (isIOS && /Safari/i.test(UA) && !/CriOS|FxiOS|EdgiOS/i.test(UA));
}
function nudge() {
  document.getElementById('install-nudge')?.remove();
  if (!nudgeAllowed()) return;
  const box = mk('section', 'install-nudge'); box.id = 'install-nudge'; box.setAttribute('aria-label', 'Gợi ý cài ứng dụng');
  const img = /** @type {HTMLImageElement} */ (mk('img')); img.src = './icons/icon-192.png'; img.alt = ''; img.width = 44; img.height = 44;
  const tx = mk('div', 'in-tx'); tx.append(mk('strong', '', 'Cài AI Học Tập lên máy'), mk('span', '', 'Mở nhanh, học cả khi mất mạng.'));
  const go = btn(deferred ? 'Cài' : 'Xem cách cài', 'in-go', () => { box.remove(); if (deferred) void promptInstall(); else openGuide(); });
  const later = btn('Để sau', 'in-later', () => { set(localStorage, LS.later, Date.now()); box.remove(); });
  box.append(img, tx, go, later); document.body.append(box);
}

function render() {
  const b = document.getElementById('install');
  const standalone = isStandalone();
  let label = 'Cài ứng dụng';
  if (installedNow) label = 'Đã cài ứng dụng';
  if (standalone) label = 'Đang dùng ứng dụng';
  const lab = document.getElementById('install-label'); if (lab) lab.textContent = label;
  if (b) { b.setAttribute('aria-label', label); b.title = label; b.hidden = standalone; }
}

/** @param {{notify:(msg:string, err?:boolean)=>void, busy:()=>boolean}} o */
export function init(o) {
  notify = o.notify; busy = o.busy;
  const name = inAppName();
  if (name && !isStandalone() && !get(sessionStorage, LS.stay)) browserGate(name);
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); deferred = /** @type {any} */ (ev); render(); setTimeout(nudge, 1500); });
  window.addEventListener('appinstalled', () => { deferred = null; installedNow = true; set(localStorage, LS.done, Date.now()); document.getElementById('install-nudge')?.remove(); render(); notify('Đã cài AI Học Tập. Mở từ biểu tượng trên màn hình nhé!'); });
  document.getElementById('install')?.addEventListener('click', openGuide);
  document.getElementById('close-install')?.addEventListener('click', () => /** @type {HTMLDialogElement} */ (document.getElementById('install-help-dialog')).close());
  render();
  if (isIOS) setTimeout(nudge, 2500);
}
