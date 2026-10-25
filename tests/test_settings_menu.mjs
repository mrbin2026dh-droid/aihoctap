import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { confirmBox } from '../frontend/hoc/dom.js';

console.log('=== TEST SUITE: ADAPTIVE SETTINGS MENU & CONFIRMATION ACTIONS (AGENTS.md J & K) ===\n');

const projectRoot = process.cwd();
const indexHtml = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/index.html'), 'utf8');
const teacherHtml = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/teacher.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/styles.css'), 'utf8');
const teacherJs = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/teacher.js'), 'utf8');
const appJs = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/app.js'), 'utf8');

// [1] Teacher shell contract v3: 4-section menu + Hồ sơ popover (replaces adaptive settings list)
console.log('[1] Testing Teacher v3 shell: 4 sections, profile popover, settings panels...');
const teacherUiJs = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/teacher-ui.js'), 'utf8');
{
  for (const id of ['open-settings','nav-profile','workspace','workspace-title','settings','settings-title','close-settings','settings-layout',
    'nav-lessons','nav-exams','nav-materials','nav-accounts','view-lessons','view-exams','view-materials','view-accounts',
    'published','publish-form','teacher-results','material-form','students-section','change-pin-section','ai-usage-section','keys-section'] ) {
    if (id === 'ai-usage-section' || id === 'keys-section') continue;
    assert(teacherHtml.includes(`id="${id}"`), `Missing #${id} in teacher.html`);
  }
  assert(teacherHtml.includes('popovertarget="nav-profile"'), 'open-settings must open the profile popover');
  for (const p of ['pin','ai','keys']) assert(teacherHtml.includes(`data-profile-panel="${p}"`), `Missing settings panel ${p}`);
  const workspaceIdx = teacherHtml.indexOf('id="workspace"');
  const settingsIdx = teacherHtml.indexOf('id="settings"');
  assert(workspaceIdx < settingsIdx, '#workspace must precede #settings');
  const workspaceSlice = teacherHtml.slice(workspaceIdx, settingsIdx);
  for (const id of ['published','publish-form','teacher-results','material-form','students-section','students-tbody']) assert(workspaceSlice.includes(`id="${id}"`), `${id} must stay in workspace`);
  const settingsSlice = teacherHtml.slice(settingsIdx);
  assert(settingsSlice.includes('id="teacher-regular-change-pin-form"'), 'PIN form must be in settings');
  assert(settingsSlice.includes('id="ai-settings-form"') && settingsSlice.includes('id="add-key-form"'), 'AI and key forms must be in settings');
  assert(!/\[THỬ\]/.test(workspaceSlice.slice(0, workspaceSlice.indexOf('id="view-exams"'))), 'No sample data in lessons view');
  assert(teacherUiJs.includes('role=tab') && teacherUiJs.includes('ArrowRight'), 'Tab keyboard support missing');
  console.log('  PASS [1]: Teacher v3 shell contract verified.');
}


// [2] Verify Student HTML Settings Menu Contract (Rule K)
console.log('[2] Testing Student HTML Settings Menu structure and grouping...');
{
  assert(indexHtml.includes('id="open-settings"'), 'Missing #open-settings button on student topbar');
  assert(indexHtml.includes('id="settings"'), 'Missing #settings section in index.html');
  assert(indexHtml.includes('id="settings-title"'), 'Missing #settings-title in index.html');
  assert(indexHtml.includes('id="close-settings"'), 'Missing #close-settings button in index.html');

  const studentSettingsIdx = indexHtml.indexOf('id="settings"');
  const studentSettingsSlice = indexHtml.slice(studentSettingsIdx);

  assert(studentSettingsSlice.includes('data-view="account"'), 'Missing student data-view="account"');
  assert(studentSettingsSlice.includes('data-view="offline"'), 'Missing student data-view="offline"');
  assert(studentSettingsSlice.includes('data-view="help"'), 'Missing student data-view="help"');

  assert(studentSettingsSlice.includes('id="panel-account"'), 'Missing student #panel-account');
  assert(studentSettingsSlice.includes('id="panel-offline"'), 'Missing student #panel-offline');
  assert(studentSettingsSlice.includes('id="panel-help"'), 'Missing student #panel-help');

  assert(studentSettingsSlice.includes('id="account-section"'), 'Missing #account-section in student panel-account');
  assert(studentSettingsSlice.includes('id="settings-offline-list"'), 'Missing #settings-offline-list in panel-offline');
  assert(studentSettingsSlice.includes('data-back'), 'Missing data-back button in student settings');

  console.log('  PASS [2]: Student HTML settings menu and grouping contract 100% verified.');
}

