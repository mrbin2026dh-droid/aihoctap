// @ts-check
import {api, ApiError, API_BASE} from './api.js';
import * as db from './db.js';
import {el, button, notify, renderMarkdown, dialogBox, confirmBox, withBusy, setFieldError, mapErrorMessage} from './dom.js';
/** @typedef {import('./contracts').PublishLesson} PublishLesson */
/** @typedef {import('./contracts').PrivateQuestion} PrivateQuestion */
/** @param {string} id */
function node(id) {const result = document.getElementById(id); if (!result) throw new Error(`Thiếu ${id}`); return result;}
const form = /** @type {HTMLFormElement} */ (node('publish-form'));
let token = sessionStorage.getItem('aisgk-pwa-teacher') || '';
let mustChangePin = sessionStorage.getItem('aisgk-pwa-teacher-must-change') === 'true';
// Cách ly vai trò: máy đang có phiên học sinh thì không giữ phiên giáo viên cũ.
try {
  if (await db.get('meta', 'session')) {
    token = ''; mustChangePin = false;
    sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('aisgk-pwa-teacher-must-change');
  }
} catch { /* không đọc được bộ nhớ: coi như chưa có phiên học sinh */ }
let generation = 0;
/** @param {Error} error */
function fail(error) {
  if (error instanceof ApiError && error.status === 401) {token = ''; sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); mustChangePin = false; generation++; updateAuth();}
  notify(error instanceof Error ? error.message : 'Thao tác chưa hoàn thành. Hãy thử lại.', true);
}
/** @param {string} id @param {()=>void|Promise<void>} action */
function on(id, action) {node(id).addEventListener('click', () => {
  const captured = generation;
  Promise.resolve(action()).catch(error => {if (captured === generation) fail(error);});
});}
function updateAuth() {
  node('auth-section').hidden = Boolean(token);
  const mustChangeSec = node('teacher-must-change-section');
  if (mustChangeSec) mustChangeSec.hidden = !token || !mustChangePin;
  node('editor').hidden = !token || mustChangePin;
  node('teacher-logout').hidden = !token;
  const openSettingsBtn = document.getElementById('open-settings');
  if (openSettingsBtn) openSettingsBtn.hidden = !token || mustChangePin;
}
/** @param {string} name @returns {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} */
function field(name) {return /** @type {HTMLInputElement} */ (form.elements.namedItem(name));}
/** @param {string} text @param {string} name @param {string} [value] @param {boolean} [multiline] */
function inputLabel(text, name, value = '', multiline = false) {
  const label = el('label', text); const input = multiline ? el('textarea') : el('input');
  input.name = name; input.value = value; input.required = true; input.maxLength = multiline ? 2000 : 500; label.append(input); return label;
}
/** @param {PrivateQuestion} [question] */
function addQuestion(question) {
  const container = node('question-editors'); const section = el('fieldset', '', 'question-edit');
  section.append(el('legend', 'Câu hỏi'));
  const code = inputLabel('Mã câu hỏi', 'question-id', question?.id || `q${crypto.randomUUID().slice(0,8)}`);
  /** @type {HTMLInputElement} */ (code.querySelector('input')).pattern = '[a-z0-9][a-z0-9_-]{0,63}';
  section.append(code, inputLabel('Câu hỏi', 'prompt', question?.prompt || ''));
  const kindLabel = el('label', 'Loại câu hỏi'); const kind = el('select'); kind.name = 'kind';
  for (const [value, text] of [['choice','Trắc nghiệm'],['text','Tự luận']]) {const option = el('option', text); option.value = value; kind.append(option);}
  kind.value = question?.kind || 'choice'; kindLabel.append(kind); section.append(kindLabel);
  const options = el('div', '', 'teacher-grid');
  const storedKeys = Object.keys(question?.options || {});
  const keys = storedKeys.length ? storedKeys : ['A','B','C','D'];
  for (const key of keys) {const label = inputLabel(`Lựa chọn ${key}`, `option-${key}`, question?.options[key] || ''); const input = /** @type {HTMLInputElement} */ (label.querySelector('input')); input.dataset.optionKey = key; input.maxLength = 2000; input.required = false; options.append(label);}
  const correctLabel = el('label', 'Đáp án đúng'); const correct = el('select'); correct.name = 'correct_answer';
  for (const key of keys) {const option = el('option', key); option.value = key; correct.append(option);}
  correct.value = question?.correct_answer || 'A'; correctLabel.append(correct); options.append(correctLabel); section.append(options);
  const hint = inputLabel('Gợi ý (không ghi đáp án)', 'hint', question?.hint || '', true);
  /** @type {HTMLTextAreaElement} */ (hint.querySelector('textarea')).required = false;
  /** @type {HTMLTextAreaElement} */ (hint.querySelector('textarea')).maxLength = 1000;
  section.append(hint, button('Xóa câu hỏi', () => section.remove(), 'danger'));
  const toggle = () => {options.hidden = kind.value === 'text'; for (const input of options.querySelectorAll('input,select')) /** @type {HTMLInputElement} */ (input).disabled = options.hidden;};
  kind.addEventListener('change', toggle); toggle(); container.append(section);
}
/** @returns {PublishLesson} */
function documentValue() {
  /** @type {PrivateQuestion[]} */ const questions = [];
  for (const section of node('question-editors').querySelectorAll('fieldset')) {
    /** @param {string} name */ const value = name => /** @type {HTMLInputElement} */ (section.querySelector(`[name="${name}"]`)).value.trim();
    const kind = value('kind') === 'text' ? 'text' : 'choice';
    /** @type {Record<string,string>} */ const options = {};
    if (kind === 'choice') for (const input of section.querySelectorAll('input[data-option-key]')) {
      const entry = /** @type {HTMLInputElement} */ (input);
      if (entry.value.trim() && entry.dataset.optionKey) options[entry.dataset.optionKey] = entry.value.trim();
    }
    questions.push({id:value('question-id'), prompt:value('prompt'), kind, options, correct_answer:kind === 'choice' ? value('correct_answer') : '', hint:value('hint')});
  }
  return {subject_id:field('subject_id').value.trim(), subject_name:field('subject_name').value.trim(), grade:Number(field('grade').value), lesson_id:field('lesson_id').value.trim(), title:field('title').value.trim(), content_markdown:field('content_markdown').value, questions};
}
async function refresh() {
  const captured = generation;
  const catalog = /** @type {import('./contracts').Catalog} */ (await api('/pwa/catalog'));
  if (captured !== generation) return;
  const select = /** @type {HTMLSelectElement} */ (node('published'));
  select.replaceChildren(el('option', 'Chọn bài để chỉnh sửa'));
  for (const course of catalog.courses) for (const lesson of course.lessons) {const option = el('option', `${course.title} · ${lesson.title}`); option.value = `${course.id}/${lesson.id}`; select.append(option);}
}
async function results() {
  const captured = generation;
  const data = await api('/pwa/teacher/results', {token});
  if (captured !== generation || !token) return;
  const target = node('teacher-results'); target.replaceChildren();
  const attempts = Array.isArray(data) ? data : (Array.isArray(data?.attempts) ? data.attempts : []);
  for (const attempt of attempts) {
    const card = el('article', '', 'progress-card');
    const who = [attempt.student_name || attempt.uid, attempt.class_code].filter(Boolean).join(' · ');
    const score = Number.isFinite(attempt.correct) && Number.isFinite(attempt.total) ? `${attempt.correct}/${attempt.total} câu đúng` : 'Chưa có điểm';
    card.append(el('h3', who || 'Học sinh'), el('p', `${attempt.course_id || ''} / ${attempt.lesson_id || ''}: ${score}${attempt.needs_review ? ' · Cần xem tự luận' : ''}`));
    if (attempt.answers && typeof attempt.answers === 'object') for (const [id, answer] of Object.entries(attempt.answers)) card.append(el('p', `${id}: ${answer}`));
    target.append(card);
  }
  if (!attempts.length) target.append(el('p', 'Chưa có bài nộp.'));
}
/** @param {PublishLesson} document */
function fill(document) {
  /** @type {Array<keyof Omit<PublishLesson,'questions'>>} */
  const names = ['subject_id','subject_name','grade','lesson_id','title','content_markdown'];
  for (const name of names) field(name).value = String(document[name]);
  node('question-editors').replaceChildren(); for (const question of document.questions) addQuestion(question); node('preview').replaceChildren();
}
node('teacher-login').addEventListener('submit', async event => {
  event.preventDefault();
  const loginForm = /** @type {HTMLFormElement} */ (node('teacher-login'));
  const submit = /** @type {HTMLButtonElement} */ (loginForm.querySelector('button[type=submit]'));
  const pinInput = /** @type {HTMLInputElement} */ (loginForm.querySelector('[name=pin]'));
  const loginErr = document.getElementById('teacher-login-error');
  if (loginErr) { loginErr.textContent = ''; loginErr.className = 'notice error status'; }

  pinInput.addEventListener('input', () => setFieldError(pinInput, ''));
  const pin = pinInput.value.trim();

  if (pin.length < 8) {
    setFieldError(pinInput, 'Mã PIN tối thiểu 8 ký tự.');
    pinInput.focus();
    return;
  }

  await withBusy(submit, 'Đang đăng nhập…', async () => {
    try {
      const response = await api('/teacher/auth', {method:'POST', body:{pin}});
      token = response.token;
      mustChangePin = Boolean(response.must_change);
      sessionStorage.setItem('aisgk-pwa-teacher-must-change', String(mustChangePin));
      generation++;
      await db.remove('meta', 'session').catch(() => {});   // đăng nhập giáo viên thì đăng xuất học sinh trên máy này
      sessionStorage.setItem('aisgk-pwa-teacher', token);
      loginForm.reset();
      updateAuth();
      if (!mustChangePin) {
        const parts = [['danh sách bài', refresh], ['bài học sinh đã nộp', results], ['khóa Gemini', loadGeminiKeys], ['hạn mức AI', loadAiUsage], ['danh sách học sinh', loadStudents]];
        const settled = await Promise.allSettled(parts.map(([, fn]) => fn()));
        const failed = parts.filter((_, i) => settled[i].status === 'rejected').map(([name]) => name);
        notify(failed.length ? `Đã đăng nhập. Chưa tải được: ${failed.join(', ')}. Tải lại trang để thử lại.` : 'Đã đăng nhập. Sẵn sàng soạn bài.', failed.length > 0);
      } else {
        notify('Vui lòng đổi mã PIN khởi tạo để tiếp tục.');
      }
    } catch (error) {
      const msg = mapErrorMessage(error);
      if (loginErr) {
        loginErr.textContent = msg;
      }
      fail(new Error(msg));
    }
  });
});

