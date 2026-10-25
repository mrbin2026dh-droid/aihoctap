// @ts-check
import {api, ApiError, API_BASE} from './api.js';
import * as db from './db.js';
import * as ui from './teacher-ui.js';
import {parseExamRows, templateRows} from './exam-import.js';
import {el, button, renderMarkdown, dialogBox, confirmBox, noticeBox, withBusy, setFieldError, mapErrorMessage} from './dom.js';
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
/** Thông báo dạng hộp thoại: mỗi thông báo một hộp thoại, hiện lần lượt (không dùng thanh nổi/toast).
 * @param {string} text @param {boolean} [error] */
function notify(text, error = false) {
  if (!text) return;
  void noticeBox({title: error ? 'Chưa thực hiện được' : 'Đã hoàn tất', body: text}).catch(() => {});
}
let generation = 0;
let lessonDirty = false;
let quotaDirty = false;
const DRAFT_KEY = 'aisgk-teacher-draft';
/** Phiên hết hạn: Worker trả 401, hoặc 403 kèm thông báo token cho đường dẫn giáo viên. */
function isAuthError(e) { return e instanceof ApiError && (e.status === 401 || (e.status === 403 && /Token xác thực/.test(e.message))); }
/** @param {Error} error */
function fail(error) {
  if (isAuthError(error)) {token = ''; sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); mustChangePin = false; generation++; updateAuth();}
  if (isAuthError(error)) { notify('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', true); return; }
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
  /** @type {HTMLInputElement} */ (code.querySelector('input')).pattern = '[a-z0-9][a-z0-9_\-]{0,63}';
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
  const topic = inputLabel('Chủ đề kiến thức (giúp báo cáo điểm yếu)', 'topic', question?.topic || '');
  const topicInput = /** @type {HTMLInputElement} */ (topic.querySelector('input')); topicInput.required = false; topicInput.maxLength = 60; topicInput.placeholder = 'Ví dụ: Phần cứng máy tính';
  section.append(topic, hint, button('Xóa câu hỏi', () => section.remove(), 'danger'));
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
    questions.push({id:value('question-id'), prompt:value('prompt'), kind, options, correct_answer:kind === 'choice' ? value('correct_answer') : '', hint:value('hint'), topic:value('topic')});
  }
  return {subject_id:field('subject_id').value.trim(), subject_name:field('subject_name').value.trim(), grade:Number(field('grade').value), lesson_id:field('lesson_id').value.trim(), title:field('title').value.trim(), content_markdown:field('content_markdown').value, questions};
}
/** @type {Array<{course:string, courseTitle:string, grade:number, id:string, title:string, version:string, questions:number}>} */
let lessonIndex = [];
async function refresh() {
  const captured = generation;
  const catalog = /** @type {import('./contracts').Catalog} */ (await api('/pwa/catalog'));
  if (captured !== generation) return;
  const select = /** @type {HTMLSelectElement} */ (node('published'));
  select.replaceChildren(el('option', 'Chọn bài để chỉnh sửa'));
  lessonIndex = [];
  const courseSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('field-material-form-material_course_id'));
  courseSelect?.replaceChildren(Object.assign(el('option', 'Chọn khóa học'), {value: ''}));
  for (const course of catalog.courses) {
    if (courseSelect) { const o = el('option', course.title); o.value = course.id; courseSelect.append(o); }
    for (const lesson of course.lessons) {
      const option = el('option', `${course.title} · ${lesson.title}`); option.value = `${course.id}/${lesson.id}`; select.append(option);
      lessonIndex.push({course: course.id, courseTitle: course.title, grade: Number(course.grade), id: lesson.id, title: lesson.title, version: String(lesson.version || ''), questions: Number(lesson.question_count || 0)});
    }
  }
  const subjectFilter = /** @type {HTMLSelectElement|null} */ (document.getElementById('field-lesson_subject'));
  if (subjectFilter) {
    const keep = subjectFilter.value;
    subjectFilter.replaceChildren(Object.assign(el('option', 'Tất cả'), {value: ''}));
    for (const course of catalog.courses) { const o = el('option', course.title); o.value = course.id; subjectFilter.append(o); }
    subjectFilter.value = [...subjectFilter.options].some(o => o.value === keep) ? keep : '';
  }
  renderLessonList();
}
function renderLessonList() {
  const box = document.getElementById('lesson-list'); if (!box) return;
  const q = String(/** @type {HTMLInputElement|null} */ (document.getElementById('field-lesson_search'))?.value || '').trim().toLowerCase();
  const g = String(/** @type {HTMLSelectElement|null} */ (document.getElementById('field-lesson_grade'))?.value || '');
  const sj = String(/** @type {HTMLSelectElement|null} */ (document.getElementById('field-lesson_subject'))?.value || '');
  const items = lessonIndex.filter(l => (!g || String(l.grade) === g) && (!sj || l.course === sj) && (!q || `${l.title} ${l.courseTitle}`.toLowerCase().includes(q)));
  box.replaceChildren();
  if (!items.length) { box.append(el('p', lessonIndex.length ? 'Không có bài nào khớp bộ lọc.' : 'Chưa có bài học nào được xuất bản. Bấm "Soạn bài mới" để bắt đầu.', 't-muted')); return; }
  for (const l of items) {
    const card = el('article', '', 't-card t-list-item');
    const info = el('div');
    info.append(el('h3', l.title), el('p', `Lớp ${l.grade} · ${l.courseTitle} · ${l.questions} câu hỏi${l.version ? ` · Phiên bản ${l.version.slice(0, 6)}` : ''}`, 't-muted'), el('span', 'Đã xuất bản', 't-badge'));
    const open = button('Mở', async () => {
      await withBusy(open, 'Đang mở…', async () => {
        try {
          const captured = generation;
          const doc = await api(`/pwa/teacher/lesson/${l.course}/${l.id}`, {token});
          if (captured === generation && token) { fill(doc); lessonDirty = false; await ui.showSub('detail-lessons'); }
        } catch (error) { fail(error instanceof Error ? error : new Error('Chưa mở được bài học.')); }
      });
    });
    open.setAttribute('aria-label', `Mở bài ${l.title}`);
    card.append(info, open); box.append(card);
  }
}
for (const id of ['field-lesson_search', 'field-lesson_grade', 'field-lesson_subject']) {
  document.getElementById(id)?.addEventListener('input', renderLessonList);
  document.getElementById(id)?.addEventListener('change', renderLessonList);
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
/** Thư viện Excel nạp khi cần (chỉ giáo viên dùng), lưu cục bộ trong thư mục vendor.
 * @param {string} src @returns {Promise<void>} */
const scriptLoads = new Map();
function loadScript(src) {
  if (!scriptLoads.has(src)) scriptLoads.set(src, new Promise((resolve, reject) => {
    const tag = document.createElement('script'); tag.src = src; tag.onload = () => resolve(); tag.onerror = () => { scriptLoads.delete(src); reject(new Error('Không tải được bộ đọc Excel. Kiểm tra kết nối mạng rồi thử lại.')); }; document.head.append(tag);
  }));
  return /** @type {Promise<void>} */ (scriptLoads.get(src));
}
/** @type {{questions:import('./exam-import.js').ImportedQuestion[], total_points:number}} */
let importedExam = {questions: [], total_points: 0};
async function downloadExamTemplate() {
  await loadScript('./vendor/write-excel-file.min.js');
  const sample = templateRows();
  /** @param {unknown} v @param {boolean} [bold] */
  const cell = (v, bold = false) => typeof v === 'number' ? {value: v, type: Number, ...(bold ? {fontWeight: 'bold'} : {})} : {value: String(v ?? ''), ...(bold ? {fontWeight: 'bold'} : {})};
  const questions = sample.questions.map((row, i) => row.map(v => cell(v, i === 0)));
  const guide = sample.guide.map((row, i) => row.map(v => cell(v, i === 0)));
  const widths = [6, 14, 52, 28, 28, 28, 28, 14, 8, 22, 34];
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([
    {data: questions, sheet: 'Câu hỏi', columns: widths.map(width => ({width})), stickyRowsCount: 1},
    {data: guide, sheet: 'Hướng dẫn', columns: [{width: 110}]}
  ]).toFile('mau-de-kiem-tra.xlsx');
}
/** @param {File} file */
async function importExamFile(file) {
  const target = node('exam-import-preview'); target.replaceChildren(el('p', 'Đang kiểm tra file…', 't-muted'));
  importedExam = {questions: [], total_points: 0};
  if (!/\.xlsx$/i.test(file.name)) { target.replaceChildren(el('p', 'Chỉ nhận file .xlsx. Hãy dùng file tải từ "Tải mẫu Excel đề".', 'notice error')); return; }
  if (file.size > 2 * 1024 * 1024) { target.replaceChildren(el('p', 'File lớn hơn 2 MB. Hãy tách thành nhiều đề.', 'notice error')); return; }
  /** @type {unknown[][]} */ let rows;
  try {
    await loadScript('./vendor/read-excel-file.min.js');
    // @ts-ignore thư viện nạp bằng thẻ script
    const result = await globalThis.readXlsxFile(file);
    rows = Array.isArray(result) && result.length && result[0] && !Array.isArray(result[0]) && result[0].data ? result[0].data : result;
  } catch (e) {
    target.replaceChildren(el('p', e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file. Hãy dùng file .xlsx tải từ mẫu, không đổi định dạng.', 'notice error')); return;
  }
  const parsed = parseExamRows(rows);
  target.replaceChildren();
  if (parsed.fatal) { target.append(el('p', parsed.fatal, 'notice error')); if (!parsed.reports.length) return; }
  const bad = parsed.reports.filter(r => !r.ok).length;
  if (parsed.valid) {
    importedExam = {questions: parsed.questions, total_points: parsed.total_points};
    const kinds = {choice: parsed.questions.filter(q => q.kind === 'choice').length, text: parsed.questions.filter(q => q.kind === 'text').length};
    target.append(el('p', `Tải lên thành công: ${parsed.questions.length} câu (${kinds.choice} trắc nghiệm, ${kinds.text} tự luận), tổng ${String(parsed.total_points).replace('.', ',')} điểm.`, 'notice success'));
    if (parsed.total_points !== 10) target.append(el('p', `Tổng điểm là ${String(parsed.total_points).replace('.', ',')}, không phải 10. Điểm của học sinh sẽ quy về thang 10.`, 't-muted'));
  } else if (bad) target.append(el('p', `Có ${bad} dòng chưa đúng. Sửa trong file rồi tải lại; chưa có câu nào được nhận.`, 'notice error'));
  const table = el('table', '', 't-table'); table.append(el('caption', 'Kết quả kiểm tra từng dòng'));
  const head = el('thead'); const hr = el('tr'); for (const name of ['Dòng', 'Câu hỏi', 'Loại', 'Điểm', 'Kết quả']) { const th = el('th', name); th.scope = 'col'; hr.append(th); } head.append(hr);
  const body = el('tbody');
  const byRow = new Map(parsed.questions.map(q => [q.row, q]));
  for (const report of parsed.reports) {
    const q = byRow.get(report.row); const tr = el('tr');
    const line = /** @type {unknown[]} */ (rows[report.row - 1] || []);
    const cells = [[String(report.row), 'Dòng'], [String(q?.prompt ?? line[2] ?? '').slice(0, 80), 'Câu hỏi'], [q ? (q.kind === 'choice' ? 'Trắc nghiệm' : 'Tự luận') : String(line[1] ?? ''), 'Loại'], [q ? String(q.points).replace('.', ',') : String(line[8] ?? ''), 'Điểm']];
    for (const [value, label] of cells) { const td = el('td', value); td.dataset.label = label; tr.append(td); }
    const result = el('td'); result.dataset.label = 'Kết quả';
    result.append(report.ok ? el('span', 'Hợp lệ', 't-badge') : el('span', report.errors.join('; '), 't-badge t-badge-error')); tr.append(result); body.append(tr);
  }
  table.append(head, body); target.append(table);
}
const examFileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('field-exam-file'));
examFileInput?.addEventListener('change', () => { const file = examFileInput.files?.[0]; if (file) importExamFile(file).catch(e => notify(e instanceof Error ? e.message : 'Chưa đọc được file.', true)).finally(() => { examFileInput.value = ''; }); });
document.getElementById('act-exams-template')?.addEventListener('click', () => { downloadExamTemplate().catch(e => notify(e instanceof Error ? e.message : 'Chưa tạo được file mẫu.', true)); });
/** @type {string|null} */
let editingExamId = null;
const EXAM_STATE_TEXT = {draft: 'Nháp', upcoming: 'Sắp mở', open: 'Đang mở', closed: 'Đã đóng'};
/** @param {number|null|undefined} ms */
function dateText(ms) { return ms ? new Date(ms).toLocaleString('vi-VN', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '—'; }
/** @param {number|null|undefined} ms */
function localInput(ms) { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
/** @param {string} id */
function examField(id) { return /** @type {HTMLInputElement} */ (node(`field-${id}`)); }
function resetExamForm() {
  editingExamId = null; importedExam = {questions: [], total_points: 0};
  /** @type {HTMLFormElement} */ (node('form-exams')).reset();
  node('exam-import-preview').replaceChildren(el('p', 'Chưa tải file. Bấm "Tải mẫu Excel đề", điền câu hỏi và điểm từng câu rồi tải lên.', 't-muted'));
  node('exam-save-status').textContent = '';
  examField('exam_mode').dispatchEvent(new Event('change'));
}
async function loadExams() {
  const captured = generation;
  const body = node('exams-tbody');
  /** @type {any} */ let data;
  try { data = await api('/pwa/teacher/exams', {token}); }
  catch (error) {
    if (isAuthError(error)) throw error;
    if (captured === generation) { const tr = el('tr'); const td = el('td', error instanceof ApiError && error.status === 404 ? 'Máy chủ chưa cập nhật phần kiểm tra. Hãy triển khai bản máy chủ mới rồi tải lại.' : 'Chưa tải được danh sách đề.', 't-muted'); td.colSpan = 7; tr.append(td); body.replaceChildren(tr); }
    return;
  }
  if (captured !== generation || !token) return;
  body.replaceChildren();
  const exams = Array.isArray(data?.exams) ? data.exams : [];
  if (!exams.length) { const tr = el('tr'); const td = el('td', 'Chưa có đề kiểm tra. Bấm "Thêm đề kiểm tra".', 't-muted'); td.colSpan = 7; tr.append(td); body.append(tr); return; }
  for (const e of exams) {
    const tr = el('tr'); /** @param {string} label @param {Node|string} content */
    const cell = (label, content) => { const td = el('td'); td.dataset.label = label; td.append(content); tr.append(td); return td; };
    cell('Tên đề', e.title);
    cell('Lớp / Môn', `Lớp ${e.grade}${e.class_codes?.length ? ' · ' + e.class_codes.join(', ') : ''}`);
    cell('Loại / Thời lượng', e.mode === 'real' ? `Thật · ${e.minutes} phút` : 'Thử · không giới hạn giờ');
    cell('Mở – Đóng', e.mode === 'real' ? `${dateText(e.opens_at)} – ${dateText(e.closes_at)}` : '—');
    cell('Trạng thái', el('span', EXAM_STATE_TEXT[/** @type {keyof typeof EXAM_STATE_TEXT} */ (e.state)] || e.state, `t-badge${e.state === 'closed' ? ' t-badge-error' : ''}`));
    const n = cell('Bài nộp', String(e.submissions)); n.className = 't-number';
    const actions = el('div', '', 't-actions-inline');
    actions.append(button('Sửa', () => editExam(e.exam_id).catch(fail), 't-button'));
    if (e.mode === 'real') actions.append(button('Theo dõi', () => openExamMonitor(e.exam_id).catch(fail), 't-button'));
    actions.append(button('Thống kê', () => openExamStats(e.exam_id).catch(fail), 't-button'));
    const toggle = e.status === 'open' ? ['Đóng đề', 'closed'] : ['Mở đề', 'open'];
    actions.append(button(toggle[0], () => setExamStatus(e.exam_id, toggle[1]).catch(fail), 't-button'));
    cell('Thao tác', actions); body.append(tr);
  }
}
/** @type {any} */ let examView = null; let monitorTimer = 0;
const EXAM_ROW_STATUS = {in_progress: 'Đang làm', not_started: 'Chưa vào', submitted: 'Đã nộp'};
/** @param {string} id */
async function fetchExamResults(id) { return api(`/pwa/teacher/exams/${id}/results`, {token}); }
/** @param {number|null} ms */
function remainText(ms) { if (ms === null || ms === undefined) return '—'; const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${m}:${String(s).padStart(2, '0')}`; }
/** @param {string} id @param {string[][]} items */
function fillMetrics(id, items) { const dl = node(id); dl.replaceChildren(); for (const [k, v] of items) { const d = el('div'); d.append(el('dt', k), el('dd', v)); dl.append(d); } }
/** @param {number|null|undefined} v */
const num = v => (v === null || v === undefined ? '—' : String(v).replace('.', ','));
/** @param {string} id */
async function openExamMonitor(id) {
  await ui.showSub('detail-exams-monitor');
  clearInterval(monitorTimer);
  const refresh = async () => {
    const data = await fetchExamResults(id); examView = {id, data};
    node('exam-mon-title').textContent = data.exam.title;
    node('exam-mon-sub').textContent = `Lớp ${data.exam.grade}${data.exam.class_codes?.length ? ' · ' + data.exam.class_codes.join(', ') : ''} · ${data.exam.minutes} phút · cập nhật ${new Date(data.server_now).toLocaleTimeString('vi-VN')}`;
    const s = data.stats;
    fillMetrics('exam-mon-metrics', [['Tổng học sinh', String(s.total)], ['Đang làm', String(s.in_progress)], ['Đã nộp', String(s.submitted)], ['Chưa vào', String(s.not_started)]]);
    const body = node('exam-mon-body'); body.replaceChildren();
    if (!data.rows.length) { const tr = el('tr'); const td = el('td', 'Chưa có học sinh thuộc đề này.', 't-muted'); td.colSpan = 7; tr.append(td); body.append(tr); }
    for (const r of data.rows) {
      const tr = el('tr'); /** @param {string} label @param {Node|string} c @param {string} [cls] */
      const cell = (label, c, cls = '') => { const td = el('td'); td.dataset.label = label; if (cls) td.className = cls; td.append(c); tr.append(td); return td; };
      cell('Học sinh', r.name); cell('Lớp', r.class_code || '—');
      cell('Trạng thái', el('span', `${EXAM_ROW_STATUS[/** @type {keyof typeof EXAM_ROW_STATUS} */ (r.status)]}${r.late ? ' (nộp muộn)' : ''}`, `t-badge${r.status === 'in_progress' ? '' : r.status === 'not_started' ? ' t-badge-error' : ''}`));
      cell('Còn lại', r.status === 'in_progress' ? remainText(r.remaining_ms) : '—', 't-number');
      cell('Rời tab', r.leaves ? String(r.leaves) : '0', `t-number${r.leaves >= 3 ? ' t-warn' : ''}`);
      cell('Điểm', r.status === 'submitted' ? `${num(r.best_score)}${r.needs_review ? ' *' : ''}` : '—', 't-number');
      const act = el('div', '', 't-actions-inline');
      if (r.status === 'in_progress' && data.exam.mode === 'real') act.append(button('Gia hạn', () => extendStudent(id, r, refresh), 't-button'));
      cell('Thao tác', act.childElementCount ? act : '—');
      body.append(tr);
    }
  };
  await refresh();
  monitorTimer = window.setInterval(() => { if (document.getElementById('detail-exams-monitor')?.hidden) { clearInterval(monitorTimer); return; } refresh().catch(() => {}); }, 15000);
  node('exam-mon-refresh').onclick = () => { refresh().catch(fail); };
}
/** @param {string} id @param {any} row @param {()=>Promise<void>} refresh */
async function extendStudent(id, row, refresh) {
  const res = await dialogBox({kind: 'prompt', title: `Gia hạn cho ${row.name}`, body: 'Nhập số phút cộng thêm (1–120). Chỉ áp dụng cho bài đang làm.', okText: 'Gia hạn',
    fields: [{name: 'minutes', label: 'Số phút', value: '5', validate: v => (/^\d{1,3}$/.test(v) && +v >= 1 && +v <= 120) ? '' : 'Nhập số từ 1 đến 120.'}]});
  if (!res || typeof res !== 'object') return;
  await api(`/pwa/teacher/exams/${id}/extend`, {method: 'POST', token, body: {uid: row.uid, minutes: parseInt(res.minutes, 10)}});
  notify(`Đã gia hạn ${res.minutes} phút cho ${row.name}.`); await refresh();
}
const BUCKETS = ['0–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9–10'];
/** @param {string} id */
async function openExamStats(id) {
  await ui.showSub('detail-exams-stats');
  const data = await fetchExamResults(id); examView = {id, data};
  node('exam-stats-title').textContent = `Thống kê: ${data.exam.title}`;
  node('exam-stats-sub').textContent = `${data.stats.submitted}/${data.stats.total} học sinh đã nộp · * là còn câu tự luận chờ chấm`;
  const s = data.stats;
  fillMetrics('exam-stats-metrics', [['Điểm trung bình', num(s.avg)], ['Cao nhất', num(s.max)], ['Thấp nhất', num(s.min)], ['Đã nộp / Tổng', `${s.submitted} / ${s.total}`]]);
  const dist = s.distribution; const top = Math.max(1, ...dist);
  const NS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 400 170'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Phân bố điểm: ${dist.map((n, i) => `${BUCKETS[i]}: ${n}`).join('; ')}`);
  const axis = document.createElementNS(NS, 'path'); axis.setAttribute('class', 't-chart-axis'); axis.setAttribute('d', 'M10 140H390'); svg.append(axis);
  dist.forEach((n, i) => {
    const h = Math.round((n / top) * 110); const x = 14 + i * 38;
    const r = document.createElementNS(NS, 'rect'); r.setAttribute('class', 't-chart-bar'); r.setAttribute('x', String(x)); r.setAttribute('y', String(140 - h)); r.setAttribute('width', '30'); r.setAttribute('height', String(h)); svg.append(r);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', String(x + 15)); t.setAttribute('y', '156'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '10'); t.setAttribute('fill', 'currentColor'); t.textContent = String(i + 1); svg.append(t);
    if (n) { const v = document.createElementNS(NS, 'text'); v.setAttribute('x', String(x + 15)); v.setAttribute('y', String(136 - h)); v.setAttribute('text-anchor', 'middle'); v.setAttribute('font-size', '11'); v.setAttribute('fill', 'currentColor'); v.textContent = String(n); svg.append(v); }
  });
  node('exam-stats-chart').replaceChildren(svg);
  const fillBody = (/** @type {string} */ bid, /** @type {(string|number)[][]} */ rows, /** @type {number} */ cols) => {
    const b = node(bid); b.replaceChildren();
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'Chưa có dữ liệu.', 't-muted'); td.colSpan = cols; tr.append(td); b.append(tr); return; }
    for (const r of rows) { const tr = el('tr'); r.forEach((v, i) => { const td = el('td', String(v)); if (typeof v === 'number' || /^\d+%$/.test(String(v))) td.className = 't-number'; td.dataset.label = i === 0 ? 'Mục' : ''; tr.append(td); }); b.append(tr); }
  };
  fillBody('exam-stats-dist', dist.map((n, i) => [`${BUCKETS[i]} điểm`, n]), 2);
  fillBody('exam-stats-questions', (data.questions || []).map((/** @type {any} */ q) => [`Câu ${q.number}`, q.topic || '—', q.percent === null ? '—' : `${q.percent}%`, q.top_wrong ? `${q.top_wrong.key}. ${q.top_wrong.text} (${q.top_wrong.count})` : '—']), 4);
  fillBody('exam-stats-rank', data.ranking.map((/** @type {any} */ r) => [r.rank, r.name + (r.needs_review ? ' *' : ''), r.class_code || '—', num(r.score)]), 4);
  const exp = /** @type {HTMLButtonElement} */ (node('act-exams-export')); exp.disabled = false; exp.removeAttribute('aria-disabled'); exp.onclick = () => { exportExamResults().catch(fail); };
}
async function exportExamResults() {
  if (!examView) return; const {data} = examView;
  await loadScript('./vendor/write-excel-file.min.js');
  /** @param {unknown} v @param {boolean} [bold] */
  const cell = (v, bold = false) => typeof v === 'number' ? {value: v, type: Number, ...(bold ? {fontWeight: 'bold'} : {})} : {value: String(v ?? ''), ...(bold ? {fontWeight: 'bold'} : {})};
  const head = ['Hạng', 'Họ và tên', 'Lớp', 'Trạng thái', 'Số lượt', 'Điểm cao nhất', 'Rời tab', 'Nộp muộn', 'Chờ chấm tự luận'].map(v => cell(v, true));
  const rankOf = new Map(data.ranking.map((/** @type {any} */ r) => [r.uid, r.rank]));
  const rows = data.rows.map((/** @type {any} */ r) => [rankOf.get(r.uid) ?? '', r.name, r.class_code, EXAM_ROW_STATUS[/** @type {keyof typeof EXAM_ROW_STATUS} */ (r.status)], r.attempts_used, r.best_score ?? '', r.leaves, r.late ? 'Có' : '', r.needs_review ? 'Có' : ''].map(v => cell(v)));
  const safe = String(data.exam.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'bai_kiem_tra';
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([{data: [head, ...rows], sheet: 'Kết quả', columns: [6, 28, 8, 14, 9, 14, 9, 11, 18].map(width => ({width})), stickyRowsCount: 1}]).toFile(`ket_qua_${safe}.xlsx`);
  notify('Đã xuất file Excel kết quả.');
}
/** @param {string} id @param {string} status */
async function setExamStatus(id, status) {
  await api(`/pwa/teacher/exams/${id}/status`, {method: 'POST', token, body: {status}});
  notify(status === 'open' ? 'Đã mở đề cho học sinh.' : 'Đã đóng đề.');
  await loadExams();
}
/** @param {string} id */
async function editExam(id) {
  const exam = await api(`/pwa/teacher/exams/${id}`, {token});
  resetExamForm(); editingExamId = id;
  examField('exam_title').value = exam.title; examField('exam_grade').value = String(exam.grade); examField('exam_kind').value = exam.kind; examField('exam_mode').value = exam.mode;
  examField('exam_mode').dispatchEvent(new Event('change'));
  examField('exam_minutes').value = exam.minutes ?? ''; examField('exam_open').value = localInput(exam.opens_at); examField('exam_close').value = localInput(exam.closes_at);
  examField('exam_attempts').value = String(exam.max_attempts ?? 1); examField('exam_answers').value = exam.reveal; examField('exam-shuffle').checked = Boolean(exam.shuffle);
  importedExam = {questions: exam.questions.map(/** @param {any} q @param {number} i */ (q, i) => ({row: i + 2, kind: q.kind, prompt: q.prompt, options: q.options, correct_answer: q.correct_answer, points: q.points, topic: q.topic || '', hint: q.hint || ''})), total_points: exam.total_points};
  node('exam-import-preview').replaceChildren(el('p', `Đề đang có ${exam.questions.length} câu, tổng ${String(exam.total_points).replace('.', ',')} điểm. Tải file Excel mới nếu muốn thay toàn bộ câu hỏi.`, 'notice success'));
  await ui.showSub('detail-exams');
}
document.getElementById('act-exams-new')?.addEventListener('click', resetExamForm);
document.getElementById('form-exams')?.addEventListener('submit', async event => {
  event.preventDefault();
  const status = node('exam-save-status'); status.textContent = ''; const real = examField('exam_mode').value === 'real';
  const title = examField('exam_title');
  if (!title.value.trim()) { setFieldError(title, 'Nhập tiêu đề đề kiểm tra.'); title.focus(); return; }
  setFieldError(title, '');
  if (!importedExam.questions.length) { status.textContent = 'Chưa có câu hỏi. Hãy tải file Excel câu hỏi hợp lệ lên trước.'; return; }
  const ms = (/** @type {string} */ id) => { const v = examField(id).value; return v ? new Date(v).getTime() : NaN; };
  const payload = {
    exam_id: editingExamId || undefined, title: title.value.trim(), grade: Number(examField('exam_grade').value), subject_id: examField('exam_subject').value, mode: examField('exam_mode').value,
    kind: examField('exam_kind').value, minutes: real ? Number(examField('exam_minutes').value) : undefined, opens_at: real ? ms('exam_open') : undefined, closes_at: real ? ms('exam_close') : undefined,
    max_attempts: real ? Number(examField('exam_attempts').value) : undefined, shuffle: examField('exam-shuffle').checked, reveal: examField('exam_answers').value, status: 'draft',
    questions: importedExam.questions.map(({kind, prompt, options, correct_answer, points, topic, hint}) => ({kind, prompt, options, correct_answer, points, topic, hint}))
  };
  const submit = /** @type {HTMLButtonElement} */ (node('save-exam'));
  await withBusy(submit, 'Đang lưu…', async () => {
    try {
      if (editingExamId) { const old = await api(`/pwa/teacher/exams/${editingExamId}`, {token}); payload.status = old.status; }
      const res = await api('/pwa/teacher/exams', {method: 'POST', token, body: payload});
      notify(payload.status === 'open' ? 'Đã lưu đề (đang mở).' : 'Đã lưu đề ở trạng thái nháp. Bấm "Mở đề" trong danh sách khi sẵn sàng giao cho học sinh.');
      editingExamId = res.exam_id; await loadExams(); await ui.showSub('list-exams');
    } catch (error) { if (isAuthError(error)) { fail(error); return; } status.textContent = error instanceof ApiError && error.status === 400 ? error.message : mapErrorMessage(error); }
  });
});
const LEVEL_TEXT = {weak: 'Yếu', fair: 'Cần củng cố', good: 'Tốt', none: 'Chưa có'};
/** @param {number|null} percent @param {string} level */
function levelBar(percent, level) {
  const row = el('div', '', 'a-bar-row'); const track = el('div', '', 'a-bar'); const fill = el('span', '', `a-fill a-${level}`); fill.style.width = `${percent ?? 0}%`; track.append(fill);
  row.append(track, el('span', percent === null ? '–' : `${percent}%`, 'a-pct'), el('span', LEVEL_TEXT[/** @type {keyof typeof LEVEL_TEXT} */ (level)] || '', `a-tag a-${level}`));
  return row;
}
/** @param {string} title @param {string} [note] */
function analyticsBlock(title, note) { const block = el('section', '', 'a-block'); block.append(el('h3', title)); if (note) block.append(el('p', note, 't-muted')); return block; }
async function loadAnalytics() {
  const captured = generation;
  const target = node('teacher-analytics'); target.replaceChildren(el('p', 'Đang tải báo cáo…', 't-muted'));
  /** @type {any} */ let data;
  try { data = await api('/pwa/teacher/analytics', {token}); }
  catch (error) {
    if (isAuthError(error)) throw error;
    if (captured === generation) target.replaceChildren(el('p', error instanceof ApiError && error.status === 404 ? 'Máy chủ chưa cập nhật tính năng báo cáo. Hãy triển khai bản máy chủ mới rồi tải lại.' : 'Chưa tải được báo cáo. Bấm "Tải lại báo cáo" để thử lại.', 't-muted'));
    return;
  }
  if (captured !== generation || !token) return;
  target.replaceChildren();
  const hasDetail = (data.lessons || []).some(/** @param {any} l */ l => l.questions.length);
  const studentCount = (data.students || []).length;
  const summary = el('p', `${data.total_attempts || 0} lượt nộp · ${studentCount} học sinh · ${(data.lessons || []).length} bài. Yếu: dưới 50% đúng · Cần củng cố: 50–79% · Tốt: từ 80%.`, 't-muted'); target.append(summary);
  if (!hasDetail) { target.append(el('p', 'Chưa có dữ liệu từng câu. Báo cáo sẽ xuất hiện sau khi học sinh nộp bài mới.', 't-muted')); return; }
  const topics = analyticsBlock('Chủ đề cần củng cố', 'Gom theo "Chủ đề kiến thức" gắn cho từng câu hỏi khi soạn bài.');
  for (const item of data.topics || []) { const row = el('div', '', 'a-item'); row.append(el('strong', item.topic), el('span', `${item.correct}/${item.total} lượt đúng`, 't-muted'), levelBar(item.percent, item.level)); topics.append(row); }
  if (!(data.topics || []).length) topics.append(el('p', 'Chưa có câu hỏi nào được gắn chủ đề. Hãy điền ô "Chủ đề kiến thức" trong phần Luyện tập của bài.', 't-muted'));
  const weakQuestions = el('section', '', 'a-block'); weakQuestions.append(el('h3', 'Câu hỏi nhiều bạn làm sai'));
  /** @type {any[]} */ const flat = [];
  for (const lesson of data.lessons || []) for (const q of lesson.questions) if (q.level !== 'good') flat.push({lesson, q});
  flat.sort((a, b) => (a.q.percent ?? 101) - (b.q.percent ?? 101));
  for (const {lesson, q} of flat.slice(0, 8)) {
    const row = el('div', '', 'a-item'); row.append(el('strong', `${lesson.title} · Câu ${q.number}`), el('span', q.prompt, 'a-prompt'), levelBar(q.percent, q.level));
    const detail = [`${q.correct}/${q.answered} bạn đúng`]; if (q.blank) detail.push(`${q.blank} bạn bỏ trống`);
    if (q.top_wrong) detail.push(`nhiều bạn chọn ${q.top_wrong.key}${q.top_wrong.text ? `: ${q.top_wrong.text}` : ''} (${q.top_wrong.count} bạn)`);
    row.append(el('span', detail.join(' · '), 't-muted')); weakQuestions.append(row);
  }
  if (!flat.length) weakQuestions.append(el('p', 'Chưa có câu nào cần chú ý. Cả lớp đang làm tốt.', 't-muted'));
  const people = analyticsBlock('Học sinh cần hỗ trợ', 'Điểm là trung bình các bài, lấy lần nộp gần nhất của mỗi bài.');
  for (const st of (data.students || []).filter(/** @param {any} x */ x => x.level !== 'good').slice(0, 10)) {
    const row = el('div', '', 'a-item'); row.append(el('strong', [st.name, st.class_code].filter(Boolean).join(' · ')), levelBar(st.avg_percent, st.level));
    if (st.weak_topics.length) row.append(el('span', `Cần ôn: ${st.weak_topics.map(/** @param {any} w */ w => `${w.topic} (${w.percent}%)`).join(', ')}`, 't-muted'));
    people.append(row);
  }
  if (!(data.students || []).some(/** @param {any} x */ x => x.level !== 'good')) people.append(el('p', 'Chưa có học sinh nào cần hỗ trợ.', 't-muted'));
  target.append(topics, weakQuestions, people);
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
      ui.reset();
      if (!mustChangePin) {
        const parts = [['danh sách bài', refresh], ['bài học sinh đã nộp', results], ['báo cáo điểm yếu', loadAnalytics], ['danh sách đề kiểm tra', loadExams], ['khóa Gemini', loadGeminiKeys], ['hạn mức AI', loadAiUsage], ['danh sách học sinh', loadStudents]];
        const settled = await Promise.allSettled(parts.map(([, fn]) => fn()));
        const failed = parts.filter((_, i) => settled[i].status === 'rejected').map(([name]) => name);
        if (failed.length) notify(`Đã đăng nhập nhưng chưa tải được: ${failed.join(', ')}. Tải lại trang để thử lại.`, true);
      } else {
      }
    } catch (error) {
      const msg = mapErrorMessage(error);
      if (loginErr) {
        loginErr.textContent = msg;
      }
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
  b.setAttribute('aria-label', (show ? 'Ẩn ' : 'Hiện ') + 'mã PIN');
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

{
  const matForm = /** @type {HTMLFormElement} */ (node('material-form'));
  const matId = /** @type {HTMLInputElement} */ (matForm.querySelector('[name=material_id]'));
  const matTitle = /** @type {HTMLInputElement} */ (matForm.querySelector('[name=material_title]'));
  /** @param {string} text */
  const slug = text => {
    const base = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tai-lieu';
    return `${base}-${Date.now().toString(36).slice(-4)}`;
  };
  matTitle.addEventListener('input', () => { if (matId.dataset.touched !== '1') matId.value = slug(matTitle.value); });
  matId.addEventListener('input', () => { matId.dataset.touched = '1'; });
  matForm.addEventListener('reset', () => { delete matId.dataset.touched; });
}
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
    await ui.showSub('list-materials');
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
    quotaDirty = false;
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
  try {await api('/pwa/teacher/publish', {method:'POST',token,body:documentValue()}); if (captured !== generation) return; lessonDirty = false; try {localStorage.removeItem(DRAFT_KEY);} catch {/* không có bộ nhớ */} await refresh(); if (captured === generation) {notify('Đã xuất bản. Học sinh nhận bản mới khi có mạng.'); await ui.showSub('list-lessons');}}
  catch (error) {if (captured === generation) fail(error instanceof Error ? error : new Error('Chưa xuất bản được.'));} finally {submit.disabled = false;}
});
on('teacher-logout', async () => {
  const oldToken = token; token = ''; mustChangePin = false; generation++; sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); updateAuth();
  form.reset(); lessonDirty = false; quotaDirty = false; try {localStorage.removeItem(DRAFT_KEY);} catch {/* không có bộ nhớ */} ui.reset(); node('question-editors').replaceChildren(); node('preview').replaceChildren(); node('teacher-results').replaceChildren(); node('published').replaceChildren(); node('lesson-list').replaceChildren(); allStudents = []; node('students-tbody').replaceChildren();
  try {await api('/teacher/logout', {method:'POST',token:oldToken});} catch {notify('Đã đăng xuất trên máy. Phiên máy chủ chưa xác nhận thu hồi.', true);}
});
on('load-lesson', async () => {
  const value = /** @type {HTMLSelectElement} */ (node('published')).value;
  if (!value.includes('/')) {notify('Chọn bài cần chỉnh sửa.'); return;}
  const captured = generation; const document = await api(`/pwa/teacher/lesson/${value}`, {token}); if (captured === generation && token) {fill(document); lessonDirty = false; await ui.showSub('detail-lessons');}
});
on('preview-button', () => {renderMarkdown(node('preview'), field('content_markdown').value); document.getElementById('tab-lesson-theory')?.click(); document.getElementById('tab-theory-preview')?.click();});
on('add-question', () => addQuestion());
on('new-lesson', async () => {
  if (!(await leaveGuard())) return;
  form.reset(); node('question-editors').replaceChildren(); node('preview').replaceChildren(); lessonDirty = false;
  for (const tab of document.querySelectorAll('#tab-lesson-info')) /** @type {HTMLElement} */ (tab).click();
  /** @type {any} */ let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
  await ui.showSub('detail-lessons');
  if (draft && typeof draft.title === 'string' && Array.isArray(draft.questions) && await confirmBox({title: 'Khôi phục bản nháp?', body: 'Máy này có một bản nháp đã lưu. Khôi phục để soạn tiếp?', okText: 'Khôi phục'})) {
    fill(draft); lessonDirty = false;  return;
  }
  
});
form.addEventListener('input', () => {lessonDirty = true;});
on('act-lessons-draft', () => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(documentValue()));
    lessonDirty = false;
    notify('Đã lưu nháp trên máy này. Nháp sẽ bị xóa khi bạn đăng xuất.');
  } catch { notify('Không lưu được nháp trên máy này.', true); }
});
on('refresh-results', results);
on('refresh-analytics', loadAnalytics);
{
  const mode = document.getElementById('field-exam_mode'); const attempts = /** @type {HTMLInputElement|null} */ (document.getElementById('field-exam_attempts')); const hint = document.getElementById('exam-mode-hint');
  const apply = () => {
    const real = /** @type {HTMLSelectElement} */ (mode).value === 'real';
    if (hint) hint.textContent = real ? 'Thật: học sinh vào màn hình thi riêng, có giờ mở/đóng, đồng hồ và nộp một lần theo số lần cho phép.' : 'Thử: học sinh làm như bài luyện tập, làm được nhiều lần, không giới hạn giờ.';
    if (attempts) { attempts.disabled = !real; if (!real) attempts.value = '1'; }
  };
  if (mode) { mode.addEventListener('change', apply); apply(); }
}
/** @type {Array<any>} */
let allStudents = [];

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
  const actionBtns = row?.querySelectorAll('.t-icon-btn');
  actionBtns?.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
  try { return await fn(); } finally {
    inFlight.delete(key);
    row?.removeAttribute('aria-busy');
    actionBtns?.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });
  }
}