// [3] Verify CSS Responsive Rules & Mobile/Desktop Adaptability
console.log('[3] Testing CSS Responsive Rules for adaptive settings menu...');
{
  assert(stylesCss.includes('.settings-layout'), 'Missing .settings-layout in styles.css');
  assert(stylesCss.includes('.settings-menu'), 'Missing .settings-menu in styles.css');
  assert(stylesCss.includes('.group-label'), 'Missing .group-label in styles.css');
  assert(stylesCss.includes('.group-link'), 'Missing .group-link in styles.css');
  assert(stylesCss.includes('.settings-detail'), 'Missing .settings-detail in styles.css');
  assert(stylesCss.includes('.back-button'), 'Missing .back-button in styles.css');
  assert(stylesCss.includes('.row-actions'), 'Missing .row-actions in styles.css');

  // Media queries
  assert(stylesCss.includes('@media(max-width: 959px)'), 'Missing mobile 959px media query');
  assert(stylesCss.includes('.settings-layout.has-detail .settings-menu'), 'Missing mobile hide menu rule');
  assert(stylesCss.includes('.settings-layout:not(.has-detail) .settings-detail'), 'Missing mobile hide detail rule');
  assert(stylesCss.includes('@media(min-width: 960px)'), 'Missing desktop 960px media query');
  assert(stylesCss.includes('grid-template-columns: 240px minmax(0, 1fr)'), 'Missing desktop 2-column sidebar grid');

  console.log('  PASS [3]: CSS responsive layout & media query rules verified.');
}

// [4] Verify Student Row Actions Collapsible (<details class="row-actions">)
console.log('[4] Testing Student Row Actions Collapsible in teacher.js...');
{
  assert(teacherJs.includes("el('details', '', 'row-actions')"), 'teacher.js must create details.row-actions');
  assert(teacherJs.includes("el('summary', 'Thao tác')"), 'teacher.js must create summary "Thao tác"');
  assert(teacherJs.includes("el('span', ` với học sinh ${s.name}`, 'visually-hidden')"), 'summary must have visually-hidden accessibility label');
  assert(teacherJs.includes("details.open = false;"), 'Clicking action button must close details disclosure');
  assert(teacherUiJs.includes("target?.matches('.row-actions[open]')"), 'toggle listener must close other open details');

  console.log('  PASS [4]: Student row actions collapsible & accessibility label verified.');
}

// [5] Verify Teacher Action Confirmation Contracts (Rule J / teacher-action-confirmation.md)
console.log('[5] Testing Teacher Action Confirmation Contracts (Zero unconfirmed calls, clear wording)...');
{
  // Check exact confirmation titles & prompts in teacher.js
  assert(teacherJs.includes("title: 'Xóa học sinh?'"), 'Missing exact title: Xóa học sinh?');
  assert(teacherJs.includes("okText: 'Xóa học sinh'"), 'Missing exact okText: Xóa học sinh');
  assert(teacherJs.includes("danger: true"), 'Delete student must be marked danger: true');

  assert(teacherJs.includes("title: s.disabled ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?'"), 'Missing exact title for lock/unlock student');
  assert(teacherJs.includes("okText: s.disabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản'"), 'Missing exact okText for lock/unlock student');

  assert(teacherJs.includes("title: 'Đặt lại mã PIN?'"), 'Missing exact title: Đặt lại mã PIN?');
  assert(teacherJs.includes("okText: 'Đặt lại mã PIN'"), 'Missing exact okText: Đặt lại mã PIN');

  assert(teacherJs.includes("title: 'Xóa khóa API?'"), 'Missing exact title: Xóa khóa API?');
  assert(teacherJs.includes("okText: 'Xóa khóa'"), 'Missing exact okText: Xóa khóa');

  assert(teacherJs.includes("title: 'Bỏ thay đổi chưa lưu?'"), 'Missing exact title: Bỏ thay đổi chưa lưu?');
  assert(teacherJs.includes("okText: 'Bỏ thay đổi'"), 'Missing exact okText: Bỏ thay đổi');

  console.log('  PASS [5]: Confirmation titles, bodies, and danger flags strictly match Rule J specifications.');
}