document.addEventListener('click', e => {
  const target = /** @type {HTMLElement|null} */ (e.target);
  const b = target?.closest('[data-reveal]');
  if (!b) return;
  const targetId = b.getAttribute('data-reveal');
  if (!targetId) return;
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById(targetId));
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.textContent = show ? 'Ấn' : 'Hiện';
  b.setAttribute('aria-pressed', String(show));
});

async function loadGeminiKeys() {
  if (!token) return;
  const captured = generation;
  const tbody = node('keys-tbody');
  const banner = node('pool-banner');
  try {
    const data = await api('/teacher/gemini-keys', { token });
    if (captured !== generation || !token) return;
    tbody.replaceChildren();

    const usable = (data.keys || []).filter(k => k.status === 'active').length;
    banner.hidden = usable > 0;
    banner.textContent = usable > 0 ? '' : 'Gia sư AI đang tạm dừng: bể khóa trống hoặc đã hết hạn mức. Thêm khóa mới bên dưới để học sinh dùng tiếp.';

    if (!data.keys || !data.keys.length) {
      tbody.append(el('tr', '', '', [el('td', 'Chưa có khóa nào trong bể. Hãy thêm khóa mới bên trên.', '', [], { colSpan: '5' })]));
      return;
    }
    for (const key of data.keys) {
      const tr = el('tr');
      const statusText = key.status === 'active' ? 'Hoạt động' : key.status === 'cooldown' ? 'Chờ hồi phục' : 'Hết hạn mức ngày';
      const statusClass = key.status === 'active' ? 'status-ok' : key.status === 'cooldown' ? 'status-wait' : 'status-out';
      tr.append(
        el('td', `...${key.key_suffix}`),
        el('td', key.note || '(Không ghi chú)'),
        el('td', '', '', [el('span', statusText, statusClass)]),
        el('td', `${key.daily_count || 0} / ${key.daily_limit || 1500}`),
        el('td', '', '', [
          button('Xóa', async () => {
            if (!await confirmBox({
              title: 'Xóa khóa API?',
              body: `Xóa khóa …${key.key_suffix}? Khóa này sẽ không còn dùng cho kết nối AI. Không thể hoàn tác.`,
              okText: 'Xóa khóa',
              danger: true
            })) return;
            try {
              await api(`/teacher/gemini-keys?id=${encodeURIComponent(key.id)}`, { method: 'DELETE', token });
              await loadGeminiKeys();
              notify('Đã xóa khóa khỏi bể.');
            } catch (err) {
              fail(err instanceof Error ? err : new Error('Chưa xóa được khóa.'));
            }
          }, 'danger')
        ])
      );
      tbody.append(tr);
    }
  } catch (err) {
    if (captured === generation) fail(err instanceof Error ? err : new Error('Chưa tải được danh sách khóa.'));
  }
}

