// @ts-check
import {api, ApiError, API_BASE} from './api.js';
import {el, button, notify, renderMarkdown} from './dom.js';
/** @typedef {import('./contracts').PublishLesson} PublishLesson */
/** @typedef {import('./contracts').PrivateQuestion} PrivateQuestion */
/** @param {string} id */
function node(id) {const result = document.getElementById(id); if (!result) throw new Error(`Thiếu ${id}`); return result;}
const form = /** @type {HTMLFormElement} */ (node('publish-form'));
let token = sessionStorage.getItem('aisgk-pwa-teacher') || '';
let generation = 0;
/** @param {Error} error */
function fail(error) {
  if (error instanceof ApiError && error.status === 401) {token = ''; sessionStorage.removeItem('aisgk-pwa-teacher'); generation++; updateAuth();}
  notify(error instanceof Error ? error.message : 'Thao tác chưa hoàn thành. Hãy thử lại.', true);
}
/** @param {string} id @param {()=>void|Promise<void>} action */
function on(id, action) {node(id).addEventListener('click', () => {
  const captured = generation;
  Promise.resolve(action()).catch(error => {if (captured === generation) fail(error);});
});}
function updateAuth() {node('auth-section').hidden = Boolean(token); node('editor').hidden = !token; node('teacher-logout').hidden = !token;}
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
  for (const attempt of data.attempts) {
    const card = el('article', '', 'progress-card');
    card.append(el('h3', `${attempt.student_name} · ${attempt.class_code}`), el('p', `${attempt.course_id} / ${attempt.lesson_id}: ${attempt.correct}/${attempt.total} câu đúng${attempt.needs_review ? ' · Cần xem tự luận' : ''}`));
    for (const [id, answer] of Object.entries(attempt.answers)) card.append(el('p', `${id}: ${answer}`));
    target.append(card);
  }
  if (!data.attempts.length) target.append(el('p', 'Chưa có bài nộp.'));
}
/** @param {PublishLesson} document */
function fill(document) {
  /** @type {Array<keyof Omit<PublishLesson,'questions'>>} */
  const names = ['subject_id','subject_name','grade','lesson_id','title','content_markdown'];
  for (const name of names) field(name).value = String(document[name]);
  node('question-editors').replaceChildren(); for (const question of document.questions) addQuestion(question); node('preview').replaceChildren();
}
node('teacher-login').addEventListener('submit', async event => {
  event.preventDefault(); const loginForm = /** @type {HTMLFormElement} */ (node('teacher-login'));
  const submit = /** @type {HTMLButtonElement} */ (loginForm.querySelector('button')); submit.disabled = true;
  try {
    const response = await api('/teacher/auth', {method:'POST', body:{pin:String(new FormData(loginForm).get('pin'))}});
    token = response.token; generation++; sessionStorage.setItem('aisgk-pwa-teacher', token); loginForm.reset(); updateAuth();
    await refresh(); await results(); await loadGeminiKeys(); await loadAiUsage(); notify('Đã đăng nhập. Sẵn sàng soạn bài.');
  } catch (error) {fail(error instanceof Error ? error : new Error('Chưa đăng nhập được.'));} finally {submit.disabled = false;}
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
            if (confirm(`Xác nhận xóa khóa ...${key.key_suffix}?`)) {
              await api(`/teacher/gemini-keys?id=${encodeURIComponent(key.id)}`, { method: 'DELETE', token });
              await loadGeminiKeys();
              notify('Đã xóa khóa khỏi bể.');
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
  const oldToken = token; token = ''; generation++; sessionStorage.removeItem('aisgk-pwa-teacher'); updateAuth();
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
updateAuth();
if (token) {const captured = generation; refresh().then(() => {if (captured === generation) { results(); loadGeminiKeys(); loadAiUsage(); }}).catch(error => {if (captured === generation) fail(error);});}