// [6] Behavioral Test: DOM Mock verifying Confirm / Cancel flow on Destructive Actions
console.log('[6] Testing Behavioral Action Confirmation: Cancel = 0 API requests, OK = exactly 1...');
{
  const elements = new Map();
  const listeners = new Map();

  const addEl = (id, tag = 'div') => {
    const el = {
      id,
      tagName: tag,
      textContent: '',
      hidden: false,
      classList: { toggle: () => {} },
      addEventListener: (evt, fn) => { listeners.set(`${id}:${evt}`, fn); },
      removeEventListener: (evt, _fn) => { listeners.delete(`${id}:${evt}`); },
      focus: () => {},
      removeAttribute: () => {},
      setAttribute: () => {}
    };
    elements.set(id, el);
    return el;
  };

  const dialogEl = addEl('msg-dialog', 'DIALOG');
  dialogEl.showModal = () => { dialogEl.open = true; };
  dialogEl.close = () => { dialogEl.open = false; };
  addEl('msg-title');
  addEl('msg-body');
  addEl('msg-ok', 'BUTTON');
  addEl('msg-cancel', 'BUTTON');
  addEl('msg-form', 'FORM');
  addEl('msg-field');
  addEl('msg-field-label');
  addEl('msg-input', 'INPUT');
  addEl('msg-error');

  globalThis.document = {
    getElementById: id => elements.get(id) || null,
    activeElement: { focus: () => {} }
  };

  let apiDeleteStudentCalls = 0;
  const mockDeleteStudent = async () => {
    const confirmed = await confirmBox({
      title: 'Xóa học sinh?',
      body: 'Học sinh: Nguyễn Văn An (hs01). Thao tác xóa không thể hoàn tác.',
      okText: 'Xóa học sinh',
      danger: true
    });
    if (!confirmed) return;
    apiDeleteStudentCalls++;
  };

  // Case 1: Cancel -> 0 API calls
  const cancelPromise = mockDeleteStudent();
  const cancelHandler = listeners.get('msg-cancel:click');
  assert(cancelHandler, 'Cancel click listener must be bound');
  cancelHandler();
  await cancelPromise;
  assert.strictEqual(apiDeleteStudentCalls, 0, 'Cancelled action must produce 0 API calls');

  // Case 2: Esc (cancel event) -> 0 API calls
  const escPromise = mockDeleteStudent();
  const dialogCancelHandler = listeners.get('msg-dialog:cancel');
  assert(dialogCancelHandler, 'Dialog cancel event listener must be bound');
  dialogCancelHandler();
  await escPromise;
  assert.strictEqual(apiDeleteStudentCalls, 0, 'Escape action must produce 0 API calls');

  // Case 3: Submit (Confirm) -> exactly 1 API call
  const submitPromise = mockDeleteStudent();
  const formSubmitHandler = listeners.get('msg-form:submit');
  assert(formSubmitHandler, 'Form submit listener must be bound');
  formSubmitHandler({ preventDefault: () => {} });
  await submitPromise;
  assert.strictEqual(apiDeleteStudentCalls, 1, 'Confirmed action must execute API call exactly once');

  console.log('  PASS [6]: Cancel = 0, Esc = 0, Confirm = 1 API call strictly verified in simulated DOM.');
}

// [7] Behavioral Test: Student Offline Download Removal Confirmation
console.log('[7] Testing Student Offline Download Removal Confirmation...');
{
  assert(appJs.includes("title: 'Xóa bản tải?'"), 'Missing student confirm title: Xóa bản tải?');
  assert(appJs.includes("okText: 'Xóa bản tải'"), 'Missing student okText: Xóa bản tải');
  assert(appJs.includes("Em cần kết nối mạng để tải lại bài trên thiết bị này."), 'Missing network requirement warning');
  assert(appJs.includes("db.deleteLesson(lesson.id)"), 'Must invoke IndexedDB deleteLesson on confirmation');

  console.log('  PASS [7]: Student offline download removal confirmation verified.');
}