node('add-key-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('add-key-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const formData = new FormData(formEl);
  try {
    await api('/teacher/gemini-keys', {
      method: 'POST',
      token,
      body: {
        api_key: String(formData.get('gemini_api_key')).trim(),
        note: String(formData.get('gemini_key_note')).trim()
      }
    });
    formEl.reset();
    await loadGeminiKeys();
    notify('Đã thêm khóa Gemini API vào bể thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa thêm được khóa.'));
  } finally {
    submit.disabled = false;
  }
});

node('material-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('material-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const formData = new FormData(formEl);
  try {
    await api('/pwa/teacher/materials', {
      method: 'POST',
      token,
      body: {
        id: String(formData.get('material_id')).trim(),
        course_id: String(formData.get('material_course_id')).trim(),
        title: String(formData.get('material_title')).trim(),
        drive_url: String(formData.get('material_drive_url')).trim(),
        description: String(formData.get('material_desc')).trim()
      }
    });
    formEl.reset();
    notify('Đã đăng tải tài liệu Google Drive thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa đăng tải được tài liệu.'));
  } finally {
    submit.disabled = false;
  }
});

on('refresh-keys', loadGeminiKeys);

async function loadAiUsage() {
  if (!token) return;
  const captured = generation;
  const tbody = /** @type {HTMLTableSectionElement} */ (node('ai-usage-tbody'));
  try {
    const [settingsRes, statsRes] = await Promise.all([
      api('/teacher/ai-settings', { token }),
      api('/teacher/ai-stats', { token })
    ]);
    if (captured !== generation || !token) return;

    if (settingsRes && settingsRes.settings) {
      const defInput = /** @type {HTMLInputElement|null} */ (document.getElementById('ai-default-limit'));
      if (defInput && !defInput.matches(':focus')) {
        defInput.value = String(settingsRes.settings.default_limit ?? 10);
      }
      const examCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('ai-exam-mode'));
      if (examCheck) {
        examCheck.checked = Boolean(settingsRes.settings.exam_mode);
      }
    }

    tbody.replaceChildren();
    const stats = statsRes.stats || [];
    if (!stats.length) {
      tbody.append(el('tr', '', '', [el('td', 'Chưa có học sinh nào dùng gia sư hôm nay.', '', [], { colSpan: '5' })]));
      return;
    }

    for (const item of stats) {
      const tr = el('tr');
      const isLocked = Boolean(item.locked);
      const statusText = isLocked ? 'Đã khóa' : 'Hoạt động';
      const statusClass = isLocked ? 'status-out' : 'status-ok';
      tr.append(
        el('td', item.student_id),
        el('td', `${item.used} / ${item.limit}`),
        el('td', item.grant ? `+${item.grant}` : '0'),
        el('td', '', '', [el('span', statusText, statusClass)]),
        el('td', '', '', [
          button(isLocked ? 'Mở khóa' : 'Khóa', async () => {
            await api('/teacher/ai-lock', {
              method: 'POST',
              token,
              body: { student_id: item.student_id, locked: !isLocked }
            });
            await loadAiUsage();
            notify(isLocked ? `Đã mở khóa gia sư cho ${item.student_id}.` : `Đã tạm khóa gia sư với ${item.student_id}.`);
          }),
          button('+5 lượt', async () => {
            await api('/teacher/ai-grant', {
              method: 'POST',
              token,
              body: { student_id: item.student_id, extra: 5 }
            });
            await loadAiUsage();
            notify(`Đã cộng 5 lượt hỏi gia sư cho ${item.student_id}.`);
          }, 'primary')
        ])
      );
      tbody.append(tr);
    }
  } catch (err) {
    if (captured === generation) fail(err instanceof Error ? err : new Error('Chưa tải được thống kê dùng AI.'));
  }
}

