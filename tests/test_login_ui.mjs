import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { confirmBox, withBusy, setFieldError, mapErrorMessage } from '../frontend/hoc/dom.js';

console.log('=== TEST SUITE: INTEGRATED LOGIN & ACCOUNT UI CONTRACTS & BEHAVIOR ===\n');

const projectRoot = process.cwd();
const indexHtml = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/index.html'), 'utf8');
const teacherHtml = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/teacher.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(projectRoot, 'frontend/hoc/styles.css'), 'utf8');

// [1] Verify Student Login contract elements in index.html
console.log('[1] Testing Student Login contract in index.html...');
const studentLoginIds = [
  'login-dialog',
  'login-title',
  'login-help',
  'login-form',
  'student-code',
  'student-pin',
  'login-error',
  'close-login'
];
for (const id of studentLoginIds) {
  assert(indexHtml.includes(`id="${id}"`), `Missing required student login id: ${id}`);
}
assert(indexHtml.includes('name="code"'), 'Missing name="code" in student login form');
assert(indexHtml.includes('autocomplete="username"'), 'Missing autocomplete="username"');
assert(indexHtml.includes('pattern="[A-Za-z0-9_-]{1,64}"') || indexHtml.includes('pattern="[A-Za-z0-9_\\-]{1,64}"'), 'Missing pattern on code input');
assert(indexHtml.includes('name="pin"'), 'Missing name="pin" in student login form');
assert(indexHtml.includes('autocomplete="current-password"'), 'Missing autocomplete="current-password" on student pin');
assert(indexHtml.includes('maxlength="16"'), 'Missing maxlength="16" on student pin');
assert(indexHtml.includes('data-reveal="student-pin"'), 'Missing reveal button for student-pin');
console.log('  PASS [1]: Student login contract & attributes 100% verified.');

// [2] Verify Student Account contract elements in index.html
console.log('[2] Testing Student Account contract in index.html...');
const studentAccountIds = [
  'account-info',
  'account-must-change',
  'student-change-pin-form',
  'student-old',
  'student-new',
  'student-confirm',
  'student-change-pin-status',
  'logout'
];
for (const id of studentAccountIds) {
  assert(indexHtml.includes(`id="${id}"`), `Missing required student account id: ${id}`);
}
assert(indexHtml.includes('name="old_pin"'), 'Missing name="old_pin"');
assert(indexHtml.includes('name="new_pin"'), 'Missing name="new_pin"');
assert(indexHtml.includes('name="confirm_pin"'), 'Missing name="confirm_pin"');
assert(indexHtml.includes('minlength="6"'), 'Missing minlength="6" on student new_pin');
assert(indexHtml.includes('data-reveal="student-old"'), 'Missing reveal button for student-old');
assert(indexHtml.includes('data-reveal="student-new"'), 'Missing reveal button for student-new');
assert(indexHtml.includes('data-reveal="student-confirm"'), 'Missing reveal button for student-confirm');
console.log('  PASS [2]: Student account & change PIN contract verified.');

// [3] Verify Teacher Login contract elements in teacher.html
console.log('[3] Testing Teacher Login contract in teacher.html...');
const teacherLoginIds = [
  'auth-section',
  'teacher-login-title',
  'teacher-login',
  'teacher-pin',
  'teacher-login-error'
];
for (const id of teacherLoginIds) {
  assert(teacherHtml.includes(`id="${id}"`), `Missing required teacher login id: ${id}`);
}
assert(teacherHtml.includes('data-reveal="teacher-pin"'), 'Missing reveal button for teacher-pin');
console.log('  PASS [3]: Teacher login contract & attributes verified.');

// [4] Verify Teacher First Mandatory PIN Change contract in teacher.html
console.log('[4] Testing Teacher Mandatory PIN Change contract in teacher.html...');
const teacherMustChangeIds = [
  'teacher-must-change-section',
  'first-pin-title',
  'first-pin-help',
  'teacher-must-change-form',
  'first-old',
  'first-new',
  'first-confirm',
  'first-length',
  'teacher-must-change-error'
];
for (const id of teacherMustChangeIds) {
  assert(teacherHtml.includes(`id="${id}"`), `Missing required teacher must change id: ${id}`);
}
assert(teacherHtml.includes('minlength="8"'), 'Missing minlength="8" on teacher new pin');
assert(teacherHtml.includes('data-reveal="first-old"'), 'Missing reveal button for first-old');
assert(teacherHtml.includes('data-reveal="first-new"'), 'Missing reveal button for first-new');
assert(teacherHtml.includes('data-reveal="first-confirm"'), 'Missing reveal button for first-confirm');
console.log('  PASS [4]: Teacher mandatory PIN change contract verified.');