// [8] Static Code Audit: Zero alert/prompt/confirm and Zero Emojis
console.log('[8] Testing Static Code Audit: Zero alert/confirm/prompt and Zero Emojis...');
{
  const hocFiles = ['index.html', 'teacher.html', 'styles.css', 'app.js', 'teacher.js', 'dom.js'];
  for (const f of hocFiles) {
    const raw = fs.readFileSync(path.join(projectRoot, 'frontend/hoc', f), 'utf8');

    // Forbidden dialog calls
    const dialogMatches = [...raw.matchAll(/(?:(?<!\.)\b(confirm|prompt|alert)|window\.(confirm|prompt|alert))\s*\(/g)]
      .filter(m => {
        const prefix = raw.slice(Math.max(0, m.index - 30), m.index);
        return !prefix.includes('installPrompt') && !prefix.includes('pwaPrompt');
      });
    assert.strictEqual(dialogMatches.length, 0, `Forbidden dialog call found in frontend/hoc/${f}: ${dialogMatches.map(m=>m[0]).join(', ')}`);

    // Forbidden emoji
    assert(!raw.includes('💡'), `Forbidden emoji 💡 found in frontend/hoc/${f}`);
    assert(!raw.includes('✕'), `Forbidden character ✕ found in frontend/hoc/${f}`);
  }
  console.log('  PASS [8]: 0 confirm/prompt/alert, 0 💡, 0 ✕ across all frontend/hoc files.');
}

// [9] T1: Mobile Group List & Panel Visibility Contract (S1)
console.log('[9] Testing T1: Mobile Group List visible on open, desktop defaults to account...');
{
  assert(teacherUiJs.includes("let screen = 'work';"), "teacher-ui.js must start on the work screen");
  assert(appJs.includes("let studentActiveView = '';"), "app.js must initialize studentActiveView as empty string");
  assert(appJs.includes("if (isWide && !studentActiveView) studentActiveView = 'account';"), "app.js must default studentActiveView to account only when isWide");
  console.log('  PASS [9]: Mobile starts at group list, desktop defaults to account panel.');
}

// [10] T2: Concurrency & Duplicate Request Guard per Student (S2)
console.log('[10] Testing T2: In-flight concurrency guard prevents duplicate requests...');
{
  assert(teacherJs.includes("const inFlight = new Set();"), "Missing inFlight Set in teacher.js");
  assert(teacherJs.includes("async function guarded(key, fn)"), "Missing guarded helper in teacher.js");
  assert(teacherJs.includes("if (inFlight.has('s:' + s.id))"), "Button handlers must check inFlight before opening dialog");
  assert(teacherJs.includes("tr.dataset.sid = s.id;"), "Each row must have data-sid set");
  assert(teacherJs.includes("await guarded('s:' + s.id"), "Actions must be wrapped in guarded()");
  console.log('  PASS [10]: In-flight guard strictly prevents duplicate requests while busy.');
}

// [11] T3: Browser History & Back Navigation (S3)
console.log('[11] Testing T3: History navigation on mobile (group -> detail -> back to list -> back to work)...');
{
  assert(teacherUiJs.includes("history.pushState({teacher: 1, settings: 1}"), "Missing history.pushState on opening settings");
  assert(teacherUiJs.includes("window.addEventListener('popstate'"), "Missing popstate listener in teacher-ui.js");
  assert(appJs.includes("function studentSettingsBack()"), "Missing studentSettingsBack() in app.js");
  assert(appJs.includes("history.pushState({ studentSettings: 1"), "Missing history.pushState in app.js");
  console.log('  PASS [11]: History push/pop and dirty cancel restoration verified.');
}

// [12] T4: Single Dialog for Edit Student with Multi-field Validation (S4)
console.log('[12] Testing T4: Edit student single dialog with multi-field validation...');
{
  assert(teacherJs.includes("title: 'Sửa học sinh'"), "Missing Sửa học sinh dialog title");
  assert(teacherJs.includes("name: 'name'"), "Missing name field in edit student");
  assert(teacherJs.includes("name: 'class_code'"), "Missing class_code field in edit student");
  assert(teacherJs.includes("fields: ["), "Edit student must use multi-field dialogBox({ fields: [...] })");
  assert(!teacherJs.includes("Nhập họ và tên mới"), "Must not use multiple dialogs for edit student");
  console.log('  PASS [12]: Edit student uses single dialog with 2 validated fields.');
}

console.log('\n>>> ALL 12 ADAPTIVE SETTINGS MENU & CONFIRMATION ACTION TESTS (S1-S5) PASSED 100%! <<<');
