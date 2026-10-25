// @ts-check
// Khung giao diện giáo viên: menu 4 phân hệ, danh sách → chi tiết, tab, Hồ sơ/Cài đặt, lịch sử trình duyệt.
// Không gọi máy chủ. Dữ liệu và nghiệp vụ nằm ở teacher.js; tệp này chỉ điều khiển hiển thị và focus.

const TITLES = {lessons: 'Soạn bài', exams: 'Kiểm tra', materials: 'Tài liệu', accounts: 'Tài khoản học sinh'};
const PANEL_TITLES = {pin: 'Đổi mã PIN', ai: 'Gia sư AI và hạn mức', keys: 'Khóa API'};

/** @type {() => Promise<boolean>} */
let guard = async () => true;
let view = 'lessons';
let sub = 'list-lessons';
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
  view = 'lessons'; sub = 'list-lessons'; screen = 'work'; panel = 'pin';
  render();
}

export function current() { return {view, sub, screen, panel}; }

/** @param {{guard?: () => Promise<boolean>}} [options] */
export function init(options = {}) {
  if (ready) return;
  ready = true;
  if (options.guard) guard = options.guard;
  render();

  document.addEventListener('click', event => {
    const target = /** @type {HTMLElement|null} */ (event.target instanceof Element ? event.target : null);
    const btn = /** @type {HTMLElement|null} */ (target?.closest('button,[data-view]'));
    if (!btn) return;
    if (btn.classList.contains('t-nav-item') && btn.dataset.view) { void showView(btn.dataset.view); return; }
    const action = btn.dataset.action || '';
    if (action.startsWith('back-') && btn.dataset.target) { void goBack(); return; }
    if (action === 'new-exams' || action === 'edit-exam') { void showSub('detail-exams'); return; }
    if (action === 'monitor-exam') { void showSub('detail-exams-monitor'); return; }
    if (action === 'stats-exam') { void showSub('detail-exams-stats'); return; }
    if (action === 'new-materials') { void showSub('detail-materials'); return; }
    if (action === 'new-accounts') { void showSub('detail-accounts'); return; }
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

  // "Thao tác" của mỗi dòng mở hộp thoại thay cho menu thả xuống trong bảng.
  document.addEventListener('click', event => {
    const summary = /** @type {HTMLElement|null} */ (event.target instanceof Element ? event.target.closest('details.row-actions > summary') : null);
    if (!summary) return;
    event.preventDefault();
    if (summary.getAttribute('aria-disabled') === 'true') return;
    const details = /** @type {HTMLDetailsElement} */ (summary.parentElement);
    openActionDialog(details, summary);
  });

  document.addEventListener('toggle', e => {
    const target = /** @type {HTMLDetailsElement|null} */ (e.target instanceof HTMLDetailsElement ? e.target : null);
    if (target?.matches('.row-actions[open]')) {
      for (const d of document.querySelectorAll('.row-actions[open]')) if (d !== target) /** @type {HTMLDetailsElement} */ (d).open = false;
    }
  }, true);
}

/** @param {HTMLDetailsElement} details @param {HTMLElement} summary */
function openActionDialog(details, summary) {
  const sources = /** @type {HTMLButtonElement[]} */ ([...details.querySelectorAll('.action-list button')]);
  if (!sources.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 't-dialog t-action-dialog';
  const label = (summary.textContent || 'Thao tác').replace(/\s+/g, ' ').trim();
  const title = document.createElement('h2'); title.id = 'action-dialog-title'; title.textContent = label;
  dialog.setAttribute('aria-labelledby', title.id);
  const list = document.createElement('div'); list.className = 't-action-menu';
  const close = () => { dialog.close(); dialog.remove(); summary.focus?.(); };
  for (const source of sources) {
    const choice = document.createElement('button');
    choice.type = 'button'; choice.className = 't-button' + (source.classList.contains('danger') ? ' t-danger' : '');
    choice.textContent = source.textContent;
    choice.disabled = source.disabled;
    choice.addEventListener('click', () => { close(); source.click(); });
    list.append(choice);
  }
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 't-button'; cancel.textContent = 'Đóng';
  cancel.addEventListener('click', close);
  const actions = document.createElement('div'); actions.className = 't-dialog-actions'; actions.append(cancel);
  dialog.append(title, list, actions);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  document.body.append(dialog);
  dialog.showModal();
  /** @type {HTMLElement} */ (list.querySelector('button:not(:disabled)') || cancel).focus();
}