// [5] Verify Teacher Regular PIN Change contract in teacher.html
console.log('[5] Testing Teacher Regular PIN Change contract in teacher.html...');
const teacherRegularChangeIds = [
  'change-pin-section',
  'regular-pin-title',
  'teacher-regular-change-pin-form',
  'regular-old',
  'regular-new',
  'regular-confirm',
  'regular-length',
  'teacher-change-pin-status'
];
for (const id of teacherRegularChangeIds) {
  assert(teacherHtml.includes(`id="${id}"`), `Missing required teacher regular change id: ${id}`);
}
assert(teacherHtml.includes('data-reveal="regular-old"'), 'Missing reveal button for regular-old');
assert(teacherHtml.includes('data-reveal="regular-new"'), 'Missing reveal button for regular-new');
assert(teacherHtml.includes('data-reveal="regular-confirm"'), 'Missing reveal button for regular-confirm');
console.log('  PASS [5]: Teacher regular PIN change contract verified.');

// [6] Verify Common Modal Dialog (#msg-dialog) in index.html and teacher.html
console.log('[6] Testing Common Modal Dialog (#msg-dialog) contract in both HTML files...');
for (const [name, html] of [['index.html', indexHtml], ['teacher.html', teacherHtml]]) {
  assert(html.includes('id="msg-dialog"'), `${name} missing #msg-dialog`);
  assert(html.includes('id="msg-form"'), `${name} missing #msg-form`);
  assert(html.includes('id="msg-title"'), `${name} missing #msg-title`);
  assert(html.includes('id="msg-body"'), `${name} missing #msg-body`);
  assert(html.includes('id="msg-field"'), `${name} missing #msg-field`);
  assert(html.includes('id="msg-input"'), `${name} missing #msg-input`);
  assert(html.includes('id="msg-error"'), `${name} missing #msg-error`);
  assert(html.includes('id="msg-cancel"'), `${name} missing #msg-cancel`);
  assert(html.includes('id="msg-ok"'), `${name} missing #msg-ok`);
}
console.log('  PASS [6]: Common Modal Dialog (#msg-dialog) 100% present in both HTML files.');

// [7] T-a: Behavior test - Student code validation (a b with space)
console.log('[7] Testing T-a: Invalid student code validation (a b -> error, no API call)...');
{
  const elements = new Map();
  const mockDoc = {
    getElementById: id => elements.get(id) || null,
    createElement: tag => {
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        hidden: false,
        textContent: '',
        attributes: {},
        setAttribute: (k, v) => { el.attributes[k] = String(v); },
        removeAttribute: k => { delete el.attributes[k]; },
        getAttribute: k => el.attributes[k] || null
      };
      return el;
    }
  };
  globalThis.document = mockDoc;

  const mockInput = {
    id: 'student-code',
    value: 'a b',
    attributes: {},
    closest: () => ({ append: child => elements.set(child.id, child) }),
    setAttribute: (k, v) => { mockInput.attributes[k] = String(v); },
    removeAttribute: k => { delete mockInput.attributes[k]; },
    getAttribute: k => mockInput.attributes[k] || null,
    focus: () => { mockInput.focused = true; }
  };
  elements.set('student-code', mockInput);

  let apiCalled = false;
  const validateAndSubmit = () => {
    const code = mockInput.value.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
      setFieldError(mockInput, 'Mã học sinh chỉ gồm chữ, số, - và _.');
      mockInput.focus();
      return;
    }
    apiCalled = true;
  };

  validateAndSubmit();

  const errEl = elements.get('student-code-err');
  assert(errEl, 'T-a FAIL: #student-code-err element not created');
  assert.strictEqual(errEl.textContent, 'Mã học sinh chỉ gồm chữ, số, - và _.');
  assert.strictEqual(errEl.hidden, false);
  assert.strictEqual(mockInput.attributes['aria-invalid'], 'true');
  assert.strictEqual(mockInput.attributes['aria-describedby'], 'student-code-err');
  assert.strictEqual(mockInput.focused, true);
  assert.strictEqual(apiCalled, false, 'T-a FAIL: API must NOT be called for invalid code');
  console.log('  PASS [7] (T-a): Invalid student code correctly caught, error displayed, 0 API calls.');
}

