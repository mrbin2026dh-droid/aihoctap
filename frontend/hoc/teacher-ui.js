// @ts-check
// Khung giao diện giáo viên: menu 4 phân hệ, danh sách → chi tiết, tab, Hồ sơ/Cài đặt, lịch sử trình duyệt.
// Không gọi máy chủ. Dữ liệu và nghiệp vụ nằm ở teacher.js; tệp này chỉ điều khiển hiển thị và focus.

const TITLES = {overview: 'Tổng quan', lessons: 'Soạn bài', exams: 'Về nhà', sheetexam: 'Thi', materials: 'Tài liệu', accounts: 'Tài khoản', effect: 'Hiệu quả', tools: 'Tiện ích'};
const PANEL_TITLES = {pin: 'Đổi mã PIN', ai: 'Gia sư AI và hạn mức', keys: 'Khóa API'};

/** @type {() => Promise<boolean>} */
let guard = async () => true;
let view = 'overview';
let sub = 'list-overview';
let screen = 'work';           // 'work' | 'settings'
let panel = 'pin';
let ready = false;

/** @param {string} id */
const byId = id => document.getElementById(id);
/** @param {string} v */
const viewEl = v => byId('view-' + v);

/** @param {string} id */
function focusHeading(id) {
  const root = byId(id);
  const target = /** @type {HTMLElement|null} */ (root?.matches('h1,h2,h3') ? root : root?.querySelector('h2,h3'));
  if (target) { target.tabIndex = -1; target.focus({preventScroll: false}); }
}