/** @type {Set<string>} */
const selectedStudents = new Set();
function updateBulkBar() {
  const bar = document.querySelector('[data-bulk]');
  const count = document.querySelector('[data-selection-count]');
  if (count) count.textContent = String(selectedStudents.size);
  if (bar) /** @type {HTMLElement} */ (bar).hidden = selectedStudents.size === 0;
}
document.getElementById('students-tbody')?.addEventListener('change', event => {
  const t = /** @type {HTMLInputElement|null} */ (event.target instanceof HTMLInputElement ? event.target : null);
  if (!t || t.dataset.action !== 'select-student' || !t.dataset.id) return;
  if (t.checked) selectedStudents.add(t.dataset.id); else selectedStudents.delete(t.dataset.id);
  updateBulkBar();
});
document.getElementById('field-student_search')?.addEventListener('input', () => renderStudentsTable());
/** @param {'lock'|'unlock'|'delete'} kind */
async function bulkAction(kind) {
  const ids = [...selectedStudents];
  if (!ids.length) return;
  const names = ids.map(id => allStudents.find(x => x.id === id)?.name || id);
  const label = {lock: 'Khóa', unlock: 'Mở khóa', delete: 'Xóa'}[kind];
  const preview = names.slice(0, 5).join(', ') + (names.length > 5 ? ` và ${names.length - 5} học sinh khác` : '');
  if (!await confirmBox({
    title: `${label} ${ids.length} học sinh?`,
    body: `${preview}. ${kind === 'delete' ? 'Thao tác xóa không thể hoàn tác.' : kind === 'lock' ? 'Các học sinh này sẽ không đăng nhập được.' : 'Các học sinh này sẽ đăng nhập lại được.'}`,
    okText: `${label} ${ids.length} học sinh`,
    danger: kind !== 'unlock'
  })) return;
  const key = 'bulk';
  if (inFlight.has(key)) return;
  inFlight.add(key);
  const buttons = document.querySelectorAll('[data-bulk] button');
  buttons.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
  let done = 0; let failed = 0;
  try {
    for (const id of ids) {
      try {
        if (kind === 'delete') await api(`/teacher/students/${id}`, {method: 'DELETE', token});
        else await api(`/teacher/students/${id}/lock`, {method: 'POST', token, body: {locked: kind === 'lock'}});
        done++; selectedStudents.delete(id);
      } catch (e) { failed++; if (isAuthError(e)) { fail(e); return; } }
    }
  } finally {
    inFlight.delete(key);
    buttons.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });
  }
  await loadStudents();
  notify(failed ? `${label}: xong ${done}, chưa được ${failed} học sinh. Hãy thử lại những học sinh còn được chọn.` : `${label}: đã xong ${done} học sinh.`, failed > 0);
}
node('act-accounts-bulk-lock').addEventListener('click', () => { void bulkAction('lock'); });
node('act-accounts-bulk-unlock').addEventListener('click', () => { void bulkAction('unlock'); });
node('act-accounts-bulk-delete').addEventListener('click', () => { void bulkAction('delete'); });