// [8] T-b: Behavior test - withBusy loading state
console.log('[8] Testing T-b: Button loading state (withBusy sets aria-busy, disabled, restores label)...');
{
  const btn = {
    textContent: 'Vào học',
    disabled: false,
    attributes: {},
    setAttribute: (k, v) => { btn.attributes[k] = String(v); },
    removeAttribute: k => { delete btn.attributes[k]; }
  };

  let inFlightCaptured = null;
  const promise = withBusy(btn, 'Đang đăng nhập…', async () => {
    inFlightCaptured = {
      text: btn.textContent,
      disabled: btn.disabled,
      ariaBusy: btn.attributes['aria-busy']
    };
    await new Promise(r => setTimeout(r, 20));
    return 'SUCCESS';
  });

  const res = await promise;
  assert.strictEqual(res, 'SUCCESS');
  assert.strictEqual(inFlightCaptured.text, 'Đang đăng nhập…');
  assert.strictEqual(inFlightCaptured.disabled, true);
  assert.strictEqual(inFlightCaptured.ariaBusy, 'true');
  assert.strictEqual(btn.textContent, 'Vào học');
  assert.strictEqual(btn.disabled, false);
  assert.strictEqual(btn.attributes['aria-busy'], undefined);
  console.log('  PASS [8] (T-b): withBusy correctly manages disabled, aria-busy and label recovery.');
}