function renderNav() {
  for (const item of document.querySelectorAll('.t-nav-item')) {
    const b = /** @type {HTMLElement} */ (item);
    if (screen === 'work' && b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const h1 = byId('workspace-title');
  if (h1) h1.textContent = TITLES[/** @type {keyof typeof TITLES} */ (view)] || '';
  renderMobileGroups();
}

/* Điện thoại: thanh dưới chỉ giữ 5 mục; mục cùng tính năng gộp thành thanh con, Tài khoản lên biểu tượng cạnh bánh răng.
   Lối vào mới luôn bấm hộ NÚT GỐC (#nav-…) để giữ nguyên việc nạp dữ liệu của từng mục. Máy tính không đổi. */
const MOBILE_GROUPS = /** @type {Record<string, [string, string][]>} */ ({
  lessons: [['lessons', 'Soạn bài'], ['materials', 'Tài liệu']],
  sheetexam: [['sheetexam', 'Thi'], ['exams', 'Về nhà']]
});
const GROUP_OF = /** @type {Record<string, string>} */ ({ lessons: 'lessons', materials: 'lessons', sheetexam: 'sheetexam', exams: 'sheetexam' });
function renderMobileGroups() {
  const classTeacher = document.body.classList.contains('is-class-teacher');   // giáo viên lớp: không có Soạn bài, Về nhà → không gộp
  const leader = screen === 'work' && !classTeacher ? GROUP_OF[view] : '';
  for (const item of document.querySelectorAll('.t-nav-item')) {
    const b = /** @type {HTMLElement} */ (item);
    b.classList.toggle('is-group-current', Boolean(leader) && b.dataset.view === leader && b.dataset.view !== view);
  }
  const acc = byId('hdr-accounts');
  if (acc) { if (screen === 'work' && view === 'accounts') acc.setAttribute('aria-current', 'page'); else acc.removeAttribute('aria-current'); }
  const bar = byId('t-subtabs');
  if (!bar) return;
  const group = leader ? MOBILE_GROUPS[leader] : null;
  bar.hidden = !group;
  if (!group) { bar.replaceChildren(); return; }
  bar.replaceChildren(...group.map(([v, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 't-subtab'; b.textContent = label; b.dataset.goto = 'nav-' + v;
    if (v === view) b.setAttribute('aria-current', 'page');
    return b;
  }));
}

function renderSub() {
  for (const v of Object.keys(TITLES)) {
    const root = viewEl(v);
    if (!root) continue;
    root.hidden = screen !== 'work' || v !== view;
    if (root.hidden) continue;
    for (const section of root.querySelectorAll(':scope > section[id^="list-"], :scope > section[id^="detail-"], :scope > section > section[id^="list-"], :scope > section > section[id^="detail-"]')) {
      /** @type {HTMLElement} */ (section).hidden = section.id !== sub;
    }
  }
  const workspace = byId('workspace');
  const settings = byId('settings');
  if (workspace) workspace.hidden = screen !== 'work';
  if (settings) settings.hidden = screen !== 'settings';
}

function renderSettings() {
  const title = byId('settings-title');
  for (const p of document.querySelectorAll('[data-profile-panel]')) {
    const section = /** @type {HTMLElement} */ (p);
    section.hidden = section.dataset.profilePanel !== panel;
  }
  if (title) title.textContent = 'Hồ sơ: ' + (PANEL_TITLES[/** @type {keyof typeof PANEL_TITLES} */ (panel)] || '');
}

/** Đồng bộ toàn bộ hiển thị với trạng thái. */
function render(focusId = '') {
  renderNav(); renderSub(); if (screen === 'settings') renderSettings();
  if (focusId) focusHeading(focusId);
}

/** @param {string} v @param {{focus?: boolean, push?: boolean}} [o] */
export async function showView(v, o = {}) {
  if (!(v in TITLES)) return false;
  if ((v !== view || screen !== 'work' || sub !== 'list-' + v) && !(await guard())) return false;
  view = v; sub = 'list-' + v; screen = 'work';
  render(o.focus === false ? '' : 'workspace-title');
  return true;
}

/** @param {string} id @param {{push?: boolean}} [o] */
export async function showSub(id, o = {}) {
  if (screen !== 'work') screen = 'work';
  const isDetail = id.startsWith('detail-');
  if (!isDetail && sub !== id && !(await guard())) return false;
  const root = byId(id);
  if (!root) return false;
  const v = Object.keys(TITLES).find(k => viewEl(k)?.contains(root));
  if (v) view = v;
  sub = id;
  if (isDetail && o.push !== false) history.pushState({teacher: 1}, '');
  render(id);
  window.scrollTo(0, 0);
  return true;
}

/** @param {string} p */
export async function openSettings(p) {
  if (!(p in PANEL_TITLES)) return;
  if (screen === 'work' && !(await guard())) return;
  const wasSettings = screen === 'settings';
  panel = p; screen = 'settings';
  if (!wasSettings) history.pushState({teacher: 1, settings: 1}, '');
  render('settings-title');
  window.scrollTo(0, 0);
}

export async function closeSettings() {
  if (screen !== 'settings') return true;
  screen = 'work';
  render('workspace-title');
  return true;
}

/** Quay về màn danh sách của phân hệ hiện tại, hoặc ra khỏi Cài đặt. Trả true nếu đã xử lý. */
export async function goBack() {
  if (screen === 'settings') { return closeSettings(); }
  if (sub.startsWith('detail-')) {
    if (!(await guard())) return false;
    sub = 'list-' + view;
    render(sub);
    return true;
  }
  return false;
}

export function reset() {
  view = 'overview'; sub = 'list-overview'; screen = 'work'; panel = 'pin';
  render();
}

export function current() { return {view, sub, screen, panel}; }

/** @param {{guard?: () => Promise<boolean>}} [options] */
export function init(options = {}) {
  if (ready) return;
  ready = true;
  if (options.guard) guard = options.guard;
  decorateIcons();
  render();

  document.addEventListener('click', event => {
    const target = /** @type {HTMLElement|null} */ (event.target instanceof Element ? event.target : null);
    const btn = /** @type {HTMLElement|null} */ (target?.closest('button,[data-view]'));
    if (!btn) return;
    if (btn.classList.contains('t-nav-item') && btn.dataset.view) { void showView(btn.dataset.view); return; }
    if (btn.dataset.goto && (btn.classList.contains('t-subtab'))) { if (btn.getAttribute('aria-current') !== 'page') byId(btn.dataset.goto)?.click(); return; }
    if (btn.id === 'hdr-accounts') { byId('nav-accounts')?.click(); return; }
    const action = btn.dataset.action || '';
    if (action.startsWith('back-') && btn.dataset.target) { void goBack(); return; }
    if (action === 'new-exams' || action === 'edit-exam') { void showSub('detail-exams'); return; }
    if (action === 'monitor-exam') { void showSub('detail-exams-monitor'); return; }
    if (action === 'stats-exam') { void showSub('detail-exams-stats'); return; }
    if (action === 'new-materials') { void showSub('detail-materials'); return; }
    if (action === 'new-accounts') { void showSub('detail-accounts'); return; }
    if (action === 'import-accounts') { void showSub('detail-accounts-import'); return; }
    if (action === 'close-settings') { void closeSettings(); return; }
    if (action.startsWith('profile-')) {
      const menu = /** @type {HTMLElement & {hidePopover?: () => void}|null} */ (byId('nav-profile'));
      try { menu?.hidePopover?.(); } catch { /* popover đã đóng */ }
      void openSettings(action.slice('profile-'.length));
    }
  });

  // Tab: mũi tên, Home, End; chỉ tab đang chọn nằm trong thứ tự Tab (roving tabindex).
  document.addEventListener('keydown', event => {
    const tab = /** @type {HTMLElement|null} */ (event.target instanceof Element ? event.target.closest('[role=tab]') : null);
    if (!tab) return;
    const list = /** @type {HTMLElement|null} */ (tab.closest('[role=tablist]'));
    if (!list) return;
    const tabs = /** @type {HTMLElement[]} */ ([...list.querySelectorAll('[role=tab]')]);
    const index = tabs.indexOf(tab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });

  document.addEventListener('click', event => {
    const tab = /** @type {HTMLElement|null} */ (event.target instanceof Element ? event.target.closest('[role=tab]') : null);
    if (!tab) return;
    const list = /** @type {HTMLElement|null} */ (tab.closest('[role=tablist]'));
    if (!list) return;
    for (const t of /** @type {HTMLElement[]} */ ([...list.querySelectorAll('[role=tab]')])) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      const panelId = t.getAttribute('aria-controls');
      const panelEl = panelId ? byId(panelId) : null;
      if (panelEl) panelEl.hidden = !selected;
    }
  });

  window.addEventListener('popstate', () => {
    if (screen === 'settings') { screen = 'work'; render(); return; }
    if (sub.startsWith('detail-')) {
      void (async () => {
        if (!(await guard())) { history.pushState({teacher: 1}, ''); return; }
        sub = 'list-' + view; render(sub);
      })();
    }
  });

}

const ICONS = {
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  viewoff: 'M3 3l18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.1 3.8 M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.4 9.4 0 0 0 5.4-1.6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z M14 6l4 4',
  key: 'M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M11.5 11H21 M18 11v3 M15 11v2',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 7.5-1.5',
  trash: 'M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13 M10 11v6 M14 11v6',
  monitor: 'M3 12h4l3-8 4 16 3-8h4',
  stats: 'M5 20V10 M12 20V4 M19 20v-7',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2',
  plus: 'M12 5v14 M5 12h14',
  play: 'M8 5v14l11-7z',
  retry: 'M4 12a8 8 0 1 1 3 6.3 M4 19v-5h5'
};
/** Vẽ biểu tượng (SVG đường nét) vào nút có data-icon; chữ thay thế nằm ở aria-label và title.
 * @param {ParentNode} [root] */
export function decorateIcons(root = document) {
  for (const node of root.querySelectorAll('button[data-icon]')) {
    const btn = /** @type {HTMLElement} */ (node);
    if (btn.querySelector('svg')) continue;
    const path = ICONS[/** @type {keyof typeof ICONS} */ (btn.dataset.icon || '')];
    if (!path) continue;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const d = document.createElementNS('http://www.w3.org/2000/svg', 'path'); d.setAttribute('d', path);
    svg.append(d); btn.textContent = ''; btn.append(svg);
  }
}
/** Nút biểu tượng 48×48 có tên truy cập và gợi ý.
 * @param {{icon: keyof typeof ICONS, label: string, danger?: boolean, onClick: () => void}} o */
export function iconButton({icon, label, danger = false, onClick}) {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 't-icon-btn' + (danger ? ' t-danger' : '');
  btn.dataset.icon = icon; btn.setAttribute('aria-label', label); btn.title = label;
  btn.addEventListener('click', onClick);
  decorateIcons(/** @type {any} */ ({querySelectorAll: () => [btn]}));
  return btn;
}

/** Dòng "Đang hiện 50/1000 · Hiện thêm" ngay sau bảng (bảng dài không vẽ hết một lúc → không treo trình duyệt).
 * @param {HTMLElement} table @param {number} shown @param {number} total @param {() => void} onMore */
export function moreRows(table, shown, total, onMore) {
  let box = /** @type {HTMLElement|null} */ (table.nextElementSibling);
  if (!box || !box.classList.contains('t-more')) { box = document.createElement('div'); box.className = 't-more'; table.after(box); }
  box.replaceChildren(); box.hidden = total <= shown;
  if (box.hidden) return;
  const p = document.createElement('p'); p.className = 't-muted'; p.textContent = `Đang hiện ${shown}/${total}`;
  const b = document.createElement('button'); b.type = 'button'; b.className = 't-button'; b.textContent = `Hiện thêm ${Math.min(PAGE, total - shown)}`;
  b.addEventListener('click', onMore);
  box.append(p, b);
}
/** Số dòng mỗi lần vẽ bảng dài. */
export const PAGE = 50;
/** Chạy fn sau khi ngừng gõ ms mili giây. @param {() => void} fn @param {number} [ms] */
export function debounce(fn, ms = 180) { let t = 0; return () => { clearTimeout(t); t = window.setTimeout(fn, ms); }; }

/** Chuyển nút chữ có sẵn thành nút biểu tượng (giữ nguyên trình xử lý).
 * @param {HTMLButtonElement} btn @param {keyof typeof ICONS} icon @param {string} label @param {boolean} [danger] */
export function toIcon(btn, icon, label, danger = false) {
  btn.className = 't-icon-btn' + (danger ? ' t-danger' : '');
  btn.dataset.icon = icon; btn.setAttribute('aria-label', label); btn.title = label;
  decorateIcons(/** @type {any} */ ({querySelectorAll: () => [btn]}));
  return btn;
}