/** Thông tin tài khoản hiện một lần trong hộp thoại (không lưu, không ghi nhật ký). */
async function showStudentPinBanner(id, pin, name) {
  const copy = await confirmBox({
    title: 'Thông tin tài khoản học sinh',
    body: `${name ? `Học sinh: ${name}\n` : ''}Mã học sinh: ${id}\nMã PIN: ${pin}\n\nMã PIN chỉ hiện một lần. Hãy sao chép hoặc ghi lại ngay.`,
    okText: 'Sao chép thông tin',
    cancelText: 'Đóng'
  });
  if (!copy) return;
  try {
    await navigator.clipboard.writeText(`Mã HS: ${id}\nMã PIN: ${pin}`);
    notify('Đã sao chép thông tin tài khoản.');
  } catch { notify('Chưa sao chép được. Hãy ghi lại thông tin trong lần hiện trước.', true); }
}

function renderStudentsTable() {
  node('students-table')?.removeAttribute('aria-busy');
  const tbody = /** @type {HTMLTableSectionElement} */ (node('students-tbody'));
  tbody.replaceChildren();
  const filterVal = /** @type {HTMLSelectElement} */ (node('students-class-filter')).value;
  const query = String(/** @type {HTMLInputElement|null} */ (document.getElementById('field-student_search'))?.value || '').trim().toLowerCase();
  const filtered = allStudents.filter(s => (!filterVal || s.class_code === filterVal) && (!query || `${s.name} ${s.id}`.toLowerCase().includes(query)));
  for (const id of [...selectedStudents]) if (!allStudents.some(s => s.id === id)) selectedStudents.delete(id);

  if (filtered.length === 0) {
    const tr = el('tr');
    const td = el('td', 'Chưa có học sinh nào.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const s of filtered) {
    const tr = el('tr');
    tr.dataset.sid = s.id;
    /** @param {string} label @param {string|Node} content */
    const cell = (label, content) => {const td = el('td'); td.dataset.label = label; td.append(content); return td;};
    const pick = document.createElement('input'); pick.type = 'checkbox'; pick.dataset.action = 'select-student'; pick.dataset.id = s.id; pick.checked = selectedStudents.has(s.id);
    const pickLabel = el('label', '', 't-check t-select-row'); pickLabel.append(pick, el('span', `Chọn học sinh ${s.name}`, 'visually-hidden'));
    tr.append(
      cell('Chọn', pickLabel),
      cell('Mã học sinh', s.id),
      cell('Họ và tên', s.name),
      cell('Lớp', `${s.class_code} (khối ${s.grade})`),
      cell('Trạng thái', el('span', s.disabled ? 'Bị khóa' : 'Hoạt động', s.disabled ? 't-badge t-badge-error' : 't-badge'))
    );

    const tdActions = el('td'); tdActions.dataset.label = 'Thao tác';
    const editBtn = button('Sửa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
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
          void showStudentPinBanner(s.id, res.pin, s.name);
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa đặt lại được mã PIN.'));
        }
      });
    });

    const lockBtn = button(s.disabled ? 'Mở khóa' : 'Khóa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
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

    const viewBtn = button('Xem', () => {
      void noticeBox({
        title: 'Thông tin học sinh',
        body: `Mã học sinh: ${s.id}\nHọ và tên: ${s.name}\nLớp: ${s.class_code} (khối ${s.grade})\nTrạng thái: ${s.disabled ? 'Bị khóa' : 'Hoạt động'}`
      });
    });
    const who = ` ${s.name}`;
    const group = el('div', '', 't-icon-actions');
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', `Thao tác với học sinh ${s.name}`);
    group.append(
      ui.toIcon(/** @type {HTMLButtonElement} */ (viewBtn), 'view', 'Xem chi tiết' + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (editBtn), 'edit', 'Sửa' + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (resetPinBtn), 'key', 'Đặt lại mã PIN' + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (lockBtn), s.disabled ? 'unlock' : 'lock', (s.disabled ? 'Mở khóa' : 'Khóa') + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (delBtn), 'trash', 'Xóa' + who, true)
    );
    tdActions.append(group);
    tr.append(tdActions);
    tbody.append(tr);
  }
  updateBulkBar();
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
      void showStudentPinBanner(res.id, res.pin, res.name);
      await loadStudents();
      await ui.showSub('list-accounts');
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
      ui.reset();
      await refresh(); await results(); await loadAnalytics(); await loadExams(); await loadGeminiKeys(); await loadAiUsage(); await loadStudents();
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
      loadAnalytics().catch(fail);
      loadExams().catch(fail);
      loadGeminiKeys();
      loadAiUsage();
      loadStudents();
    }
  }).catch(error => {
    if (captured === generation) fail(error);
  });
}


// ==========================================
// ĐIỀU HƯỚNG VÀ BẢO VỆ THAY ĐỔI CHƯA LƯU (AGENTS.md J)
// Khung hiển thị: teacher-ui.js. Hồ sơ (đổi PIN, gia sư AI, khóa API) mở từ nút "Hồ sơ".
// ==========================================
/** @returns {Promise<boolean>} true nếu được phép rời màn hình hiện tại */
async function leaveGuard() {
  if (!lessonDirty && !quotaDirty) return true;
  const what = lessonDirty ? 'Bài học đang soạn' : 'Cài đặt gia sư';
  const ok = await confirmBox({
    title: 'Bỏ thay đổi chưa lưu?',
    body: `${what} chưa được lưu.`,
    okText: 'Bỏ thay đổi',
    danger: true
  });
  if (ok) {
    if (quotaDirty) { quotaDirty = false; /** @type {HTMLFormElement|null} */ (document.getElementById('ai-settings-form'))?.reset(); }
    lessonDirty = false;
  }
  return ok;
}
node('ai-settings-form').addEventListener('input', () => { quotaDirty = true; });
window.addEventListener('beforeunload', event => { if (lessonDirty || quotaDirty) { event.preventDefault(); } });
ui.init({guard: leaveGuard});