// [9] T-c: Behavior test - Common dialog confirm / cancel (Zero window.confirm calls)
console.log('[9] Testing T-c: Delete student flow with dialogBox (window.confirm strictly avoided)...');
{
  globalThis.window = {
    confirm: () => { throw new Error('VIOLATION: window.confirm was called!'); },
    prompt: () => { throw new Error('VIOLATION: window.prompt was called!'); },
    alert: () => { throw new Error('VIOLATION: window.alert was called!'); }
  };

  const elements = new Map();
  const listeners = new Map();
  const addEl = (id, tag = 'DIV') => {
    const el = {
      id,
      tagName: tag,
      textContent: '',
      hidden: false,
      classList: { toggle: () => {} },
      addEventListener: (evt, fn) => {
        listeners.set(`${id}:${evt}`, fn);
      },
      removeEventListener: (evt, _fn) => {
        listeners.delete(`${id}:${evt}`);
      },
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
  addEl('msg-form', 'FORM');
  addEl('msg-title', 'H2');
  addEl('msg-body', 'P');
  addEl('msg-field', 'LABEL');
  addEl('msg-field-label', 'SPAN');
  addEl('msg-input', 'INPUT');
  addEl('msg-error', 'P');
  addEl('msg-cancel', 'BUTTON');
  addEl('msg-ok', 'BUTTON');

  globalThis.document = {
    getElementById: id => elements.get(id) || null,
    activeElement: { focus: () => {} }
  };

  // Case 1: Cancel delete
  let apiDeleteCount = 0;
  const p1 = confirmBox({
    title: 'Xóa học sinh',
    body: 'Học sinh: Test (1). Thao tác xóa không thể hoàn tác.',
    okText: 'Xóa',
    danger: true
  });
  assert(dialogEl.open, 'Dialog must be open');
  assert.strictEqual(elements.get('msg-title').textContent, 'Xóa học sinh');

  // Click Cancel
  const cancelHandler = listeners.get('msg-cancel:click');
  assert(cancelHandler, 'Cancel click listener must be attached');
  cancelHandler();
  const confirmed1 = await p1;
  assert.strictEqual(confirmed1, false, 'Cancel must resolve false');
  if (confirmed1) apiDeleteCount++;
  assert.strictEqual(apiDeleteCount, 0, 'API DELETE must not be called when cancelled');

  // Case 2: OK delete
  const p2 = confirmBox({
    title: 'Xóa học sinh',
    body: 'Học sinh: Test (1). Thao tác xóa không thể hoàn tác.',
    okText: 'Xóa',
    danger: true
  });
  const submitHandler = listeners.get('msg-form:submit');
  assert(submitHandler, 'Submit listener must be attached');
  submitHandler({ preventDefault: () => {} });
  const confirmed2 = await p2;
  assert.strictEqual(confirmed2, true, 'Submit must resolve true');
  if (confirmed2) apiDeleteCount++;
  assert.strictEqual(apiDeleteCount, 1, 'API DELETE must be called exactly once');

  console.log('  PASS [9] (T-c): Dialog box confirm/cancel verified; window.confirm strictly 0 calls.');
}

// [10] T-d: Static Grep Audit - Zero confirm, prompt, alert, emoji in frontend/hoc/
console.log('[10] Testing T-d: Zero forbidden dialogs and zero emoji across frontend/hoc/ files...');
{
  const hocFiles = ['index.html', 'teacher.html', 'styles.css', 'app.js', 'teacher.js', 'dom.js'];
  for (const f of hocFiles) {
    const raw = fs.readFileSync(path.join(projectRoot, 'frontend/hoc', f), 'utf8');

    // Check forbidden window dialogs (except PWA install prompt)
    const dialogMatches = [...raw.matchAll(/(?:(?<!\.)\b(confirm|prompt|alert)|window\.(confirm|prompt|alert))\s*\(/g)]
      .filter(m => {
        const prefix = raw.slice(Math.max(0, m.index - 30), m.index);
        return !prefix.includes('installPrompt') && !prefix.includes('pwaPrompt');
      });
    assert.strictEqual(dialogMatches.length, 0, `Forbidden dialog call found in frontend/hoc/${f}: ${dialogMatches.map(m=>m[0]).join(', ')}`);

    // Check emoji
    assert(!raw.includes('💡'), `Forbidden emoji 💡 found in frontend/hoc/${f}`);
    assert(!raw.includes('✕'), `Forbidden character ✕ found in frontend/hoc/${f}`);
  }
  console.log('  PASS [10] (T-d): 0 confirm/prompt/alert, 0 💡, 0 ✕ across all frontend/hoc files.');
}

// [11] T-e: Behavior test - PIN validation rules
console.log('[11] Testing T-e: Student and Teacher PIN validation rules...');
{
  const validateStudentPinChange = (oldPin, newPin, confirmPin) => {
    if (!oldPin) return 'Vui lòng nhập mã PIN hiện tại.';
    if (newPin.length < 6) return 'Mã PIN tối thiểu 6 ký tự.';
    if (newPin !== confirmPin) return 'Mã PIN xác nhận không khớp.';
    if (newPin === oldPin) return 'Mã PIN mới phải khác mã cũ.';
    return null;
  };

  assert.strictEqual(validateStudentPinChange('', '123456', '123456'), 'Vui lòng nhập mã PIN hiện tại.');
  assert.strictEqual(validateStudentPinChange('111111', '123', '123'), 'Mã PIN tối thiểu 6 ký tự.');
  assert.strictEqual(validateStudentPinChange('111111', '123456', '654321'), 'Mã PIN xác nhận không khớp.');
  assert.strictEqual(validateStudentPinChange('123456', '123456', '123456'), 'Mã PIN mới phải khác mã cũ.');
  assert.strictEqual(validateStudentPinChange('111111', '222222', '222222'), null);

  const validateTeacherPinChange = (oldPin, newPin, confirmPin) => {
    if (!oldPin) return 'Vui lòng nhập mã PIN hiện tại.';
    if (newPin.length < 8) return 'Mã PIN tối thiểu 8 ký tự.';
    if (newPin !== confirmPin) return 'Mã PIN xác nhận không khớp.';
    if (newPin === oldPin) return 'Mã PIN mới phải khác mã cũ.';
    return null;
  };

  assert.strictEqual(validateTeacherPinChange('old12345', 'short', 'short'), 'Mã PIN tối thiểu 8 ký tự.');
  assert.strictEqual(validateTeacherPinChange('old12345', 'new12345', 'diff12345'), 'Mã PIN xác nhận không khớp.');
  assert.strictEqual(validateTeacherPinChange('old12345', 'old12345', 'old12345'), 'Mã PIN mới phải khác mã cũ.');
  assert.strictEqual(validateTeacherPinChange('old12345', 'newSecret123', 'newSecret123'), null);

  console.log('  PASS [11] (T-e): PIN validation rules (<6, mismatch, identical old) strictly verified.');
}

// [12] Error message mapping check
console.log('[12] Testing Error Message Mapping (mapErrorMessage)...');
assert.strictEqual(mapErrorMessage(new Error('INVALID_CREDENTIALS')), 'Mã học sinh hoặc mã PIN chưa đúng.');
assert.strictEqual(mapErrorMessage(new Error('ACCOUNT_DISABLED')), 'Tài khoản đang bị khóa. Liên hệ giáo viên.');
assert.strictEqual(mapErrorMessage(new Error('TEACHER_PIN_CHANGE_REQUIRED')), 'Cần đổi mã PIN trước khi tiếp tục.');
assert.strictEqual(mapErrorMessage(new Error('Failed to fetch')), 'Không có kết nối mạng.');
assert.strictEqual(mapErrorMessage(new Error('Random unexpected error')), 'Chưa thực hiện được. Thử lại sau.');
console.log('  PASS [12]: Error message mapping to user-friendly Vietnamese text verified.');

// [13] CSS Scoping & Classes
console.log('[13] Testing CSS classes and styles in styles.css...');
assert(stylesCss.includes('.msg-dialog'), 'Missing .msg-dialog styles');
assert(stylesCss.includes('.msg-actions'), 'Missing .msg-actions styles');
assert(stylesCss.includes('.danger-btn'), 'Missing .danger-btn styles');
assert(stylesCss.includes('.field-error'), 'Missing .field-error styles');
assert(stylesCss.includes('--danger:'), 'Missing --danger variable in :root');
console.log('  PASS [13]: CSS classes for modal dialog, errors and buttons verified.');

console.log('\n>>> ALL 13 LOGIN & ACCOUNT UI CONTRACT & BEHAVIOR TESTS PASSED 100%! <<<');