node('ai-settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('ai-settings-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const formData = new FormData(formEl);
  try {
    await api('/teacher/ai-settings', {
      method: 'PUT',
      token,
      body: {
        default_limit: Number(formData.get('default_limit')) || 10,
        exam_mode: Boolean(formData.get('exam_mode'))
      }
    });
    await loadAiUsage();
    notify('Đã lưu cài đặt gia sư thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa lưu được cài đặt gia sư.'));
  } finally {
    submit.disabled = false;
  }
});

on('refresh-ai-stats', loadAiUsage);

on('download-ai-csv', async () => {
  try {
    const res = await fetch(`${API_BASE}/teacher/ai-stats?format=csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Không thể tải tệp CSV.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_usage_stats_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify('Đã tải báo cáo CSV thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa tải được báo cáo CSV.'));
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault(); const submit = /** @type {HTMLButtonElement} */ (form.querySelector('button[type=submit]')); submit.disabled = true;
  const captured = generation;
  try {await api('/pwa/teacher/publish', {method:'POST',token,body:documentValue()}); if (captured !== generation) return; await refresh(); if (captured === generation) notify('Đã xuất bản. Học sinh nhận bản mới khi có mạng.');}
  catch (error) {if (captured === generation) fail(error instanceof Error ? error : new Error('Chưa xuất bản được.'));} finally {submit.disabled = false;}
});
on('teacher-logout', async () => {
  const oldToken = token; token = ''; mustChangePin = false; generation++; sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); updateAuth();
  form.reset(); node('question-editors').replaceChildren(); node('preview').replaceChildren(); node('teacher-results').replaceChildren(); node('published').replaceChildren();
  try {await api('/teacher/logout', {method:'POST',token:oldToken}); notify('Đã đăng xuất.');} catch {notify('Đã đăng xuất trên máy. Phiên máy chủ chưa xác nhận thu hồi.', true);}
});
on('load-lesson', async () => {
  const value = /** @type {HTMLSelectElement} */ (node('published')).value;
  if (!value.includes('/')) {notify('Chọn bài cần chỉnh sửa.'); return;}
  const captured = generation; const document = await api(`/pwa/teacher/lesson/${value}`, {token}); if (captured === generation && token) fill(document);
});
on('preview-button', () => renderMarkdown(node('preview'), field('content_markdown').value));
on('add-question', () => addQuestion());
on('new-lesson', () => {form.reset(); node('question-editors').replaceChildren(); node('preview').replaceChildren(); notify('Đang soạn bài mới.');});
on('refresh-results', results);
/** @type {Array<any>} */
let allStudents = [];

function showStudentPinBanner(id, pin, name) {
  const banner = node('student-pin-banner');
  banner.hidden = false;
  banner.replaceChildren();
  const text = el('span', `Thông tin tài khoản: ${name ? name + ' — ' : ''}Mã HS: ${id} | Mã PIN: ${pin} (chỉ hiện một lần)`);
  text.style.fontWeight = 'bold';
  const copyBtn = button('Sao chép', () => {
    navigator.clipboard.writeText(`Mã HS: ${id}\nMã PIN: ${pin}`);
    notify('Đã sao chép thông tin tài khoản vào bộ nhớ đệm.');
  });
  copyBtn.style.marginLeft = '12px';
  banner.append(text, copyBtn);
}

function renderStudentsTable() {
  node('students-table')?.removeAttribute('aria-busy');
  const tbody = /** @type {HTMLTableSectionElement} */ (node('students-tbody'));
  tbody.replaceChildren();
  const filterVal = /** @type {HTMLSelectElement} */ (node('students-class-filter')).value;
  const filtered = filterVal ? allStudents.filter(s => s.class_code === filterVal) : allStudents;

  if (filtered.length === 0) {
    const tr = el('tr');
    const td = el('td', 'Chưa có học sinh nào.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
    return;
  }

const inFlight = new Set();
/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T|undefined>}
 */
async function guarded(key, fn) {
  if (inFlight.has(key)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
  inFlight.add(key);
  const sid = key.split(':')[1];
  const row = document.querySelector(`[data-sid="${CSS.escape(sid)}"]`);
  row?.setAttribute('aria-busy', 'true');
  const details = /** @type {HTMLDetailsElement|null} */ (row?.querySelector('.row-actions'));
  const summary = details?.querySelector('summary');
  summary?.setAttribute('aria-disabled', 'true');
  const actionBtns = row?.querySelectorAll('.action-list button');
  actionBtns?.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
  try { return await fn(); } finally {
    inFlight.delete(key);
    row?.removeAttribute('aria-busy');
    summary?.removeAttribute('aria-disabled');
    actionBtns?.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });
  }
}

  for (const s of filtered) {
    const tr = el('tr');
    tr.dataset.sid = s.id;
    tr.append(
      el('td', s.id),
      el('td', s.name),
      el('td', `Khối ${s.grade}`),
      el('td', s.class_code),
      el('td', s.disabled ? 'Bị khóa' : 'Hoạt động')
    );

    const tdActions = el('td');
    const details = /** @type {HTMLDetailsElement} */ (el('details', '', 'row-actions'));
    const summary = el('summary', 'Thao tác');
    const hiddenLabel = el('span', ` với học sinh ${s.name}`, 'visually-hidden');
    summary.append(hiddenLabel);

    const editBtn = button('Sửa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      details.open = false;
      const res = await dialogBox({
        kind: 'prompt',
        title: 'Sửa học sinh',
        body: 'Cập nhật họ tên và lớp.',
        okText: 'Lưu',
        fields: [
          { name: 'name', label: 'Họ và tên', value: s.name, validate: v => v.length < 2 ? 'Họ và tên tối thiểu 2 ký tự.' : '' },
          { name: 'class_code', label: 'Mã lớp', value: s.class_code, validate: v => /^[A-Za-z0-9._-]{1,16}$/.test(v) ? '' : 'Mã lớp gồm chữ, số, tối đa 16 ký tự.' }
        ]
      });
      if (!res || typeof res !== 'object') return;
      const newName = res.name.trim();
      const newClass = res.class_code.trim().toUpperCase();
      if (newName === s.name && newClass === s.class_code) return;
      await guarded('s:' + s.id, async () => {
        try {
          await api(`/teacher/students/${s.id}`, {
            method: 'PATCH',
            token,
            body: { name: newName, class_code: newClass }
          });
          notify('Đã cập nhật thông tin học sinh.');
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa cập nhật được học sinh.'));
        }
      });
    });

    const resetPinBtn = button('Đặt lại PIN', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      details.open = false;
      if (!await confirmBox({
        title: 'Đặt lại mã PIN?',
        body: `Học sinh: ${s.name} (${s.id}). Mã PIN cũ sẽ không còn sử dụng được.`,
        okText: 'Đặt lại mã PIN',
        danger: true
      })) return;
      await guarded('s:' + s.id, async () => {
        try {
          const res = await api(`/teacher/students/${s.id}/reset-pin`, {
            method: 'POST',
            token,
            body: {}
          });
          showStudentPinBanner(s.id, res.pin, s.name);
          notify('Đã đặt lại mã PIN thành công.');
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa đặt lại được mã PIN.'));
        }
      });
    });

    const lockBtn = button(s.disabled ? 'Mở khóa' : 'Khóa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      details.open = false;
      const actionName = s.disabled ? 'mở khóa' : 'khóa';
      if (!await confirmBox({
        title: s.disabled ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?',
        body: `Học sinh: ${s.name} (${s.id}). ${s.disabled ? 'Học sinh sẽ có thể đăng nhập lại.' : 'Học sinh sẽ không thể đăng nhập.'}`,
        okText: s.disabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
        danger: !s.disabled
      })) return;
      await guarded('s:' + s.id, async () => {
        try {
          await api(`/teacher/students/${s.id}/lock`, {
            method: 'POST',
            token,
            body: { locked: !s.disabled }
          });
          notify(`Đã ${actionName} tài khoản học sinh.`);
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error(`Chưa ${actionName} được tài khoản.`));
        }
      });
    });

    const delBtn = button('Xóa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      details.open = false;
      if (!await confirmBox({
        title: 'Xóa học sinh?',
        body: `Học sinh: ${s.name} (${s.id}). Thao tác xóa không thể hoàn tác.`,
        okText: 'Xóa học sinh',
        danger: true
      })) return;
      await guarded('s:' + s.id, async () => {
        try {
          await api(`/teacher/students/${s.id}`, {
            method: 'DELETE',
            token
          });
          notify('Đã xóa học sinh thành công.');
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa xóa được học sinh.'));
        }
      });
    }, 'danger');

    const actionList = el('div', '', 'action-list');
    actionList.append(editBtn, resetPinBtn, lockBtn, delBtn);
    details.append(summary, actionList);
    tdActions.append(details);
    tr.append(tdActions);
    tbody.append(tr);
  }
}

async function loadStudents() {
  if (!token || mustChangePin) return;
  const tbody = /** @type {HTMLTableSectionElement} */ (node('students-tbody'));
  const filterSelect = /** @type {HTMLSelectElement} */ (node('students-class-filter'));
  const table = node('students-table');
  table.setAttribute('aria-busy', 'true');
  try {
    const students = await api('/teacher/students', { token });
    allStudents = Array.isArray(students) ? students : [];

    const classes = [...new Set(allStudents.map(s => s.class_code).filter(Boolean))].sort();
    const currentVal = filterSelect.value;
    filterSelect.replaceChildren();
    const allOpt = el('option', 'Tất cả các lớp');
    allOpt.value = '';
    filterSelect.append(allOpt);
    for (const c of classes) {
      const opt = el('option', `Lớp ${c}`);
      opt.value = c;
      filterSelect.append(opt);
    }
    filterSelect.value = currentVal;

    renderStudentsTable();
  } catch {
    table.removeAttribute('aria-busy');
    tbody.replaceChildren();
    const tr = el('tr');
    const td = el('td', 'Chưa tải được danh sách học sinh.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
  }
}

node('add-student-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('add-student-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const data = new FormData(formEl);
  const name = String(data.get('name') || '').trim();
  const grade = Number(data.get('grade')) || 6;
  const classCode = String(data.get('class_code') || '').trim();
  const pin = String(data.get('pin') || '').trim();

  await withBusy(submit, 'Đang tạo học sinh…', async () => {
    try {
      const res = await api('/teacher/students', {
        method: 'POST',
        token,
        body: { name, grade, class_code: classCode, pin: pin || undefined }
      });
      formEl.reset();
      showStudentPinBanner(res.id, res.pin, res.name);
      notify('Đã thêm học sinh thành công.');
      await loadStudents();
    } catch (e) {
      fail(e instanceof Error ? e : new Error('Chưa thêm được học sinh.'));
    }
  });
});

node('students-class-filter')?.addEventListener('change', renderStudentsTable);
on('refresh-students', loadStudents);

node('teacher-must-change-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('teacher-must-change-form'));
  const errNode = node('teacher-must-change-error');
  errNode.hidden = true;

  const oldPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=old_pin]'));
  const newPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=new_pin]'));
  const confirmPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=confirm_pin]'));

  oldPinInput.addEventListener('input', () => setFieldError(oldPinInput, ''));
  newPinInput.addEventListener('input', () => setFieldError(newPinInput, ''));
  confirmPinInput.addEventListener('input', () => setFieldError(confirmPinInput, ''));

  const oldPin = oldPinInput.value.trim();
  const newPin = newPinInput.value.trim();
  const confirmPin = confirmPinInput.value.trim();

  if (!oldPin) {
    setFieldError(oldPinInput, 'Vui lòng nhập mã PIN hiện tại.');
    oldPinInput.focus();
    return;
  }
  if (newPin.length < 8) {
    setFieldError(newPinInput, 'Mã PIN tối thiểu 8 ký tự.');
    newPinInput.focus();
    return;
  }
  if (newPin !== confirmPin) {
    setFieldError(confirmPinInput, 'Mã PIN xác nhận không khớp.');
    confirmPinInput.focus();
    return;
  }
  if (newPin === oldPin) {
    setFieldError(newPinInput, 'Mã PIN mới phải khác mã cũ.');
    newPinInput.focus();
    return;
  }

  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  await withBusy(submit, 'Đang đổi mã PIN…', async () => {
    try {
      const res = await api('/teacher/change-pin', {
        method: 'POST',
        token,
        body: { old_pin: oldPin, new_pin: newPin }
      });
      token = res.token;
      sessionStorage.setItem('aisgk-pwa-teacher', token);
      mustChangePin = false;
      sessionStorage.removeItem('aisgk-pwa-teacher-must-change');
      formEl.reset();
      updateAuth();
      await refresh(); await results(); await loadGeminiKeys(); await loadAiUsage(); await loadStudents();
      notify('Đổi mã PIN giáo viên thành công. Đã mở khóa quyền quản trị.');
    } catch (e) {
      errNode.textContent = mapErrorMessage(e);
      errNode.hidden = false;
    }
  });
});

node('teacher-regular-change-pin-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('teacher-regular-change-pin-form'));
  const statusNode = node('teacher-change-pin-status');
  statusNode.textContent = '';
  statusNode.className = 'notice status';

  const oldPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=old_pin]'));
  const newPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=new_pin]'));
  const confirmPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=confirm_pin]'));

  oldPinInput.addEventListener('input', () => setFieldError(oldPinInput, ''));
  newPinInput.addEventListener('input', () => setFieldError(newPinInput, ''));
  confirmPinInput.addEventListener('input', () => setFieldError(confirmPinInput, ''));

  const oldPin = oldPinInput.value.trim();
  const newPin = newPinInput.value.trim();
  const confirmPin = confirmPinInput.value.trim();

  if (!oldPin) {
    setFieldError(oldPinInput, 'Vui lòng nhập mã PIN hiện tại.');
    oldPinInput.focus();
    return;
  }
  if (newPin.length < 8) {
    setFieldError(newPinInput, 'Mã PIN tối thiểu 8 ký tự.');
    newPinInput.focus();
    return;
  }
  if (newPin !== confirmPin) {
    setFieldError(confirmPinInput, 'Mã PIN xác nhận không khớp.');
    confirmPinInput.focus();
    return;
  }
  if (newPin === oldPin) {
    setFieldError(newPinInput, 'Mã PIN mới phải khác mã cũ.');
    newPinInput.focus();
    return;
  }

  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  await withBusy(submit, 'Đang đổi mã PIN…', async () => {
    try {
      const res = await api('/teacher/change-pin', {
        method: 'POST',
        token,
        body: { old_pin: oldPin, new_pin: newPin }
      });
      token = res.token;
      sessionStorage.setItem('aisgk-pwa-teacher', token);
      statusNode.textContent = 'Đã đổi mã PIN.';
      statusNode.className = 'notice success status';
      formEl.reset();
      notify('Đổi mã PIN giáo viên thành công.');
    } catch (e) {
      statusNode.textContent = mapErrorMessage(e);
      statusNode.className = 'notice error status';
    }
  });
});

updateAuth();
if (token && !mustChangePin) {
  const captured = generation;
  refresh().then(() => {
    if (captured === generation) {
      results();
      loadGeminiKeys();
      loadAiUsage();
      loadStudents();
    }
  }).catch(error => {
    if (captured === generation) fail(error);
  });
}


// ==========================================
// ADAPTIVE SETTINGS MENU & CONFIRMATIONS (AGENTS.md J & K)
// ==========================================
let screen = 'work'; // 'work' | 'settings'
let activeView = ''; // 'account' | 'quota' | 'keys'
let workScroll = 0;
let quotaDirty = false;

function renderSettings(focus = true) {
  const isSettings = screen === 'settings';
  const workspaceEl = document.getElementById('workspace');
  const settingsEl = document.getElementById('settings');
  const openSettingsBtn = document.getElementById('open-settings');
  const settingsLayout = document.getElementById('settings-layout');

  if (workspaceEl) workspaceEl.hidden = isSettings;
  if (settingsEl) settingsEl.hidden = !isSettings;
  if (openSettingsBtn) openSettingsBtn.setAttribute('aria-expanded', String(isSettings));

  if (!isSettings) {
    if (focus) {
      const target = document.getElementById('workspace-title') || openSettingsBtn;
      target?.focus();
    }
    return;
  }

  const isWide = window.matchMedia('(min-width: 960px)').matches;
  if (isWide && !activeView) activeView = 'account';   // màn rộng luôn có trang chi tiết
  if (settingsLayout) {
    if (isWide) {
      settingsLayout.classList.add('has-detail');
    } else {
      settingsLayout.classList.toggle('has-detail', Boolean(activeView));
    }
  }

  const panels = ['account', 'quota', 'keys'];
  for (const p of panels) {
    const elP = document.getElementById('panel-' + p);
    if (elP) elP.hidden = p !== activeView;
  }

  document.querySelectorAll('.settings-menu .group-link').forEach(btn => {
    const b = /** @type {HTMLButtonElement} */ (btn);
    if (b.dataset.view === activeView) {
      b.setAttribute('aria-current', 'page');
    } else {
      b.removeAttribute('aria-current');
    }
  });

  if (focus) {
    const heading = document.getElementById('heading-' + activeView) || document.getElementById('settings-title');
    heading?.focus();
  }
}

function settingsBack() {            // trả true nếu vẫn ở trong Cài đặt
  const wide = window.matchMedia('(min-width: 960px)').matches;
  if (!wide && activeView) { activeView = ''; renderSettings(false); return true; }
  return false;                       // rời Cài đặt
}

/** @param {() => void} fn @param {(() => void)|null} [onCancel] */
async function checkDirtyAndProceed(fn, onCancel = null) {
  if (!quotaDirty) {
    fn();
    return;
  }
  const confirmed = await confirmBox({
    title: 'Bỏ thay đổi chưa lưu?',
    body: 'Cài đặt gia sư đang chỉnh sửa chưa được lưu.',
    okText: 'Bỏ thay đổi',
    danger: true
  });
  if (confirmed) {
    quotaDirty = false;
    const quotaForm = /** @type {HTMLFormElement|null} */ (document.getElementById('ai-settings-form'));
    quotaForm?.reset();
    fn();
  } else {
    onCancel?.();
  }
}

function leaveSettings() {
  checkDirtyAndProceed(() => {
    if (history.state?.settings) {
      history.back();
    } else {
      screen = 'work';
      renderSettings(false);
      window.scrollTo(0, workScroll);
      document.getElementById('open-settings')?.focus();
    }
  });
}

document.getElementById('open-settings')?.addEventListener('click', () => {
  workScroll = window.scrollY;
  screen = 'settings';
  const wide = window.matchMedia('(min-width: 960px)').matches;
  if (!wide) activeView = '';
  history.pushState({ settings: 1 }, '');
  renderSettings();
  window.scrollTo(0, 0);
});

window.addEventListener('popstate', () => {
  if (screen !== 'settings') return;
  checkDirtyAndProceed(() => {
    if (settingsBack()) history.pushState({ settings: 1 }, '');
    else { screen = 'work'; renderSettings(false); window.scrollTo(0, workScroll); }
  }, () => history.pushState({ settings: 1 }, ''));
});
document.getElementById('close-settings')?.addEventListener('click', leaveSettings);

document.querySelectorAll('.settings-menu .group-link').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = /** @type {HTMLElement} */ (btn).dataset.view;
    if (!v) return;
    checkDirtyAndProceed(() => {
      const wide = window.matchMedia('(min-width: 960px)').matches;
      if (!wide && !activeView) {
        history.pushState({ settings: 1, view: v }, '');
      }
      activeView = v;
      renderSettings();
      window.scrollTo(0, 0);
    });
  });
});

document.querySelectorAll('.settings-detail [data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    checkDirtyAndProceed(() => {
      const old = activeView;
      const isWide = window.matchMedia('(min-width: 960px)').matches;
      if (!isWide) {
        activeView = '';
        renderSettings(false);
        const item = /** @type {HTMLElement|null} */ (document.querySelector(`.settings-menu [data-view="${old}"]`));
        if (item) item.focus();
        else document.getElementById('settings-title')?.focus();
      } else {
        leaveSettings();
      }
    });
  });
});

window.matchMedia('(min-width: 960px)').addEventListener('change', () => {
  if (screen === 'settings' && !activeView) activeView = 'account';
  renderSettings(false);
});

document.addEventListener('toggle', e => {
  const target = /** @type {HTMLDetailsElement|null} */ (e.target);
  if (target?.matches('.row-actions[open]')) {
    document.querySelectorAll('.row-actions[open]').forEach(d => {
      if (d !== target) /** @type {HTMLDetailsElement} */ (d).open = false;
    });
  }
}, true);

node('ai-settings-form')?.addEventListener('input', () => {
  quotaDirty = true;
});
